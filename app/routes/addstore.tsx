import type { Route } from "./+types/home";
import { Show } from "@clerk/react-router";
import Navbar from "~/components/home/navbar";
import StoreViewFinder from "~/components/addstore/storeViewFinder/storeViewFinder";
export { loader, action } from "#utils/loaders/addstore.loader";
export { RouteErrorBoundary as ErrorBoundary } from "~/components/common/errorState";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Add Store — Locavault" },
    {
      name: "description",
      content: "Create a new store and draw its floor plan.",
    },
  ];
}

export default function AddStore() {
  return (
    <Show
      when="signed-in"
      fallback={
        <div className="flex items-center justify-center h-screen text-xs font-mono text-slate-400">
          You must be signed in to add a store.
        </div>
      }
    >
      {/* md:pt-16 clears the floating pill (~64px). No padding on mobile — the
          drawer lives at the bottom and doesn't affect the canvas area at all. */}
      <div className="flex flex-col h-dvh overflow-hidden bg-white md:pt-16">
        <Navbar />
        <div className="flex-1 min-h-0">
          <StoreViewFinder />
        </div>
      </div>
    </Show>
  );
}
