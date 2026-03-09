type Props = {
  cols: number;
  rows: number;
  onColsChange: (v: number) => void;
  onRowsChange: (v: number) => void;
};

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400 w-8 shrink-0">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 min-w-0 cursor-pointer accent-green-800"
      />
      <span className="font-mono text-sm font-bold text-green-800 w-5 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

export function GridControls({
  cols,
  rows,
  onColsChange,
  onRowsChange,
}: Props) {
  return (
    <div className="flex gap-5 flex-1 max-w-md items-center">
      <Slider
        label="Cols"
        value={cols}
        min={4}
        max={30}
        onChange={onColsChange}
      />
      <Slider
        label="Rows"
        value={rows}
        min={4}
        max={30}
        onChange={onRowsChange}
      />
    </div>
  );
}
