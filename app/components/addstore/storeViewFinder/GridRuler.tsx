import { colLabel } from "#utils/helpers/gridCanvas.helper";

/**
 * Spreadsheet-style coordinate guides around the grid: letters (A, B, C…) across
 * the top, numbers (1, 2, 3…) down the side, so blocks can be referenced by
 * address (e.g. "the cabinet at B3"). Rendered inside a `position: relative`
 * wrapper that's padded by `size` on the top and left to make room. Positions
 * are pure CSS `calc()` against the padding box, so they stay aligned at any
 * zoom without measuring. See `cellAddress()`.
 */
export function GridRuler({
  cols,
  rows,
  size,
}: {
  cols: number;
  rows: number;
  size: number;
}) {
  const labelCls =
    "absolute flex items-center justify-center font-mono text-slate-400 pointer-events-none select-none";
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {/* corner */}
      <div
        className="absolute top-0 left-0 bg-slate-50/70"
        style={{ width: size, height: size }}
      />
      {/* column headers (letters) */}
      {Array.from({ length: cols }, (_, i) => (
        <div
          key={`c${i}`}
          className={labelCls}
          style={{
            top: 0,
            height: size,
            left: `calc(${size}px + (100% - ${size}px) * ${i} / ${cols})`,
            width: `calc((100% - ${size}px) / ${cols})`,
            fontSize: 9,
          }}
        >
          {colLabel(i)}
        </div>
      ))}
      {/* row headers (numbers) */}
      {Array.from({ length: rows }, (_, j) => (
        <div
          key={`r${j}`}
          className={labelCls}
          style={{
            left: 0,
            width: size,
            top: `calc(${size}px + (100% - ${size}px) * ${j} / ${rows})`,
            height: `calc((100% - ${size}px) / ${rows})`,
            fontSize: 9,
          }}
        >
          {j + 1}
        </div>
      ))}
    </div>
  );
}
