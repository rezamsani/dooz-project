import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BoardTheme, ColorMode, PieceStyle } from './dooz.types';
import { toPersianDigits } from './dooz-engine';
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
  template: `
    <div
      class="relative mx-auto w-full rounded-2xl border p-3 shadow-md transition-all duration-200 sm:p-4"
      [class.max-w-[440px]]="!expanded()"
      [class.max-w-[min(68dvh,620px)]]="expanded()"
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
      <svg
        viewBox="0 0 400 400"
        role="group"
        [attr.aria-label]="boardAriaLabel()"
        class="block aspect-square w-full select-none"
      >
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

        <!-- Board tracks / lines -->
        @for (edge of edges(); track $index) {
          <line
            [attr.x1]="nodes[edge.from].x"
            [attr.y1]="nodes[edge.from].y"
            [attr.x2]="nodes[edge.to].x"
            [attr.y2]="nodes[edge.to].y"
            [attr.stroke]="edge.diagonal ? diagonalStroke() : trackStroke()"
            [attr.stroke-width]="edge.diagonal ? 3 : 3.5"
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
            stroke-width="4.5"
            stroke-linecap="round"
            opacity="0.8"
          />
        }

        <!-- Active mill golden highlight line -->
        @if (millLineCoords(); as line) {
          <line
            [attr.x1]="line.x1"
            [attr.y1]="line.y1"
            [attr.x2]="line.x2"
            [attr.y2]="line.y2"
            stroke="#F59E0B"
            stroke-width="7"
            stroke-linecap="round"
            opacity="0.88"
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
            class="outline-none focus-visible:opacity-100"
          >
            <!-- Generous invisible touch target (44px diameter in 400x400 viewBox) -->
            <circle
              [attr.cx]="node.x"
              [attr.cy]="node.y"
              r="22"
              fill="transparent"
            />

            <!-- Base socket dot -->
            @if (owner === null) {
              @if (isHintNode) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="15.5"
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
                  r="14.5"
                  fill="rgba(20, 184, 166, 0.24)"
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
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="8"
                  [attr.fill]="socketFill()"
                  [attr.stroke]="socketStroke()"
                  stroke-width="2"
                  class="transition-all duration-150 hover:stroke-teal-400"
                />
              } @else {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="6"
                  [attr.fill]="socketFill()"
                  [attr.stroke]="trackStroke()"
                  stroke-width="1.75"
                />
              }
            } @else {
              <!-- Hint, Selected, Movable, or Removable outer halo -->
              @if (isHintNode) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="21.5"
                  fill="rgba(56, 189, 248, 0.2)"
                  stroke="#38BDF8"
                  stroke-width="3"
                />
              } @else if (isSelected) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="21.5"
                  fill="rgba(245, 158, 11, 0.2)"
                  stroke="#F59E0B"
                  stroke-width="3"
                />
              } @else if (isRemovable && !disabled()) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="21.5"
                  fill="rgba(245, 158, 11, 0.16)"
                  stroke="#F59E0B"
                  stroke-width="2.6"
                  stroke-dasharray="5 3"
                />
              } @else if (isMovable && !disabled()) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="20.5"
                  [attr.fill]="isLightNeutral() ? 'rgba(15, 23, 42, 0.08)' : 'rgba(248, 250, 252, 0.1)'"
                  [attr.stroke]="isLightNeutral() ? '#334155' : '#E2E8F0'"
                  stroke-width="2"
                  stroke-dasharray="4 3"
                  opacity="0.88"
                />
              } @else if (isMillNode) {
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y"
                  r="20"
                  fill="none"
                  stroke="#F59E0B"
                  stroke-width="2.2"
                  opacity="0.9"
                />
              }

              <!-- Sculpted Piece Body -->
              <g [attr.opacity]="isBlockedOwn ? 0.58 : 1">
                <!-- Soft token drop shadow -->
                <circle
                  [attr.cx]="node.x"
                  [attr.cy]="node.y + 2"
                  r="15.5"
                  fill="rgba(0, 0, 0, 0.24)"
                />

                @if (owner === 'X') {
                  @switch (pieceStyle()) {
                    @case ('gemstone') {
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="16"
                        [attr.fill]="'url(#' + gradId('ruby') + ')'"
                        stroke="#FDE68A"
                        stroke-width="2.2"
                      />
                      <circle
                        [attr.cx]="node.x - 4.5"
                        [attr.cy]="node.y - 5"
                        r="3"
                        fill="rgba(255,255,255,0.38)"
                      />
                      <line
                        [attr.x1]="node.x - 5.2"
                        [attr.y1]="node.y - 5.2"
                        [attr.x2]="node.x + 5.2"
                        [attr.y2]="node.y + 5.2"
                        stroke="#FFFDF7"
                        stroke-width="2.8"
                        stroke-linecap="round"
                      />
                      <line
                        [attr.x1]="node.x + 5.2"
                        [attr.y1]="node.y - 5.2"
                        [attr.x2]="node.x - 5.2"
                        [attr.y2]="node.y + 5.2"
                        stroke="#FFFDF7"
                        stroke-width="2.8"
                        stroke-linecap="round"
                      />
                    }
                    @case ('wood') {
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="16"
                        [attr.fill]="'url(#' + gradId('mahogany') + ')'"
                        stroke="#F59E0B"
                        stroke-width="2.2"
                      />
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="11.5"
                        fill="none"
                        stroke="rgba(253,230,138,0.45)"
                        stroke-width="1.2"
                        stroke-dasharray="3 2"
                      />
                      <line
                        [attr.x1]="node.x - 5"
                        [attr.y1]="node.y - 5"
                        [attr.x2]="node.x + 5"
                        [attr.y2]="node.y + 5"
                        stroke="#FEF3C7"
                        stroke-width="2.8"
                        stroke-linecap="round"
                      />
                      <line
                        [attr.x1]="node.x + 5"
                        [attr.y1]="node.y - 5"
                        [attr.x2]="node.x - 5"
                        [attr.y2]="node.y + 5"
                        stroke="#FEF3C7"
                        stroke-width="2.8"
                        stroke-linecap="round"
                      />
                    }
                    @case ('nature') {
                      <circle [attr.cx]="node.x" [attr.cy]="node.y - 7" r="8.5" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFE4E6" stroke-width="1.2" />
                      <circle [attr.cx]="node.x + 7" [attr.cy]="node.y" r="8.5" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFE4E6" stroke-width="1.2" />
                      <circle [attr.cx]="node.x" [attr.cy]="node.y + 7" r="8.5" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFE4E6" stroke-width="1.2" />
                      <circle [attr.cx]="node.x - 7" [attr.cy]="node.y" r="8.5" [attr.fill]="'url(#' + gradId('coral') + ')'" stroke="#FFE4E6" stroke-width="1.2" />
                      <circle [attr.cx]="node.x" [attr.cy]="node.y" r="6.5" fill="#F59E0B" stroke="#FEF3C7" stroke-width="1.5" />
                    }
                    @default {
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="15.5"
                        fill="#E11D48"
                        stroke="#FDA4AF"
                        stroke-width="2.2"
                      />
                      <line
                        [attr.x1]="node.x - 5.5"
                        [attr.y1]="node.y - 5.5"
                        [attr.x2]="node.x + 5.5"
                        [attr.y2]="node.y + 5.5"
                        stroke="#FFF1F2"
                        stroke-width="2.6"
                        stroke-linecap="round"
                      />
                      <line
                        [attr.x1]="node.x + 5.5"
                        [attr.y1]="node.y - 5.5"
                        [attr.x2]="node.x - 5.5"
                        [attr.y2]="node.y + 5.5"
                        stroke="#FFF1F2"
                        stroke-width="2.6"
                        stroke-linecap="round"
                      />
                    }
                  }
                } @else {
                  @switch (pieceStyle()) {
                    @case ('gemstone') {
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="16"
                        [attr.fill]="'url(#' + gradId('turq') + ')'"
                        stroke="#FDE68A"
                        stroke-width="2.2"
                      />
                      <circle
                        [attr.cx]="node.x - 4.5"
                        [attr.cy]="node.y - 5"
                        r="3"
                        fill="rgba(255,255,255,0.4)"
                      />
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="6"
                        fill="none"
                        stroke="#F0FDFA"
                        stroke-width="2.7"
                      />
                    }
                    @case ('wood') {
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="16"
                        [attr.fill]="'url(#' + gradId('ivory') + ')'"
                        stroke="#92400E"
                        stroke-width="2.2"
                      />
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="11.5"
                        fill="none"
                        stroke="#B45309"
                        stroke-width="1.1"
                        stroke-dasharray="3 2"
                      />
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="6"
                        fill="none"
                        stroke="#78350F"
                        stroke-width="2.7"
                      />
                    }
                    @case ('nature') {
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="16"
                        [attr.fill]="'url(#' + gradId('jade') + ')'"
                        stroke="#D1FAE5"
                        stroke-width="2.2"
                      />
                      <circle
                        [attr.cx]="node.x - 4.5"
                        [attr.cy]="node.y - 5"
                        r="3"
                        fill="rgba(255,255,255,0.36)"
                      />
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="6.2"
                        fill="none"
                        stroke="#ECFDF5"
                        stroke-width="2.5"
                      />
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="2"
                        fill="#A7F3D0"
                      />
                    }
                    @default {
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="15.5"
                        fill="#0D9488"
                        stroke="#99F6E4"
                        stroke-width="2.2"
                      />
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        r="6"
                        fill="none"
                        stroke="#F0FDFA"
                        stroke-width="2.6"
                      />
                    }
                  }
                }
              </g>
            }
          </g>
        }
      </svg>
    </div>
  `,
})
export class MorrisBoard {
  private readonly uid = `mb${nextMorrisBoardUid++}`;

  readonly state = input.required<MorrisState>();
  readonly disabled = input<boolean>(false);
  readonly hintDecision = input<MorrisAiDecision | null>(null);
  readonly theme = input<BoardTheme>('navy');
  readonly pieceStyle = input<PieceStyle>('gemstone');
  readonly colorMode = input<ColorMode>('dark');
  readonly expanded = input<boolean>(false);
  readonly nodeSelected = output<number>();

  readonly nodes: readonly MorrisNodeCoord[] = MORRIS_NODES;

  readonly isLightNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'light',
  );

  readonly isDarkNeutral = computed<boolean>(
    () => this.theme() === 'navy' && this.colorMode() === 'dark',
  );

  gradId(name: string): string {
    return `${this.uid}-${name}`;
  }

  readonly trackStroke = computed<string>(() => {
    switch (this.theme()) {
      case 'walnut':
        return '#855A47';
      case 'felt':
        return '#338060';
      case 'tile':
        return '#2D7E94';
      default:
        return this.colorMode() === 'light' ? '#94A3B8' : '#314966';
    }
  });

  readonly diagonalStroke = computed<string>(() => {
    switch (this.theme()) {
      case 'walnut':
        return '#A0705A';
      case 'felt':
        return '#419B77';
      case 'tile':
        return '#3A9CB6';
      default:
        return this.colorMode() === 'light' ? '#94A3B8' : '#3B5676';
    }
  });

  readonly socketFill = computed<string>(() => {
    switch (this.theme()) {
      case 'walnut':
        return '#472C21';
      case 'felt':
        return '#174D37';
      case 'tile':
        return '#154F61';
      default:
        return this.colorMode() === 'light' ? '#FFFFFF' : '#1C314A';
    }
  });

  readonly socketStroke = computed<string>(() => {
    switch (this.theme()) {
      case 'walnut':
        return '#B9876E';
      case 'felt':
        return '#57B690';
      case 'tile':
        return '#52C2DF';
      default:
        return this.colorMode() === 'light' ? '#64748B' : '#4E6D91';
    }
  });

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
      ? 'صفحه بازی دوز ۱۲ تایی با ۲۴ خانه و خطوط مورب'
      : 'صفحه بازی دوز ۹ تایی با ۲۴ خانه';
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
    const num = toPersianDigits(nodeId + 1);
    if (owner === null) {
      if (this.validDestinations().has(nodeId)) {
        return `خانه ${num}، مقصد مجاز حرکت`;
      }
      return `خانه ${num}، خالی`;
    }
    const pieceLabel = owner === 'X' ? 'مهره X' : 'مهره O';
    if (this.removableNodes().has(nodeId)) {
      return `خانه ${num}، ${pieceLabel}، قابل حذف`;
    }
    if (s.selectedNode === nodeId) {
      return `خانه ${num}، ${pieceLabel}، انتخاب شده`;
    }
    if (this.movableNodes().has(nodeId)) {
      return `خانه ${num}، ${pieceLabel}، قابل حرکت`;
    }
    if (this.isBlockedCurrentPlayerPiece(nodeId)) {
      return `خانه ${num}، ${pieceLabel}، مسدود`;
    }
    return `خانه ${num}، ${pieceLabel}`;
  }
}
