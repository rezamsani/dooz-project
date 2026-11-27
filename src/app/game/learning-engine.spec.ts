import { bestClassicMoves, canForceWin, dailyPuzzle, immediateWins, reviewThree, tehranDay } from './learning-engine';
import { applyMove, checkWinner, getAvailableCells, getOpponent } from './dooz-engine';
import { CellValue, Player } from './dooz.types';
import { BOTS, personalityMove, personalityMorris } from './bot-personalities';
import { applyDecision, createInitialMorrisState } from './morris-engine';

describe('daily challenge and coach',()=>{
  it('gives a deterministic two-move win that survives every defense',()=>{
    for(let day=1;day<=30;day++){
      const date=`2026-11-${String(day).padStart(2,'0')}`,board=dailyPuzzle(date);
      expect(dailyPuzzle(date)).toEqual(board);
      expect(board.filter(c=>c==='X')).toHaveLength(2);expect(board.filter(c=>c==='O')).toHaveLength(2);
      expect(checkWinner(board)).toBeNull();expect(immediateWins(board,'X')).toHaveLength(0);
      const solution=getAvailableCells(board).find(i=>{const next=[...board];next[i]='X';return canForceWin(next,'O','X',1);});
      expect(solution).toBeDefined();board[solution!]='X';
      for(const reply of getAvailableCells(board)){const next=[...board];next[reply]='O';expect(checkWinner(next)).toBeNull();expect(immediateWins(next,'X').length).toBeGreaterThan(0);}
    }
  });
  it('rejects invalid dates and uses Iran midnight',()=>{
    expect(()=>dailyPuzzle('2026-02-30')).toThrow();expect(()=>dailyPuzzle('wrong')).toThrow();
    expect(tehranDay(new Date('2026-11-26T20:45:00Z'))).toBe('2026-11-27');
  });
  it('finds a missed block and does not criticize perfect play',()=>{
    const board:CellValue[]=['O','O',null,'X',null,null,null,'X',null];
    const frame={board,currentTurn:'X' as Player,xQueue:[3,7],oQueue:[0,1],lastMoveIndex:7};
    const wrong={...frame,...applyMove(board,[3,7],[0,1],8,'X','CLASSIC'),currentTurn:'O' as Player,lastMoveIndex:8};
    expect(reviewThree([frame,wrong],'X','CLASSIC')?.better).toBe(2);
    const frames=[{board:Array<CellValue>(9).fill(null),currentTurn:'X' as Player,xQueue:[] as number[],oQueue:[] as number[],lastMoveIndex:null as number|null}];
    for(let i=0;i<9;i++){const f=frames.at(-1)!;const move=bestClassicMoves(f.board,f.currentTurn)[0];if(move===undefined)break;frames.push({...applyMove(f.board,f.xQueue,f.oQueue,move,f.currentTurn,'CLASSIC'),currentTurn:f.currentTurn==='X'?'O':'X',lastMoveIndex:move});if(checkWinner(frames.at(-1)!.board))break;}
    expect(reviewThree(frames,'X','CLASSIC')).toBeNull();expect(reviewThree(frames,'O','CLASSIC')).toBeNull();
  });
  it('Simin blocks danger and every bot makes legal Morris moves',()=>{
    expect(personalityMove('simin',['X','X',null,'O',null,null,null,null,null],[0,1],[3],'O','CLASSIC')).toBe(2);
    for (const variant of ['NINE', 'TWELVE'] as const) {
      const state = createInitialMorrisState(variant, 'X', true);
      for (const { id } of BOTS) {
        const move = personalityMorris(id, state, 'X');
        expect(move).toBeTruthy();
        expect(applyDecision(state, move!)).toBeTruthy();
      }
    }
  });

  it.each(['X', 'O'] as const)('keeps Simorgh unbeaten in classic play as %s', (bot) => {
    const seen = new Set<string>();
    const play = (board: CellValue[], turn: Player): void => {
      const winner = checkWinner(board)?.winner;
      if (winner) {
        expect(winner).toBe(bot);
        return;
      }
      const key = board.map(cell => cell ?? '-').join('') + turn;
      if (seen.has(key)) return;
      seen.add(key);
      const available = getAvailableCells(board);
      if (!available.length) return;
      const moves = turn === bot ? [personalityMove('simorgh', board, [], [], bot, 'CLASSIC')!] : available;
      for (const move of moves) {
        expect(board[move]).toBeNull();
        const next = [...board];
        next[move] = turn;
        play(next, getOpponent(turn));
      }
    };
    play(Array<CellValue>(9).fill(null), 'X');
  });

  it('looks through a Morris mill and its follow-up capture to win', () => {
    const state = createInitialMorrisState('NINE', 'X', true);
    state.inHand = { X: 0, O: 0 };
    state.action = 'MOVE';
    for (const node of [0, 1, 3]) state.board[node] = 'X';
    for (const node of [5, 10, 21]) state.board[node] = 'O';
    const move = personalityMorris('simorgh', state, 'X');
    expect(move).toEqual({ type: 'MOVE', from: 3, to: 2 });
    const removal = applyDecision(state, move!)!;
    expect(removal.action).toBe('REMOVE');
    const capture = personalityMorris('simorgh', removal, 'X');
    expect(applyDecision(removal, capture!)?.winner).toBe('X');
  });

  it('uses the fading piece order to find a real win in infinite Dooz', () => {
    const board: CellValue[] = ['X', 'X', null, 'O', 'X', null, 'O', null, 'O'];
    expect(personalityMove('simorgh', board, [0, 1, 4], [3, 6, 8], 'X', 'INFINITE')).toBe(7);
  });
});
