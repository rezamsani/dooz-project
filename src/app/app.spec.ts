import {TestBed} from '@angular/core/testing';
import { signal } from '@angular/core';
import {App} from './app';
import { OnlineClient } from './game/online-client';
import { RoomSnapshotDto } from './game/online.types';
import { TwelveBilling, TwelveStoreStatus } from './game/twelve-billing';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem('dooz_language_v1');
    localStorage.removeItem('dooz_player_stats_v1');
    localStorage.removeItem('dooz_journey_v1');
    localStorage.removeItem('dooz_ai_starter_v1');
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('keeps 12-piece play behind the Android store purchase, including the history shortcut', () => {
    const canPlay = signal(false);
    const prepareOffer = vi.fn();
    const purchase = vi.fn(async () => { canPlay.set(true); });
    TestBed.overrideProvider(TwelveBilling, { useValue: {
      canPlay, prepareOffer, purchase, restore: vi.fn(), busy: signal(null), storefrontRequired: () => false,
      message: signal(''), price: signal('۵۰٬۰۰۰ ریال'), storeName: () => 'بازار',
      status: signal<TwelveStoreStatus>({ store: 'bazaar', configured: true, owned: false }),
    } });
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.homeTab.set('history');
    app.quickLaunchVariant('TWELVE');
    fixture.detectChanges();
    expect(app.gameState()).toBe('TITLE_MENU');
    expect(prepareOffer).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.launch-button').disabled).toBe(true);
    const offer: HTMLElement = fixture.nativeElement.querySelector('[aria-label="باز کردن دوز ۱۲ تایی"]');
    expect(offer.textContent).toContain('خرید از بازار');
    expect(offer.textContent).toContain('۵۰٬۰۰۰ ریال');
    offer.querySelector('button')?.click();
    fixture.detectChanges();
    expect(purchase).toHaveBeenCalledOnce();
    app.startGame();
    expect(app.gameState()).toBe('PLAYING');
    expect(app.morrisState().variant).toBe('TWELVE');
  });

  it('shows the store requirement when 12-piece Dooz is selected on the web', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.setGameVariant('TWELVE');
    app.startGame();
    fixture.detectChanges();
    expect(app.gameState()).toBe('TITLE_MENU');
    expect(fixture.nativeElement.querySelector('.launch-button').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('از مایکت یا بازار نصب کن.');
    app.setGameVariant('NINE');
    app.startGame();
    expect(app.gameState()).toBe('PLAYING');
  });

  it('shows every robot and updates the selected opponent as coins unlock it', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    const roster: HTMLElement = fixture.nativeElement.querySelector('app-bot-roster');
    const cards = roster.querySelectorAll<HTMLButtonElement>('button');
    expect(cards).toHaveLength(6);
    expect(roster.querySelectorAll(':disabled')).toHaveLength(5);
    expect(cards[5].textContent).toContain('سختی ۶ از ۶');
    expect(cards[5].textContent).toContain('با ۱۵ سکه باز می‌شود');
    app.playerStats.recordMatchOutcome('LOSS', 'unlock-simin');
    fixture.detectChanges();
    expect(cards[1].disabled).toBe(false);
    cards[1].click();
    fixture.detectChanges();
    expect(cards[1].getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.launch-button').textContent).toContain('سیمینِ سپردار');
  });

  it('switches the language and board labels during a match without resetting it', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.setGameMode('LOCAL_2P');
    app.startGame();
    app.onCellSelected(0);

    await app.i18n.setLanguage('en');
    fixture.detectChanges();
    expect(document.documentElement.dir).toBe('ltr');
    expect(app.statusHeadline()).toBe('Player O’s turn');
    const firstCell = fixture.nativeElement.querySelector('[role="gridcell"]');
    expect(firstCell.getAttribute('aria-label')).toContain('Cell 1');

    await app.i18n.setLanguage('ar');
    fixture.detectChanges();
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(firstCell.getAttribute('aria-label')).toContain('الخانة ١');
    expect(app.board()[0]).toBe('X');
    expect(localStorage.getItem('dooz_language_v1')).toBe('ar');

    await app.i18n.setLanguage('fa');
    fixture.detectChanges();
  });

  it('closes help before returning to the title menu on Android back', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.gameState.set('PLAYING');
    app.showHelp.set(true);
    app.onNativeBack();
    expect(app.showHelp()).toBe(false);
    expect(app.gameState()).toBe('PLAYING');
    app.onNativeBack();
    expect(app.gameState()).toBe('TITLE_MENU');
  });

  it('returns from appearance to play before minimizing on Android back', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.homeTab.set('appearance');
    app.onNativeBack();
    expect(app.homeTab()).toBe('play');
    expect(app.gameState()).toBe('TITLE_MENU');
  });

  it('opens the history of Dooz panel from help and returns on back', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.showHelp.set(true);
    app.openHistoryFromHelp();
    fixture.detectChanges();
    expect(app.showHelp()).toBe(false);
    expect(app.homeTab()).toBe('history');
    expect(fixture.nativeElement.querySelector('app-dooz-history-panel')).toBeTruthy();
    app.onNativeBack();
    expect(app.homeTab()).toBe('play');
  });

  it('awards a coin for a completed local round',()=>{
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.setGameMode('LOCAL_2P');app.startGame();
    app.onCellSelected(5);
    app.restartCurrentRound();
    expect(app.playerStats.stats().coins).toBe(0);
    for(const index of [0,3,1,4,2,2]) app.onCellSelected(index);
    expect(app.scores()).toEqual({X:1,O:0,draws:0});
    expect(app.playerStats.totalGames()).toBe(0);
    expect(app.playerStats.stats().coins).toBe(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('۱ سکه گرفتی');
    app.nextRound();
    expect(app.roundCoins()).toBe(0);
  });

  it('awards progress from an actual AI win and reveals coaching after an actual loss',()=>{
    vi.useFakeTimers();const random=vi.spyOn(Math,'random').mockReturnValue(.99);
    try{
      const fixture=TestBed.createComponent(App),app=fixture.componentInstance;
      app.setGameMode('AI');app.startGame();
      for(const index of [0,1,2]){app.onCellSelected(index);vi.advanceTimersByTime(1000);}
      expect(app.gameState()).toBe('ROUND_SUMMARY');expect(app.journey.isUnlocked('simin')).toBe(true);
      expect(app.journey.state().badges['clean_win']).toBeTruthy();expect(app.journey.state().wins.baran).toBe(1);
      app.restartCurrentRound();
      for(const index of [0,1,4]){app.onCellSelected(index);vi.advanceTimersByTime(1000);}
      expect(app.gameState()).toBe('ROUND_SUMMARY');expect(app.threeLesson()).toBeTruthy();
      expect(app.playerStats.stats().coins).toBe(2);
      fixture.detectChanges();expect(fixture.nativeElement.querySelector('app-coach-review')).toBeTruthy();
      expect(app.journey.state().wins.baran).toBe(1);
    }finally{random.mockRestore();vi.useRealTimers();}
  });

  it.each(['ONLINE', 'LAN'] as const)('awards coins once for a participated %s round', (mode)=>{
    const client=TestBed.inject(OnlineClient);
    client.localMode.set(mode === 'LAN');
    const registered=vi.spyOn(client,'onRoomState');
    const app=TestBed.createComponent(App).componentInstance;
    const listener=registered.mock.calls[0][0];
    const room: RoomSnapshotDto={
      code:'ABCDE',roundId:'unique-round',variant:'THREE',boardRule:'CLASSIC',allowFlying:false,turnTimeLimit:0,status:'FINISHED',
      players:{X:{name:'You',connected:true},O:{name:'Opponent',connected:true}},scores:{X:1,O:0,draws:0},rematchVotes:[],drawOfferFrom:null,
      threeBoard:Array(9).fill(null),threeXQueue:[],threeOQueue:[],threeTurn:'X',threeMoveCount:5,threeLastMove:2,threeWin:null,threeDraw:false,morrisState:null,winner:'X',isDraw:false,endReason:'NORMAL',
    };
    const emit=(snapshot:RoomSnapshotDto)=>{client.room.set(snapshot);client.yourRole.set('X');listener(snapshot,'X');};
    emit(room);expect(app.playerStats.stats().coins).toBe(0);
    emit({...room,status:'PLAYING',winner:null});
    emit(room);emit(room);
    expect(app.playerStats.stats()).toMatchObject(mode === 'LAN'
      ? {coins:1,wins:0}
      : {coins:1,wins:1});
    expect(app.roundCoins()).toBe(1);
  });

  it('supports starting with the human, the bot, or alternating after each round in AI mode', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      app.setGameMode('AI');

      // Bot moves first when AI starter is selected
      app.setAiStarterMode('AI');
      app.startGame();
      expect(app.startingPlayer()).toBe('O');
      expect(app.currentTurn()).toBe('O');
      vi.advanceTimersByTime(1000);
      expect(app.moveCount()).toBe(1);
      expect(app.currentTurn()).toBe('X');

      // Human moves first even when choosing O
      app.setAiStarterMode('HUMAN');
      app.setHumanSymbol('O');
      app.startGame();
      expect(app.startingPlayer()).toBe('O');
      expect(app.currentTurn()).toBe('O');
      app.nextRound();
      expect(app.startingPlayer()).toBe('O');

      // Alternates starter after each round
      app.setHumanSymbol('X');
      app.setAiStarterMode('ALTERNATE');
      app.startGame();
      expect(app.startingPlayer()).toBe('X');
      app.nextRound();
      expect(app.startingPlayer()).toBe('O');
      vi.advanceTimersByTime(1000);
      expect(app.moveCount()).toBe(1);
      app.nextRound();
      expect(app.startingPlayer()).toBe('X');
      expect(localStorage.getItem('dooz_ai_starter_v1')).toBe('ALTERNATE');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the step-by-step Wi-Fi guide in LAN mode', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.setGameMode('LAN');
    fixture.detectChanges();
    const guide: HTMLElement | null = fixture.nativeElement.querySelector('.wifi-guide');
    expect(guide).toBeTruthy();
    expect(guide?.querySelectorAll('li')).toHaveLength(4);
  });
});
