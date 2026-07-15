/**
 * A wall is a single cell-length segment on a grid *edge* (between cells), not a
 * cell itself. `(x, y)` is the top-left grid point of the segment; `dir` is the
 * direction it runs from there: `"h"` → rightward to `(x+1, y)`, `"v"` → downward
 * to `(x, y+1)`. Segments that share a grid point auto-join into runs and corners.
 *
 * `kind` is what the segment depicts along that edge (default `"wall"` — a solid
 * wall). A `"door"` renders as a framed opening (jambs + threshold), a `"window"`
 * as a glazed pane in the wall line. Stored per store as a JSON array (see
 * `wall.helper.ts`). See DESIGN.md §4.
 */
export type WallKind = "wall" | "door" | "window";

export type Wall = {
  x: number;
  y: number;
  dir: "h" | "v";
  kind?: WallKind;
};
