import { I18n, TranslatePipe } from '../i18n';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DoozIcon } from '../ui/dooz-icon';
import { PlayerStats } from './player-stats';
import { PlayerProfile } from './player-profile';
import { PlayerAvatarComponent } from './player-avatar';

const RANKS=[{min:800,title:'تازه‌کار'},{min:1120,title:'بازیکن باتجربه'},{min:1260,title:'بازیکن حرفه‌ای'},{min:1400,title:'استاد دوز'},{min:1550,title:'استاد بزرگ'}];
@Component({
  selector:'app-player-dashboard',
  imports: [TranslatePipe, DoozIcon,PlayerAvatarComponent],
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    <section [attr.aria-label]="'کارنامهٔ شخصی بازیکن' | t">
      <div class="identity"><app-player-avatar [avatar]="profile.avatar()" [label]="'آواتار شما' | t" /><div><span>{{ 'کارنامهٔ شخصی' | t }}</span><h2>{{ profile.name() || ('بازیکن دوز' | t) }}</h2></div><span class="personal-badge">{{ 'روی این دستگاه' | t }}</span></div>
      <div class="rating-card">
        <div class="rating-top"><span><app-dooz-icon name="medal" />{{ stats.totalGames() ? (stats.rankTitle() | t) : ('آمادهٔ اولین چالش' | t) }}</span><span class="rating-label">{{ 'امتیاز مهارت' | t }}</span></div>
        <div class="rating-value"><strong>{{ n(stats.stats().elo) }}</strong>@if(stats.stats().recentResults.length){<span class="delta" [class.negative]="lastDelta()<0">{{ lastDelta()>0 ? '+' : '' }}{{ n(lastDelta()) }}<small>{{ 'آخرین مسابقه' | t }}</small></span>}</div>
        <div class="rank-progress">
          <div><span>{{ nextRank() ? ('تا {0}' | t: [(nextRank()!.title | t)]) : ('بالاترین نشان دوز' | t) }}</span><strong>{{ nextRank() ? ('{0} امتیاز' | t: [n(pointsToNext())]) : ('استاد بزرگ' | t) }}</strong></div>
          <div class="progress-track" role="progressbar" [attr.aria-label]="'پیشرفت رتبه' | t" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="progress()"></span></div>
        </div>
      </div>
      <div class="overview"><div><span>{{ 'مسابقهٔ ثبت‌شده' | t }}</span><strong>{{ n(stats.totalGames()) }}</strong></div><div><span>{{ 'نرخ پیروزی' | t }}</span><strong>{{ n(stats.winRate()) }}<small>{{ '٪' | t }}</small></strong></div></div>
      <div class="result-counts"><div><span class="dot win"></span><b>{{ n(stats.stats().wins) }}</b><span>{{ 'برد' | t }}</span></div><div><span class="dot draw"></span><b>{{ n(stats.stats().draws) }}</b><span>{{ 'مساوی' | t }}</span></div><div><span class="dot loss"></span><b>{{ n(stats.stats().losses) }}</b><span>{{ 'باخت' | t }}</span></div></div>
      @if(stats.totalGames()) { <div class="result-bar" aria-hidden="true"><span class="win" [style.flex-grow]="stats.stats().wins"></span><span class="draw" [style.flex-grow]="stats.stats().draws"></span><span class="loss" [style.flex-grow]="stats.stats().losses"></span></div> }
      <div class="streaks"><div><app-dooz-icon name="flame" /><span>{{ 'برد پیاپی فعلی' | t }}<strong>{{ n(stats.stats().currentStreak) }}</strong></span></div><div><app-dooz-icon name="trophy" /><span>{{ 'بهترین رکورد' | t }}<strong>{{ n(stats.stats().bestStreak) }}</strong></span></div></div>
      <div class="recent"><div class="section-title"><h3>{{ 'فرم اخیر تو' | t }}</h3><span>{{ 'تا ۱۲ مسابقهٔ آخر' | t }}</span></div>
        @if(stats.stats().recentResults.length) {
          <ol class="form-strip" [attr.aria-label]="'نتایج اخیر از قدیمی به جدید' | t">@for(result of stats.stats().recentResults;track result.id){<li [class.win]="result.outcome==='WIN'" [class.loss]="result.outcome==='LOSS'" [class.draw]="result.outcome==='DRAW'" [attr.aria-label]="outcomeLabel(result.outcome)">{{ result.outcome==='WIN'?('ب' | t):result.outcome==='LOSS'?('ش' | t):('م' | t) }}</li>}</ol>
          <p class="recent-note">{{ 'ب: برد · ش: شکست · م: مساوی' | t }}</p>
        } @else { <p class="empty">{{ stats.totalGames() ? ('نتایج تازه از مسابقهٔ بعدی اینجا ثبت می‌شوند.' | t) : ('اولین مسابقه‌ات رو شروع کن؛ اینجا جای داستان پیشرفت توئه.' | t) }}</p> }
      </div>
      <details class="score-help"><summary>{{ 'امتیاز چطور حساب می‌شه؟' | t }}</summary><p>{{ 'امتیاز اولیه ۱۲۰۰ است. تغییر امتیاز به نتیجه و قدرت حریف بستگی دارد؛ برد مقابل حریف قوی‌تر امتیاز بیشتری دارد. مساوی هم بسته به اختلاف امتیاز می‌تواند امتیازت را کم یا زیاد کند. کف امتیاز ۸۰۰ است.' | t }}</p><p>{{ 'فقط بازی با ربات و مسابقهٔ آنلاین در این کارنامه ثبت می‌شود. بازی دونفره روی یک گوشی در امتیاز شخصی حساب نمی‌شود. این امتیاز، رتبه‌بندی سراسری نیست.' | t }}</p></details>
      @if(stats.storage.issue()) {
        <div class="storage-issue" role="alert">{{ stats.storage.issue()==='load' ? ('اطلاعات ذخیره‌شده خوانده نشد. برای محافظت از آمار، برنامه را دوباره باز کنید.' | t) : ('آمار در این اجرا ثبت شده، اما ذخیرهٔ آن کامل نشده است.' | t) }}
          @if(stats.storage.issue()==='write'){<button type="button" (click)="stats.storage.retry()">{{ 'تلاش دوباره برای ذخیره' | t }}</button>}
        </div>
      } @else if(stats.storage.pending()) { <p class="save-state" role="status">{{ 'در حال ذخیرهٔ کارنامه…' | t }}</p> }
    </section>
  `,
  styles:`
    :host{display:block;margin-bottom:24px}.identity{display:flex;align-items:center;gap:12px;margin-bottom:20px}.identity app-player-avatar{width:52px;height:52px}.identity h2{font-size:17px;font-weight:800;overflow-wrap:anywhere}.identity span{font-size:10px;color:var(--muted)}.personal-badge{margin-inline-start:auto;border:1px solid var(--line);border-radius:20px;padding:6px 9px;white-space:nowrap}
    .rating-card{padding:24px;border-radius:24px;background:linear-gradient(135deg,#264c40,#18342d);color:#eef8ef;border:1px solid #496958;box-shadow:0 12px 28px #10281b15}.rating-top{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12px}.rating-top>span:first-child{display:flex;align-items:center;gap:6px;color:#e8cb95}.rating-top app-dooz-icon{width:20px;height:20px;font-size:20px}.rating-label{font-size:10px;color:#b2cbbd}
    .rating-value{display:flex;align-items:center;justify-content:space-between;padding:20px 0 26px;gap:16px}.rating-value>strong{font-size:56px;line-height:1;font-weight:900;letter-spacing:-2px;font-variant-numeric:tabular-nums}.delta{font-size:20px;color:#b4e7c6;direction:ltr}.delta.negative{color:#f4b4a3}.delta small{display:block;color:#b2cbbd;font-size:9px;margin-top:6px;direction:rtl}
    .rank-progress>div:first-child{display:flex;justify-content:space-between;font-size:10px;gap:8px;margin-bottom:10px;color:#c5d9cb}.progress-track{height:6px;border-radius:10px;background:#ffffff20;overflow:hidden}.progress-track span{display:block;height:100%;border-radius:inherit;background:#ddbe85}
    .overview{display:grid;grid-template-columns:1fr 1fr;padding:24px 0 18px;gap:16px}.overview>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.overview span{font-size:11px;color:var(--muted)}.overview strong{font-size:27px;font-weight:800}.overview small{font-size:15px}.result-counts{display:flex;justify-content:space-between;gap:8px;padding:18px 0;border-top:1px solid var(--line)}.result-counts>div{display:flex;align-items:center;gap:6px;font-size:12px}.result-counts b{font-size:18px}.dot{width:7px;height:7px;border-radius:50%}.win{background:#5da584}.draw{background:#b4a276}.loss{background:#c97e75}.result-bar{display:flex;height:5px;gap:3px;border-radius:5px;overflow:hidden}.result-bar span{flex-basis:0;min-width:0}
    .streaks{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-block:22px}.streaks>div{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:16px;padding:15px;background:var(--surface)}.streaks app-dooz-icon{width:33px;height:33px;padding:7px;border-radius:10px;background:var(--soft);color:var(--gold,#8c5a23)}.streaks span{font-size:10px;color:var(--muted)}.streaks strong{display:block;font-size:23px;color:var(--ink);margin-top:6px}
    .recent{border-top:1px solid var(--line);padding-top:20px}.section-title{display:flex;align-items:center;justify-content:space-between;gap:10px}.section-title h3{font-size:13px;font-weight:800}.section-title>span,.recent-note{font-size:9px;color:var(--muted)}.form-strip{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.form-strip li{display:grid;place-items:center;width:30px;height:32px;border-radius:8px;color:#fff;font-size:12px;font-weight:700}.recent-note{margin-top:10px}.empty{font-size:12px;line-height:2;color:var(--muted);padding-block:16px}
    .score-help{margin-top:22px;border-block:1px solid var(--line)}summary{cursor:pointer;font-size:12px;min-height:48px;align-content:center}p{font-size:12px;line-height:2;color:var(--muted);margin-bottom:12px}.storage-issue{padding:14px;border-radius:12px;background:#f3ce7a22;font-size:12px;line-height:2;margin-top:16px}.storage-issue button{display:block;min-height:44px;color:var(--accent);text-decoration:underline}.save-state{font-size:10px;margin-top:12px}
    @media(max-width:360px){.rating-card{padding:18px}.overview{gap:12px}.overview>div{flex-direction:column;align-items:start}.personal-badge{font-size:9px!important;padding:5px}.streaks>div{padding:12px;gap:6px}}
  `,
})
export class PlayerDashboard {
  readonly i18n = inject(I18n);
  readonly stats=inject(PlayerStats);
  readonly profile=inject(PlayerProfile);
  readonly n=this.i18n.digits;
  readonly nextRank=computed(()=>RANKS.find(r=>r.min>this.stats.stats().elo)??null);
  readonly pointsToNext=computed(()=>Math.max(0,(this.nextRank()?.min??this.stats.stats().elo)-this.stats.stats().elo));
  readonly progress=computed(()=>{
    const elo=this.stats.stats().elo;
    const next=this.nextRank();if(!next)return 100;
    const lower=[...RANKS].reverse().find(r=>r.min<=elo)!.min;
    return Math.max(0,Math.min(100,Math.round((elo-lower)/(next.min-lower)*100)));
  });
  readonly lastDelta=computed(()=>this.stats.stats().recentResults.at(-1)?.delta??0);
  outcomeLabel(outcome:string):string{return outcome==='WIN'?this.i18n.text("برد"):outcome==='LOSS'?this.i18n.text("شکست"):this.i18n.text("مساوی");}
}
