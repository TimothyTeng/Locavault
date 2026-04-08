import { useState } from "react";
import type { Item, ItemStatus } from "#types/storeTypes";
import {
  expiryDateRemainingDays,
  remainingDays,
} from "~/utils/helpers/store.helper";
import { getItemStatus } from "~/utils/helpers/storeTable.helper";
import { ItemDetailPopup } from "./ItemDetailPopup";

type Props = {
  item: Item;
  index: number;
  isSelected: boolean;
  onSelect: (item: Item) => void;
  onSave: (updated: Item) => void;
  onDelete: (itemId: string) => void;
  isOwner: boolean;
  storeIsPublic: boolean;
  onToggleVisibility: (itemId: string, isPublic: boolean) => void;
};

const STATUS_STYLES: Record<ItemStatus, { pill: string; label: string }> = {
  out: {
    pill: "bg-slate-100 text-slate-400 border border-slate-200",
    label: "Out",
  },
  low: { pill: "bg-red-50 text-red-500 border border-red-200", label: "Low" },
  expiring: {
    pill: "bg-amber-50 text-amber-600 border border-amber-200",
    label: "Expiring",
  },
  ok: {
    pill: "bg-emerald-50 text-emerald-600 border border-emerald-200",
    label: "OK",
  },
};

// ── Row ────────────────────────────────────────────────────

export function StoreTableRow({
  item,
  index,
  isSelected,
  onSelect,
  onSave,
  onDelete,
  isOwner,
  storeIsPublic,
  onToggleVisibility,
}: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const isLowStock =
    item.minQuantity != null && item.quantity <= item.minQuantity;

  const status = getItemStatus(item);
  const { pill, label: statusLabel } = STATUS_STYLES[status];

  const expiryDays = expiryDateRemainingDays(item.expiryDate);
  const depletionDays =
    item.useRate && item.useRatePeriod
      ? remainingDays(
          item.createdAt,
          item.useRate.toString(),
          item.useRatePeriod,
          item.quantity,
        )
      : null;

  const expiryColor = isSelected
    ? "text-slate-300"
    : expiryDays != null && expiryDays <= 0
      ? "text-red-500"
      : expiryDays != null && expiryDays <= 30
        ? "text-amber-500"
        : "text-slate-400";

  const depletionColor = isSelected
    ? "text-slate-300"
    : depletionDays != null && Number(depletionDays) <= 7
      ? "text-red-500"
      : depletionDays != null && Number(depletionDays) <= 30
        ? "text-amber-500"
        : "text-slate-400";

  const cellClass = "px-3 py-2.5 text-[11px]";

  const handleSaveAndClose = (updated: Item) => {
    onSave(updated);
    setShowDetail(false);
  };

  const handleDeleteAndClose = (itemId: string) => {
    onDelete(itemId);
    setShowDetail(false);
  };

  return (
    <>
      {showDetail && (
        <ItemDetailPopup
          item={item}
          onClose={() => setShowDetail(false)}
          onSave={handleSaveAndClose}
          onDelete={handleDeleteAndClose}
        />
      )}

      <tr
        onClick={() => onSelect(item)}
        onDoubleClick={() => setShowDetail(true)}
        className={[
          "border-b border-slate-100 cursor-pointer transition-colors duration-100 group",
          isSelected
            ? "bg-slate-800 text-white"
            : "hover:bg-slate-50 text-slate-700",
        ].join(" ")}
      >
        {/* # */}
        <td
          className={`${cellClass} w-8 text-right text-[10px] font-mono opacity-30`}
        >
          {index + 1}
        </td>

        {/* Name */}
        <td className={`${cellClass} font-semibold`}>
          <div className="flex items-center gap-2">
            {item.name}
            {isLowStock && (
              <span className="text-[8px] font-bold uppercase tracking-widest text-red-400 border border-red-200 rounded px-1 py-0.5 leading-none">
                low
              </span>
            )}
          </div>
        </td>

        {/* Qty */}
        <td className={`${cellClass} w-20 text-right font-mono tabular-nums`}>
          {item.quantity}
          {item.unit ? (
            <span className="text-[10px] opacity-50 ml-0.5">{item.unit}</span>
          ) : (
            ""
          )}
        </td>

        {/* Expiry */}
        <td
          className={`${cellClass} w-24 text-right text-[10px] font-mono tabular-nums ${expiryColor}`}
        >
          {expiryDays != null ? (
            `${expiryDays}d`
          ) : (
            <span className="opacity-30">—</span>
          )}
        </td>

        {/* Est depletion */}
        <td
          className={`${cellClass} w-24 text-right text-[10px] font-mono tabular-nums ${depletionColor}`}
        >
          {depletionDays != null ? (
            `${depletionDays}d`
          ) : (
            <span className="opacity-30">—</span>
          )}
        </td>

        {/* Status pill */}
        <td className={`${cellClass} w-24`}>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${pill}`}
          >
            {statusLabel}
          </span>
        </td>

        {/* Public toggle — only when owner AND store is public */}
        {isOwner && storeIsPublic && (
          <td
            className={`${cellClass} w-14`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onToggleVisibility(item.id, !item.isPublic)}
              title={item.isPublic ? "Visible to public" : "Hidden from public"}
              className={`w-7 h-4 rounded-full transition-colors duration-150 relative flex items-center ${item.isPublic ? "bg-slate-700" : "bg-slate-200"}`}
            >
              <span
                className={`absolute w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${item.isPublic ? "translate-x-3.5" : "translate-x-0.5"}`}
              />
            </button>
          </td>
        )}

        {/* Details hint */}
        <td
          className={`${cellClass} w-14`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowDetail(true)}
            className={[
              "text-[9px] font-bold uppercase tracking-widest transition-all opacity-0 group-hover:opacity-100",
              isSelected
                ? "text-slate-300 hover:text-white"
                : "text-slate-400 hover:text-slate-700",
            ].join(" ")}
          >
            details
          </button>
        </td>
      </tr>
    </>
  );
}
