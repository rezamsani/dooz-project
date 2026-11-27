import { TestBed } from '@angular/core/testing';
import { PlayerJourney } from './player-journey';
import { DeviceStorage } from './device-storage';
import { PlayerStats } from './player-stats';
describe('earned journey',()=>{
  let values:Map<string,string>;
  beforeEach(()=>{values=new Map();TestBed.configureTestingModule({providers:[{provide:DeviceStorage,useValue:{canReadStats:()=>true,getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}}]});});
  afterEach(()=>vi.useRealTimers());
  it('unlocks bots from coins and persists the selected bot and badges',()=>{
    const j=TestBed.inject(PlayerJourney);expect(j.selectBot('simin')).toBe(false);
    const stats = TestBed.inject(PlayerStats);
    stats.recordMatchOutcome('LOSS','1');
    j.recordMatch('1','LOSS','baran','THREE',false);
    expect(j.isUnlocked('simin')).toBe(true);
    expect(j.isUnlocked('rostam')).toBe(false);
    j.recordMatch('2','WIN','baran','THREE',true);expect(j.isUnlocked('simin')).toBe(true);expect(j.state().badges['clean_win']).toBeUndefined();
    expect(j.recordMatch('2','WIN','baran','THREE',false)).toEqual([]);expect(j.state().wins.baran).toBe(1);
    stats.recordRoundCompletion('local-round','LOCAL_2P');
    expect(j.selectBot('rostam')).toBe(true);
    j.recordMatch('3','WIN','simin','NINE',false);expect(j.state().badges['beat_simin']).toBeTruthy();
    const copy=TestBed.runInInjectionContext(()=>new PlayerJourney());expect(copy.state()).toEqual(j.state());
  });
  it('counts actual attempts and archives cannot backfill daily streaks',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-26T12:00:00Z'));const j=TestBed.inject(PlayerJourney);
    j.startAttempt('2026-11-26');j.startAttempt('2026-11-26');j.solve('2026-11-26',2);
    expect(j.state().solved[0].attempts).toBe(2);j.solve('2026-11-26',1);expect(j.state().solved).toHaveLength(1);
    j.solve('2026-11-25',2);expect(j.streak()).toBe(1);
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));j.solve('2026-11-27',2);
    vi.setSystemTime(new Date('2026-11-28T12:00:00Z'));j.solve('2026-11-28',2);
    expect(j.streak()).toBe(3);expect(j.state().badges['daily_3']).toBeTruthy();
  });
});
