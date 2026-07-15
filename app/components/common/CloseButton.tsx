/**
 * The round ✕ button used to dismiss panels, modals and popups. Centralises the
 * glyph + adds an `aria-label` (most call sites lacked one). The button's own
 * classes pass through verbatim via `className`, so swapping a hand-rolled button
 * for this one is visually identical; only the icon is standardised. `size` keeps
 * each call site's original glyph dimensions.
 */
const DEFAULT_CLASS =
  "w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-400 transition-all";

export function CloseButton({
  onClick,
  className,
  size = 10,
  strokeWidth = 1.6,
  label = "Close",
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={className ?? DEFAULT_CLASS}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden
      >
        <path
          d="M1 1l8 8M9 1L1 9"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
