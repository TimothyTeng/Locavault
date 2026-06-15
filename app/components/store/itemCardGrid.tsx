import type { Item } from "~/types/storeTypes";
import { ItemCard } from "./itemCard";

/** A responsive grid of type-aware item cards (zone contents / cards view). */
export function ItemCardGrid({
  items,
  onSave,
  onDelete,
  onMarkOut,
  onAddToList,
  isOwner,
  storeIsPublic,
  onToggleVisibility,
  emptyLabel = "Nothing here yet",
  bottomPad = false,
}: {
  items: Item[];
  onSave: (updated: Item) => void;
  onDelete: (itemId: string) => void;
  onMarkOut?: (item: Item) => void;
  onAddToList?: (item: Item) => void;
  isOwner: boolean;
  storeIsPublic: boolean;
  onToggleVisibility: (itemId: string, isPublic: boolean) => void;
  emptyLabel?: string;
  bottomPad?: boolean;
}) {
  return (
    <div className={`flex-1 overflow-auto p-3 ${bottomPad ? "pb-[50vh]" : ""}`}>
      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-[11px] text-slate-300 font-mono">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 content-start">
          {items.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              onSave={onSave}
              onDelete={onDelete}
              onMarkOut={onMarkOut}
              onAddToList={onAddToList}
              isOwner={isOwner}
              storeIsPublic={storeIsPublic}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </div>
      )}
    </div>
  );
}
