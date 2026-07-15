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
  // Darker + semibold + tabular numerals so the guides stay legible over the
  // map's gradient and tiles (the old slate-400/9px read as "very faint").
  const labelCls =
    "absolute flex items-center justify-center font-mono font-semibold text-slate-500 tabular-nums pointer-events-none select-none";
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {/* Gutter bands — a faint backing strip behind the labels so they read as a
          proper ruler against any background, not floating text. */}
      <div
        className="absolute top-0 left-0 right-0 bg-slate-100/85 border-b border-slate-200/80"
        style={{ height: size }}
      />
      <div
        className="absolute top-0 left-0 bottom-0 bg-slate-100/85 border-r border-slate-200/80"
        style={{ width: size }}
      />
      {/* corner cap */}
      <div
        className="absolute top-0 left-0 bg-slate-200/70"
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
            fontSize: 10,
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
            fontSize: 10,
          }}
        >
          {j + 1}
        </div>
      ))}
    </div>
  );
}
