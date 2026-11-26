import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PieceShades, resolvePieceShades } from './color-palette';
import { PieceStyle, Player } from './dooz.types';

let nextPieceSvgUid = 1;

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'svg[appPieceSvg]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    viewBox: '0 0 100 100',
    'aria-hidden': 'true',
  },
  template: `
    <svg:defs>
      <svg:radialGradient [attr.id]="uid('body')" cx="34%" cy="28%" r="74%">
        <svg:stop offset="0%" [attr.stop-color]="shades().highlight" />
        <svg:stop offset="44%" [attr.stop-color]="shades().mid" />
        <svg:stop offset="100%" [attr.stop-color]="shades().shadow" />
      </svg:radialGradient>

      <svg:linearGradient [attr.id]="uid('gold')" x1="15%" y1="10%" x2="85%" y2="90%">
        <svg:stop offset="0%" stop-color="#FEF3C7" />
        <svg:stop offset="35%" stop-color="#F59E0B" />
        <svg:stop offset="70%" stop-color="#B45309" />
        <svg:stop offset="100%" stop-color="#FDE68A" />
      </svg:linearGradient>

      <svg:linearGradient [attr.id]="uid('sheen')" x1="20%" y1="5%" x2="80%" y2="85%">
        <svg:stop offset="0%" stop-color="rgba(255,255,255,0.52)" />
        <svg:stop offset="45%" stop-color="rgba(255,255,255,0.08)" />
        <svg:stop offset="100%" stop-color="rgba(0,0,0,0.22)" />
      </svg:linearGradient>
    </svg:defs>

    @switch (style()) {
      @case ('gemstone') {
        <!-- Soft grounded drop shadow -->
        <svg:ellipse cx="50" cy="55" rx="41" ry="39" fill="rgba(0,0,0,0.34)" />

        <!-- Turned antique gold bezel -->
        <svg:circle cx="50" cy="50" r="42" [attr.fill]="'url(#' + uid('gold') + ')'" />
        <svg:circle cx="50" cy="50" r="37.5" fill="rgba(15,10,6,0.35)" />

        <!-- Luminous domed gemstone cabochon -->
        <svg:circle
          cx="50"
          cy="50"
          r="35.5"
          [attr.fill]="'url(#' + uid('body') + ')'"
          [attr.stroke]="shades().stroke"
          stroke-width="1.4"
        />

        <!-- Faceted octagonal jewel crown -->
        <svg:polygon
          points="50,18 72,28 82,50 72,72 50,82 28,72 18,50 28,28"
          fill="none"
          [attr.stroke]="shades().innerRing"
          stroke-width="1.4"
        />
        <svg:polygon
          points="50,24 68,32 76,50 68,68 50,76 32,68 24,50 32,32"
          fill="rgba(255,255,255,0.06)"
          stroke="rgba(255,255,255,0.2)"
          stroke-width="1"
        />

        <!-- Dual specular crystal catchlights -->
        <svg:ellipse
          cx="37"
          cy="32"
          rx="12"
          ry="6"
          transform="rotate(-32 37 32)"
          fill="rgba(255,255,255,0.46)"
        />
        <svg:circle cx="66" cy="67" r="3" fill="rgba(255,255,255,0.28)" />

        <!-- Crest emblem -->
        @if (player() === 'X') {
          <svg:g stroke="rgba(0,0,0,0.35)" stroke-width="8.5" stroke-linecap="round">
            <svg:line x1="36" y1="37.5" x2="64" y2="65.5" />
            <svg:line x1="64" y1="37.5" x2="36" y2="65.5" />
          </svg:g>
          <svg:g [attr.stroke]="shades().emblem" stroke-width="7.2" stroke-linecap="round">
            <svg:line x1="36" y1="36" x2="64" y2="64" />
            <svg:line x1="64" y1="36" x2="36" y2="64" />
          </svg:g>
        } @else {
          <svg:circle cx="50" cy="51.5" r="15" fill="none" stroke="rgba(0,0,0,0.34)" stroke-width="8" />
          <svg:circle cx="50" cy="50" r="15" fill="none" [attr.stroke]="shades().emblem" stroke-width="6.8" />
          <svg:circle cx="50" cy="50" r="4.5" [attr.fill]="shades().emblem" opacity="0.9" />
        }
      }

      @case ('wood') {
        <!-- Soft shadow -->
        <svg:ellipse cx="50" cy="55" rx="41" ry="39" fill="rgba(0,0,0,0.34)" />

        <!-- Outer brass inlay rim -->
        <svg:circle cx="50" cy="50" r="41.5" [attr.fill]="'url(#' + uid('gold') + ')'" />

        <!-- Turned wood / ivory body -->
        <svg:circle
          cx="50"
          cy="50"
          r="38"
          [attr.fill]="'url(#' + uid('body') + ')'"
          [attr.stroke]="shades().stroke"
          stroke-width="1.5"
        />

        <!-- Concentric lathe rings -->
        <svg:circle cx="50" cy="50" r="33" fill="none" [attr.stroke]="shades().innerRing" stroke-width="1.2" />
        <svg:circle cx="50" cy="50" r="24" fill="none" [attr.stroke]="shades().innerRing" stroke-width="1" />

        <!-- Persian Khatam 8-point geometric star -->
        <svg:polygon
          points="50,15 58,28 73,25 70,40 85,50 70,60 73,75 58,72 50,85 42,72 27,75 30,60 15,50 30,40 27,25 42,28"
          fill="none"
          [attr.stroke]="shades().stroke"
          stroke-width="1.6"
          opacity="0.72"
        />

        <!-- Specular wood polish -->
        <svg:circle cx="50" cy="50" r="38" [attr.fill]="'url(#' + uid('sheen') + ')'" opacity="0.45" />

        @if (player() === 'X') {
          <svg:g [attr.stroke]="shades().emblem" stroke-width="7.2" stroke-linecap="round">
            <svg:line x1="37" y1="37" x2="63" y2="63" />
            <svg:line x1="63" y1="37" x2="37" y2="63" />
          </svg:g>
        } @else {
          <svg:circle cx="50" cy="50" r="15.5" fill="none" [attr.stroke]="shades().emblem" stroke-width="6.8" />
        }
      }

      @case ('nature') {
        <!-- Soft organic shadow -->
        <svg:ellipse cx="50" cy="55" rx="41" ry="39" fill="rgba(0,0,0,0.3)" />

        @if (player() === 'X') {
          <!-- 8-petal layered lotus blossom -->
          <svg:g [attr.fill]="'url(#' + uid('body') + ')'" [attr.stroke]="shades().stroke" stroke-width="1.6">
            <svg:ellipse cx="50" cy="24" rx="12" ry="19" transform="rotate(45 50 50)" opacity="0.88" />
            <svg:ellipse cx="50" cy="24" rx="12" ry="19" transform="rotate(135 50 50)" opacity="0.88" />
            <svg:ellipse cx="50" cy="24" rx="12" ry="19" transform="rotate(225 50 50)" opacity="0.88" />
            <svg:ellipse cx="50" cy="24" rx="12" ry="19" transform="rotate(315 50 50)" opacity="0.88" />
          </svg:g>
          <svg:g [attr.fill]="'url(#' + uid('body') + ')'" [attr.stroke]="shades().stroke" stroke-width="1.8">
            <svg:ellipse cx="50" cy="23" rx="13.5" ry="20" />
            <svg:ellipse cx="50" cy="23" rx="13.5" ry="20" transform="rotate(90 50 50)" />
            <svg:ellipse cx="50" cy="23" rx="13.5" ry="20" transform="rotate(180 50 50)" />
            <svg:ellipse cx="50" cy="23" rx="13.5" ry="20" transform="rotate(270 50 50)" />
          </svg:g>
          <svg:circle cx="50" cy="50" r="16.5" [attr.fill]="'url(#' + uid('gold') + ')'" stroke="#FFFBEB" stroke-width="2" />
          <svg:g stroke="#451A03" stroke-width="4.6" stroke-linecap="round" opacity="0.85">
            <svg:line x1="43" y1="43" x2="57" y2="57" />
            <svg:line x1="57" y1="43" x2="43" y2="57" />
          </svg:g>
        } @else {
          <!-- Smooth polished jade river cabochon -->
          <svg:circle
            cx="50"
            cy="50"
            r="39"
            [attr.fill]="'url(#' + uid('body') + ')'"
            [attr.stroke]="shades().stroke"
            stroke-width="2.5"
          />
          <svg:circle cx="50" cy="50" r="30" fill="none" [attr.stroke]="shades().innerRing" stroke-width="1.4" stroke-dasharray="14 6" />
          <svg:ellipse
            cx="37"
            cy="31"
            rx="12.5"
            ry="6.5"
            transform="rotate(-28 37 31)"
            fill="rgba(255,255,255,0.42)"
          />
          <svg:circle cx="50" cy="50" r="15" fill="none" [attr.stroke]="shades().emblem" stroke-width="6.5" />
        }
      }

      @default {
        <!-- Tournament weighted ceramic chip -->
        <svg:ellipse cx="50" cy="55" rx="41" ry="39" fill="rgba(0,0,0,0.34)" />

        <!-- Outer ceramic body -->
        <svg:circle
          cx="50"
          cy="50"
          r="40"
          [attr.fill]="'url(#' + uid('body') + ')'"
          [attr.stroke]="shades().stroke"
          stroke-width="2.5"
        />

        <!-- Dual-tone casino / tournament edge ticks -->
        <svg:circle
          cx="50"
          cy="50"
          r="35.5"
          fill="none"
          [attr.stroke]="shades().emblem"
          stroke-width="3.6"
          stroke-dasharray="7 8.5"
          opacity="0.72"
        />

        <!-- Recessed center medallion -->
        <svg:circle
          cx="50"
          cy="50"
          r="28.5"
          [attr.fill]="'url(#' + uid('body') + ')'"
          [attr.stroke]="shades().innerRing"
          stroke-width="1.8"
        />
        <svg:circle cx="50" cy="50" r="28.5" [attr.fill]="'url(#' + uid('sheen') + ')'" opacity="0.35" />

        @if (player() === 'X') {
          <svg:g stroke="rgba(0,0,0,0.32)" stroke-width="8.5" stroke-linecap="round">
            <svg:line x1="36" y1="37.5" x2="64" y2="65.5" />
            <svg:line x1="64" y1="37.5" x2="36" y2="65.5" />
          </svg:g>
          <svg:g [attr.stroke]="shades().emblem" stroke-width="7.5" stroke-linecap="round">
            <svg:line x1="36" y1="36" x2="64" y2="64" />
            <svg:line x1="64" y1="36" x2="36" y2="64" />
          </svg:g>
        } @else {
          <svg:circle cx="50" cy="51.5" r="14.5" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="8" />
          <svg:circle cx="50" cy="50" r="14.5" fill="none" [attr.stroke]="shades().emblem" stroke-width="7" />
        }
      }
    }
  `,
})
export class DoozPieceSvg {
  private readonly instanceUid = nextPieceSvgUid++;

  readonly player = input.required<Player>();
  readonly style = input<PieceStyle>('gemstone');
  readonly customColor = input<string | null>(null);

  readonly shades = computed<PieceShades>(() =>
    resolvePieceShades(this.player(), this.style(), this.customColor()),
  );

  uid(suffix: string): string {
    return `dps-${this.instanceUid}-${suffix}`;
  }
}
