import type { ReactNode } from "react";

/**
 * Vertical tab rail docked on the right edge of the store screen. Collapsed it's
 * a slim icon strip; on hover it expands to reveal labels (the panel it toggles
 * is non-blocking, so the map stays live). Rendered inside the `relative` content
 * area, desktop only; mobile keeps the toolbar buttons.
 */

export type RailPanel = "shopping" | "recipes" | "collections" | "members";

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 6h18M16 10a4 4 0 01-8 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ForkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 1v4M2 1v3M4 1v3M3 5v6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 1c-1 0-1.5 1-1.5 2.5S8 6 9 6m0-5v10"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BoxesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="4.5"
        width="9"
        height="6"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M3 4.5V3h6v1.5M4.5 2.5h3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="4.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1 10c0-2 1.5-3.5 3.5-3.5S8 8 8 10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M8.5 5v3M10 6.5H7"
        stroke="currentColor"
        strokeWidth="1.2"
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
    <div
      className={`group absolute right-0 top-0 bottom-0 z-40 flex w-11 flex-col gap-0.5 overflow-hidden border-l border-slate-200 bg-white/95 py-2 backdrop-blur transition-[width] duration-200 ease-out ${
        active === null
          ? "hover:w-48 hover:shadow-[-8px_0_24px_rgba(15,23,42,0.08)]"
          : ""
      }`}
    >
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
              className={`relative flex h-11 w-full shrink-0 items-center gap-3 pl-3 transition-colors ${
                on
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              <span className="relative flex w-5 shrink-0 items-center justify-center">
                {t.icon}
                {t.badge && t.badge > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                    {t.badge}
                  </span>
                ) : null}
              </span>
              <span className="whitespace-nowrap text-[13px] font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {t.label}
              </span>
            </button>
          );
        })}
    </div>
  );
}
