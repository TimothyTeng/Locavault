import type { ItemType } from "~/types/itemTypeTypes";

/** Line-style SVG glyphs per item type — inherits `currentColor`. */
const PATHS: Record<ItemType, React.ReactNode> = {
  food: (
    // apple
    <>
      <path d="M8 5.2C7 3.3 4.5 3.4 3.7 5.4 2.8 7.6 4 11 6 12.4c1.2.8 2.8.8 4 0 2-1.4 3.2-4.8 2.3-7-.8-2-3.3-2.1-4.3-.2z" />
      <path d="M8 5.2c0-1 .4-2 1.4-2.5" />
    </>
  ),
  medication: (
    // capsule
    <>
      <rect x="3" y="6" width="10" height="4" rx="2" />
      <path d="M8 6v4" />
    </>
  ),
  supplies: (
    // spray bottle
    <>
      <path d="M6.5 6.5h3v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-6z" />
      <path d="M6.5 6.5V4.5h2.5" />
      <path d="M9 3.3h2.4M9 5h2" />
    </>
  ),
  equipment: (
    // wrench
    <path d="M12.6 4.1a2.5 2.5 0 0 1-3.2 3.2l-3.9 3.9a1.3 1.3 0 1 1-1.8-1.8l3.9-3.9a2.5 2.5 0 0 1 3.2-3.2L9.5 4l.6 1.9 1.9.6 1-1.4z" />
  ),
  clothing: (
    // t-shirt
    <path d="M5.6 3.4 3.2 5.3l1.4 1.9 1-.7V13a.5.5 0 0 0 .5.5h3.8a.5.5 0 0 0 .5-.5V6.5l1 .7 1.4-1.9-2.4-1.9-1.4 1.1a1.2 1.2 0 0 1-1.8 0L5.6 3.4z" />
  ),
  document: (
    // page with folded corner
    <>
      <path d="M4.7 2.5h3.6l3 3v8a.5.5 0 0 1-.5.5H4.7a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5z" />
      <path d="M8.3 2.5v3h3" />
      <path d="M6 9h4M6 11h3" />
    </>
  ),
  other: (
    // box
    <>
      <path d="M8 2.6 13 5v6l-5 2.4L3 11V5l5-2.4z" />
      <path d="M3 5l5 2.4L13 5" />
      <path d="M8 7.4v6" />
    </>
  ),
};

export function TypeIcon({
  type,
  className = "w-3.5 h-3.5",
}: {
  type: ItemType;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[type]}
    </svg>
  );
}
