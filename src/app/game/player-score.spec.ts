import { TestBed } from '@angular/core/testing';
import { restoreRecord } from './player-score';
import { PlayerStats } from './player-stats';

describe('coin rewards and round records',()=>{
  beforeEach(()=>localStorage.removeItem('dooz_player_stats_v1'));
  afterEach(()=>localStorage.removeItem('dooz_player_stats_v1'));

  it('counts each match once, including after restarting the service',()=>{
    let stats=TestBed.inject(PlayerStats);
    stats.recordMatchOutcome('WIN','same-match');
    const first={...stats.stats()};
    expect(first.coins).toBe(1);
    expect(stats.recordMatchOutcome('WIN','same-match')).toBe(false);
    expect(stats.stats()).toEqual(first);
    TestBed.resetTestingModule();stats=TestBed.inject(PlayerStats);
    expect(stats.recordMatchOutcome('WIN','same-match')).toBe(false);
    expect(stats.stats()).toEqual(first);
  });

  it('tracks wins, draws, losses and streaks without counting draws as wins',()=>{
    const stats=TestBed.inject(PlayerStats);
    (['WIN','WIN','DRAW','LOSS'] as const).forEach((outcome,i)=>stats.recordMatchOutcome(outcome,`match-${i}`));
    expect(stats.totalGames()).toBe(4);expect(stats.winRate()).toBe(50);
    expect(stats.stats()).toMatchObject({wins:2,draws:1,losses:1,coins:4,currentStreak:0,bestStreak:2});
    expect(stats.stats().recentResults).toHaveLength(4);
  });

  it('does not award a finished online game to a player who never participated',()=>{
    const stats=TestBed.inject(PlayerStats);
    expect(stats.recordMatchOutcome('WIN','online-round','ONLINE')).toBe(false);
    stats.beginOnlineMatch('online-round');
    TestBed.resetTestingModule();
    const restored=TestBed.inject(PlayerStats);
    expect(restored.recordMatchOutcome('WIN','online-round','ONLINE')).toBe(true);
    expect(restored.stats().pendingOnlineMatches).toEqual([]);
    expect(restored.recordMatchOutcome('WIN','online-round','ONLINE')).toBe(false);
  });

  it('sanitizes legacy data into finite integer counters and consistent streaks',()=>{
    const legacy = restoreRecord({
      elo: 1450, wins: 2.9, draws: -1, losses: NaN, currentStreak: 8, bestStreak: 1,
      recentResults: [{ id: 'legacy', outcome: 'WIN', mode: 'AI', rating: 1450, delta: 12, at: 1 }],
    });
    expect(legacy).toMatchObject({wins:2,draws:0,losses:0,coins:2,currentStreak:2,bestStreak:2});
    expect(legacy).not.toHaveProperty('elo');
    expect(legacy.recentResults).toEqual([{ id: 'legacy', outcome: 'WIN', mode: 'AI', at: 1 }]);
    expect(restoreRecord({wins:2,coins:5}).coins).toBe(5);
    expect(restoreRecord(null).coins).toBe(0);
  });
});
