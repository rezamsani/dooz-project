import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BoardColorTokens, resolveBoardColorTokens } from './color-palette';
import { toPersianDigits } from './dooz-engine';
import { DoozPieceSvg } from './dooz-piece-svg';
import { BoardTheme, ColorMode, PieceStyle, Player } from './dooz.types';

@Component({
  selector: 'app-piece-tray',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DoozPieceSvg],
  template: `
    <div
      class="flex w-full flex-row items-stretch justify-between gap-2.5 rounded-2xl border p-2.5 shadow-sm backdrop-blur-md transition-all duration-200 md:flex-col md:justify-start"
      [class.md:w-[88px]]="!expanded()"
      [class.md:w-[108px]]="expanded()"
      [class.md:p-3]="expanded()"
      [class.backdrop-blur-md]="true"
      [class.shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]]="theme() === 'glass'"
      [style.background-color]="trayBg()"
      [style.border-color]="boardTokens().borderColor"
      [class.ring-2]="isActiveTurn()"
      [class.ring-rose-500/75]="isActiveTurn() && player() === 'X'"
      [class.ring-teal-400/75]="isActiveTurn() && player() === 'O'"
      [attr.aria-label]="trayAriaLabel()"
    >
      <!-- Player Header -->
      <div
        class="flex shrink-0 flex-col items-center justify-center gap-0.5 text-center md:w-full md:border-b md:pb-2"
        [class.md:border-slate-900/10]="isLightNeutral() && !customBoardColor()"
        [class.md:border-white/10]="!isLightNeutral() || customBoardColor() !== null"
      >
        <span
          class="max-w-[76px] truncate text-[11px] font-extrabold"
          [class.text-rose-700]="isLightNeutral() && !customBoardColor() && player() === 'X'"
          [class.text-rose-300]="(!isLightNeutral() || customBoardColor() !== null) && player() === 'X'"
          [class.text-teal-700]="isLightNeutral() && !customBoardColor() && player() === 'O'"
          [class.text-teal-300]="(!isLightNeutral() || customBoardColor() !== null) && player() === 'O'"
        >
          {{ label() }}
        </span>
        <span
          class="text-[10px] font-medium tabular-nums"
          [class.text-slate-500]="isLightNeutral() && !customBoardColor()"
          [class.text-slate-300/80]="!isLightNeutral() || customBoardColor() !== null"
        >
          صفحه: {{ formatDigit(onBoardCount()) }}
        </span>
      </div>

      <!-- Zone 1: Reserve / In-Hand Pieces -->
      @if (showReserve()) {
        <div class="flex flex-1 flex-col items-center gap-1.5 md:flex-initial">
          <div
            class="flex items-center gap-1 text-[10px] font-semibold"
            [class.text-slate-600]="isLightNeutral() && !customBoardColor()"
            [class.text-slate-300]="!isLightNeutral() || customBoardColor() !== null"
          >
            <span>در دست</span>
            <span class="font-extrabold tabular-nums">({{ formatDigit(inHandCount()) }})</span>
          </div>

          <div
            class="flex min-h-[34px] w-full flex-wrap items-center justify-center gap-1 rounded-xl border p-1.5"
            [class.border-slate-200/90]="isLightNeutral() && !customBoardColor()"
            [class.bg-slate-100/80]="isLightNeutral() && !customBoardColor()"
            [class.border-white/10]="!isLightNeutral() || customBoardColor() !== null"
            [class.bg-black/20]="!isLightNeutral() || customBoardColor() !== null"
          >
            @if (inHandTokens().length > 0) {
              @for (tokenIdx of inHandTokens(); track tokenIdx) {
                <span class="animate-token-drop inline-flex h-5 w-5 items-center justify-center sm:h-[22px] sm:w-[22px]" aria-hidden="true">
                  <svg
                    appPieceSvg
                    [player]="player()"
                    [style]="pieceStyle()"
                    [customColor]="customPieceColor()"
                    class="h-full w-full"
                  ></svg>
                </span>
              }
            } @else {
              <span
                class="text-[10px]"
                [class.text-slate-400]="isLightNeutral()"
                [class.text-slate-400/70]="!isLightNeutral()"
              >
                تمام شد
              </span>
            }
          </div>
        </div>
      }

      <!-- Zone 2: Captured / Out-of-Play Pieces Dish -->
      <div class="flex flex-1 flex-col items-center gap-1.5 md:flex-initial">
        <div
          class="flex items-center gap-1 text-[10px] font-bold"
          [class.text-amber-700]="isLightNeutral() && outCount() > 0"
          [class.text-amber-300]="!isLightNeutral() && outCount() > 0"
          [class.text-slate-500]="isLightNeutral() && outCount() === 0"
          [class.text-slate-400]="!isLightNeutral() && outCount() === 0"
        >
          <span>خارج‌شده</span>
          <span class="tabular-nums">({{ formatDigit(outCount()) }})</span>
        </div>

        <div
          class="flex min-h-[40px] w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-dashed p-1.5 transition-colors"
          [class.border-amber-500/60]="outCount() > 0"
          [class.bg-amber-500/10]="outCount() > 0 && isLightNeutral()"
          [class.bg-black/35]="outCount() > 0 && !isLightNeutral()"
          [class.border-slate-300]="outCount() === 0 && isLightNeutral()"
          [class.bg-slate-100/50]="outCount() === 0 && isLightNeutral()"
          [class.border-white/15]="outCount() === 0 && !isLightNeutral()"
          [class.bg-black/15]="outCount() === 0 && !isLightNeutral()"
        >
          @if (outTokens().length > 0) {
            @for (outIdx of outTokens(); track outIdx) {
              <span
                class="animate-token-drop relative inline-flex h-[22px] w-[22px] items-center justify-center opacity-85 sm:h-6 sm:w-6"
                aria-hidden="true"
              >
                <svg
                  appPieceSvg
                  [player]="player()"
                  [style]="pieceStyle()"
                  [customColor]="customPieceColor()"
                  class="h-full w-full"
                ></svg>
              </span>
            }
            @if (overflowOutCount() > 0) {
              <span class="text-[10px] font-bold text-amber-600 tabular-nums dark:text-amber-300">
                +{{ formatDigit(overflowOutCount()) }}
              </span>
            }
          } @else {
            <div class="flex items-center justify-center gap-1 py-1 opacity-40" aria-hidden="true">
              <span class="h-4 w-4 rounded-full border border-dashed border-current"></span>
              <span class="h-4 w-4 rounded-full border border-dashed border-current"></span>
              <span class="h-4 w-4 rounded-full border border-dashed border-current"></span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class PieceTray {
  readonly player = input.required<Player>();
  readonly label = input.required<string>();
  readonly inHandCount = input<number>(0);
  readonly onBoardCount = input<number>(0);
  readonly outCount = input<number>(0);
  readonly showReserve = input<boolean>(true);
  readonly isActiveTurn = input<boolean>(false);
  readonly theme = input<BoardTheme>('navy');
  readonly pieceStyle = input<PieceStyle>('gemstone');
  readonly colorMode = input<ColorMode>('dark');
  readonly customPieceColor = input<string | null>(null);
  readonly customBoardColor = input<string | null>(null);
  readonly expanded = input<boolean>(false);

  readonly isLightNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'light',
  );

  readonly boardTokens = computed<BoardColorTokens>(() =>
    resolveBoardColorTokens(this.theme(), this.colorMode(), this.customBoardColor()),
  );

  readonly trayBg = computed<string>(() => this.boardTokens().frameBg);

  readonly inHandTokens = computed<number[]>(() => {
    const count = Math.max(0, Math.min(12, this.inHandCount()));
    return Array.from({ length: count }, (_, idx) => idx);
  });

  readonly outTokens = computed<number[]>(() => {
    const count = Math.max(0, Math.min(12, this.outCount()));
    return Array.from({ length: count }, (_, idx) => idx);
  });

  readonly overflowOutCount = computed<number>(() => Math.max(0, this.outCount() - 12));

  readonly trayAriaLabel = computed<string>(() => {
    return `${this.label()}، در دست: ${toPersianDigits(this.inHandCount())}، روی صفحه: ${toPersianDigits(this.onBoardCount())}، خارج‌شده از بازی: ${toPersianDigits(this.outCount())}`;
  });

  formatDigit(n: number): string {
    return toPersianDigits(n);
  }
}
