import type { Route } from "./+types/home";
import { Show } from "@clerk/react-router";
import Navbar from "~/components/home/navbar";
import StoreViewFinder from "~/components/addstore/storeViewFinder/storeViewFinder";
import { StoreForm } from "~/components/addstore/storeViewFinder/StoreForm";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Add Store" },
    { name: "description", content: "Add a new location" },
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
      <div className="flex flex-col h-dvh overflow-hidden pt-[var(--navbar-height,64px)]">
        <Navbar />
        <div className="flex-1 min-h-0">
          <StoreViewFinder />
        </div>
      </div>
    </Show>
  );
}
