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
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  type CellPos,
  type HitTarget,
  pointerToCell,
  cornersToRect,
  blockAtCell,
  resolveCursor,
  resolveBlockBg,
  resolveBlockClasses,
  resolveGhostStyle,
} from "#utils/helpers/gridCanvas.helper";

type Props = {
  cols: number;
  rows: number;
  blocks: BlocksMap;
  handles: ResizeHandleAxis[];
  onClick: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onLayoutChange?: (layout: Layout) => void;
  onDrawComplete?: (x: number, y: number, w: number, h: number) => void;
  onSelectionBox?: (x: number, y: number, w: number, h: number) => void;
  onGroupMovePreview?: (dx: number, dy: number) => void;
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

  const lastDelta = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const hitRef = useRef<HitTarget>("empty");
  const clickedId = useRef<string | null>(null);
  const isDraggingGroup = useRef(false);
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const rowHeight = width / cols;
  const cellSize = rowHeight;

  const toCell = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) =>
      pointerToCell(e, cellSize, cols, rows),
    [cellSize, cols, rows],
  );

  // ── Pointer handlers ─────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawMode && !selectMode) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cell = toCell(e);

    if (drawMode) {
      hitRef.current = "empty";
      setDragStart(cell);
      setDragCurrent(cell);
      return;
    }

    const hitId = blockAtCell(cell.col, cell.row, blocksRef.current);
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
    const cell = toCell(e);

    if (drawMode) {
      if (dragStart) setDragCurrent(cell);
      return;
    }

    if (hitRef.current === "selected-block" && moveOrigin) {
      const dx = cell.col - moveOrigin.col;
      const dy = cell.row - moveOrigin.row;
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
    const cell = toCell(e);

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
      if (isDraggingGroup.current) onGroupMoveCommit?.();
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
        onSelectionBox?.(cell.col, cell.row, 0, 0);
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

  // ── Render ────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ cursor: resolveCursor(drawMode, selectMode, !!moveOrigin) }}
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
              const isMoving = selectMode && isSelected && !!moveOrigin;

              return (
                <div
                  key={item.i}
                  className={resolveBlockClasses(
                    isSelected,
                    isMoving,
                    item.static ?? false,
                  )}
                  style={{
                    background: resolveBlockBg(
                      block.border,
                      block.bg,
                      isDivider,
                      isMoving,
                      isSelected,
                      isHovered,
                    ),
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

          {ghostRect && (
            <div
              className="absolute pointer-events-none rounded-sm border-2 border-dashed"
              style={resolveGhostStyle(ghostRect, cellSize, selectMode)}
            />
          )}
        </>
      )}
    </div>
  );
}
