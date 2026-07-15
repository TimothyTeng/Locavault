import type { ReactNode } from "react";

export type SegmentedTab<T extends string> = {
  id: T;
  label: ReactNode;
  /** Optional count shown as a small badge after the label. */
  badge?: number;
  /** Override the badge tint (defaults to a neutral slate). */
  badgeClassName?: string;
};

/**
 * A single-select tab group with correct `role="tablist"`/`role="tab"` +
 * `aria-selected` semantics — the accessible replacement for the hand-rolled
 * "which one is active" button rows scattered across the panels.
 *
 * Two looks: "segmented" (a pill track, e.g. the Members editor/viewer switch)
 * and "underline" (a full-width bottom-border bar, e.g. the shopping list's
 * List / Upcoming tabs).
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  variant = "segmented",
  className,
}: {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  variant?: "segmented" | "underline";
  className?: string;
}) {
  if (variant === "underline") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={["flex", className].filter(Boolean).join(" ")}
      >
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 h-9 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
                active
                  ? "border-slate-800 text-slate-800"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span
                  className={
                    t.badgeClassName ??
                    "px-1.5 py-0.5 rounded-full text-[9px] bg-slate-100 text-slate-500"
                  }
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={["flex gap-1 rounded-lg bg-slate-100 p-0.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
              active
                ? "bg-white text-slate-700 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span
                className={
                  t.badgeClassName ??
                  "px-1.5 py-0.5 rounded-full text-[9px] bg-slate-200 text-slate-500"
                }
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
