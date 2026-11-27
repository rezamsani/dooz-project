import { I18n } from '../i18n';
import { inject, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BoardColorTokens, resolveBoardColorTokens } from './color-palette';
import { BoardTheme, ColorMode, PieceStyle } from './dooz.types';
import { DoozPieceSvg } from './dooz-piece-svg';
import {
  MORRIS_NODES,
  MorrisAiDecision,
  canPlayerFly,
  getMorrisEdges,
  getRemovableOpponentNodes,
  getValidDestinationsForNode,
} from './morris-engine';
import { MorrisEdge, MorrisMill, MorrisNodeCoord, MorrisState } from './morris.types';

let nextMorrisBoardUid = 1;

@Component({
  selector: 'app-morris-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DoozPieceSvg],
  template: `
    <div
      class="relative mx-auto w-full rounded-2xl border p-3 shadow-md transition-colors duration-200 sm:p-4"
      [class.max-w-[440px]]="!expanded()"
      [class.max-w-[min(68dvh,620px)]]="expanded()"
      [class.backdrop-blur-md]="theme() === 'glass'"
      [class.shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_10px_30px_rgba(0,0,0,0.28)]]="theme() === 'glass'"
      [style.background-color]="boardTokens().frameBg"
      [style.background-image]="tabletop() ? 'var(--surface-finish)' : null"
      [style.border-color]="boardTokens().borderColor"
    >
      <!-- Outer chamfered frame highlight -->
      <div
        class="pointer-events-none absolute inset-1.5 rounded-xl border border-white/12 shadow-[inset_0_2px_10px_rgba(0,0,0,0.28)]"
        aria-hidden="true"
      ></div>

      <svg
        viewBox="0 0 400 400"
        role="group"
        [attr.aria-label]="boardAriaLabel()"
        class="relative block aspect-square w-full select-none"
      >
        <defs>
          <!-- Overhead studio directional illumination across the board -->
          <radialGradient [attr.id]="uid('deckLight')" cx="38%" cy="30%" r="76%">
            <stop offset="0%" stop-color="rgba(255,250,235,0.13)" />
            <stop offset="55%" stop-color="rgba(255,255,255,0)" />
            <stop offset="100%" stop-color="rgba(0,0,0,0.24)" />
          </radialGradient>

          <!-- Machined brass / metallic rim gradient -->
          <linearGradient [attr.id]="uid('brassRim')" x1="15%" y1="10%" x2="85%" y2="90%">
            <stop offset="0%" [attr.stop-color]="rimHighlight()" />
            <stop offset="48%" [attr.stop-color]="socketStroke()" />
            <stop offset="100%" [attr.stop-color]="rimShadow()" />
          </linearGradient>

          <!-- Recessed socket bowl gradient -->
          <radialGradient [attr.id]="uid('socketBowl')" cx="54%" cy="56%" r="65%">
            <stop offset="0%" [attr.stop-color]="socketFill()" />
            <stop offset="68%" [attr.stop-color]="socketFill()" />
            <stop offset="100%" stop-color="rgba(0,0,0,0.62)" />
          </radialGradient>

          <!-- Subtle wood grain / tile texture overlay -->
          <pattern [attr.id]="uid('grain')" width="80" height="80" patternUnits="userSpaceOnUse">
            @if (theme() === 'walnut') {
              <path
                d="M0 10 Q 20 6 40 10 T 80 10 M0 28 Q 25 32 50 28 T 80 28 M0 48 Q 18 44 42 48 T 80 48 M0 66 Q 22 70 46 66 T 80 66"
                fill="none"
                stroke="rgba(255,220,170,0.06)"
                stroke-width="1.2"
              />
              <path
                d="M0 19 Q 22 23 44 19 T 80 19 M0 57 Q 20 53 45 57 T 80 57"
                fill="none"
                stroke="rgba(0,0,0,0.14)"
                stroke-width="1"
              />
            } @else if (theme() === 'tile') {
              <rect x="2" y="2" width="76" height="76" rx="4" fill="none" stroke="rgba(126,210,223,0.09)" stroke-width="1" />
              <path d="M40 8 L72 40 L40 72 L8 40 Z" fill="none" stroke="rgba(253,230,138,0.07)" stroke-width="1" />
            } @else if (theme() === 'felt') {
              <circle cx="16" cy="18" r="0.8" fill="rgba(255,255,255,0.06)" />
              <circle cx="52" cy="34" r="0.8" fill="rgba(0,0,0,0.16)" />
              <circle cx="32" cy="64" r="0.8" fill="rgba(255,255,255,0.05)" />
              <circle cx="68" cy="70" r="0.8" fill="rgba(0,0,0,0.14)" />
            }
          </pattern>
        </defs>

        <!-- Tactile surface finish & lighting vignette -->
        @if (theme() !== 'glass') {
          <rect x="4" y="4" width="392" height="392" rx="14" [attr.fill]="'url(#' + uid('grain') + ')'" />
          <rect x="4" y="4" width="392" height="392" rx="14" [attr.fill]="'url(#' + uid('deckLight') + ')'" />
        }

        <!-- Artisanal inlaid outer perimeter border -->
        <rect
          x="13"
          y="13"
          width="374"
          height="374"
          rx="12"
          fill="none"
          [attr.stroke]="trackStroke()"
          stroke-width="1"
          opacity="0.22"
        />

        <!-- Delicate Persian Shamseh centerpiece rosette -->
        <g transform="translate(200, 200)" opacity="0.08" aria-hidden="true">
          <circle cx="0" cy="0" r="30" fill="none" [attr.stroke]="trackStroke()" stroke-width="1.2" />
          <polygon
            points="0,-24 6,-6 24,0 6,6 0,24 -6,6 -24,0 -6,-6"
            fill="none"
            [attr.stroke]="trackStroke()"
            stroke-width="1.2"
          />
          <polygon
            points="0,-18 5,-5 18,0 5,5 0,18 -5,5 -18,0 -5,-5"
            transform="rotate(45)"
            fill="none"
            [attr.stroke]="trackStroke()"
            stroke-width="1"
          />
          <circle cx="0" cy="0" r="4" [attr.fill]="trackStroke()" />
        </g>

        <!-- 4 Antique corner rivets -->
        @for (corner of cornerRivets; track $index) {
          <g aria-hidden="true">
            <circle [attr.cx]="corner.x" [attr.cy]="corner.y + 0.8" r="4.8" fill="rgba(0,0,0,0.38)" />
            <circle [attr.cx]="corner.x" [attr.cy]="corner.y" r="4.4" [attr.fill]="'url(#' + uid('brassRim') + ')'" />
            <circle [attr.cx]="corner.x - 1.2" [attr.cy]="corner.y - 1.2" r="1.2" fill="rgba(255,255,255,0.48)" />
          </g>
        }

        <!-- Carved 3-layer tracks: dark recessed groove -> inlaid track -> subtle specular edge -->
        @for (edge of edges(); track $index) {
          <!-- Layer 1: Recessed groove shadow -->
          <line
            [attr.x1]="nodes[edge.from].x"
            [attr.y1]="nodes[edge.from].y + 1.1"
            [attr.x2]="nodes[edge.to].x"
            [attr.y2]="nodes[edge.to].y + 1.1"
            [attr.stroke]="grooveShadow()"
            [attr.stroke-width]="edge.diagonal ? 6.4 : 7.6"
            stroke-linecap="round"
          />
          <!-- Layer 2: Inlaid track body -->
          <line
            [attr.x1]="nodes[edge.from].x"
            [attr.y1]="nodes[edge.from].y"
            [attr.x2]="nodes[edge.to].x"
            [attr.y2]="nodes[edge.to].y"
            [attr.stroke]="edge.diagonal ? diagonalStroke() : trackStroke()"
            [attr.stroke-width]="edge.diagonal ? 2.8 : 3.4"
            stroke-linecap="round"
          />
          <!-- Layer 3: Subtle top bevel highlight -->
          <line
            [attr.x1]="nodes[edge.from].x"
            [attr.y1]="nodes[edge.from].y - 0.6"
            [attr.x2]="nodes[edge.to].x"
            [attr.y2]="nodes[edge.to].y - 0.6"
            stroke="rgba(255,255,255,0.14)"
            [attr.stroke-width]="edge.diagonal ? 0.8 : 1"
            stroke-linecap="round"
          />
        }

        <!-- Smart hint move path -->
        @if (hintLineCoords(); as hLine) {
          <line
            [attr.x1]="hLine.x1"
            [attr.y1]="hLine.y1"
            [attr.x2]="hLine.x2"
            [attr.y2]="hLine.y2"
            stroke="#38BDF8"
            stroke-width="5"
            stroke-dasharray="7 4"
            stroke-linecap="round"
          />
        }

        <!-- Highlighted travel paths from selected piece to valid adjacent destinations -->
        @for (path of selectedTravelPaths(); track $index) {
          <line
            [attr.x1]="path.x1"
            [attr.y1]="path.y1"
            [attr.x2]="path.x2"
            [attr.y2]="path.y2"
            stroke="#14B8A6"
            stroke-width="4.8"
            stroke-linecap="round"
            opacity="0.88"
          />
        }

        <!-- Active mill golden highlight line with ambient aura -->
        @if (millLineCoords(); as line) {
          <line
            [attr.x1]="line.x1"
            [attr.y1]="line.y1"
            [attr.x2]="line.x2"
            [attr.y2]="line.y2"
            stroke="#F59E0B"
            stroke-width="13"
            stroke-linecap="round"
            opacity="0.28"
          />
          <line
            [attr.x1]="line.x1"
            [attr.y1]="line.y1"
            [attr.x2]="line.x2"
            [attr.y2]="line.y2"
            stroke="#FBBF24"
            stroke-width="6.5"
            stroke-linecap="round"
            opacity="0.95"
            class="animate-win-line"
          />
        }

        <!-- 24 Interactive Intersections -->
        @for (node of nodes; track node.id) {
          @let owner = state().board[node.id];
          @let isSelected = state().selectedNode === node.id;
          @let isDestination = validDestinations().has(node.id);
          @let isMovable = movableNodes().has(node.id);
          @let isRemovable = removableNodes().has(node.id);
          @let isMillNode = millNodeSet().has(node.id);
          @let isHintNode = hintNodeSet().has(node.id);
          @let isBlockedOwn = isBlockedCurrentPlayerPiece(node.id);
          @let isClickable = isNodeInteractive(node.id);

          <g
            role="button"
            [attr.tabindex]="isClickable ? 0 : -1"
            [attr.aria-label]="getNodeAriaLabel(node.id)"
            [attr.aria-disabled]="!isClickable"
            (click)="onNodeClick(node.id)"
            (keydown.enter)="onNodeClick(node.id)"
            (keydown.space)="$event.preventDefault(); onNodeClick(node.id)"
            [class.cursor-pointer]="isClickable"
            [class.cursor-default]="!isClickable"
            class="group outline-none focus-visible:opacity-100"
          >
            <!-- Generous invisible touch target (44px diameter in 400x400 viewBox) -->
            <circle
              [attr.cx]="node.x"
              [attr.cy]="node.y"
              r="22"
              fill="transparent"
            />

            <!-- Precision-turned recessed socket collar (always visible under pieces too) -->
            <circle
              [attr.cx]="node.x"
              [attr.cy]="node.y + 0.9"
              r="11.2"
              fill="rgba(0,0,0,0.34)"
            />
            <circle
              [attr.cx]="node.x"
              [attr.cy]="node.y"
              [attr.r]="isClickable && state().action === 'PLACE' ? 11.2 : 10"
              [attr.fill]="'url(#' + uid('brassRim') + ')'"
              class="transition-all duration-150"
            />
            <circle
              [attr.cx]="node.x"
              [attr.cy]="node.y"
              [attr.r]="isClickable && state().action === 'PLACE' ? 8.2 : 7"
              [attr.fill]="'url(#' + uid('socketBowl') + ')'"
            />

            <!-- Empty-state interactive indicators -->
            @if (owner === null) {
              @if (isHintNode) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="16"
                  fill="rgba(56, 189, 248, 0.24)"
                  stroke="#0EA5E9"
                  stroke-width="2.75"
                  stroke-dasharray="5 3"
                />
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="5.5"
                  fill="#38BDF8"
                />
              } @else if (isDestination) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="15"
                  fill="rgba(20, 184, 166, 0.26)"
                  stroke="#14B8A6"
                  stroke-width="2.75"
                />
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="5.5"
                  fill="#2DD4BF"
                />
              } @else if (isClickable && state().action === 'PLACE') {
                <!-- Hover highlight ring on valid placement sockets -->
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="13.5"
                  fill="none"
                  stroke="#2DD4BF"
                  stroke-width="2"
                  class="opacity-0 transition-opacity duration-150 group-hover:opacity-80"
                />
              }
            } @else {
              <!-- Hint, Selected, Movable, or Removable outer halo -->
              @if (isHintNode) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="22"
                  fill="rgba(56, 189, 248, 0.2)"
                  stroke="#38BDF8"
                  stroke-width="3"
                />
              } @else if (isSelected) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="22"
                  fill="rgba(245, 158, 11, 0.22)"
                  stroke="#F59E0B"
                  stroke-width="3"
                />
              } @else if (isRemovable && !disabled()) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="22"
                  fill="rgba(245, 158, 11, 0.16)"
                  stroke="#F59E0B"
                  stroke-width="2.6"
                  stroke-dasharray="5 3"
                />
              } @else if (isMovable && !disabled()) {
                <!-- Calm hover-only indicator so board remains uncluttered like a real tabletop -->
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="20.5"
                  fill="none"
                  [attr.stroke]="isLightNeutral() ? '#334155' : '#E2E8F0'"
                  stroke-width="2"
                  class="opacity-0 transition-opacity duration-150 group-hover:opacity-75"
                />
              } @else if (isMillNode) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="20.5"
                  fill="none"
                  stroke="#F59E0B"
                  stroke-width="2.2"
                  opacity="0.92"
                />
              }

              <!-- Sculpted Piece Body (3D upright extrusion + directional cast shadow in tabletop mode) -->
              <g
                [attr.opacity]="isBlockedOwn ? 0.58 : 1"
                [attr.transform]="isSelected ? 'translate(0, -4) scale(1.06)' : null"
                style="transform-box: fill-box; transform-origin: center;"
              >
                <svg
                  appPieceSvg
                  [threeD]="tabletop()"
                  [attr.x]="tabletop() ? node.x - 21 : node.x - 19"
                  [attr.y]="tabletop() ? node.y - 24 : node.y - 19"
                  [attr.width]="tabletop() ? 42 : 38"
                  [attr.height]="tabletop() ? 44 : 38"
                  [player]="owner"
                  [style]="pieceStyle()"
                  [customColor]="owner === 'X' ? customXColor() : customOColor()"
                ></svg>
              </g>
            }
          </g>
        }
      </svg>
    </div>
  `,
})
export class MorrisBoard {
  private readonly instanceUid = nextMorrisBoardUid++;
  readonly i18n = inject(I18n);
  readonly state = input.required<MorrisState>();
  readonly disabled = input<boolean>(false);
  readonly hintDecision = input<MorrisAiDecision | null>(null);
  readonly theme = input<BoardTheme>('navy');
  readonly tabletop = input(false);
  readonly pieceStyle = input<PieceStyle>('gemstone');
  readonly colorMode = input<ColorMode>('dark');
  readonly customXColor = input<string | null>(null);
  readonly customOColor = input<string | null>(null);
  readonly customBoardColor = input<string | null>(null);
  readonly expanded = input<boolean>(false);
  readonly nodeSelected = output<number>();

  readonly nodes: readonly MorrisNodeCoord[] = MORRIS_NODES;
  readonly cornerRivets = [
    { x: 18, y: 18 },
    { x: 382, y: 18 },
    { x: 382, y: 382 },
    { x: 18, y: 382 },
  ] as const;

  readonly isLightNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'light',
  );

  readonly boardTokens = computed<BoardColorTokens>(() =>
    resolveBoardColorTokens(this.theme(), this.colorMode(), this.customBoardColor()),
  );

  readonly trackStroke = computed<string>(() => this.boardTokens().trackStroke);
  readonly diagonalStroke = computed<string>(() => this.boardTokens().diagonalStroke);
  readonly socketFill = computed<string>(() => this.boardTokens().socketFill);
  readonly socketStroke = computed<string>(() => this.boardTokens().socketStroke);

  readonly grooveShadow = computed<string>(() =>
    this.isLightNeutral() && !this.customBoardColor()
      ? 'rgba(15, 23, 42, 0.2)'
      : 'rgba(0, 0, 0, 0.48)',
  );

  readonly rimHighlight = computed<string>(() =>
    this.theme() === 'walnut' || this.theme() === 'felt'
      ? '#FDE68A'
      : this.theme() === 'tile'
        ? '#A5F3FC'
        : 'rgba(255,255,255,0.72)',
  );

  readonly rimShadow = computed<string>(() =>
    this.theme() === 'walnut' || this.theme() === 'felt'
      ? '#6B421A'
      : this.theme() === 'tile'
        ? '#164E63'
        : 'rgba(15,23,42,0.58)',
  );

  uid(suffix: string): string {
    return `mb-${this.instanceUid}-${suffix}`;
  }

  readonly edges = computed<readonly MorrisEdge[]>(() => getMorrisEdges(this.state().variant));

  readonly movableNodes = computed<Set<number>>(() => {
    const s = this.state();
    if (this.disabled() || s.winner || s.isDraw || s.action !== 'MOVE') {
      return new Set<number>();
    }
    const movable = new Set<number>();
    for (let i = 0; i < 24; i++) {
      if (s.board[i] === s.currentTurn && getValidDestinationsForNode(s, i).length > 0) {
        movable.add(i);
      }
    }
    return movable;
  });

  readonly validDestinations = computed<Set<number>>(() => {
    const s = this.state();
    if (this.disabled() || s.action !== 'MOVE' || s.selectedNode === null) {
      return new Set<number>();
    }
    return new Set(getValidDestinationsForNode(s, s.selectedNode));
  });

  readonly selectedTravelPaths = computed<
    readonly { x1: number; y1: number; x2: number; y2: number }[]
  >(() => {
    const s = this.state();
    if (
      this.disabled() ||
      s.action !== 'MOVE' ||
      s.selectedNode === null ||
      canPlayerFly(s, s.currentTurn)
    ) {
      return [];
    }
    const fromCoord = this.nodes[s.selectedNode];
    const dests = getValidDestinationsForNode(s, s.selectedNode);
    return dests.map((destId) => {
      const toCoord = this.nodes[destId];
      return { x1: fromCoord.x, y1: fromCoord.y, x2: toCoord.x, y2: toCoord.y };
    });
  });

  readonly hintNodeSet = computed<Set<number>>(() => {
    const hint = this.hintDecision();
    if (!hint || this.disabled()) return new Set<number>();
    if (hint.type === 'PLACE') return new Set<number>([hint.to]);
    if (hint.type === 'REMOVE') return new Set<number>([hint.target]);
    return new Set<number>([hint.from, hint.to]);
  });

  readonly hintLineCoords = computed<{ x1: number; y1: number; x2: number; y2: number } | null>(
    () => {
      const hint = this.hintDecision();
      if (!hint || this.disabled() || hint.type !== 'MOVE') return null;
      const fromCoord = this.nodes[hint.from];
      const toCoord = this.nodes[hint.to];
      return { x1: fromCoord.x, y1: fromCoord.y, x2: toCoord.x, y2: toCoord.y };
    },
  );

  readonly removableNodes = computed<Set<number>>(() => {
    const s = this.state();
    if (this.disabled() || s.action !== 'REMOVE') {
      return new Set<number>();
    }
    const opponent = s.currentTurn === 'X' ? 'O' : 'X';
    return new Set(getRemovableOpponentNodes(s.board, opponent, s.variant));
  });

  readonly millNodeSet = computed<Set<number>>(() => {
    const mill: MorrisMill | null = this.state().lastMill;
    return mill ? new Set<number>(mill) : new Set<number>();
  });

  readonly millLineCoords = computed<{ x1: number; y1: number; x2: number; y2: number } | null>(
    () => {
      const mill = this.state().lastMill;
      if (!mill) return null;
      const first = this.nodes[mill[0]];
      const last = this.nodes[mill[2]];
      return { x1: first.x, y1: first.y, x2: last.x, y2: last.y };
    },
  );

  readonly boardAriaLabel = computed<string>(() => {
    return this.state().variant === 'TWELVE'
      ? this.i18n.text("صفحه بازی دوز ۱۲ تایی با ۲۴ خانه و خطوط مورب")
      : this.i18n.text("صفحه بازی دوز ۹ تایی با ۲۴ خانه");
  });

  isBlockedCurrentPlayerPiece(nodeId: number): boolean {
    if (this.disabled()) return false;
    const s = this.state();
    return (
      !s.winner &&
      !s.isDraw &&
      s.action === 'MOVE' &&
      s.board[nodeId] === s.currentTurn &&
      !this.movableNodes().has(nodeId)
    );
  }

  isNodeInteractive(nodeId: number): boolean {
    if (this.disabled()) return false;
    const s = this.state();
    if (s.winner || s.isDraw) return false;

    const owner = s.board[nodeId];
    if (s.action === 'PLACE') {
      return owner === null;
    }
    if (s.action === 'REMOVE') {
      return this.removableNodes().has(nodeId);
    }
    if (s.action === 'MOVE') {
      return this.movableNodes().has(nodeId) || this.validDestinations().has(nodeId);
    }
    return false;
  }

  onNodeClick(nodeId: number): void {
    if (!this.isNodeInteractive(nodeId)) return;
    this.nodeSelected.emit(nodeId);
  }

  getNodeAriaLabel(nodeId: number): string {
    const s = this.state();
    const owner = s.board[nodeId];
    const num = this.i18n.digits(nodeId + 1);
    if (owner === null) {
      if (this.validDestinations().has(nodeId)) {
        return this.i18n.text("خانه {0}، مقصد مجاز حرکت", [num]);
      }
      return this.i18n.text("خانه {0}، خالی", [num]);
    }
    const pieceLabel = owner === 'X' ? this.i18n.text("مهره X") : this.i18n.text("مهره O");
    if (this.removableNodes().has(nodeId)) {
      return this.i18n.text("خانه {0}، {1}، قابل حذف", [num, pieceLabel]);
    }
    if (s.selectedNode === nodeId) {
      return this.i18n.text("خانه {0}، {1}، انتخاب شده", [num, pieceLabel]);
    }
    if (this.movableNodes().has(nodeId)) {
      return this.i18n.text("خانه {0}، {1}، قابل حرکت", [num, pieceLabel]);
    }
    if (this.isBlockedCurrentPlayerPiece(nodeId)) {
      return this.i18n.text("خانه {0}، {1}، مسدود", [num, pieceLabel]);
    }
    return this.i18n.text("خانه {0}، {1}", [num, pieceLabel]);
  }
}
