import { describe, it, expect } from "vitest";
import {
  blockCentroid,
  walkOrder,
  sortByWalk,
  type PlacedBlock,
} from "./pickPath.helper";

describe("blockCentroid", () => {
  it("returns the centre of a block", () => {
    expect(blockCentroid({ x: 2, y: 4, w: 2, h: 4 })).toEqual({ x: 3, y: 6 });
  });
});

describe("walkOrder", () => {
  it("returns the input for 0/1 blocks", () => {
    expect(walkOrder([])).toEqual([]);
    expect(walkOrder([{ id: "a", center: { x: 5, y: 5 } }])).toEqual(["a"]);
  });

  it("visits nearest-first from the origin along a line", () => {
    const blocks = [
      { id: "far", center: { x: 10, y: 0 } },
      { id: "near", center: { x: 1, y: 0 } },
      { id: "mid", center: { x: 5, y: 0 } },
    ];
    expect(walkOrder(blocks, { x: 0, y: 0 })).toEqual(["near", "mid", "far"]);
  });

  it("avoids a criss-cross that nearest-neighbour alone would take (2-opt)", () => {
    // Points on a line but shuffled; the optimal open path from origin is L→R.
    const blocks = [
      { id: "d", center: { x: 30, y: 0 } },
      { id: "b", center: { x: 10, y: 0 } },
      { id: "a", center: { x: 1, y: 0 } },
      { id: "c", center: { x: 20, y: 0 } },
    ];
    expect(walkOrder(blocks, { x: 0, y: 0 })).toEqual(["a", "b", "c", "d"]);
  });
});

describe("sortByWalk", () => {
  const blocks: Record<string, PlacedBlock> = {
    near: { x: 0, y: 0, w: 2, h: 2 },
    mid: { x: 4, y: 0, w: 2, h: 2 },
    far: { x: 10, y: 0, w: 2, h: 2 },
  };

  it("groups rows by block and walks nearest-first", () => {
    const rows = [
      { id: 1, blockId: "far" },
      { id: 2, blockId: "near" },
      { id: 3, blockId: "far" },
      { id: 4, blockId: "mid" },
    ];
    const out = sortByWalk(rows, blocks, { x: 0, y: 0 });
    expect(out.map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });

  it("keeps within-block input order (stable)", () => {
    const rows = [
      { id: 1, blockId: "near" },
      { id: 2, blockId: "near" },
      { id: 3, blockId: "near" },
    ];
    const out = sortByWalk(rows, blocks, { x: 0, y: 0 });
    expect(out.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("sinks rows with no/unknown block to the end in original order", () => {
    const rows = [
      { id: 1, blockId: null },
      { id: 2, blockId: "near" },
      { id: 3, blockId: "ghost" },
      { id: 4, blockId: "mid" },
    ];
    const out = sortByWalk(rows, blocks, { x: 0, y: 0 });
    expect(out.map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });
});
