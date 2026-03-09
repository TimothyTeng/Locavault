import {
  useContainerWidth,
  useResponsiveLayout,
  ReactGridLayout,
  getCompactor,
  type Layout,
  type LayoutItem,
  type ResizeHandleAxis,
} from "react-grid-layout";
import { GridBackground } from "react-grid-layout/extras";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { BlockStyle } from "../../../types/storeViewFinderTypes";

type Props = {
  cols: number;
  rows: number;
  layout: LayoutItem[];
  blockStyles: Record<string, BlockStyle>;
  handles: ResizeHandleAxis[];
};

export function GridCanvas({
  cols,
  rows,
  layout,
  blockStyles,
  handles,
}: Props) {
  const { width, containerRef, mounted } = useContainerWidth();
  const { layout: responsiveLayout } = useResponsiveLayout({
    width,
    breakpoints: { lg: 0 },
    cols: { lg: cols },
    layouts: { lg: layout },
  });

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
                  className={`sgf-block flex items-center justify-center overflow-hidden rounded-sm border${item.static ? " sgf-block-static" : ""}`}
                  style={{ background: style.bg, borderColor: style.border }}
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
