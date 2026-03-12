import {
  useContainerWidth,
  useResponsiveLayout,
  ReactGridLayout,
  getCompactor,
  type LayoutItem,
  type ResizeHandleAxis,
} from "react-grid-layout";
import { GridBackground } from "react-grid-layout/extras";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { BlockStyle } from "../../../types/storeViewFinderTypes";
import { useState } from "react";
import { darkenColor } from "../../../utils/GridHelper";

type Props = {
  cols: number;
  rows: number;
  layout: LayoutItem[];
  blockStyles: Record<string, BlockStyle>;
  handles: ResizeHandleAxis[];
  onClick: (element: React.MouseEvent<HTMLDivElement>, id: string) => void;
  selectedId?: string | null;
};

export function GridCanvas({
  cols,
  rows,
  layout,
  blockStyles,
  handles,
  onClick,
  selectedId,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const { layout: responsiveLayout } = useResponsiveLayout({
    width,
    breakpoints: { lg: 0 },
    cols: { lg: cols },
    layouts: { lg: layout },
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const rowHeight = width / cols;

  return (
    <div ref={containerRef} className="relative w-full">
      {mounted && (
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
            resizeConfig={{
              enabled: true,
              handles: handles,
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
              const style = blockStyles[item.i];
              if (!style) return null;
              return (
                <div
                  key={item.i}
                  className={`sgf-block flex items-center justify-center overflow-hidden rounded-sm border transition-shadow ${
                    item.i === selectedId
                      ? "ring-2 ring-offset-1 ring-slate-700 shadow-md"
                      : ""
                  }${item.static ? " sgf-block-static" : ""}`}
                  style={{
                    background:
                      item.i === selectedId
                        ? `${style.border}55` // selected — more opaque
                        : hoveredId === item.i
                          ? `${style.border}33` // hovered — slightly opaque
                          : style.bg, // default — original (border + "22")
                    borderColor: style.border,
                  }}
                  onClick={(e) => onClick(e, item.i)}
                >
                  <span
                    className="text-center px-1 font-mono font-medium uppercase tracking-wide leading-tight break-words"
                    style={{
                      fontSize: "clamp(7px, 1.1vw, 11px)",
                      color: style.border,
                    }}
                  >
                    {style.label}
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
