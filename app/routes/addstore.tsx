import StoreViewFinder from "~/components/addstore/storeViewFinder";
import type { Route } from "./+types/home";
import { Show } from "@clerk/react-router";
import Navbar from "~/components/home/navbar";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Add Store" },
    { name: "description", content: "Add a new location" },
  ];
}

export default function AddStore() {
  return (
    <>
      <Show
        when="signed-in"
        fallback={
          <div className="p-4">You must be signed in to add a store.</div>
        }
      >
        <div className="p-4">
          <h1 className="text-2xl font-semibold mb-4">Add a New Store</h1>
          <p className="mb-6 text-gray-600">
            To get started, please enter the address of the new store you want
            to add. We'll help you find the exact location and set it up in your
            inventory system.
          </p>
          <div style={{ width: "50%", height: "50%" }}>
            <StoreViewFinder />
          </div>
        </div>
      </Show>
    </>
  );
}
