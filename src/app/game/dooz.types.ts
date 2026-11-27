import type { DoozIconName } from '../ui/dooz-icon';

export type Player = 'X' | 'O';
export type CellValue = Player | null;

export type GameVariant = 'THREE' | 'NINE' | 'TWELVE';
export type GameState = 'TITLE_MENU' | 'PLAYING' | 'ROUND_SUMMARY';
export type GameMode = 'AI' | 'LOCAL_2P' | 'ONLINE' | 'LAN';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type BoardRule = 'CLASSIC' | 'INFINITE';
export type BoardTheme = 'navy' | 'walnut' | 'felt' | 'tile' | 'glass';
export type ColorMode = 'dark' | 'light';
export type EnvironmentTheme = 'simple' | 'carpet' | 'meadow' | 'waterfall' | 'lounge' | 'courtyard' | 'khatam';
export type PieceStyle =
  | 'gemstone'
  | 'crown'
  | 'wood'
  | 'marble'
  | 'brass'
  | 'nature'
  | 'neon'
  | 'classic';
export type ViewMode = '3d' | '2d';
export type TurnTimeLimit = 0 | 15 | 30 | 60;
export type AiStarterMode = 'HUMAN' | 'AI' | 'ALTERNATE';

export interface EnvironmentOption {
  id: EnvironmentTheme;
  label: string;
  subtitle: string;
  imagePath: string | null;
  fallbackGradient: string;
  recommendedBoard: BoardTheme;
  icon: DoozIconName;
}

export const ENVIRONMENT_THEMES: readonly EnvironmentOption[] = [
  {id:'courtyard',label:'حیاط فیروزه',subtitle:'کاشی و آرامش',imagePath:'/environments/courtyard.svg',fallbackGradient:'linear-gradient(135deg,#134a5b,#579b9a)',recommendedBoard:'tile',icon: 'arch'},
  {id:'khatam',label:'میز خاتم',subtitle:'گرمای چوب و نقش',imagePath:'/environments/khatam.svg',fallbackGradient:'linear-gradient(135deg,#4e3425,#b98a51)',recommendedBoard:'walnut',icon: 'sparkle'},
  {
    id: 'simple',
    label: 'ساده و مدرن',
    subtitle: 'مینیمال و خلوت',
    imagePath: null,
    fallbackGradient: 'linear-gradient(135deg, #0E0E0E 0%, #171717 50%, #202020 100%)',
    recommendedBoard: 'navy',
    icon: 'contrast',
  },
  {
    id: 'carpet',
    label: 'روی فرش ایرانی',
    subtitle: 'حیاط سنتی و سماور',
    imagePath: '/environments/carpet.svg',
    fallbackGradient: 'radial-gradient(ellipse at 25% 25%, #a54c52, #63263a 54%, #321b29)',
    recommendedBoard: 'walnut',
    icon: 'carpet',
  },
  {
    id: 'meadow',
    label: 'روی چمن باغ',
    subtitle: 'طبیعت سرسبز بهاری',
    imagePath: null,
    fallbackGradient: 'radial-gradient(ellipse at 24% 16%, #b8c675, #586e44 45%, #203e30 85%)',
    recommendedBoard: 'felt',
    icon: 'leaf',
  },
  {
    id: 'waterfall',
    label: 'کنار آبشار',
    subtitle: 'سنگ خزه‌ای و آب زلال',
    imagePath: null,
    fallbackGradient: 'radial-gradient(ellipse at 78% 15%, #a8d8d8, #527b88 41%, #193947 84%)',
    recommendedBoard: 'tile',
    icon: 'water',
  },
  {
    id: 'lounge',
    label: 'مبل و میز چوبی',
    subtitle: 'نشیمن گرم و دنج',
    imagePath: null,
    fallbackGradient: 'radial-gradient(ellipse at 28% 13%, #c49161, #764c36 45%, #2d2429 88%)',
    recommendedBoard: 'walnut',
    icon: 'lounge',
  },
];

export interface PieceStyleOption {
  id: PieceStyle;
  label: string;
  subtitle: string;
}

export const PIECE_STYLES: readonly PieceStyleOption[] = [
  { id: 'gemstone', label: 'یاقوت و فیروزه', subtitle: 'جواهر سنتی' },
  { id: 'crown', label: 'تاج شاهی', subtitle: 'ایستاده شطرنجی' },
  { id: 'wood', label: 'خاتم و عاج', subtitle: 'چوب منبت‌کاری' },
  { id: 'marble', label: 'مرمر و ابسیدین', subtitle: 'سنگ صیقلی' },
  { id: 'brass', label: 'برنز و نقره', subtitle: 'قلم‌زنی اصیل' },
  { id: 'nature', label: 'گل و سنگ یشم', subtitle: 'طبیعی و شاداب' },
  { id: 'neon', label: 'کریستال نئون', subtitle: 'منشور درخشان' },
  { id: 'classic', label: 'کلاسیک مدرن', subtitle: 'ساده و خطی' },
];

export type QuickEmoteId = 'salam' | 'nice' | 'wow' | 'gg' | 'hurry';

export interface QuickEmote {
  id: QuickEmoteId;
  label: string;
  icon: DoozIconName;
}

export const QUICK_EMOTES: readonly QuickEmote[] = [
  { id: 'salam', label: 'سلام!', icon: 'smile' },
  { id: 'nice', label: 'آفرین!', icon: 'thumbsUp' },
  { id: 'wow', label: 'عجب حرکتی!', icon: 'sparkle' },
  { id: 'gg', label: 'بازی خوبی بود', icon: 'gamepad' },
  { id: 'hurry', label: 'نوبت شماست!', icon: 'hourglass' },
];

export interface WinLineGeometry {
  cells: [number, number, number];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface WinResult {
  winner: Player;
  cells: [number, number, number];
  geometry: WinLineGeometry;
}

export interface MoveSnapshot {
  board: CellValue[];
  xQueue: number[];
  oQueue: number[];
  currentTurn: Player;
  moveCount: number;
  lastMoveIndex: number | null;
}

export interface RoundRecord {
  id: number;
  variant: GameVariant;
  winner: Player | 'DRAW';
  mode: GameMode;
  difficulty: Difficulty;
  rule: BoardRule;
  moves: number;
}

export interface ScoreBoard {
  X: number;
  O: number;
  draws: number;
}
