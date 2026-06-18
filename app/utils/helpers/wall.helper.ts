import type { Wall, WallKind } from "#types/wallTypes";

type Edge = { dir: "h" | "v"; x: number; y: number };

/**
 * Pure geometry for the edge-based wall layer (see `wallTypes.ts`). Everything
 * works in *fractional cell coordinates* (pixels ÷ cell size) so it's unit- and
 * zoom-agnostic and testable without a DOM.
 */

export const wallKey = (w: Wall) => `${w.dir}:${w.x}:${w.y}`;

export function parseWallKey(k: string): Wall {
  const [dir, x, y] = k.split(":");
  return { dir: dir === "v" ? "v" : "h", x: Number(x), y: Number(y) };
}

/** Nearest grid intersection to fractional cell coords, clamped to the grid. */
export function pointAtCell(
  fx: number,
  fy: number,
  cols: number,
  rows: number,
): [number, number] {
  return [
    Math.max(0, Math.min(cols, Math.round(fx))),
    Math.max(0, Math.min(rows, Math.round(fy))),
  ];
}

/** Nearest unit edge to fractional cell coords, or null if outside the grid. */
export function edgeAtCell(
  fx: number,
  fy: number,
  cols: number,
  rows: number,
): Wall | null {
  if (fx < -0.4 || fy < -0.4 || fx > cols + 0.4 || fy > rows + 0.4) return null;
  const dh = Math.abs(fy - Math.round(fy)); // distance to nearest horizontal line
  const dv = Math.abs(fx - Math.round(fx)); // distance to nearest vertical line
  if (dh <= dv) {
    const y = Math.round(fy);
    const x = Math.floor(fx);
    if (x < 0 || x >= cols || y < 0 || y > rows) return null;
    return { dir: "h", x, y };
  }
  const x = Math.round(fx);
  const y = Math.floor(fy);
  if (y < 0 || y >= rows || x < 0 || x > cols) return null;
  return { dir: "v", x, y };
}

/**
 * Straight, axis-locked run of unit edges between two grid points — locks to the
 * dominant drag axis (Clash-of-Clans style). Empty if the points coincide.
 */
export function wallRun(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Wall[] {
  if (ax === bx && ay === by) return [];
  const out: Wall[] = [];
  if (Math.abs(bx - ax) >= Math.abs(by - ay)) {
    for (let x = Math.min(ax, bx); x < Math.max(ax, bx); x++)
      out.push({ dir: "h", x, y: ay });
  } else {
    for (let y = Math.min(ay, by); y < Math.max(ay, by); y++)
      out.push({ dir: "v", x: ax, y });
  }
  return out;
}

/** The two grid points a wall segment connects. */
export function wallEnds(w: Wall): [number, number][] {
  return w.dir === "h"
    ? [
        [w.x, w.y],
        [w.x + 1, w.y],
      ]
    : [
        [w.x, w.y],
        [w.x, w.y + 1],
      ];
}

/** Grid points ("x,y") where ≥2 segments meet — drawn as connecting corner posts. */
export function wallJunctions(walls: Wall[]): string[] {
  const deg: Record<string, number> = {};
  for (const w of walls)
    for (const [x, y] of wallEnds(w)) {
      const k = `${x},${y}`;
      deg[k] = (deg[k] ?? 0) + 1;
    }
  return Object.keys(deg).filter((k) => deg[k] >= 2);
}

// ── set ops (keyed by edge, ignoring kind) ─────────────────
export const hasWall = (walls: Wall[], w: Edge) =>
  walls.some((x) => x.dir === w.dir && x.x === w.x && x.y === w.y);

/** The segment occupying an edge (whatever its kind), or undefined. */
export const wallAt = (walls: Wall[], w: Edge): Wall | undefined =>
  walls.find((x) => x.dir === w.dir && x.x === w.x && x.y === w.y);

/** A segment for an edge, tagged with `kind` (omitting kind for plain walls). */
export const withKind = (e: Edge, kind: WallKind): Wall =>
  kind === "wall"
    ? { dir: e.dir, x: e.x, y: e.y }
    : { dir: e.dir, x: e.x, y: e.y, kind };

/** Place/replace segments at their edges (drawing a door over a wall converts it). */
export function upsertWalls(walls: Wall[], items: Wall[]): Wall[] {
  const keys = new Set(items.map(wallKey));
  return [...walls.filter((w) => !keys.has(wallKey(w))), ...items];
}

export function removeWalls(walls: Wall[], rm: Edge[]): Wall[] {
  const kill = new Set(rm.map((e) => `${e.dir}:${e.x}:${e.y}`));
  return walls.filter((w) => !kill.has(wallKey(w)));
}

// ── group move (carry walls along with a block selection) ───
const clampInt = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(v, hi));

/** A grid-line rectangle (a selection's bounding box). */
export type WallBounds = { x0: number; y0: number; x1: number; y1: number };

/** True if the edge borders at least one cell in `cells` (keys "cx,cy"). */
export function wallTouchesCells(w: Wall, cells: Set<string>): boolean {
  return w.dir === "h"
    ? cells.has(`${w.x},${w.y - 1}`) || cells.has(`${w.x},${w.y}`)
    : cells.has(`${w.x - 1},${w.y}`) || cells.has(`${w.x},${w.y}`);
}

/** True if both endpoints of the segment lie within (or on) the bounds rect. */
export function wallInBounds(w: Wall, b: WallBounds): boolean {
  return w.dir === "h"
    ? w.x >= b.x0 && w.x + 1 <= b.x1 && w.y >= b.y0 && w.y <= b.y1
    : w.x >= b.x0 && w.x <= b.x1 && w.y >= b.y0 && w.y + 1 <= b.y1;
}

/** Translate a wall by (dx,dy) whole cells, clamped into the grid. */
export function offsetWall(
  w: Wall,
  dx: number,
  dy: number,
  cols: number,
  rows: number,
): Wall {
  return w.dir === "h"
    ? {
        ...w,
        x: clampInt(w.x + dx, 0, cols - 1),
        y: clampInt(w.y + dy, 0, rows),
      }
    : {
        ...w,
        x: clampInt(w.x + dx, 0, cols),
        y: clampInt(w.y + dy, 0, rows - 1),
      };
}

/**
 * The keys of the walls a selection covers: every wall inside the selected blocks'
 * bounding box (`bounds`), unioned with any explicitly-selected wall keys (`extra`,
 * e.g. a wall clicked or boxed on its own). Drives both the selection outline and
 * which walls a group move carries.
 */
export function effectiveWallKeys(
  walls: Wall[],
  bounds: WallBounds | null,
  extra: Set<string> = new Set(),
): Set<string> {
  const keys = new Set(extra);
  if (bounds)
    for (const w of walls) if (wallInBounds(w, bounds)) keys.add(wallKey(w));
  return keys;
}

/**
 * Relocate the walls whose key is in `keys` by (dx,dy); the rest stay put. A moved
 * wall that lands on a stationary edge wins (replaces it). Returns the input array
 * unchanged (same reference) when nothing moves, so the caller can skip a needless
 * state update.
 */
export function moveWalls(
  origin: Wall[],
  keys: Set<string>,
  dx: number,
  dy: number,
  cols: number,
  rows: number,
): Wall[] {
  if (keys.size === 0 || (dx === 0 && dy === 0)) return origin;
  if (!origin.some((w) => keys.has(wallKey(w)))) return origin;
  const out = new Map<string, Wall>();
  for (const w of origin) if (!keys.has(wallKey(w))) out.set(wallKey(w), w);
  for (const w of origin)
    if (keys.has(wallKey(w))) {
      const m = offsetWall(w, dx, dy, cols, rows);
      out.set(wallKey(m), m); // moved overrides a stationary edge at the same key
    }
  return [...out.values()];
}

// ── persistence ────────────────────────────────────────────
export const serializeWalls = (walls: Wall[]): string =>
  JSON.stringify(
    walls.map((w) =>
      w.kind && w.kind !== "wall"
        ? { x: w.x, y: w.y, dir: w.dir, kind: w.kind }
        : { x: w.x, y: w.y, dir: w.dir },
    ),
  );

/** Parse + validate the stored walls JSON into a clean, deduped list. */
export function parseWalls(json: string | null | undefined): Wall[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Wall[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { x, y, dir, kind } = r as Record<string, unknown>;
    if (
      (dir === "h" || dir === "v") &&
      Number.isFinite(x) &&
      Number.isFinite(y)
    ) {
      const w: Wall = {
        x: x as number,
        y: y as number,
        dir,
        ...(kind === "door" || kind === "window" ? { kind } : {}),
      };
      const k = wallKey(w);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(w);
      }
    }
  }
  return out;
}
