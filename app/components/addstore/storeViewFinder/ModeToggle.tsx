import type { ResizeHandleAxis } from "react-grid-layout";

type Mode = "select" | "size";

type Props = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

// Cursor/pointer icon for Select Mode
function SelectIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 2L6.5 12L8.2 8.2L12 6.5L2 2Z"
        stroke={active ? "#1e293b" : "#94a3b8"}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={active ? "#1e293b" : "none"}
      />
    </svg>
  );
}

// Resize/expand icon for Size Mode
function SizeIcon({ active }: { active: boolean }) {
  const color = active ? "#1e293b" : "#94a3b8";
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* top-left corner */}
      <path
        d="M1 5V1H5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* bottom-right corner */}
      <path
        d="M13 9V13H9"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* diagonal arrow */}
      <line
        x1="2"
        y1="12"
        x2="12"
        y2="2"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M8 2H12V6"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 12H2V8"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Edit mode"
      className="inline-flex items-center rounded border border-slate-200 bg-slate-100 p-[3px] gap-[3px]"
    >
      <button
        onClick={() => onChange("select")}
        aria-pressed={mode === "select"}
        title="Select Mode"
        className={[
          "flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all duration-150",
          mode === "select"
            ? "bg-white text-slate-800 shadow-sm border border-slate-200"
            : "text-slate-400 hover:text-slate-600 border border-transparent",
        ].join(" ")}
      >
        <SelectIcon active={mode === "select"} />
        <span>Select</span>
      </button>

      <button
        onClick={() => onChange("size")}
        aria-pressed={mode === "size"}
        title="Size Mode"
        className={[
          "flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all duration-150",
          mode === "size"
            ? "bg-white text-slate-800 shadow-sm border border-slate-200"
            : "text-slate-400 hover:text-slate-600 border border-transparent",
        ].join(" ")}
      >
        <SizeIcon active={mode === "size"} />
        <span>Size</span>
      </button>
    </div>
  );
}

// ─── Helper: derive ResizeHandleAxis[] from Mode ───────────────────────────
export const ALL_HANDLES: ResizeHandleAxis[] = ["se"];

export function handlesForMode(mode: Mode): ResizeHandleAxis[] {
  return mode === "size" ? ALL_HANDLES : [];
}
