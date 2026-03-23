import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { Show } from "@clerk/react-router";
import Navbar from "~/components/home/navbar";
import StoreViewFinder from "~/components/addstore/storeViewFinder/storeViewFinder";
import type { loader } from "#utils/loaders/editstore.loader";

export { loader } from "#utils/loaders/editstore.loader";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Edit Store" },
    { name: "description", content: "Edit your store layout" },
  ];
}

// ── Component ──────────────────────────────────────────────

export default function EditStore() {
  const { initialData } = useLoaderData<typeof loader>();

  return (
    <Show
      when="signed-in"
      fallback={
        <div className="flex items-center justify-center h-screen text-xs font-mono text-slate-400">
          You must be signed in to edit a store.
        </div>
      }
    >
      <div className="flex flex-col h-dvh overflow-hidden pt-[var(--navbar-height,64px)]">
        <Navbar />
        <div className="flex-1 min-h-0">
          <StoreViewFinder initialData={initialData} />
        </div>
      </div>
    </Show>
  );
}
