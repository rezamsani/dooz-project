import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  NgZone,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ColorPalettePicker } from './game/color-palette-picker';
import { CameraPreset, Dooz3DStage } from './game/dooz-3d-stage';
import { DoozBoard } from './game/dooz-board';
import {
  applyMove,
  checkWinner,
  chooseAiMove,
  createEmptyBoard,
  getOpponent,
  isBoardFull,
  toPersianDigits,
} from './game/dooz-engine';
import {
  BoardRule,
  BoardTheme,
  CellValue,
  ColorMode,
  Difficulty,
  ENVIRONMENT_THEMES,
  EnvironmentTheme,
  GameMode,
  GameState,
  GameVariant,
  MoveSnapshot,
  PIECE_STYLES,
  PieceStyle,
  Player,
  QUICK_EMOTES,
  QuickEmoteId,
  RoundRecord,
  ScoreBoard,
  TurnTimeLimit,
  ViewMode,
  WinResult,
} from './game/dooz.types';
import { MorrisBoard } from './game/morris-board';
import {
  MorrisAiDecision,
  applyMorrisMove,
  applyMorrisPlace,
  applyMorrisRemove,
  canPlayerFly,
  chooseMorrisAiDecision,
  countPiecesOnBoard,
  createInitialMorrisState,
  getValidDestinationsForNode,
} from './game/morris-engine';
import { MorrisSnapshot, MorrisState, MorrisVariant } from './game/morris.types';
import { OnlineClient } from './game/online-client';
import { RoomSnapshotDto } from './game/online.types';
import { PieceTray } from './game/piece-tray';
import { PlayerStats } from './game/player-stats';
import { SoundFx } from './game/sound-fx';
import { App as NativeApp } from '@capacitor/app';
import { RuntimeConfig } from './runtime-config';
import { PlayerProfile } from './game/player-profile';
import { ProfilePanel } from './game/profile-panel';
import { PlayerAvatarComponent } from './game/player-avatar';
import { PlayerAvatar } from './game/avatar';

function createPreviewMorrisState(variant: MorrisVariant): MorrisState {
  const base = createInitialMorrisState(variant, 'X', true);
  if (variant === 'NINE') {
    base.board[0] = 'X';
    base.board[1] = 'X';
    base.board[2] = 'X';
    base.board[9] = 'O';
    base.board[11] = 'O';
    base.board[14] = 'O';
    base.board[17] = 'X';
    base.board[21] = 'O';
    base.lastMill = [0, 1, 2];
  } else {
    base.board[0] = 'X';
    base.board[8] = 'X';
    base.board[16] = 'X';
    base.board[2] = 'O';
    base.board[10] = 'O';
    base.board[12] = 'O';
    base.board[20] = 'X';
    base.board[5] = 'O';
    base.lastMill = [0, 8, 16];
  }
  return base;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    MatIconModule,
    ReactiveFormsModule,
    DoozBoard,
    MorrisBoard,
    PieceTray,
    Dooz3DStage,
    ColorPalettePicker,
    ProfilePanel,
    PlayerAvatarComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(window:keydown)': 'onWindowKeyDown($event)',
    '(document:fullscreenchange)': 'onFullscreenChange()',
  },
})
export class App {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  readonly soundFx = inject(SoundFx);
  readonly playerStats = inject(PlayerStats);
  readonly onlineClient = inject(OnlineClient);
  readonly runtimeConfig = inject(RuntimeConfig);
  readonly profile = inject(PlayerProfile);
  private readonly zone = inject(NgZone);

  private aiTimerId: ReturnType<typeof setTimeout> | null = null;
  private turnIntervalId: ReturnType<typeof setInterval> | null = null;
  private replayIntervalId: ReturnType<typeof setInterval> | null = null;
  private copyToastTimerId: ReturnType<typeof setTimeout> | null = null;
  private roundCounter = 0;
  private lastOnlineTurnKey = '';
  private lastOnlineStatus: 'WAITING' | 'PLAYING' | 'FINISHED' | null = null;
  private wasNativeFullscreen = false;

  // Reactive Form controls for Online Lobby (strictly no ngModel)
  readonly playerNameControl = new FormControl<string>('', { nonNullable: true });
  readonly joinCodeControl = new FormControl<string>('', { nonNullable: true });

  readonly quickEmotes = QUICK_EMOTES;
  readonly environmentThemes = ENVIRONMENT_THEMES;
  readonly pieceStyles = PIECE_STYLES;

  // Game state machine
  readonly gameState = signal<GameState>('TITLE_MENU');
  readonly homeTab = signal<'play' | 'appearance' | 'stats'>('play');

  // Match settings
  readonly gameVariant = signal<GameVariant>('THREE');
  readonly gameMode = signal<GameMode>('AI');
  readonly difficulty = signal<Difficulty>('MEDIUM');
  readonly boardRule = signal<BoardRule>('CLASSIC');
  readonly allowFlying = signal<boolean>(true);
  readonly turnTimeLimit = signal<TurnTimeLimit>(0);
  readonly humanSymbol = signal<Player>('X');

  // Active 3-piece board state
  readonly board = signal<CellValue[]>(createEmptyBoard());
  readonly currentTurn = signal<Player>('X');
  readonly startingPlayer = signal<Player>('X');
  readonly xQueue = signal<number[]>([]);
  readonly oQueue = signal<number[]>([]);
  readonly moveCount = signal<number>(0);
  readonly lastMoveIndex = signal<number | null>(null);
  readonly isAiThinking = signal<boolean>(false);
  readonly history = signal<MoveSnapshot[]>([]);

  // Active Morris (9-piece & 12-piece) board state
  readonly morrisState = signal<MorrisState>(createInitialMorrisState('NINE', 'X', true));
  readonly morrisHistory = signal<MorrisSnapshot[]>([]);

  // Turn timer
  readonly remainingSeconds = signal<number>(0);
  readonly timeoutWinner = signal<Player | null>(null);

  // Smart hint highlights
  readonly threeHintIndex = signal<number | null>(null);
  readonly morrisHintDecision = signal<MorrisAiDecision | null>(null);

  // Step-by-step Match Replay
  readonly replayActive = signal<boolean>(false);
  readonly replayStep = signal<number>(0);
  readonly replayAutoPlaying = signal<boolean>(false);
  readonly threeReplayFrames = signal<MoveSnapshot[]>([]);
  readonly morrisReplayFrames = signal<MorrisState[]>([]);

  // Round result & scoreboard
  readonly winResult = signal<WinResult | null>(null);
  readonly isDraw = signal<boolean>(false);
  readonly scores = signal<ScoreBoard>({ X: 0, O: 0, draws: 0 });
  readonly recentRounds = signal<RoundRecord[]>([]);

  // Modals & UI feedback
  readonly showHelp = signal<boolean>(false);
  readonly isFullscreen = signal<boolean>(false);
  readonly cameraPreset = signal<CameraPreset>('TABLE');
  readonly dockCollapsed = signal<boolean>(false);
  readonly isDownloadingProject = signal<boolean>(false);
  readonly downloadError = signal<string | null>(null);
  readonly copiedToast = signal<string | null>(null);

  // Decorative static previews for the title menu
  readonly previewBoard: readonly CellValue[] = ['X', 'O', null, null, 'X', 'O', null, null, 'X'];
  readonly previewWin: WinResult = {
    winner: 'X',
    cells: [0, 4, 8],
    geometry: { cells: [0, 4, 8], x1: 34, y1: 34, x2: 266, y2: 266 },
  };
  readonly previewMorrisNine: MorrisState = createPreviewMorrisState('NINE');
  readonly previewMorrisTwelve: MorrisState = createPreviewMorrisState('TWELVE');

  // ---------- DERIVED STATE ----------

  readonly isOnlineMode = computed<boolean>(() => this.gameMode() === 'ONLINE');
  readonly onlineRoom = computed<RoomSnapshotDto | null>(() => this.onlineClient.room());
  readonly onlineRole = computed<Player | null>(() => this.onlineClient.yourRole());

  readonly isWaitingForOnlineOpponent = computed<boolean>(() => {
    const room = this.onlineRoom();
    return this.isOnlineMode() && room !== null && room.status === 'WAITING';
  });

  readonly isMorrisVariant = computed<boolean>(() => this.gameVariant() !== 'THREE');
  readonly is3DView = computed<boolean>(() => this.playerStats.viewMode() === '3d');
  readonly is3DPlay = computed<boolean>(
    () => this.is3DView() && this.gameState() !== 'TITLE_MENU',
  );
  readonly isFullscreenPlay = computed<boolean>(
    () => this.isFullscreen() && this.gameState() !== 'TITLE_MENU',
  );
  readonly activePreviewMorris = computed<MorrisState>(() =>
    this.gameVariant() === 'TWELVE' ? this.previewMorrisTwelve : this.previewMorrisNine,
  );

  readonly activeTurn = computed<Player>(() => {
    if (this.isOnlineMode()) {
      const room = this.onlineRoom();
      if (room) {
        return room.variant === 'THREE'
          ? room.threeTurn
          : (room.morrisState?.currentTurn ?? 'X');
      }
    }
    return this.isMorrisVariant() ? this.morrisState().currentTurn : this.currentTurn();
  });

  readonly activeMoveCount = computed<number>(() => {
    if (this.replayActive()) {
      return this.replayStep();
    }
    if (this.isOnlineMode()) {
      const room = this.onlineRoom();
      if (room) {
        return room.variant === 'THREE'
          ? room.threeMoveCount
          : (room.morrisState?.moveCount ?? 0);
      }
    }
    return this.isMorrisVariant() ? this.morrisState().moveCount : this.moveCount();
  });

  readonly activeWinner = computed<Player | null>(() => {
    if (this.isOnlineMode()) {
      return this.onlineRoom()?.winner ?? null;
    }
    if (this.timeoutWinner() !== null) {
      return this.timeoutWinner();
    }
    return this.isMorrisVariant() ? this.morrisState().winner : (this.winResult()?.winner ?? null);
  });

  readonly activeIsDraw = computed<boolean>(() => {
    if (this.isOnlineMode()) {
      return this.onlineRoom()?.isDraw ?? false;
    }
    return this.isMorrisVariant() ? this.morrisState().isDraw : this.isDraw();
  });

  readonly displayThreeBoard = computed<readonly CellValue[]>(() => {
    if (this.replayActive()) {
      const frames = this.threeReplayFrames();
      return frames[this.replayStep()]?.board ?? this.board();
    }
    if (this.isOnlineMode()) {
      return this.onlineRoom()?.threeBoard ?? this.board();
    }
    return this.board();
  });

  readonly displayThreeLastMove = computed<number | null>(() => {
    if (this.replayActive()) {
      const frames = this.threeReplayFrames();
      return frames[this.replayStep()]?.lastMoveIndex ?? null;
    }
    if (this.isOnlineMode()) {
      return this.onlineRoom()?.threeLastMove ?? null;
    }
    return this.lastMoveIndex();
  });

  readonly displayThreeWin = computed<WinResult | null>(() => {
    if (this.replayActive()) {
      const frames = this.threeReplayFrames();
      if (this.replayStep() < frames.length - 1) return null;
      return checkWinner(frames[this.replayStep()]?.board ?? []);
    }
    if (this.isOnlineMode()) {
      return this.onlineRoom()?.threeWin ?? null;
    }
    return this.winResult();
  });

  readonly displayMorrisState = computed<MorrisState>(() => {
    if (this.replayActive()) {
      const frames = this.morrisReplayFrames();
      return frames[this.replayStep()] ?? this.morrisState();
    }
    return this.morrisState();
  });

  readonly displayScores = computed<ScoreBoard>(() => {
    if (this.isOnlineMode()) {
      return this.onlineRoom()?.scores ?? { X: 0, O: 0, draws: 0 };
    }
    return this.scores();
  });

  readonly aiSymbol = computed<Player>(() => getOpponent(this.humanSymbol()));

  readonly isBoardLocked = computed<boolean>(() => {
    if (this.replayActive()) return true;
    if (this.gameState() !== 'PLAYING') return true;
    if (this.isOnlineMode()) {
      const room = this.onlineRoom();
      const role = this.onlineRole();
      if (!room || !role || room.status !== 'PLAYING') return true;
      return this.activeTurn() !== role;
    }
    if (this.isAiThinking()) return true;
    if (this.gameMode() === 'AI' && this.activeTurn() === this.aiSymbol()) return true;
    return false;
  });

  readonly expiringIndex = computed<number | null>(() => {
    if (
      this.replayActive() ||
      this.isMorrisVariant() ||
      this.boardRule() !== 'INFINITE' ||
      this.gameState() !== 'PLAYING'
    ) {
      return null;
    }
    const queue = this.isOnlineMode()
      ? this.activeTurn() === 'X'
        ? (this.onlineRoom()?.threeXQueue ?? [])
        : (this.onlineRoom()?.threeOQueue ?? [])
      : this.currentTurn() === 'X'
        ? this.xQueue()
        : this.oQueue();
    return queue.length >= 3 ? (queue[0] ?? null) : null;
  });

  readonly canUndo = computed<boolean>(() => {
    if (this.isOnlineMode() || this.replayActive()) return false;
    if (this.gameState() !== 'PLAYING' || this.isAiThinking()) return false;
    return this.isMorrisVariant()
      ? this.morrisHistory().length > 0
      : this.history().length > 0;
  });

  readonly canRequestHint = computed<boolean>(() => {
    if (this.isOnlineMode() || this.replayActive()) return false;
    return this.gameState() === 'PLAYING' && !this.isBoardLocked();
  });

  readonly canReplay = computed<boolean>(() => {
    if (this.isOnlineMode() || this.gameState() !== 'ROUND_SUMMARY') return false;
    return this.isMorrisVariant()
      ? this.morrisReplayFrames().length > 1
      : this.threeReplayFrames().length > 1;
  });

  readonly replayTotalSteps = computed<number>(() => {
    const count = this.isMorrisVariant()
      ? this.morrisReplayFrames().length
      : this.threeReplayFrames().length;
    return Math.max(0, count - 1);
  });

  readonly totalRounds = computed<number>(() => {
    const s = this.displayScores();
    return s.X + s.O + s.draws;
  });

  readonly playerXLabel = computed<string>(() => {
    if (this.isOnlineMode()) {
      const name = this.onlineRoom()?.players.X?.name ?? 'بازیکن X';
      return this.onlineRole() === 'X' ? `${name} (شما)` : name;
    }
    if (this.gameMode() === 'LOCAL_2P') return 'بازیکن X';
    return this.humanSymbol() === 'X' ? `${this.profile.name() || 'شما'} (X)` : 'ربات (X)';
  });

  readonly playerOLabel = computed<string>(() => {
    if (this.isOnlineMode()) {
      const name = this.onlineRoom()?.players.O?.name ?? 'در انتظار حریف';
      return this.onlineRole() === 'O' ? `${name} (شما)` : name;
    }
    if (this.gameMode() === 'LOCAL_2P') return 'بازیکن O';
    return this.humanSymbol() === 'O' ? `${this.profile.name() || 'شما'} (O)` : 'ربات (O)';
  });

  readonly morrisOnBoardX = computed<number>(() =>
    countPiecesOnBoard(this.displayMorrisState().board, 'X'),
  );

  readonly morrisOnBoardO = computed<number>(() =>
    countPiecesOnBoard(this.displayMorrisState().board, 'O'),
  );

  readonly threeOnBoardX = computed<number>(
    () => this.displayThreeBoard().filter((cell) => cell === 'X').length,
  );

  readonly threeOnBoardO = computed<number>(
    () => this.displayThreeBoard().filter((cell) => cell === 'O').length,
  );

  readonly trayXOnBoard = computed<number>(() =>
    this.isMorrisVariant() ? this.morrisOnBoardX() : this.threeOnBoardX(),
  );

  readonly trayOOnBoard = computed<number>(() =>
    this.isMorrisVariant() ? this.morrisOnBoardO() : this.threeOnBoardO(),
  );

  readonly trayXInHand = computed<number>(() => {
    if (this.isMorrisVariant()) {
      return this.displayMorrisState().inHand.X;
    }
    if (this.boardRule() === 'INFINITE') {
      return Math.max(0, 3 - this.threeOnBoardX());
    }
    return Math.max(0, 5 - this.threeOnBoardX());
  });

  readonly trayOInHand = computed<number>(() => {
    if (this.isMorrisVariant()) {
      return this.displayMorrisState().inHand.O;
    }
    if (this.boardRule() === 'INFINITE') {
      return Math.max(0, 3 - this.threeOnBoardO());
    }
    return Math.max(0, 4 - this.threeOnBoardO());
  });

  // Pieces of player X that have been knocked out / removed from the board
  readonly trayXOutCount = computed<number>(() => {
    if (this.isMorrisVariant()) {
      return this.displayMorrisState().captured.O;
    }
    if (this.boardRule() !== 'INFINITE') return 0;
    const moves = this.activeMoveCount();
    const xMoves =
      this.startingPlayer() === 'X' ? Math.ceil(moves / 2) : Math.floor(moves / 2);
    return Math.max(0, xMoves - this.threeOnBoardX());
  });

  // Pieces of player O that have been knocked out / removed from the board
  readonly trayOOutCount = computed<number>(() => {
    if (this.isMorrisVariant()) {
      return this.displayMorrisState().captured.X;
    }
    if (this.boardRule() !== 'INFINITE') return 0;
    const moves = this.activeMoveCount();
    const oMoves =
      this.startingPlayer() === 'O' ? Math.ceil(moves / 2) : Math.floor(moves / 2);
    return Math.max(0, oMoves - this.threeOnBoardO());
  });

  readonly showSidePieceTrays = computed<boolean>(
    () => this.isMorrisVariant() || this.boardRule() === 'INFINITE',
  );

  readonly morrisPhaseHint = computed<string>(() => {
    if (this.replayActive()) {
      return `در حال مشاهده بازپخش — حرکت ${toPersianDigits(this.replayStep())} از ${toPersianDigits(this.replayTotalSteps())}`;
    }
    const m = this.displayMorrisState();
    if (m.winner || m.isDraw) return '';
    if (this.isOnlineMode() && this.isBoardLocked()) {
      return 'در انتظار حرکت حریف آنلاین...';
    }
    if (m.action === 'REMOVE') {
      return 'دوز شد! روی یکی از مهره‌های خط‌چین طلایی حریف کلیک کنید تا حذف شود.';
    }
    if (m.action === 'PLACE') {
      return 'مرحله ۱ (چیدن مهره‌ها): روی یکی از نقاط خالی صفحه کلیک کنید تا مهره بگذارید.';
    }
    if (m.selectedNode !== null) {
      return 'مهره انتخاب شد — حالا روی یکی از خانه‌های مقصد سبز کلیک کنید تا جابه‌جا شود.';
    }
    if (canPlayerFly(m, m.currentTurn)) {
      return 'مرحله پرش آزاد (۳ مهره): یکی از مهره‌های حلقه‌دار خود را انتخاب کرده و به هر خانه خالی ببرید.';
    }
    return 'مرحله ۲ (حرکت مهره‌ها): روی یکی از مهره‌های حلقه‌دار خود کلیک کنید و سپس خانه سبز مجاور را بزنید.';
  });

  readonly statusHeadline = computed<string>(() => {
    if (this.replayActive()) {
      return 'بازپخش حرکت‌به‌حرکت بازی';
    }
    if (this.isWaitingForOnlineOpponent()) {
      return 'در انتظار پیوستن حریف به اتاق...';
    }
    const winner = this.activeWinner();
    if (winner) {
      if (this.isOnlineMode()) {
        return winner === this.onlineRole() ? 'شما برنده شدید!' : 'حریف برنده شد';
      }
      if (this.gameMode() === 'AI') {
        return winner === this.humanSymbol() ? 'شما برنده شدید!' : 'ربات برنده شد';
      }
      return `بازیکن ${winner} برنده شد!`;
    }
    if (this.activeIsDraw()) {
      return 'بازی مساوی شد';
    }
    if (this.isAiThinking()) {
      if (this.isMorrisVariant() && this.morrisState().action === 'REMOVE') {
        return 'ربات دوز کرد — انتخاب مهره برای حذف...';
      }
      return 'نوبت ربات — در حال انتخاب حرکت...';
    }

    const turn = this.activeTurn();
    if (this.isOnlineMode()) {
      const isYours = turn === this.onlineRole();
      if (this.isMorrisVariant() && this.morrisState().action === 'REMOVE') {
        return isYours ? 'دوز شد! یک مهره حریف را حذف کنید' : 'حریف در حال حذف یک مهره است...';
      }
      return isYours ? `نوبت شما (${turn})` : `نوبت حریف (${turn})`;
    }

    if (this.isMorrisVariant() && this.morrisState().action === 'REMOVE') {
      if (this.gameMode() === 'AI') {
        return turn === this.humanSymbol()
          ? 'دوز شد! یک مهره ربات را حذف کنید'
          : 'ربات در حال حذف مهره...';
      }
      return `دوز شد! بازیکن ${turn} یک مهره حذف کند`;
    }

    if (this.gameMode() === 'AI') {
      return turn === this.humanSymbol() ? `نوبت شما (${turn})` : `نوبت ربات (${turn})`;
    }
    return `نوبت بازیکن ${turn}`;
  });

  readonly statusIcon = computed<string>(() => {
    if (this.replayActive()) return 'history';
    if (this.isWaitingForOnlineOpponent()) return 'hourglass_empty';
    const winner = this.activeWinner();
    if (winner) {
      if (this.gameMode() === 'AI' && winner !== this.humanSymbol()) return 'smart_toy';
      if (this.isOnlineMode() && winner !== this.onlineRole()) return 'sports_score';
      return 'emoji_events';
    }
    if (this.activeIsDraw()) return 'handshake';
    if (this.isAiThinking()) return 'hourglass_top';
    if (this.isMorrisVariant() && this.morrisState().action === 'REMOVE') return 'auto_awesome';
    return this.activeTurn() === 'X' ? 'close' : 'radio_button_unchecked';
  });

  readonly difficultyLabel = computed<string>(() => {
    switch (this.difficulty()) {
      case 'EASY':
        return 'آسان';
      case 'MEDIUM':
        return 'متوسط';
      case 'HARD':
        return 'سخت';
    }
  });

  readonly variantTitle = computed<string>(() => {
    switch (this.gameVariant()) {
      case 'THREE':
        return this.boardRule() === 'CLASSIC' ? 'دوز ۳ تایی (کلاسیک)' : 'دوز ۳ تایی (بی‌نهایت)';
      case 'NINE':
        return 'دوز ۹ تایی';
      case 'TWELVE':
        return 'دوز ۱۲ تایی';
    }
  });

  readonly formattedTimer = computed<string>(() => {
    const secs = this.remainingSeconds();
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    const padded = rem < 10 ? `0${rem}` : String(rem);
    return toPersianDigits(`${mins}:${padded}`);
  });

  readonly summaryDescription = computed<string>(() => {
    if (this.isOnlineMode()) {
      const room = this.onlineRoom();
      if (room?.endReason === 'RESIGN') {
        return `بازی با تسلیم شدن حریف به سود مهره ${room.winner} پایان یافت.`;
      }
      if (room?.endReason === 'TIMEOUT') {
        return `زمان حرکت به پایان رسید و مهره ${room.winner} برنده شد.`;
      }
      if (room?.endReason === 'DRAW_AGREED') {
        return 'هر دو بازیکن روی مساوی توافق کردند.';
      }
    }
    if (this.timeoutWinner() !== null) {
      return `زمان حرکت به پایان رسید و مهره ${this.timeoutWinner()} برنده شد.`;
    }
    const winner = this.activeWinner();
    if (!winner) {
      return 'تمامی خانه‌ها پر شد و بازی مساوی گردید.';
    }
    if (this.isMorrisVariant()) {
      const reason = this.morrisState().winReason;
      if (reason === 'BLOCKED') {
        return `مهره‌های حریف کاملاً قفل شدند و مهره ${winner} برنده شد.`;
      }
      return `تعداد مهره‌های حریف به کمتر از ۳ رسید و مهره ${winner} برنده شد.`;
    }
    return `دست با پیروزی مهره ${winner} به پایان رسید.`;
  });

  readonly formattedEloDelta = computed<string | null>(() => {
    const delta = this.playerStats.lastEloDelta();
    if (delta === null) return null;
    if (delta > 0) return `+${toPersianDigits(delta)}`;
    if (delta < 0) return `-${toPersianDigits(Math.abs(delta))}`;
    return '۰';
  });

  readonly activeEmoteLabel = computed<string | null>(() => {
    const em = this.onlineClient.activeEmote();
    if (!em) return null;
    const found = QUICK_EMOTES.find((item) => item.id === em.emoteId);
    return found ? `${em.senderName}: «${found.label}»` : null;
  });

  readonly hasVotedRematch = computed<boolean>(() => {
    const role = this.onlineRole();
    const votes = this.onlineRoom()?.rematchVotes ?? [];
    return role !== null && votes.includes(role);
  });

  readonly opponentOfferedDraw = computed<boolean>(() => {
    const role = this.onlineRole();
    const from = this.onlineRoom()?.drawOfferFrom ?? null;
    return role !== null && from !== null && from !== role;
  });

  readonly youOfferedDraw = computed<boolean>(() => {
    const role = this.onlineRole();
    const from = this.onlineRoom()?.drawOfferFrom ?? null;
    return role !== null && from === role;
  });

  constructor() {
    if (this.runtimeConfig.isNative && isPlatformBrowser(this.platformId)) {
      void NativeApp.addListener('backButton', () => {
        this.zone.run(() => this.onNativeBack());
      }).then((listener) => {
        if (this.destroyRef.destroyed) {
          void listener.remove();
        } else {
          this.destroyRef.onDestroy(() => { void listener.remove(); });
        }
      });
    }
    this.onlineClient.onRoomState((room, role) => {
      this.syncFromOnlineRoom(room, role);
    });

    if (isPlatformBrowser(this.platformId)) {
      const params = new URLSearchParams(window.location.search);
      const invitedCode = params.get('room');
      if (invitedCode && /^[A-Za-z2-9]{5}$/.test(invitedCode.trim())) {
        this.gameMode.set('ONLINE');
        this.joinCodeControl.setValue(invitedCode.trim().toUpperCase());
      }
    }

    this.destroyRef.onDestroy(() => {
      this.clearAiTimer();
      this.stopTurnTimer();
      this.stopReplayAutoPlay();
      if (this.copyToastTimerId !== null) {
        clearTimeout(this.copyToastTimerId);
      }
      if (isPlatformBrowser(this.platformId) && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {
          // Ignore exit errors during unmount
        });
      }
    });
  }

  formatNumber(n: number): string {
    return toPersianDigits(n);
  }

  onNativeBack(): void {
    if (this.showHelp()) this.closeHelp();
    else if (this.replayActive()) this.exitReplay();
    else if (this.isFullscreen()) this.exitFullscreen();
    else if (this.gameState() !== 'TITLE_MENU') this.goToTitleMenu();
    else if (this.homeTab() !== 'play') this.homeTab.set('play');
    else void NativeApp.minimizeApp();
  }

  setGameVariant(variant: GameVariant): void {
    this.soundFx.playClick();
    this.gameVariant.set(variant);
  }

  setGameMode(mode: GameMode): void {
    this.soundFx.playClick();
    if (this.gameMode() === 'ONLINE' && mode !== 'ONLINE') {
      this.onlineClient.leaveRoom();
    }
    this.gameMode.set(mode);
  }

  setDifficulty(level: Difficulty): void {
    this.soundFx.playClick();
    this.difficulty.set(level);
  }

  setBoardRule(rule: BoardRule): void {
    this.soundFx.playClick();
    this.boardRule.set(rule);
  }

  setAllowFlying(allow: boolean): void {
    this.soundFx.playClick();
    this.allowFlying.set(allow);
  }

  setTurnTimeLimit(limit: TurnTimeLimit): void {
    this.soundFx.playClick();
    this.turnTimeLimit.set(limit);
  }

  setBoardTheme(theme: BoardTheme): void {
    this.soundFx.playClick();
    this.playerStats.setBoardTheme(theme);
  }

  setColorMode(mode: ColorMode): void {
    this.soundFx.playClick();
    this.playerStats.setColorMode(mode);
  }

  toggleColorMode(): void {
    this.soundFx.playClick();
    this.playerStats.toggleColorMode();
  }

  setEnvironment(env: EnvironmentTheme): void {
    this.soundFx.playClick();
    this.playerStats.setEnvironment(env);
  }

  setPieceStyle(style: PieceStyle): void {
    this.soundFx.playClick();
    this.playerStats.setPieceStyle(style);
  }

  setViewMode(mode: ViewMode): void {
    this.soundFx.playClick();
    this.playerStats.setViewMode(mode);
  }

  toggleViewMode(): void {
    this.soundFx.playClick();
    this.playerStats.toggleViewMode();
  }

  setCameraPreset(preset: CameraPreset): void {
    this.soundFx.playClick();
    this.cameraPreset.set(preset);
  }

  toggleDock(): void {
    this.soundFx.playClick();
    this.dockCollapsed.update((v) => !v);
  }

  setHumanSymbol(symbol: Player): void {
    this.soundFx.playClick();
    this.humanSymbol.set(symbol);
  }

  goToTitleMenu(): void {
    this.clearAiTimer();
    this.stopTurnTimer();
    this.exitReplay();
    this.clearHints();
    if (this.isOnlineMode() && this.onlineRoom()) {
      this.onlineClient.leaveRoom();
    }
    this.soundFx.playClick();
    this.showHelp.set(false);
    this.gameState.set('TITLE_MENU');
    this.homeTab.set('play');
  }

  quickLaunchVariant(variant: GameVariant): void {
    this.showHelp.set(false);
    if (this.isOnlineMode()) {
      this.onlineClient.leaveRoom();
      this.gameMode.set('AI');
    }
    this.gameVariant.set(variant);
    this.startGame();
  }

  openHelp(): void {
    this.soundFx.playClick();
    this.showHelp.set(true);
  }

  closeHelp(): void {
    this.soundFx.playClick();
    this.showHelp.set(false);
  }

  // ---------- FULLSCREEN / CINEMA MODE ----------

  toggleFullscreen(): void {
    if (this.isFullscreen()) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  enterFullscreen(): void {
    this.soundFx.playClick();
    this.isFullscreen.set(true);

    if (!isPlatformBrowser(this.platformId)) return;
    const root = document.documentElement;
    if (document.fullscreenEnabled && typeof root.requestFullscreen === 'function') {
      void root
        .requestFullscreen()
        .then(() => {
          this.wasNativeFullscreen = true;
        })
        .catch(() => {
          // Gracefully remain in distraction-free cinema fullscreen if embedded iframe blocks native API
          this.wasNativeFullscreen = false;
        });
    }
  }

  exitFullscreen(): void {
    this.soundFx.playClick();
    this.isFullscreen.set(false);
    this.wasNativeFullscreen = false;

    if (!isPlatformBrowser(this.platformId)) return;
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      void document.exitFullscreen().catch(() => {
        // Ignore browser exit errors
      });
    }
  }

  onFullscreenChange(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const active = Boolean(document.fullscreenElement);
    if (active) {
      this.wasNativeFullscreen = true;
      this.isFullscreen.set(true);
    } else if (this.wasNativeFullscreen) {
      this.wasNativeFullscreen = false;
      this.isFullscreen.set(false);
    }
  }

  // ---------- ONLINE MULTIPLAYER ACTIONS ----------

  createOnlineRoom(): void {
    this.soundFx.playClick();
    this.gameMode.set('ONLINE');
    this.lastOnlineStatus = null;
    this.lastOnlineTurnKey = '';
    this.onlineClient.createRoom({
      playerName: this.playerNameControl.value.trim() || this.profile.name() || 'بازیکن ۱',
      avatar: this.profile.avatar(),
      variant: this.gameVariant(),
      boardRule: this.boardRule(),
      allowFlying: this.allowFlying(),
      turnTimeLimit: this.turnTimeLimit(),
    });
  }

  joinOnlineRoom(): void {
    this.soundFx.playClick();
    const code = this.joinCodeControl.value.trim().toUpperCase();
    this.joinCodeControl.setValue(code);
    this.gameMode.set('ONLINE');
    this.lastOnlineStatus = null;
    this.lastOnlineTurnKey = '';
    this.onlineClient.joinRoom(code, this.playerNameControl.value.trim() || this.profile.name() || 'بازیکن ۲', this.profile.avatar());
  }

  avatarForPlayer(player: Player): PlayerAvatar {
    if (this.isOnlineMode()) return this.onlineRoom()?.players[player]?.avatar ?? {cartoon: player === 'X' ? 'mint' : 'sky', gravatarHash:null};
    if (this.gameMode() === 'AI' || player === 'X') return this.profile.avatar();
    return {cartoon:'sky',gravatarHash:null};
  }

  robotForPlayer(player: Player): Difficulty | null {
    return this.gameMode() === 'AI' && player !== this.humanSymbol() ? this.difficulty() : null;
  }

  async copyRoomCode(): Promise<void> {
    const code = this.onlineRoom()?.code;
    if (!code || !isPlatformBrowser(this.platformId)) return;
    this.soundFx.playClick();
    await this.copyToClipboard(code, 'کد اتاق کپی شد');
  }

  async copyInviteLink(): Promise<void> {
    const code = this.onlineRoom()?.code;
    if (!code || !isPlatformBrowser(this.platformId)) return;
    this.soundFx.playClick();
    const url = this.runtimeConfig.inviteLink(code);
    await this.copyToClipboard(url ?? code, url ? 'لینک دعوت کپی شد' : 'کد اتاق کپی شد');
  }

  sendQuickEmote(emoteId: QuickEmoteId): void {
    if (!this.isOnlineMode() || !this.onlineRoom()) return;
    this.soundFx.playClick();
    this.onlineClient.sendEmote(emoteId);
  }

  resignOnlineMatch(): void {
    if (!this.isOnlineMode()) return;
    this.soundFx.playClick();
    this.onlineClient.resign();
  }

  offerOnlineDraw(): void {
    if (!this.isOnlineMode()) return;
    this.soundFx.playClick();
    this.onlineClient.offerDraw();
  }

  respondOnlineDraw(accept: boolean): void {
    if (!this.isOnlineMode()) return;
    this.soundFx.playClick();
    this.onlineClient.respondDraw(accept);
  }

  requestOnlineRematch(): void {
    if (!this.isOnlineMode()) return;
    this.soundFx.playClick();
    this.onlineClient.requestRematch();
  }

  // ---------- DOWNLOAD PROJECT ZIP ----------

  async downloadProjectZip(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.isDownloadingProject()) {
      return;
    }

    this.soundFx.playClick();
    this.isDownloadingProject.set(true);
    this.downloadError.set(null);

    try {
      const response = await fetch('/api/download-project');
      if (!response.ok) {
        throw new Error('download_failed');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'dooz-project.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    } catch {
      this.downloadError.set('دانلود فایل پروژه انجام نشد. دوباره تلاش کنید.');
    } finally {
      this.isDownloadingProject.set(false);
    }
  }

  // ---------- OFFLINE MATCH FLOW ----------

  startGame(): void {
    if (this.isOnlineMode()) {
      this.createOnlineRoom();
      return;
    }
    this.soundFx.playClick();
    this.startingPlayer.set('X');
    this.resetRoundState('X');
  }

  nextRound(): void {
    if (this.isOnlineMode()) {
      this.requestOnlineRematch();
      return;
    }
    this.soundFx.playClick();
    const nextStarter: Player =
      this.gameMode() === 'LOCAL_2P' ? getOpponent(this.startingPlayer()) : 'X';
    this.startingPlayer.set(nextStarter);
    this.resetRoundState(nextStarter);
  }

  restartCurrentRound(): void {
    if (this.isOnlineMode()) {
      this.requestOnlineRematch();
      return;
    }
    this.soundFx.playClick();
    this.resetRoundState(this.startingPlayer());
  }

  clearScores(): void {
    this.soundFx.playClick();
    this.scores.set({ X: 0, O: 0, draws: 0 });
    this.recentRounds.set([]);
    this.roundCounter = 0;
  }

  // ---------- SMART HINT ----------

  requestSmartHint(): void {
    if (!this.canRequestHint()) return;
    this.soundFx.playHint();

    if (this.isMorrisVariant()) {
      const state = this.morrisState();
      const decision = chooseMorrisAiDecision(state, state.currentTurn, 'HARD');
      this.morrisHintDecision.set(decision);
      if (decision && decision.type === 'MOVE') {
        this.morrisState.set({ ...state, selectedNode: decision.from });
      }
      return;
    }

    const bestCell = chooseAiMove(
      this.board(),
      this.xQueue(),
      this.oQueue(),
      this.currentTurn(),
      'HARD',
      this.boardRule(),
    );
    this.threeHintIndex.set(bestCell);
  }

  // ---------- STEP-BY-STEP REPLAY ----------

  startReplay(): void {
    if (!this.canReplay()) return;
    this.soundFx.playClick();
    this.replayActive.set(true);
    this.replayStep.set(0);
    this.stopReplayAutoPlay();
  }

  exitReplay(): void {
    this.stopReplayAutoPlay();
    this.replayActive.set(false);
    this.replayStep.set(0);
  }

  replayStepTo(step: number): void {
    const max = this.replayTotalSteps();
    const clamped = Math.max(0, Math.min(max, step));
    this.replayStep.set(clamped);
    if (clamped >= max) {
      this.stopReplayAutoPlay();
    }
  }

  toggleReplayAutoPlay(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.replayAutoPlaying()) {
      this.stopReplayAutoPlay();
      return;
    }
    if (this.replayStep() >= this.replayTotalSteps()) {
      this.replayStep.set(0);
    }
    this.replayAutoPlaying.set(true);
    this.replayIntervalId = setInterval(() => {
      const next = this.replayStep() + 1;
      if (next > this.replayTotalSteps()) {
        this.stopReplayAutoPlay();
        return;
      }
      this.replayStep.set(next);
      this.soundFx.playClick();
    }, 800);
  }

  // ---------- BOARD CLICK HANDLERS ----------

  onCellSelected(index: number): void {
    if (this.isMorrisVariant() || this.isBoardLocked()) return;
    if (this.displayThreeBoard()[index] !== null) return;

    this.clearHints();
    if (this.isOnlineMode()) {
      this.onlineClient.sendThreeMove(index);
      return;
    }
    this.commitThreeMove(index);
  }

  onMorrisNodeSelected(nodeId: number): void {
    if (!this.isMorrisVariant() || this.isBoardLocked()) return;

    const current = this.morrisState();
    if (current.winner || current.isDraw) return;

    if (current.action === 'PLACE') {
      if (current.board[nodeId] !== null) return;
      this.clearHints();
      if (this.isOnlineMode()) {
        this.onlineClient.sendMorrisPlace(nodeId);
        return;
      }
      this.saveMorrisSnapshot(current);
      const next = applyMorrisPlace(current, nodeId);
      if (next) {
        this.applyMorrisTransition(current, next);
      }
      return;
    }

    if (current.action === 'REMOVE') {
      this.clearHints();
      if (this.isOnlineMode()) {
        this.onlineClient.sendMorrisRemove(nodeId);
        return;
      }
      this.saveMorrisSnapshot(current);
      const next = applyMorrisRemove(current, nodeId);
      if (next) {
        this.applyMorrisTransition(current, next, true);
      }
      return;
    }

    // MOVE / FLYING phase
    const owner = current.board[nodeId];
    if (owner === current.currentTurn) {
      if (getValidDestinationsForNode(current, nodeId).length === 0) return;
      this.soundFx.playClick();
      const nextSelected = current.selectedNode === nodeId ? null : nodeId;
      this.morrisState.set({ ...current, selectedNode: nextSelected });
      return;
    }

    if (owner === null && current.selectedNode !== null) {
      this.clearHints();
      if (this.isOnlineMode()) {
        this.onlineClient.sendMorrisMove(current.selectedNode, nodeId);
        return;
      }
      this.saveMorrisSnapshot(current);
      const next = applyMorrisMove(current, current.selectedNode, nodeId);
      if (next) {
        this.applyMorrisTransition(current, next);
      }
    }
  }

  undoLastMove(): void {
    if (!this.canUndo()) return;

    this.clearAiTimer();
    this.clearHints();

    if (this.isMorrisVariant()) {
      const snaps = this.morrisHistory();
      if (snaps.length === 0) return;

      let targetIndex = snaps.length - 1;
      if (this.gameMode() === 'AI') {
        for (let i = snaps.length - 1; i >= 0; i--) {
          if (snaps[i].currentTurn === this.humanSymbol()) {
            targetIndex = i;
            break;
          }
        }
      }

      const snap = snaps[targetIndex];
      const currentVariant: MorrisVariant =
        this.gameVariant() === 'TWELVE' ? 'TWELVE' : 'NINE';
      const restored: MorrisState = {
        variant: currentVariant,
        allowFlying: this.allowFlying(),
        board: [...snap.board],
        inHand: { ...snap.inHand },
        captured: { ...snap.captured },
        currentTurn: snap.currentTurn,
        action: snap.action,
        selectedNode: null,
        lastMill: snap.lastMill,
        lastMovedNode: snap.lastMovedNode,
        moveCount: snap.moveCount,
        winner: null,
        isDraw: false,
        winReason: null,
      };
      this.morrisState.set(restored);
      this.morrisHistory.set(snaps.slice(0, targetIndex));
      this.morrisReplayFrames.update((frames) => frames.slice(0, targetIndex + 1));
      this.resetTurnTimer();
      this.soundFx.playUndo();
      return;
    }

    const snapshots = this.history();
    if (snapshots.length === 0) return;

    let targetIndex = snapshots.length - 1;
    if (this.gameMode() === 'AI') {
      for (let i = snapshots.length - 1; i >= 0; i--) {
        if (snapshots[i].currentTurn === this.humanSymbol()) {
          targetIndex = i;
          break;
        }
      }
    }

    const snap = snapshots[targetIndex];
    this.board.set([...snap.board]);
    this.xQueue.set([...snap.xQueue]);
    this.oQueue.set([...snap.oQueue]);
    this.currentTurn.set(snap.currentTurn);
    this.moveCount.set(snap.moveCount);
    this.lastMoveIndex.set(snap.lastMoveIndex);
    this.history.set(snapshots.slice(0, targetIndex));
    this.threeReplayFrames.update((frames) => frames.slice(0, targetIndex + 1));
    this.winResult.set(null);
    this.isDraw.set(false);
    this.resetTurnTimer();
    this.soundFx.playUndo();
  }

  onWindowKeyDown(event: KeyboardEvent): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Ignore shortcuts while typing in inputs
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    if (event.key === 'Escape') {
      if (this.showHelp()) {
        this.closeHelp();
        return;
      }
      if (this.replayActive()) {
        this.exitReplay();
        return;
      }
      if (this.isFullscreen()) {
        this.exitFullscreen();
        return;
      }
    }

    if (this.showHelp() || this.replayActive()) return;

    const lowerKey = event.key.toLowerCase();
    if (lowerKey === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.toggleFullscreen();
      return;
    }

    if (this.gameState() === 'PLAYING' || this.gameState() === 'ROUND_SUMMARY') {
      const lower = lowerKey;
      if (lower === 'r' && !this.isOnlineMode()) {
        event.preventDefault();
        if (this.gameState() === 'ROUND_SUMMARY') {
          this.nextRound();
        } else {
          this.restartCurrentRound();
        }
        return;
      }

      if (lower === 'z' && this.canUndo()) {
        event.preventDefault();
        this.undoLastMove();
        return;
      }

      if (lower === 'h' && this.canRequestHint()) {
        event.preventDefault();
        this.requestSmartHint();
        return;
      }

      if (!this.isMorrisVariant() && this.gameState() === 'PLAYING' && !this.isBoardLocked()) {
        const digit = this.parseKeyDigit(event.key);
        if (digit !== null && digit >= 1 && digit <= 9) {
          event.preventDefault();
          this.onCellSelected(digit - 1);
        }
      }
    }
  }

  getRoundResultText(record: RoundRecord): string {
    if (record.winner === 'DRAW') return 'مساوی';
    return `برد ${record.winner}`;
  }

  getRoundMetaText(record: RoundRecord): string {
    let variantLabel: string;
    if (record.variant === 'NINE') {
      variantLabel = '۹ تایی';
    } else if (record.variant === 'TWELVE') {
      variantLabel = '۱۲ تایی';
    } else {
      variantLabel = record.rule === 'CLASSIC' ? '۳ تایی کلاسیک' : '۳ تایی بی‌نهایت';
    }
    return `${variantLabel} · ${toPersianDigits(record.moves)} حرکت`;
  }

  // ---------- INTERNAL SYNC & ENGINE HELPERS ----------

  private syncFromOnlineRoom(room: RoomSnapshotDto, role: Player): void {
    this.gameMode.set('ONLINE');
    this.gameVariant.set(room.variant);
    this.boardRule.set(room.boardRule);
    this.allowFlying.set(room.allowFlying);
    this.turnTimeLimit.set(room.turnTimeLimit);
    this.clearHints();
    this.exitReplay();

    if (room.variant !== 'THREE' && room.morrisState) {
      const prevMorris = this.morrisState();
      this.morrisState.set({ ...room.morrisState, selectedNode: null });
      if (room.status === 'PLAYING' && room.morrisState.moveCount > prevMorris.moveCount) {
        if (room.morrisState.action === 'REMOVE') {
          this.soundFx.playMill();
        } else {
          this.soundFx.playMoveX();
        }
      }
    } else if (room.variant === 'THREE') {
      if (room.status === 'PLAYING' && room.threeMoveCount > this.moveCount()) {
        this.soundFx.playMoveX();
      }
      this.board.set([...room.threeBoard]);
      this.xQueue.set([...room.threeXQueue]);
      this.oQueue.set([...room.threeOQueue]);
      this.currentTurn.set(room.threeTurn);
      this.moveCount.set(room.threeMoveCount);
      this.lastMoveIndex.set(room.threeLastMove);
      this.winResult.set(room.threeWin);
      this.isDraw.set(room.threeDraw);
    }

    if (room.status === 'FINISHED') {
      this.gameState.set('ROUND_SUMMARY');
      this.stopTurnTimer();
      if (this.lastOnlineStatus !== 'FINISHED') {
        if (room.winner) {
          this.soundFx.playWin();
          const outcome = room.winner === role ? 'WIN' : 'LOSS';
          this.playerStats.recordMatchOutcome(outcome, 1240);
        } else if (room.isDraw) {
          this.soundFx.playDraw();
          this.playerStats.recordMatchOutcome('DRAW', 1240);
        }
      }
    } else {
      this.gameState.set('PLAYING');
      const turnKey = `${room.code}:${room.status}:${
        room.variant === 'THREE'
          ? `${room.threeTurn}:${room.threeMoveCount}`
          : `${room.morrisState?.currentTurn}:${room.morrisState?.action}:${room.morrisState?.moveCount}`
      }`;
      if (room.status === 'PLAYING' && turnKey !== this.lastOnlineTurnKey) {
        this.lastOnlineTurnKey = turnKey;
        this.resetTurnTimer();
      } else if (room.status === 'WAITING') {
        this.stopTurnTimer();
      }
    }

    this.lastOnlineStatus = room.status;
  }

  private parseKeyDigit(key: string): number | null {
    if (key >= '1' && key <= '9') return Number(key);
    const persianMap: Record<string, number> = {
      '۱': 1,
      '۲': 2,
      '۳': 3,
      '۴': 4,
      '۵': 5,
      '۶': 6,
      '۷': 7,
      '۸': 8,
      '۹': 9,
    };
    return persianMap[key] ?? null;
  }

  private clearHints(): void {
    this.threeHintIndex.set(null);
    this.morrisHintDecision.set(null);
  }

  private resetRoundState(starter: Player): void {
    this.clearAiTimer();
    this.stopTurnTimer();
    this.exitReplay();
    this.clearHints();
    this.winResult.set(null);
    this.isDraw.set(false);
    this.timeoutWinner.set(null);
    this.isAiThinking.set(false);
    this.playerStats.lastEloDelta.set(null);
    this.gameState.set('PLAYING');

    if (this.isMorrisVariant()) {
      const mv: MorrisVariant = this.gameVariant() === 'TWELVE' ? 'TWELVE' : 'NINE';
      const initial = createInitialMorrisState(mv, starter, this.allowFlying());
      this.morrisState.set(initial);
      this.morrisHistory.set([]);
      this.morrisReplayFrames.set([initial]);
      this.resetTurnTimer();
      if (this.gameMode() === 'AI' && starter === this.aiSymbol()) {
        this.scheduleMorrisAiTurn();
      }
      return;
    }

    const empty = createEmptyBoard();
    this.board.set(empty);
    this.xQueue.set([]);
    this.oQueue.set([]);
    this.currentTurn.set(starter);
    this.moveCount.set(0);
    this.lastMoveIndex.set(null);
    this.history.set([]);
    this.threeReplayFrames.set([
      {
        board: [...empty],
        xQueue: [],
        oQueue: [],
        currentTurn: starter,
        moveCount: 0,
        lastMoveIndex: null,
      },
    ]);
    this.resetTurnTimer();

    if (this.gameMode() === 'AI' && starter === this.aiSymbol()) {
      this.scheduleThreeAiTurn();
    }
  }

  private saveMorrisSnapshot(state: MorrisState): void {
    const snap: MorrisSnapshot = {
      board: [...state.board],
      inHand: { ...state.inHand },
      captured: { ...state.captured },
      currentTurn: state.currentTurn,
      action: state.action,
      lastMill: state.lastMill,
      lastMovedNode: state.lastMovedNode,
      moveCount: state.moveCount,
    };
    this.morrisHistory.update((list) => [...list, snap]);
  }

  private applyMorrisTransition(
    prev: MorrisState,
    next: MorrisState,
    wasRemoval = false,
  ): void {
    this.morrisState.set(next);
    this.morrisReplayFrames.update((frames) => [...frames, next]);

    if (next.winner || next.isDraw) {
      this.finishOfflineRound(null, next.winner, next.isDraw, next.moveCount);
      return;
    }

    if (wasRemoval) {
      this.soundFx.playCapture();
    } else if (next.action === 'REMOVE') {
      this.soundFx.playMill();
    } else if (prev.currentTurn === 'X') {
      this.soundFx.playMoveX();
    } else {
      this.soundFx.playMoveO();
    }

    this.resetTurnTimer();

    if (this.gameMode() === 'AI' && next.currentTurn === this.aiSymbol()) {
      this.scheduleMorrisAiTurn();
    }
  }

  private commitThreeMove(index: number): void {
    const player = this.currentTurn();
    const currentBoard = this.board();
    if (currentBoard[index] !== null) return;

    const snapshot: MoveSnapshot = {
      board: [...currentBoard],
      xQueue: [...this.xQueue()],
      oQueue: [...this.oQueue()],
      currentTurn: player,
      moveCount: this.moveCount(),
      lastMoveIndex: this.lastMoveIndex(),
    };
    this.history.update((list) => [...list, snapshot]);

    const applied = applyMove(
      currentBoard,
      this.xQueue(),
      this.oQueue(),
      index,
      player,
      this.boardRule(),
    );

    this.board.set(applied.board);
    this.xQueue.set(applied.xQueue);
    this.oQueue.set(applied.oQueue);
    const nextMoveCount = this.moveCount() + 1;
    this.moveCount.set(nextMoveCount);
    this.lastMoveIndex.set(index);

    const nextPlayer = getOpponent(player);
    this.threeReplayFrames.update((frames) => [
      ...frames,
      {
        board: [...applied.board],
        xQueue: [...applied.xQueue],
        oQueue: [...applied.oQueue],
        currentTurn: nextPlayer,
        moveCount: nextMoveCount,
        lastMoveIndex: index,
      },
    ]);

    if (player === 'X') {
      this.soundFx.playMoveX();
    } else {
      this.soundFx.playMoveO();
    }

    const win = checkWinner(applied.board);
    if (win) {
      this.finishOfflineRound(win, win.winner, false, nextMoveCount);
      return;
    }

    if (this.boardRule() === 'CLASSIC' && isBoardFull(applied.board)) {
      this.finishOfflineRound(null, null, true, nextMoveCount);
      return;
    }

    this.currentTurn.set(nextPlayer);
    this.resetTurnTimer();

    if (this.gameMode() === 'AI' && nextPlayer === this.aiSymbol()) {
      this.scheduleThreeAiTurn();
    }
  }

  private finishOfflineRound(
    win: WinResult | null,
    winnerPlayer: Player | null,
    draw: boolean,
    moves: number,
  ): void {
    this.clearAiTimer();
    this.stopTurnTimer();
    this.clearHints();
    this.winResult.set(win);
    this.isDraw.set(draw);
    this.gameState.set('ROUND_SUMMARY');

    if (winnerPlayer) {
      this.soundFx.playWin();
      this.scores.update((s) => ({
        ...s,
        [winnerPlayer]: s[winnerPlayer] + 1,
      }));
    } else if (draw) {
      this.soundFx.playDraw();
      this.scores.update((s) => ({
        ...s,
        draws: s.draws + 1,
      }));
    }

    if (this.gameMode() === 'AI') {
      const oppElo = this.playerStats.getAiOpponentRating(this.difficulty());
      const outcome: 'WIN' | 'LOSS' | 'DRAW' = draw
        ? 'DRAW'
        : winnerPlayer === this.humanSymbol()
          ? 'WIN'
          : 'LOSS';
      this.playerStats.recordMatchOutcome(outcome, oppElo);
    }

    this.roundCounter += 1;
    const record: RoundRecord = {
      id: this.roundCounter,
      variant: this.gameVariant(),
      winner: winnerPlayer ?? 'DRAW',
      mode: this.gameMode(),
      difficulty: this.difficulty(),
      rule: this.boardRule(),
      moves,
    };
    this.recentRounds.update((list) => [record, ...list].slice(0, 6));
  }

  private resetTurnTimer(): void {
    this.stopTurnTimer();
    if (!isPlatformBrowser(this.platformId)) return;

    const limit = this.turnTimeLimit();
    if (limit <= 0 || this.gameState() !== 'PLAYING') {
      this.remainingSeconds.set(0);
      return;
    }

    this.remainingSeconds.set(limit);
    this.turnIntervalId = setInterval(() => {
      if (this.gameState() !== 'PLAYING' || this.isWaitingForOnlineOpponent()) {
        this.stopTurnTimer();
        return;
      }
      const next = this.remainingSeconds() - 1;
      this.remainingSeconds.set(Math.max(0, next));

      if (next > 0 && next <= 5) {
        this.soundFx.playTick();
      }

      if (next <= 0) {
        this.stopTurnTimer();
        if (this.isOnlineMode()) {
          if (this.activeTurn() === this.onlineRole()) {
            this.onlineClient.reportTimeout();
          }
        } else {
          const winner = getOpponent(this.activeTurn());
          this.timeoutWinner.set(winner);
          this.finishOfflineRound(null, winner, false, this.activeMoveCount());
        }
      }
    }, 1000);
  }

  private stopTurnTimer(): void {
    if (this.turnIntervalId !== null) {
      clearInterval(this.turnIntervalId);
      this.turnIntervalId = null;
    }
  }

  private stopReplayAutoPlay(): void {
    if (this.replayIntervalId !== null) {
      clearInterval(this.replayIntervalId);
      this.replayIntervalId = null;
    }
    this.replayAutoPlaying.set(false);
  }

  private scheduleThreeAiTurn(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.clearAiTimer();
    this.isAiThinking.set(true);

    const delayMs = 460 + Math.floor(Math.random() * 220);
    this.aiTimerId = setTimeout(() => {
      this.aiTimerId = null;
      this.isAiThinking.set(false);
      if (this.gameState() !== 'PLAYING' || this.isMorrisVariant() || this.isOnlineMode()) return;

      const aiMove = chooseAiMove(
        this.board(),
        this.xQueue(),
        this.oQueue(),
        this.aiSymbol(),
        this.difficulty(),
        this.boardRule(),
      );
      if (aiMove !== null) {
        this.commitThreeMove(aiMove);
      }
    }, delayMs);
  }

  private scheduleMorrisAiTurn(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.clearAiTimer();
    this.isAiThinking.set(true);

    const current = this.morrisState();
    const delayMs = current.action === 'REMOVE' ? 540 : 480 + Math.floor(Math.random() * 220);

    this.aiTimerId = setTimeout(() => {
      this.aiTimerId = null;
      this.isAiThinking.set(false);
      if (this.gameState() !== 'PLAYING' || !this.isMorrisVariant() || this.isOnlineMode()) return;

      const latest = this.morrisState();
      if (latest.winner || latest.isDraw || latest.currentTurn !== this.aiSymbol()) return;

      const decision = chooseMorrisAiDecision(latest, this.aiSymbol(), this.difficulty());
      if (!decision) return;

      this.saveMorrisSnapshot(latest);

      let next: MorrisState | null = null;
      let wasRemoval = false;
      if (decision.type === 'PLACE') {
        next = applyMorrisPlace(latest, decision.to);
      } else if (decision.type === 'MOVE') {
        next = applyMorrisMove(latest, decision.from, decision.to);
      } else {
        wasRemoval = true;
        next = applyMorrisRemove(latest, decision.target);
      }

      if (next) {
        this.applyMorrisTransition(latest, next, wasRemoval);
      }
    }, delayMs);
  }

  private clearAiTimer(): void {
    if (this.aiTimerId !== null) {
      clearTimeout(this.aiTimerId);
      this.aiTimerId = null;
    }
    this.isAiThinking.set(false);
  }

  private async copyToClipboard(text: string, feedback: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedToast.set(feedback);
      if (this.copyToastTimerId !== null) {
        clearTimeout(this.copyToastTimerId);
      }
      this.copyToastTimerId = setTimeout(() => {
        this.copiedToast.set(null);
        this.copyToastTimerId = null;
      }, 2200);
    } catch {
      this.copiedToast.set('کپی انجام نشد');
    }
  }
}
