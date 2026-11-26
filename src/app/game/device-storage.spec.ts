import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { DeviceStorage, NATIVE_STORAGE } from './device-storage';
import { PlayerStats } from './player-stats';

vi.mock('@capacitor/preferences',()=>({Preferences:{get:vi.fn(),set:vi.fn(),remove:vi.fn()}}));
describe('native player storage',()=>{
  beforeEach(()=>{
    TestBed.configureTestingModule({providers:[{provide:NATIVE_STORAGE,useValue:true}]});
    vi.mocked(Preferences.get).mockImplementation(async()=>({value:null}));
    vi.mocked(Preferences.set).mockResolvedValue();
    vi.mocked(Preferences.remove).mockResolvedValue();
    localStorage.removeItem('dooz_player_stats_v1');
  });
  afterEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();localStorage.removeItem('dooz_player_stats_v1');});

  it('loads native stats when localStorage is unavailable',async()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('unavailable');});
    vi.mocked(Preferences.get).mockImplementation(async({key})=>({value:key==='dooz_player_stats_v1'?JSON.stringify({elo:1310,wins:8,losses:3,draws:2}):null}));
    const storage=TestBed.inject(DeviceStorage);await storage.load();
    const stats=TestBed.inject(PlayerStats);
    expect(stats.stats().elo).toBe(1310);expect(stats.totalGames()).toBe(13);
    expect(storage.issue()).toBeNull();
  });

  it('migrates old stats without overwriting existing native stats',async()=>{
    const legacy=JSON.stringify({elo:1290,wins:4});
    localStorage.setItem('dooz_player_stats_v1',legacy);
    const storage=TestBed.inject(DeviceStorage);await storage.load();
    expect(Preferences.set).toHaveBeenCalledWith({key:'dooz_player_stats_v1',value:legacy});
    vi.mocked(Preferences.get).mockImplementation(async({key})=>({value:key==='dooz_player_stats_v1'?JSON.stringify({elo:1400,wins:10}):null}));
    await storage.load();
    expect(storage.getItem('dooz_player_stats_v1')).toContain('1400');
  });

  it('serializes rapid writes and keeps the latest result on disk',async()=>{
    const storage=TestBed.inject(DeviceStorage);await storage.load();
    vi.mocked(Preferences.set).mockClear();
    let release!:()=>void;
    vi.mocked(Preferences.set).mockImplementationOnce(()=>new Promise<void>(r=>{release=r;}));
    storage.setItem('dooz_player_stats_v1','first');storage.setItem('dooz_player_stats_v1','second');
    await Promise.resolve();expect(Preferences.set).toHaveBeenCalledTimes(1);
    release();await storage.flush();
    expect(Preferences.set).toHaveBeenLastCalledWith({key:'dooz_player_stats_v1',value:'second'});
    expect(storage.pending()).toBe(0);
  });

  it('shows write failures and retries the unsaved record',async()=>{
    const storage=TestBed.inject(DeviceStorage);await storage.load();
    vi.mocked(Preferences.set).mockRejectedValueOnce(Error('disk full'));
    storage.setItem('dooz_player_stats_v1','latest');await storage.flush();
    expect(storage.issue()).toBe('write');
    storage.retry();await storage.flush();expect(storage.issue()).toBeNull();
    expect(Preferences.set).toHaveBeenLastCalledWith({key:'dooz_player_stats_v1',value:'latest'});
  });

  it('does not overwrite native data after a read failure',async()=>{
    vi.mocked(Preferences.get).mockRejectedValue(Error('read failed'));
    const storage=TestBed.inject(DeviceStorage);await storage.load();
    storage.setItem('dooz_player_stats_v1','new defaults');await storage.flush();
    expect(storage.issue()).toBe('load');expect(storage.canReadStats()).toBe(false);
    expect(Preferences.set).not.toHaveBeenCalled();
  });
});
