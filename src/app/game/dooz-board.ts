import { I18n, TranslatePipe } from '../i18n';
import { inject, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BoardColorTokens, resolveBoardColorTokens } from './color-palette';
import { BoardTheme, CellValue, ColorMode, PieceStyle, Player, WinResult } from './dooz.types';
import { DoozPieceSvg } from './dooz-piece-svg';

@Component({
  selector: 'app-dooz-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DoozPieceSvg],
  template: `
    <div
      class="relative mx-auto w-full rounded-2xl border p-4 shadow-md transition-colors duration-200 sm:p-5"
      [class.max-w-[430px]]="!expanded()"
      [class.max-w-[min(68dvh,600px)]]="expanded()"
      [class.backdrop-blur-md]="theme() === 'glass'"
      [class.shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_10px_30px_rgba(0,0,0,0.28)]]="theme() === 'glass'"
      [style.background-color]="boardTokens().frameBg"
      [style.background-image]="tabletop() ? 'var(--surface-finish)' : null"
      [style.border-color]="boardTokens().borderColor"
    >
      <!-- Subtle luxury inlaid inner border line -->
      <div
        class="pointer-events-none absolute inset-2 rounded-xl border border-white/10"
        aria-hidden="true"
      ></div>

      <div
        dir="ltr"
        role="grid"
        [attr.aria-label]="'صفحه بازی دوز سه در سه' | t"
        class="relative grid aspect-square w-full grid-cols-3 grid-rows-3 gap-3 sm:gap-3.5"
      >
        @for (cell of board(); track $index) {
          <button
            type="button"
            role="gridcell"
            [disabled]="disabled() || cell !== null"
            [attr.aria-label]="getCellAriaLabel($index, cell)"
            (click)="onSelect($index)"
            class="group relative flex aspect-square min-h-0 w-full items-center justify-center rounded-xl border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            [style.background-color]="getCellBackground($index)"
            [style.border-color]="getCellBorderColor($index)"
            [class.backdrop-blur-sm]="theme() === 'glass'"
            [class.shadow-[inset_0_2px_6px_rgba(0,0,0,0.34)]]="!isLightNeutral() && !customBoardColor() && theme() !== 'glass'"
            [class.shadow-[inset_0_1px_1px_rgba(255,255,255,0.38)]]="theme() === 'glass'"
            [class.shadow-xs]="isLightNeutral() && !customBoardColor()"
            [class.hover:brightness-110]="!disabled() && cell === null"
            [class.border-dashed]="isExpiringCell($index) || isHintCell($index)"
            [class.opacity-45]="winResult() !== null && !isWinningCell($index)"
          >
            @if (showCellNumbers() && cell === null && !disabled()) {
              <span
                class="pointer-events-none absolute top-2 right-2.5 text-[11px] font-medium tabular-nums"
                [class.text-slate-400]="isLightNeutral() && !customBoardColor()"
                [class.text-white/40]="!isLightNeutral() || customBoardColor() !== null"
                aria-hidden="true"
              >
                {{ formatDigit($index + 1) }}
              </span>
            }

            @if (cell !== null) {
              <svg
                appPieceSvg
                [player]="cell"
                [style]="pieceStyle()"
                [customColor]="cell === 'X' ? customXColor() : customOColor()"
                class="absolute inset-[12%] h-[76%] w-[76%] transition-opacity duration-150"
                [class.drop-shadow-[2px_4px_2px_rgba(0,0,0,0.5)]]="tabletop()"
                [class.opacity-45]="isExpiringCell($index)"
              ></svg>
            }

            @if (isExpiringCell($index)) {
              <span
                dir="auto"
                class="pointer-events-none absolute bottom-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300"
              >
                {{ 'حذف بعدی' | t }}
              </span>
            } @else if (isHintCell($index)) {
              <span
                dir="auto"
                class="pointer-events-none absolute bottom-1.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300"
              >
                {{ 'پیشنهاد' | t }}
              </span>
            }
          </button>
        }

        @if (winResult(); as win) {
          <svg
            viewBox="0 0 300 300"
            class="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_0_8px_rgba(245,158,11,0.75)]"
            aria-hidden="true"
          >
            <line
              [attr.x1]="win.geometry.x1"
              [attr.y1]="win.geometry.y1"
              [attr.x2]="win.geometry.x2"
              [attr.y2]="win.geometry.y2"
              stroke="#FBBF24"
              stroke-width="8"
              stroke-linecap="round"
              class="animate-win-line"
            />
          </svg>
        }
      </div>
    </div>
  `,
})
export class DoozBoard {
  readonly i18n = inject(I18n);
  readonly board = input.required<readonly CellValue[]>();
  readonly currentTurn = input.required<Player>();
  readonly winResult = input<WinResult | null>(null);
  readonly disabled = input<boolean>(false);
  readonly expiringIndex = input<number | null>(null);
  readonly lastMoveIndex = input<number | null>(null);
  readonly hintIndex = input<number | null>(null);
  readonly theme = input<BoardTheme>('navy');
  readonly tabletop = input(false);
  readonly pieceStyle = input<PieceStyle>('gemstone');
  readonly colorMode = input<ColorMode>('dark');
  readonly customXColor = input<string | null>(null);
  readonly customOColor = input<string | null>(null);
  readonly customBoardColor = input<string | null>(null);
  readonly showCellNumbers = input<boolean>(true);
  readonly expanded = input<boolean>(false);

  readonly cellSelected = output<number>();

  readonly isLightNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'light',
  );

  readonly boardTokens = computed<BoardColorTokens>(() =>
    resolveBoardColorTokens(this.theme(), this.colorMode(), this.customBoardColor()),
  );

  getCellBackground(index: number): string {
    if (this.isWinningCell(index)) return 'rgba(251, 191, 36, 0.22)';
    if (this.isHintCell(index)) return 'rgba(56, 189, 248, 0.2)';
    if (this.isExpiringCell(index)) return 'rgba(245, 158, 11, 0.14)';
    return this.boardTokens().cellBg;
  }

  getCellBorderColor(index: number): string {
    if (this.isWinningCell(index)) return '#FBBF24';
    if (this.isHintCell(index)) return '#38BDF8';
    if (this.isExpiringCell(index)) return 'rgba(251, 191, 36, 0.72)';
    if (this.lastMoveIndex() === index) return '#14B8A6';
    return this.boardTokens().borderColor;
  }

  onSelect(index: number): void {
    if (this.disabled() || this.board()[index] !== null) {
      return;
    }
    this.cellSelected.emit(index);
  }

  isWinningCell(index: number): boolean {
    const win = this.winResult();
    return win !== null && win.cells.includes(index);
  }

  isExpiringCell(index: number): boolean {
    return this.winResult() === null && this.expiringIndex() === index;
  }

  isHintCell(index: number): boolean {
    return (
      !this.disabled() &&
      this.winResult() === null &&
      this.hintIndex() === index &&
      this.board()[index] === null
    );
  }

  formatDigit(n: number): string {
    return this.i18n.digits(n);
  }

  getCellAriaLabel(index: number, value: CellValue): string {
    const row = Math.floor(index / 3) + 1;
    const col = (index % 3) + 1;
    const stateText = value === null ? this.i18n.text("خالی") : this.i18n.text("مهره {0}", [value]);
    const expireNote = this.isExpiringCell(index) ? this.i18n.text("، در حرکت بعدی حذف می‌شود") : '';
    const hintNote = this.isHintCell(index) ? this.i18n.text("، حرکت پیشنهادی") : '';
    return this.i18n.text("خانه {0}، ردیف {1} ستون {2}، {3}{4}{5}", [this.i18n.digits(index + 1), this.i18n.digits(row), this.i18n.digits(col), stateText, expireNote, hintNote]);
  }
}
