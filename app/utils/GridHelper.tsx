import type { LayoutItem } from "react-grid-layout";

export function findNextFreeCell(
  layout: LayoutItem[],
  cols: number,
  rows: number,
): { x: number; y: number } {
  const occupied = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (const item of layout) {
    for (let dy = 0; dy < item.h; dy++) {
      for (let dx = 0; dx < item.w; dx++) {
        const cy = item.y + dy;
        const cx = item.x + dx;
        if (cy < rows && cx < cols) occupied[cy][cx] = true;
      }
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied[y][x]) return { x, y };
    }
  }
  return { x: 0, y: rows };
}
