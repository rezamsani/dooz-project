import { BoardRule, CellValue, Player } from './dooz.types';
import { applyMove, checkWinner, chooseAiMove, getAvailableCells, getOpponent } from './dooz-engine';
import { MorrisState } from './morris.types';
import { applyDecision, chooseMorrisAiDecision, evaluateMorrisBoard, generateLegalDecisions, getMorrisMills } from './morris-engine';
export const BOTS = [
  { id: 'baran', name: 'بارانِ برق‌پا', difficulty: 'EASY', level: 1, style: 'بازیگوش و حمله‌ور', requiredCoins: 0 },
  { id: 'simin', name: 'سیمینِ سپردار', difficulty: 'MEDIUM', level: 2, style: 'دفاع و بستن مسیر', requiredCoins: 1 },
  { id: 'rostam', name: 'رستمِ دام‌گذار', difficulty: 'HARD', level: 3, style: 'تله و ضدحمله', requiredCoins: 2 },
  { id: 'azar', name: 'آذرِ دودام', difficulty: 'HARD', level: 4, style: 'چند تهدید هم‌زمان', requiredCoins: 5 },
  { id: 'zal', name: 'زالِ هفت‌خوان', difficulty: 'HARD', level: 5, style: 'برنامه‌ریزی چند نوبت جلوتر', requiredCoins: 9 },
  { id: 'simorgh', name: 'سیمرغِ دوربین', difficulty: 'HARD', level: 6, style: 'بازی بی‌نقص در دوز کلاسیک', requiredCoins: 15 },
] as const;
export type BotId=typeof BOTS[number]['id'];

const SEARCH_BY_BOT = {
  rostam: { classicDepth: 3, infiniteDepth: 5, morris: { depth: 2, maxPositions: 2400 } },
  azar: { classicDepth: 5, infiniteDepth: 7, morris: { depth: 3, maxPositions: 4500 } },
  zal: { classicDepth: 7, infiniteDepth: 8, morris: { depth: 4, maxPositions: 8500 } },
  simorgh: { classicDepth: 9, infiniteDepth: 10, morris: { depth: 5, maxPositions: 14000 } },
} as const;

export function personalityMove(id:BotId,board:CellValue[],x:number[],o:number[],player:Player,rule:BoardRule):number|null{
  const available=getAvailableCells(board);if(!available.length)return null;
  const win=(p:Player)=>available.find(i=>checkWinner(applyMove(board,x,o,i,p,rule).board)?.winner===p);
  if(id==='simin')return win(player)??win(getOpponent(player))??chooseAiMove(board,x,o,player,'MEDIUM',rule);
  if(id==='baran'){
    if(Math.random()<.55){const attack=win(player);if(attack!==undefined)return attack;}
    return chooseAiMove(board,x,o,player,'EASY',rule);
  }
  const search = SEARCH_BY_BOT[id];
  return chooseAiMove(board, x, o, player, 'HARD', rule,
    rule === 'CLASSIC' ? search.classicDepth : search.infiniteDepth);
}
export function personalityMorris(id:BotId,state:MorrisState,player:Player){
  if (id === 'baran') return chooseMorrisAiDecision(state, player, 'EASY');
  if (id !== 'simin') return chooseMorrisAiDecision(state, player, 'HARD', SEARCH_BY_BOT[id].morris);
  if (state.winner || state.isDraw || state.currentTurn !== player) return null;
  const opponent=getOpponent(player);
  const ranked=generateLegalDecisions(state).map(decision=>{
    const next=applyDecision(state,decision);if(!next)return {decision,score:-Infinity};
    const threats=getMorrisMills(state.variant).filter(m=>m.filter(i=>next.board[i]===opponent).length===2&&m.some(i=>next.board[i]===null)).length;
    return {decision,score:evaluateMorrisBoard(next,player)-threats*35};
  }).sort((a,b)=>b.score-a.score);
  return ranked[0]?.decision??null;
}
