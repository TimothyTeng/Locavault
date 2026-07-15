import type { Wall } from "#types/wallTypes";
import { wallJunctions } from "#utils/helpers/wall.helper";

/** Slate stone, thin — the chosen wall style. */
const WALL = "#646e7b";
const WTOP = "#828c99";
const WSH = "#434c57";
const GLASS = "#9cc3df"; // window pane
const SILL = "#b59f80"; // door threshold

/**
 * Renders the edge-based wall layer as a non-interactive SVG overlay placed at the
 * grid's origin. Each segment sits centred on its grid line; a post fills every
 * junction so runs and corners read as one continuous wall. Segments render by
 * `kind`: a solid wall, a `door` (jamb posts + threshold opening), or a `window`
 * (glazed pane with a mullion).
 *
 * Coordinates: pass `cell` for a plain grid (origin 0, square pitch — the store
 * map), OR `originX/originY` + `pitchX/pitchY` to match a `react-grid-layout` grid
 * whose cells are inset by margin/containerPadding (the editor). Grid line `g` is
 * `origin + g * pitch`. `overflow: visible` keeps perimeter walls from clipping.
 */
export function WallLayer({
  walls,
  cols,
  rows,
  cell,
  originX = 0,
  originY = 0,
  pitchX,
  pitchY,
  className,
  solid,
  opacity,
  glow,
  zIndex = 5,
}: {
  walls: Wall[];
  cols: number;
  rows: number;
  cell?: number;
  originX?: number;
  originY?: number;
  pitchX?: number;
  pitchY?: number;
  className?: string;
  /** Render every part in this one colour (draw/erase previews — ignores kind). */
  solid?: string;
  opacity?: number;
  /** Render a fat rounded halo in this colour instead of walls — selection outline. */
  glow?: string;
  zIndex?: number;
}) {
  const px = pitchX ?? cell ?? 0;
  const py = pitchY ?? cell ?? 0;
  if (!walls.length || px <= 0 || py <= 0) return null;

  const T = Math.max(3, Math.round(Math.min(px, py) * 0.15));
  const tt = Math.max(1, Math.round(T * 0.28)); // top highlight
  const ts = Math.max(1, Math.round(T * 0.22)); // bottom shadow
  const body = solid ?? WALL;
  const lineX = (g: number) => originX + g * px;
  const lineY = (g: number) => originY + g * py;
  const r: React.ReactNode[] = [];

  // ── Selection outline: a thin rounded stroke hugging each segment, matching
  //    the block selection ring (per-segment, so a run reads like selected blocks).
  if (glow) {
    const pad = Math.max(2, Math.round(T * 0.55));
    const rOut = T / 2 + pad;
    walls.forEach((w, i) => {
      const isH = w.dir === "h";
      const a0 = isH ? lineX(w.x) : lineY(w.y);
      const len = isH ? px : py;
      const cross = isH ? lineY(w.y) : lineX(w.x);
      r.push(
        <rect
          key={`g${i}`}
          x={(isH ? a0 : cross) - rOut}
          y={(isH ? cross : a0) - rOut}
          width={(isH ? len : 0) + rOut * 2}
          height={(isH ? 0 : len) + rOut * 2}
          rx={rOut}
          ry={rOut}
          fill="none"
          stroke={glow}
          strokeWidth={1.5}
        />,
      );
    });
    const W = lineX(cols) + originX + rOut * 2;
    const H = lineY(rows) + originY + rOut * 2;
    return (
      <svg
        className={className}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
          pointerEvents: "none",
          zIndex,
          opacity,
        }}
      >
        {r}
      </svg>
    );
  }

  // Draw a rect described along the segment's axis (a) and across it (cross).
  const add = (
    key: string,
    isH: boolean,
    a: number,
    aLen: number,
    cross: number,
    cOff: number,
    cSize: number,
    fill: string,
  ) => {
    const x = isH ? a : cross + cOff;
    const y = isH ? cross + cOff : a;
    const w = isH ? aLen : cSize;
    const h = isH ? cSize : aLen;
    if (w <= 0 || h <= 0) return;
    r.push(<rect key={key} x={x} y={y} width={w} height={h} fill={fill} />);
  };

  walls.forEach((w, i) => {
    const isH = w.dir === "h";
    const a0 = isH ? lineX(w.x) : lineY(w.y);
    const len = isH ? px : py;
    const cross = isH ? lineY(w.y) : lineX(w.x);
    const kind = solid ? "wall" : (w.kind ?? "wall");

    if (kind === "door") {
      // Jamb posts at both ends framing an open span with a thin threshold.
      const sillT = Math.max(2, Math.round(T * 0.42));
      add(`dj0${i}`, isH, a0 - T / 2, T, cross, -T / 2, T, body);
      add(`dj1${i}`, isH, a0 + len - T / 2, T, cross, -T / 2, T, body);
      add(`ds${i}`, isH, a0 + T / 2, len - T, cross, -sillT / 2, sillT, SILL);
    } else if (kind === "window") {
      const inset = T * 0.7;
      const gT = Math.max(2, Math.round(T * 0.5));
      add(`wb${i}`, isH, a0, len, cross, -T / 2, T, body); // frame bar
      add(
        `wg${i}`,
        isH,
        a0 + inset,
        len - inset * 2,
        cross,
        -gT / 2,
        gT,
        GLASS,
      );
      add(`wm${i}`, isH, a0 + len / 2 - 1, 2, cross, -gT / 2, gT, body); // mullion
    } else {
      add(`s${i}`, isH, a0, len, cross, -T / 2, T, body);
      if (!solid) {
        add(`t${i}`, isH, a0, len, cross, -T / 2, tt, WTOP);
        add(`b${i}`, isH, a0, len, cross, T / 2 - ts, ts, WSH);
      }
    }
  });

  for (const k of wallJunctions(walls)) {
    const [gx, gy] = k.split(",").map(Number);
    const x = lineX(gx) - T / 2;
    const y = lineY(gy) - T / 2;
    r.push(<rect key={`p${k}`} x={x} y={y} width={T} height={T} fill={body} />);
    if (!solid)
      r.push(
        <rect key={`pt${k}`} x={x} y={y} width={T} height={tt} fill={WTOP} />,
      );
  }

  const W = lineX(cols) + originX + T;
  const H = lineY(rows) + originY + T;

  return (
    <svg
      className={className}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        overflow: "visible",
        pointerEvents: "none",
        zIndex,
        opacity,
      }}
    >
      {r}
    </svg>
  );
}
