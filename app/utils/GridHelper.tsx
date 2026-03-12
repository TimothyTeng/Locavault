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

export function darkenColor(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const colorPart = clean.slice(0, 6); // e.g. "4f46e5"
  const alphaPart = clean.slice(6); // e.g. "22" or "" if none

  const num = parseInt(colorPart, 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));

  const darkened = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  return `${darkened}${alphaPart}`; // e.g. "#2d2a8322"
}
