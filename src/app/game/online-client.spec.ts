import { TestBed } from '@angular/core/testing';
import { RuntimeConfig } from '../runtime-config';
import { OnlineClient } from './online-client';

class TestSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static instances: TestSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();

  constructor(readonly url: string) { TestSocket.instances.push(this); }
  close(): void { this.readyState = 3; }
  open(): void { this.readyState = 1; this.onopen?.(); }
}

describe('OnlineClient mobile connections', () => {
  const config = { socketUrl: 'wss://play.example.com/api/ws' as string | null };

  beforeEach(() => {
    config.socketUrl = 'wss://play.example.com/api/ws';
    TestSocket.instances = [];
    vi.stubGlobal('WebSocket', TestSocket);
    TestBed.configureTestingModule({ providers: [{ provide: RuntimeConfig, useValue: config }] });
  });

  afterEach(() => {
    TestBed.inject(OnlineClient).disconnect();
    vi.unstubAllGlobals();
  });

  it('reports unavailable multiplayer without opening a localhost socket', () => {
    config.socketUrl = null;
    const client = TestBed.inject(OnlineClient);
    client.joinRoom('ABCDE', 'Player');
    expect(TestSocket.instances).toHaveLength(0);
    expect(client.connectionStatus()).toBe('ERROR');
    expect(client.errorMessage()).toBeTruthy();
  });

  it('sends queued commands once and does not replay failed connection commands', () => {
    const client = TestBed.inject(OnlineClient);
    client.joinRoom('ABCDE', 'Player');
    const first = TestSocket.instances[0];
    first.onerror?.();
    first.onclose?.();
    client.joinRoom('FGHJK', 'Player');
    const second = TestSocket.instances[1];
    second.open();
    expect(second.url).toBe('wss://play.example.com/api/ws');
    expect(second.send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(second.send.mock.calls[0][0]).type).toBe('session:hello');
    expect(second.send).toHaveBeenNthCalledWith(2, JSON.stringify({ type: 'room:join', code: 'FGHJK', playerName: 'Player' }));
    first.onerror?.();
    expect(client.connectionStatus()).toBe('CONNECTED');
  });
});
