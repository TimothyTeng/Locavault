import type { Item } from "#types/storeTypes";
import type { AccessLevel } from "~/types/memberTypes";
import { StoreTableRow } from "./storeTableRow";

type Props = {
  items: Item[];
  selectedItemId: string | null;
  onSelect: (item: Item) => void;
  onSave: (updated: Item) => void;
  accessLevel: AccessLevel;
  onToggleItemVisibility: (itemId: string, isPublic: boolean) => void;
};

export function StoreTable({
  items,
  selectedItemId,
  onSelect,
  onSave,
  accessLevel,
  onToggleItemVisibility,
}: Props) {
  const isOwner = accessLevel === "owner";

  const headers = ["#", "Name", "Qty", "Description", "Location", "In Store"];
  if (isOwner) headers.push("Public", "");
  else headers.push("");

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="border-b border-slate-200">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
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
                isOwner={isOwner}
                onToggleVisibility={onToggleItemVisibility}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
