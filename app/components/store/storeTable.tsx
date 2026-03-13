import { useState } from "react";

export type Item = {
  id: string;
  name: string;
  quantity: number;
  description: string | null;
  storeId: string;
  blockId: string | null;
  createdAt: Date | null;
};

type Props = {
  items: Item[];
  selectedItemId: string | null;
  onSelect: (item: Item) => void;
  onDoubleClick: (item: Item) => void;
};

export function StoreTable({
  items,
  selectedItemId,
  onSelect,
  onDoubleClick,
}: Props) {
  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="border-b border-slate-200">
            {["#", "Name", "Qty", "Description", "Location", "In Store"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-10 text-center text-[11px] text-slate-300 font-mono"
              >
                No items found
              </td>
            </tr>
          ) : (
            items.map((item, i) => (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                onDoubleClick={() => onDoubleClick(item)}
                className={[
                  "border-b border-slate-100 cursor-pointer transition-colors duration-100",
                  selectedItemId === item.id
                    ? "bg-slate-800 text-white"
                    : "hover:bg-slate-50 text-slate-700",
                ].join(" ")}
              >
                <td className="px-4 py-3 text-[10px] font-mono opacity-40">
                  {i + 1}
                </td>
                <td className="px-4 py-3 text-[11px] font-bold">{item.name}</td>
                <td className="px-4 py-3 text-[11px] font-mono">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-[11px] text-slate-400 max-w-[200px] truncate">
                  {item.description ?? "—"}
                </td>
                <td className="px-4 py-3 text-[10px] font-mono">
                  ({item.blockId})
                </td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      "inline-block w-1.5 h-1.5 rounded-full",
                      item.quantity > 0 ? "bg-emerald-400" : "bg-slate-300",
                    ].join(" ")}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
