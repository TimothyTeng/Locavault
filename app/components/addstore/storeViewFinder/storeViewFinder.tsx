import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layout, LayoutItem } from "react-grid-layout";
import type { Block } from "../blockPicker/index";
import { GridCanvas } from "./GridCanvas";
import { GridControls } from "./GridControls";
import { ZoomControls } from "./ZoomControl";
import { ModeToggle, handlesForMode, type Mode } from "./ModeToggle";
import { DrawToolbar } from "../blockPicker/DrawToolbar";
import { useZoom } from "#utils/useZoom";
import { DEFAULT_BLOCKS } from "#types/BlockTypes";
import type { BlocksMap } from "#types/storeViewFinderTypes";
import { FieldLabel, StoreForm } from "./StoreForm";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import {
  handleBlockClick,
  handleSelectionBox,
  handleGroupMovePreview,
  handleGroupMoveCommit,
  handleDrawComplete,
  handleLayoutChange,
  handleColsChange,
  handleRowsChange,
  handleModeChange,
  buildSubmitPayload,
  handleKeyDown,
} from "#utils/helpers/storeViewFinder.helper";

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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dragOrigin = useRef<BlocksMap | null>(null);
  const selectedIdsRef = useRef(selectedIds);
  const colsRef = useRef(COLS);
  const rowsRef = useRef(ROWS);
  // True for exactly one onLayoutChange tick after a draw completes, so RGL's
  // push-out positions for existing blocks are captured even in draw mode.
  const justDrewRef = useRef(false);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  useEffect(() => {
    colsRef.current = COLS;
  }, [COLS]);
  useEffect(() => {
    rowsRef.current = ROWS;
  }, [ROWS]);

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

  const onBlockClick = (e: React.MouseEvent<HTMLDivElement>, id: string) =>
    handleBlockClick(e, id, isSelectMode, setSelectedIds, setSelectedId);

  const onSelectionBox = (x: number, y: number, w: number, h: number) =>
    handleSelectionBox(x, y, w, h, blocks, setSelectedIds);

  const onGroupMovePreview = useCallback(
    (dx: number, dy: number) =>
      handleGroupMovePreview(
        dx,
        dy,
        dragOrigin,
        selectedIdsRef,
        colsRef,
        rowsRef,
        setBlocks,
      ),
    [],
  );

  const onGroupMoveCommit = useCallback(
    () => handleGroupMoveCommit(dragOrigin),
    [],
  );

  const onDrawComplete = (x: number, y: number, w: number, h: number) => {
    justDrewRef.current = true;
    handleDrawComplete(x, y, w, h, selectedBlock, setBlocks);
  };

  const onLayoutChange = (newLayout: Layout) => {
    const allowInDrawMode = justDrewRef.current;
    justDrewRef.current = false;
    handleLayoutChange(
      newLayout,
      isSelectMode,
      isDrawMode,
      setBlocks,
      allowInDrawMode,
    );
  };

  const onColsChange = (newCols: number) =>
    handleColsChange(newCols, dragOrigin, setCOLS, setSelectedIds, setBlocks);

  const onRowsChange = (newRows: number) =>
    handleRowsChange(newRows, dragOrigin, setROWS, setSelectedIds, setBlocks);

  const onModeChange = (newMode: Mode) =>
    handleModeChange(
      newMode,
      dragOrigin,
      setMode,
      setSelectedIds,
      setSelectedId,
    );

  const submitForm = (name: string, tags: string[], description: string) => {
    const { isEdit, data } = buildSubmitPayload(
      name,
      tags,
      description,
      ROWS,
      COLS,
      blocks,
      userId,
      initialData?.storeId,
    );
    if (isEdit) {
      fetcher.submit(data, { method: "PATCH", encType: "application/json" });
      navigate(`/store/${initialData!.storeId}`);
    } else {
      fetcher.submit(data, { method: "POST", encType: "application/json" });
      navigate(`/store/${data.id}`, { state: { storeData: data } });
    }
  };

  useEffect(() => {
    const listener = (e: KeyboardEvent) =>
      handleKeyDown(
        e,
        isSelectMode,
        selectedIds,
        selectedId,
        setBlocks,
        setSelectedIds,
        setSelectedId,
      );
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [isSelectMode, selectedIds, selectedId]);

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-white font-mono p-6 gap-4">
      {/* ── Left: Canvas ─────────────────────────────────────── */}
      <div className="flex flex-col lg:w-1/2 min-w-0 min-h-0 overflow-hidden">
        {/* Main toolbar */}
        <div className="flex items-center justify-between px-4 h-11 shrink-0 bg-white border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Floor Plan
          </span>
          <ModeToggle mode={mode} onChange={onModeChange} />
          <ZoomControls
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(3, z + 0.1))}
            onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          />
        </div>

        {/* Draw mode — inline block picker toolbar */}
        {isDrawMode && (
          <DrawToolbar
            selectedBlock={selectedBlock}
            onSelectionChange={setSelectedBlock}
          />
        )}

        {/* Select mode — hint bar */}
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
              onClick={onBlockClick}
              onLayoutChange={onLayoutChange}
              onDrawComplete={onDrawComplete}
              onSelectionBox={onSelectionBox}
              onGroupMovePreview={onGroupMovePreview}
              onGroupMoveCommit={onGroupMoveCommit}
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
              onColsChange={onColsChange}
              onRowsChange={onRowsChange}
            />
          </div>
        </div>

        {/* Block picker section removed — now lives in DrawToolbar above the canvas */}

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
              submitForm(name, tags, description)
            }
          />
        </div>
      </div>
    </div>
  );
}
