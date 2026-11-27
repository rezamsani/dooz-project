import {
  BoardRule,
  CellValue,
  GameVariant,
  Player,
  QuickEmoteId,
  ScoreBoard,
  TurnTimeLimit,
  WinResult,
} from './dooz.types';
import { MorrisState } from './morris.types';
import { PlayerAvatar } from './avatar';

export interface OnlinePlayerInfo {
  name: string;
  connected: boolean;
  avatar?: PlayerAvatar;
}

export interface RoomSnapshotDto {
  code: string;
  roundId?: string;
  series?: {targetWins:0|3;winner:Player|null};
  rivalry?: {X:number;O:number;draws:number;seriesX:number;seriesO:number;persisted:boolean;recent:{winner:Player|null;at:number}[]};
  variant: GameVariant;
  boardRule: BoardRule;
  allowFlying: boolean;
  turnTimeLimit: TurnTimeLimit;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: {
    X: OnlinePlayerInfo | null;
    O: OnlinePlayerInfo | null;
  };
  scores: ScoreBoard;
  rematchVotes: Player[];
  drawOfferFrom: Player | null;
  // 3-piece state (when variant === 'THREE')
  threeBoard: CellValue[];
  threeXQueue: number[];
  threeOQueue: number[];
  threeTurn: Player;
  threeMoveCount: number;
  threeLastMove: number | null;
  threeWin: WinResult | null;
  threeDraw: boolean;
  // Morris state (when variant === 'NINE' | 'TWELVE')
  morrisState: MorrisState | null;
  // Outcome metadata
  winner: Player | null;
  isDraw: boolean;
  endReason: 'NORMAL' | 'RESIGN' | 'TIMEOUT' | 'DRAW_AGREED' | null;
}

export type ClientWsMessage =
  | {type:'session:hello';token?:string}
  | {
      type: 'room:create';
      playerName: string;
      avatar?: PlayerAvatar;
      targetWins?:0|3;
      variant: GameVariant;
      boardRule: BoardRule;
      allowFlying: boolean;
      turnTimeLimit: TurnTimeLimit;
    }
  | {
      type: 'room:join';
      code: string;
      playerName: string;
      avatar?: PlayerAvatar;
      allowTwelve?: boolean;
    }
  | { type: 'room:move_three'; index: number }
  | { type: 'room:morris_place'; nodeId: number }
  | { type: 'room:morris_move'; from: number; to: number }
  | { type: 'room:morris_remove'; target: number }
  | { type: 'room:resign' }
  | { type: 'room:timeout' }
  | { type: 'room:draw_offer' }
  | { type: 'room:draw_respond'; accept: boolean }
  | { type: 'room:rematch' }
  | { type: 'room:emote'; emoteId: QuickEmoteId }
  | { type: 'room:leave' };

export type ServerWsMessage =
  | {type:'session:welcome';token:string;playerId:string}
  | {
      type: 'room:state';
      room: RoomSnapshotDto;
      yourRole: Player;
    }
  | {
      type: 'room:emote';
      from: Player;
      senderName: string;
      emoteId: QuickEmoteId;
      timestamp: number;
    }
  | {
      type: 'room:error';
      message: string;
    }
  | {
      type: 'room:left';
    };
