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

      <!-- Horizontal cylindrical shading for physical 3D pedestal walls -->
      <svg:linearGradient [attr.id]="uid('cyl')" x1="0%" y1="0%" x2="100%" y2="0%">
        <svg:stop offset="0%" [attr.stop-color]="shades().shadow" />
        <svg:stop offset="28%" [attr.stop-color]="shades().highlight" />
        <svg:stop offset="65%" [attr.stop-color]="shades().mid" />
        <svg:stop offset="100%" [attr.stop-color]="shades().shadow" />
      </svg:linearGradient>

      <svg:linearGradient [attr.id]="uid('gold')" x1="15%" y1="10%" x2="85%" y2="90%">
        <svg:stop offset="0%" stop-color="#FEF3C7" />
        <svg:stop offset="35%" stop-color="#F59E0B" />
        <svg:stop offset="70%" stop-color="#B45309" />
        <svg:stop offset="100%" stop-color="#FDE68A" />
      </svg:linearGradient>

      <svg:linearGradient [attr.id]="uid('goldCyl')" x1="0%" y1="0%" x2="100%" y2="0%">
        <svg:stop offset="0%" stop-color="#78350F" />
        <svg:stop offset="28%" stop-color="#FEF3C7" />
        <svg:stop offset="62%" stop-color="#D97706" />
        <svg:stop offset="100%" stop-color="#78350F" />
      </svg:linearGradient>

      <svg:linearGradient [attr.id]="uid('sheen')" x1="20%" y1="5%" x2="80%" y2="85%">
        <svg:stop offset="0%" stop-color="rgba(255,255,255,0.56)" />
        <svg:stop offset="45%" stop-color="rgba(255,255,255,0.08)" />
        <svg:stop offset="100%" stop-color="rgba(0,0,0,0.24)" />
      </svg:linearGradient>

      <svg:radialGradient [attr.id]="uid('castShadow')" cx="48%" cy="48%" r="52%">
        <svg:stop offset="0%" stop-color="rgba(0,0,0,0.62)" />
        <svg:stop offset="62%" stop-color="rgba(0,0,0,0.34)" />
        <svg:stop offset="100%" stop-color="rgba(0,0,0,0)" />
      </svg:radialGradient>
    </svg:defs>

    <!-- Grounded Directional Cast Shadow (long oblique shadow in 3D mode) -->
    @if (threeD()) {
      <svg:ellipse
        cx="58"
        cy="61"
        rx="41"
        ry="33"
        transform="rotate(14 58 61)"
        [attr.fill]="'url(#' + uid('castShadow') + ')'"
      />
    } @else {
      <svg:ellipse cx="50" cy="55.5" rx="40" ry="37" fill="rgba(0,0,0,0.32)" />
    }

    @switch (style()) {
      @case ('crown') {
        <!-- Upright Turned Chess-Inspired Staunton Finial -->
        <svg:g [attr.transform]="threeD() ? 'translate(0, -4)' : null">
          <!-- Broad turned pedestal base -->
          <svg:path
            d="M21 76 L21 82 A29 8 0 0 0 79 82 L79 76 Z"
            [attr.fill]="'url(#' + uid('cyl') + ')'"
          />
          <svg:ellipse cx="50" cy="76" rx="29" ry="8.5" [attr.fill]="'url(#' + uid('body') + ')'" [attr.stroke]="shades().stroke" stroke-width="1.4" />
          <svg:ellipse cx="50" cy="70" rx="22" ry="6.5" [attr.fill]="'url(#' + uid('goldCyl') + ')'" />

          <!-- Tapered column body -->
          <svg:path
            d="M32 70 Q38 52 38 38 L62 38 Q62 52 68 70 Z"
            [attr.fill]="'url(#' + uid('cyl') + ')'"
          />
          <!-- Collar ring -->
          <svg:ellipse cx="50" cy="39" rx="16.5" ry="4.8" [attr.fill]="'url(#' + uid('goldCyl') + ')'" />
          <svg:ellipse cx="50" cy="37.5" rx="16.5" ry="4.5" [attr.fill]="'url(#' + uid('gold') + ')'" />

          <!-- Top sculpted crown (King finial for X, Smooth Pawn sphere for O) -->
          @if (player() === 'X') {
            <svg:path
              d="M35 36 L31 20 L42 26 L50 14 L58 26 L69 20 L65 36 Z"
              [attr.fill]="'url(#' + uid('cyl') + ')'"
              [attr.stroke]="shades().stroke"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
            <svg:circle cx="50" cy="12.5" r="4" [attr.fill]="'url(#' + uid('gold') + ')'" />
          } @else {
            <svg:circle
              cx="50"
              cy="24.5"
              r="14.5"
              [attr.fill]="'url(#' + uid('body') + ')'"
              [attr.stroke]="shades().stroke"
              stroke-width="1.4"
            />
            <svg:ellipse
              cx="44.5"
              cy="19"
              rx="4.8"
              ry="2.6"
              transform="rotate(-30 44.5 19)"
              fill="rgba(255,255,255,0.52)"
            />
          }
          <!-- Vertical glossy specular streak along column -->
          <svg:path
            d="M39 67 Q42 52 42 42"
            fill="none"
            stroke="rgba(255,255,255,0.34)"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg:g>
      }

      @case ('gemstone') {
        <!-- Extruded 3D brass pedestal wall when in 3D tabletop -->
        @if (threeD()) {
          <svg:path
            d="M8.5 46 L8.5 57.5 A41.5 39 0 0 0 91.5 57.5 L91.5 46 Z"
            [attr.fill]="'url(#' + uid('goldCyl') + ')'"
          />
        }
        <svg:g [attr.transform]="threeD() ? 'translate(0, -4)' : null">
          <svg:circle cx="50" cy="50" r="41.5" [attr.fill]="'url(#' + uid('gold') + ')'" />
          <svg:circle cx="50" cy="50" r="37" fill="rgba(15,10,6,0.38)" />
          <svg:circle
            cx="50"
            cy="50"
            r="35.2"
            [attr.fill]="'url(#' + uid('body') + ')'"
            [attr.stroke]="shades().stroke"
            stroke-width="1.4"
          />
          <svg:polygon
            points="50,18 72,28 82,50 72,72 50,82 28,72 18,50 28,28"
            fill="none"
            [attr.stroke]="shades().innerRing"
            stroke-width="1.4"
          />
          <svg:polygon
            points="50,24 68,32 76,50 68,68 50,76 32,68 24,50 32,32"
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.22)"
            stroke-width="1"
          />
          <svg:ellipse
            cx="37"
            cy="32"
            rx="12"
            ry="6"
            transform="rotate(-32 37 32)"
            fill="rgba(255,255,255,0.48)"
          />
          <svg:circle cx="66" cy="67" r="3" fill="rgba(255,255,255,0.28)" />
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
        </svg:g>
      }

      @case ('marble') {
        <!-- Thick polished Carrara marble vs obsidian stone counter -->
        @if (threeD()) {
          <svg:path
            d="M10 47 L10 58 A40 37 0 0 0 90 58 L90 47 Z"
            [attr.fill]="'url(#' + uid('cyl') + ')'"
          />
        }
        <svg:g [attr.transform]="threeD() ? 'translate(0, -4)' : null">
          <svg:circle
            cx="50"
            cy="50"
            r="40"
            [attr.fill]="'url(#' + uid('body') + ')'"
            [attr.stroke]="shades().stroke"
            stroke-width="2"
          />
          <!-- Organic mineral marble veins -->
          <svg:path
            d="M22 36 Q42 44 58 26 T 79 44 M20 62 Q44 56 64 72"
            fill="none"
            [attr.stroke]="shades().innerRing"
            stroke-width="2"
            stroke-linecap="round"
          />
          <!-- Glossy porcelain specular arc -->
          <svg:ellipse
            cx="37"
            cy="30"
            rx="14"
            ry="7"
            transform="rotate(-28 37 30)"
            fill="rgba(255,255,255,0.48)"
          />
          @if (player() === 'X') {
            <svg:g [attr.stroke]="shades().emblem" stroke-width="7.2" stroke-linecap="round">
              <svg:line x1="36" y1="36" x2="64" y2="64" />
              <svg:line x1="64" y1="36" x2="36" y2="64" />
            </svg:g>
          } @else {
            <svg:circle cx="50" cy="50" r="14.5" fill="none" [attr.stroke]="shades().emblem" stroke-width="6.8" />
          }
        </svg:g>
      }

      @case ('brass') {
        <!-- Hammered antique bronze vs sterling silver coin -->
        @if (threeD()) {
          <svg:path
            d="M9 46 L9 57 A41 38 0 0 0 91 57 L91 46 Z"
            [attr.fill]="'url(#' + uid('cyl') + ')'"
          />
        }
        <svg:g [attr.transform]="threeD() ? 'translate(0, -4)' : null">
          <svg:circle
            cx="50"
            cy="50"
            r="40.5"
            [attr.fill]="'url(#' + uid('body') + ')'"
            [attr.stroke]="shades().stroke"
            stroke-width="2.4"
          />
          <svg:circle
            cx="50"
            cy="50"
            r="34"
            fill="none"
            [attr.stroke]="shades().stroke"
            stroke-width="1.6"
            stroke-dasharray="4 3"
          />
          <svg:circle cx="50" cy="50" r="28" fill="none" [attr.stroke]="shades().innerRing" stroke-width="1.4" />
          <svg:circle cx="50" cy="50" r="40" [attr.fill]="'url(#' + uid('sheen') + ')'" opacity="0.55" />
          @if (player() === 'X') {
            <svg:g stroke="rgba(0,0,0,0.34)" stroke-width="8" stroke-linecap="round">
              <svg:line x1="36" y1="37.5" x2="64" y2="65.5" />
              <svg:line x1="64" y1="37.5" x2="36" y2="65.5" />
            </svg:g>
            <svg:g [attr.stroke]="shades().emblem" stroke-width="6.8" stroke-linecap="round">
              <svg:line x1="36" y1="36" x2="64" y2="64" />
              <svg:line x1="64" y1="36" x2="36" y2="64" />
            </svg:g>
          } @else {
            <svg:circle cx="50" cy="51.2" r="15" fill="none" stroke="rgba(0,0,0,0.32)" stroke-width="7.8" />
            <svg:circle cx="50" cy="50" r="15" fill="none" [attr.stroke]="shades().emblem" stroke-width="6.6" />
          }
        </svg:g>
      }

      @case ('wood') {
        @if (threeD()) {
          <svg:path
            d="M9 46 L9 57 A41 38 0 0 0 91 57 L91 46 Z"
            [attr.fill]="'url(#' + uid('goldCyl') + ')'"
          />
        }
        <svg:g [attr.transform]="threeD() ? 'translate(0, -4)' : null">
          <svg:circle cx="50" cy="50" r="41.5" [attr.fill]="'url(#' + uid('gold') + ')'" />
          <svg:circle
            cx="50"
            cy="50"
            r="38"
            [attr.fill]="'url(#' + uid('body') + ')'"
            [attr.stroke]="shades().stroke"
            stroke-width="1.5"
          />
          <svg:circle cx="50" cy="50" r="33" fill="none" [attr.stroke]="shades().innerRing" stroke-width="1.2" />
          <svg:circle cx="50" cy="50" r="24" fill="none" [attr.stroke]="shades().innerRing" stroke-width="1" />
          <svg:polygon
            points="50,15 58,28 73,25 70,40 85,50 70,60 73,75 58,72 50,85 42,72 27,75 30,60 15,50 30,40 27,25 42,28"
            fill="none"
            [attr.stroke]="shades().stroke"
            stroke-width="1.6"
            opacity="0.72"
          />
          <svg:circle cx="50" cy="50" r="38" [attr.fill]="'url(#' + uid('sheen') + ')'" opacity="0.45" />
          @if (player() === 'X') {
            <svg:g [attr.stroke]="shades().emblem" stroke-width="7.2" stroke-linecap="round">
              <svg:line x1="37" y1="37" x2="63" y2="63" />
              <svg:line x1="63" y1="37" x2="37" y2="63" />
            </svg:g>
          } @else {
            <svg:circle cx="50" cy="50" r="15.5" fill="none" [attr.stroke]="shades().emblem" stroke-width="6.8" />
          }
        </svg:g>
      }

      @case ('nature') {
        @if (threeD()) {
          <svg:path
            d="M11 47 L11 56 A39 36 0 0 0 89 56 L89 47 Z"
            [attr.fill]="'url(#' + uid('cyl') + ')'"
          />
        }
        <svg:g [attr.transform]="threeD() ? 'translate(0, -4)' : null">
          @if (player() === 'X') {
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
              fill="rgba(255,255,255,0.44)"
            />
            <svg:circle cx="50" cy="50" r="15" fill="none" [attr.stroke]="shades().emblem" stroke-width="6.5" />
          }
        </svg:g>
      }

      @case ('neon') {
        <!-- Luminous crystal prism -->
        @if (threeD()) {
          <svg:path
            d="M11 46 L11 57 A39 36 0 0 0 89 57 L89 46 Z"
            [attr.fill]="'url(#' + uid('cyl') + ')'"
            opacity="0.85"
          />
        }
        <svg:g [attr.transform]="threeD() ? 'translate(0, -4)' : null">
          <svg:polygon
            points="50,9 79,21 91,50 79,79 50,91 21,79 9,50 21,21"
            [attr.fill]="'url(#' + uid('body') + ')'"
            [attr.stroke]="shades().stroke"
            stroke-width="2.2"
          />
          <svg:polygon
            points="50,19 71,29 81,50 71,71 50,81 29,71 19,50 29,29"
            fill="rgba(255,255,255,0.14)"
            stroke="rgba(255,255,255,0.55)"
            stroke-width="1.4"
          />
          @if (player() === 'X') {
            <svg:g [attr.stroke]="shades().emblem" stroke-width="7.2" stroke-linecap="round">
              <svg:line x1="36" y1="36" x2="64" y2="64" />
              <svg:line x1="64" y1="36" x2="36" y2="64" />
            </svg:g>
          } @else {
            <svg:circle cx="50" cy="50" r="14.5" fill="none" [attr.stroke]="shades().emblem" stroke-width="6.8" />
          }
        </svg:g>
      }

      @default {
        <!-- Tournament weighted ceramic chip -->
        @if (threeD()) {
          <svg:path
            d="M10 46 L10 57 A40 37 0 0 0 90 57 L90 46 Z"
            [attr.fill]="'url(#' + uid('cyl') + ')'"
          />
        }
        <svg:g [attr.transform]="threeD() ? 'translate(0, -4)' : null">
          <svg:circle
            cx="50"
            cy="50"
            r="40"
            [attr.fill]="'url(#' + uid('body') + ')'"
            [attr.stroke]="shades().stroke"
            stroke-width="2.5"
          />
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
        </svg:g>
      }
    }
  `,
})
export class DoozPieceSvg {
  private readonly instanceUid = nextPieceSvgUid++;

  readonly player = input.required<Player>();
  readonly style = input<PieceStyle>('gemstone');
  readonly customColor = input<string | null>(null);
  readonly threeD = input<boolean>(false);

  readonly shades = computed<PieceShades>(() =>
    resolvePieceShades(this.player(), this.style(), this.customColor()),
  );

  uid(suffix: string): string {
    return `dps-${this.instanceUid}-${suffix}`;
  }
}
