import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { RuntimeConfig } from '../runtime-config';
import { PlayerAvatar } from './avatar';
import { DeviceStorage } from './device-storage';
import { LanSession, lanAvailable, parseLanInvite } from './lan-session';
import {
  Player,
  QuickEmoteId,
} from './dooz.types';
import {
  ClientWsMessage,
  RoomSnapshotDto,
  ServerWsMessage,
} from './online.types';

export interface EmoteBanner {
  from: Player;
  senderName: string;
  emoteId: QuickEmoteId;
  timestamp: number;
}

type CreateOptions = Omit<Extract<ClientWsMessage, { type: 'room:create' }>, 'type'>;

@Injectable({ providedIn: 'root' })
export class OnlineClient {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly config = inject(RuntimeConfig);
  private readonly storage = inject(DeviceStorage);

  private ws: WebSocket | null = null;
  private pendingQueue: ClientWsMessage[] = [];
  private emoteTimerId: ReturnType<typeof setTimeout> | null = null;
  private stateListener: ((room: RoomSnapshotDto, role: Player) => void) | null = null;
  private localAttempt = 0;
  private joinTimeout: ReturnType<typeof setTimeout> | null = null;
  private localEndpoint = signal('');

  readonly connectionStatus = signal<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('IDLE');
  readonly room = signal<RoomSnapshotDto | null>(null);
  readonly yourRole = signal<Player | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly activeEmote = signal<EmoteBanner | null>(null);
  readonly localMode = signal(false);
  readonly localSupported = lanAvailable();
  readonly localInvite = computed(() => {
    const code = this.room()?.code;
    return code && this.localEndpoint() ? `${this.localEndpoint()}/${code}` : '';
  });
  private readonly lan = new LanSession(
    message => {
      if (!this.localMode()) return;
      if (message.type === 'room:state') {
        this.clearJoinTimeout();
        this.connectionStatus.set('CONNECTED');
      } else if (message.type === 'room:error' && !this.room()) {
        this.failLocal(message.message);
        return;
      }
      this.handleServerMessage(message);
    },
    hosting => {
      if (!this.localMode()) return;
      if (hosting) {
        this.errorMessage.set('ارتباط با گوشی دوم قطع شد.');
      } else if (this.connectionStatus() !== 'ERROR') {
        this.failLocal('ارتباط با میزبان وای‌فای قطع شد.');
      }
    },
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.disconnect();
    });
  }

  onRoomState(listener: (room: RoomSnapshotDto, role: Player) => void): void {
    this.stateListener = listener;
  }

  private beginLocal(): number {
    this.disconnect();
    this.localMode.set(true);
    this.errorMessage.set(null);
    this.connectionStatus.set('CONNECTING');
    return this.localAttempt;
  }

  async hostLocal(options: CreateOptions): Promise<void> {
    if (!this.localSupported || this.connectionStatus() === 'CONNECTING') return;
    const attempt = this.beginLocal();
    try {
      await this.lan.host({ type: 'room:create', ...options }, endpoint => {
        this.localEndpoint.set(`${endpoint.address}:${endpoint.port}`);
      });
    } catch {
      if (attempt === this.localAttempt) this.failLocal('میزبانی وای‌فای ممکن نشد. اتصال شبکه یا هات‌اسپات را بررسی کن.');
    }
  }

  async joinLocal(invitation: string, playerName: string, avatar: PlayerAvatar): Promise<void> {
    if (!this.localSupported || this.connectionStatus() === 'CONNECTING') return;
    const invite = parseLanInvite(invitation);
    if (!invite) {
      this.errorMessage.set('دعوت‌نامهٔ وای‌فای معتبر نیست.');
      return;
    }
    const attempt = this.beginLocal();
    this.joinTimeout = setTimeout(() => {
      if (attempt === this.localAttempt) this.failLocal('اتصال وای‌فای برقرار نشد. هر دو گوشی باید روی یک شبکه باشند.');
    }, 8500);
    try {
      await this.lan.join(invite, { type: 'room:join', code: invite.code, playerName, avatar });
    } catch {
      if (attempt === this.localAttempt) this.failLocal('اتصال وای‌فای برقرار نشد. هر دو گوشی باید روی یک شبکه باشند.');
    }
  }

  private clearJoinTimeout(): void {
    if (this.joinTimeout !== null) clearTimeout(this.joinTimeout);
    this.joinTimeout = null;
  }

  private failLocal(message: string): void {
    this.localAttempt++;
    this.clearJoinTimeout();
    void this.lan.close();
    this.errorMessage.set(message);
    this.connectionStatus.set('ERROR');
  }

  createRoom(params: CreateOptions): void {
    if (this.localMode()) this.disconnect();
    this.errorMessage.set(null);
    this.send({
      type: 'room:create',
      playerName: params.playerName,
      avatar: params.avatar,
      rating: params.rating,
      variant: params.variant,
      boardRule: params.boardRule,
      allowFlying: params.allowFlying,
      turnTimeLimit: params.turnTimeLimit,
      targetWins: params.targetWins,
    });
  }

  joinRoom(code: string, playerName: string, avatar?: PlayerAvatar, rating?: number): void {
    if (this.localMode()) this.disconnect();
    this.errorMessage.set(null);
    this.send({
      type: 'room:join',
      code,
      playerName,
      avatar,
      rating,
    });
  }

  sendThreeMove(index: number): void {
    this.send({ type: 'room:move_three', index });
  }

  sendMorrisPlace(nodeId: number): void {
    this.send({ type: 'room:morris_place', nodeId });
  }

  sendMorrisMove(from: number, to: number): void {
    this.send({ type: 'room:morris_move', from, to });
  }

  sendMorrisRemove(target: number): void {
    this.send({ type: 'room:morris_remove', target });
  }

  resign(): void {
    this.send({ type: 'room:resign' });
  }

  reportTimeout(): void {
    this.send({ type: 'room:timeout' });
  }

  offerDraw(): void {
    this.send({ type: 'room:draw_offer' });
  }

  respondDraw(accept: boolean): void {
    this.send({ type: 'room:draw_respond', accept });
  }

  requestRematch(): void {
    this.send({ type: 'room:rematch' });
  }

  sendEmote(emoteId: QuickEmoteId): void {
    this.send({ type: 'room:emote', emoteId });
  }

  leaveRoom(): void {
    if (this.localMode()) {
      this.disconnect();
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'room:leave' });
    }
    this.room.set(null);
    this.yourRole.set(null);
    this.errorMessage.set(null);
    this.activeEmote.set(null);
  }

  disconnect(): void {
    this.localAttempt++;
    this.clearJoinTimeout();
    if (this.localMode()) void this.lan.close();
    this.localMode.set(false);
    this.localEndpoint.set('');
    if (this.emoteTimerId !== null) {
      clearTimeout(this.emoteTimerId);
      this.emoteTimerId = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
    this.pendingQueue = [];
    this.connectionStatus.set('IDLE');
    this.room.set(null);
    this.yourRole.set(null);
    this.activeEmote.set(null);
    this.errorMessage.set(null);
  }

  private openWebSocket(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = this.config.socketUrl;
    if (!url) {
      this.pendingQueue = [];
      this.connectionStatus.set('ERROR');
      this.errorMessage.set('بازی آنلاین فعلاً در دسترس نیست. می‌توانید آفلاین بازی کنید.');
      return;
    }
    this.connectionStatus.set('CONNECTING');

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.pendingQueue = [];
      this.connectionStatus.set('ERROR');
      this.errorMessage.set('اتصال به سرور بازی آنلاین برقرار نشد.');
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.connectionStatus.set('CONNECTED');
      socket.send(JSON.stringify({type:'session:hello',token:this.storage.getItem('dooz_online_session_v1')??undefined}));
      const queued = [...this.pendingQueue];
      this.pendingQueue = [];
      for (const msg of queued) {
        socket.send(JSON.stringify(msg));
      }
    };

    socket.onmessage = (event) => {
      if (this.ws !== socket) return;
      try {
        const parsed = JSON.parse(String(event.data)) as ServerWsMessage;
        this.handleServerMessage(parsed);
      } catch {
        // Ignore malformed frames
      }
    };

    socket.onerror = () => {
      if (this.ws !== socket) return;
      this.pendingQueue = [];
      this.connectionStatus.set('ERROR');
      this.errorMessage.set('اتصال به سرور بازی آنلاین برقرار نشد.');
    };

    socket.onclose = () => {
      if (this.ws === socket) {
        this.ws = null;
        this.pendingQueue = [];
        if (this.connectionStatus() !== 'ERROR') {
          this.connectionStatus.set('IDLE');
        }
      }
    };
  }

  private send(msg: ClientWsMessage): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.localMode()) {
      this.lan.send(msg);
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.pendingQueue.push(msg);
      this.openWebSocket();
    }
  }

  private handleServerMessage(msg: ServerWsMessage): void {
    switch (msg.type) {
      case 'session:welcome':
        if (/^[a-f0-9]{64}$/.test(msg.token)) this.storage.setItem('dooz_online_session_v1',msg.token);
        return;
      case 'room:state':
        this.errorMessage.set(null);
        this.room.set(msg.room);
        this.yourRole.set(msg.yourRole);
        if (this.stateListener) {
          this.stateListener(msg.room, msg.yourRole);
        }
        return;
      case 'room:emote':
        this.activeEmote.set({
          from: msg.from,
          senderName: msg.senderName,
          emoteId: msg.emoteId,
          timestamp: msg.timestamp,
        });
        if (this.emoteTimerId !== null) {
          clearTimeout(this.emoteTimerId);
        }
        this.emoteTimerId = setTimeout(() => {
          this.activeEmote.set(null);
          this.emoteTimerId = null;
        }, 3200);
        return;
      case 'room:error':
        this.errorMessage.set(msg.message);
        return;
      case 'room:left':
        this.room.set(null);
        this.yourRole.set(null);
        return;
    }
  }
}
