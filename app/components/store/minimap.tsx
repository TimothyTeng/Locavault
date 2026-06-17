import { GridCanvas } from "~/components/addstore/storeViewFinder/GridCanvas";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import type { ResizeHandleAxis } from "react-grid-layout";
import { ZoomControls } from "#components/addstore/storeViewFinder/ZoomControl";

type Props = {
  blocks: BlocksMap;
  cols: number;
  rows: number;
  handles: ResizeHandleAxis[];
  selectedId: string | null;
  onClick: (e: React.MouseEvent<HTMLDivElement>, blockId: string) => void;
  forceExpanded?: boolean;
  expanded: boolean;
  onToggleExpanded: (v: boolean) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  blockBadges?: Record<
    string,
    { count: number; tone: "critical" | "attention" }
  >;
};

export function MiniMap({
  blocks,
  cols,
  rows,
  handles,
  selectedId,
  onClick,
  forceExpanded = false,
  expanded,
  onToggleExpanded,
  zoom,
  onZoomIn,
  onZoomOut,
  blockBadges,
}: Props) {
  const isExpanded = expanded || forceExpanded;

  if (isExpanded) {
    return (
      <div className="fixed bottom-0 left-0 w-full h-1/2 z-40 bg-white border-t border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-9 border-b border-slate-100 shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
            Floor Plan
          </span>
          <div className="flex items-center gap-2">
            <ZoomControls
              zoom={zoom}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
            />
            {!forceExpanded && (
              <button
                onClick={() => onToggleExpanded(false)}
                className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-400 transition-all"
              >
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 7l6-6M8 7V2H3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-3">
          <div style={{ width: `${zoom * 100}%` }}>
            <GridCanvas
              cols={cols}
              rows={rows}
              blocks={blocks}
              handles={handles}
              selectedId={selectedId}
              onClick={onClick}
              readOnly={true}
              nonClickableKinds={["divider", "stairs"]}
              blockBadges={blockBadges}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Collapsed minimap ──
  return (
    <button
      onClick={() => onToggleExpanded(true)}
      className="fixed bottom-4 left-4 z-40 w-20 h-20 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col items-center justify-center group"
      aria-label="Expand floor plan"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: "scale(0.35)",
          transformOrigin: "top left",
          width: "286%",
          height: "286%",
        }}
      >
        <GridCanvas
          cols={cols}
          rows={rows}
          blocks={blocks}
          handles={[]}
          selectedId={selectedId}
          onClick={() => {}}
          readOnly={true}
          nonClickableKinds={["divider", "stairs"]}
        />
      </div>
      <div className="absolute inset-0 bg-slate-800/0 group-hover:bg-slate-800/30 transition-all duration-150 flex items-center justify-center">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-white"
        >
          <path
            d="M2 9v5h5M14 7V2H9M2 9l5-5M14 7l-5 5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="absolute bottom-1 left-0 right-0 text-center text-[7px] font-bold uppercase tracking-widest text-slate-400 group-hover:opacity-0 transition-opacity">
        Map
      </span>
    </button>
  );
}
