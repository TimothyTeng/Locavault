import { useState } from "react";
import { FieldLabel } from "../addstore/storeViewFinder/StoreForm";

type Props = {
  onSubmit: (data: {
    name: string;
    description: string;
    quantity: number;
    inStore: boolean;
    selectedBlockId?: string | null;
  }) => void;
  selectedBlockId?: string | null; // ← add
  selectedBlockLabel?: string;
};

export function AddItemForm({
  onSubmit,
  selectedBlockId,
  selectedBlockLabel,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [inStore, setInStore] = useState(false);
  const [nameError, setNameError] = useState(false);

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[12px] font-mono text-slate-800 placeholder-slate-300 shadow-sm outline-none transition-all duration-150 focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setNameError(true);
          return;
        }
        setNameError(false);
        onSubmit({ name, description, quantity, inStore, selectedBlockId });
      }}
      className="flex flex-col gap-6"
    >
      {/* Name */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Item Name</FieldLabel>
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder="e.g. Box of Screws"
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(false);
          }}
          className={`${inputClass} ${nameError ? "border-red-400 ring-2 ring-red-100" : ""}`}
        />
        {nameError && (
          <p className="text-[10px] text-red-500 font-medium mt-0.5">
            Item name is required.
          </p>
        )}
      </div>

      {/* Quantity */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Quantity</FieldLabel>
        <input
          type="number"
          value={quantity}
          min={0}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={description}
          placeholder="Describe this item..."
          rows={4}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[11px] font-mono text-slate-800 placeholder-slate-300 shadow-sm outline-none transition-all duration-150 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 leading-relaxed"
        />
      </div>

      {/* In Store */}
      <div className="flex flex-col gap-2">
        <FieldLabel>In Store</FieldLabel>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setInStore((prev) => !prev)}
            className={[
              "relative w-10 h-5 rounded-full border transition-all duration-200",
              inStore
                ? "bg-slate-800 border-slate-800"
                : "bg-white border-slate-300",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200",
                inStore ? "left-[calc(100%-18px)]" : "left-0.5",
              ].join(" ")}
            />
          </button>
          <span className="text-[11px] font-mono text-slate-500">
            {inStore ? "Currently in store" : "Not in store"}
          </span>
        </div>
      </div>
      {selectedBlockId ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>Block</FieldLabel>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-mono text-slate-600">
            {selectedBlockLabel || selectedBlockId}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <FieldLabel>Block</FieldLabel>
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-mono text-slate-300">
            Click a block on the floor plan to assign
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-all duration-150 hover:bg-slate-800 hover:text-white hover:border-slate-800"
      >
        Add Item
      </button>
    </form>
  );
}
