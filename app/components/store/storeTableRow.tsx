import { useState } from "react";
import type { Item, ItemStatus } from "#types/storeTypes";
import { expiryDateRemainingDays } from "~/utils/helpers/store.helper";
import {
  getItemStatus,
  itemRunoutDays,
} from "~/utils/helpers/storeTable.helper";
import { describeUsage } from "~/utils/helpers/usage.helper";
import { ItemDetailPopup } from "./ItemDetailPopup";

type Props = {
  item: Item;
  index: number;
  isSelected: boolean;
  onSelect: (item: Item) => void;
  onSave: (updated: Item) => void;
  onDelete: (itemId: string) => void;
  onMarkOut?: (item: Item) => void;
  onAddToList?: (item: Item) => void;
  isOwner: boolean;
  storeIsPublic: boolean;
  onToggleVisibility: (itemId: string, isPublic: boolean) => void;
  isMobile: boolean;
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

export function StoreTableRow({
  item,
  index,
  isSelected,
  onSelect,
  onSave,
  onDelete,
  onMarkOut,
  onAddToList,
  isOwner,
  storeIsPublic,
  onToggleVisibility,
  isMobile,
}: Props) {
  const [showDetail, setShowDetail] = useState(false);

  const isLowStock =
    item.minQuantity != null && item.quantity <= item.minQuantity;
  const status = getItemStatus(item);
  const { pill, label: statusLabel } = STATUS_STYLES[status];

  const expiryDays = expiryDateRemainingDays(item.expiryDate);
  const depletionDays = itemRunoutDays(item);
  // Learned-from-history estimates get a small dot; manual ones don't.
  const isLearned = item.usage?.source === "history";
  // A `prior` estimate is just a "still learning" guess — render it muted.
  const isPrior = item.usage?.source === "prior";

  const expiryColor = isSelected
    ? "text-slate-300"
    : expiryDays != null && expiryDays <= 0
      ? "text-red-500"
      : expiryDays != null && expiryDays <= 30
        ? "text-amber-500"
        : "text-slate-400";

  const depletionColor =
    isSelected || isPrior
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

  const handleMarkOutAndClose = onMarkOut
    ? (i: Item) => {
        onMarkOut(i);
        setShowDetail(false);
      }
    : undefined;

  const handleAddToListAndClose = onAddToList
    ? (i: Item) => {
        onAddToList(i);
        setShowDetail(false);
      }
    : undefined;

  return (
    <>
      {showDetail && (
        <ItemDetailPopup
          item={item}
          onClose={() => setShowDetail(false)}
          onSave={handleSaveAndClose}
          onDelete={handleDeleteAndClose}
          onMarkOut={handleMarkOutAndClose}
          onAddToList={handleAddToListAndClose}
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
            {item.checkedOut && (
              <span className="text-[8px] font-bold uppercase tracking-widest text-amber-700 border border-amber-200 bg-amber-50 rounded px-1 py-0.5 leading-none">
                out
              </span>
            )}
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

        {/* Expiry — desktop only */}
        {!isMobile && (
          <td
            className={`${cellClass} w-24 text-right text-[10px] font-mono tabular-nums ${expiryColor}`}
          >
            {expiryDays != null ? (
              `${expiryDays}d`
            ) : (
              <span className="opacity-30">—</span>
            )}
          </td>
        )}

        {/* Est depletion — desktop only */}
        {!isMobile && (
          <td
            className={`${cellClass} w-24 text-right text-[10px] font-mono tabular-nums ${depletionColor}`}
            title={item.usage ? describeUsage(item.usage) : undefined}
          >
            {depletionDays != null ? (
              <span className="inline-flex items-center gap-1 justify-end">
                {isLearned && (
                  <span
                    className="w-1 h-1 rounded-full bg-emerald-400"
                    aria-label="learned from usage history"
                  />
                )}
                {isPrior ? `~${depletionDays}d` : `${depletionDays}d`}
              </span>
            ) : (
              <span className="opacity-30">—</span>
            )}
          </td>
        )}

        {/* Status pill */}
        <td className={`${cellClass} w-24`}>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${pill}`}
          >
            {statusLabel}
          </span>
        </td>

        {/* Public toggle — desktop + owner + storeIsPublic */}
        {!isMobile && isOwner && storeIsPublic && (
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

        {/* Details button — always visible on mobile, hover-only on desktop */}
        <td
          className={`${cellClass} w-14`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowDetail(true)}
            className={[
              "text-[9px] font-bold uppercase tracking-widest transition-all",
              isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
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
