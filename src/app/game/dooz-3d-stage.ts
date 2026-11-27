import { TranslatePipe } from '../i18n';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { resolveBoardColorTokens } from './color-palette';
import {
  BoardTheme,
  CellValue,
  ColorMode,
  ENVIRONMENT_THEMES,
  EnvironmentTheme,
  GameVariant,
  PieceStyle,
  Player,
  WinResult,
} from './dooz.types';
import { DoozBoard } from './dooz-board';
import { MorrisBoard } from './morris-board';
import { MorrisAiDecision } from './morris-engine';
import { MorrisState } from './morris.types';
import { PieceTray } from './piece-tray';

export type CameraPreset = 'TABLE' | 'TOP' | 'CINEMA';

interface StageEnvironmentConfig {
  /** Base tilt angle (degrees) matching the perspective of the photo's surface */
  pitchDeg: number;
  /** Slight yaw/roll to match natural table angle */
  rollDeg: number;
  /** Horizontal offset (%) to align the board on the open surface */
  offsetX: number;
  /** Vertical offset (%) to place the board directly on the carpet/table/stone */
  offsetY: number;
  /** Scale factor in TABLE view so surrounding props (samovar, candle, waterfall) remain visible */
  tableScale: number;
  /** CSS radial/linear lighting tint overlay matching the scene ambiance */
  lightTint: string;
  /** Soft contact shadow color */
  shadowTint: string;
}

const STAGE_ENV_CONFIG: Record<EnvironmentTheme, StageEnvironmentConfig> = {
  courtyard:{pitchDeg:30,rollDeg:0,offsetX:0,offsetY:4,tableScale:.82,lightTint:'radial-gradient(circle at 50% 35%,#b4ece320,transparent 65%)',shadowTint:'rgba(8,40,44,.65)'},
  khatam:{pitchDeg:32,rollDeg:0,offsetX:0,offsetY:5,tableScale:.8,lightTint:'radial-gradient(circle at 50% 35%,#ffe4b520,transparent 65%)',shadowTint:'rgba(40,22,8,.7)'},
  carpet: {
    pitchDeg: 36,
    rollDeg: 0,
    offsetX: 0,
    offsetY: 8,
    tableScale: 0.78,
    lightTint:
      'radial-gradient(circle at 75% 20%, rgba(255, 224, 150, 0.22), transparent 55%), linear-gradient(180deg, rgba(20, 10, 6, 0.14) 0%, rgba(0, 0, 0, 0) 45%, rgba(16, 8, 6, 0.28) 100%)',
    shadowTint: 'rgba(18, 6, 6, 0.72)',
  },
  lounge: {
    pitchDeg: 39,
    rollDeg: -2,
    offsetX: 3,
    offsetY: 14,
    tableScale: 0.72,
    lightTint:
      'radial-gradient(circle at 80% 55%, rgba(255, 190, 105, 0.24), transparent 50%), radial-gradient(circle at 38% 22%, rgba(255, 214, 145, 0.16), transparent 45%), linear-gradient(180deg, rgba(16, 9, 4, 0.2) 0%, rgba(0, 0, 0, 0) 50%, rgba(12, 6, 3, 0.35) 100%)',
    shadowTint: 'rgba(14, 7, 3, 0.78)',
  },
  meadow: {
    pitchDeg: 35,
    rollDeg: 0,
    offsetX: 0,
    offsetY: 12,
    tableScale: 0.75,
    lightTint:
      'radial-gradient(circle at 52% 14%, rgba(254, 249, 195, 0.26), transparent 52%), linear-gradient(180deg, rgba(10, 28, 12, 0.12) 0%, rgba(0, 0, 0, 0) 45%, rgba(8, 22, 10, 0.3) 100%)',
    shadowTint: 'rgba(8, 26, 10, 0.72)',
  },
  waterfall: {
    pitchDeg: 36,
    rollDeg: 1,
    offsetX: -1,
    offsetY: 15,
    tableScale: 0.73,
    lightTint:
      'radial-gradient(circle at 52% 24%, rgba(186, 230, 253, 0.22), transparent 50%), linear-gradient(180deg, rgba(6, 24, 30, 0.16) 0%, rgba(0, 0, 0, 0) 48%, rgba(4, 18, 24, 0.34) 100%)',
    shadowTint: 'rgba(4, 18, 22, 0.78)',
  },
  simple: {
    pitchDeg: 32,
    rollDeg: 0,
    offsetX: 0,
    offsetY: -2,
    tableScale: 0.9,
    lightTint:
      'radial-gradient(circle at 46% 36%, rgba(255, 224, 178, 0.14), transparent 62%)',
    shadowTint: 'rgba(6, 4, 2, 0.72)',
  },
};

/** Perspective tabletop with a layered CSS frame and DOM-based game controls. */
@Component({
  selector: 'app-dooz-3d-stage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DoozBoard, MorrisBoard, PieceTray],
  styleUrl: './dooz-3d-stage.css',
  template: `
    <div
      class="scene relative h-full w-full overflow-hidden select-none"
      [class.studio]="environment() === 'simple'"
      [class.studio-light]="colorMode() === 'light'"
      [class.cursor-grab]="!isDragging()"
      [class.cursor-grabbing]="isDragging()"
      [style.background]="activeEnvOption().fallbackGradient"
      (pointerdown)="onStagePointerDown($event)"
      (pointermove)="onStagePointerMove($event)"
      (pointerup)="onStagePointerUp($event)"
      (pointercancel)="onStagePointerUp($event)"
      (lostpointercapture)="onStagePointerUp($event)"
      role="region"
      [attr.aria-label]="'محیط سه‌بعدی بازی دوز' | t"
    >
      @if (activeEnvOption().imagePath; as imgSrc) {
        <img
          [src]="imgSrc"
          alt=""
          draggable="false"
          referrerpolicy="no-referrer"
          class="scene-backdrop pointer-events-none absolute inset-0 h-full w-full object-cover"
          [class.transition-transform]="!isDragging()"
          [class.duration-500]="!isDragging()"
          [class.ease-out]="!isDragging()"
          [style.transform]="backdropTransform()"
        />
      }

      <div
        class="pointer-events-none absolute inset-0"
        [style.background]="envConfig().lightTint"
      ></div>
      <div class="scene-vignette pointer-events-none absolute inset-0"></div>

      <!-- 3D Perspective Viewport -->
      <div
        class="scene-camera relative flex h-full w-full items-center justify-center px-3 pb-10 pt-3 sm:px-6"
      >
        <div
          class="scene-table relative flex w-full max-w-[660px] flex-col items-center justify-center"
          style="transform-style: preserve-3d;"
          [class.transition-transform]="!isDragging()"
          [class.duration-500]="!isDragging()"
          [class.ease-out]="!isDragging()"
          [style.transform]="tabletopTransform()"
        >
          <div
            class="relative flex w-full items-center justify-center gap-2.5 sm:gap-3.5"
            style="transform-style: preserve-3d;"
            [style.--slab-edge]="slabEdgeColor()"
            [style.--contact-tint]="envConfig().shadowTint"
          >
            <!-- Right Side Tray (Player X) -->
            @if (showSideDishes()) {
              <div
                class="hidden shrink-0 rounded-2xl border-b-[10px] ring-1 ring-white/15 sm:block"
                [style.border-bottom-color]="slabEdgeColor()"
                [style.box-shadow]="slabShadow()"
              >
                <app-piece-tray
                  [player]="'X'"
                  [label]="playerXLabel()"
                  [inHandCount]="xInHand()"
                  [onBoardCount]="xOnBoard()"
                  [outCount]="xOutCount()"
                  [showReserve]="showReserve()"
                  [isActiveTurn]="currentTurn() === 'X'"
                  [theme]="boardTheme()"
                  [pieceStyle]="pieceStyle()"
                  [colorMode]="colorMode()"
                  [customPieceColor]="customXColor()"
                  [customBoardColor]="customBoardColor()"
                  [expanded]="false"
                />
              </div>
            }

            <!-- Main 3D Physical Board Slab -->
            <div
              class="board-slab relative w-full min-w-0 flex-1 rounded-2xl"
              [attr.data-material]="boardTheme()"
            >
              <div class="board-contact" aria-hidden="true"></div>
              <div class="board-edge" aria-hidden="true"></div>
              @if (variant() === 'THREE') {
                <app-dooz-board
                  class="board-surface block w-full"
                  [tabletop]="true"
                  [board]="threeBoard()"
                  [currentTurn]="currentTurn()"
                  [winResult]="threeWin()"
                  [theme]="boardTheme()"
                  [pieceStyle]="pieceStyle()"
                  [colorMode]="colorMode()"
                  [customXColor]="customXColor()"
                  [customOColor]="customOColor()"
                  [customBoardColor]="customBoardColor()"
                  [hintIndex]="threeHintIndex()"
                  [expanded]="false"
                  [disabled]="disabled()"
                  [expiringIndex]="expiringIndex()"
                  [lastMoveIndex]="lastMoveIndex()"
                  [showCellNumbers]="showCellNumbers()"
                  (cellSelected)="threeCellSelected.emit($event)"
                />
              } @else {
                <app-morris-board
                  class="board-surface block w-full"
                  [tabletop]="true"
                  [state]="morrisState()"
                  [theme]="boardTheme()"
                  [pieceStyle]="pieceStyle()"
                  [colorMode]="colorMode()"
                  [customXColor]="customXColor()"
                  [customOColor]="customOColor()"
                  [customBoardColor]="customBoardColor()"
                  [hintDecision]="morrisHint()"
                  [expanded]="false"
                  [disabled]="disabled()"
                  (nodeSelected)="morrisNodeSelected.emit($event)"
                />
              }

            </div>

            <!-- Left Side Tray (Player O) -->
            @if (showSideDishes()) {
              <div
                class="hidden shrink-0 rounded-2xl border-b-[10px] ring-1 ring-white/15 sm:block"
                [style.border-bottom-color]="slabEdgeColor()"
                [style.box-shadow]="slabShadow()"
              >
                <app-piece-tray
                  [player]="'O'"
                  [label]="playerOLabel()"
                  [inHandCount]="oInHand()"
                  [onBoardCount]="oOnBoard()"
                  [outCount]="oOutCount()"
                  [showReserve]="showReserve()"
                  [isActiveTurn]="currentTurn() === 'O'"
                  [theme]="boardTheme()"
                  [pieceStyle]="pieceStyle()"
                  [colorMode]="colorMode()"
                  [customPieceColor]="customOColor()"
                  [customBoardColor]="customBoardColor()"
                  [expanded]="false"
                />
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Subtle Drag Hint & Reset Angle Chip when user orbits -->
      @if (hasCustomOrbit()) {
        <button
          type="button"
          (click)="resetOrbit(); $event.stopPropagation()"
          class="absolute top-3 left-3 z-10 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/20 bg-slate-950/85 px-3 text-xs font-semibold text-slate-100 transition-colors hover:bg-slate-900"
        >
          {{ 'بازنشانی زاویه' | t }}
        </button>
      }
    </div>
  `,
})
export class Dooz3DStage {
  // Core gameplay inputs
  readonly variant = input.required<GameVariant>();
  readonly threeBoard = input.required<readonly CellValue[]>();
  readonly currentTurn = input<Player>('X');
  readonly threeWin = input<WinResult | null>(null);
  readonly threeHintIndex = input<number | null>(null);
  readonly expiringIndex = input<number | null>(null);
  readonly lastMoveIndex = input<number | null>(null);
  readonly showCellNumbers = input<boolean>(true);
  readonly morrisState = input.required<MorrisState>();
  readonly morrisHint = input<MorrisAiDecision | null>(null);
  readonly disabled = input<boolean>(false);

  // Side dish counts
  readonly showSideDishes = input<boolean>(true);
  readonly showReserve = input<boolean>(true);
  readonly playerXLabel = input<string>('بازیکن ۱');
  readonly playerOLabel = input<string>('بازیکن ۲');
  readonly xInHand = input<number>(0);
  readonly oInHand = input<number>(0);
  readonly xOnBoard = input<number>(0);
  readonly oOnBoard = input<number>(0);
  readonly xOutCount = input<number>(0);
  readonly oOutCount = input<number>(0);

  // Visual style & camera preset
  readonly environment = input<EnvironmentTheme>('carpet');
  readonly boardTheme = input<BoardTheme>('walnut');
  readonly pieceStyle = input<PieceStyle>('gemstone');
  readonly colorMode = input<ColorMode>('dark');
  readonly customXColor = input<string | null>(null);
  readonly customOColor = input<string | null>(null);
  readonly customBoardColor = input<string | null>(null);
  readonly cameraPreset = input<CameraPreset>('TABLE');

  // Interaction outputs
  readonly threeCellSelected = output<number>();
  readonly morrisNodeSelected = output<number>();

  // Interactive drag-orbit offsets
  private readonly dragPitchDelta = signal<number>(0);
  private readonly dragRollDelta = signal<number>(0);
  readonly isDragging = signal<boolean>(false);

  private pointerDownX = 0;
  private pointerDownY = 0;
  private startPitch = 0;
  private startRoll = 0;
  private activePointerId: number | null = null;

  constructor() {
    effect(() => {
      this.cameraPreset();
      this.environment();
      this.dragPitchDelta.set(0);
      this.dragRollDelta.set(0);
    });
  }

  readonly activeEnvOption = computed(
    () =>
      ENVIRONMENT_THEMES.find((item) => item.id === this.environment()) ??
      ENVIRONMENT_THEMES[0],
  );

  readonly envConfig = computed<StageEnvironmentConfig>(
    () => STAGE_ENV_CONFIG[this.environment()] ?? STAGE_ENV_CONFIG.simple,
  );

  readonly hasCustomOrbit = computed<boolean>(
    () => Math.abs(this.dragPitchDelta()) > 1 || Math.abs(this.dragRollDelta()) > 1,
  );

  private readonly activePose = computed(() => {
    const cfg = this.envConfig();
    const preset = this.cameraPreset();

    let basePitch = cfg.pitchDeg;
    let baseRoll = cfg.rollDeg;
    let offsetX = cfg.offsetX;
    let offsetY = cfg.offsetY;
    let scale = cfg.tableScale;

    if (preset === 'TOP') {
      basePitch = 0;
      baseRoll = 0;
      offsetX = 0;
      offsetY = 2;
      scale = Math.min(0.98, cfg.tableScale + 0.18);
    } else if (preset === 'CINEMA') {
      basePitch = Math.min(43, cfg.pitchDeg + 8);
      baseRoll = -6;
      scale = Math.min(0.94, cfg.tableScale + 0.07);
    } else {
      basePitch = Math.min(30, basePitch);
      offsetY = Math.min(6, offsetY);
      scale = Math.min(0.96, scale + 0.16);
    }

    const pitch = Math.max(0, Math.min(50, basePitch + this.dragPitchDelta()));
    const roll = Math.max(-28, Math.min(28, baseRoll + this.dragRollDelta()));

    return { pitch, roll, offsetX, offsetY, scale };
  });

  readonly tabletopTransform = computed<string>(() => {
    const { pitch, roll, offsetX, offsetY, scale } = this.activePose();
    return `translate3d(${offsetX}%, ${offsetY}%, 0) scale(${scale}) rotateX(${pitch}deg) rotateZ(${roll}deg)`;
  });

  readonly backdropTransform = computed<string>(() => {
    const roll = this.dragRollDelta();
    const pitch = this.dragPitchDelta();
    const tx = (-roll * 0.18).toFixed(2);
    const ty = (-pitch * 0.15).toFixed(2);
    return `scale(1.10) translate3d(${tx}%, ${ty}%, 0)`;
  });

  readonly slabEdgeColor = computed<string>(
    () =>
      resolveBoardColorTokens(this.boardTheme(), this.colorMode(), this.customBoardColor())
        .slabEdge,
  );

  readonly slabShadow = computed<string>(() => {
    const tint = this.envConfig().shadowTint;
    return `0 22px 38px -8px ${tint}, 0 8px 16px -4px rgba(0, 0, 0, 0.45)`;
  });

  onStagePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !event.isPrimary || this.activePointerId !== null) return;
    if (event.target instanceof Element && event.target.closest('button, [role="button"]')) return;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.activePointerId = event.pointerId;
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
    this.startPitch = this.dragPitchDelta();
    this.startRoll = this.dragRollDelta();
  }

  onStagePointerMove(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) return;
    const dx = event.clientX - this.pointerDownX;
    const dy = event.clientY - this.pointerDownY;
    if (!this.isDragging() && Math.hypot(dx, dy) > 8) {
      this.isDragging.set(true);
    }
    if (!this.isDragging()) return;

    this.dragRollDelta.set(Math.max(-10, Math.min(10, this.startRoll + dx * 0.10)));
    this.dragPitchDelta.set(Math.max(-28, Math.min(18, this.startPitch - dy * 0.14)));
  }

  onStagePointerUp(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) return;
    this.activePointerId = null;
    this.isDragging.set(false);
  }

  resetOrbit(): void {
    this.dragPitchDelta.set(0);
    this.dragRollDelta.set(0);
  }
}
