import type { BlocksMap } from "#types/storeViewFinderTypes";

// ── Types ─────────────────────────────────────────────────

export type CellPos = { col: number; row: number };
export type HitTarget =
  | "empty"
  | "empty-shift"          // shift+drag from empty → additive rubber band
  | "selected-block"
  | "unselected-block"
  | "unselected-block-shift"; // shift+click/drag block → add to selection

export type GhostRect = { x: number; y: number; w: number; h: number };

// ── Cell Math ─────────────────────────────────────────────

export function pointerToCell(
  e: React.PointerEvent<HTMLDivElement>,
  cellSize: number,
  cols: number,
  rows: number,
): CellPos {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    col: Math.max(0, Math.min(Math.floor((e.clientX - rect.left) / cellSize), cols - 1)),
    row: Math.max(0, Math.min(Math.floor((e.clientY - rect.top) / cellSize), rows - 1)),
  };
}

export function cornersToRect(a: CellPos, b: CellPos): GhostRect {
  return {
    x: Math.min(a.col, b.col),
    y: Math.min(a.row, b.row),
    w: Math.abs(a.col - b.col) + 1,
    h: Math.abs(a.row - b.row) + 1,
  };
}

export function blockAtCell(col: number, row: number, blocks: BlocksMap): string | null {
  for (const [id, b] of Object.entries(blocks)) {
    if (col >= b.x && col < b.x + b.w && row >= b.y && row < b.y + b.h) return id;
  }
  return null;
}

// ── Cursor ────────────────────────────────────────────────

export function resolveCursor(
  drawMode: boolean,
  selectMode: boolean,
  hasMovOrigin: boolean,
  hoveringBlock = false,
): React.CSSProperties["cursor"] {
  if (drawMode) return "crosshair";
  if (selectMode) {
    if (hasMovOrigin) return "grabbing";
    if (hoveringBlock) return "grab";
    return "default";
  }
  return undefined;
}

// ── Block Styling ─────────────────────────────────────────

export function resolveBlockBg(
  borderColor: string,
  baseBg: string,
  isDivider: boolean,
  isMoving: boolean,
  isSelected: boolean,
  isHovered: boolean,
): string {
  if (isDivider) return borderColor;
  if (isMoving) return `${borderColor}77`;
  if (isSelected) return `${borderColor}55`;
  if (isHovered) return `${borderColor}33`;
  return baseBg;
}

export function resolveBlockClasses(
  isSelected: boolean,
  isMoving: boolean,
  isStatic: boolean,
): string {
  return [
    "sgf-block flex items-center justify-center overflow-hidden rounded-sm border",
    isSelected
      ? isMoving
        ? "ring-2 ring-offset-1 ring-slate-500 shadow-lg"
        : "ring-2 ring-offset-1 ring-slate-700 shadow-md"
      : "",
    isStatic ? "sgf-block-static" : "",
    isMoving ? "transition-none" : "transition-shadow",
  ]
    .filter(Boolean)
    .join(" ");
}

// ── Ghost Overlay ─────────────────────────────────────────

export function resolveGhostStyle(
  ghostRect: GhostRect,
  cellSize: number,
  selectMode: boolean,
  additive = false,
): React.CSSProperties {
  return {
    left: ghostRect.x * cellSize + 1,
    top: ghostRect.y * cellSize + 1,
    width: ghostRect.w * cellSize - 2,
    height: ghostRect.h * cellSize - 2,
    background: additive
      ? "rgba(16,185,129,0.08)"
      : selectMode
        ? "rgba(71,85,105,0.06)"
        : "rgba(30,41,59,0.08)",
    borderColor: additive ? "#10b981" : selectMode ? "#94a3b8" : "#475569",
  };
}