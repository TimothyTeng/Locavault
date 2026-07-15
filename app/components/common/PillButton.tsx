import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "dark" | "outline" | "subtle";

/**
 * The app's signature uppercase mono "pill" control — the small
 * `uppercase tracking-widest font-bold` buttons used throughout the panels and
 * toolbars. Previously hand-rolled at ~15 call sites with drifting slate shades,
 * radii and text sizes; this standardises them. `tone` is the colour role:
 *  - `dark`    — solid slate CTA (Add, New, Save)
 *  - `outline` — bordered, fills dark on hover (Copy invite, secondary actions)
 *  - `subtle`  — quiet text-only until hover (Cancel, dismiss)
 *
 * Extra classes (width, self-alignment) pass through via `className`.
 */
const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

const TONES: Record<Tone, string> = {
  dark: "bg-slate-900 text-white hover:bg-slate-700",
  outline:
    "border border-slate-300 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800",
  subtle:
    "border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700",
};

export function PillButton({
  tone = "dark",
  className,
  children,
  ...rest
}: {
  tone?: Tone;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={[BASE, TONES[tone], className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
