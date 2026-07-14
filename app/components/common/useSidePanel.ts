import { useEffect, useRef } from "react";

/**
 * Accessibility for **non-blocking** slide-in side panels (the store-page rail:
 * Shopping list, Recipes, Calendar, Collections, Members). Unlike `useDialog`,
 * it deliberately does **not** trap Tab focus and the panel is **not**
 * `aria-modal` — the map and toolbar stay live and reachable behind it
 * (DESIGN.md §11 #3, the tab-rail decision).
 *
 * Returns a ref to put on the panel container (give it `tabIndex={-1}`). While
 * open it:
 *  - closes on Escape,
 *  - moves focus into the panel on open (first control, else the container),
 *  - restores focus to the previously-focused element (the trigger) on close.
 *
 * The setup effect depends only on `isOpen` (onClose is read through a ref), so a
 * parent re-render — or local edits inside the panel — never re-runs it and
 * steals focus.
 */
export function useSidePanel<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const firstFocusable = () =>
      node.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

    // Move focus into the panel (first control, else the container itself).
    (firstFocusable() ?? node).focus();

    // Escape listens on the window, not the panel node: because focus is *not*
    // trapped (non-blocking), it may have left the panel for the live map, and a
    // node-scoped listener would then miss the key. Only one rail panel is open
    // at a time, so a window listener is unambiguous.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
    // Depends only on isOpen by design — onClose is read through onCloseRef.
  }, [isOpen]);

  return ref;
}
