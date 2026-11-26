import * as THREE from 'three';
import { BoardTheme, ColorMode } from '../dooz.types';

function configureColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function configureDataTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Handwoven Persian crimson, indigo, and gold medallion carpet texture.
 */
export function createPersianCarpetTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep Persian madder crimson base
  ctx.fillStyle = '#7A1624';
  ctx.fillRect(0, 0, size, size);

  // Subtle woven dye variation
  const grad = ctx.createRadialGradient(size / 2, size / 2, 60, size / 2, size / 2, size * 0.65);
  grad.addColorStop(0, '#9B1F2E');
  grad.addColorStop(0.55, '#771522');
  grad.addColorStop(1, '#580E18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Outer indigo navy border frame
  const drawBorderRect = (inset: number, width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  };

  drawBorderRect(26, 44, '#132440');
  drawBorderRect(56, 10, '#DFB468');
  drawBorderRect(78, 22, '#F0DFBD');
  drawBorderRect(102, 8, '#132440');
  drawBorderRect(118, 6, '#C8923E');

  // Repeating botanical diamonds along the navy border
  ctx.fillStyle = '#E6BD72';
  for (let i = 70; i <= size - 70; i += 44) {
    for (const [bx, by] of [
      [i, 26],
      [i, size - 26],
      [26, i],
      [size - 26, i],
    ]) {
      ctx.beginPath();
      ctx.moveTo(bx, by - 10);
      ctx.lineTo(bx + 10, by);
      ctx.lineTo(bx, by + 10);
      ctx.lineTo(bx - 10, by);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#9D2231';
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E6BD72';
    }
  }

  // Cream inner spandrels (Lachak corners)
  const drawCornerSpandrel = (cx: number, cy: number, sx: number, sy: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.fillStyle = '#EFE0BF';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(155, 0);
    ctx.quadraticCurveTo(85, 85, 0, 155);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#183254';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#1D5C63';
    ctx.beginPath();
    ctx.arc(46, 46, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#D9A754';
    ctx.beginPath();
    ctx.arc(46, 46, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  drawCornerSpandrel(126, 126, 1, 1);
  drawCornerSpandrel(size - 126, 126, -1, 1);
  drawCornerSpandrel(126, size - 126, 1, -1);
  drawCornerSpandrel(size - 126, size - 126, -1, -1);

  // Delicate repeating arabesque gold motifs across the field
  ctx.strokeStyle = 'rgba(232, 193, 120, 0.34)';
  ctx.lineWidth = 2;
  for (let y = 165; y <= size - 165; y += 64) {
    for (let x = 165; x <= size - 165; x += 64) {
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(20, 92, 99, 0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Central Toranj (Persian medallion)
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.fillStyle = '#132440';
  ctx.strokeStyle = '#E7C074';
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 === 0 ? 195 : 155;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#EFE0BF';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const r = i % 2 === 0 ? 128 : 96;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#991E2D';
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#DFB468';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  // Subtle woven wool fiber texture overlay
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.045)';
  for (let x = 0; x < size; x += 4) {
    ctx.fillRect(x, 0, 1, size);
  }

  // Wool weave bump map
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    for (let x = 0; x < 256; x += 3) {
      const shade = 110 + ((x * 13 + y * 29) % 38);
      bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
      bCtx.fillRect(x, y, 2, 2);
    }
  }

  return {
    map: configureColorTexture(canvas, maxAnisotropy, 1, 1),
    bumpMap: configureDataTexture(bumpCanvas, 6, 6),
  };
}

/**
 * Warm Iranian courtyard sandstone tiles surrounding the carpet.
 */
export function createCourtyardStoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8B745D';
  ctx.fillRect(0, 0, size, size);

  const tiles = 4;
  const step = size / tiles;
  for (let row = 0; row < tiles; row++) {
    for (let col = 0; col < tiles; col++) {
      const offset = row % 2 === 0 ? 0 : step * 0.5;
      const x = (col * step + offset) % size;
      const y = row * step;
      const tone = 162 + ((row * 17 + col * 31) % 24);
      ctx.fillStyle = `rgb(${tone}, ${tone - 18}, ${tone - 38})`;
      ctx.fillRect(x + 3, y + 3, step - 6, step - 6);
      if (x + step > size) {
        ctx.fillRect(x - size + 3, y + 3, step - 6, step - 6);
      }
    }
  }

  // Subtle weathered stone speckles
  for (let i = 0; i < 1800; i++) {
    const px = (i * 197) % size;
    const py = (i * 353) % size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,248,230,0.06)' : 'rgba(40,28,18,0.08)';
    ctx.fillRect(px, py, 3, 3);
  }

  return configureColorTexture(canvas, maxAnisotropy, 4, 4);
}

/**
 * Rich oiled Persian walnut wood grain texture for tabletops and walnut boards.
 */
export function createWalnutWoodTextures(
  maxAnisotropy: number,
  tone: 'dark' | 'warm' = 'warm',
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const baseR = tone === 'warm' ? 98 : 66;
  const baseG = tone === 'warm' ? 58 : 39;
  const baseB = tone === 'warm' ? 34 : 26;

  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y++) {
    const wave =
      Math.sin(y * 0.055) * 0.5 +
      Math.sin(y * 0.17 + 1.4) * 0.3 +
      Math.sin(y * 0.41) * 0.2;
    const delta = Math.round(wave * 18);
    ctx.fillStyle = `rgb(${Math.max(20, baseR + delta)}, ${Math.max(12, baseG + Math.round(delta * 0.72))}, ${Math.max(8, baseB + Math.round(delta * 0.5))})`;
    ctx.fillRect(0, y, size, 1);

    const bVal = 128 + Math.round(wave * 26);
    bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bCtx.fillRect(0, y, size, 1);
  }

  // Organic wood grain streaks
  for (let i = 0; i < 65; i++) {
    const y0 = (i * 29) % size;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(28,14,6,0.22)' : 'rgba(180,122,70,0.12)';
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y0 + Math.sin(x * 0.015 + i) * 7);
    }
    ctx.stroke();
  }

  return {
    map: configureColorTexture(canvas, maxAnisotropy, 1, 1),
    bumpMap: configureDataTexture(bumpCanvas, 1, 1),
  };
}

/**
 * Tactile woven billiard/backgammon emerald felt texture.
 */
export function createFeltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#144D36';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 5500; i++) {
    const x = (i * 97) % size;
    const y = (i * 193) % size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(110, 231, 183, 0.06)' : 'rgba(4, 24, 16, 0.14)';
    ctx.fillRect(x, y, 2, 2);
  }

  return configureColorTexture(canvas, maxAnisotropy, 3, 3);
}

/**
 * Esfahan turquoise glazed ceramic tile texture with fine geometric lines.
 */
export function createPersianTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0F4A59';
  ctx.fillRect(0, 0, size, size);

  const step = 64;
  ctx.strokeStyle = 'rgba(229, 190, 108, 0.25)';
  ctx.lineWidth = 2;

  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const cx = x + step / 2;
      const cy = y + step / 2;
      ctx.strokeRect(x + 2, y + 2, step - 4, step - 4);
      ctx.beginPath();
      ctx.moveTo(cx, y + 8);
      ctx.lineTo(x + step - 8, cy);
      ctx.lineTo(cx, y + step - 8);
      ctx.lineTo(x + 8, cy);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(45, 212, 191, 0.16)';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return configureColorTexture(canvas, maxAnisotropy, 2, 2);
}

/**
 * Lush spring meadow grass texture with subtle sunlight patches.
 */
export function createMeadowGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2F6C33';
  ctx.fillRect(0, 0, size, size);

  // Dappled spring sunlight patches
  for (let i = 0; i < 24; i++) {
    const cx = (i * 137) % size;
    const cy = (i * 223) % size;
    const r = 45 + (i % 5) * 18;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(134, 212, 92, 0.28)' : 'rgba(22, 68, 28, 0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // Fine grass blade strokes
  for (let i = 0; i < 4200; i++) {
    const x = (i * 151) % size;
    const y = (i * 277) % size;
    ctx.fillStyle =
      i % 3 === 0 ? '#4B9444' : i % 3 === 1 ? '#235527' : '#74B957';
    ctx.fillRect(x, y, 2, 7);
  }

  return configureColorTexture(canvas, maxAnisotropy, 4, 4);
}

/**
 * Wet mossy river slate texture for the waterfall terrace.
 */
export function createMossySlateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2A363B';
  ctx.fillRect(0, 0, size, size);

  // Stone strata layers
  for (let i = 0; i < 40; i++) {
    const x = (i * 93) % size;
    const y = (i * 167) % size;
    const rx = 50 + (i % 6) * 20;
    const ry = 35 + (i % 5) * 14;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(65, 84, 92, 0.35)' : 'rgba(20, 28, 32, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (i % 4) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mossy green edges
  for (let i = 0; i < 18; i++) {
    const cx = (i * 181) % size;
    const cy = (i * 257) % size;
    const r = 32 + (i % 4) * 14;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(62, 128, 66, 0.42)');
    g.addColorStop(1, 'rgba(62, 128, 66, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  return configureColorTexture(canvas, maxAnisotropy, 2, 2);
}

/**
 * Flowing turquoise waterfall & stream foam texture.
 */
export function createWaterFlowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, size, 0);
  g.addColorStop(0, '#0C5D6E');
  g.addColorStop(0.5, '#198C9E');
  g.addColorStop(1, '#0C5D6E');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 90; i++) {
    const x = (i * 43) % size;
    const y = (i * 71) % size;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(230, 252, 255, 0.48)' : 'rgba(153, 246, 228, 0.24)';
    ctx.fillRect(x, y, 4 + (i % 5), 26 + (i % 34));
  }

  return configureColorTexture(canvas, maxAnisotropy, 2, 2);
}

/**
 * Soft radial contact shadow plane texture to anchor objects flush on the surface.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createRadialGradient(size / 2, size / 2, 18, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(8, 12, 18, 0.62)');
  g.addColorStop(0.55, 'rgba(8, 12, 18, 0.28)');
  g.addColorStop(1, 'rgba(8, 12, 18, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Returns the primary board deck material matching the active BoardTheme and ColorMode.
 */
export function createBoardDeckMaterial(
  theme: BoardTheme,
  colorMode: ColorMode,
  maxAnisotropy: number,
): { deckMat: THREE.MeshStandardMaterial; frameMat: THREE.MeshStandardMaterial; trackColor: number } {
  if (theme === 'walnut') {
    const walnut = createWalnutWoodTextures(maxAnisotropy, 'dark');
    const frameWalnut = createWalnutWoodTextures(maxAnisotropy, 'warm');
    return {
      deckMat: new THREE.MeshStandardMaterial({
        map: walnut.map,
        bumpMap: walnut.bumpMap,
        bumpScale: 0.015,
        roughness: 0.44,
        metalness: 0.05,
      }),
      frameMat: new THREE.MeshStandardMaterial({
        map: frameWalnut.map,
        bumpMap: frameWalnut.bumpMap,
        bumpScale: 0.018,
        roughness: 0.34,
        metalness: 0.08,
      }),
      trackColor: 0xd9a85b,
    };
  }

  if (theme === 'felt') {
    const feltMap = createFeltTexture(maxAnisotropy);
    const frameWalnut = createWalnutWoodTextures(maxAnisotropy, 'warm');
    return {
      deckMat: new THREE.MeshStandardMaterial({
        map: feltMap,
        roughness: 0.92,
        metalness: 0.0,
      }),
      frameMat: new THREE.MeshStandardMaterial({
        map: frameWalnut.map,
        bumpMap: frameWalnut.bumpMap,
        bumpScale: 0.015,
        roughness: 0.36,
        metalness: 0.08,
      }),
      trackColor: 0xe6c87a,
    };
  }

  if (theme === 'tile') {
    const tileMap = createPersianTileTexture(maxAnisotropy);
    return {
      deckMat: new THREE.MeshPhysicalMaterial({
        map: tileMap,
        roughness: 0.22,
        metalness: 0.08,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
      }),
      frameMat: new THREE.MeshStandardMaterial({
        color: 0xb88b4a,
        roughness: 0.28,
        metalness: 0.72,
      }),
      trackColor: 0xf4d382,
    };
  }

  // 'navy' architectural board adapts to Light / Dark mode
  if (colorMode === 'light') {
    return {
      deckMat: new THREE.MeshStandardMaterial({
        color: 0xeef2f6,
        roughness: 0.55,
        metalness: 0.04,
      }),
      frameMat: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.35,
        metalness: 0.35,
      }),
      trackColor: 0x475569,
    };
  }

  return {
    deckMat: new THREE.MeshStandardMaterial({
      color: 0x152538,
      roughness: 0.48,
      metalness: 0.14,
    }),
    frameMat: new THREE.MeshStandardMaterial({
      color: 0x243b55,
      roughness: 0.28,
      metalness: 0.52,
    }),
    trackColor: 0x7aa2c4,
  };
}
