import { AddItemForm } from "~/components/addItem/addItemForm";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Add item" },
    { name: "description", content: "Add an item to the store" },
  ];
}

export default function AddItem() {
  return (
    <div>
      <AddItemForm
        onSubmit={(e) => {
          console.log(e);
        }}
      />
    </div>
  );
}
