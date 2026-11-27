import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '../i18n';
import { DoozIcon, DoozIconName } from '../ui/dooz-icon';
import { GameVariant } from './dooz.types';

interface HistoryEra {
  readonly era: string;
  readonly title: string;
  readonly summary: string;
  readonly icon: DoozIconName;
}

interface VariantEvolution {
  readonly variant: GameVariant;
  readonly badge: string;
  readonly name: string;
  readonly detail: string;
}

const HISTORY_ERAS: readonly HistoryEra[] = [
  {
    era: 'حدود ۱۴۰۰ پیش از میلاد',
    title: 'سنگ‌نگاره‌های کهن در مصر و ایران',
    summary:
      'کهن‌ترین نقشه‌های سه‌خطی دوز روی سنگ‌های معبد قُرنه در مصر باستان و تخته‌سنگ‌های تاریخی در فلات ایران و بین‌النهرین کشف شده‌اند.',
    icon: 'arch',
  },
  {
    era: 'دوران روم و جاده ابریشم',
    title: 'رواج از کاروانسراها تا اروپا',
    summary:
      'رومیان آن را «مِرِلوس» می‌نامیدند؛ بازرگانان و کاروان‌ها در امتداد جاده ابریشم شکل ۹ تایی و ۱۲ تایی آن را در ایران، خاورمیانه و اروپا گسترش دادند.',
    icon: 'online',
  },
  {
    era: 'فرهنگ و زبان فارسی',
    title: 'چرا به آن «دوز» می‌گوییم؟',
    summary:
      'واژه «دوز» در فارسی به معنی ردیف و جفت‌وجور کردن است؛ هرگاه سه مهره هم‌ردیف شوند «دوز» شکل می‌گیرد. سده‌ها این بازی با سنگ‌ریزه یا چوب در حیاط‌ها و قهوه‌خانه‌ها بازی می‌شد.',
    icon: 'carpet',
  },
  {
    era: '۱۹۹۳ میلادی',
    title: 'حل کامل ریاضی دوز ۹ تایی',
    summary:
      'رالف گَسر با محاسبات رایانه‌ای حدود ۱۰ میلیارد وضعیت قانونی دوز ۹ تایی را بررسی کرد و ثابت نمود در بازی بی‌نقصِ دو طرف، نتیجه همیشه مساوی می‌شود.',
    icon: 'strategy',
  },
];

const VARIANT_EVOLUTION: readonly VariantEvolution[] = [
  {
    variant: 'THREE',
    badge: '۳',
    name: 'دوز ۳ تایی',
    detail: '۳ مهره · سریع، کلاسیک و حالت بی‌نهایت',
  },
  {
    variant: 'NINE',
    badge: '۹',
    name: 'دوز ۹ تایی',
    detail: '۹ مهره · ۲۴ خانه بدون قطر با مرحله حذف و حرکت',
  },
  {
    variant: 'TWELVE',
    badge: '۱۲',
    name: 'دوز ۱۲ تایی',
    detail: '۱۲ مهره · خطوط مورب گوشه‌ها و پرش آزاد',
  },
];

@Component({
  selector: 'app-dooz-history-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DoozIcon],
  template: `
    <section class="history-panel animate-panel-in" [attr.aria-label]="'تاریخچهٔ بازی دوز' | t">
      <button class="back flex items-center gap-2" type="button" (click)="back.emit()">
        <app-dooz-icon name="arrow" class="rtl:rotate-180" />
        {{ 'برگشت به بازی' | t }}
      </button>

      <div class="heading">
        <span class="eyebrow">{{ 'از سنگ‌نگاره‌های باستانی تا امروز' | t }}</span>
        <h1>{{ 'تاریخچهٔ دوز' | t }}</h1>
        <p>
          {{ 'داستان یکی از کهن‌ترین بازی‌های فکری جهان که بیش از سه هزار سال روی سنگ، خاک، فرش و میزهای چوبی زنده مانده است.' | t }}
        </p>
      </div>

      <ol class="timeline">
        @for (item of eras; track item.title) {
          <li class="era-card">
            <div class="era-icon" aria-hidden="true">
              <app-dooz-icon [name]="item.icon" />
            </div>
            <div class="era-body">
              <span class="era-date">{{ item.era | t }}</span>
              <h2>{{ item.title | t }}</h2>
              <p>{{ item.summary | t }}</p>
            </div>
          </li>
        }
      </ol>

      <div class="variants-box">
        <div class="variants-head">
          <h2>{{ 'سه نسل دوز در این بازی' | t }}</h2>
          <span>{{ 'انتخاب و شروع سریع' | t }}</span>
        </div>
        <div class="variants-list">
          @for (item of variants; track item.variant) {
            <button type="button" class="variant-card" (click)="playVariant.emit(item.variant)">
              <b>{{ item.badge | t }}</b>
              <span>
                <strong>{{ item.name | t }}</strong>
                <small>{{ item.detail | t }}</small>
              </span>
              <app-dooz-icon name="play" class="play-arrow" />
            </button>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .back {
      display: flex;
      min-height: 44px;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 12px;
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
    }
    .heading h1 {
      font-size: 30px;
      font-weight: 900;
      margin-block: 8px 10px;
    }
    .heading p {
      font-size: 13px;
      line-height: 1.95;
      color: var(--muted);
    }
    .timeline {
      display: grid;
      gap: 12px;
      margin-block: 22px;
      padding: 0;
      list-style: none;
    }
    .era-card {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding: 15px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--surface);
    }
    .era-icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 13px;
      background: var(--soft);
      color: var(--gold, var(--accent));
    }
    .era-date {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .era-body h2 {
      font-size: 14px;
      font-weight: 800;
      margin: 0 0 6px;
    }
    .era-body p {
      font-size: 12px;
      line-height: 1.85;
      color: var(--muted);
      margin: 0;
    }
    .variants-box {
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--surface);
    }
    .variants-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    .variants-head h2 {
      font-size: 14px;
      font-weight: 800;
      margin: 0;
    }
    .variants-head span {
      font-size: 11px;
      color: var(--muted);
    }
    .variants-list {
      display: grid;
      gap: 9px;
    }
    .variant-card {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) 20px;
      align-items: center;
      gap: 11px;
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--canvas);
      text-align: start;
      transition: border-color 0.15s, background 0.15s;
    }
    .variant-card:hover {
      border-color: var(--accent);
      background: var(--soft);
    }
    .variant-card b {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 11px;
      background: var(--soft);
      color: var(--accent);
      font-size: 18px;
    }
    .variant-card strong {
      display: block;
      font-size: 13px;
      font-weight: 800;
    }
    .variant-card small {
      display: block;
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
    }
    .play-arrow {
      color: var(--accent);
    }
  `,
})
export class DoozHistoryPanel {
  readonly back = output<void>();
  readonly playVariant = output<GameVariant>();

  readonly eras = HISTORY_ERAS;
  readonly variants = VARIANT_EVOLUTION;
}
