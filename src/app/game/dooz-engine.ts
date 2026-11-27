import {
  BoardRule,
  CellValue,
  Difficulty,
  Player,
  WinLineGeometry,
  WinResult,
} from './dooz.types';

/**
 * Winning lines on a 3x3 board with normalized SVG coordinates in a 300x300 viewBox.
 * Note: The board grid uses LTR indexing (0..8) left-to-right, top-to-bottom so
 * geometry coordinates match cleanly regardless of page RTL direction.
 */
export const WINNING_LINES: readonly WinLineGeometry[] = [
  // Rows (horizontal)
  { cells: [0, 1, 2], x1: 28, y1: 50, x2: 272, y2: 50 },
  { cells: [3, 4, 5], x1: 28, y1: 150, x2: 272, y2: 150 },
  { cells: [6, 7, 8], x1: 28, y1: 250, x2: 272, y2: 250 },
  // Columns (vertical)
  { cells: [0, 3, 6], x1: 50, y1: 28, x2: 50, y2: 272 },
  { cells: [1, 4, 7], x1: 150, y1: 28, x2: 150, y2: 272 },
  { cells: [2, 5, 8], x1: 250, y1: 28, x2: 250, y2: 272 },
  // Diagonals
  { cells: [0, 4, 8], x1: 34, y1: 34, x2: 266, y2: 266 },
  { cells: [2, 4, 6], x1: 266, y1: 34, x2: 34, y2: 266 },
];

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function createEmptyBoard(): CellValue[] {
  return Array<CellValue>(9).fill(null);
}

export function getOpponent(player: Player): Player {
  return player === 'X' ? 'O' : 'X';
}

export function checkWinner(board: readonly CellValue[]): WinResult | null {
  for (const geometry of WINNING_LINES) {
    const [a, b, c] = geometry.cells;
    const first = board[a];
    if (first && first === board[b] && first === board[c]) {
      return {
        winner: first,
        cells: geometry.cells,
        geometry,
      };
    }
  }
  return null;
}

export function isBoardFull(board: readonly CellValue[]): boolean {
  return board.every((cell) => cell !== null);
}

export function getAvailableCells(board: readonly CellValue[]): number[] {
  const available: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      available.push(i);
    }
  }
  return available;
}

export interface AppliedMove {
  board: CellValue[];
  xQueue: number[];
  oQueue: number[];
  removedIndex: number | null;
}

export function applyMove(
  board: readonly CellValue[],
  xQueue: readonly number[],
  oQueue: readonly number[],
  index: number,
  player: Player,
  rule: BoardRule,
): AppliedMove {
  const nextBoard = [...board];
  const nextX = [...xQueue];
  const nextO = [...oQueue];
  let removedIndex: number | null = null;

  if (rule === 'INFINITE') {
    const activeQueue = player === 'X' ? nextX : nextO;
    if (activeQueue.length >= 3) {
      const oldest = activeQueue.shift();
      if (oldest !== undefined) {
        nextBoard[oldest] = null;
        removedIndex = oldest;
      }
    }
    activeQueue.push(index);
  } else {
    if (player === 'X') {
      nextX.push(index);
    } else {
      nextO.push(index);
    }
  }

  nextBoard[index] = player;
  return {
    board: nextBoard,
    xQueue: nextX,
    oQueue: nextO,
    removedIndex,
  };
}

/**
 * Minimax for classic 3x3 Tic-Tac-Toe (unbeatable on HARD).
 */
function minimaxClassic(
  board: CellValue[],
  depth: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  humanPlayer: Player,
  alpha: number,
  beta: number,
  maxDepth: number,
): number {
  const win = checkWinner(board);
  if (win) {
    return win.winner === aiPlayer ? 100 - depth : depth - 100;
  }
  if (isBoardFull(board)) {
    return 0;
  }
  if (depth >= maxDepth) return evaluateBoardHeuristic(board, aiPlayer);

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiPlayer;
        const score = minimaxClassic(board, depth + 1, false, aiPlayer, humanPlayer, alpha, beta, maxDepth);
        board[i] = null;
        if (score > best) best = score;
        if (best > alpha) alpha = best;
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanPlayer;
        const score = minimaxClassic(board, depth + 1, true, aiPlayer, humanPlayer, alpha, beta, maxDepth);
        board[i] = null;
        if (score < best) best = score;
        if (best < beta) beta = best;
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

/**
 * Heuristic evaluator for Infinite (3-piece max) mode at depth limit.
 */
function evaluateBoardHeuristic(
  board: readonly CellValue[], aiPlayer: Player, fadingX?: number, fadingO?: number,
): number {
  const humanPlayer = getOpponent(aiPlayer);
  const aiFading = aiPlayer === 'X' ? fadingX : fadingO;
  const humanFading = aiPlayer === 'X' ? fadingO : fadingX;
  let score = 0;
  for (const line of WINNING_LINES) {
    let aiCount = 0;
    let humanCount = 0;
    for (const idx of line.cells) {
      if (board[idx] === aiPlayer) aiCount++;
      else if (board[idx] === humanPlayer) humanCount++;
    }
    if (aiCount === 2 && humanCount === 0) score += line.cells.some(index => index === aiFading) ? 2 : 12;
    else if (humanCount === 2 && aiCount === 0) score -= line.cells.some(index => index === humanFading) ? 2 : 14;
    else if (aiCount === 1 && humanCount === 0) score += 2;
    else if (humanCount === 1 && aiCount === 0) score -= 2;
  }
  if (board[4] === aiPlayer) score += 5;
  else if (board[4] === humanPlayer) score -= 5;
  return score;
}

const PREFERRED_CELLS = [4, 0, 2, 6, 8, 1, 3, 5, 7];

/**
 * Depth-limited Minimax with alpha-beta pruning for Infinite (max 3 pieces) mode.
 */
function minimaxInfinite(
  board: readonly CellValue[],
  xQueue: readonly number[],
  oQueue: readonly number[],
  depth: number,
  maxDepth: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  humanPlayer: Player,
  alpha: number,
  beta: number,
): number {
  const win = checkWinner(board);
  if (win) {
    return win.winner === aiPlayer ? 100 - depth : depth - 100;
  }
  if (depth >= maxDepth) {
    return evaluateBoardHeuristic(board, aiPlayer, xQueue.length === 3 ? xQueue[0] : undefined,
      oQueue.length === 3 ? oQueue[0] : undefined);
  }

  const available = PREFERRED_CELLS.filter(index => board[index] === null);
  const activePlayer = isMaximizing ? aiPlayer : humanPlayer;

  if (isMaximizing) {
    let best = -Infinity;
    for (const cellIdx of available) {
      const next = applyMove(board, xQueue, oQueue, cellIdx, activePlayer, 'INFINITE');
      const score = minimaxInfinite(
        next.board,
        next.xQueue,
        next.oQueue,
        depth + 1,
        maxDepth,
        false,
        aiPlayer,
        humanPlayer,
        alpha,
        beta,
      );
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const cellIdx of available) {
      const next = applyMove(board, xQueue, oQueue, cellIdx, activePlayer, 'INFINITE');
      const score = minimaxInfinite(
        next.board,
        next.xQueue,
        next.oQueue,
        depth + 1,
        maxDepth,
        true,
        aiPlayer,
        humanPlayer,
        alpha,
        beta,
      );
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

function findImmediateWinningMove(
  board: readonly CellValue[],
  xQueue: readonly number[],
  oQueue: readonly number[],
  player: Player,
  rule: BoardRule,
): number | null {
  const available = getAvailableCells(board);
  for (const idx of available) {
    const next = applyMove(board, xQueue, oQueue, idx, player, rule);
    const win = checkWinner(next.board);
    if (win && win.winner === player) {
      return idx;
    }
  }
  return null;
}

export function chooseAiMove(
  board: readonly CellValue[],
  xQueue: readonly number[],
  oQueue: readonly number[],
  aiPlayer: Player,
  difficulty: Difficulty,
  rule: BoardRule,
  searchDepth?: number,
): number | null {
  const available = getAvailableCells(board);
  if (available.length === 0) return null;

  const humanPlayer = getOpponent(aiPlayer);

  // Instant opening optimization for empty classic board
  if (available.length === 9 && difficulty === 'HARD' && (rule === 'CLASSIC' || searchDepth === undefined)) {
    const strongOpenings = [4, 0, 2, 6, 8];
    return strongOpenings[Math.floor(Math.random() * strongOpenings.length)] ?? 4;
  }

  // Easy: mostly playful random, 35% chance to take an obvious win
  if (difficulty === 'EASY') {
    if (Math.random() < 0.35) {
      const winNow = findImmediateWinningMove(board, xQueue, oQueue, aiPlayer, rule);
      if (winNow !== null) return winNow;
    }
    return available[Math.floor(Math.random() * available.length)] ?? available[0];
  }

  // Always take immediate winning move on MEDIUM and HARD
  const immediateWin = findImmediateWinningMove(board, xQueue, oQueue, aiPlayer, rule);
  if (immediateWin !== null) {
    return immediateWin;
  }

  // Medium: blocks opponent 75% of the time, otherwise mixes smart & random moves
  if (difficulty === 'MEDIUM') {
    if (Math.random() < 0.78) {
      const blockMove = findImmediateWinningMove(board, xQueue, oQueue, humanPlayer, rule);
      if (blockMove !== null) return blockMove;
    }
    if (Math.random() < 0.45) {
      return available[Math.floor(Math.random() * available.length)] ?? available[0];
    }
  }

  // Hard (and remaining Medium): run Minimax
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const idx of available) {
    let score: number;
    if (rule === 'CLASSIC') {
      const nextBoard = [...board];
      nextBoard[idx] = aiPlayer;
      score = minimaxClassic(nextBoard, 0, false, aiPlayer, humanPlayer, -Infinity, Infinity,
        searchDepth === undefined ? Infinity : searchDepth - 1);
    } else {
      const next = applyMove(board, xQueue, oQueue, idx, aiPlayer, 'INFINITE');
      score = minimaxInfinite(
        next.board,
        next.xQueue,
        next.oQueue,
        1,
        searchDepth ?? 5,
        false,
        aiPlayer,
        humanPlayer,
        -Infinity,
        Infinity,
      );
    }

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [idx];
    } else if (score === bestScore) {
      bestMoves.push(idx);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)] ?? available[0];
}
