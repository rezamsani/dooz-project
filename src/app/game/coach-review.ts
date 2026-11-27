import { TranslatePipe } from '../i18n';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CellValue, Player } from './dooz.types';
import { DoozBoard } from './dooz-board';
import { MorrisBoard } from './morris-board';
import { MorrisState } from './morris.types';
import { applyDecision, chooseMorrisAiDecision, evaluateMorrisBoard, MorrisAiDecision } from './morris-engine';
import { applyMove, checkWinner } from './dooz-engine';
import { ThreeLesson, bestClassicMoves } from './learning-engine';

export interface MorrisLesson{state:MorrisState;decision:MorrisAiDecision;message:string;}
export function reviewMorris(frames:readonly MorrisState[],hero:Player):MorrisLesson|null{
  for(let i=0;i<frames.length-1;i++){
    const state=frames[i];if(state.currentTurn!==hero||state.winner||state.isDraw)continue;
    const decision=chooseMorrisAiDecision(state,hero,'HARD');if(!decision)continue;
    const next=applyDecision(state,decision);if(!next)continue;
    if(evaluateMorrisBoard(next,hero)-evaluateMorrisBoard(frames[i+1],hero)>=45)return {state:{...state,selectedNode:null},decision,message:'اینجا یک گزینهٔ تاکتیکی قوی‌تر برای بررسی وجود داشت. این پیشنهاد تحلیلی است، نه تضمین برد.'};
  }
  return null;
}
@Component({
  selector:'app-coach-review',imports: [TranslatePipe, DoozBoard,MorrisBoard],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<details class="coach"><summary>{{ 'کجا می‌تونستم بهتر بازی کنم؟' | t }}</summary>
    @if(three();as lesson){<p>{{ (lesson.message | t) }}</p><app-dooz-board [board]="practiceBoard()??lesson.board" [currentTurn]="lesson.player" [showCellNumbers]="false" [hintIndex]="revealed()?lesson.better:null" [disabled]="done()" [winResult]="practiceWin()" pieceStyle="classic" (cellSelected)="tryThree($event)"/>}
    @else if(morris();as lesson){<p>{{ (lesson.message | t) }}</p><app-morris-board [state]="practiceState()??lesson.state" [disabled]="done()" pieceStyle="classic" [hintDecision]="revealed()?lesson.decision:null" (nodeSelected)="tryMorris($event)"/>}
    @else{<p>{{ 'در این بازی اشتباه روشنی برای تمرین پیدا نشد. از بازپخش حرکت‌ها می‌تونی مسیر بازی را بررسی کنی.' | t }}</p>}
    @if(three()||morris()){<p class="feedback" role="status">{{ (feedback() | t) }}</p><div class="actions"><button type="button" (click)="revealed.set(true);feedback.set('حرکت پیشنهادی روی صفحه مشخص شد.')">{{ 'نشان دادن پیشنهاد' | t }}</button><button type="button" (click)="reset()">{{ 'تمرین دوباره' | t }}</button></div>}
  </details>`,
  styles:`:host{display:block;width:100%;max-width:440px}.coach{border:1px solid var(--line);border-radius:18px;background:var(--surface);padding:4px 16px}summary{cursor:pointer;min-height:52px;align-content:center;font-size:13px;font-weight:700}p{font-size:12px;line-height:2;color:var(--muted);margin-block:12px}.feedback{min-height:46px}.actions{display:flex;flex-wrap:wrap;gap:8px}button{min-height:44px;border-radius:12px;padding:8px 12px;background:var(--soft);color:var(--accent);font-size:11px}`,
})
export class CoachReview{
  readonly three=input<ThreeLesson|null>(null);readonly morris=input<MorrisLesson|null>(null);
  readonly practiceBoard=signal<CellValue[]|null>(null);readonly practiceState=signal<MorrisState|null>(null);readonly revealed=signal(false);readonly done=signal(false);readonly feedback=signal('یک حرکت دیگر را در همین موقعیت امتحان کن.');readonly practiceWin=computed(()=>this.practiceBoard()?checkWinner(this.practiceBoard()!):null);
  reset():void{this.practiceBoard.set(null);this.practiceState.set(null);this.done.set(false);this.revealed.set(false);this.feedback.set('یک حرکت دیگر را امتحان کن.');}
  tryThree(index:number):void{
    const l=this.three();if(!l||this.done()||l.board[index]!==null)return;
    const accepted=l.rule==='CLASSIC'?bestClassicMoves(l.board,l.player).includes(index):index===l.better;
    if(!accepted){this.feedback.set('این مسیر پیشنهاد مربی نیست؛ یک انتخاب دیگر را بررسی کن.');return;}
    this.practiceBoard.set(applyMove(l.board,l.xQueue,l.oQueue,index,l.player,l.rule).board);this.done.set(true);this.feedback.set('آفرین؛ این انتخاب فرصت بهتری می‌سازد.');
  }
  tryMorris(node:number):void{
    const l=this.morris();if(!l||this.done())return;const state=this.practiceState()??l.state;
    let decision:MorrisAiDecision;
    if(state.action==='PLACE')decision={type:'PLACE',to:node};
    else if(state.action==='REMOVE')decision={type:'REMOVE',target:node};
    else if(state.selectedNode===null||state.board[node]===state.currentTurn){this.practiceState.set({...state,selectedNode:node});return;}
    else decision={type:'MOVE',from:state.selectedNode,to:node};
    const next=applyDecision(state,decision);if(!next)return;
    if(JSON.stringify(decision)!==JSON.stringify(l.decision)){this.feedback.set('این حرکت قانونی است؛ پیشنهاد مربی را هم با دکمهٔ زیر بررسی کن.');this.practiceState.set(null);return;}
    this.practiceState.set(next);this.done.set(true);this.feedback.set('این همان موقعیت پیشنهادی برای بررسی بود.');
  }
}
