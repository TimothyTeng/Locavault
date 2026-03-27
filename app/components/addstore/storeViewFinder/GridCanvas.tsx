import {
  useContainerWidth,
  useResponsiveLayout,
  ReactGridLayout,
  getCompactor,
  type LayoutItem,
  type ResizeHandleAxis,
  type Layout,
} from "react-grid-layout";
import { GridBackground } from "react-grid-layout/extras";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { BlocksMap } from "#types/storeViewFinderTypes";
import type { BlockKind } from "#types/BlockTypes";
import { useMemo, useState, useCallback, useRef } from "react";

type CellPos = { col: number; row: number };
type HitTarget = "empty" | "selected-block" | "unselected-block";

type Props = {
  cols: number;
  rows: number;
  blocks: BlocksMap;
  handles: ResizeHandleAxis[];
  onClick: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onLayoutChange?: (layout: Layout) => void;
  onDrawComplete?: (x: number, y: number, w: number, h: number) => void;
  /** Rubber-band complete — w/h = 0 signals "clear selection" */
  onSelectionBox?: (x: number, y: number, w: number, h: number) => void;
  /** Fires on every cell-delta change during drag — parent updates blocks live */
  onGroupMovePreview?: (dx: number, dy: number) => void;
  /** Fires on pointer-up — parent commits the final position */
  onGroupMoveCommit?: () => void;
  selectedId?: string | null;
  selectedIds?: Set<string>;
  readOnly?: boolean;
  drawMode?: boolean;
  selectMode?: boolean;
  nonClickableKinds?: BlockKind[];
};

export function GridCanvas({
  cols,
  rows,
  blocks = {},
  handles,
  onClick,
  onLayoutChange,
  onDrawComplete,
  onSelectionBox,
  onGroupMovePreview,
  onGroupMoveCommit,
  selectedId,
  selectedIds = new Set(),
  readOnly = false,
  drawMode = false,
  selectMode = false,
  nonClickableKinds = [],
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<CellPos | null>(null);
  const [dragCurrent, setDragCurrent] = useState<CellPos | null>(null);
  const [moveOrigin, setMoveOrigin] = useState<CellPos | null>(null);
  // Track last applied delta so we only fire onGroupMovePreview when the cell actually changes
  const lastDelta = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const hitRef = useRef<HitTarget>("empty");
  const clickedId = useRef<string | null>(null);
  const isDraggingGroup = useRef(false);

  const rowHeight = width / cols;
  const cellSize = rowHeight;

  const pointerToCell = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): CellPos => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        col: Math.max(
          0,
          Math.min(Math.floor((e.clientX - rect.left) / cellSize), cols - 1),
        ),
        row: Math.max(
          0,
          Math.min(Math.floor((e.clientY - rect.top) / cellSize), rows - 1),
        ),
      };
    },
    [cellSize, cols, rows],
  );

  const cornersToRect = (a: CellPos, b: CellPos) => ({
    x: Math.min(a.col, b.col),
    y: Math.min(a.row, b.row),
    w: Math.abs(a.col - b.col) + 1,
    h: Math.abs(a.row - b.row) + 1,
  });

  const blockAtCell = useCallback(
    (col: number, row: number): string | null => {
      for (const [id, b] of Object.entries(blocks)) {
        if (col >= b.x && col < b.x + b.w && row >= b.y && row < b.y + b.h)
          return id;
      }
      return null;
    },
    [blocks],
  );

  // ── Pointer handlers ─────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawMode && !selectMode) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cell = pointerToCell(e);

    if (drawMode) {
      hitRef.current = "empty";
      setDragStart(cell);
      setDragCurrent(cell);
      return;
    }

    const hitId = blockAtCell(cell.col, cell.row);
    if (hitId && selectedIds.has(hitId)) {
      hitRef.current = "selected-block";
      clickedId.current = hitId;
      isDraggingGroup.current = false;
      lastDelta.current = { dx: 0, dy: 0 };
      setMoveOrigin(cell);
    } else if (hitId) {
      hitRef.current = "unselected-block";
      clickedId.current = hitId;
    } else {
      hitRef.current = "empty";
      setDragStart(cell);
      setDragCurrent(cell);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawMode && !selectMode) return;
    const cell = pointerToCell(e);

    if (drawMode) {
      if (dragStart) setDragCurrent(cell);
      return;
    }

    if (hitRef.current === "selected-block" && moveOrigin) {
      const dx = cell.col - moveOrigin.col;
      const dy = cell.row - moveOrigin.row;
      // Only fire when the cell delta actually changes — avoids redundant re-renders
      if (dx !== lastDelta.current.dx || dy !== lastDelta.current.dy) {
        lastDelta.current = { dx, dy };
        isDraggingGroup.current = true;
        onGroupMovePreview?.(dx, dy);
      }
    } else if (hitRef.current === "empty" && dragStart) {
      setDragCurrent(cell);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawMode && !selectMode) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const cell = pointerToCell(e);

    if (drawMode) {
      if (dragStart) {
        const rect = cornersToRect(dragStart, cell);
        onDrawComplete?.(rect.x, rect.y, rect.w, rect.h);
      }
      setDragStart(null);
      setDragCurrent(null);
      hitRef.current = "empty";
      return;
    }

    if (hitRef.current === "selected-block") {
      if (isDraggingGroup.current) {
        // Commit — blocks are already in final position from preview updates
        onGroupMoveCommit?.();
      }
      // If no drag occurred (pure click on selected block) keep selection as-is
      setMoveOrigin(null);
      isDraggingGroup.current = false;
      lastDelta.current = { dx: 0, dy: 0 };
    } else if (hitRef.current === "unselected-block" && clickedId.current) {
      onClick(
        e as unknown as React.MouseEvent<HTMLDivElement>,
        clickedId.current,
      );
    } else if (hitRef.current === "empty" && dragStart) {
      const isTap = dragStart.col === cell.col && dragStart.row === cell.row;
      if (isTap) {
        onSelectionBox?.(cell.col, cell.row, 0, 0); // clear signal
      } else {
        const rect = cornersToRect(dragStart, cell);
        onSelectionBox?.(rect.x, rect.y, rect.w, rect.h);
      }
      setDragStart(null);
      setDragCurrent(null);
    }

    hitRef.current = "empty";
    clickedId.current = null;
  };

  const ghostRect =
    dragStart && dragCurrent ? cornersToRect(dragStart, dragCurrent) : null;

  // ── Layout ───────────────────────────────────────────────
  const layout = useMemo<LayoutItem[]>(
    () =>
      Object.entries(blocks).map(([id, b]) => ({
        i: id,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        minW: 1,
        minH: 1,
        static: readOnly || drawMode || selectMode,
      })),
    [blocks, readOnly, drawMode, selectMode],
  );

  const { layout: responsiveLayout } = useResponsiveLayout({
    width,
    breakpoints: { lg: 0 },
    cols: { lg: cols },
    layouts: { lg: layout },
  });

  const activeCursor = drawMode
    ? "crosshair"
    : selectMode
      ? moveOrigin
        ? "grabbing"
        : "default"
      : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ cursor: activeCursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {mounted && width > 0 && (
        <>
          <GridBackground
            width={width}
            cols={cols}
            rowHeight={rowHeight}
            margin={[1, 1]}
            rows={rows}
            color="#e2e8f0"
            borderRadius={2}
          />

          <ReactGridLayout
            layout={responsiveLayout}
            width={width}
            compactor={getCompactor(null, false, true)}
            onLayoutChange={(newLayout) => onLayoutChange?.(newLayout)}
            resizeConfig={{
              enabled: !readOnly && !drawMode && !selectMode,
              handles,
            }}
            gridConfig={{ cols, rowHeight, maxRows: rows, margin: [1, 1] }}
            style={{
              height: rowHeight * rows,
              width: "100%",
              background: "transparent",
            }}
            className="sgf-grid"
          >
            {responsiveLayout.map((item) => {
              const block = blocks[item.i];
              if (!block) return null;

              const isDivider = block.kind === "divider";
              const isNonClick = nonClickableKinds.includes(block.kind);
              const isSelected = selectMode
                ? selectedIds.has(item.i)
                : item.i === selectedId;
              const isHovered =
                hoveredId === item.i && !selectMode && !drawMode;
              // Highlight moving blocks with slightly stronger tint
              const isMoving = selectMode && isSelected && !!moveOrigin;

              const bgColor = isDivider
                ? block.border
                : isMoving
                  ? `${block.border}77`
                  : isSelected
                    ? `${block.border}55`
                    : isHovered
                      ? `${block.border}33`
                      : block.bg;

              return (
                <div
                  key={item.i}
                  className={[
                    "sgf-block flex items-center justify-center overflow-hidden rounded-sm border",
                    isSelected
                      ? isMoving
                        ? "ring-2 ring-offset-1 ring-slate-500 shadow-lg"
                        : "ring-2 ring-offset-1 ring-slate-700 shadow-md"
                      : "",
                    item.static ? "sgf-block-static" : "",
                    // Smooth position transition when snapping between cells
                    isMoving ? "transition-none" : "transition-shadow",
                  ].join(" ")}
                  style={{
                    background: bgColor,
                    borderColor: block.border,
                    pointerEvents:
                      isNonClick || drawMode || selectMode ? "none" : undefined,
                    cursor: isNonClick ? "default" : undefined,
                  }}
                  onMouseEnter={
                    !isNonClick && !drawMode && !selectMode
                      ? () => setHoveredId(item.i)
                      : undefined
                  }
                  onMouseLeave={
                    !isNonClick && !drawMode && !selectMode
                      ? () => setHoveredId(null)
                      : undefined
                  }
                >
                  <span
                    className="text-center px-1 font-mono font-medium uppercase tracking-wide leading-tight break-words"
                    style={{
                      fontSize: "clamp(7px, 1.1vw, 11px)",
                      color: isDivider ? "#ffffff" : block.border,
                    }}
                  >
                    {block.label}
                  </span>
                </div>
              );
            })}
          </ReactGridLayout>

          {/* Ghost overlay — rubber-band or draw */}
          {ghostRect && (
            <div
              className="absolute pointer-events-none rounded-sm border-2 border-dashed"
              style={{
                left: ghostRect.x * cellSize + 1,
                top: ghostRect.y * cellSize + 1,
                width: ghostRect.w * cellSize - 2,
                height: ghostRect.h * cellSize - 2,
                background: selectMode
                  ? "rgba(71,85,105,0.06)"
                  : "rgba(30,41,59,0.08)",
                borderColor: selectMode ? "#94a3b8" : "#475569",
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
