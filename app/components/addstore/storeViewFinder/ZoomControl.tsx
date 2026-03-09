type Props = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function ZoomControls({ zoom, onZoomIn, onZoomOut }: Props) {
  return (
    <div className="flex items-center gap-1 shrink-0 px-2 py-1 bg-white border-b border-slate-200">
      <button
        onClick={onZoomOut}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 font-mono text-sm"
      >
        −
      </button>
      <span className="font-mono text-[10px] text-slate-400 w-8 text-center">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={onZoomIn}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 font-mono text-sm"
      >
        +
      </button>
    </div>
  );
}
