import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layout, LayoutItem } from "react-grid-layout";
import type { Block } from "../blockPicker/index";
import { GridCanvas } from "./GridCanvas";
import { GridRuler } from "./GridRuler";
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
  handleShiftSelect,
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

import type { BlockDetails } from "#types/storeViewFinderTypes";

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
  /** When provided, the builder calls this on save instead of creating a store
   *  (used by the template builder). */
  onSave?: (payload: {
    name: string;
    tags: string[];
    description: string;
    rows: number;
    cols: number;
    blocks: BlockDetails[];
  }) => void;
  saveLabel?: string;
};

export default function StoreViewFinder({
  sidePanel,
  initialData,
  onSave,
  saveLabel,
}: Props) {
  const { userId } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [ROWS, setROWS] = useState(initialData?.rows ?? 10);
  const [COLS, setCOLS] = useState(initialData?.cols ?? 10);
  const [mode, setMode] = useState<Mode>("draw");
  // Spreadsheet-style A1/B3 coordinate guides around the grid.
  const [showRuler, setShowRuler] = useState(true);
  const RULER = 18;

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
  // Ref for the scroll wrapper around the canvas — we need to suppress
  // passive touchstart on it so mobile doesn't steal the gesture.
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

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

  // ── Zoom-to-fit (once on mount) ───────────────────────────
  // GridCanvas sets rowHeight = containerWidth / cols, so at zoom z:
  //   grid height = z * wrapperWidth * rows / cols
  // Solve for z so the full grid fits: fitZoom = availH * cols / (availW * rows)
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const availW = el.clientWidth - 32; // p-4 padding each side
    const availH = el.clientHeight - 32;
    if (availW <= 0 || availH <= 0) return;
    const fit = Math.min((availH * COLS) / (availW * ROWS), 1);
    setZoom(Math.max(0.5, parseFloat(fit.toFixed(2))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — runs once on mount only

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

  const onShiftSelect = (id: string, additive: boolean) =>
    handleShiftSelect(id, additive, setSelectedIds);

  const onSelectionBox = (
    x: number,
    y: number,
    w: number,
    h: number,
    additive = false,
  ) => handleSelectionBox(x, y, w, h, blocks, setSelectedIds, additive);

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
    // Template builder: hand the layout up instead of creating a store
    if (onSave) {
      const blockArr: BlockDetails[] = Object.entries(blocks).map(
        ([key, b]) => ({
          block_id: key,
          background: b.bg,
          border: b.border,
          label: b.label,
          height: b.h,
          width: b.w,
          x: b.x,
          y: b.y,
          kind: b.kind,
        }),
      );
      onSave({ name, tags, description, rows: ROWS, cols: COLS, blocks: blockArr });
      return;
    }

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

  // When in draw or select mode, prevent the scroll wrapper from claiming
  // touch gestures before the canvas pointer handlers can intercept them.
  // We do this only on the canvas element itself (via a prop), NOT the wrapper,
  // so the wrapper remains scrollable when zoomed in.

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
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden bg-white font-mono p-3 sm:p-6 gap-3 sm:gap-4">
      {/* ── Left: Canvas ─────────────────────────────────────── */}
      <div className="flex flex-col lg:w-1/2 min-w-0 min-h-0 overflow-hidden h-[55vh] lg:h-auto">
        {/* Main toolbar */}
        <div className="flex items-center justify-between px-3 sm:px-4 h-11 shrink-0 bg-white border-b border-slate-200 gap-2">
          <span className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">
            Floor Plan
          </span>
          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-between sm:justify-end">
            <ModeToggle mode={mode} onChange={onModeChange} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ZoomControls
              zoom={zoom}
              onZoomIn={() => setZoom((z) => Math.min(3, z + 0.1))}
              onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            />
          </div>
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
          ref={canvasWrapperRef}
          className="flex-1 overflow-auto p-4 min-h-0 overscroll-none"
          onClick={() => {
            if (!isDrawMode && !isSelectMode) setSelectedId(null);
          }}
        >
          <div
            className="relative"
            style={{
              width: `${zoom * 100}%`,
              paddingTop: showRuler ? RULER : 0,
              paddingLeft: showRuler ? RULER : 0,
            }}
          >
            {showRuler && <GridRuler cols={COLS} rows={ROWS} size={RULER} />}
            <GridCanvas
              key={`${COLS}-${ROWS}`}
              cols={COLS}
              rows={ROWS}
              blocks={blocks}
              handles={handles}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onClick={onBlockClick}
              onShiftSelect={onShiftSelect}
              onLayoutChange={onLayoutChange}
              onDrawComplete={onDrawComplete}
              onSelectionBox={onSelectionBox}
              onGroupMovePreview={onGroupMovePreview}
              onGroupMoveCommit={onGroupMoveCommit}
              drawMode={isDrawMode}
              selectMode={isSelectMode}
              captureTouches={isDrawMode || isSelectMode}
            />
          </div>
        </div>
      </div>

      {/* ── Right: Controls + Form ────────────────────────────── */}
      <div className="flex flex-col lg:w-1/2 shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 overflow-y-auto max-h-64 lg:max-h-none px-5">
        <div className="flex items-center justify-between px-6 h-14 shrink-0 border-b border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800">
            {onSave
              ? "New Template"
              : initialData
                ? "Edit Store"
                : "Store View Finder"}
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
            <label className="mt-3 flex items-center gap-2 text-[11px] font-mono text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showRuler}
                onChange={(e) => setShowRuler(e.target.checked)}
                className="accent-slate-700"
              />
              Coordinate guides (A1 · B3)
            </label>
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
            submitLabel={
              onSave ? (saveLabel ?? "Save template") : initialData ? "Save changes" : "Save"
            }
            onSubmit={(name, tags, description) =>
              submitForm(name, tags, description)
            }
          />
        </div>
      </div>
    </div>
  );
}
