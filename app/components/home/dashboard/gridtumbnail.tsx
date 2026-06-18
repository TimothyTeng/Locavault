import { memo } from "react";
import type { BlockDetails } from "#types/storeViewFinderTypes";
import type { Wall } from "#types/wallTypes";
import { storeColor } from "~/utils/dashboardUtils";

// Wall-layer colours (mirror WallLayer): solid wall, door threshold, window glass.
const WALL_FILL: Record<NonNullable<Wall["kind"]> | "wall", string> = {
  wall: "#646e7b",
  door: "#b59f80",
  window: "#9cc3df",
};

export const GridThumbnail = memo(function GridThumbnail({
  blocks,
  rows,
  cols,
  name,
  walls = [],
}: {
  blocks: BlockDetails[];
  rows: number;
  cols: number;
  name: string;
  walls?: Wall[];
}) {
  const W = 280;
  const H = 160;
  const cellW = W / cols;
  const cellH = H / rows;
  const accent = storeColor(name);
  const wallT = Math.max(1.5, Math.min(cellW, cellH) * 0.18);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
    >
      {/* Grid lines */}
      {Array.from({ length: cols + 1 }).map((_, i) => (
        <line
          key={`v${i}`}
          x1={i * cellW}
          y1={0}
          x2={i * cellW}
          y2={H}
          stroke="#e2e8f0"
          strokeWidth="0.5"
        />
      ))}
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <line
          key={`h${i}`}
          x1={0}
          y1={i * cellH}
          x2={W}
          y2={i * cellH}
          stroke="#e2e8f0"
          strokeWidth="0.5"
        />
      ))}

      {/* Blocks */}
      {blocks.length === 0 ? (
        // Empty state: show initials centred
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="28"
          fontWeight="600"
          fill={accent}
          opacity="0.35"
          fontFamily="ui-monospace, monospace"
        >
          {name.slice(0, 2).toUpperCase()}
        </text>
      ) : (
        blocks.map((b) => (
          <rect
            key={b.block_id}
            x={b.x * cellW + 1}
            y={b.y * cellH + 1}
            width={b.width * cellW - 2}
            height={b.height * cellH - 2}
            fill={b.background}
            stroke={b.border}
            strokeWidth="1"
            rx="1.5"
          />
        ))
      )}

      {/* Wall layer — thin bars centred on the grid lines, coloured by kind. */}
      {walls.map((w, i) => {
        const fill = WALL_FILL[w.kind ?? "wall"];
        return w.dir === "h" ? (
          <rect
            key={`w${i}`}
            x={w.x * cellW}
            y={w.y * cellH - wallT / 2}
            width={cellW}
            height={wallT}
            fill={fill}
            rx={wallT * 0.3}
          />
        ) : (
          <rect
            key={`w${i}`}
            x={w.x * cellW - wallT / 2}
            y={w.y * cellH}
            width={wallT}
            height={cellH}
            fill={fill}
            rx={wallT * 0.3}
          />
        );
      })}
    </svg>
  );
});
