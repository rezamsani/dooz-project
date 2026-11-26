import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BoardTheme, CellValue, ColorMode, PieceStyle, Player, WinResult } from './dooz.types';
import { toPersianDigits } from './dooz-engine';

let nextDoozBoardUid = 1;

@Component({
  selector: 'app-dooz-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative mx-auto w-full rounded-2xl border p-4 shadow-md transition-all duration-200 sm:p-5"
      [class.max-w-[430px]]="!expanded()"
      [class.max-w-[min(68dvh,600px)]]="expanded()"
      [class.border-slate-300/90]="isLightNeutral()"
      [class.bg-[#F4F6F9]]="isLightNeutral()"
      [class.border-white/15]="isDarkNeutral()"
      [class.bg-[#132234]]="isDarkNeutral()"
      [class.border-amber-700/45]="theme() === 'walnut'"
      [class.bg-[#321E16]]="theme() === 'walnut'"
      [class.border-emerald-700/45]="theme() === 'felt'"
      [class.bg-[#103828]]="theme() === 'felt'"
      [class.border-cyan-500/35]="theme() === 'tile'"
      [class.bg-[#0E3A47]]="theme() === 'tile'"
    >
      <!-- Shared SVG Gradients for tactile piece materials -->
      <svg class="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden="true">
        <defs>
          <radialGradient [attr.id]="gradId('ruby')" cx="34%" cy="30%" r="72%">
            <stop offset="0%" stop-color="#FDA4AF" />
            <stop offset="35%" stop-color="#E11D48" />
            <stop offset="100%" stop-color="#881337" />
          </radialGradient>
          <radialGradient [attr.id]="gradId('turq')" cx="34%" cy="30%" r="72%">
            <stop offset="0%" stop-color="#99F6E4" />
            <stop offset="38%" stop-color="#0D9488" />
            <stop offset="100%" stop-color="#115E59" />
          </radialGradient>
          <radialGradient [attr.id]="gradId('mahogany')" cx="35%" cy="28%" r="70%">
            <stop offset="0%" stop-color="#B45309" />
            <stop offset="45%" stop-color="#7C2D12" />
            <stop offset="100%" stop-color="#431407" />
          </radialGradient>
          <radialGradient [attr.id]="gradId('ivory')" cx="32%" cy="28%" r="72%">
            <stop offset="0%" stop-color="#FFFDF7" />
            <stop offset="60%" stop-color="#F5EBD6" />
            <stop offset="100%" stop-color="#D6C29F" />
          </radialGradient>
          <radialGradient [attr.id]="gradId('jade')" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stop-color="#A7F3D0" />
            <stop offset="45%" stop-color="#059669" />
            <stop offset="100%" stop-color="#065F46" />
          </radialGradient>
          <radialGradient [attr.id]="gradId('coral')" cx="35%" cy="30%" r="72%">
            <stop offset="0%" stop-color="#FDE047" />
            <stop offset="40%" stop-color="#FB7185" />
            <stop offset="100%" stop-color="#E11D48" />
          </radialGradient>
        </defs>
      </svg>

      <div
        dir="ltr"
        role="grid"
        aria-label="صفحه بازی دوز سه در سه"
        class="relative grid aspect-square w-full grid-cols-3 grid-rows-3 gap-3 sm:gap-3.5"
      >
        @for (cell of board(); track $index) {
          <button
            type="button"
            role="gridcell"
            [disabled]="disabled() || cell !== null"
            [attr.aria-label]="getCellAriaLabel($index, cell)"
            (click)="onSelect($index)"
            class="group relative flex aspect-square min-h-[76px] w-full items-center justify-center rounded-xl border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            [class.bg-white]="isLightNeutral() && !isWinningCell($index) && !isExpiringCell($index) && !isHintCell($index)"
            [class.shadow-xs]="isLightNeutral()"
            [class.bg-[#1A2D44]]="isDarkNeutral() && !isWinningCell($index) && !isExpiringCell($index) && !isHintCell($index)"
            [class.bg-[#452B20]]="theme() === 'walnut' && !isWinningCell($index) && !isExpiringCell($index) && !isHintCell($index)"
            [class.bg-[#174D37]]="theme() === 'felt' && !isWinningCell($index) && !isExpiringCell($index) && !isHintCell($index)"
            [class.bg-[#144E5E]]="theme() === 'tile' && !isWinningCell($index) && !isExpiringCell($index) && !isHintCell($index)"
            [class.border-slate-300/80]="isLightNeutral() && !isWinningCell($index) && !isExpiringCell($index) && !isHintCell($index) && lastMoveIndex() !== $index"
            [class.border-white/12]="!isLightNeutral() && !isWinningCell($index) && !isExpiringCell($index) && !isHintCell($index) && lastMoveIndex() !== $index"
            [class.border-teal-500]="lastMoveIndex() === $index && !isWinningCell($index) && !isExpiringCell($index) && !isHintCell($index)"
            [class.hover:brightness-110]="!disabled() && cell === null && !isLightNeutral()"
            [class.hover:bg-teal-50/70]="!disabled() && cell === null && isLightNeutral()"
            [class.hover:border-teal-400/60]="!disabled() && cell === null"
            [class.active:scale-[0.97]]="!disabled() && cell === null"
            [class.bg-amber-400/20]="isWinningCell($index)"
            [class.border-amber-400]="isWinningCell($index)"
            [class.border-sky-400]="isHintCell($index)"
            [class.border-dashed]="isExpiringCell($index) || isHintCell($index)"
            [class.bg-sky-500/18]="isHintCell($index)"
            [class.bg-amber-500/12]="isExpiringCell($index)"
            [class.border-amber-400/70]="isExpiringCell($index)"
            [class.opacity-45]="winResult() !== null && !isWinningCell($index)"
          >
            @if (showCellNumbers() && cell === null && !disabled()) {
              <span
                class="pointer-events-none absolute top-2 right-2.5 text-[11px] font-medium tabular-nums"
                [class.text-slate-400]="isLightNeutral()"
                [class.text-white/40]="!isLightNeutral()"
                aria-hidden="true"
              >
                {{ formatDigit($index + 1) }}
              </span>
            }

            @if (cell === 'X') {
              @switch (pieceStyle()) {
                @case ('gemstone') {
                  <svg
                    viewBox="0 0 100 100"
                    class="animate-token-drop h-[72%] w-[72%] drop-shadow-sm transition-opacity duration-150"
                    [class.opacity-45]="isExpiringCell($index)"
                    aria-hidden="true"
                  >
                    <circle cx="50" cy="52" r="39" fill="rgba(0,0,0,0.22)" />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      [attr.fill]="'url(#' + gradId('ruby') + ')'"
                      stroke="#FDE68A"
                      stroke-width="3.5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="31"
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      stroke-width="1.5"
                    />
                    <ellipse
                      cx="38"
                      cy="33"
                      rx="11"
                      ry="6"
                      transform="rotate(-30 38 33)"
                      fill="rgba(255,255,255,0.34)"
                    />
                    <line
                      x1="36"
                      y1="36"
                      x2="64"
                      y2="64"
                      stroke="#FFFDF7"
                      stroke-width="7.5"
                      stroke-linecap="round"
                    />
                    <line
                      x1="64"
                      y1="36"
                      x2="36"
                      y2="64"
                      stroke="#FFFDF7"
                      stroke-width="7.5"
                      stroke-linecap="round"
                    />
                  </svg>
                }
                @case ('wood') {
                  <svg
                    viewBox="0 0 100 100"
                    class="animate-token-drop h-[72%] w-[72%] drop-shadow-sm transition-opacity duration-150"
                    [class.opacity-45]="isExpiringCell($index)"
                    aria-hidden="true"
                  >
                    <circle cx="50" cy="52" r="39" fill="rgba(0,0,0,0.24)" />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      [attr.fill]="'url(#' + gradId('mahogany') + ')'"
                      stroke="#F59E0B"
                      stroke-width="3"
                    />
                    <polygon
                      points="50,18 60,26 73,27 74,40 82,50 74,60 73,73 60,74 50,82 40,74 27,73 26,60 18,50 26,40 27,27 40,26"
                      fill="none"
                      stroke="rgba(253,230,138,0.45)"
                      stroke-width="1.8"
                    />
                    <line
                      x1="37"
                      y1="37"
                      x2="63"
                      y2="63"
                      stroke="#FEF3C7"
                      stroke-width="7.5"
                      stroke-linecap="round"
                    />
                    <line
                      x1="63"
                      y1="37"
                      x2="37"
                      y2="63"
                      stroke="#FEF3C7"
                      stroke-width="7.5"
                      stroke-linecap="round"
                    />
                  </svg>
                }
                @case ('nature') {
                  <svg
                    viewBox="0 0 100 100"
                    class="animate-token-drop h-[74%] w-[74%] drop-shadow-sm transition-opacity duration-150"
                    [class.opacity-45]="isExpiringCell($index)"
                    aria-hidden="true"
                  >
                    <circle cx="50" cy="30" r="19" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFE4E6" stroke-width="2" />
                    <circle cx="70" cy="50" r="19" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFE4E6" stroke-width="2" />
                    <circle cx="50" cy="70" r="19" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFE4E6" stroke-width="2" />
                    <circle cx="30" cy="50" r="19" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFE4E6" stroke-width="2" />
                    <circle cx="50" cy="50" r="15" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5" />
                    <line x1="43" y1="43" x2="57" y2="57" stroke="#FFFBEB" stroke-width="4.5" stroke-linecap="round" />
                    <line x1="57" y1="43" x2="43" y2="57" stroke="#FFFBEB" stroke-width="4.5" stroke-linecap="round" />
                  </svg>
                }
                @default {
                  <svg
                    viewBox="0 0 100 100"
                    class="h-[58%] w-[58%] transition-opacity duration-150"
                    [class.opacity-45]="isExpiringCell($index)"
                    aria-hidden="true"
                  >
                    <line
                      x1="22"
                      y1="22"
                      x2="78"
                      y2="78"
                      [attr.stroke]="isLightNeutral() ? '#E11D48' : '#FB7185'"
                      stroke-width="11"
                      stroke-linecap="round"
                      class="animate-piece-draw"
                    />
                    <line
                      x1="78"
                      y1="22"
                      x2="22"
                      y2="78"
                      [attr.stroke]="isLightNeutral() ? '#E11D48' : '#FB7185'"
                      stroke-width="11"
                      stroke-linecap="round"
                      class="animate-piece-draw-delay"
                    />
                  </svg>
                }
              }
            } @else if (cell === 'O') {
              @switch (pieceStyle()) {
                @case ('gemstone') {
                  <svg
                    viewBox="0 0 100 100"
                    class="animate-token-drop h-[72%] w-[72%] drop-shadow-sm transition-opacity duration-150"
                    [class.opacity-45]="isExpiringCell($index)"
                    aria-hidden="true"
                  >
                    <circle cx="50" cy="52" r="39" fill="rgba(0,0,0,0.22)" />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      [attr.fill]="'url(#' + gradId('turq') + ')'"
                      stroke="#FDE68A"
                      stroke-width="3.5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="31"
                      fill="none"
                      stroke="rgba(255,255,255,0.28)"
                      stroke-width="1.5"
                    />
                    <ellipse
                      cx="38"
                      cy="33"
                      rx="11"
                      ry="6"
                      transform="rotate(-30 38 33)"
                      fill="rgba(255,255,255,0.36)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="15"
                      fill="none"
                      stroke="#F0FDFA"
                      stroke-width="7"
                    />
                  </svg>
                }
                @case ('wood') {
                  <svg
                    viewBox="0 0 100 100"
                    class="animate-token-drop h-[72%] w-[72%] drop-shadow-sm transition-opacity duration-150"
                    [class.opacity-45]="isExpiringCell($index)"
                    aria-hidden="true"
                  >
                    <circle cx="50" cy="52" r="39" fill="rgba(0,0,0,0.22)" />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      [attr.fill]="'url(#' + gradId('ivory') + ')'"
                      stroke="#92400E"
                      stroke-width="3.5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="29"
                      fill="none"
                      stroke="#B45309"
                      stroke-width="1.5"
                      stroke-dasharray="4 3"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="14.5"
                      fill="none"
                      stroke="#78350F"
                      stroke-width="6.5"
                    />
                  </svg>
                }
                @case ('nature') {
                  <svg
                    viewBox="0 0 100 100"
                    class="animate-token-drop h-[72%] w-[72%] drop-shadow-sm transition-opacity duration-150"
                    [class.opacity-45]="isExpiringCell($index)"
                    aria-hidden="true"
                  >
                    <circle cx="50" cy="52" r="38" fill="rgba(0,0,0,0.2)" />
                    <circle
                      cx="50"
                      cy="50"
                      r="37"
                      [attr.fill]="'url(#' + gradId('jade') + ')'"
                      stroke="#D1FAE5"
                      stroke-width="3"
                    />
                    <ellipse
                      cx="38"
                      cy="33"
                      rx="11"
                      ry="5.5"
                      transform="rotate(-28 38 33)"
                      fill="rgba(255,255,255,0.34)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="15.5"
                      fill="none"
                      stroke="#ECFDF5"
                      stroke-width="6.5"
                    />
                    <circle cx="50" cy="50" r="4.5" fill="#A7F3D0" />
                  </svg>
                }
                @default {
                  <svg
                    viewBox="0 0 100 100"
                    class="h-[58%] w-[58%] transition-opacity duration-150"
                    [class.opacity-45]="isExpiringCell($index)"
                    aria-hidden="true"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="29"
                      fill="none"
                      [attr.stroke]="isLightNeutral() ? '#0D9488' : '#2DD4BF'"
                      stroke-width="11"
                      stroke-linecap="round"
                      transform="rotate(-90 50 50)"
                      class="animate-piece-draw"
                    />
                  </svg>
                }
              }
            } @else if (!disabled()) {
              @if (currentTurn() === 'X') {
                <svg
                  viewBox="0 0 100 100"
                  class="pointer-events-none h-[52%] w-[52%] opacity-0 transition-opacity duration-150 group-hover:opacity-30"
                  aria-hidden="true"
                >
                  <line
                    x1="22"
                    y1="22"
                    x2="78"
                    y2="78"
                    stroke="#FB7185"
                    stroke-width="10"
                    stroke-linecap="round"
                  />
                  <line
                    x1="78"
                    y1="22"
                    x2="22"
                    y2="78"
                    stroke="#FB7185"
                    stroke-width="10"
                    stroke-linecap="round"
                  />
                </svg>
              } @else {
                <svg
                  viewBox="0 0 100 100"
                  class="pointer-events-none h-[52%] w-[52%] opacity-0 transition-opacity duration-150 group-hover:opacity-30"
                  aria-hidden="true"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="29"
                    fill="none"
                    stroke="#2DD4BF"
                    stroke-width="10"
                    stroke-linecap="round"
                  />
                </svg>
              }
            }

            @if (isExpiringCell($index)) {
              <span
                dir="rtl"
                class="pointer-events-none absolute bottom-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300"
              >
                حذف بعدی
              </span>
            } @else if (isHintCell($index)) {
              <span
                dir="rtl"
                class="pointer-events-none absolute bottom-1.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300"
              >
                پیشنهاد
              </span>
            }
          </button>
        }

        @if (winResult(); as win) {
          <svg
            viewBox="0 0 300 300"
            class="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <line
              [attr.x1]="win.geometry.x1"
              [attr.y1]="win.geometry.y1"
              [attr.x2]="win.geometry.x2"
              [attr.y2]="win.geometry.y2"
              stroke="#F59E0B"
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
  private readonly uid = `db${nextDoozBoardUid++}`;

  readonly board = input.required<readonly CellValue[]>();
  readonly currentTurn = input.required<Player>();
  readonly winResult = input<WinResult | null>(null);
  readonly disabled = input<boolean>(false);
  readonly expiringIndex = input<number | null>(null);
  readonly lastMoveIndex = input<number | null>(null);
  readonly hintIndex = input<number | null>(null);
  readonly theme = input<BoardTheme>('navy');
  readonly pieceStyle = input<PieceStyle>('gemstone');
  readonly colorMode = input<ColorMode>('dark');
  readonly showCellNumbers = input<boolean>(true);
  readonly expanded = input<boolean>(false);

  readonly cellSelected = output<number>();

  readonly isLightNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'light',
  );

  readonly isDarkNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'dark',
  );

  gradId(name: string): string {
    return `${this.uid}-${name}`;
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
    return toPersianDigits(n);
  }

  getCellAriaLabel(index: number, value: CellValue): string {
    const row = Math.floor(index / 3) + 1;
    const col = (index % 3) + 1;
    const stateText = value === null ? 'خالی' : `مهره ${value}`;
    const expireNote = this.isExpiringCell(index) ? '، در حرکت بعدی حذف می‌شود' : '';
    const hintNote = this.isHintCell(index) ? '، حرکت پیشنهادی' : '';
    return `خانه ${toPersianDigits(index + 1)}، ردیف ${toPersianDigits(row)} ستون ${toPersianDigits(col)}، ${stateText}${expireNote}${hintNote}`;
  }
}
