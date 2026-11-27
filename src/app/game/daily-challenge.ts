import { I18n, TranslatePipe } from '../i18n';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DoozBoard } from './dooz-board';
import { PlayerJourney } from './player-journey';
import { PlayerStats } from './player-stats';
import { SoundFx } from './sound-fx';
import { bestClassicMoves, canForceWin, dailyPuzzle, tehranDay } from './learning-engine';
import { checkWinner } from './dooz-engine';
import { CellValue } from './dooz.types';
import { ShareCard, challengeCode } from './share-card';
@Component({
  selector:'app-daily-challenge',imports: [TranslatePipe, DoozBoard,ReactiveFormsModule],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    <section class="challenge"><button class="back" type="button" (click)="back.emit()">{{ '← برگشت به بازی' | t }}</button>
      <span class="eyebrow">{{ 'دو حرکت، یک فکر تازه' | t }}</span><h1>{{ (date() === today() ? 'معمای امروز' : 'معمای دوستت') | t }}</h1>
      <p>{{ 'تو X هستی. حتی با بهترین دفاع حریف، با حداکثر دو حرکت خودت ببر.' | t }}</p>
      <div class="meta"><span>{{ code() }}</span><span>{{ '{0} روز پیاپی' | t: [n(journey.streak())] }}</span></div>
      <app-dooz-board [board]="board()" currentTurn="X" [theme]="stats.boardTheme()" [pieceStyle]="stats.pieceStyle()" [colorMode]="stats.colorMode()" [disabled]="status()!=='PLAYING'" [showCellNumbers]="false" [winResult]="win()" (cellSelected)="play($event)" />
      <p class="message" role="status">{{ (message() | t) }}</p>
      <div class="actions">@if(status()==='SOLVED'){<button type="button" class="primary" [disabled]="sharing()" (click)="share()">{{ sharing()?('آماده‌سازی کارت…' | t):('کارت نتیجه و دعوت دوست' | t) }}</button>}@else if(status()==='FAILED'){<button type="button" class="primary" (click)="reset()">{{ 'یک بار دیگه امتحان کن' | t }}</button>}</div>
      <details><summary>{{ 'کد چالش دوستت را داری؟' | t }}</summary><form (submit)="$event.preventDefault(); openCode()"><input [attr.aria-label]="'کد چالش' | t" dir="ltr" placeholder="DOOZ-20261126" [formControl]="codeControl" maxlength="20"/><button type="submit">{{ 'باز کردن' | t }}</button></form></details>
      <p class="note">{{ 'روز معما بر اساس ساعت ایران عوض می‌شود. این تمرین امتیاز مهارت مسابقه را تغییر نمی‌دهد.' | t }}</p>
    </section>
  `,
  styles:`:host{display:block}.back{display:block;min-height:44px;color:var(--muted);font-size:12px;margin-bottom:20px}.eyebrow{font-size:11px;color:var(--accent)}h1{font-size:30px;font-weight:900;margin-block:10px}p{font-size:13px;line-height:2;color:var(--muted)}.meta{display:flex;justify-content:space-between;gap:10px;margin-block:20px;font-size:11px;color:var(--accent)}.meta span:first-child{direction:ltr}.message{min-height:64px;margin-block:16px}.actions{display:flex;gap:10px}button{min-height:48px;border-radius:14px;padding:10px 16px;background:var(--soft);color:var(--accent);font-weight:700;font-size:12px}.primary{width:100%;background:var(--accent);color:var(--canvas)}details{margin-top:20px;border-top:1px solid var(--line)}summary{min-height:48px;align-content:center;font-size:12px;cursor:pointer}form{display:flex;gap:8px}input{width:100%;min-width:0;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface);font-size:12px}.note{font-size:10px;margin-top:20px}button:disabled{opacity:.5}`,
})
export class DailyChallenge{
  readonly i18n = inject(I18n);
  readonly back=output<void>();readonly journey=inject(PlayerJourney);readonly stats=inject(PlayerStats);private readonly sound=inject(SoundFx);private readonly cards=inject(ShareCard);
  readonly today=signal(tehranDay());readonly date=signal(this.today());readonly board=signal<CellValue[]>(dailyPuzzle(this.today()));readonly status=signal<'PLAYING'|'FAILED'|'SOLVED'>('PLAYING');readonly moves=signal(0);readonly message=signal('یک موقعیت کوچک؛ یک برد هوشمندانه.');readonly sharing=signal(false);readonly codeControl=new FormControl('',{nonNullable:true});readonly n=this.i18n.digits;
  readonly code=computed(()=>challengeCode(this.date()));readonly win=computed(()=>checkWinner(this.board()));
  private started=false;
  constructor(){
    if(typeof window!=='undefined'){
      const timer=setInterval(()=>{const day=tehranDay(),old=this.today();if(day!==old){this.today.set(day);if(this.date()===old)this.loadDate(day);}},60000);
      inject(DestroyRef).onDestroy(()=>clearInterval(timer));
    }
    if(typeof window!=='undefined') {const date=new URLSearchParams(window.location.search).get('puzzle');if(date)this.loadDate(date);}
    this.restoreSolved();
  }
  play(index:number):void{
    if(this.status()!=='PLAYING'||this.board()[index]!==null)return;
    if(!this.started){this.journey.startAttempt(this.date());this.started=true;}
    const board=[...this.board()];board[index]='X';this.moves.update(n=>n+1);this.sound.playMoveX();
    if(checkWinner(board)?.winner==='X'){
      this.board.set(board);this.status.set('SOLVED');this.journey.solve(this.date(),this.moves());this.message.set('آفرین! بهترین دفاع هم جلوی فکرت را نگرفت.');this.sound.playWin();return;
    }
    const replies=bestClassicMoves(board,'O');
    const reply=replies.find(i=>{const b=[...board];b[i]='O';return !canForceWin(b,'X','X',2-this.moves());})??replies[0];
    if(reply!==undefined)board[reply]='O';this.board.set(board);
    if(this.moves()>=2||checkWinner(board)||!board.includes(null)) {this.status.set('FAILED');this.message.set('این مسیر به برد دوحرکتی نرسید. از موقعیت اول دوباره فکر کن.');}
    else this.message.set('حریف پاسخ داد؛ حرکت برنده را پیدا کن.');
  }
  reset():void{this.board.set(dailyPuzzle(this.date()));this.status.set('PLAYING');this.moves.set(0);this.started=false;this.message.set('یک فرصت تازه؛ قبل از لمس، هر دو حرکت را ببین.');}
  openCode():void{
    const text=this.codeControl.value.trim().toUpperCase();const match=/^(?:DOOZ-)?(\d{4})-?(\d{2})-?(\d{2})$/.exec(text);
    if(!match||!this.loadDate(`${match[1]}-${match[2]}-${match[3]}`))this.message.set('کد چالش معتبر نیست یا روز آن هنوز نرسیده است.');
  }
  private loadDate(date:string):boolean{try{if(date>this.today())return false;dailyPuzzle(date);this.date.set(date);this.reset();this.restoreSolved();return true;}catch{return false;}}
  private restoreSolved():void{const result=this.journey.state().solved.find(r=>r.date===this.date());if(result){this.status.set('SOLVED');this.moves.set(result.moves);this.message.set('این معما را قبلاً حل کرده‌ای؛ کارت نتیجه‌ات آماده است.');}}
  async share():Promise<void>{if(this.status()!=='SOLVED'||this.sharing())return;this.sharing.set(true);try{const r=await this.cards.daily(this.date(),this.journey.state().solved.find(s=>s.date===this.date())?.attempts??1,this.moves());if(r==='downloaded')this.message.set('کارت ذخیره شد؛ می‌تونی برای دوستت بفرستی.');}catch{this.message.set('اشتراک‌گذاری انجام نشد؛ دوباره امتحان کن.');}finally{this.sharing.set(false);}}
}
