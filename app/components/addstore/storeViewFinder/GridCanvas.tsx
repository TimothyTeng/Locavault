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
import { FixtureGraphic } from "#lib/fixtures";
import {
  type CellPos,
  type HitTarget,
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
  /** id, additive — add/remove a single block from selection */
  onShiftSelect?: (id: string, additive: boolean) => void;
  onLayoutChange?: (layout: Layout) => void;
  onDrawComplete?: (x: number, y: number, w: number, h: number) => void;
  /** w=0 h=0 = clear. additive=true = add to existing selection */
  onSelectionBox?: (
    x: number,
    y: number,
    w: number,
    h: number,
    additive?: boolean,
  ) => void;
  onGroupMovePreview?: (dx: number, dy: number) => void;
  onGroupMoveCommit?: () => void;
  selectedId?: string | null;
  selectedIds?: Set<string>;
  readOnly?: boolean;
  drawMode?: boolean;
  selectMode?: boolean;
  /** Apply touch-action:none directly on the canvas element so the parent
   *  scroll container doesn't steal touch gestures in draw/select mode,
   *  while still allowing scroll on the padding area around the canvas. */
  captureTouches?: boolean;
  nonClickableKinds?: BlockKind[];
  /** Per-block status badge (store view only) — turns the map into a dashboard.
   *  Keyed by block id; absent blocks show no badge. */
  blockBadges?: Record<string, { count: number; tone: "critical" | "attention" }>;
};

export function GridCanvas({
  cols,
  rows,
  blocks = {},
  handles,
  onClick,
  onShiftSelect,
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
  captureTouches = false,
  nonClickableKinds = [],
  blockBadges,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<CellPos | null>(null);
  const [dragCurrent, setDragCurrent] = useState<CellPos | null>(null);
  const [moveOrigin, setMoveOrigin] = useState<CellPos | null>(null);
  // Whether the rubber band is additive (shift held) or replacing
  const [rubberBandAdditive, setRubberBandAdditive] = useState(false);

  const lastDelta = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const hitRef = useRef<HitTarget>("empty");
  const clickedId = useRef<string | null>(null);
  const isDraggingGroup = useRef(false);
  const hasDraggedRef = useRef(false); // true once pointer moves ≥1 cell from down pos
  const blocksRef = useRef(blocks);
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const rowHeight = width / cols;
  const cellSize = rowHeight;

  // Works with both raw DOM PointerEvent and React synthetic PointerEvent
  const toCell = useCallback(
    (e: PointerEvent | React.PointerEvent<HTMLDivElement>): CellPos => {
      const el = containerRef.current as HTMLElement;
      const rect = el.getBoundingClientRect();
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
    [cellSize, cols, rows, containerRef],
  );

  // ── Pointer handlers (raw DOM — passive:false for mobile) ──

  // Refs so the effect callbacks always see current values without re-attaching
  const drawModeRef = useRef(drawMode);
  const selectModeRef = useRef(selectMode);
  const dragStartRef = useRef<CellPos | null>(null);
  const moveOriginRef = useRef<CellPos | null>(null);
  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);
  useEffect(() => {
    selectModeRef.current = selectMode;
  }, [selectMode]);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!drawModeRef.current && !selectModeRef.current) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const cell = toCell(e);
      const shift = e.shiftKey;

      if (drawModeRef.current) {
        hitRef.current = "empty";
        dragStartRef.current = cell;
        setDragStart(cell);
        setDragCurrent(cell);
        return;
      }

      hasDraggedRef.current = false;
      const hitId = blockAtCell(cell.col, cell.row, blocksRef.current);

      if (hitId && selectedIdsRef.current.has(hitId) && !shift) {
        hitRef.current = "selected-block";
        clickedId.current = hitId;
        isDraggingGroup.current = false;
        lastDelta.current = { dx: 0, dy: 0 };
        moveOriginRef.current = cell;
        setMoveOrigin(cell);
      } else if (hitId && shift) {
        hitRef.current = "unselected-block-shift";
        clickedId.current = hitId;
        dragStartRef.current = cell;
        setRubberBandAdditive(true);
        setDragStart(cell);
        setDragCurrent(cell);
      } else if (hitId) {
        hitRef.current = "unselected-block";
        clickedId.current = hitId;
        moveOriginRef.current = cell;
        setMoveOrigin(cell);
      } else {
        hitRef.current = shift ? "empty-shift" : "empty";
        dragStartRef.current = cell;
        setRubberBandAdditive(shift);
        setDragStart(cell);
        setDragCurrent(cell);
      }
    },
    [toCell],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drawModeRef.current && !selectModeRef.current) return;
      const cell = toCell(e);

      if (drawModeRef.current) {
        if (dragStartRef.current) setDragCurrent(cell);
        return;
      }

      if (hitRef.current === "selected-block" && moveOriginRef.current) {
        const dx = cell.col - moveOriginRef.current.col;
        const dy = cell.row - moveOriginRef.current.row;
        if (dx !== lastDelta.current.dx || dy !== lastDelta.current.dy) {
          lastDelta.current = { dx, dy };
          isDraggingGroup.current = true;
          hasDraggedRef.current = true;
          onGroupMovePreview?.(dx, dy);
        }
      } else if (
        hitRef.current === "unselected-block" &&
        moveOriginRef.current
      ) {
        const dx = cell.col - moveOriginRef.current.col;
        const dy = cell.row - moveOriginRef.current.row;
        if ((dx !== 0 || dy !== 0) && !hasDraggedRef.current) {
          hasDraggedRef.current = true;
          onSelectionBox?.(0, 0, 0, 0);
          onClick(
            e as unknown as React.MouseEvent<HTMLDivElement>,
            clickedId.current!,
          );
          hitRef.current = "selected-block";
          isDraggingGroup.current = true;
          lastDelta.current = { dx, dy };
          onGroupMovePreview?.(dx, dy);
        } else if (hasDraggedRef.current) {
          if (dx !== lastDelta.current.dx || dy !== lastDelta.current.dy) {
            lastDelta.current = { dx, dy };
            onGroupMovePreview?.(dx, dy);
          }
        }
      } else if (
        (hitRef.current === "empty" ||
          hitRef.current === "empty-shift" ||
          hitRef.current === "unselected-block-shift") &&
        dragStartRef.current
      ) {
        setDragCurrent(cell);
        hasDraggedRef.current = true;
      }
    },
    [toCell, onClick, onSelectionBox, onGroupMovePreview],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!drawModeRef.current && !selectModeRef.current) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      const cell = toCell(e);
      const shift = e.shiftKey;
      const ds = dragStartRef.current;

      if (drawModeRef.current) {
        if (ds) {
          const rect = cornersToRect(ds, cell);
          onDrawComplete?.(rect.x, rect.y, rect.w, rect.h);
        }
        dragStartRef.current = null;
        setDragStart(null);
        setDragCurrent(null);
        hitRef.current = "empty";
        return;
      }

      if (hitRef.current === "selected-block") {
        if (isDraggingGroup.current) onGroupMoveCommit?.();
        moveOriginRef.current = null;
        setMoveOrigin(null);
        isDraggingGroup.current = false;
        lastDelta.current = { dx: 0, dy: 0 };
      } else if (hitRef.current === "unselected-block") {
        if (hasDraggedRef.current) {
          onGroupMoveCommit?.();
        } else {
          onShiftSelect?.(clickedId.current!, shift);
        }
        moveOriginRef.current = null;
        setMoveOrigin(null);
        isDraggingGroup.current = false;
        lastDelta.current = { dx: 0, dy: 0 };
      } else if (hitRef.current === "unselected-block-shift" && ds) {
        const isTap = ds.col === cell.col && ds.row === cell.row;
        if (isTap) {
          onShiftSelect?.(clickedId.current!, true);
        } else {
          const rect = cornersToRect(ds, cell);
          onSelectionBox?.(rect.x, rect.y, rect.w, rect.h, true);
        }
        dragStartRef.current = null;
        setDragStart(null);
        setDragCurrent(null);
        setRubberBandAdditive(false);
      } else if (
        (hitRef.current === "empty" || hitRef.current === "empty-shift") &&
        ds
      ) {
        const isTap = ds.col === cell.col && ds.row === cell.row;
        const additive = hitRef.current === "empty-shift";
        if (isTap) {
          if (!additive) onSelectionBox?.(cell.col, cell.row, 0, 0);
        } else {
          const rect = cornersToRect(ds, cell);
          onSelectionBox?.(rect.x, rect.y, rect.w, rect.h, additive);
        }
        dragStartRef.current = null;
        setDragStart(null);
        setDragCurrent(null);
        setRubberBandAdditive(false);
      }

      hitRef.current = "empty";
      clickedId.current = null;
      hasDraggedRef.current = false;
    },
    [toCell, onDrawComplete, onGroupMoveCommit, onShiftSelect, onSelectionBox],
  );

  // Attach with passive:false so preventDefault() works on mobile touch
  useEffect(() => {
    const el = containerRef.current as HTMLElement | null;
    if (!el) return;
    el.addEventListener("pointerdown", handlePointerDown, { passive: false });
    el.addEventListener("pointermove", handlePointerMove, { passive: false });
    el.addEventListener("pointerup", handlePointerUp, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

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
      style={{
        cursor: resolveCursor(
          drawMode,
          selectMode,
          !!moveOrigin,
          selectMode && !!hoveredId,
        ),
        touchAction: captureTouches ? "none" : "auto",
      }}
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
                    // Dividers render as a thin bar (below), so the cell itself
                    // is transparent — they read as a wall *between* blocks.
                    background: isDivider
                      ? "transparent"
                      : resolveBlockBg(
                          block.border,
                          block.bg,
                          isDivider,
                          isMoving,
                          isSelected,
                          isHovered,
                        ),
                    borderColor: isDivider ? "transparent" : block.border,
                    pointerEvents:
                      isNonClick || drawMode || selectMode ? "none" : undefined,
                    cursor: isNonClick ? "default" : undefined,
                  }}
                  onClick={
                    !isNonClick && !drawMode && !selectMode
                      ? (e) => onClick(e, item.i)
                      : undefined
                  }
                  onMouseEnter={
                    !isNonClick && !drawMode
                      ? () => setHoveredId(item.i)
                      : undefined
                  }
                  onMouseLeave={
                    !isNonClick && !drawMode
                      ? () => setHoveredId(null)
                      : undefined
                  }
                >
                  {isDivider && (
                    <div
                      className="absolute rounded-[2px]"
                      style={
                        block.w >= block.h
                          ? {
                              left: 0,
                              right: 0,
                              top: "33%",
                              height: "34%",
                              background: block.border,
                            }
                          : {
                              top: 0,
                              bottom: 0,
                              left: "33%",
                              width: "34%",
                              background: block.border,
                            }
                      }
                    />
                  )}
                  {block.fixture && !isDivider && (
                    <FixtureGraphic
                      fixture={block.fixture}
                      color={block.border}
                      cols={block.w}
                      rows={block.h}
                      className="absolute inset-0 pointer-events-none"
                    />
                  )}
                  {(() => {
                    const badge = blockBadges?.[item.i];
                    if (!badge || isDivider) return null;
                    const critical = badge.tone === "critical";
                    return (
                      <span
                        className="absolute top-0.5 right-0.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1 py-px shadow-sm border pointer-events-none"
                        style={{
                          borderColor: critical ? "#fecaca" : "#fde68a",
                          fontSize: "8px",
                        }}
                        title={`${badge.count} item${badge.count !== 1 ? "s" : ""} need${badge.count === 1 ? "s" : ""} attention`}
                      >
                        <span
                          className="w-1 h-1 rounded-full"
                          style={{ background: critical ? "#ef4444" : "#f59e0b" }}
                        />
                        <span
                          className="font-mono font-bold leading-none"
                          style={{ color: critical ? "#dc2626" : "#d97706" }}
                        >
                          {badge.count}
                        </span>
                      </span>
                    );
                  })()}
                  {!isDivider && (
                    <span
                      className="text-center px-1 font-mono font-medium uppercase tracking-wide leading-tight break-words"
                      style={{
                        fontSize: "clamp(7px, 1.1vw, 11px)",
                        color: block.border,
                      }}
                    >
                      {block.label}
                    </span>
                  )}
                </div>
              );
            })}
          </ReactGridLayout>

          {ghostRect && (
            <div
              className="absolute pointer-events-none rounded-sm border-2 border-dashed"
              style={resolveGhostStyle(
                ghostRect,
                cellSize,
                selectMode,
                rubberBandAdditive,
              )}
            />
          )}
        </>
      )}
    </div>
  );
}
