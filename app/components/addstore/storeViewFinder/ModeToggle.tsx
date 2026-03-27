import type { ResizeHandleAxis } from "react-grid-layout";

export type Mode = "select" | "size" | "draw";

type Props = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

// ─── Icons ────────────────────────────────────────────────

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
      <path
        d="M1 5V1H5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 9V13H9"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function DrawIcon({ active }: { active: boolean }) {
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
      {/* Pencil body */}
      <path
        d="M9.5 2.5L11.5 4.5L5 11H3V9L9.5 2.5Z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={active ? color : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      {/* Tip line */}
      <path
        d="M8 4L10 6"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────

const MODES: {
  key: Mode;
  label: string;
  Icon: React.FC<{ active: boolean }>;
}[] = [
  { key: "select", label: "Select", Icon: SelectIcon },
  { key: "size", label: "Size", Icon: SizeIcon },
  { key: "draw", label: "Draw", Icon: DrawIcon },
];

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Edit mode"
      className="inline-flex items-center rounded border border-slate-200 bg-slate-100 p-[3px] gap-[3px]"
    >
      {MODES.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={mode === key}
          title={`${label} Mode`}
          className={[
            "flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all duration-150",
            mode === key
              ? "bg-white text-slate-800 shadow-sm border border-slate-200"
              : "text-slate-400 hover:text-slate-600 border border-transparent",
          ].join(" ")}
        >
          <Icon active={mode === key} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

export const ALL_HANDLES: ResizeHandleAxis[] = ["se"];

export function handlesForMode(mode: Mode): ResizeHandleAxis[] {
  return mode === "size" ? ALL_HANDLES : [];
}
