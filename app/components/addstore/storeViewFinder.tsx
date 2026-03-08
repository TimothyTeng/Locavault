import {
  useContainerWidth,
  useResponsiveLayout,
  ReactGridLayout,
  getCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import { GridBackground } from "react-grid-layout/extras";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { BlockPicker } from "./blockPicker/index";
import { useState } from "react";

type BlockStyle = { bg: string; border: string; label: string };

function findNextFreeCell(layout: LayoutItem[], cols: number, rows: number) {
  const occupied = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (const item of layout) {
    for (let dy = 0; dy < item.h; dy++) {
      for (let dx = 0; dx < item.w; dx++) {
        const cy = item.y + dy;
        const cx = item.x + dx;
        if (cy < rows && cx < cols) occupied[cy][cx] = true;
      }
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied[y][x]) return { x, y };
    }
  }
  return { x: 0, y: rows };
}

export default function StoreViewFinder() {
  const [ROWS, setROWS] = useState(10);
  const [COLS, setCOLS] = useState(10);
  const [blockStyles, setBlockStyles] = useState<Record<string, BlockStyle>>(
    {},
  );
  const [layouts, setLayouts] = useState({ lg: [] as LayoutItem[] });

  const handleLayoutChange = (currentLayout: Layout) => {
    setLayouts((prev) => ({
      ...prev,
      lg: currentLayout as unknown as LayoutItem[],
    }));
  };

  const { width, containerRef, mounted } = useContainerWidth();
  const { layout, cols } = useResponsiveLayout({
    width,
    breakpoints: { lg: 0 },
    cols: { lg: COLS },
    layouts: layouts,
    onLayoutChange: handleLayoutChange,
  });

  const rowHeight = width / cols;

  return (
    <div className="sgf-wrap" ref={containerRef}>
      <BlockPicker
        onBlockClick={(block) => {
          const key = `block-${Date.now()}`;
          const { x, y } = findNextFreeCell(layouts.lg, COLS, ROWS);
          setBlockStyles((prev) => ({
            ...prev,
            [key]: {
              bg: `${block.color}22`,
              border: block.color,
              label: block.name,
            },
          }));
          setLayouts((prev) => ({
            ...prev,
            lg: [...prev.lg, { i: key, x, y, w: 1, h: 1, minW: 1, minH: 1 }],
          }));
        }}
      />
      <div ref={containerRef} style={{ position: "relative" }}>
        {mounted && (
          <>
            <GridBackground
              width={width}
              cols={cols}
              rowHeight={rowHeight}
              margin={[1, 1]}
              rows={ROWS}
              color="#f0f0f0"
              borderRadius={1}
              className="bg-gray-300"
            />
            <ReactGridLayout
              layout={layout}
              width={width}
              compactor={getCompactor(null, false, true)}
              onLayoutChange={handleLayoutChange}
              resizeConfig={{
                enabled: true,
                handles: ["n", "s", "e", "w", "se", "sw", "ne", "nw"],
              }}
              gridConfig={{
                cols,
                rowHeight,
                maxRows: ROWS,
                margin: [1, 1],
              }}
              style={{
                height: rowHeight * ROWS,
                width: "100%",
                background: "transparent",
              }}
              className="sgf-grid"
            >
              {layout.map((item) => {
                const style = blockStyles[item.i];
                if (!style) return null;

                return (
                  <div
                    key={item.i}
                    className={`sgf-block${item.static ? " sgf-block-static" : ""}`}
                    style={{
                      background: style.bg,
                      borderColor: style.border,
                    }}
                  >
                    <span className="sgf-block-label">{style.label}</span>
                  </div>
                );
              })}
            </ReactGridLayout>
          </>
        )}
      </div>
    </div>
  );
}
