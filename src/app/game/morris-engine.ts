import { Difficulty, Player } from './dooz.types';
import { getOpponent } from './dooz-engine';
import {
  MorrisEdge,
  MorrisMill,
  MorrisNodeCoord,
  MorrisState,
  MorrisVariant,
} from './morris.types';

/**
 * 24-node coordinates on a 400x400 board (3 concentric squares: outer, middle, inner).
 * Spacing between rings is balanced (34 -> 92 -> 146 -> 200) for comfortable touch targets.
 */
export const MORRIS_NODES: readonly MorrisNodeCoord[] = [
  // Outer square (0..7 clockwise from top-left)
  { id: 0, x: 34, y: 34, ring: 'outer' },
  { id: 1, x: 200, y: 34, ring: 'outer' },
  { id: 2, x: 366, y: 34, ring: 'outer' },
  { id: 3, x: 366, y: 200, ring: 'outer' },
  { id: 4, x: 366, y: 366, ring: 'outer' },
  { id: 5, x: 200, y: 366, ring: 'outer' },
  { id: 6, x: 34, y: 366, ring: 'outer' },
  { id: 7, x: 34, y: 200, ring: 'outer' },

  // Middle square (8..15 clockwise from top-left)
  { id: 8, x: 92, y: 92, ring: 'middle' },
  { id: 9, x: 200, y: 92, ring: 'middle' },
  { id: 10, x: 308, y: 92, ring: 'middle' },
  { id: 11, x: 308, y: 200, ring: 'middle' },
  { id: 12, x: 308, y: 308, ring: 'middle' },
  { id: 13, x: 200, y: 308, ring: 'middle' },
  { id: 14, x: 92, y: 308, ring: 'middle' },
  { id: 15, x: 92, y: 200, ring: 'middle' },

  // Inner square (16..23 clockwise from top-left)
  { id: 16, x: 146, y: 146, ring: 'inner' },
  { id: 17, x: 200, y: 146, ring: 'inner' },
  { id: 18, x: 254, y: 146, ring: 'inner' },
  { id: 19, x: 254, y: 200, ring: 'inner' },
  { id: 20, x: 254, y: 254, ring: 'inner' },
  { id: 21, x: 200, y: 254, ring: 'inner' },
  { id: 22, x: 146, y: 254, ring: 'inner' },
  { id: 23, x: 146, y: 200, ring: 'inner' },
];

const ORTHOGONAL_EDGES: readonly MorrisEdge[] = [
  // Outer square
  { from: 0, to: 1, diagonal: false },
  { from: 1, to: 2, diagonal: false },
  { from: 2, to: 3, diagonal: false },
  { from: 3, to: 4, diagonal: false },
  { from: 4, to: 5, diagonal: false },
  { from: 5, to: 6, diagonal: false },
  { from: 6, to: 7, diagonal: false },
  { from: 7, to: 0, diagonal: false },
  // Middle square
  { from: 8, to: 9, diagonal: false },
  { from: 9, to: 10, diagonal: false },
  { from: 10, to: 11, diagonal: false },
  { from: 11, to: 12, diagonal: false },
  { from: 12, to: 13, diagonal: false },
  { from: 13, to: 14, diagonal: false },
  { from: 14, to: 15, diagonal: false },
  { from: 15, to: 8, diagonal: false },
  // Inner square
  { from: 16, to: 17, diagonal: false },
  { from: 17, to: 18, diagonal: false },
  { from: 18, to: 19, diagonal: false },
  { from: 19, to: 20, diagonal: false },
  { from: 20, to: 21, diagonal: false },
  { from: 21, to: 22, diagonal: false },
  { from: 22, to: 23, diagonal: false },
  { from: 23, to: 16, diagonal: false },
  // Orthogonal spokes
  { from: 1, to: 9, diagonal: false },
  { from: 9, to: 17, diagonal: false },
  { from: 3, to: 11, diagonal: false },
  { from: 11, to: 19, diagonal: false },
  { from: 5, to: 13, diagonal: false },
  { from: 13, to: 21, diagonal: false },
  { from: 7, to: 15, diagonal: false },
  { from: 15, to: 23, diagonal: false },
];

const DIAGONAL_EDGES: readonly MorrisEdge[] = [
  { from: 0, to: 8, diagonal: true },
  { from: 8, to: 16, diagonal: true },
  { from: 2, to: 10, diagonal: true },
  { from: 10, to: 18, diagonal: true },
  { from: 4, to: 12, diagonal: true },
  { from: 12, to: 20, diagonal: true },
  { from: 6, to: 14, diagonal: true },
  { from: 14, to: 22, diagonal: true },
];

const COMMON_MILLS: readonly MorrisMill[] = [
  // Outer square sides
  [0, 1, 2],
  [2, 3, 4],
  [4, 5, 6],
  [6, 7, 0],
  // Middle square sides
  [8, 9, 10],
  [10, 11, 12],
  [12, 13, 14],
  [14, 15, 8],
  // Inner square sides
  [16, 17, 18],
  [18, 19, 20],
  [20, 21, 22],
  [22, 23, 16],
  // Orthogonal spokes
  [1, 9, 17],
  [3, 11, 19],
  [5, 13, 21],
  [7, 15, 23],
];

const DIAGONAL_MILLS: readonly MorrisMill[] = [
  [0, 8, 16],
  [2, 10, 18],
  [4, 12, 20],
  [6, 14, 22],
];

function buildAdjacency(edges: readonly MorrisEdge[]): readonly (readonly number[])[] {
  const adj: number[][] = Array.from({ length: 24 }, () => []);
  for (const edge of edges) {
    adj[edge.from].push(edge.to);
    adj[edge.to].push(edge.from);
  }
  return adj;
}

const ADJACENCY_NINE = buildAdjacency(ORTHOGONAL_EDGES);
const ADJACENCY_TWELVE = buildAdjacency([...ORTHOGONAL_EDGES, ...DIAGONAL_EDGES]);

const MILLS_NINE: readonly MorrisMill[] = COMMON_MILLS;
const MILLS_TWELVE: readonly MorrisMill[] = [...COMMON_MILLS, ...DIAGONAL_MILLS];

export function getMorrisEdges(variant: MorrisVariant): readonly MorrisEdge[] {
  return variant === 'TWELVE'
    ? [...ORTHOGONAL_EDGES, ...DIAGONAL_EDGES]
    : ORTHOGONAL_EDGES;
}

export function getMorrisAdjacency(variant: MorrisVariant): readonly (readonly number[])[] {
  return variant === 'TWELVE' ? ADJACENCY_TWELVE : ADJACENCY_NINE;
}

export function getMorrisMills(variant: MorrisVariant): readonly MorrisMill[] {
  return variant === 'TWELVE' ? MILLS_TWELVE : MILLS_NINE;
}

export function getInitialPieceCount(variant: MorrisVariant): number {
  return variant === 'TWELVE' ? 12 : 9;
}

export function createInitialMorrisState(
  variant: MorrisVariant,
  starter: Player = 'X',
  allowFlying = true,
): MorrisState {
  const pieces = getInitialPieceCount(variant);
  return {
    variant,
    allowFlying,
    board: Array<Player | null>(24).fill(null),
    inHand: { X: pieces, O: pieces },
    captured: { X: 0, O: 0 },
    currentTurn: starter,
    action: 'PLACE',
    selectedNode: null,
    lastMill: null,
    lastMovedNode: null,
    moveCount: 0,
    winner: null,
    isDraw: false,
    winReason: null,
  };
}

export function countPiecesOnBoard(board: readonly (Player | null)[], player: Player): number {
  let count = 0;
  for (const cell of board) {
    if (cell === player) count++;
  }
  return count;
}

export function canPlayerFly(state: MorrisState, player: Player): boolean {
  return (
    state.allowFlying &&
    state.inHand[player] === 0 &&
    countPiecesOnBoard(state.board, player) === 3
  );
}

export function findFormedMillAt(
  board: readonly (Player | null)[],
  nodeIndex: number,
  player: Player,
  variant: MorrisVariant,
): MorrisMill | null {
  const mills = getMorrisMills(variant);
  for (const mill of mills) {
    if (
      (mill[0] === nodeIndex || mill[1] === nodeIndex || mill[2] === nodeIndex) &&
      board[mill[0]] === player &&
      board[mill[1]] === player &&
      board[mill[2]] === player
    ) {
      return mill;
    }
  }
  return null;
}

export function isNodeInMill(
  board: readonly (Player | null)[],
  nodeIndex: number,
  player: Player,
  variant: MorrisVariant,
): boolean {
  return findFormedMillAt(board, nodeIndex, player, variant) !== null;
}

/**
 * Traditional Morris mill-protection rule:
 * Opponent pieces inside an active mill cannot be removed unless ALL opponent pieces are in mills.
 */
export function getRemovableOpponentNodes(
  board: readonly (Player | null)[],
  opponent: Player,
  variant: MorrisVariant,
): number[] {
  const nonMillNodes: number[] = [];
  const allOpponentNodes: number[] = [];

  for (let i = 0; i < 24; i++) {
    if (board[i] === opponent) {
      allOpponentNodes.push(i);
      if (!isNodeInMill(board, i, opponent, variant)) {
        nonMillNodes.push(i);
      }
    }
  }

  return nonMillNodes.length > 0 ? nonMillNodes : allOpponentNodes;
}

export function getValidDestinationsForNode(state: MorrisState, fromNode: number): number[] {
  const player = state.currentTurn;
  if (state.board[fromNode] !== player) return [];

  if (canPlayerFly(state, player)) {
    const empty: number[] = [];
    for (let i = 0; i < 24; i++) {
      if (state.board[i] === null) empty.push(i);
    }
    return empty;
  }

  const neighbors = getMorrisAdjacency(state.variant)[fromNode] ?? [];
  return neighbors.filter((n) => state.board[n] === null);
}

export function hasAnyLegalMove(state: MorrisState, player: Player): boolean {
  if (state.inHand[player] > 0) {
    return state.board.some((cell) => cell === null);
  }
  const onBoard = countPiecesOnBoard(state.board, player);
  if (onBoard < 3) return false;
  if (state.allowFlying && onBoard === 3) {
    return state.board.some((cell) => cell === null);
  }
  const adj = getMorrisAdjacency(state.variant);
  for (let i = 0; i < 24; i++) {
    if (state.board[i] === player) {
      for (const neighbor of adj[i]) {
        if (state.board[neighbor] === null) {
          return true;
        }
      }
    }
  }
  return false;
}

function finalizeTurnTransition(next: MorrisState): MorrisState {
  const opponent = getOpponent(next.currentTurn);

  // Special 12-piece full board case after placing phase
  if (
    next.inHand.X === 0 &&
    next.inHand.O === 0 &&
    next.board.every((cell) => cell !== null)
  ) {
    return {
      ...next,
      isDraw: true,
      selectedNode: null,
    };
  }

  // Check if opponent lost by having fewer than 3 pieces after placing phase
  if (next.inHand[opponent] === 0 && countPiecesOnBoard(next.board, opponent) < 3) {
    return {
      ...next,
      winner: next.currentTurn,
      winReason: 'PIECES',
      selectedNode: null,
    };
  }

  const nextAction = next.inHand[opponent] > 0 ? 'PLACE' : 'MOVE';
  const transitioned: MorrisState = {
    ...next,
    currentTurn: opponent,
    action: nextAction,
    selectedNode: null,
  };

  // Check if opponent is completely blocked on their turn
  if (!hasAnyLegalMove(transitioned, opponent)) {
    return {
      ...transitioned,
      winner: next.currentTurn,
      winReason: 'BLOCKED',
    };
  }

  return transitioned;
}

export function applyMorrisPlace(state: MorrisState, nodeIndex: number): MorrisState | null {
  if (state.winner || state.isDraw || state.action !== 'PLACE') return null;
  if (nodeIndex < 0 || nodeIndex >= 24 || state.board[nodeIndex] !== null) return null;

  const player = state.currentTurn;
  if (state.inHand[player] <= 0) return null;

  const nextBoard = [...state.board];
  nextBoard[nodeIndex] = player;

  const nextInHand: Record<Player, number> = {
    ...state.inHand,
    [player]: state.inHand[player] - 1,
  };

  const formedMill = findFormedMillAt(nextBoard, nodeIndex, player, state.variant);
  const opponent = getOpponent(player);
  const removable = formedMill
    ? getRemovableOpponentNodes(nextBoard, opponent, state.variant)
    : [];

  const updated: MorrisState = {
    ...state,
    board: nextBoard,
    inHand: nextInHand,
    selectedNode: null,
    lastMill: formedMill,
    lastMovedNode: nodeIndex,
    moveCount: state.moveCount + 1,
  };

  if (formedMill && removable.length > 0) {
    return {
      ...updated,
      action: 'REMOVE',
    };
  }

  return finalizeTurnTransition(updated);
}

export function applyMorrisMove(
  state: MorrisState,
  fromNode: number,
  toNode: number,
): MorrisState | null {
  if (state.winner || state.isDraw || state.action !== 'MOVE') return null;
  const player = state.currentTurn;
  if (state.board[fromNode] !== player || state.board[toNode] !== null) return null;

  const validTargets = getValidDestinationsForNode(state, fromNode);
  if (!validTargets.includes(toNode)) return null;

  const nextBoard = [...state.board];
  nextBoard[fromNode] = null;
  nextBoard[toNode] = player;

  const formedMill = findFormedMillAt(nextBoard, toNode, player, state.variant);
  const opponent = getOpponent(player);
  const removable = formedMill
    ? getRemovableOpponentNodes(nextBoard, opponent, state.variant)
    : [];

  const updated: MorrisState = {
    ...state,
    board: nextBoard,
    selectedNode: null,
    lastMill: formedMill,
    lastMovedNode: toNode,
    moveCount: state.moveCount + 1,
  };

  if (formedMill && removable.length > 0) {
    return {
      ...updated,
      action: 'REMOVE',
    };
  }

  return finalizeTurnTransition(updated);
}

export function applyMorrisRemove(state: MorrisState, targetNode: number): MorrisState | null {
  if (state.winner || state.isDraw || state.action !== 'REMOVE') return null;
  const player = state.currentTurn;
  const opponent = getOpponent(player);
  const removable = getRemovableOpponentNodes(state.board, opponent, state.variant);
  if (!removable.includes(targetNode)) return null;

  const nextBoard = [...state.board];
  nextBoard[targetNode] = null;

  const updated: MorrisState = {
    ...state,
    board: nextBoard,
    captured: {
      ...state.captured,
      [player]: state.captured[player] + 1,
    },
    selectedNode: null,
    lastMovedNode: targetNode,
  };

  return finalizeTurnTransition(updated);
}

// ---------- AI ENGINE FOR 9-PIECE & 12-PIECE MORRIS ----------

export type MorrisAiDecision =
  | { type: 'PLACE'; to: number }
  | { type: 'MOVE'; from: number; to: number }
  | { type: 'REMOVE'; target: number };

export function evaluateMorrisBoard(state: MorrisState, aiPlayer: Player): number {
  const humanPlayer = getOpponent(aiPlayer);
  if (state.winner === aiPlayer) return 10000;
  if (state.winner === humanPlayer) return -10000;
  if (state.isDraw) return 0;

  const aiTotal = state.inHand[aiPlayer] + countPiecesOnBoard(state.board, aiPlayer);
  const humanTotal = state.inHand[humanPlayer] + countPiecesOnBoard(state.board, humanPlayer);

  let score = (aiTotal - humanTotal) * 65;

  const mills = getMorrisMills(state.variant);
  for (const mill of mills) {
    let aiCount = 0;
    let humanCount = 0;
    for (const idx of mill) {
      if (state.board[idx] === aiPlayer) aiCount++;
      else if (state.board[idx] === humanPlayer) humanCount++;
    }
    if (aiCount === 3) score += 28;
    else if (humanCount === 3) score -= 28;
    else if (aiCount === 2 && humanCount === 0) score += 16;
    else if (humanCount === 2 && aiCount === 0) score -= 18;
  }

  // Mobility & junction control
  const adj = getMorrisAdjacency(state.variant);
  for (let i = 0; i < 24; i++) {
    const owner = state.board[i];
    if (!owner) continue;
    const degree = adj[i].length;
    let emptyNeighbors = 0;
    for (const nb of adj[i]) {
      if (state.board[nb] === null) emptyNeighbors++;
    }
    const mobilityBonus = emptyNeighbors * 3 + degree * 1.5;
    score += owner === aiPlayer ? mobilityBonus : -mobilityBonus;
  }

  return score;
}

export function generateLegalDecisions(state: MorrisState): MorrisAiDecision[] {
  const player = state.currentTurn;
  if (state.action === 'REMOVE') {
    const opponent = getOpponent(player);
    return getRemovableOpponentNodes(state.board, opponent, state.variant).map((target) => ({
      type: 'REMOVE',
      target,
    }));
  }

  if (state.action === 'PLACE') {
    const decisions: MorrisAiDecision[] = [];
    for (let i = 0; i < 24; i++) {
      if (state.board[i] === null) {
        decisions.push({ type: 'PLACE', to: i });
      }
    }
    return decisions;
  }

  // MOVE / FLYING
  const decisions: MorrisAiDecision[] = [];
  for (let from = 0; from < 24; from++) {
    if (state.board[from] === player) {
      const targets = getValidDestinationsForNode(state, from);
      for (const to of targets) {
        decisions.push({ type: 'MOVE', from, to });
      }
    }
  }
  return decisions;
}

export function applyDecision(state: MorrisState, decision: MorrisAiDecision): MorrisState | null {
  switch (decision.type) {
    case 'PLACE':
      return applyMorrisPlace(state, decision.to);
    case 'MOVE':
      return applyMorrisMove(state, decision.from, decision.to);
    case 'REMOVE':
      return applyMorrisRemove(state, decision.target);
  }
}

function alphabetaMorris(
  state: MorrisState,
  depth: number,
  alpha: number,
  beta: number,
  aiPlayer: Player,
): number {
  if (depth === 0 || state.winner !== null || state.isDraw) {
    return evaluateMorrisBoard(state, aiPlayer);
  }

  const decisions = generateLegalDecisions(state);
  if (decisions.length === 0) {
    return evaluateMorrisBoard(state, aiPlayer);
  }

  const isMaximizing = state.currentTurn === aiPlayer;

  // Cap branching factor slightly during flying/opening to keep search snappy (<15ms)
  const limitedDecisions =
    decisions.length > 26
      ? decisions
          .map((d) => {
            const next = applyDecision(state, d);
            return { d, next, quick: next ? evaluateMorrisBoard(next, aiPlayer) : 0 };
          })
          .sort((a, b) => (isMaximizing ? b.quick - a.quick : a.quick - b.quick))
          .slice(0, 14)
          .map((item) => item.d)
      : decisions;

  if (isMaximizing) {
    let best = -Infinity;
    for (const d of limitedDecisions) {
      const next = applyDecision(state, d);
      if (!next) continue;
      // If same player gets REMOVE immediately, keep searching without penalizing depth twice
      const nextDepth = next.currentTurn === state.currentTurn ? depth : depth - 1;
      const val = alphabetaMorris(next, nextDepth, alpha, beta, aiPlayer);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const d of limitedDecisions) {
      const next = applyDecision(state, d);
      if (!next) continue;
      const nextDepth = next.currentTurn === state.currentTurn ? depth : depth - 1;
      const val = alphabetaMorris(next, nextDepth, alpha, beta, aiPlayer);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function chooseMorrisAiDecision(
  state: MorrisState,
  aiPlayer: Player,
  difficulty: Difficulty,
): MorrisAiDecision | null {
  const decisions = generateLegalDecisions(state);
  if (decisions.length === 0) return null;

  // EASY: playful random with occasional opportunistic mill/remove
  if (difficulty === 'EASY') {
    if (Math.random() < 0.3) {
      const scored = decisions
        .map((d) => {
          const next = applyDecision(state, d);
          return { d, score: next ? evaluateMorrisBoard(next, aiPlayer) : -9999 };
        })
        .sort((a, b) => b.score - a.score);
      return scored[0]?.d ?? decisions[0];
    }
    return decisions[Math.floor(Math.random() * decisions.length)] ?? decisions[0];
  }

  // MEDIUM: 1-ply smart heuristic with slight randomness
  if (difficulty === 'MEDIUM') {
    const scored = decisions
      .map((d) => {
        const next = applyDecision(state, d);
        if (!next) return { d, score: -99999 };
        let s = evaluateMorrisBoard(next, aiPlayer);
        if (next.action === 'REMOVE' && next.currentTurn === aiPlayer) {
          s += 90; // Strong incentive to form a mill
        }
        return { d, score: s + Math.random() * 6 };
      })
      .sort((a, b) => b.score - a.score);

    const topChoices = scored.slice(0, Math.min(2, scored.length));
    const pickIndex = Math.random() < 0.78 ? 0 : topChoices.length - 1;
    return topChoices[pickIndex]?.d ?? decisions[0];
  }

  // HARD: 2-ply alpha-beta search (including full mill+remove follow-ups)
  let bestScore = -Infinity;
  let bestDecisions: MorrisAiDecision[] = [];

  for (const d of decisions) {
    const next = applyDecision(state, d);
    if (!next) continue;
    const nextDepth = next.currentTurn === aiPlayer ? 2 : 1;
    const score = alphabetaMorris(next, nextDepth, -Infinity, Infinity, aiPlayer);
    if (score > bestScore) {
      bestScore = score;
      bestDecisions = [d];
    } else if (score === bestScore) {
      bestDecisions.push(d);
    }
  }

  return bestDecisions[Math.floor(Math.random() * bestDecisions.length)] ?? decisions[0];
}
