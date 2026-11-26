import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toPersianDigits } from './dooz-engine';
import { BoardTheme, ColorMode, PieceStyle, Player } from './dooz.types';

let nextTrayUid = 1;

@Component({
  selector: 'app-piece-tray',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex w-full flex-row items-stretch justify-between gap-2.5 rounded-2xl border p-2.5 shadow-sm backdrop-blur-md transition-all duration-200 md:flex-col md:justify-start"
      [class.md:w-[88px]]="!expanded()"
      [class.md:w-[108px]]="expanded()"
      [class.md:p-3]="expanded()"
      [class.border-slate-300/90]="isLightNeutral()"
      [class.bg-white/90]="isLightNeutral()"
      [class.border-white/15]="isDarkNeutral()"
      [class.bg-[#132234]/90]="isDarkNeutral()"
      [class.border-amber-700/45]="theme() === 'walnut'"
      [class.bg-[#2B1912]/92]="theme() === 'walnut'"
      [class.border-emerald-700/45]="theme() === 'felt'"
      [class.bg-[#0D2E21]/92]="theme() === 'felt'"
      [class.border-cyan-500/35]="theme() === 'tile'"
      [class.bg-[#0B303B]/92]="theme() === 'tile'"
      [class.ring-2]="isActiveTurn()"
      [class.ring-rose-500/75]="isActiveTurn() && player() === 'X'"
      [class.ring-teal-400/75]="isActiveTurn() && player() === 'O'"
      [attr.aria-label]="trayAriaLabel()"
    >
      <!-- Shared SVG Gradients for authentic sculpted miniature tokens -->
      <svg class="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden="true">
        <defs>
          <radialGradient [attr.id]="gradId('ruby')" cx="34%" cy="30%" r="72%">
            <stop offset="0%" stop-color="#FDA4AF" />
            <stop offset="38%" stop-color="#E11D48" />
            <stop offset="100%" stop-color="#881337" />
          </radialGradient>
          <radialGradient [attr.id]="gradId('turq')" cx="34%" cy="30%" r="72%">
            <stop offset="0%" stop-color="#99F6E4" />
            <stop offset="40%" stop-color="#0D9488" />
            <stop offset="100%" stop-color="#115E59" />
          </radialGradient>
          <radialGradient [attr.id]="gradId('mahogany')" cx="34%" cy="28%" r="70%">
            <stop offset="0%" stop-color="#B45309" />
            <stop offset="48%" stop-color="#7C2D12" />
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
            <stop offset="42%" stop-color="#FB7185" />
            <stop offset="100%" stop-color="#E11D48" />
          </radialGradient>
        </defs>
      </svg>

      <!-- Player Header -->
      <div class="flex shrink-0 flex-col items-center justify-center gap-0.5 text-center md:w-full md:border-b md:pb-2"
        [class.md:border-slate-900/10]="isLightNeutral()"
        [class.md:border-white/10]="!isLightNeutral()"
      >
        <span
          class="max-w-[76px] truncate text-[11px] font-extrabold"
          [class.text-rose-700]="isLightNeutral() && player() === 'X'"
          [class.text-rose-300]="!isLightNeutral() && player() === 'X'"
          [class.text-teal-700]="isLightNeutral() && player() === 'O'"
          [class.text-teal-300]="!isLightNeutral() && player() === 'O'"
        >
          {{ label() }}
        </span>
        <span
          class="text-[10px] font-medium tabular-nums"
          [class.text-slate-500]="isLightNeutral()"
          [class.text-slate-300/80]="!isLightNeutral()"
        >
          صفحه: {{ formatDigit(onBoardCount()) }}
        </span>
      </div>

      <!-- Zone 1: Reserve / In-Hand Pieces -->
      @if (showReserve()) {
        <div class="flex flex-1 flex-col items-center gap-1.5 md:flex-initial">
          <div class="flex items-center gap-1 text-[10px] font-semibold"
            [class.text-slate-600]="isLightNeutral()"
            [class.text-slate-300]="!isLightNeutral()"
          >
            <span>در دست</span>
            <span class="font-extrabold tabular-nums">({{ formatDigit(inHandCount()) }})</span>
          </div>

          <div
            class="flex min-h-[34px] w-full flex-wrap items-center justify-center gap-1 rounded-xl border p-1.5"
            [class.border-slate-200/90]="isLightNeutral()"
            [class.bg-slate-100/80]="isLightNeutral()"
            [class.border-white/10]="!isLightNeutral()"
            [class.bg-black/20]="!isLightNeutral()"
          >
            @if (inHandTokens().length > 0) {
              @for (tokenIdx of inHandTokens(); track tokenIdx) {
                <span class="animate-token-drop inline-flex h-5 w-5 items-center justify-center sm:h-[22px] sm:w-[22px]" aria-hidden="true">
                  <svg viewBox="0 0 100 100" class="h-full w-full drop-shadow-xs">
                    @if (player() === 'X') {
                      @switch (pieceStyle()) {
                        @case ('gemstone') {
                          <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('ruby') + ')'" stroke="#FECDD3" stroke-width="5" />
                          <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="3" />
                          <ellipse cx="38" cy="35" rx="10" ry="6" fill="rgba(255,255,255,0.42)" transform="rotate(-25 38 35)" />
                        }
                        @case ('wood') {
                          <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('mahogany') + ')'" stroke="#F59E0B" stroke-width="5" />
                          <polygon points="50,24 72,50 50,76 28,50" fill="none" stroke="#FDE68A" stroke-width="4" />
                        }
                        @case ('nature') {
                          <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFF1F2" stroke-width="5" />
                          <circle cx="50" cy="50" r="14" fill="#FEF08A" />
                        }
                        @default {
                          <circle cx="50" cy="50" r="42" fill="#E11D48" stroke="#FFE4E6" stroke-width="5" />
                          <line x1="34" y1="34" x2="66" y2="66" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" />
                          <line x1="66" y1="34" x2="34" y2="66" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" />
                        }
                      }
                    } @else {
                      @switch (pieceStyle()) {
                        @case ('gemstone') {
                          <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('turq') + ')'" stroke="#CCFBF1" stroke-width="5" />
                          <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,0.42)" stroke-width="3" />
                          <ellipse cx="38" cy="35" rx="10" ry="6" fill="rgba(255,255,255,0.42)" transform="rotate(-25 38 35)" />
                        }
                        @case ('wood') {
                          <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('ivory') + ')'" stroke="#D97706" stroke-width="5" />
                          <circle cx="50" cy="50" r="22" fill="none" stroke="#B45309" stroke-width="4.5" />
                        }
                        @case ('nature') {
                          <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('jade') + ')'" stroke="#D1FAE5" stroke-width="5" />
                          <circle cx="50" cy="50" r="18" fill="none" stroke="#A7F3D0" stroke-width="4" />
                        }
                        @default {
                          <circle cx="50" cy="50" r="42" fill="#0D9488" stroke="#CCFBF1" stroke-width="5" />
                          <circle cx="50" cy="50" r="21" fill="none" stroke="#FFFFFF" stroke-width="9" />
                        }
                      }
                    }
                  </svg>
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
        <div class="flex items-center gap-1 text-[10px] font-bold"
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
                <svg viewBox="0 0 100 100" class="h-full w-full drop-shadow-xs">
                  @if (player() === 'X') {
                    @switch (pieceStyle()) {
                      @case ('gemstone') {
                        <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('ruby') + ')'" stroke="#FECDD3" stroke-width="5" />
                        <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" />
                      }
                      @case ('wood') {
                        <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('mahogany') + ')'" stroke="#F59E0B" stroke-width="5" />
                        <polygon points="50,24 72,50 50,76 28,50" fill="none" stroke="#FDE68A" stroke-width="4" />
                      }
                      @case ('nature') {
                        <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFF1F2" stroke-width="5" />
                        <circle cx="50" cy="50" r="14" fill="#FEF08A" />
                      }
                      @default {
                        <circle cx="50" cy="50" r="42" fill="#E11D48" stroke="#FFE4E6" stroke-width="5" />
                        <line x1="34" y1="34" x2="66" y2="66" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" />
                        <line x1="66" y1="34" x2="34" y2="66" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round" />
                      }
                    }
                  } @else {
                    @switch (pieceStyle()) {
                      @case ('gemstone') {
                        <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('turq') + ')'" stroke="#CCFBF1" stroke-width="5" />
                        <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" />
                      }
                      @case ('wood') {
                        <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('ivory') + ')'" stroke="#D97706" stroke-width="5" />
                        <circle cx="50" cy="50" r="22" fill="none" stroke="#B45309" stroke-width="4.5" />
                      }
                      @case ('nature') {
                        <circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + gradId('jade') + ')'" stroke="#D1FAE5" stroke-width="5" />
                        <circle cx="50" cy="50" r="18" fill="none" stroke="#A7F3D0" stroke-width="4" />
                      }
                      @default {
                        <circle cx="50" cy="50" r="42" fill="#0D9488" stroke="#CCFBF1" stroke-width="5" />
                        <circle cx="50" cy="50" r="21" fill="none" stroke="#FFFFFF" stroke-width="9" />
                      }
                    }
                  }
                </svg>
              </span>
            }
            @if (overflowOutCount() > 0) {
              <span class="text-[10px] font-bold text-amber-600 tabular-nums dark:text-amber-300">
                +{{ formatDigit(overflowOutCount()) }}
              </span>
            }
          } @else {
            <!-- Recessed empty tabletop slots when 0 pieces have been knocked out -->
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
  private readonly uid = `pt${nextTrayUid++}`;

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
  readonly expanded = input<boolean>(false);

  readonly isLightNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'light',
  );

  readonly isDarkNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'dark',
  );

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

  gradId(name: string): string {
    return `${this.uid}-${name}`;
  }

  formatDigit(n: number): string {
    return toPersianDigits(n);
  }
}
