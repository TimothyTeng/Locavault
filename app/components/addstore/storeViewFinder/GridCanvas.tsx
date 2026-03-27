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
import { useMemo, useState, useCallback } from "react";

type CellPos = { col: number; row: number };

type Props = {
  cols: number;
  rows: number;
  blocks: BlocksMap;
  handles: ResizeHandleAxis[];
  onClick: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onLayoutChange?: (layout: Layout) => void;
  onDrawComplete?: (x: number, y: number, w: number, h: number) => void;
  selectedId?: string | null;
  readOnly?: boolean;
  drawMode?: boolean;
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
  selectedId,
  readOnly = false,
  drawMode = false,
  nonClickableKinds = [],
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ── Draw state ───────────────────────────────────────────
  const [drawStart, setDrawStart] = useState<CellPos | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<CellPos | null>(null);

  const rowHeight = width / cols;
  const cellSize = rowHeight;

  /** Convert pointer position relative to the grid into a col/row cell */
  const pointerToCell = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): CellPos => {
      const rect = e.currentTarget.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / cellSize);
      const row = Math.floor((e.clientY - rect.top) / cellSize);
      return {
        col: Math.max(0, Math.min(col, cols - 1)),
        row: Math.max(0, Math.min(row, rows - 1)),
      };
    },
    [cellSize, cols, rows],
  );

  /** Normalise two corners into x/y/w/h (top-left origin, always positive) */
  const cornersToRect = (a: CellPos, b: CellPos) => ({
    x: Math.min(a.col, b.col),
    y: Math.min(a.row, b.row),
    w: Math.abs(a.col - b.col) + 1,
    h: Math.abs(a.row - b.row) + 1,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawMode) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cell = pointerToCell(e);
    setDrawStart(cell);
    setDrawCurrent(cell);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawMode || !drawStart) return;
    setDrawCurrent(pointerToCell(e));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawMode || !drawStart) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const end = pointerToCell(e);
    const rect = cornersToRect(drawStart, end);
    setDrawStart(null);
    setDrawCurrent(null);
    onDrawComplete?.(rect.x, rect.y, rect.w, rect.h);
  };

  const ghostRect =
    drawStart && drawCurrent ? cornersToRect(drawStart, drawCurrent) : null;

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
        static: readOnly || drawMode,
      })),
    [blocks, readOnly, drawMode],
  );

  const { layout: responsiveLayout } = useResponsiveLayout({
    width,
    breakpoints: { lg: 0 },
    cols: { lg: cols },
    layouts: { lg: layout },
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ cursor: drawMode ? "crosshair" : undefined }}
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
            resizeConfig={{ enabled: !readOnly && !drawMode, handles }}
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
              const isSelected = item.i === selectedId;
              const isHovered = hoveredId === item.i;

              const bgColor = isDivider
                ? block.border
                : isSelected
                  ? `${block.border}55`
                  : isHovered
                    ? `${block.border}33`
                    : block.bg;

              return (
                <div
                  key={item.i}
                  className={[
                    "sgf-block flex items-center justify-center overflow-hidden rounded-sm border transition-shadow",
                    isSelected && !isNonClick
                      ? "ring-2 ring-offset-1 ring-slate-700 shadow-md"
                      : "",
                    item.static ? "sgf-block-static" : "",
                  ].join(" ")}
                  style={{
                    background: bgColor,
                    borderColor: block.border,
                    // In draw mode all existing blocks absorb no pointer events so the
                    // overlay can receive them for the drag gesture
                    pointerEvents: isNonClick || drawMode ? "none" : undefined,
                    cursor: isNonClick ? "default" : undefined,
                  }}
                  onClick={
                    isNonClick || drawMode
                      ? undefined
                      : (e) => onClick(e, item.i)
                  }
                  onMouseEnter={
                    isNonClick || drawMode
                      ? undefined
                      : () => setHoveredId(item.i)
                  }
                  onMouseLeave={
                    isNonClick || drawMode
                      ? undefined
                      : () => setHoveredId(null)
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

          {/* ── Ghost overlay while drawing ────────────────── */}
          {ghostRect && (
            <div
              className="absolute pointer-events-none rounded-sm border-2 border-dashed"
              style={{
                left: ghostRect.x * cellSize + 1,
                top: ghostRect.y * cellSize + 1,
                width: ghostRect.w * cellSize - 2,
                height: ghostRect.h * cellSize - 2,
                background: "rgba(30, 41, 59, 0.08)",
                borderColor: "#475569",
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
