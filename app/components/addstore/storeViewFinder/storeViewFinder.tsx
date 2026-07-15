import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layout, LayoutItem } from "react-grid-layout";
import type { Block } from "../blockPicker/index";
import { GridCanvas } from "./GridCanvas";
import { GridRuler } from "./GridRuler";
import { GridControls } from "./GridControls";
import { ZoomControls } from "./ZoomControl";
import { ModeToggle, handlesForMode, type Mode } from "./ModeToggle";
import { DrawToolbar } from "../blockPicker/DrawToolbar";
import { CustomFixtureProvider } from "#lib/fixtures";
import type { CustomFixture } from "#types/customFixtureTypes";
import { useZoom } from "#utils/useZoom";
import { DEFAULT_BLOCKS } from "#types/BlockTypes";
import type { BlocksMap, BlockState } from "#types/storeViewFinderTypes";
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
  footprintBounds,
} from "#utils/helpers/storeViewFinder.helper";
import {
  effectiveWallKeys,
  moveWalls,
  wallInBounds,
  wallKey,
} from "#utils/helpers/wall.helper";

import type { BlockDetails } from "#types/storeViewFinderTypes";
import type { Wall, WallKind } from "#types/wallTypes";

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
    walls?: Wall[];
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
    walls: Wall[];
  }) => void;
  saveLabel?: string;
};

export default function StoreViewFinder({
  sidePanel,
  initialData,
  onSave,
  saveLabel,
}: Props) {
  const { userId, customFixtures = [] } = useLoaderData() as {
    userId: string;
    customFixtures?: CustomFixture[];
  };
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [ROWS, setROWS] = useState(initialData?.rows ?? 10);
  const [COLS, setCOLS] = useState(initialData?.cols ?? 10);
  const [mode, setMode] = useState<Mode>("draw");
  // Spreadsheet-style A1/B3 coordinate guides around the grid.
  const [showRuler, setShowRuler] = useState(true);
  const RULER = 18;

  const [blocks, setBlocks] = useState<BlocksMap>(initialData?.blocks ?? {});
  const [walls, setWalls] = useState<Wall[]>(initialData?.walls ?? []);
  // Draw mode draws walls of this kind when set; null = draws blocks.
  const [drawWallKind, setDrawWallKind] = useState<WallKind | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Walls explicitly picked in select mode (clicked or boxed on their own).
  const [selectedWallKeys, setSelectedWallKeys] = useState<Set<string>>(
    new Set(),
  );

  const dragOrigin = useRef<BlocksMap | null>(null);
  // Original walls captured at the start of a group move; selected walls are
  // offset from this snapshot each preview frame so they travel with the selection.
  const wallDragOrigin = useRef<Wall[] | null>(null);
  const wallsRef = useRef(walls);
  const blocksRef = useRef(blocks);
  const selectedWallKeysRef = useRef(selectedWallKeys);
  // Undo/redo stacks (snapshots of blocks + walls) + a copy buffer for blocks.
  const historyRef = useRef<{
    undo: { blocks: BlocksMap; walls: Wall[] }[];
    redo: { blocks: BlocksMap; walls: Wall[] }[];
    last: { blocks: BlocksMap; walls: Wall[] };
    restoring: boolean;
  }>({ undo: [], redo: [], last: { blocks, walls }, restoring: false });
  const clipboardRef = useRef<BlockState[] | null>(null);
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
  useEffect(() => {
    wallsRef.current = walls;
  }, [walls]);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);
  useEffect(() => {
    selectedWallKeysRef.current = selectedWallKeys;
  }, [selectedWallKeys]);

  const [selectedBlock, setSelectedBlock] = useState<Block>(DEFAULT_BLOCKS[0]);

  const { zoom, setZoom } = useZoom(0.5, 3);
  const handles = handlesForMode(mode);
  const isDrawMode = mode === "draw";
  const isSelectMode = mode === "select";
  const isSizeMode = mode === "size";

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

  // Picking a block clears any standalone wall selection (block tap = block only;
  // its surrounding walls are still resolved from its bbox at move/outline time).
  const onShiftSelect = (id: string, additive: boolean) => {
    handleShiftSelect(id, additive, setSelectedIds);
    if (!additive) setSelectedWallKeys(new Set());
  };

  const onSelectionBox = (
    x: number,
    y: number,
    w: number,
    h: number,
    additive = false,
  ) => {
    handleSelectionBox(x, y, w, h, blocks, setSelectedIds, additive);
    // A box also picks up the walls inside it.
    if (w === 0 && h === 0) {
      if (!additive) setSelectedWallKeys(new Set());
      return;
    }
    const bounds = { x0: x, y0: y, x1: x + w, y1: y + h };
    const inside = walls.filter((wl) => wallInBounds(wl, bounds)).map(wallKey);
    setSelectedWallKeys((prev) => {
      if (!additive) return new Set(inside);
      const next = new Set(prev);
      for (const k of inside) next.add(k);
      return next;
    });
  };

  // Select a single wall (clears block selection so it moves on its own).
  const onWallSelect = (wall: Wall, additive: boolean) => {
    const k = wallKey(wall);
    if (!additive) setSelectedIds(new Set());
    setSelectedWallKeys((prev) => {
      if (!additive) return new Set([k]);
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const onGroupMovePreview = useCallback((dx: number, dy: number) => {
    handleGroupMovePreview(
      dx,
      dy,
      dragOrigin,
      selectedIdsRef,
      colsRef,
      rowsRef,
      setBlocks,
    );
    // Carry the selection's walls along by the same delta, offset from a fixed
    // snapshot of the *original* walls. Resolve the moving key set from that
    // snapshot each frame (selected blocks' bbox ∪ explicitly-selected walls) so a
    // wall selected on the drag's first frame isn't missed by stale state.
    if (wallDragOrigin.current === null)
      wallDragOrigin.current = wallsRef.current;
    const baseBlocks = dragOrigin.current ?? blocksRef.current;
    const bounds = footprintBounds(baseBlocks, selectedIdsRef.current);
    const keys = effectiveWallKeys(
      wallDragOrigin.current,
      bounds,
      selectedWallKeysRef.current,
    );
    setWalls(
      moveWalls(
        wallDragOrigin.current,
        keys,
        dx,
        dy,
        colsRef.current,
        rowsRef.current,
      ),
    );
  }, []);

  const onGroupMoveCommit = useCallback(() => {
    handleGroupMoveCommit(dragOrigin);
    wallDragOrigin.current = null;
  }, []);

  // Picking a block type clears the active wall tool (and vice-versa).
  const onSelectBlock = (b: Block) => {
    setDrawWallKind(null);
    setSelectedBlock(b);
  };

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

  const onColsChange = (newCols: number) => {
    wallDragOrigin.current = null;
    handleColsChange(newCols, dragOrigin, setCOLS, setSelectedIds, setBlocks);
  };

  const onRowsChange = (newRows: number) => {
    wallDragOrigin.current = null;
    handleRowsChange(newRows, dragOrigin, setROWS, setSelectedIds, setBlocks);
  };

  const onModeChange = (newMode: Mode) => {
    wallDragOrigin.current = null;
    setSelectedWallKeys(new Set());
    handleModeChange(
      newMode,
      dragOrigin,
      setMode,
      setSelectedIds,
      setSelectedId,
    );
  };

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
      onSave({
        name,
        tags,
        description,
        rows: ROWS,
        cols: COLS,
        blocks: blockArr,
        walls,
      });
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
      walls,
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

  // ── Undo/redo history: coalesce rapid changes (e.g. a drag) into one entry ──
  useEffect(() => {
    const h = historyRef.current;
    if (h.restoring) {
      h.restoring = false;
      h.last = { blocks, walls };
      return;
    }
    const t = setTimeout(() => {
      if (h.last.blocks !== blocks || h.last.walls !== walls) {
        h.undo.push(h.last);
        if (h.undo.length > 60) h.undo.shift();
        h.redo = [];
        h.last = { blocks, walls };
      }
    }, 250);
    return () => clearTimeout(t);
  }, [blocks, walls]);

  // ── Keyboard: delete · undo/redo (⌘/Ctrl+Z, +Shift or +Y) · copy/paste ──
  useEffect(() => {
    const restore = (snap: { blocks: BlocksMap; walls: Wall[] }) => {
      historyRef.current.restoring = true;
      setBlocks(snap.blocks);
      setWalls(snap.walls);
      setSelectedIds(new Set());
      setSelectedId(null);
      setSelectedWallKeys(new Set());
    };
    const undo = () => {
      const h = historyRef.current;
      // Flush a not-yet-debounced change so it becomes redoable.
      if (h.last.blocks !== blocks || h.last.walls !== walls) {
        h.undo.push(h.last);
        h.last = { blocks, walls };
      }
      const prev = h.undo.pop();
      if (!prev) return;
      h.redo.push({ blocks, walls });
      restore(prev);
    };
    const redo = () => {
      const h = historyRef.current;
      const next = h.redo.pop();
      if (!next) return;
      h.undo.push({ blocks, walls });
      restore(next);
    };
    const copy = () => {
      const ids = selectedIds.size
        ? [...selectedIds]
        : selectedId
          ? [selectedId]
          : [];
      const picked = ids.map((id) => blocks[id]).filter(Boolean);
      if (picked.length) clipboardRef.current = picked.map((b) => ({ ...b }));
    };
    const paste = () => {
      const clip = clipboardRef.current;
      if (!clip?.length) return;
      const ids = new Set<string>();
      setBlocks((prev) => {
        const next = { ...prev };
        for (const b of clip) {
          const id = crypto.randomUUID();
          next[id] = {
            ...b,
            x: Math.max(0, Math.min(b.x + 1, COLS - b.w)),
            y: Math.max(0, Math.min(b.y + 1, ROWS - b.h)),
          };
          ids.add(id);
        }
        return next;
      });
      setSelectedIds(ids);
      setSelectedId(null);
    };

    const listener = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.ctrlKey || e.metaKey) && !typing) {
        const k = e.key.toLowerCase();
        if (k === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (k === "y") {
          e.preventDefault();
          redo();
          return;
        }
        if (k === "c") {
          copy();
          return;
        }
        if (k === "v") {
          e.preventDefault();
          paste();
          return;
        }
      }
      // Delete also removes any selected walls (blocks handled below).
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !typing &&
        isSelectMode &&
        selectedWallKeysRef.current.size > 0
      ) {
        const kill = selectedWallKeysRef.current;
        setWalls((prev) => prev.filter((w) => !kill.has(wallKey(w))));
        setSelectedWallKeys(new Set());
      }
      handleKeyDown(
        e,
        isSelectMode,
        selectedIds,
        selectedId,
        setBlocks,
        setSelectedIds,
        setSelectedId,
      );
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [isSelectMode, selectedIds, selectedId, blocks, walls, COLS, ROWS]);

  // ── Render ────────────────────────────────────────────────

  return (
    <CustomFixtureProvider fixtures={customFixtures}>
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

          {/* Draw mode — inline block + wall picker toolbar */}
          {isDrawMode && (
            <DrawToolbar
              selectedBlock={selectedBlock}
              onSelectionChange={onSelectBlock}
              wallKind={drawWallKind}
              onWallKindChange={setDrawWallKind}
              customFixtures={customFixtures}
            />
          )}

          {/* Size mode — hint bar (previously had no on-screen affordance) */}
          {isSizeMode && (
            <div className="px-4 py-1.5 bg-slate-800 shrink-0 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-[10px] font-mono text-slate-300">
                Drag a block&apos;s corner handle to resize · drag its body to
                move
              </span>
            </div>
          )}

          {/* Select mode — hint bar */}
          {isSelectMode && (
            <div className="px-4 py-1.5 bg-slate-800 shrink-0 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              <span className="text-[10px] font-mono text-slate-300">
                {selectedIds.size > 0 || selectedWallKeys.size > 0 ? (
                  <>
                    <span className="font-bold text-white">
                      {selectedIds.size + selectedWallKeys.size}
                    </span>
                    {" selected · drag to move · "}
                    <span className="text-slate-400">⌫ to delete</span>
                  </>
                ) : (
                  "Drag to box-select · click a block or wall to select it"
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
                walls={walls}
                drawWallKind={drawWallKind}
                selectedWallKeys={selectedWallKeys}
                onWallSelect={onWallSelect}
                onWallsChange={setWalls}
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
                onSave
                  ? (saveLabel ?? "Save template")
                  : initialData
                    ? "Save changes"
                    : "Save"
              }
              onSubmit={(name, tags, description) =>
                submitForm(name, tags, description)
              }
            />
          </div>
        </div>
      </div>
    </CustomFixtureProvider>
  );
}
