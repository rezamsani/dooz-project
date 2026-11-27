import { TestBed } from '@angular/core/testing';
import { ratingAfterMatch, restoreRecord } from './player-score';
import { PlayerStats } from './player-stats';

describe('personal score accounting',()=>{
  beforeEach(()=>localStorage.removeItem('dooz_player_stats_v1'));
  afterEach(()=>localStorage.removeItem('dooz_player_stats_v1'));

  it('calculates equal opponents and rewards an upset more than an easy win',()=>{
    expect(ratingAfterMatch(1200,1200,'WIN')).toBe(1212);
    expect(ratingAfterMatch(1200,1200,'LOSS')).toBe(1188);
    expect(ratingAfterMatch(1200,1200,'DRAW')).toBe(1200);
    expect(ratingAfterMatch(1200,1480,'WIN')).toBe(1220);
    expect(ratingAfterMatch(1200,950,'WIN')).toBe(1205);
    expect(ratingAfterMatch(1200,1480,'DRAW')).toBeGreaterThan(1200);
    expect(ratingAfterMatch(1200,950,'DRAW')).toBeLessThan(1200);
  });

  it('reports the actual delta at the minimum rating',()=>{
    localStorage.setItem('dooz_player_stats_v1',JSON.stringify({elo:800}));
    const stats=TestBed.inject(PlayerStats);
    stats.recordMatchOutcome('LOSS',1200,'floor');
    expect(stats.stats().elo).toBe(800);
    expect(stats.lastEloDelta()).toBe(0);
    expect(stats.stats().losses).toBe(1);
  });

  it('counts each match once, including after restarting the service',()=>{
    let stats=TestBed.inject(PlayerStats);
    stats.recordMatchOutcome('WIN',1200,'same-match');
    const first={...stats.stats()};
    expect(first.coins).toBe(1);
    expect(stats.recordMatchOutcome('WIN',1200,'same-match')).toBe(false);
    expect(stats.stats()).toEqual(first);
    TestBed.resetTestingModule();stats=TestBed.inject(PlayerStats);
    expect(stats.recordMatchOutcome('WIN',1200,'same-match')).toBe(false);
    expect(stats.stats()).toEqual(first);
  });

  it('tracks wins, draws, losses and streaks without counting draws as wins',()=>{
    const stats=TestBed.inject(PlayerStats);
    ['WIN','WIN','DRAW','LOSS'].forEach((outcome,i)=>stats.recordMatchOutcome(outcome as 'WIN'|'DRAW'|'LOSS',1200,`match-${i}`));
    expect(stats.totalGames()).toBe(4);expect(stats.winRate()).toBe(50);
    expect(stats.stats()).toMatchObject({wins:2,draws:1,losses:1,coins:4,currentStreak:0,bestStreak:2});
    expect(stats.stats().recentResults).toHaveLength(4);
  });

  it('does not award a finished online game to a player who never participated',()=>{
    const stats=TestBed.inject(PlayerStats);
    expect(stats.recordMatchOutcome('WIN',1400,'online-round','ONLINE')).toBe(false);
    stats.beginOnlineMatch('online-round');
    TestBed.resetTestingModule();
    const restored=TestBed.inject(PlayerStats);
    expect(restored.recordMatchOutcome('WIN',1400,'online-round','ONLINE')).toBe(true);
    expect(restored.stats().pendingOnlineMatches).toEqual([]);
    expect(restored.recordMatchOutcome('WIN',1400,'online-round','ONLINE')).toBe(false);
  });

  it('sanitizes legacy data into finite integer counters and consistent streaks',()=>{
    expect(restoreRecord({elo:Infinity,wins:2.9,draws:-1,losses:NaN,currentStreak:8,bestStreak:1})).toMatchObject({elo:1200,wins:2,draws:0,losses:0,coins:2,currentStreak:2,bestStreak:2});
    expect(restoreRecord({wins:2,coins:5}).coins).toBe(5);
    expect(restoreRecord(null).elo).toBe(1200);
  });
});
