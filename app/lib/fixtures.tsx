import { useId } from "react";
import {
  FIXTURE_IDS,
  type FixtureId,
  type FixtureFill,
} from "~/types/fixtureTypes";

export { FIXTURE_IDS };
export type { FixtureId };

/**
 * Recolorable top-down pixel-art fixtures. Each sprite is authored on a 16×16
 * grid of palette keys; the palette is derived from the block's colour so a
 * fixture takes on the user's style (body = colour, outline/shadow/highlight
 * auto-derived; handles stay metal). `FixtureGraphic` renders a sprite across a
 * block of any cols×rows — tiling fixtures repeat per cell, single fixtures sit
 * centred at true 1-cell scale. Nothing ever stretches. See DESIGN.md §5.
 */

const N = 16; // sprite grid is 16×16 "pixels" per cell

// ── Palette: derive a 6-tone ramp from one base colour ─────────────────────
function shade(hex: string, percent: number): string {
  let c = hex.replace("#", "");
  if (c.length === 3)
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Proportional mix toward black (percent<0) or white (percent>0). Unlike a
  // fixed additive offset, this never slams saturated colours into pure black or
  // white, so every derived tone stays in the block's own hue family — a green
  // shelf's outline is a deep green, an amber cabinet's a dark amber. That alone
  // makes the sprites read far less harsh and more cohesive.
  const p = percent / 100;
  const mix = (v: number) =>
    Math.max(
      0,
      Math.min(255, Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p)),
    );
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

type PaletteKey = "o" | "s" | "b" | "h" | "m" | "md" | ".";
function palette(base: string): Record<Exclude<PaletteKey, ".">, string> {
  return {
    o: shade(base, -50), // outline — deep in-hue tone, not black
    s: shade(base, -22), // shadow
    b: base, // body
    h: shade(base, 28), // highlight
    m: "#d0d5d9", // metal (handles) — neutral, not tinted
    md: "#878d93", // metal shadow / wire
  };
}

// ── Tiny pixel-drawing helpers (mutate a grid of palette keys) ─────────────
type Grid = PaletteKey[][];
const newGrid = (w: number = N, h: number = N): Grid =>
  Array.from({ length: h }, () => Array<PaletteKey>(w).fill("."));
const rf = (
  g: Grid,
  x: number,
  y: number,
  w: number,
  h: number,
  k: PaletteKey,
) => {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++)
      if (g[j] && g[j][i] !== undefined) g[j][i] = k;
};
const ro = (
  g: Grid,
  x: number,
  y: number,
  w: number,
  h: number,
  k: PaletteKey,
) => {
  for (let i = x; i < x + w; i++) {
    g[y][i] = k;
    g[y + h - 1][i] = k;
  }
  for (let j = y; j < y + h; j++) {
    g[j][x] = k;
    g[j][x + w - 1] = k;
  }
};
// Filled pixel disc (for basins, burners, washer doors, foliage)
const disc = (g: Grid, cx: number, cy: number, r: number, k: PaletteKey) => {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= r * r && g[y] && g[y][x] !== undefined)
        g[y][x] = k;
    }
};

// ── Sprite authoring ───────────────────────────────────────────────────────
// Builders receive the block's pixel size (W×H). `slice` fixtures draw at the
// full size (one coherent object); the rest ignore it and stay a 16×16 unit.
const SPRITE_BUILDERS: Record<FixtureId, (W?: number, H?: number) => Grid> = {
  shelf(W = N, H = N) {
    // Open shelving: framed back panel with boards that span the full run and
    // repeat down the height. One coherent unit at any width or height.
    const g = newGrid(W, H);
    rf(g, 0, 0, W, H, "b");
    ro(g, 0, 0, W, H, "o");
    rf(g, 1, 1, W - 2, 1, "h");
    for (let y = 6; y < H - 2; y += 7) {
      rf(g, 1, y, W - 2, 1, "h");
      rf(g, 1, y + 1, W - 2, 1, "s");
    }
    return g;
  },
  cabinet(W = N, H = N) {
    // One cabinet: fixed top cornice + base, doors divide the width (~one per
    // cell) each with a handle. A 1×3 block reads as one tall cabinet.
    const g = newGrid(W, H);
    rf(g, 0, 0, W, H, "b");
    ro(g, 0, 0, W, H, "o");
    rf(g, 1, 1, W - 2, 1, "h");
    rf(g, 1, 3, W - 2, 1, "s");
    rf(g, 1, H - 3, W - 2, 2, "s");
    const doors = Math.max(2, Math.round(W / 8));
    const dw = W / doors;
    for (let d = 1; d < doors; d++) rf(g, Math.round(d * dw), 4, 1, H - 7, "o");
    const hLen = Math.max(3, Math.min(5, Math.floor(H * 0.25)));
    const hy = Math.max(5, Math.floor(H * 0.32));
    for (let d = 0; d < doors; d++)
      rf(g, Math.round((d + 0.5) * dw), hy, 1, hLen, "m");
    return g;
  },
  pantry(W = N, H = N) {
    // Tall larder: framed, faint shelves down the height, one door handle.
    const g = newGrid(W, H);
    rf(g, 0, 0, W, H, "b");
    ro(g, 0, 0, W, H, "o");
    rf(g, 1, 1, W - 2, 1, "h");
    rf(g, 1, H - 3, W - 2, 2, "s");
    for (let y = 6; y < H - 3; y += 7) rf(g, 2, y, W - 4, 1, "s");
    rf(g, W - 4, Math.floor(H * 0.42), 1, 4, "m");
    return g;
  },
  drawers(W = N, H = N) {
    // Chest of drawers: one drawer per ~cell of height, each with a centred pull.
    const g = newGrid(W, H);
    rf(g, 0, 0, W, H, "b");
    ro(g, 0, 0, W, H, "o");
    rf(g, 1, 1, W - 2, 1, "h");
    const n = Math.max(2, Math.round(H / 9));
    const dh = H / n;
    for (let d = 1; d < n; d++) rf(g, 1, Math.round(d * dh), W - 2, 1, "o");
    for (let d = 0; d < n; d++)
      rf(g, Math.floor(W / 2) - 2, Math.round((d + 0.5) * dh), 4, 1, "m");
    return g;
  },
  wardrobe(W = N, H = N) {
    // Like the cabinet but with long door handles and a base drawer.
    const g = newGrid(W, H);
    rf(g, 0, 0, W, H, "b");
    ro(g, 0, 0, W, H, "o");
    rf(g, 1, 1, W - 2, 1, "h");
    const doors = Math.max(2, Math.round(W / 9));
    const dw = W / doors;
    for (let d = 1; d < doors; d++) rf(g, Math.round(d * dw), 3, 1, H - 6, "o");
    const hLen = Math.max(4, Math.min(8, Math.floor(H * 0.4)));
    for (let d = 0; d < doors; d++)
      rf(g, Math.round((d + 0.5) * dw), 5, 1, hLen, "m");
    rf(g, 1, H - 4, W - 2, 1, "o");
    rf(g, 1, H - 3, W - 2, 2, "s");
    return g;
  },
  rack(W = N, H = N) {
    // Wire mesh across the whole footprint, with a thin frame.
    const g = newGrid(W, H);
    for (let x = 0; x < W; x += 4) rf(g, x, 0, 1, H, "md");
    for (let y = 0; y < H; y += 4) rf(g, 0, y, W, 1, "md");
    ro(g, 0, 0, W, H, "o");
    return g;
  },
  counter(W = N, H = N) {
    // Counter run: light worktop edge on top, repeating cabinet doors below,
    // fixed end caps from the frame.
    const g = newGrid(W, H);
    rf(g, 0, 0, W, H, "b");
    ro(g, 0, 0, W, H, "o");
    rf(g, 1, 1, W - 2, 2, "h");
    rf(g, 1, 3, W - 2, 1, "o");
    rf(g, 1, H - 2, W - 2, 1, "s");
    const doors = Math.max(2, Math.round(W / 9));
    const dw = W / doors;
    for (let d = 1; d < doors; d++) rf(g, Math.round(d * dw), 4, 1, H - 6, "o");
    const hy = Math.floor((H + 3) / 2);
    for (let d = 0; d < doors; d++)
      rf(g, Math.round((d + 0.5) * dw), hy, 1, 3, "m");
    return g;
  },
  fridge() {
    const g = newGrid();
    rf(g, 3, 1, 10, 14, "b");
    ro(g, 3, 1, 10, 14, "o");
    rf(g, 3, 7, 10, 1, "o");
    rf(g, 4, 2, 8, 1, "h");
    rf(g, 4, 9, 8, 1, "h");
    rf(g, 11, 3, 1, 3, "m");
    rf(g, 11, 9, 1, 3, "m");
    g[15][4] = "o";
    g[15][11] = "o";
    return g;
  },
  freezer() {
    const g = newGrid();
    rf(g, 2, 4, 12, 9, "b");
    ro(g, 2, 4, 12, 9, "o");
    rf(g, 3, 5, 10, 1, "h");
    rf(g, 2, 8, 12, 1, "o");
    rf(g, 7, 4, 2, 1, "m");
    return g;
  },
  bin() {
    const g = newGrid();
    rf(g, 4, 4, 8, 10, "b");
    ro(g, 4, 4, 8, 10, "o");
    rf(g, 4, 7, 8, 1, "o");
    rf(g, 4, 10, 8, 1, "o");
    rf(g, 5, 4, 6, 1, "h");
    g[4][4] = ".";
    g[4][11] = ".";
    g[13][4] = ".";
    g[13][11] = ".";
    return g;
  },
  bookshelf(W = N, H = N) {
    // Framed shelving with a row of book spines tucked above each board.
    const g = newGrid(W, H);
    rf(g, 0, 0, W, H, "b");
    ro(g, 0, 0, W, H, "o");
    rf(g, 1, 1, W - 2, 1, "h");
    let band = 0;
    for (let y = 4; y < H - 3; y += 7) {
      for (let x = 2; x < W - 2; x += 2)
        rf(g, x, y - 2, 1, 3, (x + band) % 2 ? "s" : "md");
      rf(g, 1, y + 1, W - 2, 1, "o");
      band++;
    }
    return g;
  },
  nightstand() {
    const g = newGrid();
    rf(g, 4, 3, 8, 11, "b");
    ro(g, 4, 3, 8, 11, "o");
    rf(g, 5, 4, 6, 1, "h");
    rf(g, 4, 8, 8, 1, "o");
    rf(g, 7, 6, 2, 1, "m");
    rf(g, 7, 11, 2, 1, "m");
    return g;
  },
  table() {
    const g = newGrid();
    rf(g, 2, 2, 12, 12, "b");
    ro(g, 2, 2, 12, 12, "o");
    rf(g, 3, 3, 10, 1, "h");
    rf(g, 2, 2, 2, 2, "s");
    rf(g, 12, 2, 2, 2, "s");
    rf(g, 2, 12, 2, 2, "s");
    rf(g, 12, 12, 2, 2, "s");
    return g;
  },
  desk() {
    const g = newGrid();
    rf(g, 1, 3, 14, 9, "b");
    ro(g, 1, 3, 14, 9, "o");
    rf(g, 2, 4, 12, 1, "h");
    rf(g, 10, 4, 4, 7, "s");
    rf(g, 10, 3, 1, 8, "o");
    rf(g, 10, 6, 4, 1, "o");
    rf(g, 10, 9, 4, 1, "o");
    rf(g, 11, 5, 2, 1, "m");
    return g;
  },
  stove() {
    const g = newGrid();
    rf(g, 2, 2, 12, 12, "b");
    ro(g, 2, 2, 12, 12, "o");
    rf(g, 3, 3, 10, 1, "m");
    [
      [6, 7],
      [11, 7],
      [6, 11],
      [11, 11],
    ].forEach(([cx, cy]) => {
      disc(g, cx, cy, 2.2, "o");
      disc(g, cx, cy, 1.2, "s");
    });
    return g;
  },
  sink() {
    const g = newGrid();
    rf(g, 2, 3, 12, 10, "b");
    ro(g, 2, 3, 12, 10, "o");
    rf(g, 4, 5, 8, 6, "s");
    ro(g, 4, 5, 8, 6, "o");
    rf(g, 7, 3, 2, 1, "m");
    rf(g, 8, 3, 1, 3, "m");
    disc(g, 8, 8, 1, "o");
    return g;
  },
  washer() {
    const g = newGrid();
    rf(g, 2, 2, 12, 12, "b");
    ro(g, 2, 2, 12, 12, "o");
    rf(g, 3, 3, 10, 1, "m");
    disc(g, 8, 9, 4, "o");
    disc(g, 8, 9, 3, "h");
    disc(g, 8, 9, 1.6, "s");
    return g;
  },
  sofa() {
    const g = newGrid();
    rf(g, 1, 2, 14, 4, "b");
    ro(g, 1, 2, 14, 4, "o");
    rf(g, 1, 6, 14, 8, "b");
    ro(g, 1, 6, 14, 8, "o");
    rf(g, 1, 6, 3, 8, "s");
    rf(g, 12, 6, 3, 8, "s");
    rf(g, 5, 7, 3, 5, "h");
    rf(g, 9, 7, 3, 5, "h");
    return g;
  },
  bed() {
    const g = newGrid();
    rf(g, 1, 1, 14, 14, "b");
    ro(g, 1, 1, 14, 14, "o");
    rf(g, 3, 2, 10, 3, "h");
    ro(g, 3, 2, 10, 3, "o");
    rf(g, 2, 8, 12, 1, "s");
    rf(g, 2, 11, 12, 1, "s");
    return g;
  },
  bathtub() {
    const g = newGrid();
    rf(g, 1, 2, 14, 12, "b");
    ro(g, 1, 2, 14, 12, "o");
    rf(g, 3, 4, 10, 8, "s");
    ro(g, 3, 4, 10, 8, "o");
    rf(g, 4, 5, 8, 1, "h");
    rf(g, 7, 2, 2, 1, "m");
    disc(g, 8, 10, 1, "o");
    return g;
  },
  toilet() {
    const g = newGrid();
    rf(g, 5, 2, 6, 3, "b");
    ro(g, 5, 2, 6, 3, "o");
    disc(g, 8, 9, 4, "b");
    disc(g, 8, 9, 4, "o");
    disc(g, 8, 9, 3, "h");
    disc(g, 8, 9, 1.8, "s");
    return g;
  },
  plant() {
    const g = newGrid();
    disc(g, 8, 6, 4, "b");
    disc(g, 6, 6, 2, "h");
    disc(g, 10, 7, 2, "s");
    rf(g, 5, 10, 6, 4, "o");
    rf(g, 6, 11, 4, 2, "s");
    return g;
  },
};

const SPRITES: Record<FixtureId, Grid> = Object.fromEntries(
  FIXTURE_IDS.map((id) => [id, SPRITE_BUILDERS[id](N, N)]),
) as Record<FixtureId, Grid>;

export const FIXTURE_META: Record<
  FixtureId,
  { label: string; defaultColor: string; fill: FixtureFill }
> = {
  shelf: { label: "Shelf", defaultColor: "#2d6b44", fill: "slice" },
  bookshelf: { label: "Bookshelf", defaultColor: "#7a5230", fill: "slice" },
  cabinet: { label: "Cabinet", defaultColor: "#b8821e", fill: "slice" },
  pantry: { label: "Pantry", defaultColor: "#a9761f", fill: "slice" },
  drawers: { label: "Drawers", defaultColor: "#6d7d72", fill: "slice" },
  wardrobe: { label: "Wardrobe", defaultColor: "#8b5cf6", fill: "slice" },
  nightstand: { label: "Nightstand", defaultColor: "#9a7b53", fill: "single" },
  rack: { label: "Rack", defaultColor: "#3a4a3f", fill: "slice" },
  bin: { label: "Bin / box", defaultColor: "#f97316", fill: "single" },
  counter: { label: "Counter", defaultColor: "#9a8f7d", fill: "slice" },
  table: { label: "Table", defaultColor: "#8a6a44", fill: "fit" },
  desk: { label: "Desk", defaultColor: "#7d6747", fill: "fit" },
  fridge: { label: "Fridge", defaultColor: "#4a90b8", fill: "single" },
  freezer: { label: "Freezer", defaultColor: "#6aa0c4", fill: "single" },
  stove: { label: "Stove / oven", defaultColor: "#5f6066", fill: "single" },
  sink: { label: "Sink", defaultColor: "#7fa6b8", fill: "single" },
  washer: { label: "Washer", defaultColor: "#5f6f7a", fill: "single" },
  sofa: { label: "Sofa", defaultColor: "#7d6f86", fill: "fit" },
  bed: { label: "Bed", defaultColor: "#b06a6a", fill: "fit" },
  bathtub: { label: "Bathtub", defaultColor: "#6fa3b0", fill: "fit" },
  toilet: { label: "Toilet", defaultColor: "#8a9097", fill: "single" },
  plant: { label: "Plant", defaultColor: "#3d8a58", fill: "single" },
};

// ── Render ─────────────────────────────────────────────────────────────────
function spriteRects(
  grid: Grid,
  pal: ReturnType<typeof palette>,
  keyPrefix: string,
) {
  const out: React.ReactNode[] = [];
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  // Merge runs of the same colour in a row into one rect — keeps the node count
  // low for large multi-cell (slice) fixtures.
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const k = grid[y][x];
      if (k === ".") {
        x++;
        continue;
      }
      let x2 = x + 1;
      while (x2 < w && grid[y][x2] === k) x2++;
      out.push(
        <rect
          key={`${keyPrefix}-${x}-${y}`}
          x={x}
          y={y}
          width={x2 - x}
          height={1}
          fill={pal[k]}
        />,
      );
      x = x2;
    }
  }
  return out;
}

/**
 * Draw a fixture across a block of `cols`×`rows` cells. The SVG fills its parent
 * (the block element) and uses a viewBox of cols×rows cells (16 px each), so the
 * pixels stay square and crisp at any zoom — tiling fixtures repeat per cell,
 * single fixtures centre one sprite.
 */
export function FixtureGraphic({
  fixture,
  color,
  cols,
  rows,
  className,
  style,
}: {
  fixture: FixtureId;
  color: string;
  cols: number;
  rows: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const uid = useId().replace(/:/g, "");
  const grid = SPRITES[fixture];
  const pal = palette(color);
  const meta = FIXTURE_META[fixture];
  const W = Math.max(1, cols) * N;
  const H = Math.max(1, rows) * N;

  // 9-slice: draw the fixture as one coherent object at the block's full pixel
  // size (fixed caps, stretching/repeating middle). viewBox aspect matches the
  // block (square cells), so preserveAspectRatio="none" never distorts pixels.
  if (meta.fill === "slice") {
    return (
      <svg
        className={className}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        style={style}
        aria-hidden
      >
        {spriteRects(SPRITE_BUILDERS[fixture](W, H), pal, "sl")}
      </svg>
    );
  }

  if (meta.fill === "fit") {
    return (
      <svg
        className={className}
        viewBox={`0 0 ${N} ${N}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges"
        style={style}
        aria-hidden
      >
        {spriteRects(grid, pal, "f")}
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      style={style}
      aria-hidden
    >
      {meta.fill === "tile" ? (
        <>
          <defs>
            <pattern
              id={`fx-${uid}`}
              width={N}
              height={N}
              patternUnits="userSpaceOnUse"
            >
              {spriteRects(grid, pal, "p")}
            </pattern>
          </defs>
          <rect width={W} height={H} fill={`url(#fx-${uid})`} />
        </>
      ) : (
        <g
          transform={`translate(${Math.floor((Math.max(1, cols) - 1) / 2) * N} ${
            Math.floor((Math.max(1, rows) - 1) / 2) * N
          })`}
        >
          {spriteRects(grid, pal, "s")}
        </g>
      )}
    </svg>
  );
}
