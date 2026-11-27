import { BoardTheme, ColorMode, PieceStyle, Player } from './dooz.types';

export interface ColorSwatch {
  name: string;
  hex: string;
}

export const CURATED_COLOR_SWATCHES: readonly ColorSwatch[] = [
  { name: 'یاقوتی', hex: '#E11D48' },
  { name: 'فیروزه‌ای', hex: '#0D9488' },
  { name: 'طلایی', hex: '#D97706' },
  { name: 'لاجوردی', hex: '#2563EB' },
  { name: 'ارغوانی', hex: '#9333EA' },
  { name: 'زمردی', hex: '#059669' },
  { name: 'مرجانی', hex: '#F43F5E' },
  { name: 'کهربایی', hex: '#EA580C' },
  { name: 'آسمانی', hex: '#06B6D4' },
  { name: 'نیلی', hex: '#4F46E5' },
  { name: 'سرخابی', hex: '#DB2777' },
  { name: 'زیتونی', hex: '#65A30D' },
  { name: 'گردویی', hex: '#7C2D12' },
  { name: 'عاجی', hex: '#E5D3B3' },
  { name: 'نقره‌ای', hex: '#94A3B8' },
  { name: 'سرمه‌ای', hex: '#1E3A5F' },
  { name: 'ابنوسی', hex: '#18181B' },
  { name: 'مرواریدی', hex: '#F8FAFC' },
];

export interface PieceShades {
  highlight: string;
  mid: string;
  shadow: string;
  stroke: string;
  innerRing: string;
  emblem: string;
}

export interface BoardColorTokens {
  frameBg: string;
  cellBg: string;
  borderColor: string;
  trackStroke: string;
  diagonalStroke: string;
  socketFill: string;
  socketStroke: string;
  slabEdge: string;
}

export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const fullMatch = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  return fullMatch ? `#${fullMatch[1].toUpperCase()}` : null;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = normalizeHex(hex) ?? '#0D9488';
  const n = Number.parseInt(clean.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function mixHex(hexA: string, hexB: string, ratioB: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const t = Math.max(0, Math.min(1, ratioB));
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getDefaultPieceHex(player: Player, style: PieceStyle): string {
  switch (style) {
    case 'wood':
      return player === 'X' ? '#7C2D12' : '#EFE2C6';
    case 'crown':
      return player === 'X' ? '#1E1B18' : '#F3E9D2';
    case 'marble':
      return player === 'X' ? '#27272A' : '#F8FAFC';
    case 'brass':
      return player === 'X' ? '#B45309' : '#CBD5E1';
    case 'nature':
      return player === 'X' ? '#FB7185' : '#059669';
    case 'neon':
      return player === 'X' ? '#EC4899' : '#06B6D4';
    case 'classic':
      return player === 'X' ? '#E11D48' : '#0D9488';
    default:
      return player === 'X' ? '#E11D48' : '#0D9488';
  }
}

export function resolvePieceShades(
  player: Player,
  style: PieceStyle,
  customHex: string | null,
): PieceShades {
  const base = normalizeHex(customHex) ?? getDefaultPieceHex(player, style);
  const isLightBase = relativeLuminance(base) > 0.56;

  const highlight = mixHex(base, '#FFFFFF', isLightBase ? 0.68 : 0.54);
  const mid = base;
  const shadow = mixHex(base, '#05080F', isLightBase ? 0.34 : 0.54);
  const emblem = isLightBase ? mixHex(base, '#1E140B', 0.78) : '#FFFDF7';
  const innerRing = isLightBase ? 'rgba(30,20,10,0.22)' : 'rgba(255,255,255,0.34)';

  let stroke = '#FDE68A';
  if (style === 'wood' || style === 'crown') {
    stroke = isLightBase ? '#92400E' : '#F59E0B';
  } else if (style === 'marble') {
    stroke = isLightBase ? '#CBD5E1' : '#52525B';
  } else if (style === 'brass') {
    stroke = isLightBase ? '#64748B' : '#FCD34D';
  } else if (style === 'nature') {
    stroke = isLightBase ? mixHex(base, '#166534', 0.45) : mixHex(base, '#FFFFFF', 0.68);
  } else if (style === 'neon') {
    stroke = mixHex(base, '#FFFFFF', 0.75);
  } else if (style === 'classic') {
    stroke = isLightBase ? mixHex(base, '#0F172A', 0.55) : mixHex(base, '#FFFFFF', 0.72);
  }

  return { highlight, mid, shadow, stroke, innerRing, emblem };
}

export function resolveBoardColorTokens(
  theme: BoardTheme,
  colorMode: ColorMode,
  customBoardHex: string | null,
): BoardColorTokens {
  const custom = normalizeHex(customBoardHex);
  if (theme === 'glass') {
    const isLight = colorMode === 'light';
    if (custom) {
      const isCustomLight = relativeLuminance(custom) > 0.5;
      return {
        frameBg: hexToRgba(custom, 0.34),
        cellBg: hexToRgba(custom, 0.22),
        borderColor: 'rgba(255, 255, 255, 0.42)',
        trackStroke: isCustomLight ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.62)',
        diagonalStroke: isCustomLight ? 'rgba(15, 23, 42, 0.32)' : 'rgba(255, 255, 255, 0.35)',
        socketFill: hexToRgba(custom, 0.26),
        socketStroke: 'rgba(255, 255, 255, 0.52)',
        slabEdge: hexToRgba(mixHex(custom, '#FFFFFF', 0.25), 0.45),
      };
    }
    return {
      frameBg: isLight ? 'rgba(255, 255, 255, 0.34)' : 'rgba(15, 23, 42, 0.34)',
      cellBg: isLight ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.09)',
      borderColor: isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.32)',
      trackStroke: isLight ? 'rgba(15, 23, 42, 0.44)' : 'rgba(241, 245, 249, 0.62)',
      diagonalStroke: isLight ? 'rgba(15, 23, 42, 0.24)' : 'rgba(226, 232, 240, 0.34)',
      socketFill: isLight ? 'rgba(255, 255, 255, 0.38)' : 'rgba(15, 23, 42, 0.36)',
      socketStroke: isLight ? 'rgba(15, 23, 42, 0.38)' : 'rgba(255, 255, 255, 0.5)',
      slabEdge: isLight ? 'rgba(255, 255, 255, 0.48)' : 'rgba(148, 163, 184, 0.36)',
    };
  }

  if (custom) {
    const isLight = relativeLuminance(custom) > 0.48;
    return {
      frameBg: custom,
      cellBg: isLight ? mixHex(custom, '#FFFFFF', 0.38) : mixHex(custom, '#FFFFFF', 0.12),
      borderColor: isLight ? mixHex(custom, '#0F172A', 0.28) : mixHex(custom, '#FFFFFF', 0.24),
      trackStroke: isLight ? mixHex(custom, '#0F172A', 0.46) : mixHex(custom, '#FDE68A', 0.55),
      diagonalStroke: isLight ? mixHex(custom, '#0F172A', 0.28) : mixHex(custom, '#FFFFFF', 0.3),
      socketFill: isLight ? mixHex(custom, '#0F172A', 0.08) : mixHex(custom, '#05080F', 0.42),
      socketStroke: isLight ? mixHex(custom, '#0F172A', 0.32) : mixHex(custom, '#FFFFFF', 0.28),
      slabEdge: mixHex(custom, '#04060A', 0.55),
    };
  }

  if (theme === 'walnut') {
    return {
      frameBg: '#321E16',
      cellBg: '#452B20',
      borderColor: 'rgba(180, 83, 9, 0.45)',
      trackStroke: '#C6924A',
      diagonalStroke: 'rgba(198, 146, 74, 0.55)',
      socketFill: '#24140D',
      socketStroke: '#B8894B',
      slabEdge: '#1E100A',
    };
  }
  if (theme === 'felt') {
    return {
      frameBg: '#103828',
      cellBg: '#174D37',
      borderColor: 'rgba(4, 120, 87, 0.45)',
      trackStroke: '#D8B86A',
      diagonalStroke: 'rgba(216, 184, 106, 0.55)',
      socketFill: '#0B281C',
      socketStroke: '#A98E52',
      slabEdge: '#160B06',
    };
  }
  if (theme === 'tile') {
    return {
      frameBg: '#0E3A47',
      cellBg: '#144E5E',
      borderColor: 'rgba(6, 182, 212, 0.38)',
      trackStroke: '#7ED2DF',
      diagonalStroke: 'rgba(126, 210, 223, 0.5)',
      socketFill: '#082730',
      socketStroke: '#5BB6C5',
      slabEdge: '#07222B',
    };
  }

  if (colorMode === 'light') {
    return {
      frameBg: '#F4F6F9',
      cellBg: '#FFFFFF',
      borderColor: 'rgba(203, 213, 225, 0.9)',
      trackStroke: '#64748B',
      diagonalStroke: '#94A3B8',
      socketFill: '#FFFFFF',
      socketStroke: '#94A3B8',
      slabEdge: '#CBD5E1',
    };
  }

  return {
    frameBg: '#171717',
    cellBg: '#202020',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    trackStroke: '#525252',
    diagonalStroke: '#3B3B3B',
    socketFill: '#121212',
    socketStroke: '#737373',
    slabEdge: '#0A0A0A',
  };
}
