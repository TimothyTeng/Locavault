import type { Route } from "./+types/templates.new";
import { Show } from "@clerk/react-router";
import { useSubmit } from "react-router";
import Navbar from "~/components/home/navbar";
import StoreViewFinder from "~/components/addstore/storeViewFinder/storeViewFinder";
import type { BlockDetails } from "~/types/storeViewFinderTypes";
import type { Wall } from "~/types/wallTypes";

export { loader, action } from "#utils/loaders/templates.new.loader";
export { RouteErrorBoundary as ErrorBoundary } from "~/components/common/errorState";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New Template — Locavault" },
    { name: "description", content: "Design a reusable store layout." },
  ];
}

export default function NewTemplatePage() {
  const submit = useSubmit();

  const handleSave = (payload: {
    name: string;
    tags: string[];
    description: string;
    rows: number;
    cols: number;
    blocks: BlockDetails[];
    walls: Wall[];
  }) => {
    // From-scratch templates start private; owners flip them public in the gallery.
    submit(
      {
        name: payload.name,
        description: payload.description,
        tags: JSON.stringify(payload.tags),
        rows: payload.rows,
        cols: payload.cols,
        blocks: payload.blocks,
        walls: payload.walls,
        isPublic: false,
      },
      { method: "post", encType: "application/json" },
    );
  };

  return (
    <Show
      when="signed-in"
      fallback={
        <div className="flex items-center justify-center h-screen text-xs font-mono text-slate-400">
          You must be signed in to create a template.
        </div>
      }
    >
      <div className="flex flex-col h-dvh overflow-hidden bg-white md:pt-16">
        <Navbar />
        <div className="flex-1 min-h-0">
          <StoreViewFinder onSave={handleSave} saveLabel="Save template" />
        </div>
      </div>
    </Show>
  );
}
