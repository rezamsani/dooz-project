import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BoardTheme,
  CellValue,
  ColorMode,
  EnvironmentTheme,
  GameVariant,
  PieceStyle,
  Player,
  WinResult,
} from './dooz.types';
import {
  MORRIS_NODES,
  MorrisAiDecision,
  getMorrisEdges,
  getRemovableOpponentNodes,
  getValidDestinationsForNode,
} from './morris-engine';
import { MorrisState } from './morris.types';
import {
  AnimatedEnvHandles,
  buildEnvironmentDiorama,
  createPieceModel,
  createSideDishModel,
  disposeObject3D,
} from './three/models';
import { createBoardDeckMaterial } from './three/textures';

export type CameraPreset = 'TABLE' | 'TOP' | 'CINEMA';

interface ActivePieceAnim {
  mesh: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  elapsed: number;
  duration: number;
  arcHeight: number;
  removeOnFinish?: boolean;
}

// Pre-allocated scratch helpers (zero GC inside animation loop)
const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _tmpPos = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetCtrlPos = new THREE.Vector3();

const BOARD_TOP_Y = 0.24;
const DISH_X_RIGHT = 3.88;
const DISH_X_LEFT = -3.88;
const DISH_FLOOR_Y = 0.175;

const THREE_CELL_COORDS: readonly [number, number][] = [
  [-1.55, -1.55],
  [0, -1.55],
  [1.55, -1.55],
  [-1.55, 0],
  [0, 0],
  [1.55, 0],
  [-1.55, 1.55],
  [0, 1.55],
  [1.55, 1.55],
];

function morrisNodeToWorld(nodeId: number): [number, number] {
  const n = MORRIS_NODES[nodeId];
  const x = ((n.x - 200) / 156) * 2.15;
  const z = ((n.y - 200) / 156) * 2.15;
  return [x, z];
}

function getDishSlotPosition(
  player: Player,
  zone: 'reserve' | 'captured',
  slotIndex: number,
): THREE.Vector3 {
  const baseX = player === 'X' ? DISH_X_RIGHT : DISH_X_LEFT;
  const cols = 2;
  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols);
  const stackLayer = Math.floor(slotIndex / 12);
  const localRow = row % 6;

  const x = baseX + (col === 0 ? -0.28 : 0.28);
  const zStart = zone === 'reserve' ? -1.92 : 0.42;
  const z = zStart + localRow * 0.34;
  const y = DISH_FLOOR_Y + stackLayer * 0.28;
  return new THREE.Vector3(x, y, z);
}

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

@Component({
  selector: 'app-dooz-3d-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #canvasHost
      class="relative h-full w-full overflow-hidden select-none touch-none"
      role="application"
      aria-label="محیط سه‌بعدی بازی دوز"
    ></div>
  `,
})
export class Dooz3DStage implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');

  // Reactive inputs from App
  readonly variant = input.required<GameVariant>();
  readonly threeBoard = input.required<readonly CellValue[]>();
  readonly threeWin = input<WinResult | null>(null);
  readonly threeHintIndex = input<number | null>(null);
  readonly expiringIndex = input<number | null>(null);
  readonly morrisState = input.required<MorrisState>();
  readonly morrisHint = input<MorrisAiDecision | null>(null);
  readonly disabled = input<boolean>(false);

  // Side dish counts (for both 9/12 Morris & 3-piece Infinite)
  readonly showSideDishes = input<boolean>(true);
  readonly xInHand = input<number>(0);
  readonly oInHand = input<number>(0);
  readonly xOutCount = input<number>(0);
  readonly oOutCount = input<number>(0);

  // Visual style & camera preset
  readonly environment = input<EnvironmentTheme>('carpet');
  readonly boardTheme = input<BoardTheme>('walnut');
  readonly pieceStyle = input<PieceStyle>('gemstone');
  readonly colorMode = input<ColorMode>('dark');
  readonly cameraPreset = input<CameraPreset>('TABLE');

  // Interaction outputs
  readonly threeCellSelected = output<number>();
  readonly morrisNodeSelected = output<number>();

  // Three.js core handles
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private fillLight: THREE.DirectionalLight | null = null;
  private envMapTex: THREE.Texture | null = null;
  private isSoftwareGl = false;
  private maxAnisotropy = 4;
  private ready = false;

  // Dynamic scene groups
  private envGroup: THREE.Group | null = null;
  private envHandles: AnimatedEnvHandles | null = null;
  private boardGroup: THREE.Group | null = null;
  private sideDishesGroup: THREE.Group | null = null;
  private piecesGroup: THREE.Group | null = null;
  private trayPiecesGroup: THREE.Group | null = null;
  private overlayGroup: THREE.Group | null = null;
  private hoverRing: THREE.Mesh | null = null;
  private sparkPoints: THREE.Points | null = null;

  // Interactive hit meshes & piece tracking for smooth animations
  private hitTargets: THREE.Object3D[] = [];
  private boardPieceMap = new Map<number, { owner: Player; mesh: THREE.Group }>();
  private activeAnims: ActivePieceAnim[] = [];
  private prevBoardSnapshot: CellValue[] = [];
  private prevVariant: GameVariant | null = null;
  private prevPieceStyle: PieceStyle | null = null;
  private hoveredIndex: number | null = null;

  // Camera preset damping state
  private cameraAnimating = false;

  // Pointer drag vs click tracking
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastHoverCheck = 0;

  // Loop & resize management
  private frameId = 0;
  private lastTimeMs = 0;
  private elapsedSeconds = 0;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  constructor() {
    // 1. Rebuild 3D Environment Diorama when environment or colorMode changes
    effect(() => {
      const env = this.environment();
      const mode = this.colorMode();
      if (!this.ready) return;
      this.rebuildEnvironment(env, mode);
    });

    // 2. Rebuild 3D Board + Carved Side Dishes when variant, boardTheme, colorMode, or showSideDishes changes
    effect(() => {
      const v = this.variant();
      const theme = this.boardTheme();
      const mode = this.colorMode();
      const dishes = this.showSideDishes();
      if (!this.ready) return;
      this.rebuildBoardAndDishes(v, theme, mode, dishes);
      this.syncPiecesFromState(true);
      this.rebuildOverlays();
    });

    // 3. Sync 3D Pieces on board & in side dishes whenever board/morris/style/counts change
    effect(() => {
      this.variant();
      this.threeBoard();
      this.morrisState();
      this.pieceStyle();
      this.xInHand();
      this.oInHand();
      this.xOutCount();
      this.oOutCount();
      this.showSideDishes();
      if (!this.ready) return;
      const styleChanged = this.prevPieceStyle !== this.pieceStyle();
      const variantChanged = this.prevVariant !== this.variant();
      this.syncPiecesFromState(styleChanged || variantChanged);
      this.syncSideDishPieces();
    });

    // 4. Sync 3D Overlays (valid moves, removable targets, hints, winning golden beam, sparks)
    effect(() => {
      this.variant();
      this.threeBoard();
      this.threeWin();
      this.threeHintIndex();
      this.expiringIndex();
      this.morrisState();
      this.morrisHint();
      this.disabled();
      if (!this.ready) return;
      this.rebuildOverlays();
    });

    // 5. Smoothly transition camera when user selects a preset
    effect(() => {
      const preset = this.cameraPreset();
      if (!this.ready) return;
      this.applyCameraPreset(preset);
    });

    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.initThreeScene();
  }

  private initThreeScene(): void {
    const container = this.canvasHost().nativeElement;
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    this.isSoftwareGl = detectSoftwareGl();

    const renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !this.isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    this.renderer = renderer;
    this.maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    this.scene = scene;

    // Mandatory studio environment reflection (RoomEnvironment) for realistic brass, ruby & turquoise
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMapTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this.envMapTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.2, 85);
    camera.position.set(0, 7.8, 6.7);
    this.camera = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !this.isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 5.4;
    controls.maxDistance = 15.5;
    controls.minPolarAngle = 0.14;
    controls.maxPolarAngle = Math.PI / 2.28;
    controls.target.set(0, 0.08, -0.15);
    controls.addEventListener('start', () => {
      this.cameraAnimating = false;
    });
    controls.update();
    this.controls = controls;

    // Balanced 3-point warm/cool tabletop lighting rig
    const hemiLight = new THREE.HemisphereLight(0xfff4e0, 0x3b2416, 0.85);
    scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const keyLight = new THREE.DirectionalLight(0xffe6bd, 2.3);
    keyLight.position.set(7.5, 11.5, 5.5);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 30;
    const d = 8.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.025;
    scene.add(keyLight);
    this.keyLight = keyLight;

    const fillLight = new THREE.DirectionalLight(0x8ecae6, 0.55);
    fillLight.position.set(-7, 6, -5);
    scene.add(fillLight);
    this.fillLight = fillLight;

    // Hover ring indicator
    const hoverGeo = new THREE.RingGeometry(0.28, 0.39, 32);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const hoverRing = new THREE.Mesh(hoverGeo, hoverMat);
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.position.y = BOARD_TOP_Y + 0.015;
    hoverRing.visible = false;
    scene.add(hoverRing);
    this.hoverRing = hoverRing;

    // Groups for board pieces, side-dish pieces, and gameplay overlays
    this.piecesGroup = new THREE.Group();
    this.trayPiecesGroup = new THREE.Group();
    this.overlayGroup = new THREE.Group();
    scene.add(this.piecesGroup, this.trayPiecesGroup, this.overlayGroup);

    // Raycaster strictly on Layer 1 for crisp zero-overhead picking
    _raycaster.layers.set(1);

    // Initial full build
    this.ready = true;
    this.rebuildEnvironment(this.environment(), this.colorMode());
    this.rebuildBoardAndDishes(
      this.variant(),
      this.boardTheme(),
      this.colorMode(),
      this.showSideDishes(),
    );
    this.syncPiecesFromState(true);
    this.syncSideDishPieces();
    this.rebuildOverlays();
    this.applyCameraPreset(this.cameraPreset(), true);

    if (!this.isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Bind pointer events for click picking vs orbit dragging
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerleave', this.onPointerLeave);

    // Observe container resizes (including Fullscreen enter/exit!)
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Start frame loop (GPU rAF vs software WebGL afterDraw pacing)
    this.lastTimeMs = performance.now();
    this.tick();
  }

  private rebuildEnvironment(env: EnvironmentTheme, colorMode: ColorMode): void {
    const scene = this.scene;
    if (!scene) return;

    if (this.envGroup) {
      scene.remove(this.envGroup);
      disposeObject3D(this.envGroup);
      this.envGroup = null;
      this.envHandles = null;
    }

    const built = buildEnvironmentDiorama(env, colorMode, this.maxAnisotropy, this.isSoftwareGl);
    this.envGroup = built.group;
    this.envHandles = built.handles;
    scene.add(built.group);

    scene.background = new THREE.Color(built.bgColor);
    scene.fog = new THREE.Fog(built.fogColor, built.fogNear, built.fogFar);

    if (this.keyLight) {
      this.keyLight.color.setHex(built.keyLightColor);
      this.keyLight.intensity = built.keyLightIntensity;
      this.keyLight.position.set(...built.keyLightPos);
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(built.hemiSkyColor);
      this.hemiLight.groundColor.setHex(built.hemiGroundColor);
      this.hemiLight.intensity = built.hemiIntensity;
    }
  }

  private rebuildBoardAndDishes(
    variant: GameVariant,
    theme: BoardTheme,
    colorMode: ColorMode,
    showDishes: boolean,
  ): void {
    const scene = this.scene;
    if (!scene) return;

    if (this.boardGroup) {
      scene.remove(this.boardGroup);
      disposeObject3D(this.boardGroup);
      this.boardGroup = null;
    }
    if (this.sideDishesGroup) {
      scene.remove(this.sideDishesGroup);
      disposeObject3D(this.sideDishesGroup);
      this.sideDishesGroup = null;
    }

    this.hitTargets = [];
    const boardGroup = new THREE.Group();
    const { deckMat, frameMat, trackColor } = createBoardDeckMaterial(
      theme,
      colorMode,
      this.maxAnisotropy,
    );

    // Heavy beveled outer frame base (5.7 x 0.22 x 5.7)
    const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(5.72, 0.22, 5.72), frameMat);
    outerFrame.position.y = 0.11;
    outerFrame.castShadow = true;
    outerFrame.receiveShadow = true;
    boardGroup.add(outerFrame);

    // Raised perimeter wooden/brass rim rails (4 borders)
    const railLongGeo = new THREE.BoxGeometry(5.72, 0.08, 0.24);
    const railSideGeo = new THREE.BoxGeometry(0.24, 0.08, 5.24);
    const topRail = new THREE.Mesh(railLongGeo, frameMat);
    topRail.position.set(0, 0.24, -2.74);
    topRail.castShadow = true;
    const botRail = new THREE.Mesh(railLongGeo, frameMat);
    botRail.position.set(0, 0.24, 2.74);
    botRail.castShadow = true;
    const leftRail = new THREE.Mesh(railSideGeo, frameMat);
    leftRail.position.set(-2.74, 0.24, 0);
    leftRail.castShadow = true;
    const rightRail = new THREE.Mesh(railSideGeo, frameMat);
    rightRail.position.set(2.74, 0.24, 0);
    rightRail.castShadow = true;
    boardGroup.add(topRail, botRail, leftRail, rightRail);

    // Decorative antique brass corner rivets
    const brassCornerMat = new THREE.MeshStandardMaterial({
      color: 0xd9a853,
      roughness: 0.22,
      metalness: 0.9,
    });
    const rivetGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.03, 14);
    for (const sx of [-2.72, 2.72]) {
      for (const sz of [-2.72, 2.72]) {
        const rivet = new THREE.Mesh(rivetGeo, brassCornerMat);
        rivet.position.set(sx, 0.285, sz);
        boardGroup.add(rivet);
      }
    }

    // Inner recessed playing deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.24, 0.05, 5.24), deckMat);
    deck.position.y = 0.215;
    deck.receiveShadow = true;
    boardGroup.add(deck);

    const trackMat = new THREE.MeshStandardMaterial({
      color: trackColor,
      roughness: 0.3,
      metalness: 0.65,
    });
    const socketMat = new THREE.MeshStandardMaterial({
      color: theme === 'navy' && colorMode === 'light' ? 0xdbe3ec : 0x161210,
      roughness: 0.72,
      metalness: 0.12,
    });

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    if (variant === 'THREE') {
      // 3x3 carved grid divider rails
      const vBarGeo = new THREE.BoxGeometry(0.085, 0.045, 4.72);
      const hBarGeo = new THREE.BoxGeometry(4.72, 0.045, 0.085);
      for (const offset of [-0.775, 0.775]) {
        const vb = new THREE.Mesh(vBarGeo, trackMat);
        vb.position.set(offset, BOARD_TOP_Y + 0.01, 0);
        vb.castShadow = true;
        const hb = new THREE.Mesh(hBarGeo, trackMat);
        hb.position.set(0, BOARD_TOP_Y + 0.01, offset);
        hb.castShadow = true;
        boardGroup.add(vb, hb);
      }

      // 9 recessed cell plates + invisible layer-1 hit planes
      const cellPlateGeo = new THREE.BoxGeometry(1.36, 0.018, 1.36);
      const hitGeo = new THREE.BoxGeometry(1.44, 0.16, 1.44);
      for (let i = 0; i < 9; i++) {
        const [cx, cz] = THREE_CELL_COORDS[i];
        const plate = new THREE.Mesh(cellPlateGeo, socketMat);
        plate.position.set(cx, BOARD_TOP_Y - 0.005, cz);
        plate.receiveShadow = true;
        boardGroup.add(plate);

        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.set(cx, BOARD_TOP_Y + 0.08, cz);
        hit.layers.set(1);
        hit.userData = { index: i };
        boardGroup.add(hit);
        this.hitTargets.push(hit);
      }
    } else {
      // 9-piece & 12-piece Morris 3D inlaid tracks & 24 brass-rimmed sockets
      const edges = getMorrisEdges(variant);
      for (const edge of edges) {
        const [x1, z1] = morrisNodeToWorld(edge.from);
        const [x2, z2] = morrisNodeToWorld(edge.to);
        const dx = x2 - x1;
        const dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.028, edge.diagonal ? 0.052 : 0.065),
          trackMat,
        );
        bar.position.set((x1 + x2) / 2, BOARD_TOP_Y + 0.004, (z1 + z2) / 2);
        bar.rotation.y = -Math.atan2(dz, dx);
        bar.receiveShadow = true;
        boardGroup.add(bar);
      }

      const ringGeo = new THREE.TorusGeometry(0.16, 0.025, 10, 24);
      const wellGeo = new THREE.CylinderGeometry(0.145, 0.145, 0.02, 20);
      const hitGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16);

      for (let i = 0; i < 24; i++) {
        const [nx, nz] = morrisNodeToWorld(i);
        const rim = new THREE.Mesh(ringGeo, trackMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(nx, BOARD_TOP_Y + 0.012, nz);
        boardGroup.add(rim);

        const well = new THREE.Mesh(wellGeo, socketMat);
        well.position.set(nx, BOARD_TOP_Y + 0.002, nz);
        well.receiveShadow = true;
        boardGroup.add(well);

        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.set(nx, BOARD_TOP_Y + 0.12, nz);
        hit.layers.set(1);
        hit.userData = { index: i };
        boardGroup.add(hit);
        this.hitTargets.push(hit);
      }
    }

    this.boardGroup = boardGroup;
    scene.add(boardGroup);

    // Physical carved side dishes for Reserve + Knocked-Out pieces
    const dishesGroup = new THREE.Group();
    if (showDishes) {
      const rightDish = createSideDishModel(theme, colorMode, this.maxAnisotropy);
      rightDish.position.set(DISH_X_RIGHT, 0, 0);
      const leftDish = createSideDishModel(theme, colorMode, this.maxAnisotropy);
      leftDish.position.set(DISH_X_LEFT, 0, 0);
      dishesGroup.add(rightDish, leftDish);
    }
    this.sideDishesGroup = dishesGroup;
    scene.add(dishesGroup);
  }

  private getSlotWorldPos(variant: GameVariant, index: number): THREE.Vector3 {
    if (variant === 'THREE') {
      const [x, z] = THREE_CELL_COORDS[index] ?? [0, 0];
      return new THREE.Vector3(x, BOARD_TOP_Y, z);
    }
    const [x, z] = morrisNodeToWorld(index);
    return new THREE.Vector3(x, BOARD_TOP_Y, z);
  }

  private syncPiecesFromState(forceRebuild: boolean): void {
    const group = this.piecesGroup;
    if (!group) return;

    const variant = this.variant();
    const style = this.pieceStyle();
    const currentCells: readonly CellValue[] =
      variant === 'THREE' ? this.threeBoard() : this.morrisState().board;
    const pieceScale = variant === 'THREE' ? 1.48 : 0.92;

    if (forceRebuild || this.prevBoardSnapshot.length !== currentCells.length) {
      // Clear existing board pieces and rebuild cleanly
      for (const entry of this.boardPieceMap.values()) {
        group.remove(entry.mesh);
        disposeObject3D(entry.mesh);
      }
      this.boardPieceMap.clear();

      // Clear any pending animations
      for (const anim of this.activeAnims) {
        if (anim.removeOnFinish) {
          group.remove(anim.mesh);
          disposeObject3D(anim.mesh);
        }
      }
      this.activeAnims = [];

      for (let i = 0; i < currentCells.length; i++) {
        const owner = currentCells[i];
        if (!owner) continue;
        const mesh = createPieceModel(owner, style, pieceScale);
        mesh.position.copy(this.getSlotWorldPos(variant, i));
        group.add(mesh);
        this.boardPieceMap.set(i, { owner, mesh });
      }

      this.prevBoardSnapshot = [...currentCells];
      this.prevVariant = variant;
      this.prevPieceStyle = style;
      return;
    }

    // Diff previous board vs current board for smooth real-world physical animations!
    const addedByOwner: Record<Player, number[]> = { X: [], O: [] };
    const removedByOwner: Record<Player, number[]> = { X: [], O: [] };

    for (let i = 0; i < currentCells.length; i++) {
      const prev = this.prevBoardSnapshot[i];
      const curr = currentCells[i];
      if (prev === curr) continue;
      if (prev) removedByOwner[prev].push(i);
      if (curr) addedByOwner[curr].push(i);
    }

    for (const player of ['X', 'O'] as const) {
      const removed = removedByOwner[player];
      const added = addedByOwner[player];

      // 1. Pair 1-to-1 same-player move (Morris glide arc from old node to new node!)
      while (removed.length > 0 && added.length > 0) {
        const fromIdx = removed.shift()!;
        const toIdx = added.shift()!;
        const existing = this.boardPieceMap.get(fromIdx);
        this.boardPieceMap.delete(fromIdx);

        const toPos = this.getSlotWorldPos(variant, toIdx);
        if (existing) {
          const fromPos = existing.mesh.position.clone();
          this.boardPieceMap.set(toIdx, existing);
          this.activeAnims.push({
            mesh: existing.mesh,
            from: fromPos,
            to: toPos,
            elapsed: 0,
            duration: 0.36,
            arcHeight: 0.95,
          });
        } else {
          const mesh = createPieceModel(player, style, pieceScale);
          const fromPos = this.getSlotWorldPos(variant, fromIdx);
          mesh.position.copy(fromPos);
          group.add(mesh);
          this.boardPieceMap.set(toIdx, { owner: player, mesh });
          this.activeAnims.push({
            mesh,
            from: fromPos,
            to: toPos,
            elapsed: 0,
            duration: 0.36,
            arcHeight: 0.95,
          });
        }
      }

      // 2. Remaining added pieces -> arc smoothly from the player's side reserve dish onto the board!
      for (const toIdx of added) {
        const toPos = this.getSlotWorldPos(variant, toIdx);
        const startSlotIdx = Math.max(0, player === 'X' ? this.xInHand() : this.oInHand());
        const fromPos = this.showSideDishes()
          ? getDishSlotPosition(player, 'reserve', startSlotIdx)
          : new THREE.Vector3(
              player === 'X' ? 3.2 : -3.2,
              BOARD_TOP_Y + 1.1,
              toPos.z,
            );
        const mesh = createPieceModel(player, style, pieceScale);
        mesh.position.copy(fromPos);
        group.add(mesh);
        this.boardPieceMap.set(toIdx, { owner: player, mesh });
        this.activeAnims.push({
          mesh,
          from: fromPos,
          to: toPos,
          elapsed: 0,
          duration: 0.38,
          arcHeight: 1.25,
        });
      }

      // 3. Remaining removed pieces -> dramatically arc off the board into the physical side graveyard dish!
      for (const fromIdx of removed) {
        const existing = this.boardPieceMap.get(fromIdx);
        this.boardPieceMap.delete(fromIdx);
        if (!existing) continue;

        const outIdx = Math.max(0, (player === 'X' ? this.xOutCount() : this.oOutCount()) - 1);
        const toPos = this.showSideDishes()
          ? getDishSlotPosition(player, 'captured', outIdx)
          : new THREE.Vector3(player === 'X' ? 3.9 : -3.9, 0.2, 1.2);
        this.activeAnims.push({
          mesh: existing.mesh,
          from: existing.mesh.position.clone(),
          to: toPos,
          elapsed: 0,
          duration: 0.44,
          arcHeight: 1.55,
          removeOnFinish: true,
        });
      }
    }

    this.prevBoardSnapshot = [...currentCells];
    this.prevVariant = variant;
    this.prevPieceStyle = style;
  }

  private syncSideDishPieces(): void {
    const group = this.trayPiecesGroup;
    if (!group) return;

    // Clear and populate crisp physical 3D miniature pieces in both side dishes
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      disposeObject3D(child);
    }

    if (!this.showSideDishes()) return;

    const style = this.pieceStyle();
    const showReserve = this.variant() !== 'THREE';
    const dishPieceScale = 0.66;

    const populate = (player: Player, reserveCount: number, outCount: number) => {
      if (showReserve) {
        const cappedReserve = Math.min(12, Math.max(0, reserveCount));
        for (let i = 0; i < cappedReserve; i++) {
          const piece = createPieceModel(player, style, dishPieceScale);
          piece.position.copy(getDishSlotPosition(player, 'reserve', i));
          group.add(piece);
        }
      }
      const cappedOut = Math.min(18, Math.max(0, outCount));
      for (let i = 0; i < cappedOut; i++) {
        const piece = createPieceModel(player, style, dishPieceScale);
        piece.position.copy(getDishSlotPosition(player, 'captured', i));
        // Subtle organic resting rotation for knocked-out pieces
        piece.rotation.y = (i * 1.17) % (Math.PI * 2);
        group.add(piece);
      }
    };

    populate('X', this.xInHand(), this.xOutCount());
    populate('O', this.oInHand(), this.oOutCount());
  }

  private rebuildOverlays(): void {
    const group = this.overlayGroup;
    if (!group) return;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      disposeObject3D(child);
    }
    this.sparkPoints = null;

    const variant = this.variant();
    const isDisabled = this.disabled();

    const addRing = (
      x: number,
      z: number,
      innerR: number,
      outerR: number,
      color: number,
      opacity = 0.9,
      yOffset = 0.018,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(innerR, outerR, 32),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, BOARD_TOP_Y + yOffset, z);
      group.add(mesh);
    };

    const addBeam = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      color: number,
      radius = 0.065,
      yPos = BOARD_TOP_Y + 0.44,
    ) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, len, 14),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.75,
          roughness: 0.2,
          metalness: 0.4,
        }),
      );
      beam.position.set((x1 + x2) / 2, yPos, (z1 + z2) / 2);
      beam.rotation.z = Math.PI / 2;
      beam.rotation.y = -Math.atan2(dz, dx);
      group.add(beam);
    };

    if (variant === 'THREE') {
      const win = this.threeWin();
      if (win) {
        const [x1, z1] = THREE_CELL_COORDS[win.cells[0]];
        const [x2, z2] = THREE_CELL_COORDS[win.cells[2]];
        addBeam(x1, z1, x2, z2, 0xfbbf24, 0.085, BOARD_TOP_Y + 0.62);
        for (const c of win.cells) {
          const [cx, cz] = THREE_CELL_COORDS[c];
          addRing(cx, cz, 0.54, 0.66, 0xfbbf24, 0.95);
        }
        this.addVictorySparks(group);
      } else {
        const exp = this.expiringIndex();
        if (exp !== null) {
          const [ex, ez] = THREE_CELL_COORDS[exp];
          addRing(ex, ez, 0.52, 0.64, 0xf59e0b, 0.8);
        }
        const hint = this.threeHintIndex();
        if (!isDisabled && hint !== null && this.threeBoard()[hint] === null) {
          const [hx, hz] = THREE_CELL_COORDS[hint];
          addRing(hx, hz, 0.36, 0.54, 0x38bdf8, 0.92);
        }
      }
      return;
    }

    // 9-piece & 12-piece Morris overlays
    const state = this.morrisState();
    if (state.lastMill) {
      const [x1, z1] = morrisNodeToWorld(state.lastMill[0]);
      const [x2, z2] = morrisNodeToWorld(state.lastMill[2]);
      addBeam(x1, z1, x2, z2, 0xfbbf24, 0.06, BOARD_TOP_Y + 0.42);
      for (const nodeIdx of state.lastMill) {
        const [mx, mz] = morrisNodeToWorld(nodeIdx);
        addRing(mx, mz, 0.34, 0.43, 0xfbbf24, 0.92);
      }
    }

    if (state.winner) {
      this.addVictorySparks(group);
      return;
    }

    if (isDisabled || state.isDraw) return;

    if (state.action === 'REMOVE') {
      const opponent: Player = state.currentTurn === 'X' ? 'O' : 'X';
      const removable = getRemovableOpponentNodes(state.board, opponent, state.variant);
      for (const nodeIdx of removable) {
        const [rx, rz] = morrisNodeToWorld(nodeIdx);
        addRing(rx, rz, 0.33, 0.44, 0xf59e0b, 0.95);
      }
    } else if (state.action === 'MOVE') {
      if (state.selectedNode !== null) {
        const [sx, sz] = morrisNodeToWorld(state.selectedNode);
        addRing(sx, sz, 0.35, 0.46, 0xfbbf24, 0.95);
        const dests = getValidDestinationsForNode(state, state.selectedNode);
        for (const dIdx of dests) {
          const [dx, dz] = morrisNodeToWorld(dIdx);
          addRing(dx, dz, 0.16, 0.32, 0x10b981, 0.95, 0.022);
          addBeam(sx, sz, dx, dz, 0x14b8a6, 0.026, BOARD_TOP_Y + 0.06);
        }
      } else {
        // Soft highlight around movable pieces of current player
        for (let i = 0; i < 24; i++) {
          if (state.board[i] === state.currentTurn && getValidDestinationsForNode(state, i).length > 0) {
            const [mx, mz] = morrisNodeToWorld(i);
            addRing(mx, mz, 0.33, 0.4, state.currentTurn === 'X' ? 0xfda4af : 0x5eead4, 0.72);
          }
        }
      }
    }

    // Smart Hint overlay for Morris
    const hint = this.morrisHint();
    if (hint) {
      if (hint.type === 'PLACE') {
        const [hx, hz] = morrisNodeToWorld(hint.to);
        addRing(hx, hz, 0.2, 0.36, 0x38bdf8, 0.95, 0.026);
      } else if (hint.type === 'REMOVE') {
        const [hx, hz] = morrisNodeToWorld(hint.target);
        addRing(hx, hz, 0.35, 0.48, 0x38bdf8, 0.95, 0.026);
      } else if (hint.type === 'MOVE') {
        const [x1, z1] = morrisNodeToWorld(hint.from);
        const [x2, z2] = morrisNodeToWorld(hint.to);
        addRing(x1, z1, 0.35, 0.46, 0x38bdf8, 0.95, 0.026);
        addRing(x2, z2, 0.2, 0.36, 0x38bdf8, 0.95, 0.026);
        addBeam(x1, z1, x2, z2, 0x38bdf8, 0.04, BOARD_TOP_Y + 0.28);
      }
    }
  }

  private addVictorySparks(group: THREE.Group): void {
    const count = 48;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 0.6 + ((i * 37) % 240) / 100;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = 0.4 + ((i * 53) % 260) / 100;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xfde047,
        size: 0.16,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    group.add(sparks);
    this.sparkPoints = sparks;
  }

  private applyCameraPreset(preset: CameraPreset, instant = false): void {
    if (!this.camera || !this.controls) return;

    if (preset === 'TOP') {
      _targetCamPos.set(0, 10.6, 1.35);
      _targetCtrlPos.set(0, 0.05, 0);
    } else if (preset === 'CINEMA') {
      _targetCamPos.set(4.5, 5.1, 6.5);
      _targetCtrlPos.set(-0.2, 0.18, -0.35);
    } else {
      _targetCamPos.set(0, 7.6, 6.7);
      _targetCtrlPos.set(0, 0.08, -0.15);
    }

    if (instant || this.isSoftwareGl) {
      this.camera.position.copy(_targetCamPos);
      this.controls.target.copy(_targetCtrlPos);
      this.controls.update();
      this.cameraAnimating = false;
    } else {
      this.cameraAnimating = true;
    }
  }

  // ---------- POINTER PICKING (LAYER 1) ----------

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.disabled()) return;
    const dist = Math.hypot(event.clientX - this.pointerDownX, event.clientY - this.pointerDownY);
    if (dist > 7) return; // User was orbiting the camera, not clicking a board spot

    const hitIndex = this.pickSlotIndex(event);
    if (hitIndex === null) return;

    if (this.variant() === 'THREE') {
      this.threeCellSelected.emit(hitIndex);
    } else {
      this.morrisNodeSelected.emit(hitIndex);
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverCheck < 35) return;
    this.lastHoverCheck = now;

    if (this.disabled() || !this.hoverRing || !this.renderer) {
      if (this.hoverRing) this.hoverRing.visible = false;
      return;
    }

    const hitIndex = this.pickSlotIndex(event);
    this.hoveredIndex = hitIndex;

    if (hitIndex !== null && this.isSlotInteractive(hitIndex)) {
      const pos = this.getSlotWorldPos(this.variant(), hitIndex);
      this.hoverRing.position.set(pos.x, BOARD_TOP_Y + 0.02, pos.z);
      const s = this.variant() === 'THREE' ? 1.45 : 0.95;
      this.hoverRing.scale.setScalar(s);
      this.hoverRing.visible = true;
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.hoverRing.visible = false;
      this.renderer.domElement.style.cursor = 'grab';
    }
  };

  private readonly onPointerLeave = (): void => {
    this.hoveredIndex = null;
    if (this.hoverRing) this.hoverRing.visible = false;
  };

  private pickSlotIndex(event: PointerEvent): number | null {
    if (!this.renderer || !this.camera || this.hitTargets.length === 0) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    _ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_ndc, this.camera);
    const hits = _raycaster.intersectObjects(this.hitTargets, false);
    if (hits.length === 0) return null;

    const idx = hits[0].object.userData['index'];
    return typeof idx === 'number' ? idx : null;
  }

  private isSlotInteractive(index: number): boolean {
    if (this.disabled()) return false;
    if (this.variant() === 'THREE') {
      return this.threeBoard()[index] === null;
    }
    const s = this.morrisState();
    if (s.winner || s.isDraw) return false;
    if (s.action === 'PLACE') return s.board[index] === null;
    if (s.action === 'REMOVE') {
      const opp: Player = s.currentTurn === 'X' ? 'O' : 'X';
      return getRemovableOpponentNodes(s.board, opp, s.variant).includes(index);
    }
    if (s.board[index] === s.currentTurn) {
      return getValidDestinationsForNode(s, index).length > 0;
    }
    if (s.board[index] === null && s.selectedNode !== null) {
      return getValidDestinationsForNode(s, s.selectedNode).includes(index);
    }
    return false;
  }

  // ---------- ANIMATION LOOP & SOFTWARE WEBGL PACING ----------

  private readonly tick = (): void => {
    if (this.destroyed || !this.renderer || !this.scene || !this.camera || !this.controls) {
      return;
    }

    const now = performance.now();
    const delta = Math.min(0.05, Math.max(0.001, (now - this.lastTimeMs) / 1000));
    this.lastTimeMs = now;
    this.elapsedSeconds += delta;

    // 1. Smooth damped camera preset transitions
    if (this.cameraAnimating) {
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        _targetCamPos.x,
        5.5,
        delta,
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        _targetCamPos.y,
        5.5,
        delta,
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        _targetCamPos.z,
        5.5,
        delta,
      );
      this.controls.target.x = THREE.MathUtils.damp(
        this.controls.target.x,
        _targetCtrlPos.x,
        5.5,
        delta,
      );
      this.controls.target.y = THREE.MathUtils.damp(
        this.controls.target.y,
        _targetCtrlPos.y,
        5.5,
        delta,
      );
      this.controls.target.z = THREE.MathUtils.damp(
        this.controls.target.z,
        _targetCtrlPos.z,
        5.5,
        delta,
      );

      if (
        this.camera.position.distanceToSquared(_targetCamPos) < 0.002 &&
        this.controls.target.distanceToSquared(_targetCtrlPos) < 0.002
      ) {
        this.cameraAnimating = false;
      }
    }

    this.controls.update();

    // 2. Physical parabolic arc animations for placed, moved, and knocked-out pieces
    for (let i = this.activeAnims.length - 1; i >= 0; i--) {
      const anim = this.activeAnims[i];
      anim.elapsed += delta;
      const rawT = Math.min(1, anim.elapsed / anim.duration);
      const easeT = 1 - Math.pow(1 - rawT, 3);

      _tmpPos.lerpVectors(anim.from, anim.to, easeT);
      _tmpPos.y += Math.sin(rawT * Math.PI) * anim.arcHeight;
      anim.mesh.position.copy(_tmpPos);

      // Subtle tactile tilt while mid-flight
      anim.mesh.rotation.x = Math.sin(rawT * Math.PI) * 0.16;

      if (rawT >= 1) {
        anim.mesh.position.copy(anim.to);
        anim.mesh.rotation.x = 0;
        if (anim.removeOnFinish && this.piecesGroup) {
          this.piecesGroup.remove(anim.mesh);
          disposeObject3D(anim.mesh);
        }
        this.activeAnims.splice(i, 1);
      }
    }

    // 3. Gently lift the currently selected Morris piece as if held in hand
    if (this.variant() !== 'THREE') {
      const selected = this.morrisState().selectedNode;
      for (const [nodeId, entry] of this.boardPieceMap.entries()) {
        const isAnimating = this.activeAnims.some((a) => a.mesh === entry.mesh);
        if (isAnimating) continue;
        const targetY =
          selected === nodeId
            ? BOARD_TOP_Y + 0.34 + Math.sin(this.elapsedSeconds * 4.5) * 0.04
            : BOARD_TOP_Y;
        entry.mesh.position.y = THREE.MathUtils.damp(entry.mesh.position.y, targetY, 12, delta);
      }
    }

    // 4. Living nostalgic environment micro-animations (steam, water, candle flicker, pollen)
    const envH = this.envHandles;
    if (envH) {
      if (envH.steamParticles) {
        const posAttr = envH.steamParticles.geometry.getAttribute(
          'position',
        ) as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          let y = posAttr.getY(i) + delta * 0.38;
          if (y > 2.85) y -= 1.45;
          posAttr.setY(i, y);
        }
        posAttr.needsUpdate = true;
      }

      if (envH.waterTexture) {
        envH.waterTexture.offset.y = (this.elapsedSeconds * 0.55) % 1;
      }

      if (envH.candleFlame && envH.candleLight) {
        const flicker =
          1 +
          Math.sin(this.elapsedSeconds * 11.3) * 0.08 +
          Math.sin(this.elapsedSeconds * 19.7) * 0.05;
        envH.candleFlame.scale.set(1, flicker, 1);
        envH.candleLight.intensity = 3.0 * flicker;
      }

      if (envH.pollenParticles) {
        envH.pollenParticles.rotation.y = this.elapsedSeconds * 0.04;
      }
    }

    // 5. Celebratory rising golden victory sparks
    if (this.sparkPoints) {
      const posAttr = this.sparkPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) + delta * 0.95;
        if (y > 3.2) y = 0.3;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
      this.sparkPoints.rotation.y = this.elapsedSeconds * 0.5;
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    if (!this.renderer || this.destroyed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.destroyed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;
    const container = this.canvasHost().nativeElement;
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private cleanup(): void {
    this.destroyed = true;
    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
      window.clearTimeout(this.frameId);
      this.frameId = 0;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.renderer) {
      const dom = this.renderer.domElement;
      dom.removeEventListener('pointerdown', this.onPointerDown);
      dom.removeEventListener('pointerup', this.onPointerUp);
      dom.removeEventListener('pointermove', this.onPointerMove);
      dom.removeEventListener('pointerleave', this.onPointerLeave);
    }

    this.controls?.dispose();
    this.controls = null;

    if (this.scene) {
      disposeObject3D(this.scene);
    }
    this.envMapTex?.dispose();
    this.envMapTex = null;

    this.renderer?.dispose();
    if (this.renderer?.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}
