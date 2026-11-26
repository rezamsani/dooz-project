import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { RuntimeConfig, onlineSocketUrl, serverOrigin } from './runtime-config';

describe('mobile and web connection settings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps web development on the same origin', () => {
    expect(onlineSocketUrl(null, 'http://localhost:3000', false)).toBe('ws://localhost:3000/api/ws');
  });

  it('does not connect a native app to its local WebView server', () => {
    expect(onlineSocketUrl(null, 'https://localhost', true)).toBeNull();
  });

  it('uses the configured secure server for native multiplayer', () => {
    expect(onlineSocketUrl('https://play.example.com', 'https://localhost', true))
      .toBe('wss://play.example.com/api/ws');
  });

  it('rejects insecure mobile servers and URLs containing credentials or paths', () => {
    for (const value of ['http://example.com', 'wss://example.com', 'https://user:pass@example.com', 'https://example.com/api/ws']) {
      expect(() => serverOrigin(value, true)).toThrow();
    }
    expect(serverOrigin('https://play.example.com/', true)).toBe('https://play.example.com');
  });

  it('copies a room code instead of inventing a localhost invite link on native', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const config = TestBed.inject(RuntimeConfig);
    expect(config.socketUrl).toBeNull();
    expect(config.inviteLink('ABCDE')).toBeNull();
  });

  it('loads public server settings from the packaged configuration', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ onlineServerUrl: 'https://play.example.com', publicWebUrl: 'https://dooz.example.com' }),
    }));
    const config = TestBed.inject(RuntimeConfig);
    await config.load();
    expect(config.socketUrl).toBe('wss://play.example.com/api/ws');
    expect(config.inviteLink('ABCDE')).toBe('https://dooz.example.com/?room=ABCDE');
  });
});
