import { BoardRule, CellValue, Difficulty, Player } from './dooz.types';
import { applyMove, checkWinner, chooseAiMove, getAvailableCells, getOpponent } from './dooz-engine';
import { MorrisState } from './morris.types';
import { applyDecision, chooseMorrisAiDecision, evaluateMorrisBoard, generateLegalDecisions, getMorrisMills } from './morris-engine';
export const BOTS=[
  {id:'baran',name:'باران',difficulty:'EASY',style:'بازیگوش و حمله‌ور',line:'بیا یه تلهٔ کوچیک بچینیم!',requiredCoins:0},
  {id:'simin',name:'سیمین',difficulty:'MEDIUM',style:'آرام و دفاعی',line:'اول راه حریف رو ببند.',requiredCoins:1},
  {id:'rostam',name:'رستم',difficulty:'HARD',style:'حسابگر و اهل تله',line:'یک حرکت جلوتر فکر کن.',requiredCoins:2},
] as const;
export type BotId=typeof BOTS[number]['id'];
export function botForDifficulty(difficulty:Difficulty){return BOTS.find(b=>b.difficulty===difficulty)!;}
export function personalityMove(id:BotId,board:CellValue[],x:number[],o:number[],player:Player,rule:BoardRule):number|null{
  const available=getAvailableCells(board);if(!available.length)return null;
  const win=(p:Player)=>available.find(i=>checkWinner(applyMove(board,x,o,i,p,rule).board)?.winner===p);
  if(id==='simin')return win(player)??win(getOpponent(player))??chooseAiMove(board,x,o,player,'MEDIUM',rule);
  if(id==='baran'){
    if(Math.random()<.55){const attack=win(player);if(attack!==undefined)return attack;}
    return chooseAiMove(board,x,o,player,'EASY',rule);
  }
  return chooseAiMove(board,x,o,player,'HARD',rule);
}
export function personalityMorris(id:BotId,state:MorrisState,player:Player){
  if(id!=='simin')return chooseMorrisAiDecision(state,player,id==='baran'?'EASY':'HARD');
  const opponent=getOpponent(player);
  const ranked=generateLegalDecisions(state).map(decision=>{
    const next=applyDecision(state,decision);if(!next)return {decision,score:-Infinity};
    const threats=getMorrisMills(state.variant).filter(m=>m.filter(i=>next.board[i]===opponent).length===2&&m.some(i=>next.board[i]===null)).length;
    return {decision,score:evaluateMorrisBoard(next,player)-threats*35};
  }).sort((a,b)=>b.score-a.score);
  return ranked[0]?.decision??null;
}
