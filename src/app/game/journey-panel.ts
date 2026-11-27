import { DoozIcon } from '../ui/dooz-icon';
import { I18n, TranslatePipe } from '../i18n';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, output } from '@angular/core';
import { BOTS, BotId } from './bot-personalities';
import { PlayerJourney, BADGES } from './player-journey';
import { PlayerAvatarComponent } from './player-avatar';
import { PlayerStats } from './player-stats';
@Component({
  selector: 'app-bot-roster',
  imports: [TranslatePipe, PlayerAvatarComponent, DoozIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="roster">
      <legend>{{ 'حریف رباتی‌ات را انتخاب کن' | t }}</legend>
      <div class="roster-progress">
        <span class="wallet"><app-dooz-icon name="coin" />{{ 'موجودی سکه' | t }} <b>{{ n(coins()) }}</b></span>
        @if (nextBot(); as next) {
          <span>{{ '{0} سکه تا باز شدن {1}' | t: [n(next.requiredCoins - coins()), (next.name | t)] }}</span>
          <progress [value]="coins()" [max]="next.requiredCoins" [attr.aria-label]="'پیشرفت تا حریف بعدی' | t"></progress>
        } @else {
          <span><app-dooz-icon name="check" />{{ 'همهٔ حریف‌ها باز هستند' | t }}</span>
        }
      </div>
      <div class="bots">
        @for (bot of bots; track bot.id) {
          @let selected = journey.bot().id === bot.id;
          @let unlocked = journey.isUnlocked(bot.id);
          <button type="button" class="bot-card" [class.selected]="selected" [disabled]="!unlocked"
            [attr.aria-pressed]="selected" (click)="choose.emit(bot.id)">
            <div class="card-top">
              <app-player-avatar [robot]="bot.difficulty" aria-hidden="true" />
              <span class="strength">{{ 'سختی {0} از {1}' | t: [n(bot.level), n(bots.length)] }}</span>
            </div>
            <strong>{{ bot.name | t }}</strong>
            <span class="bot-style">{{ bot.style | t }}</span>
            @if (selected) {
              <span class="bot-state"><app-dooz-icon name="check" />{{ 'انتخاب فعلی' | t }}</span>
            } @else if (!unlocked) {
              <span class="bot-state"><app-dooz-icon name="lock" />{{ 'با {0} سکه باز می‌شود' | t: [n(bot.requiredCoins)] }}</span>
            } @else {
              <span class="bot-state">{{ 'انتخاب حریف' | t }}</span>
            }
          </button>
        }
      </div>
    </fieldset>
  `,
  styles: `
    :host { display: block; margin-bottom: 22px; }
    .roster { min-inline-size: 0; }
    legend { margin-bottom: 12px; font-size: 14px; font-weight: 800; }
    .roster-progress { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 8px 14px; margin-bottom: 10px; padding: 10px 12px; border: 1px solid var(--line);
      border-radius: 14px; background: var(--soft); color: var(--ink); font-size: 11px; }
    .roster-progress span { display: inline-flex; align-items: center; gap: 5px; }
    .wallet app-dooz-icon { color: var(--gold, #8c5a23); }
    progress { display: block; width: 100%; height: 5px; accent-color: var(--accent); }
    .bots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .bot-card { display: flex; flex-direction: column; align-items: stretch; gap: 5px;
      min-width: 0; padding: 10px; border: 1px solid var(--line); border-radius: 14px;
      text-align: start; background: var(--surface); color: var(--ink); }
    .card-top { display: flex; align-items: center; justify-content: space-between; gap: 5px; }
    .card-top app-player-avatar { width: 30px; height: 30px; }
    .strength { font-size: 10px; color: var(--ink); }
    .bot-card strong { font-size: 13px; }
    .bot-style { color: var(--muted); font-size: 11px; line-height: 1.5; }
    .bot-state { display: flex; align-items: center; gap: 4px; margin-top: auto;
      padding-top: 3px; color: var(--accent); font-size: 10px; font-weight: 700; }
    .bot-card.selected { border-color: var(--accent); background: var(--soft); box-shadow: inset 0 0 0 1px var(--accent); }
    .bot-card:disabled { border-style: dashed; cursor: default; }
    .bot-card:disabled .bot-state { color: var(--muted); }
    .bot-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  `,
})
export class BotRoster {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly stats = inject(PlayerStats);
  readonly n = inject(I18n).digits;
  readonly journey = inject(PlayerJourney);
  readonly bots = BOTS;
  readonly choose = output<BotId>();
  readonly coins = computed(() => this.stats.stats().coins);
  readonly nextBot = computed(() => this.bots.find(bot => bot.requiredCoins > this.coins()));

  focusSelection(): void {
    const host = this.element.nativeElement;
    host.scrollIntoView({ block: 'start' });
    host.querySelector<HTMLButtonElement>('.bot-card.selected')?.focus({ preventScroll: true });
  }
}
@Component({
  selector:'app-journey-panel',imports: [TranslatePipe, DoozIcon],changeDetection:ChangeDetectionStrategy.OnPush,
  template:`<section [attr.aria-label]="'مسیر استادی' | t"><div class="heading"><h2>{{ 'نشان‌های مسیر تو' | t }}</h2><span>{{ '{0} از {1}' | t: [n(earned()), n(badges.length)] }}</span></div>
    <div class="daily"><app-dooz-icon name="flame" /><span>{{ '{0} روز پیاپی معمای روز' | t: [n(journey.streak())] }}<small>{{ '{0} معمای حل‌شده' | t: [n(journey.state().solved.length)] }}</small></span></div>
    <div class="badges">@for(badge of badges;track badge.id){<div [class.earned]="!!journey.state().badges[badge.id]"><app-dooz-icon [name]="badge.icon" /><strong>{{ (badge.name | t) }}</strong><p>{{ (badge.detail | t) }}</p><span>{{ journey.state().badges[badge.id]?('کسب شده' | t):('در مسیر کسب' | t) }}</span></div>}</div>
  </section>`,
  styles:`:host{display:block;margin-block:24px}.heading{display:flex;align-items:center;justify-content:space-between;gap:10px}h2{font-size:15px;font-weight:800}.heading span{font-size:11px;color:var(--muted)}.daily{display:flex;align-items:center;gap:10px;padding:16px;background:var(--soft);border-radius:16px;margin-block:16px;color:var(--accent);font-size:12px}.daily small{display:block;font-size:10px;margin-top:5px}.badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.badges>div{border:1px dashed var(--line);border-radius:16px;padding:16px 12px;color:var(--muted);background:var(--surface)}.badges .earned{border:1px solid #a68c57;background:var(--soft);color:var(--ink)}.badges app-dooz-icon{display:grid;width:38px;height:38px;padding:8px;border-radius:12px;margin-bottom:10px;background:var(--canvas);color:var(--muted);border:1px solid var(--line)}.earned app-dooz-icon{color:#57371b;background:linear-gradient(155deg,#ffe6a7,#e4b66d);border-color:#bc9055;box-shadow:inset 0 1px 0 #fff7}.badges strong{font-size:12px}.badges p{font-size:10px;line-height:1.8;margin-block:8px;min-height:36px}.badges span{font-size:9px;color:var(--muted)}`,
})
export class JourneyPanel{
  private readonly i18n = inject(I18n);
  readonly journey=inject(PlayerJourney);readonly badges=BADGES;readonly n=this.i18n.digits;
  earned():number{return Object.keys(this.journey.state().badges).length;}
}
