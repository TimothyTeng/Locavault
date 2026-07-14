import { useState } from "react";
import {
  GRID_MIN as MIN,
  GRID_MAX as MAX,
  GRID_PRESETS as PRESETS,
  clampGridDim as clamp,
} from "~/lib/gridLimits";

interface GridControlsProps {
  cols: number;
  rows: number;
  onColsChange: (n: number) => void;
  onRowsChange: (n: number) => void;
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));

  // Keep raw display in sync when value changes externally (e.g. preset click)
  if (
    String(value) !== raw &&
    document.activeElement?.getAttribute("data-stepper") !== label
  ) {
    setRaw(String(value));
  }

  const commit = (str: string) => {
    const n = parseInt(str, 10);
    if (!isNaN(n)) onChange(clamp(n));
    setRaw(String(clamp(isNaN(n) ? value : n)));
  };

  return (
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <div className="flex items-center h-7 rounded border border-slate-200 overflow-hidden bg-white">
        <button
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= MIN}
          className="w-7 h-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r border-slate-200 text-sm shrink-0"
        >
          −
        </button>
        <input
          data-stepper={label}
          type="number"
          value={raw}
          min={MIN}
          max={MAX}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(raw)}
          className="flex-1 text-center text-[11px] font-mono text-slate-700 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= MAX}
          className="w-7 h-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-slate-200 text-sm shrink-0"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function GridControls({
  cols,
  rows,
  onColsChange,
  onRowsChange,
}: GridControlsProps) {
  const [custom, setCustom] = useState(false);

  const activePreset =
    PRESETS.find((p) => p.cols === cols && p.rows === rows) ?? null;

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    onColsChange(p.cols);
    onRowsChange(p.rows);
    setCustom(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Preset row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESETS.map((p) => {
          const isActive = !custom && activePreset?.label === p.label;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1 rounded text-[10px] font-mono transition-all border"
              style={{
                background: isActive ? "#1e293b" : "transparent",
                color: isActive ? "#f8fafc" : "#64748b",
                borderColor: isActive ? "#1e293b" : "#e2e8f0",
              }}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => setCustom(true)}
          className="px-2.5 py-1 rounded text-[10px] font-mono transition-all border"
          style={{
            background: custom ? "#1e293b" : "transparent",
            color: custom ? "#f8fafc" : "#64748b",
            borderColor: custom ? "#1e293b" : "#e2e8f0",
          }}
        >
          Custom
        </button>
      </div>

      {/* Custom steppers — visible when no preset matches or Custom is active */}
      {(custom || !activePreset) && (
        <div className="flex gap-3">
          <Stepper label="Cols" value={cols} onChange={onColsChange} />
          <Stepper label="Rows" value={rows} onChange={onRowsChange} />
        </div>
      )}
    </div>
  );
}
