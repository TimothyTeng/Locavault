import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  FIXTURE_IDS,
  type FixtureId,
  type FixtureFill,
  type FixtureCategory,
} from "~/types/fixtureTypes";
import {
  isCustomFixtureRef,
  type CustomFixture,
  type CustomShape,
  type FixtureRef,
} from "~/types/customFixtureTypes";

export { FIXTURE_IDS };
export type { FixtureId };

/**
 * Top-down **vector** fixtures. Each fixture is drawn from primitives (rects /
 * lines / circles) parameterised by the block's pixel size, then tinted by the
 * block's colour. Because the art is recomputed at the target size — fixed
 * structure (frames, posts, arms) plus a *modest, size-keyed* count of repeating
 * parts (shelves, doors, cushions) — a big block reads as ONE coherent object
 * instead of a field of duplicated tiles. Nothing is a bitmap, so it stays crisp
 * at any zoom. `FixtureGraphic` renders a fixture across a block of cols×rows.
 * See DESIGN.md §5.
 */

const N = 16; // grid unit: one cell is 16 viewBox px
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
// Deterministic 0..1 "noise" so shelf/bookshelf contents vary per slot without
// Math.random (stable across renders → no flicker, and varied → not tiled).
const hash = (n: number) => ((Math.imul(n, 2654435761) >>> 0) % 1000) / 1000;

// ── Palette: derive a small in-hue tone set from one base colour ────────────
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
  // Proportional mix toward black (percent<0) or white (percent>0) so derived
  // tones stay in the block's own hue family (a green shelf's outline is a deep
  // green, not black) — keeps fixtures cohesive and never harsh.
  const p = percent / 100;
  const mix = (v: number) =>
    Math.max(
      0,
      Math.min(255, Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p)),
    );
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

type Tones = { st: string; body: string; light: string; mid: string };
function tones(color: string): Tones {
  return {
    st: shade(color, -42), // primary stroke / outline (deep in-hue)
    body: color, // body fill (used at low opacity)
    light: shade(color, 28), // highlight: cushions, pillows, worktop
    mid: shade(color, -12), // muted contents (boxes, books)
  };
}

// ── Primitive DSL ───────────────────────────────────────────────────────────
type RectP = {
  k: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
  fill?: string;
  fo?: number;
  stroke?: string;
  sw?: number;
  so?: number;
};
type LineP = {
  k: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  sw: number;
  so?: number;
  cap?: boolean;
};
type CircP = {
  k: "circle";
  cx: number;
  cy: number;
  r: number;
  fill?: string;
  fo?: number;
  stroke?: string;
  sw?: number;
  so?: number;
};
type Prim = RectP | LineP | CircP;

const R = (
  x: number,
  y: number,
  w: number,
  h: number,
  o: Omit<RectP, "k" | "x" | "y" | "w" | "h"> = {},
): RectP => ({ k: "rect", x, y, w, h, ...o });
const L = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  o: Omit<LineP, "k" | "x1" | "y1" | "x2" | "y2">,
): LineP => ({ k: "line", x1, y1, x2, y2, ...o });
const C = (
  cx: number,
  cy: number,
  r: number,
  o: Omit<CircP, "k" | "cx" | "cy" | "r"> = {},
): CircP => ({ k: "circle", cx, cy, r, ...o });

// Outer body frame shared by most fixtures.
const FR = (W: number, H: number, t: Tones, rxF = 0.08): RectP =>
  R(1.5, 1.5, W - 3, H - 3, {
    rx: Math.min(W, H) * rxF,
    fill: t.body,
    fo: 0.13,
    stroke: t.st,
    sw: 1.8,
  });

// ── Fixture builders: (W, H, tones) → primitives ────────────────────────────
const BUILDERS: Record<FixtureId, (W: number, H: number, t: Tones) => Prim[]> =
  {
    // — Storage (size-aware, stretch) —
    shelf(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.06)];
      const m = 4.5,
        ix = m,
        iy = m,
        iw = W - 2 * m,
        ih = H - 2 * m;
      const cols = clamp(Math.round(W / 22), 1, 4);
      const rows = clamp(Math.round(H / 22), 1, 4);
      const cw = iw / cols,
        ch = ih / rows;
      for (let c = 1; c < cols; c++) {
        const x = ix + c * cw;
        p.push(L(x, iy, x, iy + ih, { stroke: t.st, sw: 1, so: 0.8 }));
      }
      for (let r = 1; r < rows; r++) {
        const y = iy + r * ch;
        p.push(L(ix, y, ix + iw, y, { stroke: t.st, sw: 1.4 }));
      }
      let idx = 0;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const h1 = hash(idx * 3 + 1),
            h2 = hash(idx * 3 + 2),
            h3 = hash(idx * 3 + 5);
          idx++;
          if (h1 < 0.28) continue; // some cubbies left empty
          const cx0 = ix + c * cw + cw * 0.16,
            cwi = cw * 0.68,
            cy0 = iy + r * ch + ch * 0.16,
            chi = ch * 0.68;
          if (h2 < 0.5) {
            p.push(
              R(cx0, cy0 + chi * 0.32, cwi, chi * 0.68, {
                rx: 0.8,
                fill: t.mid,
                fo: 0.5,
              }),
            );
          } else {
            const nb = 2 + Math.floor(h3 * 2),
              bw = cwi / nb;
            for (let b = 0; b < nb; b++) {
              const bh = chi * (0.5 + hash(idx * 7 + b) * 0.45);
              p.push(
                R(cx0 + b * bw + 0.4, cy0 + chi - bh, bw - 0.8, bh, {
                  rx: 0.4,
                  fill: b % 2 ? t.mid : t.light,
                  fo: 0.6,
                }),
              );
            }
          }
        }
      return p;
    },
    bookshelf(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.05)];
      const m = 4,
        ix = m,
        iy = m,
        iw = W - 2 * m,
        ih = H - 2 * m;
      const rows = clamp(Math.round(H / 16), 2, 5);
      const ch = ih / rows;
      for (let r = 1; r < rows; r++)
        p.push(
          L(ix, iy + r * ch, ix + iw, iy + r * ch, { stroke: t.st, sw: 1.3 }),
        );
      // Packed book spines of varied width / height / tone on each shelf.
      for (let r = 0; r < rows; r++) {
        const y0 = iy + r * ch,
          sh = ch;
        let x = ix + 0.8,
          bi = r * 7;
        while (x < ix + iw - 1.5) {
          const bw = 1.6 + hash(bi * 5 + 1) * 2.4;
          const bh = sh * (0.6 + hash(bi * 5 + 2) * 0.34);
          const tone = bi % 3 === 0 ? t.light : bi % 3 === 1 ? t.mid : t.st;
          p.push(
            R(x, y0 + sh - bh - 0.3, Math.min(bw, ix + iw - 1 - x), bh, {
              rx: 0.3,
              fill: tone,
              fo: 0.55,
            }),
          );
          x += bw + 0.5;
          bi++;
        }
      }
      return p;
    },
    cabinet(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.1)];
      p.push(L(5, 5.5, W - 5, 5.5, { stroke: t.st, sw: 0.9, so: 0.5 }));
      p.push(L(5, H - 5.5, W - 5, H - 5.5, { stroke: t.st, sw: 0.9, so: 0.5 }));
      const doors = clamp(Math.round(W / 26), 1, 3),
        dw = (W - 8) / doors;
      for (let d = 0; d < doors; d++) {
        const x0 = 4 + d * dw;
        p.push(
          R(x0 + 1.5, 8, dw - 3, H - 16, {
            rx: 2,
            fill: t.body,
            fo: 0.09,
            stroke: t.st,
            sw: 1.1,
          }),
        );
        const hx = d < doors / 2 ? x0 + dw - 3.5 : x0 + 3.5;
        p.push(
          L(hx, H / 2 - 3.5, hx, H / 2 + 3.5, {
            stroke: t.st,
            sw: 2.1,
            cap: true,
          }),
        );
      }
      return p;
    },
    pantry(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.08)];
      const doors = clamp(Math.round(W / 30), 1, 2),
        dw = (W - 6) / doors;
      for (let d = 0; d < doors; d++) {
        const x0 = 3 + d * dw;
        p.push(
          R(x0 + 1, 5, dw - 2, H - 10, {
            rx: 1.5,
            fill: t.body,
            fo: 0.07,
            stroke: t.st,
            sw: 1,
          }),
        );
        const sh = clamp(Math.round(H / 14), 2, 5),
          ih = H - 12,
          ch = ih / sh;
        for (let s = 1; s < sh; s++)
          p.push(
            L(x0 + 2.5, 6 + s * ch, x0 + dw - 2.5, 6 + s * ch, {
              stroke: t.st,
              sw: 0.7,
              so: 0.45,
            }),
          );
        const hx = d < doors / 2 ? x0 + dw - 3 : x0 + 3;
        p.push(
          L(hx, H * 0.42, hx, H * 0.58, { stroke: t.st, sw: 1.8, cap: true }),
        );
      }
      return p;
    },
    drawers(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.08)];
      const n = clamp(Math.round(H / 15), 2, 5),
        dh = (H - 4) / n;
      for (let d = 0; d < n; d++) {
        const y0 = 2 + d * dh;
        p.push(
          R(3, y0 + 1, W - 6, dh - 2, {
            rx: 1.5,
            fill: t.body,
            fo: 0.08,
            stroke: t.st,
            sw: 1,
          }),
        );
        p.push(
          L(W / 2 - 3.5, y0 + dh / 2, W / 2 + 3.5, y0 + dh / 2, {
            stroke: t.st,
            sw: 1.8,
            cap: true,
          }),
        );
      }
      return p;
    },
    wardrobe(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.08)];
      const doors = clamp(Math.round(W / 24), 2, 3),
        dw = (W - 6) / doors;
      for (let d = 0; d < doors; d++) {
        const x0 = 3 + d * dw;
        p.push(
          R(x0 + 1, 4, dw - 2, H - 8, {
            rx: 1.5,
            fill: t.body,
            fo: 0.08,
            stroke: t.st,
            sw: 1,
          }),
        );
        const hx = d < doors / 2 ? x0 + dw - 3 : x0 + 3;
        p.push(
          L(hx, H * 0.3, hx, H * 0.7, { stroke: t.st, sw: 1.8, cap: true }),
        );
      }
      return p;
    },
    rack(W, H, t) {
      const p: Prim[] = [
        R(1.5, 1.5, W - 3, H - 3, {
          rx: 2,
          fill: "none",
          stroke: t.st,
          sw: 1.6,
        }),
      ];
      const gx = clamp(Math.round(W / 8), 2, 8),
        gy = clamp(Math.round(H / 8), 2, 8);
      for (let i = 1; i < gx; i++) {
        const x = 1.5 + (i * (W - 3)) / gx;
        p.push(L(x, 2, x, H - 2, { stroke: t.st, sw: 0.7, so: 0.55 }));
      }
      for (let j = 1; j < gy; j++) {
        const y = 1.5 + (j * (H - 3)) / gy;
        p.push(L(2, y, W - 2, y, { stroke: t.st, sw: 0.7, so: 0.55 }));
      }
      return p;
    },
    counter(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.05)];
      const wb = Math.max(3, H * 0.22);
      p.push(
        R(2.5, 2.5, W - 5, wb, {
          rx: 1.5,
          fill: t.light,
          fo: 0.3,
          stroke: t.st,
          sw: 1,
        }),
      );
      const by = 2.5 + wb + 1;
      const doors = clamp(Math.round(W / 22), 1, 4),
        dw = (W - 6) / doors;
      for (let d = 0; d < doors; d++) {
        const x0 = 3 + d * dw;
        p.push(
          R(x0 + 1, by, dw - 2, H - by - 3, {
            rx: 1.5,
            fill: t.body,
            fo: 0.08,
            stroke: t.st,
            sw: 1,
          }),
        );
        p.push(
          L(
            x0 + dw / 2,
            by + 2,
            x0 + dw / 2,
            by + 2 + Math.min(4, (H - by) * 0.3),
            {
              stroke: t.st,
              sw: 1.5,
              cap: true,
            },
          ),
        );
      }
      return p;
    },

    // — Surfaces / furniture (fill the footprint) —
    table(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.1)];
      p.push(
        R(W * 0.12, H * 0.12, W * 0.76, H * 0.76, {
          rx: Math.min(W, H) * 0.06,
          fill: "none",
          stroke: t.st,
          sw: 0.9,
          so: 0.5,
        }),
      );
      const lr = Math.max(1.2, Math.min(W, H) * 0.06);
      (
        [
          [W * 0.14, H * 0.14],
          [W * 0.86, H * 0.14],
          [W * 0.14, H * 0.86],
          [W * 0.86, H * 0.86],
        ] as const
      ).forEach(([cx, cy]) => p.push(C(cx, cy, lr, { fill: t.st, fo: 0.6 })));
      return p;
    },
    desk(W, H, t) {
      // A desk reads as a table (inset top + corner legs) with a drawer pedestal
      // down one side — same family as `table`, just with the pedestal added.
      const p: Prim[] = [FR(W, H, t, 0.1)];
      p.push(
        R(W * 0.1, H * 0.12, W * 0.8, H * 0.76, {
          rx: Math.min(W, H) * 0.05,
          fill: "none",
          stroke: t.st,
          sw: 0.9,
          so: 0.5,
        }),
      );
      // Drawer pedestal on the right.
      const pw = W * 0.26,
        px = W * 0.88 - pw,
        py = H * 0.16,
        ph = H * 0.68;
      p.push(
        R(px, py, pw, ph, {
          rx: 1.5,
          fill: t.body,
          fo: 0.12,
          stroke: t.st,
          sw: 1,
        }),
      );
      const n = 2,
        dh = ph / n,
        cx = px + pw / 2;
      for (let d = 0; d < n; d++) {
        const y0 = py + d * dh;
        if (d > 0)
          p.push(L(px, y0, px + pw, y0, { stroke: t.st, sw: 0.8, so: 0.7 }));
        p.push(
          L(cx - 2, y0 + dh / 2, cx + 2, y0 + dh / 2, {
            stroke: t.st,
            sw: 1.3,
            cap: true,
          }),
        );
      }
      // Corner legs on the open (left) side, matching the table.
      const lr = Math.max(1.2, Math.min(W, H) * 0.055);
      (
        [
          [W * 0.13, H * 0.15],
          [W * 0.13, H * 0.85],
        ] as const
      ).forEach(([x, y]) => p.push(C(x, y, lr, { fill: t.st, fo: 0.6 })));
      return p;
    },
    sofa(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.14)];
      const aw = Math.max(5, W * 0.14),
        bh = Math.max(5, H * 0.22);
      p.push(
        R(3, 3, W - 6, bh, {
          rx: 3,
          fill: t.body,
          fo: 0.18,
          stroke: t.st,
          sw: 1,
        }),
      );
      const ay = 3 + bh - 1;
      p.push(
        R(3, ay, aw, H - ay - 3, {
          rx: 3,
          fill: t.body,
          fo: 0.18,
          stroke: t.st,
          sw: 1,
        }),
      );
      p.push(
        R(W - 3 - aw, ay, aw, H - ay - 3, {
          rx: 3,
          fill: t.body,
          fo: 0.18,
          stroke: t.st,
          sw: 1,
        }),
      );
      const sx = 3 + aw,
        sw = W - 3 - aw - sx,
        sy = ay + 1,
        sh = H - 3 - sy - 1;
      if (sw > 3 && sh > 3) {
        p.push(
          R(sx, sy, sw, sh, {
            rx: 2.5,
            fill: t.light,
            fo: 0.4,
            stroke: t.st,
            sw: 1,
          }),
        );
        const n = clamp(Math.round(sw / 18), 1, 4);
        for (let i = 1; i < n; i++) {
          const x = sx + (i * sw) / n;
          p.push(
            L(x, sy + 1.5, x, sy + sh - 1.5, {
              stroke: t.st,
              sw: 0.9,
              so: 0.65,
            }),
          );
        }
      }
      return p;
    },
    bed(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.08)];
      const pw = (W - 3) / 2 - 4.5,
        ph = H * 0.22;
      p.push(
        R(4.5, 4.5, pw, ph, {
          rx: 2.5,
          fill: t.light,
          fo: 0.5,
          stroke: t.st,
          sw: 0.9,
        }),
      );
      p.push(
        R(4.5 + pw + 2, 4.5, pw, ph, {
          rx: 2.5,
          fill: t.light,
          fo: 0.5,
          stroke: t.st,
          sw: 0.9,
        }),
      );
      const dy = 4.5 + ph + 5;
      p.push(L(3, dy, W - 4, dy, { stroke: t.st, sw: 1.4 }));
      p.push(
        L(W / 2, dy + 3, W / 2, H - 4, { stroke: t.st, sw: 0.9, so: 0.45 }),
      );
      return p;
    },
    bathtub(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.18)];
      p.push(
        R(W * 0.16, H * 0.1, W * 0.68, H * 0.72, {
          rx: Math.min(W, H) * 0.12,
          fill: t.body,
          fo: 0.06,
          stroke: t.st,
          sw: 1.2,
        }),
      );
      p.push(
        L(W / 2 - 2, H - 4, W / 2 + 2, H - 4, {
          stroke: t.st,
          sw: 1.6,
          cap: true,
        }),
      );
      p.push(C(W / 2, H * 0.2, 1.4, { fill: "none", stroke: t.st, sw: 1.1 }));
      return p;
    },

    // — Appliances (fill the footprint) —
    fridge(W, H, t) {
      const p: Prim[] = [
        R(2.5, 1.5, W - 6, H - 3, {
          rx: Math.min(W, H) * 0.13,
          fill: t.body,
          fo: 0.15,
          stroke: t.st,
          sw: 1.8,
        }),
      ];
      const sy = 1.5 + (H - 3) * 0.36;
      p.push(L(2.5, sy, W - 3.5, sy, { stroke: t.st, sw: 1.5 }));
      p.push(
        L(W - 8, sy - 6, W - 8, sy - 2, { stroke: t.st, sw: 2.2, cap: true }),
      );
      p.push(
        L(W - 8, sy + 3, W - 8, sy + 10, { stroke: t.st, sw: 2.2, cap: true }),
      );
      p.push(R(5.5, 4.5, 2, H - 10, { rx: 1, fill: "#ffffff", fo: 0.22 }));
      return p;
    },
    freezer(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.1)];
      p.push(
        R(W * 0.12, H * 0.14, W * 0.76, H * 0.62, {
          rx: 2,
          fill: t.body,
          fo: 0.06,
          stroke: t.st,
          sw: 1.1,
          so: 0.7,
        }),
      );
      p.push(
        L(W * 0.4, H - 3.5, W * 0.6, H - 3.5, {
          stroke: t.st,
          sw: 2.2,
          cap: true,
        }),
      );
      return p;
    },
    stove(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.08)];
      p.push(
        L(3, H * 0.16, W - 3, H * 0.16, { stroke: t.st, sw: 0.8, so: 0.4 }),
      );
      const knobs = clamp(Math.round(W / 12), 2, 5);
      for (let k = 0; k < knobs; k++)
        p.push(
          C(
            3 + ((k + 0.5) * (W - 6)) / knobs,
            H * 0.09,
            Math.max(0.8, W * 0.02),
            {
              fill: t.st,
              fo: 0.6,
            },
          ),
        );
      const br = Math.min(W, H) * 0.13;
      [W * 0.32, W * 0.68].forEach((cx) =>
        [H * 0.45, H * 0.78].forEach((cy) => {
          p.push(C(cx, cy, br, { fill: "none", stroke: t.st, sw: 1.3 }));
          p.push(C(cx, cy, br * 0.45, { fill: t.st, fo: 0.4 }));
        }),
      );
      return p;
    },
    sink(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.1)];
      p.push(
        R(W * 0.18, H * 0.32, W * 0.64, H * 0.5, {
          rx: 3,
          fill: t.body,
          fo: 0.08,
          stroke: t.st,
          sw: 1.3,
        }),
      );
      p.push(
        L(W / 2, 4.5, W / 2, H * 0.32, { stroke: t.st, sw: 1.8, cap: true }),
      );
      p.push(C(W / 2, 4.5, 1.7, { fill: "none", stroke: t.st, sw: 1.4 }));
      p.push(C(W / 2, H * 0.57, 1.4, { fill: "none", stroke: t.st, sw: 1.1 }));
      return p;
    },
    washer(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.1)];
      p.push(
        L(3, H * 0.18, W - 3, H * 0.18, { stroke: t.st, sw: 0.8, so: 0.4 }),
      );
      p.push(C(W * 0.55, 3, 1.1, { fill: t.st, fo: 0.6 }));
      const cx = W / 2,
        cy = H * 0.58,
        r = Math.min(W, H) * 0.3;
      p.push(C(cx, cy, r, { fill: t.body, fo: 0.08, stroke: t.st, sw: 1.5 }));
      p.push(
        C(cx, cy, r * 0.6, { fill: "none", stroke: t.st, sw: 1, so: 0.7 }),
      );
      return p;
    },

    // — Small discrete objects (rendered centred, capped — see FixtureGraphic) —
    nightstand(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.12)];
      p.push(L(3, H * 0.42, W - 3, H * 0.42, { stroke: t.st, sw: 1.1 }));
      p.push(
        C(W / 2, H * 0.66, Math.max(1, Math.min(W, H) * 0.06), {
          fill: t.st,
          fo: 0.8,
        }),
      );
      return p;
    },
    bin(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.16)];
      p.push(
        R(W * 0.2, H * 0.2, W * 0.6, H * 0.6, {
          rx: 2,
          fill: "none",
          stroke: t.st,
          sw: 1.2,
          so: 0.8,
        }),
      );
      p.push(
        L(W * 0.35, H * 0.12, W * 0.65, H * 0.12, {
          stroke: t.st,
          sw: 1,
          so: 0.5,
        }),
      );
      return p;
    },
    toilet(W, H, t) {
      const p: Prim[] = [FR(W, H, t, 0.14)];
      p.push(
        R(W * 0.22, 3, W * 0.56, H * 0.24, {
          rx: 1.5,
          fill: t.body,
          fo: 0.12,
          stroke: t.st,
          sw: 1,
        }),
      );
      p.push(
        C(W / 2, H * 0.62, Math.min(W, H) * 0.26, {
          fill: t.body,
          fo: 0.1,
          stroke: t.st,
          sw: 1.3,
        }),
      );
      p.push(
        C(W / 2, H * 0.62, Math.min(W, H) * 0.14, {
          fill: "none",
          stroke: t.st,
          sw: 0.9,
          so: 0.6,
        }),
      );
      return p;
    },
    plant(W, H, t) {
      const cx = W / 2,
        cy = H * 0.4,
        r = Math.min(W, H) * 0.22;
      return [
        C(cx, cy, r, { fill: t.body, fo: 0.2, stroke: t.st, sw: 1.2 }),
        C(cx - r * 0.6, cy + r * 0.2, r * 0.7, {
          fill: t.body,
          fo: 0.18,
          stroke: t.st,
          sw: 1,
        }),
        C(cx + r * 0.6, cy + r * 0.2, r * 0.7, {
          fill: t.light,
          fo: 0.22,
          stroke: t.st,
          sw: 1,
        }),
        R(W * 0.36, H * 0.62, W * 0.28, H * 0.3, {
          rx: 1.5,
          fill: t.st,
          fo: 0.25,
          stroke: t.st,
          sw: 1.2,
        }),
      ];
    },
  };

export const FIXTURE_META: Record<
  FixtureId,
  {
    label: string;
    defaultColor: string;
    fill: FixtureFill;
    category: FixtureCategory;
  }
> = {
  // — storage —
  shelf: {
    label: "Shelf",
    defaultColor: "#2d6b44",
    fill: "slice",
    category: "storage",
  },
  bookshelf: {
    label: "Bookshelf",
    defaultColor: "#7a5230",
    fill: "slice",
    category: "storage",
  },
  cabinet: {
    label: "Cabinet",
    defaultColor: "#b8821e",
    fill: "slice",
    category: "storage",
  },
  pantry: {
    label: "Pantry",
    defaultColor: "#a9761f",
    fill: "slice",
    category: "storage",
  },
  drawers: {
    label: "Drawers",
    defaultColor: "#6d7d72",
    fill: "slice",
    category: "storage",
  },
  wardrobe: {
    label: "Wardrobe",
    defaultColor: "#8b5cf6",
    fill: "slice",
    category: "storage",
  },
  rack: {
    label: "Rack",
    defaultColor: "#3a4a3f",
    fill: "slice",
    category: "storage",
  },
  counter: {
    label: "Counter",
    defaultColor: "#9a8f7d",
    fill: "slice",
    category: "storage",
  },
  // — furniture —
  table: {
    label: "Table",
    defaultColor: "#8a6a44",
    fill: "fit",
    category: "furniture",
  },
  desk: {
    label: "Desk",
    defaultColor: "#7d6747",
    fill: "fit",
    category: "furniture",
  },
  sofa: {
    label: "Sofa",
    defaultColor: "#7d6f86",
    fill: "fit",
    category: "furniture",
  },
  bed: {
    label: "Bed",
    defaultColor: "#b06a6a",
    fill: "fit",
    category: "furniture",
  },
  bathtub: {
    label: "Bathtub",
    defaultColor: "#6fa3b0",
    fill: "fit",
    category: "furniture",
  },
  nightstand: {
    label: "Nightstand",
    defaultColor: "#9a7b53",
    fill: "single",
    category: "furniture",
  },
  // — appliances —
  fridge: {
    label: "Fridge",
    defaultColor: "#4a90b8",
    fill: "fit",
    category: "appliance",
  },
  freezer: {
    label: "Freezer",
    defaultColor: "#6aa0c4",
    fill: "fit",
    category: "appliance",
  },
  stove: {
    label: "Stove / oven",
    defaultColor: "#5f6066",
    fill: "fit",
    category: "appliance",
  },
  sink: {
    label: "Sink",
    defaultColor: "#7fa6b8",
    fill: "fit",
    category: "appliance",
  },
  washer: {
    label: "Washer",
    defaultColor: "#5f6f7a",
    fill: "fit",
    category: "appliance",
  },
  // — objects —
  bin: {
    label: "Bin / box",
    defaultColor: "#f97316",
    fill: "single",
    category: "object",
  },
  toilet: {
    label: "Toilet",
    defaultColor: "#8a9097",
    fill: "single",
    category: "object",
  },
  plant: {
    label: "Plant",
    defaultColor: "#3d8a58",
    fill: "single",
    category: "object",
  },
};

/** Ordered fixture categories + display labels for the block picker gallery. */
export const FIXTURE_CATEGORIES: { id: FixtureCategory; label: string }[] = [
  { id: "storage", label: "Storage" },
  { id: "furniture", label: "Furniture" },
  { id: "appliance", label: "Appliances" },
  { id: "object", label: "Objects" },
];

// ── Custom fixtures ──────────────────────────────────────────────────────────
// User-authored fixtures resolve through a context, so any block can render one
// by id (cf_*) without prop-threading. Provided per page from the loader data;
// the default empty map means an unresolved custom fixture renders nothing.
const CustomFixtureContext = createContext<Record<string, CustomFixture>>({});

export function CustomFixtureProvider({
  fixtures,
  children,
}: {
  fixtures: CustomFixture[];
  children: ReactNode;
}) {
  const map = useMemo(
    () => Object.fromEntries(fixtures.map((f) => [f.id, f])),
    [fixtures],
  );
  return (
    <CustomFixtureContext.Provider value={map}>
      {children}
    </CustomFixtureContext.Provider>
  );
}

// Resolve a shape's tone to concrete fill/stroke from the block colour, so a
// custom fixture recolours per block exactly like the built-ins.
function toneStyle(tone: CustomShape["tone"], t: Tones) {
  switch (tone) {
    case "outline":
      return {
        fill: "none",
        fo: undefined as number | undefined,
        stroke: t.st,
      };
    case "light":
      return { fill: t.light, fo: 0.45, stroke: t.st };
    case "mid":
      return { fill: t.mid, fo: 0.5, stroke: t.st };
    case "body":
    default:
      return { fill: t.body, fo: 0.16, stroke: t.st };
  }
}

/** The fill/stroke a custom-fixture shape `tone` resolves to for a block colour
 *  — shared with the freeform editor so its preview matches the final render. */
export function customShapeStyle(tone: CustomShape["tone"], color: string) {
  const ts = toneStyle(tone, tones(color));
  return { fill: ts.fill, fillOpacity: ts.fo, stroke: ts.stroke };
}

// Render a custom fixture's shapes within the normalised 0–100 design box.
function renderCustomShapes(shapes: CustomShape[], color: string) {
  const t = tones(color);
  return shapes.map((sh, i) => {
    const ts = toneStyle(sh.tone, t);
    if (sh.type === "circle")
      return (
        <ellipse
          key={i}
          cx={sh.x + sh.w / 2}
          cy={sh.y + sh.h / 2}
          rx={sh.w / 2}
          ry={sh.h / 2}
          fill={ts.fill}
          fillOpacity={ts.fo}
          stroke={ts.stroke}
          strokeWidth={1.4}
        />
      );
    const rx =
      sh.type === "bar"
        ? Math.min(sh.w, sh.h) / 2
        : Math.min(sh.w, sh.h) * 0.08;
    return (
      <rect
        key={i}
        x={sh.x}
        y={sh.y}
        width={sh.w}
        height={sh.h}
        rx={rx}
        fill={ts.fill}
        fillOpacity={ts.fo}
        stroke={ts.stroke}
        strokeWidth={1.4}
      />
    );
  });
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderPrims(prims: Prim[]) {
  return prims.map((p, i) => {
    if (p.k === "rect")
      return (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          rx={p.rx}
          fill={p.fill ?? "none"}
          fillOpacity={p.fo}
          stroke={p.stroke}
          strokeWidth={p.sw}
          strokeOpacity={p.so}
        />
      );
    if (p.k === "line")
      return (
        <line
          key={i}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke={p.stroke}
          strokeWidth={p.sw}
          strokeOpacity={p.so}
          strokeLinecap={p.cap ? "round" : undefined}
        />
      );
    return (
      <circle
        key={i}
        cx={p.cx}
        cy={p.cy}
        r={p.r}
        fill={p.fill ?? "none"}
        fillOpacity={p.fo}
        stroke={p.stroke}
        strokeWidth={p.sw}
        strokeOpacity={p.so}
      />
    );
  });
}

/**
 * Draw a fixture across a block of `cols`×`rows` cells. The viewBox is the
 * block's pixel size (cols/rows × 16), and the block element has the same
 * aspect (square cells), so `preserveAspectRatio="none"` scales uniformly and
 * never distorts strokes.
 *
 * - `single` fixtures (small discrete objects: bin, nightstand, toilet, plant)
 *   draw a square object capped to ~2 cells, centred — so they don't smear to
 *   fill a large block.
 * - everything else fills the footprint, recomputed at the block's size.
 */
export function FixtureGraphic({
  fixture,
  color,
  cols,
  rows,
  className,
  style,
}: {
  fixture: FixtureRef;
  color: string;
  cols: number;
  rows: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const customFixtures = useContext(CustomFixtureContext);
  const t = tones(color);
  const W = Math.max(1, cols) * N;
  const H = Math.max(1, rows) * N;

  // Custom fixture (cf_*): draw its shapes from the 0–100 design box, scaled to
  // fill the footprint. Renders nothing if unresolved (e.g. a viewer without the
  // owner's library loaded).
  if (isCustomFixtureRef(fixture)) {
    const cf = customFixtures[fixture];
    if (!cf) return null;
    return (
      <svg
        className={className}
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={style}
        aria-hidden
      >
        {renderCustomShapes(cf.shapes, color)}
      </svg>
    );
  }

  // Built-in fixture.
  const builtin = fixture as FixtureId;
  const build = BUILDERS[builtin];
  const meta = FIXTURE_META[builtin];
  if (!build || !meta) return null;

  if (meta.fill === "single") {
    const s = clamp(Math.min(W, H), N, N * 2);
    const ox = (W - s) / 2,
      oy = (H - s) / 2;
    return (
      <svg
        className={className}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={style}
        aria-hidden
      >
        <g transform={`translate(${ox} ${oy})`}>
          {renderPrims(build(s, s, t))}
        </g>
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
      style={style}
      aria-hidden
    >
      {renderPrims(build(W, H, t))}
    </svg>
  );
}
