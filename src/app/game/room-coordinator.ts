import { normalizeAvatar, PlayerAvatar } from './avatar';
import { ratingAfterMatch, validRating } from './player-score';
import {
  applyMove,
  checkWinner,
  createEmptyBoard,
  getOpponent,
  isBoardFull,
} from './dooz-engine';
import {
  BoardRule,
  CellValue,
  GameVariant,
  Player,
  QUICK_EMOTES,
  QuickEmoteId,
  ScoreBoard,
  TurnTimeLimit,
  WinResult,
} from './dooz.types';
import {
  applyMorrisMove,
  applyMorrisPlace,
  applyMorrisRemove,
  createInitialMorrisState,
} from './morris-engine';
import { MorrisState, MorrisVariant } from './morris.types';
import {
  ClientWsMessage,
  RoomSnapshotDto,
  ServerWsMessage,
} from './online.types';

export interface RoomPeer {
  send(payload: ServerWsMessage): void;
}

export interface GuestIdentity { id: string; token: string; }

interface RoomHistory {
  wins: Record<string, number>;
  draws: number;
  series: Record<string, number>;
  recent: readonly { winner: string | null; at: number }[];
}

export interface RoomIdentityStore {
  identify(token: unknown): GuestIdentity;
  issue?: boolean;
  history?(a: string, b: string): RoomHistory;
  record?(a: string, b: string, winner: string | null, round: string, seriesWinner: string | null): void;
}

type RandomBytes = (length: number) => Uint8Array;

export function randomHex(random: RandomBytes, length: number): string {
  return Array.from(random(length), byte => byte.toString(16).padStart(2, '0')).join('');
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALLOWED_EMOTE_IDS = new Set<string>(QUICK_EMOTES.map((e) => e.id));
const MAX_ROOMS = 200;
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;

interface PlayerSlot {
  socket: RoomPeer | null;
  name: string;
  avatar: PlayerAvatar;
  rating: number;
  identityId:string;
}

interface ActiveRoom {
  code: string;
  roundId: string;
  roundRatings: Record<Player,number>;
  targetWins:0|3;
  seriesWinner:Player|null;
  variant: GameVariant;
  boardRule: BoardRule;
  allowFlying: boolean;
  turnTimeLimit: TurnTimeLimit;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: Record<Player, PlayerSlot | null>;
  scores: ScoreBoard;
  starter: Player;
  rematchVotes: Set<Player>;
  drawOfferFrom: Player | null;
  threeBoard: CellValue[];
  threeXQueue: number[];
  threeOQueue: number[];
  threeTurn: Player;
  threeMoveCount: number;
  threeLastMove: number | null;
  threeWin: WinResult | null;
  threeDraw: boolean;
  morrisState: MorrisState | null;
  winner: Player | null;
  isDraw: boolean;
  endReason: 'NORMAL' | 'RESIGN' | 'TIMEOUT' | 'DRAW_AGREED' | null;
  lastActivityAt: number;
}

interface SocketMeta {
  roomCode: string | null;
  role: Player | null;
  identity?:GuestIdentity;
}

function sanitizePlayerName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, 18);
  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  if (!/^[A-Z2-9]{5}$/.test(normalized)) return null;
  return normalized;
}

function generateRoomCode(existing: Map<string, ActiveRoom>, random: RandomBytes): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = random(5);
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
    }
    if (!existing.has(code)) return code;
  }
  throw new Error('Could not allocate an unused room code');
}

function sendJson(peer: RoomPeer | null, payload: ServerWsMessage): void {
  peer?.send(payload);
}

export class RoomCoordinator {
  private readonly rooms = new Map<string, ActiveRoom>();
  private readonly socketMeta = new WeakMap<RoomPeer, SocketMeta>();

  constructor(
    private readonly rivalries: RoomIdentityStore,
    private readonly random: RandomBytes,
  ) {}

  connect(peer: RoomPeer): void {
    this.socketMeta.set(peer, { roomCode: null, role: null });
  }

  receive(peer: RoomPeer, text: string): void {
    if (!this.socketMeta.has(peer)) return;
    this.pruneIdleRooms();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      sendJson(peer, { type: 'room:error', message: 'فرمت پیام نامعتبر است.' });
      return;
    }
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return;
    try {
      this.handleMessage(peer, parsed as ClientWsMessage);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Room operation failed');
      sendJson(peer,{type:'room:error',message:'ذخیره‌سازی سرور در دسترس نیست؛ کمی بعد دوباره تلاش کنید.'});
    }
  }

  disconnect(peer: RoomPeer): void {
    this.detachSocket(peer);
    this.socketMeta.delete(peer);
  }

  private handleMessage(ws: RoomPeer, msg: ClientWsMessage): void {
    switch (msg.type) {
      case 'session:hello':{
        const meta=this.socketMeta.get(ws)!;
        if(meta.roomCode)return;
        const identity=meta.identity ?? this.rivalries.identify(msg.token);meta.identity=identity;
        sendJson(ws,{type:'session:welcome',token:identity.token,playerId:identity.id});return;
      }
      case 'room:create':
        this.createRoom(ws, msg);
        return;
      case 'room:join':
        this.joinRoom(ws, msg.code, msg.playerName, msg.avatar, msg.rating);
        return;
      case 'room:leave':
        this.detachSocket(ws);
        sendJson(ws, { type: 'room:left' });
        return;
      case 'room:move_three':
        this.handleThreeMove(ws, msg.index);
        return;
      case 'room:morris_place':
        this.handleMorrisAction(ws, { type: 'PLACE', nodeId: msg.nodeId });
        return;
      case 'room:morris_move':
        this.handleMorrisAction(ws, { type: 'MOVE', from: msg.from, to: msg.to });
        return;
      case 'room:morris_remove':
        this.handleMorrisAction(ws, { type: 'REMOVE', target: msg.target });
        return;
      case 'room:resign':
        this.handleResign(ws);
        return;
      case 'room:timeout':
        this.handleTimeout(ws);
        return;
      case 'room:draw_offer':
        this.handleDrawOffer(ws);
        return;
      case 'room:draw_respond':
        this.handleDrawRespond(ws, Boolean(msg.accept));
        return;
      case 'room:rematch':
        this.handleRematch(ws);
        return;
      case 'room:emote':
        this.handleEmote(ws, msg.emoteId);
        return;
    }
  }

  private createRoom(
    ws: RoomPeer,
    msg: Extract<ClientWsMessage, { type: 'room:create' }>,
  ): void {
    const identity=this.identityFor(ws);
    this.detachSocket(ws);
    if (this.rooms.size >= MAX_ROOMS) {
      this.pruneIdleRooms();
      if (this.rooms.size >= MAX_ROOMS) {
        sendJson(ws, { type: 'room:error', message: 'ظرفیت اتاق‌های فعال تکمیل است. لحظاتی دیگر تلاش کنید.' });
        return;
      }
    }

    const variant: GameVariant =
      msg.variant === 'NINE' || msg.variant === 'TWELVE' ? msg.variant : 'THREE';
    const boardRule: BoardRule = msg.boardRule === 'INFINITE' ? 'INFINITE' : 'CLASSIC';
    const allowFlying = msg.allowFlying !== false;
    const turnTimeLimit: TurnTimeLimit =
      msg.turnTimeLimit === 15 || msg.turnTimeLimit === 30 || msg.turnTimeLimit === 60
        ? msg.turnTimeLimit
        : 0;
    const playerName = sanitizePlayerName(msg.playerName, 'بازیکن ۱');

    const code = generateRoomCode(this.rooms, this.random);
    const room: ActiveRoom = {
      code,
      roundId: randomHex(this.random, 12),
      targetWins:msg.targetWins===3?3:0,seriesWinner:null,
      roundRatings: {X: validRating(msg.rating), O:1200},
      variant,
      boardRule,
      allowFlying,
      turnTimeLimit,
      status: 'WAITING',
      players: {
        X: { socket: ws, name: playerName, avatar: normalizeAvatar(msg.avatar), rating:validRating(msg.rating), identityId:identity.id },
        O: null,
      },
      scores: { X: 0, O: 0, draws: 0 },
      starter: 'X',
      rematchVotes: new Set<Player>(),
      drawOfferFrom: null,
      threeBoard: createEmptyBoard(),
      threeXQueue: [],
      threeOQueue: [],
      threeTurn: 'X',
      threeMoveCount: 0,
      threeLastMove: null,
      threeWin: null,
      threeDraw: false,
      morrisState:
        variant === 'THREE'
          ? null
          : createInitialMorrisState(variant, 'X', allowFlying),
      winner: null,
      isDraw: false,
      endReason: null,
      lastActivityAt: Date.now(),
    };

    this.rooms.set(code, room);
    this.socketMeta.set(ws, { roomCode: code, role: 'X', identity });
    this.broadcastRoomState(room);
  }

  private joinRoom(ws: RoomPeer, rawCode: unknown, rawName: unknown, rawAvatar: unknown, rawRating: unknown): void {
    const code = sanitizeRoomCode(rawCode);
    if (!code) {
      sendJson(ws, { type: 'room:error', message: 'کد اتاق باید ۵ حرف یا عدد معتبر باشد.' });
      return;
    }

    const room = this.rooms.get(code);
    if (!room) {
      sendJson(ws, { type: 'room:error', message: 'اتاقی با این کد پیدا نشد یا منقضی شده است.' });
      return;
    }

    const identity=this.identityFor(ws);
    if(this.socketMeta.get(ws)?.roomCode===code){this.broadcastRoomState(room);return;}
    if(room.seriesWinner){sendJson(ws,{type:'room:error',message:'این رقابت تمام شده؛ یک اتاق تازه بسازید.'});return;}
    const ownedRole:Player|null=room.players.X?.identityId===identity.id?'X':room.players.O?.identityId===identity.id?'O':null;
    if(!ownedRole&&room.players.O){sendJson(ws,{type:'room:error',message:'این رقابت مخصوص دو بازیکن اولیه است.'});return;}
    if(ownedRole&&room.players[ownedRole]?.socket&&room.players[ownedRole]?.socket!==ws){sendJson(ws,{type:'room:error',message:'این بازیکن در دستگاه یا تب دیگری به اتاق وصل است.'});return;}
    this.detachSocket(ws);
    const name = sanitizePlayerName(rawName, 'بازیکن ۲');
    const avatar = rawAvatar === undefined ? normalizeAvatar({cartoon:'sky'}) : normalizeAvatar(rawAvatar);
    const rating = validRating(rawRating);

    let assignedRole: Player | null = null;
    if (!room.players.O && ownedRole!=='X') {
      room.players.O = { socket: ws, name, avatar, rating, identityId:identity.id };
      assignedRole = 'O';
    } else if (ownedRole==='O'&&room.players.O&&!room.players.O.socket) {
      room.players.O.socket = ws;
      room.players.O.name = name;
      room.players.O.avatar = avatar;
      assignedRole = 'O';
    } else if (ownedRole==='X'&&(!room.players.X||!room.players.X.socket)) {
      room.players.X = { socket: ws, name, avatar, rating:room.players.X?.rating??rating, identityId:identity.id };
      assignedRole = 'X';
    }

    if (!assignedRole) {
      sendJson(ws, { type: 'room:error', message: 'این اتاق تکمیل شده است (۲ بازیکن حاضرند).' });
      return;
    }

    room.lastActivityAt = Date.now();
    if (room.status === 'WAITING' && room.players.X?.socket && room.players.O?.socket) {
      room.roundRatings = {X:room.players.X.rating,O:room.players.O.rating};
      room.status = 'PLAYING';
    }

    this.socketMeta.set(ws, { roomCode: code, role: assignedRole, identity });
    this.broadcastRoomState(room);
  }

  private getRoomAndRole(ws: RoomPeer): { room: ActiveRoom; role: Player } | null {
    const meta = this.socketMeta.get(ws);
    if (!meta || !meta.roomCode || !meta.role) return null;
    const room = this.rooms.get(meta.roomCode);
    if (!room) return null;
    return { room, role: meta.role };
  }

  private handleThreeMove(ws: RoomPeer, index: unknown): void {
    const ctx = this.getRoomAndRole(ws);
    if (!ctx) return;
    const { room, role } = ctx;
    if (room.status !== 'PLAYING' || room.variant !== 'THREE') return;
    if (room.threeTurn !== role) return;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > 8) return;
    if (room.threeBoard[index] !== null) return;

    const applied = applyMove(
      room.threeBoard,
      room.threeXQueue,
      room.threeOQueue,
      index,
      role,
      room.boardRule,
    );

    room.threeBoard = applied.board;
    room.threeXQueue = applied.xQueue;
    room.threeOQueue = applied.oQueue;
    room.threeMoveCount += 1;
    room.threeLastMove = index;
    room.drawOfferFrom = null;
    room.lastActivityAt = Date.now();

    const win = checkWinner(applied.board);
    if (win) {
      room.threeWin = win;
      this.finishRoomRound(room, win.winner, false, 'NORMAL');
      return;
    }

    if (room.boardRule === 'CLASSIC' && isBoardFull(applied.board)) {
      room.threeDraw = true;
      this.finishRoomRound(room, null, true, 'NORMAL');
      return;
    }

    room.threeTurn = getOpponent(role);
    this.broadcastRoomState(room);
  }

  private handleMorrisAction(
    ws: RoomPeer,
    act:
      | { type: 'PLACE'; nodeId: unknown }
      | { type: 'MOVE'; from: unknown; to: unknown }
      | { type: 'REMOVE'; target: unknown },
  ): void {
    const ctx = this.getRoomAndRole(ws);
    if (!ctx) return;
    const { room, role } = ctx;
    if (room.status !== 'PLAYING' || room.variant === 'THREE' || !room.morrisState) return;
    if (room.morrisState.currentTurn !== role) return;

    let next: MorrisState | null = null;
    if (act.type === 'PLACE' && typeof act.nodeId === 'number' && Number.isInteger(act.nodeId)) {
      next = applyMorrisPlace(room.morrisState, act.nodeId);
    } else if (
      act.type === 'MOVE' &&
      typeof act.from === 'number' &&
      typeof act.to === 'number' &&
      Number.isInteger(act.from) &&
      Number.isInteger(act.to)
    ) {
      next = applyMorrisMove(room.morrisState, act.from, act.to);
    } else if (
      act.type === 'REMOVE' &&
      typeof act.target === 'number' &&
      Number.isInteger(act.target)
    ) {
      next = applyMorrisRemove(room.morrisState, act.target);
    }

    if (!next) return;

    room.morrisState = next;
    room.drawOfferFrom = null;
    room.lastActivityAt = Date.now();

    if (next.winner || next.isDraw) {
      this.finishRoomRound(room, next.winner, next.isDraw, 'NORMAL');
      return;
    }

    this.broadcastRoomState(room);
  }

  private handleResign(ws: RoomPeer): void {
    const ctx = this.getRoomAndRole(ws);
    if (!ctx) return;
    const { room, role } = ctx;
    if (room.status !== 'PLAYING') return;

    const winner = getOpponent(role);
    this.finishRoomRound(room, winner, false, 'RESIGN');
  }

  private handleTimeout(ws: RoomPeer): void {
    const ctx = this.getRoomAndRole(ws);
    if (!ctx) return;
    const { room, role } = ctx;
    if (room.status !== 'PLAYING' || room.turnTimeLimit === 0) return;

    const activeTurn =
      room.variant === 'THREE'
        ? room.threeTurn
        : (room.morrisState?.currentTurn ?? 'X');

    // Only accept timeout report for the player whose turn actually expired
    if (activeTurn !== role) return;

    const winner = getOpponent(role);
    this.finishRoomRound(room, winner, false, 'TIMEOUT');
  }

  private handleDrawOffer(ws: RoomPeer): void {
    const ctx = this.getRoomAndRole(ws);
    if (!ctx) return;
    const { room, role } = ctx;
    if (room.status !== 'PLAYING') return;

    room.drawOfferFrom = role;
    room.lastActivityAt = Date.now();
    this.broadcastRoomState(room);
  }

  private handleDrawRespond(ws: RoomPeer, accept: boolean): void {
    const ctx = this.getRoomAndRole(ws);
    if (!ctx) return;
    const { room, role } = ctx;
    if (room.status !== 'PLAYING' || !room.drawOfferFrom || room.drawOfferFrom === role) {
      return;
    }

    room.drawOfferFrom = null;
    if (accept) {
      this.finishRoomRound(room, null, true, 'DRAW_AGREED');
    } else {
      this.broadcastRoomState(room);
    }
  }

  private handleRematch(ws: RoomPeer): void {
    const ctx = this.getRoomAndRole(ws);
    if (!ctx) return;
    const { room, role } = ctx;
    if (room.status !== 'FINISHED') return;
    if(room.seriesWinner){sendJson(ws,{type:'room:error',message:'رقابت سه‌بردی تمام شده؛ اتاق تازه‌ای بسازید.'});return;}

    room.rematchVotes.add(role);
    room.lastActivityAt = Date.now();

    if (room.rematchVotes.has('X') && room.rematchVotes.has('O')) {
      const before=room.roundRatings;
      const x=ratingAfterMatch(before.X,before.O,room.isDraw?'DRAW':room.winner==='X'?'WIN':'LOSS');
      const o=ratingAfterMatch(before.O,before.X,room.isDraw?'DRAW':room.winner==='O'?'WIN':'LOSS');
      room.roundRatings={X:x,O:o};
      if(room.players.X) room.players.X.rating=x;
      if(room.players.O) room.players.O.rating=o;
      room.roundId=randomHex(this.random, 12);
      room.starter = getOpponent(room.starter);
      room.rematchVotes.clear();
      room.drawOfferFrom = null;
      room.winner = null;
      room.isDraw = false;
      room.endReason = null;
      room.status = 'PLAYING';

      if (room.variant === 'THREE') {
        room.threeBoard = createEmptyBoard();
        room.threeXQueue = [];
        room.threeOQueue = [];
        room.threeTurn = room.starter;
        room.threeMoveCount = 0;
        room.threeLastMove = null;
        room.threeWin = null;
        room.threeDraw = false;
      } else {
        const mv: MorrisVariant = room.variant;
        room.morrisState = createInitialMorrisState(mv, room.starter, room.allowFlying);
      }
    }

    this.broadcastRoomState(room);
  }

  private handleEmote(ws: RoomPeer, emoteId: unknown): void {
    const ctx = this.getRoomAndRole(ws);
    if (!ctx) return;
    if (typeof emoteId !== 'string' || !ALLOWED_EMOTE_IDS.has(emoteId)) return;

    const { room, role } = ctx;
    const senderName = room.players[role]?.name ?? (role === 'X' ? 'بازیکن X' : 'بازیکن O');
    const payload: ServerWsMessage = {
      type: 'room:emote',
      from: role,
      senderName,
      emoteId: emoteId as QuickEmoteId,
      timestamp: Date.now(),
    };
    sendJson(room.players.X?.socket ?? null, payload);
    sendJson(room.players.O?.socket ?? null, payload);
  }

  private finishRoomRound(
    room: ActiveRoom,
    winner: Player | null,
    isDraw: boolean,
    reason: 'NORMAL' | 'RESIGN' | 'TIMEOUT' | 'DRAW_AGREED',
  ): void {
    if (room.status !== 'PLAYING') return;
    room.status = 'FINISHED';
    room.winner = winner;
    room.isDraw = isDraw;
    room.endReason = reason;
    room.drawOfferFrom = null;
    room.rematchVotes.clear();

    if (winner) {
      room.scores[winner] += 1;
    } else if (isDraw) {
      room.scores.draws += 1;
    }

    if(winner&&room.targetWins===3&&room.scores[winner]>=3)room.seriesWinner=winner;
    const x=room.players.X?.identityId,o=room.players.O?.identityId;
    if(x&&o)this.rivalries.record?.(x,o,winner?room.players[winner]!.identityId:null,room.roundId,room.seriesWinner?room.players[room.seriesWinner]!.identityId:null);

    room.lastActivityAt = Date.now();
    this.broadcastRoomState(room);
  }

  private detachSocket(ws: RoomPeer): void {
    const meta = this.socketMeta.get(ws);
    if (!meta || !meta.roomCode || !meta.role) return;

    const room = this.rooms.get(meta.roomCode);
    if (room) {
      const slot = room.players[meta.role];
      if (slot && slot.socket === ws) {
        slot.socket = null;
      }
      room.lastActivityAt = Date.now();

      const hasAnyConnected =
        Boolean(room.players.X?.socket) || Boolean(room.players.O?.socket);
      if (!hasAnyConnected) {
        this.rooms.delete(room.code);
      } else {
        this.broadcastRoomState(room);
      }
    }

    this.socketMeta.set(ws, { roomCode: null, role: null, identity:meta?.identity });
  }

  private identityFor(ws:RoomPeer):GuestIdentity{
    const meta=this.socketMeta.get(ws)!;
    if(!meta.identity){meta.identity=this.rivalries.identify(undefined);sendJson(ws,{type:'session:welcome',token:meta.identity.token,playerId:meta.identity.id});}
    return meta.identity;
  }

  private toDto(room: ActiveRoom): RoomSnapshotDto {
    const x=room.players.X?.identityId,o=room.players.O?.identityId;
    const history=x&&o?this.rivalries.history?.(x,o):null;
    return {
      code: room.code,
      roundId: room.roundId,
      roundRatings: {...room.roundRatings},
      series:{targetWins:room.targetWins,winner:room.seriesWinner},
      ...(history&&x&&o?{rivalry:{X:history.wins[x]??0,O:history.wins[o]??0,draws:history.draws,seriesX:history.series[x]??0,seriesO:history.series[o]??0,persisted:!this.rivalries.issue,recent:history.recent.map(m=>({winner:m.winner===null?null:m.winner===x?'X' as const:'O' as const,at:m.at}))}}:{}),
      variant: room.variant,
      boardRule: room.boardRule,
      allowFlying: room.allowFlying,
      turnTimeLimit: room.turnTimeLimit,
      status: room.status,
      players: {
        X: room.players.X
          ? { name: room.players.X.name, connected: Boolean(room.players.X.socket), avatar: {...room.players.X.avatar} }
          : null,
        O: room.players.O
          ? { name: room.players.O.name, connected: Boolean(room.players.O.socket), avatar: {...room.players.O.avatar} }
          : null,
      },
      scores: { ...room.scores },
      rematchVotes: Array.from(room.rematchVotes),
      drawOfferFrom: room.drawOfferFrom,
      threeBoard: [...room.threeBoard],
      threeXQueue: [...room.threeXQueue],
      threeOQueue: [...room.threeOQueue],
      threeTurn: room.threeTurn,
      threeMoveCount: room.threeMoveCount,
      threeLastMove: room.threeLastMove,
      threeWin: room.threeWin,
      threeDraw: room.threeDraw,
      morrisState: room.morrisState,
      winner: room.winner,
      isDraw: room.isDraw,
      endReason: room.endReason,
    };
  }

  private broadcastRoomState(room: ActiveRoom): void {
    const dto = this.toDto(room);
    if (room.players.X?.socket) {
      sendJson(room.players.X.socket, { type: 'room:state', room: dto, yourRole: 'X' });
    }
    if (room.players.O?.socket) {
      sendJson(room.players.O.socket, { type: 'room:state', room: dto, yourRole: 'O' });
    }
  }

  private pruneIdleRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActivityAt > ROOM_IDLE_TTL_MS) {
        this.rooms.delete(code);
      }
    }
  }
}
