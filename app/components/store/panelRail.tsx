import type { ReactNode } from "react";

/**
 * Vertical tab rail docked on the right edge of the store screen. Each tab
 * toggles one of the non-blocking side panels (it expands to the rail's left,
 * over the map — no backdrop, so the map stays live). Rendered inside the
 * `relative` content area, desktop only; mobile keeps the toolbar buttons.
 */

export type RailPanel = "shopping" | "recipes" | "collections" | "members";

function BagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 6h18M16 10a4 4 0 01-8 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ForkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 1v4M2 1v3M4 1v3M3 5v6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 1c-1 0-1.5 1-1.5 2.5S8 6 9 6m0-5v10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BoxesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="4.5"
        width="9"
        height="6"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M3 4.5V3h6v1.5M4.5 2.5h3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="4.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M1 10c0-2 1.5-3.5 3.5-3.5S8 8 8 10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M8.5 5v3M10 6.5H7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PanelRail({
  active,
  onSelect,
  canEdit,
  isOwner,
  restockCount = 0,
}: {
  active: RailPanel | null;
  onSelect: (panel: RailPanel) => void;
  canEdit: boolean;
  isOwner: boolean;
  restockCount?: number;
}) {
  const tabs: {
    id: RailPanel;
    label: string;
    icon: ReactNode;
    show: boolean;
    badge?: number;
  }[] = [
    {
      id: "shopping",
      label: "Shopping list",
      icon: <BagIcon />,
      show: canEdit,
      badge: restockCount,
    },
    { id: "recipes", label: "Recipes", icon: <ForkIcon />, show: true },
    {
      id: "collections",
      label: "Collections",
      icon: <BoxesIcon />,
      show: true,
    },
    { id: "members", label: "Members", icon: <PeopleIcon />, show: isOwner },
  ];

  return (
    <div className="absolute right-0 top-0 bottom-0 z-40 flex w-11 flex-col items-center gap-1.5 border-l border-slate-200 bg-white py-2">
      {tabs
        .filter((t) => t.show)
        .map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-pressed={on}
              aria-label={t.label}
              title={t.label}
              className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                on
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {t.icon}
              {t.badge && t.badge > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-bold text-white">
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
    </div>
  );
}
