import type { BlockKind } from "~/types/BlockTypes";

export const PRESET_TAGS = ["Home", "Office", "Storage", "Food", "Electronics"];

export const TAG_COLORS: Record<string, { idle: string; active: string }> = {
  Home: {
    idle: "bg-sky-50 border-sky-200 text-sky-600 hover:border-sky-400 hover:bg-sky-100",
    active: "bg-sky-500 border-sky-500 text-white",
  },
  Office: {
    idle: "bg-violet-50 border-violet-200 text-violet-600 hover:border-violet-400 hover:bg-violet-100",
    active: "bg-violet-500 border-violet-500 text-white",
  },
  Storage: {
    idle: "bg-amber-50 border-amber-200 text-amber-600 hover:border-amber-400 hover:bg-amber-100",
    active: "bg-amber-500 border-amber-500 text-white",
  },
  Food: {
    idle: "bg-emerald-50 border-emerald-200 text-emerald-600 hover:border-emerald-400 hover:bg-emerald-100",
    active: "bg-emerald-500 border-emerald-500 text-white",
  },
  Electronics: {
    idle: "bg-rose-50 border-rose-200 text-rose-600 hover:border-rose-400 hover:bg-rose-100",
    active: "bg-rose-500 border-rose-500 text-white",
  },
};

export const CUSTOM_COLOR = {
  idle: "bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-200",
  active: "bg-slate-700 border-slate-700 text-white",
};

// SVG icons per kind
export const KIND_ICONS: Record<BlockKind, React.ReactNode> = {
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
  room: (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
      <rect
        x="2.5"
        y="3.5"
        width="15"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="3 2.5"
      />
    </svg>
  ),
};

export const KIND_PLACEHOLDERS: Record<BlockKind, string> = {
  standard: "e.g. Freezer, Rack, Counter…",
  divider: "e.g. Section Break, Zone Border…",
  stairs: "e.g. Main Stairs, Emergency Exit…",
  room: "e.g. Kitchen, Garage, Bedroom…",
};
