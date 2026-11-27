import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { normalizeHex } from './color-palette';
import { DeviceStorage } from './device-storage';
import { PlayerRecord, MatchOutcome, emptyRecord, restoreRecord, ratingAfterMatch } from './player-score';
import {
  BoardTheme,
  ColorMode,
  Difficulty,
  ENVIRONMENT_THEMES,
  EnvironmentOption,
  EnvironmentTheme,
  PieceStyle,
  ViewMode,
} from './dooz.types';

export type PersistentStats = PlayerRecord;

const STATS_KEY = 'dooz_player_stats_v1';
const THEME_KEY = 'dooz_board_theme_v1';
const COLOR_MODE_KEY = 'dooz_color_mode_v1';
const ENV_KEY = 'dooz_environment_theme_v1';
const PIECE_STYLE_KEY = 'dooz_piece_style_v1';
const VIEW_MODE_KEY = 'dooz_view_mode_v1';
const CUSTOM_X_COLOR_KEY = 'dooz_custom_x_color_v1';
const CUSTOM_O_COLOR_KEY = 'dooz_custom_o_color_v1';
const CUSTOM_BOARD_COLOR_KEY = 'dooz_custom_board_color_v1';

@Injectable({ providedIn: 'root' })
export class PlayerStats {
  private readonly platformId = inject(PLATFORM_ID);
  readonly storage = inject(DeviceStorage);

  readonly stats = signal<PersistentStats>(emptyRecord());
  readonly lastEloDelta = signal<number | null>(null);
  readonly boardTheme = signal<BoardTheme>('navy');
  readonly colorMode = signal<ColorMode>('dark');
  readonly environment = signal<EnvironmentTheme>('simple');
  readonly pieceStyle = signal<PieceStyle>('classic');
  readonly viewMode = signal<ViewMode>('2d');
  readonly customXColor = signal<string | null>(null);
  readonly customOColor = signal<string | null>(null);
  readonly customBoardColor = signal<string | null>(null);

  readonly hasCustomColors = computed<boolean>(
    () =>
      this.customXColor() !== null ||
      this.customOColor() !== null ||
      this.customBoardColor() !== null,
  );

  readonly activeEnvironmentOption = computed<EnvironmentOption>(() => {
    const id = this.environment();
    return ENVIRONMENT_THEMES.find((item) => item.id === id) ?? ENVIRONMENT_THEMES[0];
  });

  readonly totalGames = computed<number>(() => {
    const s = this.stats();
    return s.wins + s.losses + s.draws;
  });

  readonly winRate = computed<number>(() => {
    const total = this.totalGames();
    if (total === 0) return 0;
    return Math.round((this.stats().wins / total) * 100);
  });

  readonly rankTitle = computed<string>(() => {
    const elo = this.stats().elo;
    if (elo >= 1550) return 'استاد بزرگ';
    if (elo >= 1400) return 'استاد دوز';
    if (elo >= 1260) return 'بازیکن حرفه‌ای';
    if (elo >= 1120) return 'بازیکن باتجربه';
    return 'تازه‌کار';
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFromStorage();
      this.applyColorModeClass(this.colorMode());
    }
  }

  setBoardTheme(theme: BoardTheme): void {
    this.boardTheme.set(theme);
    this.writeStorage(THEME_KEY, theme);
  }

  setColorMode(mode: ColorMode): void {
    this.colorMode.set(mode);
    this.writeStorage(COLOR_MODE_KEY, mode);
    if (isPlatformBrowser(this.platformId)) {
      this.applyColorModeClass(mode);
    }
  }

  toggleColorMode(): void {
    this.setColorMode(this.colorMode() === 'dark' ? 'light' : 'dark');
  }

  setEnvironment(env: EnvironmentTheme): void {
    this.environment.set(env);
    this.writeStorage(ENV_KEY, env);
    const preset = ENVIRONMENT_THEMES.find((item) => item.id === env);
    if (preset) {
      this.setBoardTheme(preset.recommendedBoard);
    }
  }

  setPieceStyle(style: PieceStyle): void {
    this.pieceStyle.set(style);
    this.writeStorage(PIECE_STYLE_KEY, style);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.writeStorage(VIEW_MODE_KEY, mode);
  }

  toggleViewMode(): void {
    this.setViewMode(this.viewMode() === '3d' ? '2d' : '3d');
  }

  setCustomColor(target: 'X' | 'O' | 'BOARD', hex: string | null): void {
    const clean = normalizeHex(hex);
    const key =
      target === 'X'
        ? CUSTOM_X_COLOR_KEY
        : target === 'O'
          ? CUSTOM_O_COLOR_KEY
          : CUSTOM_BOARD_COLOR_KEY;

    if (target === 'X') {
      this.customXColor.set(clean);
    } else if (target === 'O') {
      this.customOColor.set(clean);
    } else {
      this.customBoardColor.set(clean);
    }

    if (!isPlatformBrowser(this.platformId)) return;
    try {
      if (clean) {
        this.storage.setItem(key, clean);
      } else {
        this.storage.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
  }

  resetCustomColors(): void {
    this.setCustomColor('X', null);
    this.setCustomColor('O', null);
    this.setCustomColor('BOARD', null);
  }

  beginOnlineMatch(id: string): void {
    const current=this.stats();
    if (!this.storage.canReadStats() || current.processedMatchIds.includes(id) || current.pendingOnlineMatches.includes(id)) return;
    const updated={...current,pendingOnlineMatches:[...current.pendingOnlineMatches,id].slice(-10)};
    this.stats.set(updated); this.persistStats(updated);
  }

  recordMatchOutcome(outcome: MatchOutcome, opponentRating: number, matchId: string, mode: 'AI' | 'ONLINE' = 'AI'): boolean {
    const current=this.stats();
    if (!this.storage.canReadStats() || !matchId || current.processedMatchIds.includes(matchId)) return false;
    if (mode === 'ONLINE' && !current.pendingOnlineMatches.includes(matchId)) return false;
    const nextElo=ratingAfterMatch(current.elo,opponentRating,outcome);
    const delta=nextElo-current.elo;
    const nextStreak=outcome === 'WIN' ? current.currentStreak+1 : 0;
    const updated: PersistentStats={
      elo:nextElo,
      wins:current.wins+(outcome==='WIN'?1:0),
      losses:current.losses+(outcome==='LOSS'?1:0),
      draws:current.draws+(outcome==='DRAW'?1:0),
      currentStreak:nextStreak,bestStreak:Math.max(current.bestStreak,nextStreak),
      processedMatchIds:[...current.processedMatchIds,matchId].slice(-100),
      pendingOnlineMatches:current.pendingOnlineMatches.filter(id=>id!==matchId),
      recentResults:[...current.recentResults,{id:matchId,outcome,mode,rating:nextElo,delta,at:Date.now()}].slice(-12),
    };
    this.stats.set(updated); this.lastEloDelta.set(delta); this.persistStats(updated);
    return true;
  }

  getAiOpponentRating(difficulty: Difficulty): number {
    switch (difficulty) {
      case 'EASY':
        return 950;
      case 'MEDIUM':
        return 1200;
      case 'HARD':
        return 1480;
    }
  }

  resetStats(): void {
    const reset={...emptyRecord(),processedMatchIds:this.stats().processedMatchIds,pendingOnlineMatches:this.stats().pendingOnlineMatches};
    this.stats.set(reset);
    this.lastEloDelta.set(null);
    this.persistStats(reset);
  }

  private applyColorModeClass(mode: ColorMode): void {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  private writeStorage(key: string, value: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.storage.setItem(key, value);
    } catch {
      // Ignore storage errors
    }
  }

  private loadFromStorage(): void {
    try {
      const rawStats = this.storage.getItem(STATS_KEY);
      if (rawStats) {
        try { this.stats.set(restoreRecord(JSON.parse(rawStats))); } catch { /* Keep defaults for invalid JSON. */ }
      }

      const rawTheme = this.storage.getItem(THEME_KEY);
      if (
        rawTheme === 'navy' ||
        rawTheme === 'walnut' ||
        rawTheme === 'felt' ||
        rawTheme === 'tile' ||
        rawTheme === 'glass'
      ) {
        this.boardTheme.set(rawTheme);
      }

      const rawColorMode = this.storage.getItem(COLOR_MODE_KEY);
      if (rawColorMode === 'dark' || rawColorMode === 'light') {
        this.colorMode.set(rawColorMode);
      }

      const rawEnv = this.storage.getItem(ENV_KEY);
      if (
        rawEnv === 'courtyard' || rawEnv === 'khatam' || rawEnv === 'simple' ||
        rawEnv === 'carpet' ||
        rawEnv === 'meadow' ||
        rawEnv === 'waterfall' ||
        rawEnv === 'lounge'
      ) {
        this.environment.set(rawEnv);
      }

      const rawPiece = this.storage.getItem(PIECE_STYLE_KEY);
      if (
        rawPiece === 'gemstone' ||
        rawPiece === 'crown' ||
        rawPiece === 'wood' ||
        rawPiece === 'marble' ||
        rawPiece === 'brass' ||
        rawPiece === 'nature' ||
        rawPiece === 'neon' ||
        rawPiece === 'classic'
      ) {
        this.pieceStyle.set(rawPiece);
      }

      const rawView = this.storage.getItem(VIEW_MODE_KEY);
      if (rawView === '3d' || rawView === '2d') {
        this.viewMode.set(rawView);
      }

      this.customXColor.set(normalizeHex(this.storage.getItem(CUSTOM_X_COLOR_KEY)));
      this.customOColor.set(normalizeHex(this.storage.getItem(CUSTOM_O_COLOR_KEY)));
      this.customBoardColor.set(normalizeHex(this.storage.getItem(CUSTOM_BOARD_COLOR_KEY)));
    } catch {
      // Ignore corrupted local storage
    }
  }

  private persistStats(stats: PersistentStats): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.storage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
      // Ignore storage quota errors
    }
  }
}
