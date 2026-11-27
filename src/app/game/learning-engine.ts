import { CellValue, Player, BoardRule } from './dooz.types';
import { applyMove, checkWinner, getAvailableCells, getOpponent } from './dooz-engine';

const solved = new Map<string,number>();
export function classicValue(board: readonly CellValue[], turn: Player): number {
  const winner=checkWinner(board)?.winner;
  if(winner)return winner===turn?1:-1;
  const available=getAvailableCells(board);if(!available.length)return 0;
  const key=board.map(c=>c??'-').join('')+turn;
  const cached=solved.get(key);if(cached!==undefined)return cached;
  const value=Math.max(...available.map(index=>{const next=[...board];next[index]=turn;return -classicValue(next,getOpponent(turn));}));
  solved.set(key,value);return value;
}
export function bestClassicMoves(board: readonly CellValue[],turn:Player):number[]{
  if(checkWinner(board))return [];
  const scores=getAvailableCells(board).map(index=>{const next=[...board];next[index]=turn;return {index,value:-classicValue(next,getOpponent(turn))};});
  const best=Math.max(...scores.map(s=>s.value));return scores.filter(s=>s.value===best).map(s=>s.index);
}
export function canForceWin(board: readonly CellValue[],turn:Player,hero:Player,movesLeft:number):boolean {
  const win=checkWinner(board);if(win)return win.winner===hero;
  const cells=getAvailableCells(board);if(!cells.length||movesLeft<=0)return false;
  const results=cells.map(index=>{const next=[...board];next[index]=turn;return canForceWin(next,getOpponent(turn),hero,movesLeft-(turn===hero?1:0));});
  return turn===hero?results.some(Boolean):results.every(Boolean);
}
export function immediateWins(board:readonly CellValue[],player:Player):number[]{
  return getAvailableCells(board).filter(i=>{const next=[...board];next[i]=player;return checkWinner(next)?.winner===player;});
}

let puzzles:CellValue[][]|null=null;
export function dailyPuzzle(date:string):CellValue[]{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid puzzle date');
  if(!puzzles){
    puzzles=[];
    for(let a=0;a<9;a++)for(let b=a+1;b<9;b++)for(let c=0;c<9;c++)for(let d=c+1;d<9;d++){
      if(new Set([a,b,c,d]).size!==4)continue;
      const board:CellValue[]=Array(9).fill(null);board[a]=board[b]='X';board[c]=board[d]='O';
      if(!checkWinner(board)&&!immediateWins(board,'X').length&&canForceWin(board,'X','X',2))puzzles.push(board);
    }
  }
  let hash=2166136261;for(const char of 'dooz-daily-v1:'+date)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return [...puzzles[(hash>>>0)%puzzles.length]];
}
export function tehranDay(now=new Date()):string{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(name:string)=>parts.find(p=>p.type===name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export interface ReviewPosition {board:CellValue[];currentTurn:Player;xQueue:number[];oQueue:number[];lastMoveIndex:number|null;}
export interface ThreeLesson {board:CellValue[];player:Player;played:number;better:number;rule:BoardRule;xQueue:number[];oQueue:number[];message:string;exact:boolean;}
export function reviewThree(frames:readonly ReviewPosition[],hero:Player,rule:BoardRule):ThreeLesson|null{
  for(let i=0;i<frames.length-1;i++){
    const before=frames[i],after=frames[i+1],played=after.lastMoveIndex;
    if(before.currentTurn!==hero||played===null||checkWinner(before.board))continue;
    let better:number|undefined;
    if(rule==='CLASSIC'){
      const choices=bestClassicMoves(before.board,hero);
      const actual=-classicValue(after.board,getOpponent(hero));
      const potential=classicValue(before.board,hero);
      if(potential<=actual)continue;
      better=choices[0];
    }else{
      const wins=getAvailableCells(before.board).filter(index=>checkWinner(applyMove(before.board,before.xQueue,before.oQueue,index,hero,rule).board)?.winner===hero);
      if(wins.length&&!wins.includes(played))better=wins[0];
      else {
        const danger=getAvailableCells(after.board).some(index=>checkWinner(applyMove(after.board,after.xQueue,after.oQueue,index,getOpponent(hero),rule).board)?.winner===getOpponent(hero));
        if(danger)better=getAvailableCells(before.board).find(index=>{
          const next=applyMove(before.board,before.xQueue,before.oQueue,index,hero,rule);
          return !getAvailableCells(next.board).some(j=>checkWinner(applyMove(next.board,next.xQueue,next.oQueue,j,getOpponent(hero),rule).board)?.winner===getOpponent(hero));
        });
      }
    }
    if(better===undefined||better===played)continue;
    return {...before,player:hero,played,better,rule,message:immediateWins(before.board,hero).includes(better)?'اینجا یک برد آماده داشتی. دوباره امتحان کن.':immediateWins(after.board,getOpponent(hero)).length?'این حرکت راه دوز حریف را باز گذاشت. راه امن‌تر را پیدا کن.':'اینجا فرصت نتیجهٔ بهتری وجود داشت. حرکت بهتر را پیدا کن.',exact:rule==='CLASSIC'};
  }
  return null;
}
