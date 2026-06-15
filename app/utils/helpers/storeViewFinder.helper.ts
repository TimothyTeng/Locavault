import type { RefObject } from "react";
import type { Layout } from "react-grid-layout";
import type { Block } from "#components/addstore/blockPicker/index";
import type { Mode } from "#components/addstore/storeViewFinder/ModeToggle";
import type { BlocksMap, BlockDetails, CreateStoreInput } from "#types/storeViewFinderTypes";

// ── Selection ─────────────────────────────────────────────

export function handleBlockClick(
  e: React.MouseEvent<HTMLDivElement>,
  id: string,
  isSelectMode: boolean,
  setSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void,
  setSelectedId: (id: string | null) => void,
) {
  e.stopPropagation();
  if (isSelectMode) {
    setSelectedIds(() => new Set([id]));
  } else {
    setSelectedId(id);
  }
}

export function handleSelectionBox(
  x: number,
  y: number,
  w: number,
  h: number,
  blocks: BlocksMap,
  setSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void,
  additive = false,
) {
  if (w === 0 && h === 0) {
    if (!additive) setSelectedIds(() => new Set());
    return;
  }
  const inside = new Set<string>();
  for (const [id, b] of Object.entries(blocks)) {
    if (b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y) {
      inside.add(id);
    }
  }
  setSelectedIds((prev) => {
    if (!additive) return inside;
    const next = new Set(prev);
    for (const id of inside) next.add(id);
    return next;
  });
}
 
// Toggle a single block in/out of selection (shift+click)
export function handleShiftSelect(
  id: string,
  additive: boolean,
  setSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void,
) {
  setSelectedIds((prev) => {
    if (!additive) return new Set([id]);
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

// ── Group Move ────────────────────────────────────────────

export function handleGroupMovePreview(
  dx: number,
  dy: number,
  dragOrigin: RefObject<BlocksMap | null>,
  selectedIdsRef: RefObject<Set<string>>,
  colsRef: RefObject<number>,
  rowsRef: RefObject<number>,
  setBlocks: (fn: (prev: BlocksMap) => BlocksMap) => void,
) {
  setBlocks((prev) => {
    if (!dragOrigin.current) {
      dragOrigin.current = { ...prev };
    }
    const origin = dragOrigin.current;
    const next = { ...prev };
    for (const id of selectedIdsRef.current) {
      const o = origin[id];
      if (!o) continue;
      next[id] = {
        ...o,
        x: Math.max(0, Math.min(o.x + dx, colsRef.current - o.w)),
        y: Math.max(0, Math.min(o.y + dy, rowsRef.current - o.h)),
      };
    }
    return next;
  });
}

export function handleGroupMoveCommit(dragOrigin: RefObject<BlocksMap | null>) {
  dragOrigin.current = null;
}

// ── Draw ──────────────────────────────────────────────────

export function handleDrawComplete(
  x: number,
  y: number,
  w: number,
  h: number,
  selectedBlock: Block,
  setBlocks: (fn: (prev: BlocksMap) => BlocksMap) => void,
) {
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
      fixture: selectedBlock.fixture ?? null,
    },
  }));
}

// ── Layout Change ─────────────────────────────────────────

export function handleLayoutChange(
  newLayout: Layout,
  isSelectMode: boolean,
  isDrawMode: boolean,
  setBlocks: (fn: (prev: BlocksMap) => BlocksMap) => void,
  allowInDrawMode = false,
) {
  if (isSelectMode) return;
  if (isDrawMode && !allowInDrawMode) return;
  setBlocks((prev) => {
    const next = { ...prev };
    for (const item of newLayout) {
      if (!next[item.i]) continue;
      next[item.i] = { ...next[item.i], x: item.x, y: item.y, w: item.w, h: item.h };
    }
    return next;
  });
}

// ── Grid Resize ───────────────────────────────────────────

export function handleColsChange(
  newCols: number,
  dragOrigin: RefObject<BlocksMap | null>,
  setCOLS: (n: number) => void,
  setSelectedIds: (ids: Set<string>) => void,
  setBlocks: (fn: (prev: BlocksMap) => BlocksMap) => void,
) {
  setCOLS(newCols);
  dragOrigin.current = null;
  setSelectedIds(new Set());
  setBlocks((prev) => {
    const next = { ...prev };
    for (const id in next) {
      const b = next[id];
      next[id] = { ...b, x: Math.min(b.x, newCols - b.w), w: Math.min(b.w, newCols) };
    }
    return next;
  });
}

export function handleRowsChange(
  newRows: number,
  dragOrigin: RefObject<BlocksMap | null>,
  setROWS: (n: number) => void,
  setSelectedIds: (ids: Set<string>) => void,
  setBlocks: (fn: (prev: BlocksMap) => BlocksMap) => void,
) {
  setROWS(newRows);
  dragOrigin.current = null;
  setSelectedIds(new Set());
  setBlocks((prev) => {
    const next = { ...prev };
    for (const id in next) {
      const b = next[id];
      next[id] = { ...b, y: Math.min(b.y, newRows - b.h), h: Math.min(b.h, newRows) };
    }
    return next;
  });
}

// ── Mode Change ───────────────────────────────────────────

export function handleModeChange(
  newMode: Mode,
  dragOrigin: RefObject<BlocksMap | null>,
  setMode: (m: Mode) => void,
  setSelectedIds: (ids: Set<string>) => void,
  setSelectedId: (id: string | null) => void,
) {
  setMode(newMode);
  setSelectedIds(new Set());
  setSelectedId(null);
  dragOrigin.current = null;
}

// ── Form Submit ───────────────────────────────────────────

export function buildSubmitPayload(
  name: string,
  tags: string[],
  description: string,
  rows: number,
  cols: number,
  blocks: BlocksMap,
  userId: string,
  storeId?: string,
): { isEdit: boolean; data: CreateStoreInput & { userId: string } } {
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
    fixture: b.fixture ?? null,
  }));

  const id = storeId ?? crypto.randomUUID();

  return {
    isEdit: !!storeId,
    data: {
      id,
      name,
      userId,
      tags: JSON.stringify(tags),
      description,
      rows,
      cols,
      blocks: blockArr,
    },
  };
}

// ── Keyboard Delete ───────────────────────────────────────

export function handleKeyDown(
  e: KeyboardEvent,
  isSelectMode: boolean,
  selectedIds: Set<string>,
  selectedId: string | null,
  setBlocks: (fn: (prev: BlocksMap) => BlocksMap) => void,
  setSelectedIds: (ids: Set<string>) => void,
  setSelectedId: (id: string | null) => void,
) {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
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
}