import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BoardColorTokens, resolveBoardColorTokens } from './color-palette';
import { BoardTheme, ColorMode, PieceStyle } from './dooz.types';
import { toPersianDigits } from './dooz-engine';
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

@Component({
  selector: 'app-morris-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DoozPieceSvg],
  template: `
    <div
      class="relative mx-auto w-full rounded-2xl border p-3 shadow-md transition-all duration-200 sm:p-4"
      [class.max-w-[440px]]="!expanded()"
      [class.max-w-[min(68dvh,620px)]]="expanded()"
      [class.backdrop-blur-md]="theme() === 'glass'"
      [class.shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_10px_30px_rgba(0,0,0,0.28)]]="theme() === 'glass'"
      [style.background-color]="boardTokens().frameBg"
      [style.border-color]="boardTokens().borderColor"
    >
      <!-- Subtle luxury inlaid inner border line -->
      <div
        class="pointer-events-none absolute inset-2 rounded-xl border border-white/10"
        aria-hidden="true"
      ></div>
      <svg
        viewBox="0 0 400 400"
        role="group"
        [attr.aria-label]="boardAriaLabel()"
        class="relative block aspect-square w-full select-none"
      >

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
                <svg
                  appPieceSvg
                  [attr.x]="node.x - 19"
                  [attr.y]="node.y - 19"
                  width="38"
                  height="38"
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
  readonly state = input.required<MorrisState>();
  readonly disabled = input<boolean>(false);
  readonly hintDecision = input<MorrisAiDecision | null>(null);
  readonly theme = input<BoardTheme>('navy');
  readonly pieceStyle = input<PieceStyle>('gemstone');
  readonly colorMode = input<ColorMode>('dark');
  readonly customXColor = input<string | null>(null);
  readonly customOColor = input<string | null>(null);
  readonly customBoardColor = input<string | null>(null);
  readonly expanded = input<boolean>(false);
  readonly nodeSelected = output<number>();

  readonly nodes: readonly MorrisNodeCoord[] = MORRIS_NODES;

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
