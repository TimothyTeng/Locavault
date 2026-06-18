import { useEffect, useRef } from "react";

/**
 * Accessibility for modal dialogs / slide-in panels. Returns a ref to put on the
 * dialog container (give it `tabIndex={-1}`). While open it:
 *  - closes on Escape,
 *  - moves focus into the dialog on open,
 *  - traps Tab focus within the dialog,
 *  - restores focus to the previously-focused element (the trigger) on close.
 *
 * The setup effect depends only on `isOpen` (onClose is read through a ref), so a
 * parent re-render — or local edits inside the dialog — never re-runs it and
 * steals focus. Safe when there are no focusable children.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
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

    const getFocusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus into the dialog (first control, else the container itself).
    (getFocusable()[0] ?? node).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
    // onClose is read via ref so this only runs on open/close, never on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return ref;
}
