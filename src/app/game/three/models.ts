import * as THREE from 'three';
import { BoardTheme, ColorMode, EnvironmentTheme, PieceStyle, Player } from '../dooz.types';
import {
  createContactShadowTexture,
  createCourtyardStoneTexture,
  createMeadowGroundTexture,
  createMossySlateTexture,
  createPersianCarpetTextures,
  createWalnutWoodTextures,
  createWaterFlowTexture,
} from './textures';

export interface AnimatedEnvHandles {
  steamParticles: THREE.Points | null;
  waterMesh: THREE.Mesh | null;
  waterfallMesh: THREE.Mesh | null;
  waterTexture: THREE.CanvasTexture | null;
  candleFlame: THREE.Mesh | null;
  candleLight: THREE.PointLight | null;
  grassMesh: THREE.InstancedMesh | null;
  pollenParticles: THREE.Points | null;
}

export interface EnvironmentBuildResult {
  group: THREE.Group;
  bgColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  keyLightColor: number;
  keyLightIntensity: number;
  keyLightPos: [number, number, number];
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  handles: AnimatedEnvHandles;
}

/**
 * Creates a composite 3D game piece (4-7 distinct PBR parts) pivoted flush at y = 0.
 */
export function createPieceModel(
  player: Player,
  pieceStyle: PieceStyle,
  scale = 1,
): THREE.Group {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  // Subtle soft bottom felt pad so piece sits flush on wood/stone
  const padGeo = new THREE.CylinderGeometry(0.32, 0.33, 0.03, 40);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x1e1916,
    roughness: 0.95,
    metalness: 0.0,
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = 0.015;
  group.add(pad);

  if (pieceStyle === 'gemstone') {
    // Turned antique brass pedestal bezel
    const bezelProfile = [
      new THREE.Vector2(0.0, 0.03),
      new THREE.Vector2(0.35, 0.03),
      new THREE.Vector2(0.37, 0.09),
      new THREE.Vector2(0.33, 0.16),
      new THREE.Vector2(0.28, 0.18),
      new THREE.Vector2(0.0, 0.18),
    ];
    const bezelGeo = new THREE.LatheGeometry(bezelProfile, 48);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd9a853,
      roughness: 0.22,
      metalness: 0.9,
    });
    const bezel = new THREE.Mesh(bezelGeo, brassMat);
    bezel.castShadow = true;
    bezel.receiveShadow = true;
    group.add(bezel);

    // Domed polished cabochon gemstone (Ruby for X, Esfahan Turquoise for O)
    const gemProfile = [
      new THREE.Vector2(0.0, 0.15),
      new THREE.Vector2(0.29, 0.15),
      new THREE.Vector2(0.28, 0.23),
      new THREE.Vector2(0.21, 0.31),
      new THREE.Vector2(0.11, 0.36),
      new THREE.Vector2(0.0, 0.37),
    ];
    const gemGeo = new THREE.LatheGeometry(gemProfile, 48);
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: player === 'X' ? 0xd91a46 : 0x0d9488,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      emissive: player === 'X' ? 0x3b0411 : 0x032624,
      emissiveIntensity: 0.35,
    });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    gem.castShadow = true;
    group.add(gem);

    // Top decorative gold crown ring
    const ringGeo = new THREE.TorusGeometry(0.17, 0.022, 12, 28);
    const ring = new THREE.Mesh(ringGeo, brassMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.31;
    group.add(ring);

    // Subtle crest emblem (X bar or O pearl)
    if (player === 'X') {
      const barGeo = new THREE.BoxGeometry(0.17, 0.028, 0.036);
      const b1 = new THREE.Mesh(barGeo, brassMat);
      b1.position.y = 0.365;
      b1.rotation.y = Math.PI / 4;
      const b2 = b1.clone();
      b2.rotation.y = -Math.PI / 4;
      group.add(b1, b2);
    } else {
      const pearlGeo = new THREE.SphereGeometry(0.062, 18, 14);
      const pearlMat = new THREE.MeshPhysicalMaterial({
        color: 0xecfeff,
        roughness: 0.15,
        metalness: 0.1,
        clearcoat: 0.9,
      });
      const pearl = new THREE.Mesh(pearlGeo, pearlMat);
      pearl.position.y = 0.37;
      group.add(pearl);
    }
    return group;
  }

  if (pieceStyle === 'wood') {
    // Hand-turned Khatam walnut (X) vs antique Ivory (O) pawn
    const profile = [
      new THREE.Vector2(0.0, 0.03),
      new THREE.Vector2(0.35, 0.03),
      new THREE.Vector2(0.36, 0.11),
      new THREE.Vector2(0.31, 0.14),
      new THREE.Vector2(0.33, 0.22),
      new THREE.Vector2(0.28, 0.27),
      new THREE.Vector2(0.18, 0.25),
      new THREE.Vector2(0.0, 0.26),
    ];
    const bodyGeo = new THREE.LatheGeometry(profile, 48);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: player === 'X' ? 0x5c2411 : 0xf2e6cc,
      roughness: player === 'X' ? 0.38 : 0.32,
      metalness: 0.05,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Brushed brass inlay collar
    const collarGeo = new THREE.TorusGeometry(0.315, 0.018, 12, 40);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdca74c,
      roughness: 0.2,
      metalness: 0.88,
    });
    const collar = new THREE.Mesh(collarGeo, brassMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.24;
    group.add(collar);

    // Center khatam star (X) or wood-inlaid ring (O)
    if (player === 'X') {
      const starGeo = new THREE.OctahedronGeometry(0.095, 0);
      const star = new THREE.Mesh(starGeo, brassMat);
      star.scale.set(1, 0.35, 1);
      star.position.y = 0.275;
      group.add(star);
    } else {
      const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.022, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0x7c3416, roughness: 0.42, metalness: 0.1 }),
      );
      innerRing.rotation.x = Math.PI / 2;
      innerRing.position.y = 0.265;
      group.add(innerRing);
    }
    return group;
  }

  if (pieceStyle === 'nature') {
    // Organic river stone (Jade O) vs sculpted coral-rose flower token (X)
    const baseGeo = new THREE.CylinderGeometry(0.33, 0.35, 0.12, 28);
    const baseMat = new THREE.MeshStandardMaterial({
      color: player === 'X' ? 0x6b2737 : 0x164e3b,
      roughness: 0.68,
      metalness: 0.05,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.09;
    base.castShadow = true;
    group.add(base);

    if (player === 'X') {
      const petalGeo = new THREE.SphereGeometry(0.13, 14, 10);
      const petalMat = new THREE.MeshPhysicalMaterial({
        color: 0xf45d78,
        roughness: 0.32,
        clearcoat: 0.45,
      });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = new THREE.Mesh(petalGeo, petalMat);
        p.scale.set(1.05, 0.45, 0.85);
        p.position.set(Math.cos(a) * 0.15, 0.2, Math.sin(a) * 0.15);
        p.rotation.y = -a;
        p.castShadow = true;
        group.add(p);
      }
      const stamen = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.2 }),
      );
      stamen.scale.set(1, 0.65, 1);
      stamen.position.y = 0.24;
      group.add(stamen);
    } else {
      const pebbleGeo = new THREE.SphereGeometry(0.29, 24, 16);
      const jadeMat = new THREE.MeshPhysicalMaterial({
        color: 0x10b981,
        roughness: 0.16,
        metalness: 0.04,
        clearcoat: 0.95,
        clearcoatRoughness: 0.1,
      });
      const pebble = new THREE.Mesh(pebbleGeo, jadeMat);
      pebble.scale.set(1, 0.56, 1);
      pebble.position.y = 0.18;
      pebble.castShadow = true;
      group.add(pebble);

      const leafRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.022, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0xd1fae5, roughness: 0.28, metalness: 0.2 }),
      );
      leafRing.rotation.x = Math.PI / 2;
      leafRing.position.y = 0.33;
      group.add(leafRing);
    }
    return group;
  }

  // 'classic': weighted ceramic disc with brushed metallic bezel & crisp 3D X/O emblem
  const discGeo = new THREE.CylinderGeometry(0.34, 0.36, 0.18, 44);
  const discMat = new THREE.MeshStandardMaterial({
    color: player === 'X' ? 0xe11d48 : 0x0d9488,
    roughness: 0.42,
    metalness: 0.1,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.y = 0.12;
  disc.castShadow = true;
  disc.receiveShadow = true;
  group.add(disc);

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.65,
  });
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.02, 10, 32), trimMat);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.21;
  group.add(trim);

  if (player === 'X') {
    const barGeo = new THREE.BoxGeometry(0.32, 0.055, 0.075);
    const bar1 = new THREE.Mesh(barGeo, trimMat);
    bar1.position.y = 0.235;
    bar1.rotation.y = Math.PI / 4;
    const bar2 = bar1.clone();
    bar2.rotation.y = -Math.PI / 4;
    group.add(bar1, bar2);
  } else {
    const oRing = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.036, 12, 28), trimMat);
    oRing.rotation.x = Math.PI / 2;
    oRing.position.y = 0.235;
    group.add(oRing);
  }

  return group;
}

/**
 * Composite 8-part antique Persian brass Samovar + wooden serving tray + steaming Estekan tea glass.
 */
function createPersianSamovarProp(maxAnisotropy: number): {
  group: THREE.Group;
  steamParticles: THREE.Points;
} {
  const root = new THREE.Group();

  const walnut = createWalnutWoodTextures(maxAnisotropy, 'dark');
  const trayMat = new THREE.MeshStandardMaterial({
    map: walnut.map,
    roughness: 0.48,
    metalness: 0.06,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xdca647,
    roughness: 0.2,
    metalness: 0.92,
  });
  const darkBrassMat = new THREE.MeshStandardMaterial({
    color: 0x8e6422,
    roughness: 0.35,
    metalness: 0.85,
  });

  // Oval wooden serving tray
  const trayBase = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.05, 0.07, 28), trayMat);
  trayBase.scale.set(1.22, 1, 0.84);
  trayBase.position.y = 0.035;
  trayBase.receiveShadow = true;
  trayBase.castShadow = true;
  root.add(trayBase);

  const trayRim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.045, 10, 32), darkBrassMat);
  trayRim.rotation.x = Math.PI / 2;
  trayRim.scale.set(1.22, 0.84, 1);
  trayRim.position.y = 0.08;
  root.add(trayRim);

  // Samovar Lathe urn silhouette (pedestal + bulbous belly + neck + crown)
  const samovarGroup = new THREE.Group();
  samovarGroup.position.set(0.35, 0.07, -0.05);

  const samProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.44, 0.09),
    new THREE.Vector2(0.24, 0.19),
    new THREE.Vector2(0.22, 0.3),
    new THREE.Vector2(0.56, 0.65),
    new THREE.Vector2(0.62, 1.05),
    new THREE.Vector2(0.52, 1.38),
    new THREE.Vector2(0.32, 1.56),
    new THREE.Vector2(0.39, 1.66),
    new THREE.Vector2(0.24, 1.72),
    new THREE.Vector2(0.22, 2.02),
    new THREE.Vector2(0.29, 2.12),
    new THREE.Vector2(0.18, 2.14),
    new THREE.Vector2(0.0, 2.1),
  ];
  const samBody = new THREE.Mesh(new THREE.LatheGeometry(samProfile, 36), brassMat);
  samBody.castShadow = true;
  samBody.receiveShadow = true;
  samovarGroup.add(samBody);

  // Decorative embossed bands
  for (const bandY of [0.68, 1.32, 1.64]) {
    const r = bandY < 0.8 ? 0.56 : bandY < 1.5 ? 0.53 : 0.36;
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 10, 32), darkBrassMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = bandY;
    samovarGroup.add(band);
  }

  // Dual curved brass handles
  const handleGeo = new THREE.TorusGeometry(0.22, 0.032, 10, 20, Math.PI * 1.15);
  const leftHandle = new THREE.Mesh(handleGeo, darkBrassMat);
  leftHandle.position.set(-0.56, 1.05, 0);
  leftHandle.rotation.z = Math.PI * 0.45;
  const rightHandle = new THREE.Mesh(handleGeo, darkBrassMat);
  rightHandle.position.set(0.56, 1.05, 0);
  rightHandle.rotation.z = -Math.PI * 0.45;
  samovarGroup.add(leftHandle, rightHandle);

  // Spout tap facing the tea glass
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.42, 12), darkBrassMat);
  spout.rotation.z = Math.PI / 2.2;
  spout.position.set(-0.62, 0.62, 0.14);
  samovarGroup.add(spout);

  const tapKey = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 16), brassMat);
  tapKey.position.set(-0.74, 0.72, 0.14);
  samovarGroup.add(tapKey);

  // Small ceramic teapot (Ghoori) perched atop the samovar crown
  const potProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.22, 0.0),
    new THREE.Vector2(0.32, 0.18),
    new THREE.Vector2(0.28, 0.38),
    new THREE.Vector2(0.18, 0.48),
    new THREE.Vector2(0.06, 0.56),
    new THREE.Vector2(0.0, 0.56),
  ];
  const teapot = new THREE.Mesh(
    new THREE.LatheGeometry(potProfile, 24),
    new THREE.MeshPhysicalMaterial({
      color: 0xf7f2e7,
      roughness: 0.18,
      clearcoat: 0.85,
    }),
  );
  teapot.position.y = 2.12;
  teapot.castShadow = true;
  samovarGroup.add(teapot);

  root.add(samovarGroup);

  // Persian Estekan (slim-waisted tea glass) + saucer + ruby tea
  const teaGroup = new THREE.Group();
  teaGroup.position.set(-0.62, 0.07, 0.24);

  const saucer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.22, 0.045, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xfbf7ee, roughness: 0.2, clearcoat: 0.8 }),
  );
  saucer.position.y = 0.022;
  saucer.castShadow = true;
  teaGroup.add(saucer);

  const saucerGoldRim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.012, 8, 28), brassMat);
  saucerGoldRim.rotation.x = Math.PI / 2;
  saucerGoldRim.position.y = 0.044;
  teaGroup.add(saucerGoldRim);

  // Ruby Persian tea liquid inside
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.115, 0.32, 20),
    new THREE.MeshPhysicalMaterial({
      color: 0x991b1b,
      roughness: 0.1,
      clearcoat: 1.0,
      emissive: 0x3f0a06,
      emissiveIntensity: 0.4,
    }),
  );
  liquid.position.y = 0.21;
  teaGroup.add(liquid);

  // Glass silhouette (transparent outer glass shell)
  const glassProfile = [
    new THREE.Vector2(0.125, 0.04),
    new THREE.Vector2(0.155, 0.14),
    new THREE.Vector2(0.128, 0.26),
    new THREE.Vector2(0.175, 0.44),
  ];
  const glassShell = new THREE.Mesh(
    new THREE.LatheGeometry(glassProfile, 24),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.08,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glassShell.renderOrder = 4;
  teaGroup.add(glassShell);

  // Tiny brass teaspoon resting on the saucer
  const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.04), brassMat);
  spoon.position.set(0.18, 0.052, 0.16);
  spoon.rotation.y = -0.5;
  teaGroup.add(spoon);

  root.add(teaGroup);

  // Rising soft warm tea steam particles above Estekan & Samovar
  const count = 28;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const isTea = i < 16;
    const baseX = isTea ? -0.62 : 0.35;
    const baseY = isTea ? 0.52 : 2.15;
    const baseZ = isTea ? 0.24 : -0.05;
    positions[i * 3] = baseX + (Math.sin(i * 4.3) * 0.12);
    positions[i * 3 + 1] = baseY + (i / count) * 1.1;
    positions[i * 3 + 2] = baseZ + (Math.cos(i * 3.1) * 0.12);
  }
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const steamMat = new THREE.PointsMaterial({
    color: 0xfff8eb,
    size: 0.18,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const steamParticles = new THREE.Points(steamGeo, steamMat);
  root.add(steamParticles);

  return { group: root, steamParticles };
}

/**
 * Terracotta courtyard pot with pomegranate leaves & ruby fruit.
 */
function createCourtyardPotProp(): THREE.Group {
  const group = new THREE.Group();

  const potProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.45, 0.0),
    new THREE.Vector2(0.62, 0.55),
    new THREE.Vector2(0.56, 0.88),
    new THREE.Vector2(0.65, 0.96),
    new THREE.Vector2(0.58, 1.02),
    new THREE.Vector2(0.48, 0.94),
  ];
  const pot = new THREE.Mesh(
    new THREE.LatheGeometry(potProfile, 24),
    new THREE.MeshStandardMaterial({ color: 0xaa5537, roughness: 0.82, metalness: 0.02 }),
  );
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.49, 0.06, 20),
    new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.95 }),
  );
  soil.position.y = 0.92;
  group.add(soil);

  // Leaf cluster
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2c6e37, roughness: 0.65 });
  const leafGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const offsets: [number, number, number, number][] = [
    [0, 1.38, 0, 1.05],
    [-0.3, 1.24, 0.22, 0.85],
    [0.32, 1.28, -0.18, 0.88],
    [0.14, 1.56, 0.2, 0.78],
    [-0.22, 1.5, -0.24, 0.8],
  ];
  for (const [x, y, z, s] of offsets) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(x, y, z);
    leaf.scale.set(s, s * 0.85, s);
    leaf.castShadow = true;
    group.add(leaf);
  }

  // Two ripe pomegranates nestled in foliage
  const pomMat = new THREE.MeshPhysicalMaterial({
    color: 0xb91c1c,
    roughness: 0.36,
    clearcoat: 0.35,
  });
  for (const [px, py, pz] of [
    [0.24, 1.32, 0.3],
    [-0.26, 1.46, 0.24],
  ]) {
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), pomMat);
    pom.position.set(px, py, pz);
    pom.castShadow = true;
    group.add(pom);
  }

  return group;
}

/**
 * Composite glowing amber glass candle + coffee mug + vintage hardcover book for Cozy Lounge.
 */
function createLoungeProps(): {
  candleGroup: THREE.Group;
  candleFlame: THREE.Mesh;
  candleLight: THREE.PointLight;
  mugGroup: THREE.Group;
  steamParticles: THREE.Points;
  bookGroup: THREE.Group;
} {
  // 1. Amber glass jar candle
  const candleGroup = new THREE.Group();
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.27, 0.56, 24),
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.65,
      emissive: 0xd97706,
      emissiveIntensity: 0.3,
    }),
  );
  wax.position.y = 0.3;
  candleGroup.add(wax);

  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.31, 0.72, 24, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xb45309,
      roughness: 0.14,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  jar.position.y = 0.36;
  jar.renderOrder = 4;
  candleGroup.add(jar);

  const jarRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.022, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.24, metalness: 0.6 }),
  );
  jarRim.rotation.x = Math.PI / 2;
  jarRim.position.y = 0.72;
  candleGroup.add(jarRim);

  const candleFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.22, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe484 }),
  );
  candleFlame.position.y = 0.7;
  candleGroup.add(candleFlame);

  const candleLight = new THREE.PointLight(0xffa43b, 3.2, 12, 1.8);
  candleLight.position.set(0, 0.92, 0);
  candleGroup.add(candleLight);

  // 2. Ceramic coffee mug + saucer + steam
  const mugGroup = new THREE.Group();
  const ceramicMat = new THREE.MeshPhysicalMaterial({
    color: 0x262422,
    roughness: 0.28,
    clearcoat: 0.55,
  });
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.34, 0.05, 24), ceramicMat);
  saucer.position.y = 0.025;
  saucer.castShadow = true;
  mugGroup.add(saucer);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.46, 24), ceramicMat);
  cup.position.y = 0.27;
  cup.castShadow = true;
  mugGroup.add(cup);

  const coffee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.245, 0.245, 0.02, 20),
    new THREE.MeshStandardMaterial({ color: 0x3b1d0c, roughness: 0.14 }),
  );
  coffee.position.y = 0.49;
  mugGroup.add(coffee);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 10, 18, Math.PI * 1.25), ceramicMat);
  handle.position.set(0.29, 0.28, 0);
  handle.rotation.z = -Math.PI * 0.62;
  mugGroup.add(handle);

  const count = 18;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.sin(i * 3.7) * 0.1;
    pos[i * 3 + 1] = 0.56 + (i / count) * 0.9;
    pos[i * 3 + 2] = Math.cos(i * 2.9) * 0.1;
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const steamParticles = new THREE.Points(
    sGeo,
    new THREE.PointsMaterial({
      color: 0xfff5e4,
      size: 0.17,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  mugGroup.add(steamParticles);

  // 3. Vintage hardcover book (Hafez Divan aesthetic)
  const bookGroup = new THREE.Group();
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x6b1d28, roughness: 0.62 });
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xf3e8d2, roughness: 0.85 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0xdca74c, roughness: 0.25, metalness: 0.85 });

  const bottomCover = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 1.55), coverMat);
  bottomCover.position.y = 0.02;
  bottomCover.castShadow = true;
  const pages = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.2, 1.48), pageMat);
  pages.position.set(0.02, 0.14, 0);
  const topCover = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 1.55), coverMat);
  topCover.position.y = 0.26;
  topCover.castShadow = true;
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 1.55), coverMat);
  spine.position.set(-0.56, 0.14, 0);
  const medallion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.56), goldTrim);
  medallion.position.y = 0.285;
  bookGroup.add(bottomCover, pages, topCover, spine, medallion);

  return { candleGroup, candleFlame, candleLight, mugGroup, steamParticles, bookGroup };
}

/**
 * Builds the complete real 3D physical diorama for the selected EnvironmentTheme.
 */
export function buildEnvironmentDiorama(
  env: EnvironmentTheme,
  colorMode: ColorMode,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): EnvironmentBuildResult {
  const group = new THREE.Group();
  const handles: AnimatedEnvHandles = {
    steamParticles: null,
    waterMesh: null,
    waterfallMesh: null,
    waterTexture: null,
    candleFlame: null,
    candleLight: null,
    grassMesh: null,
    pollenParticles: null,
  };

  // Contact shadow grounding plane right under the board
  const shadowTex = createContactShadowTexture();
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 7.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.012;
  group.add(contactShadow);

  if (env === 'carpet') {
    // Warm sunlit Iranian courtyard stone ground
    const stoneTex = createCourtyardStoneTexture(maxAnisotropy);
    const courtyardFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      new THREE.MeshStandardMaterial({
        map: stoneTex,
        roughness: 0.88,
        metalness: 0.02,
      }),
    );
    courtyardFloor.rotation.x = -Math.PI / 2;
    courtyardFloor.position.y = -0.06;
    courtyardFloor.receiveShadow = true;
    group.add(courtyardFloor);

    // Thick handwoven Persian carpet resting on the courtyard
    const carpetTex = createPersianCarpetTextures(maxAnisotropy);
    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(14.5, 0.06, 11.2),
      new THREE.MeshStandardMaterial({
        map: carpetTex.map,
        bumpMap: carpetTex.bumpMap,
        bumpScale: 0.025,
        roughness: 0.92,
        metalness: 0.0,
      }),
    );
    carpet.position.y = -0.03;
    carpet.receiveShadow = true;
    group.add(carpet);

    // Cream braided carpet fringes along both short ends
    const fringeMat = new THREE.MeshStandardMaterial({ color: 0xf1e5cc, roughness: 0.9 });
    const fringeGeo = new THREE.BoxGeometry(0.42, 0.016, 0.08);
    const fringeCount = 46;
    const fringes = new THREE.InstancedMesh(fringeGeo, fringeMat, fringeCount * 2);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < fringeCount; i++) {
      const z = -5.3 + (i / (fringeCount - 1)) * 10.6;
      dummy.position.set(7.45, -0.048, z);
      dummy.updateMatrix();
      fringes.setMatrixAt(i, dummy.matrix);

      dummy.position.set(-7.45, -0.048, z);
      dummy.updateMatrix();
      fringes.setMatrixAt(fringeCount + i, dummy.matrix);
    }
    fringes.computeBoundingSphere();
    group.add(fringes);

    // Brass Samovar & Estekan tea tray on the upper-left corner of the carpet
    const samovar = createPersianSamovarProp(maxAnisotropy);
    samovar.group.position.set(-4.65, 0.0, -3.55);
    samovar.group.rotation.y = 0.42;
    group.add(samovar.group);
    handles.steamParticles = samovar.steamParticles;

    // Terracotta pomegranate pot on the upper-right courtyard edge
    const pot = createCourtyardPotProp();
    pot.position.set(5.45, -0.06, -4.1);
    group.add(pot);

    const pot2 = createCourtyardPotProp();
    pot2.position.set(6.4, -0.06, -2.5);
    pot2.scale.setScalar(0.76);
    pot2.rotation.y = 1.6;
    group.add(pot2);

    const isDark = colorMode === 'dark';
    return {
      group,
      bgColor: isDark ? 0x1a1210 : 0xe9dcc8,
      fogColor: isDark ? 0x1a1210 : 0xe9dcc8,
      fogNear: 15,
      fogFar: 38,
      keyLightColor: 0xffe4b8,
      keyLightIntensity: isDark ? 2.1 : 2.5,
      keyLightPos: [7.5, 11, 5.5],
      hemiSkyColor: isDark ? 0xffd7a8 : 0xfff3de,
      hemiGroundColor: 0x5c231c,
      hemiIntensity: isDark ? 0.7 : 0.95,
      handles,
    };
  }

  if (env === 'meadow') {
    const grassTex = createMeadowGroundTexture(maxAnisotropy);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshStandardMaterial({
        map: grassTex,
        roughness: 0.94,
        metalness: 0.0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    group.add(ground);

    // Flat carved natural garden flagstone slab resting on the meadow under the board
    const flagstone = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 5.9, 0.1, 12),
      new THREE.MeshStandardMaterial({
        color: 0x8e9189,
        roughness: 0.86,
        metalness: 0.02,
      }),
    );
    flagstone.scale.set(1.22, 1, 0.92);
    flagstone.position.y = -0.05;
    flagstone.receiveShadow = true;
    group.add(flagstone);

    // 300 instanced 3D grass blades framing the stone slab
    const bladeCount = isSoftwareGl ? 180 : 320;
    const bladeGeo = new THREE.ConeGeometry(0.055, 0.52, 4);
    bladeGeo.translate(0, 0.26, 0);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x529e44,
      roughness: 0.78,
    });
    const grassMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const radius = 5.4 + ((i * 37) % 100) / 100 * 6.5;
      const gx = Math.cos(angle) * radius * 1.15;
      const gz = Math.sin(angle) * radius * 0.95;
      const scaleH = 0.72 + ((i * 19) % 50) / 100;
      dummy.position.set(gx, -0.08, gz);
      dummy.rotation.set(
        (Math.sin(i * 1.7) * 0.18),
        (i * 1.3) % (Math.PI * 2),
        (Math.cos(i * 2.1) * 0.18),
      );
      dummy.scale.set(0.9 + (i % 3) * 0.12, scaleH, 0.9);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);
      tint.setHSL(0.28 + ((i % 7) - 3) * 0.012, 0.48, 0.36 + (i % 5) * 0.03);
      grassMesh.setColorAt(i, tint);
    }
    grassMesh.computeBoundingSphere();
    group.add(grassMesh);
    handles.grassMesh = grassMesh;

    // 54 spring daisies & buttercups scattered gently around the perimeter
    const flowerCount = 54;
    const flowerGeo = new THREE.DodecahedronGeometry(0.11, 0);
    const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    for (let i = 0; i < flowerCount; i++) {
      const angle = (i * 2.39996 + 0.5) % (Math.PI * 2);
      const radius = 5.5 + ((i * 53) % 100) / 100 * 5.2;
      dummy.position.set(
        Math.cos(angle) * radius * 1.12,
        0.18 + (i % 3) * 0.06,
        Math.sin(angle) * radius * 0.92,
      );
      dummy.rotation.set(0, i, 0);
      dummy.scale.set(1.1, 0.55, 1.1);
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
      tint.setHex(i % 3 === 0 ? 0xfef08a : 0xffffff);
      flowers.setColorAt(i, tint);
    }
    flowers.computeBoundingSphere();
    group.add(flowers);

    // 2 distant orchard trees framing the upper horizon
    for (const [tx, tz, sc] of [
      [-6.8, -6.8, 1.1],
      [7.2, -6.4, 0.95],
    ]) {
      const tree = new THREE.Group();
      tree.position.set(tx, -0.08, tz);
      tree.scale.setScalar(sc);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.42, 2.8, 10),
        new THREE.MeshStandardMaterial({ color: 0x5c3d28, roughness: 0.92 }),
      );
      trunk.position.y = 1.4;
      trunk.castShadow = true;
      tree.add(trunk);

      const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3b7a38, roughness: 0.8 });
      for (const [cx, cy, cz, cr] of [
        [0, 3.1, 0, 1.55],
        [-0.95, 2.7, 0.4, 1.1],
        [0.9, 2.8, -0.35, 1.15],
      ]) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(cr, 1), canopyMat);
        puff.position.set(cx, cy, cz);
        puff.castShadow = true;
        tree.add(puff);
      }
      group.add(tree);
    }

    // Drifting golden spring sunlight pollen motes
    const moteCount = 45;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePos[i * 3] = ((i * 73) % 160) / 10 - 8;
      motePos[i * 3 + 1] = 0.6 + ((i * 31) % 45) / 10;
      motePos[i * 3 + 2] = ((i * 97) % 140) / 10 - 7;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const pollenParticles = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        color: 0xfef9c3,
        size: 0.12,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    group.add(pollenParticles);
    handles.pollenParticles = pollenParticles;

    const isDark = colorMode === 'dark';
    return {
      group,
      bgColor: isDark ? 0x102119 : 0xcde8cc,
      fogColor: isDark ? 0x102119 : 0xcde8cc,
      fogNear: 14,
      fogFar: 36,
      keyLightColor: 0xfff4cf,
      keyLightIntensity: isDark ? 1.9 : 2.6,
      keyLightPos: [6, 12, 5],
      hemiSkyColor: isDark ? 0x8bd8a8 : 0xdff5ff,
      hemiGroundColor: 0x265429,
      hemiIntensity: isDark ? 0.65 : 1.0,
      handles,
    };
  }

  if (env === 'waterfall') {
    const waterTex = createWaterFlowTexture(maxAnisotropy);
    handles.waterTexture = waterTex;

    // Shimmering mountain turquoise water basin
    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshPhysicalMaterial({
        map: waterTex,
        color: 0x14919b,
        roughness: 0.14,
        metalness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
      }),
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -0.32;
    waterMesh.receiveShadow = true;
    group.add(waterMesh);
    handles.waterMesh = waterMesh;

    // Broad smooth dark wet river stone terrace supporting the board & side dishes
    const slateTex = createMossySlateTexture(maxAnisotropy);
    const terrace = new THREE.Mesh(
      new THREE.CylinderGeometry(5.8, 6.4, 0.36, 14),
      new THREE.MeshStandardMaterial({
        map: slateTex,
        roughness: 0.42,
        metalness: 0.08,
      }),
    );
    terrace.scale.set(1.24, 1, 0.94);
    terrace.position.y = -0.18;
    terrace.receiveShadow = true;
    group.add(terrace);

    // Distant rocky cliff & animated cascading waterfall curtain behind the terrace
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x344147, roughness: 0.82 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x3d7d44, roughness: 0.88 });

    for (const [rx, ry, rz, sx, sy, sz] of [
      [-4.2, 1.4, -7.8, 2.8, 2.2, 2.2],
      [4.2, 1.5, -7.8, 3.0, 2.4, 2.2],
      [0.0, 2.3, -8.8, 3.2, 1.2, 1.8],
      [-5.8, 0.35, -3.5, 1.4, 0.8, 1.3],
      [6.1, 0.3, -3.2, 1.3, 0.75, 1.2],
      [5.4, 0.2, 2.6, 1.1, 0.55, 1.0],
      [-5.6, 0.2, 2.8, 1.15, 0.58, 1.1],
    ]) {
      const boulder = new THREE.Group();
      const body = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMat);
      body.scale.set(sx, sy, sz);
      body.castShadow = true;
      body.receiveShadow = true;
      boulder.add(body);

      const mossCap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), mossMat);
      mossCap.scale.set(sx * 0.85, sy * 0.38, sz * 0.85);
      mossCap.position.y = sy * 0.56;
      boulder.add(mossCap);

      boulder.position.set(rx, ry - 0.3, rz);
      group.add(boulder);
    }

    const waterfallMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 4.4),
      new THREE.MeshPhysicalMaterial({
        map: waterTex,
        color: 0xa5f3fc,
        emissive: 0x155e75,
        emissiveIntensity: 0.35,
        roughness: 0.18,
        transparent: true,
        opacity: 0.88,
      }),
    );
    waterfallMesh.position.set(0, 1.5, -7.6);
    waterfallMesh.rotation.x = 0.14;
    group.add(waterfallMesh);
    handles.waterfallMesh = waterfallMesh;

    // Rising waterfall mist droplets
    const mistCount = 50;
    const mistPos = new Float32Array(mistCount * 3);
    for (let i = 0; i < mistCount; i++) {
      mistPos[i * 3] = (((i * 61) % 100) / 100 - 0.5) * 4.4;
      mistPos[i * 3 + 1] = -0.1 + ((i * 29) % 100) / 100 * 1.9;
      mistPos[i * 3 + 2] = -6.8 + (((i * 47) % 100) / 100 - 0.5) * 2.2;
    }
    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    const mistParticles = new THREE.Points(
      mistGeo,
      new THREE.PointsMaterial({
        color: 0xe0f7fa,
        size: 0.32,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    group.add(mistParticles);
    handles.steamParticles = mistParticles;

    const isDark = colorMode === 'dark';
    return {
      group,
      bgColor: isDark ? 0x082029 : 0xbce6e9,
      fogColor: isDark ? 0x082029 : 0xbce6e9,
      fogNear: 13,
      fogFar: 35,
      keyLightColor: 0xe8fbff,
      keyLightIntensity: isDark ? 2.0 : 2.5,
      keyLightPos: [5.5, 12, 6],
      hemiSkyColor: isDark ? 0x5eead4 : 0xdff8ff,
      hemiGroundColor: 0x0f3b44,
      hemiIntensity: isDark ? 0.72 : 1.0,
      handles,
    };
  }

  if (env === 'lounge') {
    // Cozy walnut coffee table slab above a warm woven living-room carpet
    const walnut = createWalnutWoodTextures(maxAnisotropy, 'warm');
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(15.5, 0.32, 10.6),
      new THREE.MeshPhysicalMaterial({
        map: walnut.map,
        bumpMap: walnut.bumpMap,
        bumpScale: 0.016,
        roughness: 0.34,
        metalness: 0.04,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
      }),
    );
    tableTop.position.y = -0.16;
    tableTop.receiveShadow = true;
    group.add(tableTop);

    // Subtle brass corner inlays along table edge
    const tableTrim = new THREE.Mesh(
      new THREE.BoxGeometry(15.65, 0.06, 10.75),
      new THREE.MeshStandardMaterial({ color: 0x452412, roughness: 0.48 }),
    );
    tableTrim.position.y = -0.28;
    group.add(tableTrim);

    // Warm room floor far below table
    const roomFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      new THREE.MeshStandardMaterial({ color: 0x261a14, roughness: 0.92 }),
    );
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.y = -1.8;
    group.add(roomFloor);

    // Candle, steaming coffee mug, and vintage hardcover book on the walnut table
    const props = createLoungeProps();
    props.candleGroup.position.set(4.95, 0, -2.75);
    group.add(props.candleGroup);
    handles.candleFlame = props.candleFlame;
    handles.candleLight = props.candleLight;

    props.mugGroup.position.set(-4.95, 0, -2.25);
    props.mugGroup.rotation.y = 0.6;
    group.add(props.mugGroup);
    handles.steamParticles = props.steamParticles;

    props.bookGroup.position.set(-4.75, 0, 2.55);
    props.bookGroup.rotation.y = -0.26;
    group.add(props.bookGroup);

    const isDark = colorMode === 'dark';
    return {
      group,
      bgColor: isDark ? 0x18100c : 0xe4d5c3,
      fogColor: isDark ? 0x18100c : 0xe4d5c3,
      fogNear: 14,
      fogFar: 36,
      keyLightColor: 0xffd599,
      keyLightIntensity: isDark ? 1.85 : 2.3,
      keyLightPos: [6.5, 10.5, 6],
      hemiSkyColor: isDark ? 0xf5b971 : 0xfff0d8,
      hemiGroundColor: 0x3b1f10,
      hemiIntensity: isDark ? 0.58 : 0.9,
      handles,
    };
  }

  // 'simple': Clean modern architectural studio pedestal
  const isLight = colorMode === 'light';
  const studioFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 44),
    new THREE.MeshStandardMaterial({
      color: isLight ? 0xe7edf2 : 0x0b1623,
      roughness: 0.82,
      metalness: 0.05,
    }),
  );
  studioFloor.rotation.x = -Math.PI / 2;
  studioFloor.position.y = -0.05;
  studioFloor.receiveShadow = true;
  group.add(studioFloor);

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(6.3, 6.6, 0.08, 48),
    new THREE.MeshStandardMaterial({
      color: isLight ? 0xf8fafc : 0x122234,
      roughness: 0.52,
      metalness: 0.14,
    }),
  );
  plinth.position.y = -0.04;
  plinth.receiveShadow = true;
  group.add(plinth);

  const brassRing = new THREE.Mesh(
    new THREE.TorusGeometry(6.32, 0.025, 10, 64),
    new THREE.MeshStandardMaterial({
      color: isLight ? 0x0d9488 : 0x2dd4bf,
      roughness: 0.28,
      metalness: 0.72,
    }),
  );
  brassRing.rotation.x = Math.PI / 2;
  brassRing.position.y = 0.005;
  group.add(brassRing);

  return {
    group,
    bgColor: isLight ? 0xe7edf2 : 0x0b1623,
    fogColor: isLight ? 0xe7edf2 : 0x0b1623,
    fogNear: 16,
    fogFar: 40,
    keyLightColor: 0xfff8ed,
    keyLightIntensity: isLight ? 2.3 : 2.1,
    keyLightPos: [6, 12, 6],
    hemiSkyColor: isLight ? 0xffffff : 0x99d5e8,
    hemiGroundColor: isLight ? 0xcbd5e1 : 0x101c2d,
    hemiIntensity: isLight ? 0.95 : 0.7,
    handles,
  };
}

/**
 * Creates a physical 3D carved wooden/stone side dish beside the board for in-hand + captured pieces.
 */
export function createSideDishModel(
  theme: BoardTheme,
  colorMode: ColorMode,
  maxAnisotropy: number,
): THREE.Group {
  const group = new THREE.Group();

  let frameColor = 0x3b2217;
  let innerColor = 0x26150e;
  let trimColor = 0xd9a85b;

  if (theme === 'felt') {
    frameColor = 0x4b2b1a;
    innerColor = 0x12422f;
    trimColor = 0xe6c87a;
  } else if (theme === 'tile') {
    frameColor = 0x0f4150;
    innerColor = 0x0a2b36;
    trimColor = 0xf4d382;
  } else if (theme === 'navy') {
    frameColor = colorMode === 'light' ? 0xdbe3ec : 0x1c314a;
    innerColor = colorMode === 'light' ? 0xcbd5e1 : 0x0e1c2c;
    trimColor = colorMode === 'light' ? 0x64748b : 0x38bdf8;
  }

  let frameMat: THREE.MeshStandardMaterial;
  if (theme === 'walnut' || theme === 'felt') {
    const w = createWalnutWoodTextures(maxAnisotropy, 'warm');
    frameMat = new THREE.MeshStandardMaterial({
      map: w.map,
      roughness: 0.42,
      metalness: 0.06,
    });
  } else {
    frameMat = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.45,
      metalness: 0.2,
    });
  }

  const innerMat = new THREE.MeshStandardMaterial({
    color: innerColor,
    roughness: 0.85,
    metalness: 0.04,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    roughness: 0.25,
    metalness: 0.82,
  });

  // Outer carved tray body (width 1.48, depth 5.0)
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.16, 5.0), frameMat);
  base.position.y = 0.08;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Recessed upper compartment (Reserve / In-Hand)
  const topWell = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.04, 2.18), innerMat);
  topWell.position.set(0, 0.155, -1.18);
  topWell.receiveShadow = true;
  group.add(topWell);

  // Recessed lower compartment (Knocked-out / Captured graveyard dish)
  const bottomWell = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.04, 2.18), innerMat);
  bottomWell.position.set(0, 0.155, 1.18);
  bottomWell.receiveShadow = true;
  group.add(bottomWell);

  // Brass divider bar separating Reserve from Knocked-Out dish
  const divider = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.06, 0.08), trimMat);
  divider.position.set(0, 0.175, 0);
  group.add(divider);

  return group;
}

/**
 * Recursively disposes geometries, materials, and maps inside an Object3D hierarchy.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        disposeMaterial(m);
      }
    } else if (mat) {
      disposeMaterial(mat);
    }
  });
}

function disposeMaterial(mat: THREE.Material): void {
  const std = mat as THREE.MeshStandardMaterial;
  if (std.map) std.map.dispose();
  if (std.bumpMap) std.bumpMap.dispose();
  if (std.normalMap) std.normalMap.dispose();
  if (std.roughnessMap) std.roughnessMap.dispose();
  mat.dispose();
}
