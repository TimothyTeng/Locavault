import type { ReactNode } from "react";
import { CloseButton } from "./CloseButton";
import { useSidePanel } from "./useSidePanel";

/**
 * The shared shell for the store-page rail panels (Shopping list, Recipes,
 * Calendar, Collections, Members). Non-blocking by design — the map and toolbar
 * stay live behind it (DESIGN.md §11 #3): no scrim, no `aria-modal`, no focus
 * trap (see `useSidePanel`). It slides in/out and is always mounted so it can
 * animate both directions.
 *
 * Layout: desktop docks against the right-edge `PanelRail` (`right-11`); mobile
 * is either a top sheet that leaves the bottom half for the zone-picker minimap
 * (`mobileVariant="sheet"`, used by the shopping list) or a full-height panel
 * from the right (`mobileVariant="full"`, the default).
 *
 * Header: pass a fully custom `header`, or let the standard one be built from
 * `title` / `eyebrow` / `icon` / `onBack`. `belowHeader` hosts a tab bar.
 */
export function SidePanel({
  isOpen,
  onClose,
  isMobile = false,
  ariaLabel,
  title,
  eyebrow,
  icon,
  onBack,
  headerRight,
  header,
  belowHeader,
  mobileVariant = "full",
  desktopVariant = "rail",
  bodyClassName,
  chromeless = false,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  /** Accessible name for the panel region. */
  ariaLabel: string;
  /** Standard-header title (ignored when `header` is provided). */
  title?: string;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  icon?: ReactNode;
  /** Renders a back chevron left of the title when provided. */
  onBack?: () => void;
  /** Controls right of the title in the standard header. */
  headerRight?: ReactNode;
  /** Fully custom header, replacing the standard one. */
  header?: ReactNode;
  /** Content between header and body — typically a tab bar. */
  belowHeader?: ReactNode;
  mobileVariant?: "full" | "sheet";
  /** Desktop docking: "rail" (docked beside the right-edge PanelRail, the
   *  default) or "overlay" (a wider slide-in from the screen edge, above the
   *  rail — used by the toolbar-opened Add Item panel). */
  desktopVariant?: "rail" | "overlay";
  bodyClassName?: string;
  /** Render no header/body chrome — the children own the full panel (used by
   *  panels whose views bring their own headers, e.g. Recipes/Calendar). */
  chromeless?: boolean;
  children: ReactNode;
}) {
  const ref = useSidePanel<HTMLDivElement>(isOpen, onClose);

  const slideX = isOpen
    ? "translate-x-0"
    : "translate-x-full invisible pointer-events-none";

  let shell: string[];
  if (isMobile && mobileVariant === "sheet") {
    // Top sheet that leaves the bottom half free for the zone-picker minimap.
    shell = [
      "fixed top-10 left-0 right-0 z-20 h-[calc(57vh-7rem)]",
      "border-b border-slate-200",
      isOpen
        ? "translate-y-0"
        : "-translate-y-full invisible pointer-events-none",
    ];
  } else if (isMobile) {
    shell = [
      "absolute inset-y-0 right-0 w-full z-30 border-l border-slate-200",
      slideX,
    ];
  } else if (desktopVariant === "overlay") {
    // A wider slide-in above the rail (toolbar-opened), not docked to it.
    shell = [
      "fixed top-16 right-0 h-[calc(100vh-4rem)] w-1/2 z-50 border-l border-slate-200",
      slideX,
    ];
  } else {
    // Docked beside the right-edge PanelRail.
    shell = [
      "absolute inset-y-0 right-11 w-full max-w-md z-30 border-l border-slate-200",
      slideX,
    ];
  }

  const standardHeader = (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 md:px-5 h-12 md:h-14 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="text-slate-400 transition-colors hover:text-slate-700"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 3l-5 5 5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {icon && <span className="text-slate-800 shrink-0">{icon}</span>}
        <div className="min-w-0">
          {eyebrow && (
            <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {eyebrow}
            </span>
          )}
          <span className="block truncate text-[10px] md:text-[13px] font-bold uppercase tracking-widest text-slate-800">
            {title}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {headerRight}
        <CloseButton onClick={onClose} />
      </div>
    </div>
  );

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={ariaLabel}
      tabIndex={-1}
      className={[
        ...shell,
        "flex flex-col bg-white shadow-2xl font-mono outline-none",
        "transition-transform duration-300 ease-out",
      ].join(" ")}
    >
      {chromeless ? (
        children
      ) : (
        <>
          {header ?? standardHeader}
          {belowHeader}
          <div
            className={
              bodyClassName ?? "flex-1 min-h-0 flex flex-col overflow-hidden"
            }
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
