import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * The app's button scale. `variant` is the colour role, `size` the padding/text/
 * radius step; extra classes (width, shadow, alignment) pass through `className`.
 * Standardises the previously hand-rolled buttons onto one consistent system —
 * extend the maps here rather than re-rolling Tailwind strings at call sites.
 */
const BASE =
  "inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-500",
  secondary: "bg-slate-900 text-white hover:bg-slate-700",
  ghost:
    "border border-slate-200 bg-white text-slate-500 hover:border-slate-300",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
};

const SIZES: Record<Size, string> = {
  sm: "gap-1.5 rounded-lg px-3 py-1.5 text-[11px]",
  md: "gap-2 rounded-lg px-4 py-2 text-sm",
  lg: "gap-2 rounded-xl px-4 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={[BASE, VARIANTS[variant], SIZES[size], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
