/**
 * Single source of truth for the floor-plan grid dimensions. Previously the
 * builder UI clamped to 2–80 while the loaders validated 1–200 with a default of
 * 10 — three places, three different bounds. Both the client controls and the
 * server-side `toQty` validation now import these.
 */
export const GRID_MIN = 2;
export const GRID_MAX = 80;
export const GRID_DEFAULT = 10;

export const GRID_PRESETS: { label: string; cols: number; rows: number }[] = [
  { label: "10×10", cols: 10, rows: 10 },
  { label: "15×15", cols: 15, rows: 15 },
  { label: "20×20", cols: 20, rows: 20 },
  { label: "30×30", cols: 30, rows: 30 },
  { label: "40×60", cols: 40, rows: 60 },
];

/** Clamp a grid dimension into range, falling back to the default for junk. */
export function clampGridDim(v: number): number {
  const n = Math.round(v);
  if (!Number.isFinite(n)) return GRID_DEFAULT;
  return Math.max(GRID_MIN, Math.min(GRID_MAX, n));
}
