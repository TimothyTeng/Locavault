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
import { WallLayer } from "#components/common/wallLayer";
import type { Wall, WallKind } from "#types/wallTypes";
import {
  edgeAtCell,
  pointAtCell,
  wallRun,
  wallAt,
  wallKey,
  effectiveWallKeys,
  upsertWalls,
  removeWalls,
  withKind,
} from "#utils/helpers/wall.helper";
import { footprintBounds } from "#utils/helpers/storeViewFinder.helper";

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
  blockBadges?: Record<
    string,
    { count: number; tone: "critical" | "attention" }
  >;
  /** Edge-based wall layer — always rendered; drawn in draw mode, moved in select. */
  walls?: Wall[];
  /** Draw mode draws walls of this kind when set; null = draws blocks. */
  drawWallKind?: WallKind | null;
  /** Keys of walls picked in select mode (clicked or boxed on their own). */
  selectedWallKeys?: Set<string>;
  /** Select a wall (select mode); additive = toggle in the selection. */
  onWallSelect?: (wall: Wall, additive: boolean) => void;
  onWallsChange?: (walls: Wall[]) => void;
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
  walls = [],
  drawWallKind = null,
  selectedWallKeys = new Set(),
  onWallSelect,
  onWallsChange,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // Wall-draw drag state (preview run shown while dragging).
  const [wallPreview, setWallPreview] = useState<{
    edges: Wall[];
    mode: "draw" | "erase";
  } | null>(null);
  const [dragStart, setDragStart] = useState<CellPos | null>(null);
  const [dragCurrent, setDragCurrent] = useState<CellPos | null>(null);
  const [moveOrigin, setMoveOrigin] = useState<CellPos | null>(null);
  // Whether the rubber band is additive (shift held) or replacing
  const [rubberBandAdditive, setRubberBandAdditive] = useState(false);

  const lastDelta = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const hitRef = useRef<HitTarget>("empty");
  const clickedId = useRef<string | null>(null);
  const clickedWall = useRef<Wall | null>(null);
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

  // react-grid-layout insets cells by margin + containerPadding (defaults to the
  // margin). Mirror that model so the wall layer + edge picking land exactly on
  // the grid lines instead of drifting rightward across the grid.
  const RGL_MARGIN = 1; // matches gridConfig margin below
  const wallColW =
    cols > 0 ? (width - RGL_MARGIN * (cols - 1) - RGL_MARGIN * 2) / cols : 0;
  const wallPitchX = wallColW + RGL_MARGIN;
  const wallPitchY = rowHeight + RGL_MARGIN;
  const wallOrigin = RGL_MARGIN / 2; // grid line g sits at wallOrigin + g*pitch

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

  // ── Wall refs so the raw pointer handlers stay current ──
  const wallsRef = useRef(walls);
  const drawWallKindRef = useRef(drawWallKind);
  const selWallKeysRef = useRef(selectedWallKeys);
  const onWallsChangeRef = useRef(onWallsChange);
  const onWallSelectRef = useRef(onWallSelect);
  const wallDragRef = useRef<{
    anchor: [number, number];
    clickEdge: Wall | null;
    kind: "draw" | "erase";
  } | null>(null);
  useEffect(() => {
    wallsRef.current = walls;
  }, [walls]);
  useEffect(() => {
    drawWallKindRef.current = drawWallKind;
  }, [drawWallKind]);
  useEffect(() => {
    selWallKeysRef.current = selectedWallKeys;
  }, [selectedWallKeys]);
  useEffect(() => {
    onWallsChangeRef.current = onWallsChange;
  }, [onWallsChange]);
  useEffect(() => {
    onWallSelectRef.current = onWallSelect;
  }, [onWallSelect]);

  // Fractional grid coords from a pointer event (origin/pitch match the grid).
  const toFrac = useCallback(
    (e: PointerEvent): [number, number] => {
      const el = containerRef.current as HTMLElement;
      const rect = el.getBoundingClientRect();
      return [
        (e.clientX - rect.left - wallOrigin) / wallPitchX,
        (e.clientY - rect.top - wallOrigin) / wallPitchY,
      ];
    },
    [wallOrigin, wallPitchX, wallPitchY, containerRef],
  );

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      // Draw mode + a wall tool active → place/erase/toggle walls along grid lines.
      if (drawModeRef.current && drawWallKindRef.current) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const [fx, fy] = toFrac(e);
        const edge = edgeAtCell(fx, fy, cols, rows);
        const kind = drawWallKindRef.current;
        // Same kind already there → erase; empty or different kind → place/convert.
        const existing = edge ? wallAt(wallsRef.current, edge) : undefined;
        const op: "draw" | "erase" =
          existing && (existing.kind ?? "wall") === kind ? "erase" : "draw";
        wallDragRef.current = {
          anchor: pointAtCell(fx, fy, cols, rows),
          clickEdge: edge,
          kind: op,
        };
        setWallPreview({ edges: [], mode: op });
        return;
      }
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
        return;
      }
      if (hitId && shift) {
        hitRef.current = "unselected-block-shift";
        clickedId.current = hitId;
        dragStartRef.current = cell;
        setRubberBandAdditive(true);
        setDragStart(cell);
        setDragCurrent(cell);
        return;
      }
      if (hitId) {
        hitRef.current = "unselected-block";
        clickedId.current = hitId;
        moveOriginRef.current = cell;
        setMoveOrigin(cell);
        return;
      }

      // No block under the pointer — is a wall close by? (select / move it)
      const [fx, fy] = toFrac(e);
      const edge = edgeAtCell(fx, fy, cols, rows);
      const dist = edge
        ? edge.dir === "h"
          ? Math.abs(fy - edge.y)
          : Math.abs(fx - edge.x)
        : 1;
      const wall =
        edge && dist <= 0.3 ? wallAt(wallsRef.current, edge) : undefined;
      if (wall) {
        clickedWall.current = wall;
        moveOriginRef.current = cell;
        setMoveOrigin(cell);
        isDraggingGroup.current = false;
        lastDelta.current = { dx: 0, dy: 0 };
        hitRef.current =
          selWallKeysRef.current.has(wallKey(wall)) && !shift
            ? "selected-wall"
            : "unselected-wall";
        return;
      }

      // Empty → rubber band.
      hitRef.current = shift ? "empty-shift" : "empty";
      dragStartRef.current = cell;
      setRubberBandAdditive(shift);
      setDragStart(cell);
      setDragCurrent(cell);
    },
    [toCell, toFrac, cols, rows],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (drawModeRef.current && drawWallKindRef.current) {
        if (!wallDragRef.current) return;
        const [fx, fy] = toFrac(e);
        const [bx, by] = pointAtCell(fx, fy, cols, rows);
        const [ax, ay] = wallDragRef.current.anchor;
        setWallPreview({
          edges: wallRun(ax, ay, bx, by),
          mode: wallDragRef.current.kind,
        });
        return;
      }
      if (!drawModeRef.current && !selectModeRef.current) return;
      const cell = toCell(e);

      if (drawModeRef.current) {
        if (dragStartRef.current) setDragCurrent(cell);
        return;
      }

      const target = hitRef.current;
      if (
        (target === "selected-block" || target === "selected-wall") &&
        moveOriginRef.current
      ) {
        const dx = cell.col - moveOriginRef.current.col;
        const dy = cell.row - moveOriginRef.current.row;
        if (dx !== lastDelta.current.dx || dy !== lastDelta.current.dy) {
          lastDelta.current = { dx, dy };
          isDraggingGroup.current = true;
          hasDraggedRef.current = true;
          onGroupMovePreview?.(dx, dy);
        }
      } else if (target === "unselected-block" && moveOriginRef.current) {
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
      } else if (target === "unselected-wall" && moveOriginRef.current) {
        const dx = cell.col - moveOriginRef.current.col;
        const dy = cell.row - moveOriginRef.current.row;
        if ((dx !== 0 || dy !== 0) && !hasDraggedRef.current) {
          hasDraggedRef.current = true;
          onWallSelectRef.current?.(clickedWall.current!, false);
          hitRef.current = "selected-wall";
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
        (target === "empty" ||
          target === "empty-shift" ||
          target === "unselected-block-shift") &&
        dragStartRef.current
      ) {
        setDragCurrent(cell);
        hasDraggedRef.current = true;
      }
    },
    [toCell, onClick, onSelectionBox, onGroupMovePreview, toFrac, cols, rows],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      // Wall-draw commit.
      if (drawModeRef.current && drawWallKindRef.current) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* pointer may not have been captured */
        }
        const drag = wallDragRef.current;
        wallDragRef.current = null;
        setWallPreview(null);
        if (!drag) return;
        const [fx, fy] = toFrac(e);
        const [bx, by] = pointAtCell(fx, fy, cols, rows);
        const [ax, ay] = drag.anchor;
        const k = drawWallKindRef.current;
        const edges = wallRun(ax, ay, bx, by);
        let next = wallsRef.current;
        if (edges.length === 0) {
          if (drag.clickEdge)
            next =
              drag.kind === "erase"
                ? removeWalls(next, [drag.clickEdge])
                : upsertWalls(next, [withKind(drag.clickEdge, k)]);
        } else {
          next =
            drag.kind === "erase"
              ? removeWalls(next, edges)
              : upsertWalls(
                  next,
                  edges.map((edge) => withKind(edge, k)),
                );
        }
        onWallsChangeRef.current?.(next);
        return;
      }
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

      const target = hitRef.current;
      if (target === "selected-block" || target === "selected-wall") {
        if (isDraggingGroup.current) onGroupMoveCommit?.();
        moveOriginRef.current = null;
        setMoveOrigin(null);
        isDraggingGroup.current = false;
        lastDelta.current = { dx: 0, dy: 0 };
      } else if (target === "unselected-block") {
        if (hasDraggedRef.current) {
          onGroupMoveCommit?.();
        } else {
          onShiftSelect?.(clickedId.current!, shift);
        }
        moveOriginRef.current = null;
        setMoveOrigin(null);
        isDraggingGroup.current = false;
        lastDelta.current = { dx: 0, dy: 0 };
      } else if (target === "unselected-wall") {
        if (hasDraggedRef.current) {
          onGroupMoveCommit?.();
        } else {
          onWallSelectRef.current?.(clickedWall.current!, shift);
        }
        moveOriginRef.current = null;
        setMoveOrigin(null);
        isDraggingGroup.current = false;
        lastDelta.current = { dx: 0, dy: 0 };
      } else if (target === "unselected-block-shift" && ds) {
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
      } else if ((target === "empty" || target === "empty-shift") && ds) {
        const isTap = ds.col === cell.col && ds.row === cell.row;
        const additive = target === "empty-shift";
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
      clickedWall.current = null;
      hasDraggedRef.current = false;
    },
    [
      toCell,
      onDrawComplete,
      onGroupMoveCommit,
      onShiftSelect,
      onSelectionBox,
      toFrac,
      cols,
      rows,
    ],
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

  // Walls belonging to the current selection (outlined, and moved by a group
  // drag): every wall inside the selected blocks' bbox, unioned with any walls
  // selected on their own.
  const selBounds =
    selectMode && selectedIds.size > 0
      ? footprintBounds(blocks, selectedIds)
      : null;
  const selWallKeys = selectMode
    ? effectiveWallKeys(walls, selBounds, selectedWallKeys)
    : null;
  const selectedWalls =
    selWallKeys && selWallKeys.size
      ? walls.filter((w) => selWallKeys.has(wallKey(w)))
      : [];

  // ── Layout ───────────────────────────────────────────────

  const layout = useMemo<LayoutItem[]>(
    () =>
      Object.entries(blocks)
        // Rooms are a passive grouping layer, not RGL items (see region layer).
        .filter(([, b]) => b.kind !== "room")
        .map(([id, b]) => ({
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

          {/* ── Room regions (passive grouping layer, behind blocks) ── */}
          {Object.entries(blocks)
            .filter(([, b]) => b.kind === "room")
            .map(([id, b]) => {
              const isSel = selectMode
                ? selectedIds.has(id)
                : id === selectedId;
              return (
                <div
                  key={id}
                  className="absolute pointer-events-none rounded-md"
                  style={{
                    left: b.x * cellSize,
                    top: b.y * cellSize,
                    width: b.w * cellSize,
                    height: b.h * cellSize,
                    background: `${b.border}${isSel ? "1f" : "0e"}`,
                    border: `1.5px ${isSel ? "solid" : "dashed"} ${b.border}${isSel ? "" : "66"}`,
                  }}
                >
                  <span
                    className="absolute left-1 top-1 rounded bg-white/80 px-1 font-mono uppercase tracking-wide leading-none"
                    style={{ fontSize: 9, color: b.border, paddingBlock: 1 }}
                  >
                    {b.label}
                  </span>
                </div>
              );
            })}

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
                          style={{
                            background: critical ? "#ef4444" : "#f59e0b",
                          }}
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

          {/* Wall layer — always drawn; placed in draw mode, moved in select. */}
          <WallLayer
            walls={walls}
            cols={cols}
            rows={rows}
            originX={wallOrigin}
            originY={wallOrigin}
            pitchX={wallPitchX}
            pitchY={wallPitchY}
          />

          {/* Selection outline — a thin grey ring hugging the selected walls. */}
          {selectedWalls.length > 0 && (
            <WallLayer
              walls={selectedWalls}
              cols={cols}
              rows={rows}
              originX={wallOrigin}
              originY={wallOrigin}
              pitchX={wallPitchX}
              pitchY={wallPitchY}
              glow="#475569"
              zIndex={6}
            />
          )}

          {wallPreview && wallPreview.edges.length > 0 && (
            <WallLayer
              walls={wallPreview.edges}
              cols={cols}
              rows={rows}
              originX={wallOrigin}
              originY={wallOrigin}
              pitchX={wallPitchX}
              pitchY={wallPitchY}
              solid={wallPreview.mode === "erase" ? "#ef4444" : "#9aa3b1"}
              opacity={0.75}
            />
          )}
        </>
      )}
    </div>
  );
}
