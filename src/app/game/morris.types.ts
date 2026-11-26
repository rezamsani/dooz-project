import { Player } from './dooz.types';

export type MorrisVariant = 'NINE' | 'TWELVE';
export type MorrisTurnAction = 'PLACE' | 'MOVE' | 'REMOVE';

export interface MorrisNodeCoord {
  id: number;
  x: number;
  y: number;
  ring: 'outer' | 'middle' | 'inner';
}

export interface MorrisEdge {
  from: number;
  to: number;
  diagonal: boolean;
}

export type MorrisMill = readonly [number, number, number];

export interface MorrisState {
  variant: MorrisVariant;
  allowFlying: boolean;
  board: (Player | null)[];
  inHand: Record<Player, number>;
  captured: Record<Player, number>;
  currentTurn: Player;
  action: MorrisTurnAction;
  selectedNode: number | null;
  lastMill: MorrisMill | null;
  lastMovedNode: number | null;
  moveCount: number;
  winner: Player | null;
  isDraw: boolean;
  winReason: 'PIECES' | 'BLOCKED' | null;
}

export interface MorrisSnapshot {
  board: (Player | null)[];
  inHand: Record<Player, number>;
  captured: Record<Player, number>;
  currentTurn: Player;
  action: MorrisTurnAction;
  lastMill: MorrisMill | null;
  lastMovedNode: number | null;
  moveCount: number;
}
