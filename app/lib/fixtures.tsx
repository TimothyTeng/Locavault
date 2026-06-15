import { useId } from "react";
import { FIXTURE_IDS, type FixtureId, type FixtureFill } from "~/types/fixtureTypes";

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
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const a = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (percent / 100) * 255)));
  return `rgb(${a(r)}, ${a(g)}, ${a(b)})`;
}

type PaletteKey = "o" | "s" | "b" | "h" | "m" | "md" | ".";
function palette(base: string): Record<Exclude<PaletteKey, ".">, string> {
  return {
    o: shade(base, -55), // outline
    s: shade(base, -26), // shadow
    b: base, // body
    h: shade(base, 30), // highlight
    m: "#d0d5d9", // metal (handles) — neutral, not tinted
    md: "#878d93", // metal shadow / wire
  };
}

// ── Tiny pixel-drawing helpers (mutate a grid of palette keys) ─────────────
type Grid = PaletteKey[][];
const newGrid = (): Grid =>
  Array.from({ length: N }, () => Array<PaletteKey>(N).fill("."));
const rf = (g: Grid, x: number, y: number, w: number, h: number, k: PaletteKey) => {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = k;
};
const ro = (g: Grid, x: number, y: number, w: number, h: number, k: PaletteKey) => {
  for (let i = x; i < x + w; i++) {
    g[y][i] = k;
    g[y + h - 1][i] = k;
  }
  for (let j = y; j < y + h; j++) {
    g[j][x] = k;
    g[j][x + w - 1] = k;
  }
};
// Recessed panel bevel (shadow top-left, highlight bottom-right)
const bIn = (g: Grid, x: number, y: number, w: number, h: number) => {
  rf(g, x, y, w, 1, "s");
  rf(g, x, y, 1, h, "s");
  rf(g, x + w - 1, y, 1, h, "h");
  rf(g, x, y + h - 1, w, 1, "h");
};
// Filled pixel disc (for basins, burners, washer doors, foliage)
const disc = (g: Grid, cx: number, cy: number, r: number, k: PaletteKey) => {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= r * r && g[y] && g[y][x] !== undefined) g[y][x] = k;
    }
};

// ── Sprite authoring ───────────────────────────────────────────────────────
const SPRITE_BUILDERS: Record<FixtureId, () => Grid> = {
  shelf() {
    const g = newGrid();
    rf(g, 0, 0, 16, 16, "b");
    [1, 7, 13].forEach((y) => {
      rf(g, 0, y, 16, 1, "h");
      rf(g, 0, y + 1, 16, 1, "o");
    });
    return g;
  },
  cabinet() {
    const g = newGrid();
    rf(g, 0, 0, 16, 3, "b");
    rf(g, 0, 0, 16, 1, "h");
    rf(g, 0, 2, 16, 1, "o");
    rf(g, 0, 3, 16, 13, "b");
    rf(g, 8, 3, 1, 12, "o");
    bIn(g, 1, 5, 6, 9);
    bIn(g, 9, 5, 6, 9);
    rf(g, 6, 9, 1, 2, "m");
    rf(g, 9, 9, 1, 2, "m");
    rf(g, 0, 15, 16, 1, "s");
    return g;
  },
  pantry() {
    const g = newGrid();
    rf(g, 0, 0, 16, 16, "b");
    rf(g, 0, 0, 16, 1, "h");
    rf(g, 0, 15, 16, 1, "s");
    rf(g, 8, 1, 1, 14, "o");
    [3, 7, 11].forEach((y) => rf(g, 1, y, 14, 1, "s"));
    rf(g, 6, 8, 1, 2, "m");
    rf(g, 9, 8, 1, 2, "m");
    return g;
  },
  drawers() {
    const g = newGrid();
    rf(g, 0, 1, 16, 14, "b");
    rf(g, 0, 1, 16, 1, "h");
    rf(g, 0, 6, 16, 1, "o");
    rf(g, 0, 11, 16, 1, "o");
    rf(g, 6, 3, 4, 1, "m");
    rf(g, 6, 8, 4, 1, "m");
    rf(g, 6, 13, 4, 1, "m");
    rf(g, 0, 15, 16, 1, "s");
    return g;
  },
  wardrobe() {
    const g = newGrid();
    rf(g, 0, 0, 16, 16, "b");
    rf(g, 0, 0, 16, 1, "h");
    rf(g, 0, 15, 16, 1, "s");
    rf(g, 8, 1, 1, 14, "o");
    bIn(g, 1, 2, 6, 12);
    bIn(g, 9, 2, 6, 12);
    rf(g, 6, 7, 1, 2, "m");
    rf(g, 9, 7, 1, 2, "m");
    return g;
  },
  rack() {
    const g = newGrid();
    [0, 4, 8, 12].forEach((x) => rf(g, x, 0, 1, 16, "md"));
    [0, 4, 8, 12].forEach((y) => rf(g, 0, y, 16, 1, "md"));
    return g;
  },
  counter() {
    const g = newGrid();
    rf(g, 0, 0, 16, 3, "h");
    rf(g, 0, 3, 16, 1, "o");
    rf(g, 0, 4, 16, 12, "b");
    bIn(g, 2, 6, 12, 8);
    rf(g, 7, 8, 2, 1, "m");
    rf(g, 0, 15, 16, 1, "s");
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
  bookshelf() {
    const g = newGrid();
    rf(g, 0, 0, 16, 16, "b");
    [1, 7, 13].forEach((y) => {
      rf(g, 0, y, 16, 1, "h");
      rf(g, 0, y + 1, 16, 1, "o");
    });
    // book spines between the boards
    [1, 3, 5, 7, 9, 11, 13].forEach((x, i) =>
      rf(g, x, 3, 1, 3, i % 2 ? "s" : "md"),
    );
    [2, 4, 6, 8, 10, 12, 14].forEach((x, i) =>
      rf(g, x, 9, 1, 3, i % 2 ? "md" : "s"),
    );
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
  FIXTURE_IDS.map((id) => [id, SPRITE_BUILDERS[id]()]),
) as Record<FixtureId, Grid>;

export const FIXTURE_META: Record<
  FixtureId,
  { label: string; defaultColor: string; fill: FixtureFill }
> = {
  shelf: { label: "Shelf", defaultColor: "#2d6b44", fill: "tile" },
  bookshelf: { label: "Bookshelf", defaultColor: "#7a5230", fill: "tile" },
  cabinet: { label: "Cabinet", defaultColor: "#b8821e", fill: "tile" },
  pantry: { label: "Pantry", defaultColor: "#a9761f", fill: "tile" },
  drawers: { label: "Drawers", defaultColor: "#6d7d72", fill: "tile" },
  wardrobe: { label: "Wardrobe", defaultColor: "#8b5cf6", fill: "tile" },
  nightstand: { label: "Nightstand", defaultColor: "#9a7b53", fill: "single" },
  rack: { label: "Rack", defaultColor: "#3a4a3f", fill: "tile" },
  bin: { label: "Bin / box", defaultColor: "#f97316", fill: "single" },
  counter: { label: "Counter", defaultColor: "#9a8f7d", fill: "tile" },
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
function spriteRects(grid: Grid, pal: ReturnType<typeof palette>, keyPrefix: string) {
  const out: React.ReactNode[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const k = grid[y][x];
      if (k === ".") continue;
      out.push(
        <rect
          key={`${keyPrefix}-${x}-${y}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={pal[k]}
        />,
      );
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
