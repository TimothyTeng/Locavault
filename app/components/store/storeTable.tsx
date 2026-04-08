import type { Item } from "#types/storeTypes";
import type { AccessLevel } from "~/types/memberTypes";
import { StoreTableRow } from "./storeTableRow";

type Props = {
  items: Item[];
  selectedItemId: string | null;
  onSelect: (item: Item) => void;
  onSave: (updated: Item) => void;
  onDelete: (itemId: string) => void;
  accessLevel: AccessLevel;
  storeIsPublic: boolean;
  onToggleItemVisibility: (itemId: string, isPublic: boolean) => void;
};

export function StoreTable({
  items,
  selectedItemId,
  onSelect,
  onSave,
  onDelete,
  accessLevel,
  storeIsPublic,
  onToggleItemVisibility,
}: Props) {
  const isOwner = accessLevel === "owner";

  const baseHeaders = [
    { label: "#", className: "w-8 text-right" },
    { label: "Name", className: "" },
    { label: "Qty", className: "w-20 text-right" },
    { label: "Expiry", className: "w-24 text-right" },
    { label: "Est Depletion", className: "w-24 text-right" },
    { label: "Status", className: "w-24" },
  ];
  if (isOwner && storeIsPublic)
    baseHeaders.push({ label: "Public", className: "w-14" });
  baseHeaders.push({ label: "", className: "w-14" });

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="border-b border-slate-200">
            {baseHeaders.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 ${h.className}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={baseHeaders.length}
                className="px-4 py-10 text-center text-[11px] text-slate-300 font-mono"
              >
                No items found
              </td>
            </tr>
          ) : (
            items.map((item, i) => (
              <StoreTableRow
                key={item.id}
                item={item}
                index={i}
                isSelected={selectedItemId === item.id}
                onSelect={onSelect}
                onSave={onSave}
                onDelete={onDelete}
                isOwner={isOwner}
                storeIsPublic={storeIsPublic}
                onToggleVisibility={onToggleItemVisibility}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
