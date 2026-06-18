import { describe, it, expect } from "vitest";
import {
  wallKey,
  parseWallKey,
  pointAtCell,
  edgeAtCell,
  wallRun,
  wallJunctions,
  hasWall,
  wallAt,
  withKind,
  upsertWalls,
  removeWalls,
  serializeWalls,
  parseWalls,
  wallTouchesCells,
  wallInBounds,
  offsetWall,
  effectiveWallKeys,
  moveWalls,
} from "./wall.helper";
import type { Wall } from "#types/wallTypes";

describe("wall keys", () => {
  it("round-trips", () => {
    const w: Wall = { x: 2, y: 3, dir: "v" };
    expect(parseWallKey(wallKey(w))).toEqual(w);
    expect(wallKey({ x: 0, y: 1, dir: "h" })).toBe("h:0:1");
  });
});

describe("pointAtCell", () => {
  it("snaps to nearest intersection and clamps", () => {
    expect(pointAtCell(1.4, 2.6, 9, 6)).toEqual([1, 3]);
    expect(pointAtCell(-3, 99, 9, 6)).toEqual([0, 6]);
  });
});

describe("edgeAtCell", () => {
  it("picks a horizontal edge when nearer a horizontal line", () => {
    // y≈1 (on a horizontal line), x mid-cell → horizontal edge on row 1
    expect(edgeAtCell(2.5, 1.05, 9, 6)).toEqual({ dir: "h", x: 2, y: 1 });
  });
  it("picks a vertical edge when nearer a vertical line", () => {
    expect(edgeAtCell(3.02, 2.5, 9, 6)).toEqual({ dir: "v", x: 3, y: 2 });
  });
  it("returns null well outside the grid", () => {
    expect(edgeAtCell(20, 20, 9, 6)).toBeNull();
  });
});

describe("wallRun", () => {
  it("is empty for a single point (a click, not a drag)", () => {
    expect(wallRun(2, 2, 2, 2)).toEqual([]);
  });
  it("lays a horizontal run when x dominates", () => {
    expect(wallRun(1, 1, 4, 2)).toEqual([
      { dir: "h", x: 1, y: 1 },
      { dir: "h", x: 2, y: 1 },
      { dir: "h", x: 3, y: 1 },
    ]);
  });
  it("lays a vertical run when y dominates, regardless of drag direction", () => {
    expect(wallRun(2, 4, 2, 1)).toEqual([
      { dir: "v", x: 2, y: 1 },
      { dir: "v", x: 2, y: 2 },
      { dir: "v", x: 2, y: 3 },
    ]);
  });
});

describe("wallJunctions", () => {
  it("flags every grid point where ≥2 segments meet (run joints + corners)", () => {
    // An L: two horizontal segments then a vertical. (1,0) is the run joint,
    // (2,0) is the corner — both have degree 2.
    const walls: Wall[] = [
      { dir: "h", x: 0, y: 0 },
      { dir: "h", x: 1, y: 0 },
      { dir: "v", x: 2, y: 0 },
    ];
    expect(wallJunctions(walls).sort()).toEqual(["1,0", "2,0"]);
  });
});

describe("set ops", () => {
  const base: Wall[] = [{ dir: "h", x: 0, y: 0 }];
  it("hasWall / wallAt / upsert (place + convert kind) / remove", () => {
    expect(hasWall(base, { dir: "h", x: 0, y: 0 })).toBe(true);
    expect(wallAt(base, { dir: "h", x: 0, y: 0 })?.kind).toBeUndefined();
    // place a new wall and convert the existing edge to a door (same key replaced)
    const next = upsertWalls(base, [
      withKind({ dir: "h", x: 0, y: 0 }, "door"),
      withKind({ dir: "v", x: 1, y: 1 }, "wall"),
    ]);
    expect(next).toHaveLength(2);
    expect(wallAt(next, { dir: "h", x: 0, y: 0 })?.kind).toBe("door");
    expect(wallAt(next, { dir: "v", x: 1, y: 1 })?.kind).toBeUndefined();
    expect(removeWalls(next, [{ dir: "h", x: 0, y: 0 }])).toHaveLength(1);
  });
  it("withKind omits kind for plain walls, keeps it otherwise", () => {
    expect(withKind({ dir: "h", x: 2, y: 3 }, "wall")).toEqual({
      dir: "h",
      x: 2,
      y: 3,
    });
    expect(withKind({ dir: "h", x: 2, y: 3 }, "window")).toEqual({
      dir: "h",
      x: 2,
      y: 3,
      kind: "window",
    });
  });
});

describe("group move (walls follow a selection)", () => {
  // A 1×1 block at (2,2) occupies cell "2,2"; its four surrounding edges all
  // border that cell.
  const cell = new Set(["2,2"]);
  // Bounding box of that block (grid-line coords).
  const box = { x0: 2, y0: 2, x1: 3, y1: 3 };
  it("wallTouchesCells flags the four edges around a cell, not the ones beyond", () => {
    expect(wallTouchesCells({ dir: "h", x: 2, y: 2 }, cell)).toBe(true); // top
    expect(wallTouchesCells({ dir: "h", x: 2, y: 3 }, cell)).toBe(true); // bottom
    expect(wallTouchesCells({ dir: "v", x: 2, y: 2 }, cell)).toBe(true); // left
    expect(wallTouchesCells({ dir: "v", x: 3, y: 2 }, cell)).toBe(true); // right
    expect(wallTouchesCells({ dir: "h", x: 2, y: 4 }, cell)).toBe(false);
    expect(wallTouchesCells({ dir: "v", x: 4, y: 2 }, cell)).toBe(false);
  });
  it("wallInBounds includes the four edges on the box, excludes the ones beyond", () => {
    expect(wallInBounds({ dir: "h", x: 2, y: 2 }, box)).toBe(true); // top
    expect(wallInBounds({ dir: "h", x: 2, y: 3 }, box)).toBe(true); // bottom
    expect(wallInBounds({ dir: "v", x: 2, y: 2 }, box)).toBe(true); // left
    expect(wallInBounds({ dir: "v", x: 3, y: 2 }, box)).toBe(true); // right
    expect(wallInBounds({ dir: "h", x: 2, y: 4 }, box)).toBe(false);
    expect(wallInBounds({ dir: "v", x: 4, y: 2 }, box)).toBe(false);
  });
  it("offsetWall translates and clamps to the grid", () => {
    expect(offsetWall({ dir: "h", x: 2, y: 2 }, 1, 0, 9, 6)).toEqual({
      dir: "h",
      x: 3,
      y: 2,
    });
    // a horizontal edge clamps x to cols-1, y to rows
    expect(offsetWall({ dir: "h", x: 8, y: 5 }, 5, 5, 9, 6)).toEqual({
      dir: "h",
      x: 8,
      y: 6,
    });
    // kind is preserved
    expect(
      offsetWall({ dir: "v", x: 1, y: 1, kind: "door" }, 0, 1, 9, 6),
    ).toEqual({ dir: "v", x: 1, y: 2, kind: "door" });
  });
  it("effectiveWallKeys unions box-covered walls with explicitly-selected keys", () => {
    const origin: Wall[] = [
      { dir: "h", x: 2, y: 2 }, // inside box
      { dir: "v", x: 3, y: 2 }, // inside box
      { dir: "v", x: 7, y: 1 }, // outside box, but explicitly selected
    ];
    const keys = effectiveWallKeys(origin, box, new Set(["v:7:1"]));
    expect([...keys].sort()).toEqual(["h:2:2", "v:3:2", "v:7:1"]);
    // No bounds → just the explicit set.
    expect([...effectiveWallKeys(origin, null, new Set(["v:7:1"]))]).toEqual([
      "v:7:1",
    ]);
  });
  it("moves only the walls whose key is selected, leaving the rest put", () => {
    const origin: Wall[] = [
      { dir: "h", x: 2, y: 2 }, // selected
      { dir: "v", x: 5, y: 5 }, // not
    ];
    expect(moveWalls(origin, new Set(["h:2:2"]), 1, 0, 9, 6)).toEqual([
      { dir: "v", x: 5, y: 5 },
      { dir: "h", x: 3, y: 2 },
    ]);
  });
  it("returns the same array reference when nothing moves (no-op)", () => {
    const origin: Wall[] = [{ dir: "v", x: 5, y: 5 }];
    expect(moveWalls(origin, new Set(["h:2:2"]), 1, 0, 9, 6)).toBe(origin);
    expect(moveWalls(origin, new Set(), 1, 0, 9, 6)).toBe(origin);
    expect(moveWalls(origin, new Set(["v:5:5"]), 0, 0, 9, 6)).toBe(origin);
  });
  it("a moved wall overrides a stationary edge at the same key", () => {
    const origin: Wall[] = [
      { dir: "h", x: 2, y: 2, kind: "door" }, // selected, will move onto 3,2
      { dir: "h", x: 3, y: 2 }, // stationary plain wall at the target edge
    ];
    const out = moveWalls(origin, new Set(["h:2:2"]), 1, 0, 9, 6);
    expect(out).toEqual([{ dir: "h", x: 3, y: 2, kind: "door" }]);
  });
});

describe("persistence", () => {
  it("serialises and parses, dropping junk and duplicates", () => {
    const walls: Wall[] = [
      { dir: "h", x: 0, y: 0 },
      { dir: "v", x: 1, y: 2, kind: "door" },
    ];
    expect(parseWalls(serializeWalls(walls))).toEqual(walls);
    expect(parseWalls(null)).toEqual([]);
    expect(parseWalls("not json")).toEqual([]);
    expect(
      parseWalls(
        JSON.stringify([
          { x: 0, y: 0, dir: "h" },
          { x: 0, y: 0, dir: "h" }, // dup
          { x: 1, y: 1, dir: "x" }, // bad dir
          { x: "a", y: 1, dir: "v" }, // bad coord
          { x: 2, y: 2, dir: "v", kind: "bogus" }, // bad kind → plain wall
        ]),
      ),
    ).toEqual([
      { dir: "h", x: 0, y: 0 },
      { dir: "v", x: 2, y: 2 },
    ]);
  });
});
