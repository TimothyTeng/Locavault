import { useState } from "react";
import type { LayoutItem } from "react-grid-layout";
import { BlockPicker, type Block } from "../blockPicker/index";
import { GridCanvas } from "./GridCanvas";
import { GridControls } from "./GridControls";
import { ZoomControls } from "./ZoomControl";
import { ModeToggle, handlesForMode } from "./ModeToggle";
import { useZoom } from "../../../utils/useZoom";
import { findNextFreeCell } from "../../../utils/GridHelper";
import type { BlockStyle } from "../../../types/storeViewFinderTypes";

type Mode = "select" | "size";

type Props = {
  sidePanel?: React.ReactNode;
};

export default function StoreViewFinder({ sidePanel }: Props) {
  const [ROWS, setROWS] = useState(10);
  const [COLS, setCOLS] = useState(10);
  const [mode, setMode] = useState<Mode>("size");
  const [blockStyles, setBlockStyles] = useState<Record<string, BlockStyle>>(
    {},
  );
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const { zoom, setZoom, containerRef } = useZoom(0.5, 3);

  const handles = handlesForMode(mode);

  const handleColsChange = (newCols: number) => {
    setCOLS(newCols);
    setLayout((prev) =>
      prev.map((item) => ({
        ...item,
        x: Math.min(item.x, newCols - item.w),
        w: Math.min(item.w, newCols),
      })),
    );
  };

  const handleRowsChange = (newRows: number) => {
    setROWS(newRows);
    setLayout((prev) =>
      prev.map((item) => ({
        ...item,
        y: Math.min(item.y, newRows - item.h),
        h: Math.min(item.h, newRows),
      })),
    );
  };

  const handleBlockClick = (block: Block) => {
    const key = `block-${Date.now()}`;
    const { x, y } = findNextFreeCell(layout, COLS, ROWS);
    setBlockStyles((prev) => ({
      ...prev,
      [key]: { bg: `${block.color}22`, border: block.color, label: block.name },
    }));
    setLayout((prev) => [
      ...prev,
      { i: key, x, y, w: 1, h: 1, minW: 1, minH: 1 },
    ]);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-slate-50 font-mono !p-6 !pt-20 gap-4">
      {/* ── Left: Canvas ─────────────────────────────────────── */}
      <div className="flex flex-col lg:w-1/2 min-w-0 min-h-0 overflow-hidden">
        {/* Canvas toolbar */}
        <div className="flex items-center justify-between px-4 h-11 shrink-0 bg-white border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Floor Plan
          </span>

          <ModeToggle mode={mode} onChange={setMode} />

          <ZoomControls
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(3, z + 0.1))}
            onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          />
        </div>

        {/* Scrollable grid */}
        <div
          className="flex-1 overflow-auto p-4 min-h-0 overscroll-none"
          ref={containerRef}
        >
          <div style={{ width: `${zoom * 100}%` }}>
            <GridCanvas
              key={`${COLS}-${ROWS}`}
              cols={COLS}
              rows={ROWS}
              layout={layout}
              blockStyles={blockStyles}
              handles={handles}
            />
          </div>
        </div>
      </div>

      {/* ── Right: Controls + Form ────────────────────────────── */}
      <div className="flex flex-col lg:w-1/2 shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto max-h-64 lg:max-h-none !px-5">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 h-14 shrink-0 border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800">
            Store View Finder
          </span>
          <span className="text-[10px] text-slate-400">
            {layout.length} block{layout.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Grid size controls */}
        <div className="px-6 py-6 border-b border-slate-100">
          <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-3">
            Grid Size
          </p>
          <GridControls
            cols={COLS}
            rows={ROWS}
            onColsChange={handleColsChange}
            onRowsChange={handleRowsChange}
          />
        </div>

        {/* Block picker */}
        <div className="px-6 py-6 border-b border-slate-100">
          <p className="text-[9px] uppercase tracking-widest text-slate-400 mb-3">
            Blocks
          </p>
          <BlockPicker onBlockClick={handleBlockClick} />
        </div>

        {/* Injected form fields */}
        {sidePanel && (
          <div className="px-6 py-6 flex-1 min-h-0">{sidePanel}</div>
        )}
      </div>
    </div>
  );
}
