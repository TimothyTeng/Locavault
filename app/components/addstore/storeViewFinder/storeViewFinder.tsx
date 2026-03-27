import { useEffect, useMemo, useRef, useState } from "react";
import type { Layout, LayoutItem } from "react-grid-layout";
import { BlockPicker, type Block } from "../blockPicker/index";
import { GridCanvas } from "./GridCanvas";
import { GridControls } from "./GridControls";
import { ZoomControls } from "./ZoomControl";
import { ModeToggle, handlesForMode, type Mode } from "./ModeToggle";
import { useZoom } from "#utils/useZoom";
import { DEFAULT_BLOCKS } from "#types/BlockTypes";
import type {
  BlocksMap,
  BlockDetails,
  CreateStoreInput,
} from "#types/storeViewFinderTypes";
import { FieldLabel, StoreForm } from "./StoreForm";
import { useFetcher, useLoaderData, useNavigate } from "react-router";

type Props = {
  sidePanel?: React.ReactNode;
  initialData?: {
    storeId: string;
    name: string;
    tags: string[];
    description: string;
    rows: number;
    cols: number;
    blocks: BlocksMap;
  };
};

export default function StoreViewFinder({ sidePanel, initialData }: Props) {
  const { userId } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [ROWS, setROWS] = useState(initialData?.rows ?? 10);
  const [COLS, setCOLS] = useState(initialData?.cols ?? 10);
  const [mode, setMode] = useState<Mode>("draw");

  const [blocks, setBlocks] = useState<BlocksMap>(initialData?.blocks ?? {});

  // Multi-select (select mode) vs single select (size/draw modes)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Snapshot of block positions at the moment a group drag starts.
  // We apply the cell delta from this snapshot on every preview tick
  // so positions are always relative to the origin, never accumulated.
  const dragOrigin = useRef<BlocksMap | null>(null);

  const [selectedBlock, setSelectedBlock] = useState<Block>(DEFAULT_BLOCKS[0]);

  const { zoom, setZoom } = useZoom(0.5, 3);
  const handles = handlesForMode(mode);
  const isDrawMode = mode === "draw";
  const isSelectMode = mode === "select";

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

  // ── Handlers ─────────────────────────────────────────────

  const handleBlockClick = (
    e: React.MouseEvent<HTMLDivElement>,
    id: string,
  ) => {
    e.stopPropagation();
    if (isSelectMode) {
      setSelectedIds(new Set([id]));
    } else {
      setSelectedId(id);
    }
  };

  const handleSelectionBox = (x: number, y: number, w: number, h: number) => {
    if (w === 0 && h === 0) {
      setSelectedIds(new Set());
      return;
    }
    const inside = new Set<string>();
    for (const [id, b] of Object.entries(blocks)) {
      if (b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y) {
        inside.add(id);
      }
    }
    setSelectedIds(inside);
  };

  /**
   * Called on every cell-delta change during a group drag.
   * Applies delta from the snapshot taken at drag start so positions
   * don't accumulate across multiple move events.
   */
  const handleGroupMovePreview = (dx: number, dy: number) => {
    if (!dragOrigin.current) {
      // First preview tick — snapshot current positions
      dragOrigin.current = { ...blocks };
    }
    const origin = dragOrigin.current;
    setBlocks((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) {
        const o = origin[id];
        if (!o) continue;
        next[id] = {
          ...o,
          x: Math.max(0, Math.min(o.x + dx, COLS - o.w)),
          y: Math.max(0, Math.min(o.y + dy, ROWS - o.h)),
        };
      }
      return next;
    });
  };

  /** Called on pointer-up — blocks are already in final position, just clear the snapshot */
  const handleGroupMoveCommit = () => {
    dragOrigin.current = null;
  };

  const handleDrawComplete = (x: number, y: number, w: number, h: number) => {
    const key = `block-${Date.now()}`;
    setBlocks((prev) => ({
      ...prev,
      [key]: {
        x,
        y,
        w,
        h,
        bg: `${selectedBlock.color}22`,
        border: selectedBlock.color,
        label: selectedBlock.name,
        kind: selectedBlock.kind,
      },
    }));
  };

  const handleLayoutChange = (newLayout: Layout) => {
    setBlocks((prev) => {
      const next = { ...prev };
      for (const item of newLayout) {
        if (!next[item.i]) continue;
        next[item.i] = {
          ...next[item.i],
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        };
      }
      return next;
    });
  };

  const handleColsChange = (newCols: number) => {
    setCOLS(newCols);
    setBlocks((prev) => {
      const next = { ...prev };
      for (const id in next) {
        const b = next[id];
        next[id] = {
          ...b,
          x: Math.min(b.x, newCols - b.w),
          w: Math.min(b.w, newCols),
        };
      }
      return next;
    });
  };

  const handleRowsChange = (newRows: number) => {
    setROWS(newRows);
    setBlocks((prev) => {
      const next = { ...prev };
      for (const id in next) {
        const b = next[id];
        next[id] = {
          ...b,
          y: Math.min(b.y, newRows - b.h),
          h: Math.min(b.h, newRows),
        };
      }
      return next;
    });
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelectedIds(new Set());
    setSelectedId(null);
    dragOrigin.current = null;
  };

  const submitForm = (
    name: string,
    tags: string[],
    description: string,
    rows: number,
    cols: number,
    blocks: BlocksMap,
  ) => {
    const blockArr: BlockDetails[] = Object.entries(blocks).map(([key, b]) => ({
      block_id: key,
      background: b.bg,
      border: b.border,
      label: b.label,
      height: b.h,
      width: b.w,
      x: b.x,
      y: b.y,
      kind: b.kind,
    }));

    if (initialData) {
      fetcher.submit(
        {
          name,
          userId,
          tags: JSON.stringify(tags),
          description,
          rows,
          cols,
          blocks: blockArr,
        },
        { method: "PATCH", encType: "application/json" },
      );
      navigate(`/store/${initialData.storeId}`);
    } else {
      const id = crypto.randomUUID();
      const data: CreateStoreInput = {
        id,
        name,
        userId,
        tags: JSON.stringify(tags),
        description,
        rows,
        cols,
        blocks: blockArr,
      };
      fetcher.submit(data, { method: "POST", encType: "application/json" });
      navigate(`/store/${id}`, { state: { storeData: data } });
    }
  };

  // Backspace / Delete — removes all selected blocks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      if (isSelectMode && selectedIds.size > 0) {
        setBlocks((prev) => {
          const next = { ...prev };
          for (const id of selectedIds) delete next[id];
          return next;
        });
        setSelectedIds(new Set());
        return;
      }

      if (selectedId) {
        setBlocks((prev) => {
          const next = { ...prev };
          delete next[selectedId];
          return next;
        });
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectMode, selectedIds, selectedId]);

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-slate-50 font-mono p-6 gap-4">
      {/* ── Left: Canvas ─────────────────────────────────────── */}
      <div className="flex flex-col lg:w-1/2 min-w-0 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 h-11 shrink-0 bg-white border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Floor Plan
          </span>
          <ModeToggle mode={mode} onChange={handleModeChange} />
          <ZoomControls
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(3, z + 0.1))}
            onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          />
        </div>

        {/* Contextual hint bars */}
        {isDrawMode && (
          <div className="px-4 py-1.5 bg-slate-800 shrink-0 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="text-[10px] font-mono text-slate-300">
              Click or drag to place a
              <span className="font-bold text-white mx-1">
                {selectedBlock.name}
              </span>
              block
            </span>
          </div>
        )}
        {isSelectMode && (
          <div className="px-4 py-1.5 bg-slate-800 shrink-0 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
            <span className="text-[10px] font-mono text-slate-300">
              {selectedIds.size > 0 ? (
                <>
                  <span className="font-bold text-white">
                    {selectedIds.size}
                  </span>
                  {" block"}
                  {selectedIds.size !== 1 ? "s" : ""} selected
                  {" · drag to move · "}
                  <span className="text-slate-400">⌫ to delete</span>
                </>
              ) : (
                "Drag to select · click a block to select it"
              )}
            </span>
          </div>
        )}

        <div
          className="flex-1 overflow-auto p-4 min-h-0 overscroll-none"
          onClick={() => {
            if (!isDrawMode && !isSelectMode) setSelectedId(null);
          }}
        >
          <div style={{ width: `${zoom * 100}%` }}>
            <GridCanvas
              key={`${COLS}-${ROWS}`}
              cols={COLS}
              rows={ROWS}
              blocks={blocks}
              handles={handles}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onClick={handleBlockClick}
              onLayoutChange={handleLayoutChange}
              onDrawComplete={handleDrawComplete}
              onSelectionBox={handleSelectionBox}
              onGroupMovePreview={handleGroupMovePreview}
              onGroupMoveCommit={handleGroupMoveCommit}
              drawMode={isDrawMode}
              selectMode={isSelectMode}
            />
          </div>
        </div>
      </div>

      {/* ── Right: Controls + Form ────────────────────────────── */}
      <div className="flex flex-col lg:w-1/2 shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto max-h-64 lg:max-h-none px-5">
        <div className="flex items-center justify-between px-6 h-14 shrink-0 border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800">
            {initialData ? "Edit Store" : "Store View Finder"}
          </span>
          <span className="text-[10px] text-slate-400">
            {Object.keys(blocks).length} block
            {Object.keys(blocks).length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-4 px-6 pb-4 border-b border-slate-100">
          <FieldLabel>Grid Size</FieldLabel>
          <div className="mt-2">
            <GridControls
              cols={COLS}
              rows={ROWS}
              onColsChange={handleColsChange}
              onRowsChange={handleRowsChange}
            />
          </div>
        </div>

        <div className="px-6 py-5 border-b border-slate-100">
          <FieldLabel>Blocks</FieldLabel>
          <div className="mt-2">
            <BlockPicker onSelectionChange={setSelectedBlock} />
          </div>
        </div>

        <div className="px-6 py-5 flex-1 min-h-0 pb-8">
          <StoreForm
            initialValues={
              initialData
                ? {
                    name: initialData.name,
                    tags: initialData.tags,
                    description: initialData.description,
                  }
                : undefined
            }
            submitLabel={initialData ? "Save changes" : "Save"}
            onSubmit={(name, tags, description) =>
              submitForm(name, tags, description, ROWS, COLS, blocks)
            }
          />
        </div>
      </div>
    </div>
  );
}
