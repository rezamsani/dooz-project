import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  CURATED_COLOR_SWATCHES,
  getDefaultPieceHex,
  normalizeHex,
  resolveBoardColorTokens,
} from './color-palette';
import { PlayerStats } from './player-stats';
import { SoundFx } from './sound-fx';

type PaletteTarget = 'X' | 'O' | 'BOARD';

@Component({
  selector: 'app-color-palette-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="space-y-2.5 rounded-xl border border-slate-900/10 bg-slate-50/90 p-2.5 dark:border-white/10 dark:bg-[#0B1623]/90">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <mat-icon class="!h-[16px] !w-[16px] !text-[16px] text-teal-600 dark:text-teal-300">palette</mat-icon>
          <span>پالت رنگ آزاد (CSS)</span>
        </div>

        @if (playerStats.hasCustomColors()) {
          <button
            type="button"
            (click)="resetAll()"
            class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300"
          >
            بازنشانی همه
          </button>
        }
      </div>

      <!-- Target selector: Piece X / Piece O / Board -->
      <div class="grid grid-cols-3 gap-1 rounded-lg bg-slate-200/75 p-1 dark:bg-[#132234]">
        <button
          type="button"
          (click)="selectTarget('X')"
          class="flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] font-semibold transition-colors"
          [class.bg-white]="target() === 'X'"
          [class.dark:bg-[#1E334D]]="target() === 'X'"
          [class.text-slate-950]="target() === 'X'"
          [class.dark:text-white]="target() === 'X'"
          [class.shadow-xs]="target() === 'X'"
          [class.text-slate-600]="target() !== 'X'"
          [class.dark:text-slate-400]="target() !== 'X'"
        >
          <span
            class="h-3 w-3 shrink-0 rounded-full border border-white/40 shadow-xs"
            [style.background-color]="previewX()"
          ></span>
          <span>مهره ۱</span>
        </button>

        <button
          type="button"
          (click)="selectTarget('O')"
          class="flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] font-semibold transition-colors"
          [class.bg-white]="target() === 'O'"
          [class.dark:bg-[#1E334D]]="target() === 'O'"
          [class.text-slate-950]="target() === 'O'"
          [class.dark:text-white]="target() === 'O'"
          [class.shadow-xs]="target() === 'O'"
          [class.text-slate-600]="target() !== 'O'"
          [class.dark:text-slate-400]="target() !== 'O'"
        >
          <span
            class="h-3 w-3 shrink-0 rounded-full border border-white/40 shadow-xs"
            [style.background-color]="previewO()"
          ></span>
          <span>مهره ۲</span>
        </button>

        <button
          type="button"
          (click)="selectTarget('BOARD')"
          class="flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11px] font-semibold transition-colors"
          [class.bg-white]="target() === 'BOARD'"
          [class.dark:bg-[#1E334D]]="target() === 'BOARD'"
          [class.text-slate-950]="target() === 'BOARD'"
          [class.dark:text-white]="target() === 'BOARD'"
          [class.shadow-xs]="target() === 'BOARD'"
          [class.text-slate-600]="target() !== 'BOARD'"
          [class.dark:text-slate-400]="target() !== 'BOARD'"
        >
          <span
            class="h-3 w-3 shrink-0 rounded-sm border border-white/40 shadow-xs"
            [style.background-color]="previewBoard()"
          ></span>
          <span>صفحه</span>
        </button>
      </div>

      <!-- Full CSS Spectrum Color Picker + Hex Code Input + Reset Target -->
      <div class="flex items-center gap-2">
        <label
          class="relative flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-800 transition-colors hover:border-teal-500 dark:border-white/15 dark:bg-[#1A2D44] dark:text-slate-100 dark:hover:border-teal-400"
          title="انتخاب از طیف کامل رنگ‌های CSS"
        >
          <span
            class="h-4 w-4 shrink-0 rounded-full border border-black/20 shadow-xs"
            [style.background]="'conic-gradient(#f43f5e, #f59e0b, #10b981, #06b6d4, #6366f1, #ec4899, #f43f5e)'"
          ></span>
          <span>طیف کامل رنگ</span>
          <input
            type="color"
            [value]="activeColorHex()"
            (input)="onNativeColorInput($event)"
            aria-label="انتخابگر رنگ CSS"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        <input
          type="text"
          dir="ltr"
          maxlength="7"
          [value]="activeColorHex()"
          (change)="onHexTextChange($event)"
          aria-label="کد رنگ CSS هگز"
          placeholder="#0D9488"
          class="h-8 w-[84px] rounded-lg border border-slate-300 bg-white px-2 text-center font-mono text-[11px] font-semibold text-slate-900 uppercase outline-none focus:border-teal-500 dark:border-white/15 dark:bg-[#132234] dark:text-slate-100 dark:focus:border-teal-400"
        />

        @if (hasActiveCustom()) {
          <button
            type="button"
            (click)="resetCurrentTarget()"
            title="حذف رنگ سفارشی این بخش"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:border-amber-500 hover:text-amber-600 dark:border-white/15 dark:bg-[#1A2D44] dark:text-slate-300 dark:hover:text-amber-300"
          >
            <mat-icon class="!h-[16px] !w-[16px] !text-[16px]">restart_alt</mat-icon>
          </button>
        }
      </div>

      <!-- 18 Curated Designer Swatches -->
      <div class="grid grid-cols-9 gap-1.5 pt-0.5">
        @for (swatch of swatches; track swatch.hex) {
          <button
            type="button"
            (click)="applySwatch(swatch.hex)"
            [title]="swatch.name + ' (' + swatch.hex + ')'"
            [attr.aria-label]="swatch.name"
            class="h-6 w-full rounded-md border transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-amber-400"
            [style.background-color]="swatch.hex"
            [class.border-amber-400]="activeColorHex() === swatch.hex"
            [class.ring-2]="activeColorHex() === swatch.hex"
            [class.ring-amber-400/70]="activeColorHex() === swatch.hex"
            [class.border-black/20]="activeColorHex() !== swatch.hex"
            [class.dark:border-white/20]="activeColorHex() !== swatch.hex"
          ></button>
        }
      </div>
    </div>
  `,
})
export class ColorPalettePicker {
  readonly playerStats = inject(PlayerStats);
  private readonly soundFx = inject(SoundFx);

  readonly swatches = CURATED_COLOR_SWATCHES;
  readonly target = signal<PaletteTarget>('X');

  readonly previewX = computed<string>(
    () =>
      this.playerStats.customXColor() ??
      getDefaultPieceHex('X', this.playerStats.pieceStyle()),
  );

  readonly previewO = computed<string>(
    () =>
      this.playerStats.customOColor() ??
      getDefaultPieceHex('O', this.playerStats.pieceStyle()),
  );

  readonly previewBoard = computed<string>(
    () =>
      resolveBoardColorTokens(
        this.playerStats.boardTheme(),
        this.playerStats.colorMode(),
        this.playerStats.customBoardColor(),
      ).frameBg,
  );

  readonly activeColorHex = computed<string>(() => {
    switch (this.target()) {
      case 'X':
        return this.previewX();
      case 'O':
        return this.previewO();
      case 'BOARD':
        return this.previewBoard();
    }
  });

  readonly hasActiveCustom = computed<boolean>(() => {
    switch (this.target()) {
      case 'X':
        return this.playerStats.customXColor() !== null;
      case 'O':
        return this.playerStats.customOColor() !== null;
      case 'BOARD':
        return this.playerStats.customBoardColor() !== null;
    }
  });

  selectTarget(next: PaletteTarget): void {
    this.soundFx.playClick();
    this.target.set(next);
  }

  applySwatch(hex: string): void {
    this.soundFx.playClick();
    this.playerStats.setCustomColor(this.target(), hex);
  }

  onNativeColorInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    const valid = normalizeHex(inputEl?.value);
    if (valid) {
      this.playerStats.setCustomColor(this.target(), valid);
    }
  }

  onHexTextChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    const valid = normalizeHex(inputEl?.value);
    if (valid) {
      this.soundFx.playClick();
      this.playerStats.setCustomColor(this.target(), valid);
    } else if (inputEl) {
      inputEl.value = this.activeColorHex();
    }
  }

  resetCurrentTarget(): void {
    this.soundFx.playClick();
    this.playerStats.setCustomColor(this.target(), null);
  }

  resetAll(): void {
    this.soundFx.playClick();
    this.playerStats.resetCustomColors();
  }
}
