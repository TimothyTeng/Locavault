import { useNavigation } from "react-router";

/**
 * Thin top progress bar shown during route navigation, so moving between pages
 * (which re-runs loaders) reads as "loading" instead of a frozen/blank screen.
 * Driven by the router's navigation state; ignores background revalidation so it
 * doesn't flicker on the store page's 15s poll.
 */
export function RouteProgress() {
  const active = useNavigation().state === "loading";
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full w-1/3 rounded-r bg-emerald-500"
        style={{ animation: "lvprogress 1.1s ease-in-out infinite" }}
      />
    </div>
  );
}
