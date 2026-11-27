import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BOTS, BotId } from './bot-personalities';
import { PlayerJourney, BADGES } from './player-journey';
import { PlayerAvatarComponent } from './player-avatar';
import { toPersianDigits } from './dooz-engine';
@Component({
  selector:'app-bot-roster',imports:[PlayerAvatarComponent],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<details><summary><app-player-avatar [robot]="journey.bot().difficulty" [label]="journey.bot().name"/><span><strong>{{ journey.bot().name }}</strong><small>{{ journey.bot().style }}</small></span><b aria-hidden="true">⌄</b></summary>
    <div class="bots">@for(bot of bots;track bot.id){<button type="button" [disabled]="!journey.isUnlocked(bot.id)" [class.selected]="journey.state().selected===bot.id" [attr.aria-pressed]="journey.state().selected===bot.id" (click)="choose(bot.id)"><app-player-avatar [robot]="bot.difficulty" [label]="bot.name"/><strong>{{ bot.name }}</strong><span>{{ bot.style }}</span><small>{{ journey.isUnlocked(bot.id)?bot.line:bot.unlock }}</small></button>}</div>
  </details>`,
  styles:`:host{display:block;margin-bottom:20px}details{border:1px solid var(--line);border-radius:16px;padding:6px 12px;background:var(--surface)}summary{display:flex;align-items:center;gap:12px;cursor:pointer;min-height:52px;list-style:none}summary::-webkit-details-marker{display:none}summary strong{display:block;font-size:13px}summary small{display:block;font-size:10px;color:var(--muted);margin-top:4px}summary b{margin-inline-start:auto;color:var(--muted)}.bots{display:grid;gap:10px;padding-block:10px}.bots button{display:grid;grid-template-columns:44px 1fr;column-gap:10px;text-align:right;padding:12px;min-height:76px;border:1px solid var(--line);border-radius:12px}.bots app-player-avatar{grid-row:span 3}.bots strong{font-size:13px}.bots span,.bots small{font-size:10px;color:var(--muted);line-height:1.8}.bots .selected{border-color:var(--accent);background:var(--soft)}.bots button:disabled{opacity:.55}`,
})
export class BotRoster{
  readonly journey=inject(PlayerJourney);readonly bots=BOTS;readonly selected=output<BotId>();
  choose(id:BotId):void{if(this.journey.selectBot(id))this.selected.emit(id);}
}
@Component({
  selector:'app-journey-panel',imports:[MatIconModule],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<section aria-label="مسیر استادی"><div class="heading"><h2>نشان‌های مسیر تو</h2><span>{{ n(earned()) }} از {{ n(badges.length) }}</span></div>
    <div class="daily"><mat-icon>local_fire_department</mat-icon><span>{{ n(journey.streak()) }} روز پیاپی معمای روز<small>{{ n(journey.state().solved.length) }} معمای حل‌شده</small></span></div>
    <div class="badges">@for(badge of badges;track badge.id){<div [class.earned]="!!journey.state().badges[badge.id]"><mat-icon>{{ badge.icon }}</mat-icon><strong>{{ badge.name }}</strong><p>{{ badge.detail }}</p><span>{{ journey.state().badges[badge.id]?'کسب شده':'در مسیر کسب' }}</span></div>}</div>
  </section>`,
  styles:`:host{display:block;margin-block:24px}.heading{display:flex;align-items:center;justify-content:space-between;gap:10px}h2{font-size:15px;font-weight:800}.heading span{font-size:11px;color:var(--muted)}.daily{display:flex;align-items:center;gap:10px;padding:16px;background:var(--soft);border-radius:16px;margin-block:16px;color:var(--accent);font-size:12px}.daily small{display:block;font-size:10px;margin-top:5px}.badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.badges>div{border:1px dashed var(--line);border-radius:16px;padding:16px 12px;color:var(--muted);background:var(--surface)}.badges .earned{border:1px solid #a68c57;background:var(--soft);color:var(--ink)}.badges mat-icon{display:block;margin-bottom:10px}.earned mat-icon{color:#bc985a}.badges strong{font-size:12px}.badges p{font-size:10px;line-height:1.8;margin-block:8px;min-height:36px}.badges span{font-size:9px;color:var(--muted)}`,
})
export class JourneyPanel{
  readonly journey=inject(PlayerJourney);readonly badges=BADGES;readonly n=toPersianDigits;
  earned():number{return Object.keys(this.journey.state().badges).length;}
}
