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
import { useMemo, useState } from "react";

type Props = {
  cols: number;
  rows: number;
  blocks: BlocksMap;
  handles: ResizeHandleAxis[];
  onClick: (e: React.MouseEvent<HTMLDivElement>, id: string) => void;
  onLayoutChange?: (layout: Layout) => void;
  selectedId?: string | null;
};

export function GridCanvas({
  cols,
  rows,
  blocks = {},
  handles,
  onClick,
  onLayoutChange,
  selectedId,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Derive LayoutItem[] from blocks for react-grid-layout
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
      })),
    [blocks],
  );

  const { layout: responsiveLayout } = useResponsiveLayout({
    width,
    breakpoints: { lg: 0 },
    cols: { lg: cols },
    layouts: { lg: layout },
  });

  const rowHeight = width / cols;

  return (
    <div ref={containerRef} className="relative w-full">
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
            resizeConfig={{ enabled: true, handles }}
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
              return (
                <div
                  key={item.i}
                  className={`sgf-block flex items-center justify-center overflow-hidden
                              rounded-sm border transition-shadow
                              ${item.i === selectedId ? "ring-2 ring-offset-1 ring-slate-700 shadow-md" : ""}
                              ${item.static ? "sgf-block-static" : ""}`}
                  style={{
                    background:
                      item.i === selectedId
                        ? `${block.border}55`
                        : hoveredId === item.i
                          ? `${block.border}33`
                          : block.bg,
                    borderColor: block.border,
                  }}
                  onClick={(e) => onClick(e, item.i)}
                  onMouseEnter={() => setHoveredId(item.i)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <span
                    className="text-center px-1 font-mono font-medium uppercase tracking-wide leading-tight break-words"
                    style={{
                      fontSize: "clamp(7px, 1.1vw, 11px)",
                      color: block.border,
                    }}
                  >
                    {block.label}
                  </span>
                </div>
              );
            })}
          </ReactGridLayout>
        </>
      )}
    </div>
  );
}
