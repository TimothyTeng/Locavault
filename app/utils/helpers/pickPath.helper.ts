// Pick-path ordering: sort a shopping list / collection into the order you'd
// actually walk the floor plan, so you gather everything in one sweep instead of
// criss-crossing. Pure + deterministic.
//
// The route is a light TSP heuristic over block centroids: nearest-neighbour from
// an origin (the plan's top-left "entrance" by default), then a bounded 2-opt
// polish. Rows sharing a block stay grouped; rows with no block sort to the end
// in their original order.

/** Minimal block geometry this helper needs (a subset of BlockState). */
export type PlacedBlock = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

/** Centre of a block on the grid. */
export function blockCentroid(b: PlacedBlock): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Total length of a tour that starts at `origin` and visits `pts` in order. */
function tourLength(origin: Point, pts: Point[]): number {
  let total = 0;
  let prev = origin;
  for (const p of pts) {
    total += dist(prev, p);
    prev = p;
  }
  return total;
}

/**
 * Order block ids into a sensible walk from `origin`. Nearest-neighbour seed
 * then 2-opt (open path — the start is pinned to `origin`, no return leg).
 * Deterministic: ties break by the input order of `blocks`.
 */
export function walkOrder(
  blocks: { id: string; center: Point }[],
  origin: Point = { x: 0, y: 0 },
): string[] {
  const n = blocks.length;
  if (n <= 1) return blocks.map((b) => b.id);

  // ── Nearest-neighbour seed ──
  const remaining = blocks.slice();
  const route: { id: string; center: Point }[] = [];
  let cur = origin;
  while (remaining.length) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dd = dist(cur, remaining[i].center);
      if (dd < bestD) {
        bestD = dd;
        bestI = i;
      }
    }
    const [next] = remaining.splice(bestI, 1);
    route.push(next);
    cur = next.center;
  }

  // ── 2-opt polish (open path from a fixed origin) ──
  const centers = () => route.map((r) => r.center);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        // Reverse segment [i..k] and keep it only if the tour gets shorter.
        const before = tourLength(origin, centers());
        const seg = route.slice(i, k + 1).reverse();
        const candidate = [...route.slice(0, i), ...seg, ...route.slice(k + 1)];
        const after = tourLength(
          origin,
          candidate.map((r) => r.center),
        );
        if (after + 1e-9 < before) {
          route.splice(0, route.length, ...candidate);
          improved = true;
        }
      }
    }
  }

  return route.map((r) => r.id);
}

/**
 * Reorder rows to follow the walk. Rows are grouped by `blockId`; the groups are
 * visited in `walkOrder`, and rows with no/unknown block go last (original order).
 * Within a block, rows keep their input order. Stable + pure.
 */
export function sortByWalk<T extends { blockId?: string | null }>(
  rows: T[],
  blocks: Record<string, PlacedBlock>,
  origin?: Point,
): T[] {
  // Distinct blocks actually referenced by rows (that we have geometry for).
  const present: { id: string; center: Point }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r.blockId;
    if (id && !seen.has(id) && blocks[id]) {
      seen.add(id);
      present.push({ id, center: blockCentroid(blocks[id]) });
    }
  }

  const order = walkOrder(present, origin);
  const rank = new Map(order.map((id, i) => [id, i]));

  // Stable sort by block rank; unranked (null/unknown block) sink to the end.
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const ra = rank.get(a.row.blockId ?? "") ?? Number.POSITIVE_INFINITY;
      const rb = rank.get(b.row.blockId ?? "") ?? Number.POSITIVE_INFINITY;
      return ra - rb || a.i - b.i;
    })
    .map((x) => x.row);
}
