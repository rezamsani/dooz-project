export type Player = 'X' | 'O';
export type CellValue = Player | null;

export type GameVariant = 'THREE' | 'NINE' | 'TWELVE';
export type GameState = 'TITLE_MENU' | 'PLAYING' | 'ROUND_SUMMARY';
export type GameMode = 'AI' | 'LOCAL_2P' | 'ONLINE';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type BoardRule = 'CLASSIC' | 'INFINITE';
export type BoardTheme = 'navy' | 'walnut' | 'felt' | 'tile';
export type ColorMode = 'dark' | 'light';
export type EnvironmentTheme = 'simple' | 'carpet' | 'meadow' | 'waterfall' | 'lounge';
export type PieceStyle = 'gemstone' | 'wood' | 'nature' | 'classic';
export type ViewMode = '3d' | '2d';
export type TurnTimeLimit = 0 | 15 | 30 | 60;

export interface EnvironmentOption {
  id: EnvironmentTheme;
  label: string;
  subtitle: string;
  imagePath: string | null;
  fallbackGradient: string;
  recommendedBoard: BoardTheme;
  icon: string;
}

export const ENVIRONMENT_THEMES: readonly EnvironmentOption[] = [
  {
    id: 'simple',
    label: 'ساده و مدرن',
    subtitle: 'مینیمال و خلوت',
    imagePath: null,
    fallbackGradient: 'linear-gradient(135deg, #0F172A 0%, #134E4A 50%, #1E293B 100%)',
    recommendedBoard: 'navy',
    icon: 'contrast',
  },
  {
    id: 'carpet',
    label: 'روی فرش ایرانی',
    subtitle: 'حیاط سنتی و سماور',
    imagePath: '/assets/images/env_persian_carpet_1795438503418.jpg',
    fallbackGradient: 'linear-gradient(135deg, #6B1D2B 0%, #9E3328 50%, #C68B3C 100%)',
    recommendedBoard: 'walnut',
    icon: 'temple_buddhist',
  },
  {
    id: 'meadow',
    label: 'روی چمن باغ',
    subtitle: 'طبیعت سرسبز بهاری',
    imagePath: '/assets/images/env_lush_meadow_1795438449205.jpg',
    fallbackGradient: 'linear-gradient(135deg, #14532D 0%, #15803D 50%, #4ADE80 100%)',
    recommendedBoard: 'felt',
    icon: 'park',
  },
  {
    id: 'waterfall',
    label: 'کنار آبشار',
    subtitle: 'سنگ خزه‌ای و آب زلال',
    imagePath: '/assets/images/env_waterfall_stone_1795438448655.jpg',
    fallbackGradient: 'linear-gradient(135deg, #083344 0%, #0E7490 55%, #2DD4BF 100%)',
    recommendedBoard: 'tile',
    icon: 'water',
  },
  {
    id: 'lounge',
    label: 'مبل و میز چوبی',
    subtitle: 'نشیمن گرم و دنج',
    imagePath: '/assets/images/env_cozy_lounge_1795438446849.jpg',
    fallbackGradient: 'linear-gradient(135deg, #451A03 0%, #92400E 55%, #D97706 100%)',
    recommendedBoard: 'walnut',
    icon: 'weekend',
  },
];

export interface PieceStyleOption {
  id: PieceStyle;
  label: string;
  subtitle: string;
}

export const PIECE_STYLES: readonly PieceStyleOption[] = [
  { id: 'gemstone', label: 'یاقوت و فیروزه', subtitle: 'جواهر سنتی' },
  { id: 'wood', label: 'خاتم و عاج', subtitle: 'چوب منبت‌کاری' },
  { id: 'nature', label: 'گل و سنگ یشم', subtitle: 'طبیعی و شاداب' },
  { id: 'classic', label: 'کلاسیک مدرن', subtitle: 'ساده و خطی' },
];

export type QuickEmoteId = 'salam' | 'nice' | 'wow' | 'gg' | 'hurry';

export interface QuickEmote {
  id: QuickEmoteId;
  label: string;
}

export const QUICK_EMOTES: readonly QuickEmote[] = [
  { id: 'salam', label: 'سلام!' },
  { id: 'nice', label: 'آفرین!' },
  { id: 'wow', label: 'عجب حرکتی!' },
  { id: 'gg', label: 'بازی خوبی بود' },
  { id: 'hurry', label: 'نوبت شماست!' },
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
