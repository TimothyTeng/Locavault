import { useState, useRef, useEffect } from "react";
import {
  PRESET_COLORS,
  BLOCK_KIND_META,
  type Block,
  type BlockKind,
} from "#types/BlockTypes";

type Props = {
  onAdd: (b: Omit<Block, "id">) => void;
  onClose: () => void;
};

// SVG icons per kind
const KIND_ICONS: Record<BlockKind, React.ReactNode> = {
  standard: (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
      <rect
        x="2"
        y="4"
        width="16"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  divider: (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
      <line
        x1="2"
        y1="10"
        x2="18"
        y2="10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="2 2.5"
      />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </svg>
  ),
  stairs: (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
      <path
        d="M2 16 H8 V11 H13 V7 H18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

const KIND_PLACEHOLDERS: Record<BlockKind, string> = {
  standard: "e.g. Freezer, Rack, Counter…",
  divider: "e.g. Section Break, Zone Border…",
  stairs: "e.g. Main Stairs, Emergency Exit…",
};

export function AddBlockModal({ onAdd, onClose }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [kind, setKind] = useState<BlockKind>("standard");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAdd = () => {
    if (!name.trim()) return;
    const base = { name: name.trim(), color };
    onAdd(kind === "divider" ? { ...base, kind } : { ...base, kind });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col
                   overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800 tracking-tight">
            New block type
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full
                       text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path
                d="M1 1l9 9M10 1L1 10"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          {/* Kind selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(BLOCK_KIND_META) as BlockKind[]).map((k) => {
                const active = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    style={active ? { borderColor: color, color } : {}}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2
                                text-xs transition-all cursor-pointer
                                ${
                                  active
                                    ? "bg-opacity-5"
                                    : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                                }`}
                  >
                    {KIND_ICONS[k]}
                    <span className="font-semibold">
                      {BLOCK_KIND_META[k].label}
                    </span>
                    <span
                      className="text-center leading-tight opacity-70"
                      style={{ fontSize: "10px" }}
                    >
                      {BLOCK_KIND_META[k].description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Name
            </label>
            <input
              ref={inputRef}
              placeholder={KIND_PLACEHOLDERS[kind]}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
                         bg-gray-50 text-gray-800 placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-offset-0 transition"
              style={{ ["--tw-ring-color" as string]: `${color}66` }}
            />
          </div>

          {/* Colour */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Colour
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110
                              ${
                                color === c
                                  ? "ring-2 ring-offset-2 ring-current scale-110"
                                  : ""
                              }`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Custom colour"
                className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300
                           cursor-pointer bg-transparent overflow-hidden p-0
                           hover:border-gray-400 transition-colors"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Preview
            </label>

            {kind === "divider" ? (
              <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                <div
                  className="flex-1"
                  style={{ borderTop: `2px dashed ${color}`, opacity: 0.8 }}
                />
                <span
                  className="text-center text-xs font-medium"
                  style={{ color, opacity: 0.75 }}
                >
                  {name || "Divider"}
                </span>
              </div>
            ) : kind === "stairs" ? (
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                style={{ background: `${color}1a`, borderColor: color }}
              >
                <svg
                  viewBox="0 0 32 24"
                  fill="none"
                  className="w-8 h-6 shrink-0"
                  style={{ color }}
                >
                  <path
                    d="M2 22 H10 V15 H18 V9 H26 V2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm font-medium" style={{ color }}>
                  {name || "Stairs"}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
                style={{ background: `${color}1a`, borderColor: color }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="text-sm font-medium" style={{ color }}>
                  {name || "Block name"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-500
                       bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            style={name.trim() ? { background: color } : {}}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed
                       disabled:bg-gray-300 hover:brightness-110"
          >
            Add block
          </button>
        </div>
      </div>
    </>
  );
}
