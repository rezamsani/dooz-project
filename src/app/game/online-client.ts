import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { RuntimeConfig } from '../runtime-config';
import { PlayerAvatar } from './avatar';
import {
  BoardRule,
  GameVariant,
  Player,
  QuickEmoteId,
  TurnTimeLimit,
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

@Injectable({ providedIn: 'root' })
export class OnlineClient {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly config = inject(RuntimeConfig);

  private ws: WebSocket | null = null;
  private pendingQueue: ClientWsMessage[] = [];
  private emoteTimerId: ReturnType<typeof setTimeout> | null = null;
  private stateListener: ((room: RoomSnapshotDto, role: Player) => void) | null = null;

  readonly connectionStatus = signal<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('IDLE');
  readonly room = signal<RoomSnapshotDto | null>(null);
  readonly yourRole = signal<Player | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly activeEmote = signal<EmoteBanner | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.disconnect();
    });
  }

  onRoomState(listener: (room: RoomSnapshotDto, role: Player) => void): void {
    this.stateListener = listener;
  }

  createRoom(params: {
    playerName: string;
    avatar?: PlayerAvatar;
    rating?: number;
    variant: GameVariant;
    boardRule: BoardRule;
    allowFlying: boolean;
    turnTimeLimit: TurnTimeLimit;
  }): void {
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
    });
  }

  joinRoom(code: string, playerName: string, avatar?: PlayerAvatar, rating?: number): void {
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'room:leave' });
    }
    this.room.set(null);
    this.yourRole.set(null);
    this.errorMessage.set(null);
    this.activeEmote.set(null);
  }

  disconnect(): void {
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.pendingQueue.push(msg);
      this.openWebSocket();
    }
  }

  private handleServerMessage(msg: ServerWsMessage): void {
    switch (msg.type) {
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
