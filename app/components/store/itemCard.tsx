import { useState } from "react";
import type { Item, ItemStatus } from "~/types/storeTypes";
import {
  getItemStatus,
  itemRunoutDays,
} from "~/utils/helpers/storeTable.helper";
import { expiryDateRemainingDays } from "~/utils/helpers/store.helper";
import { describeUsage } from "~/utils/helpers/usage.helper";
import { ItemDetailPopup } from "./ItemDetailPopup";
import { TypeIcon } from "./typeIcon";
import { useProductImage } from "~/utils/useProductImage";

const STATUS_PILL: Record<ItemStatus, string> = {
  out: "bg-slate-100 text-slate-400 border-slate-200",
  low: "bg-red-50 text-red-500 border-red-200",
  expiring: "bg-amber-50 text-amber-600 border-amber-200",
  ok: "bg-emerald-50 text-emerald-600 border-emerald-200",
};
const STATUS_LABEL: Record<ItemStatus, string> = {
  out: "Out",
  low: "Low",
  expiring: "Expiring",
  ok: "OK",
};

type Props = {
  item: Item;
  onSave: (updated: Item) => void;
  onDelete: (itemId: string) => void;
  onMarkOut?: (item: Item) => void;
  onAddToList?: (item: Item) => void;
  isOwner: boolean;
  storeIsPublic: boolean;
  onToggleVisibility: (itemId: string, isPublic: boolean) => void;
};

/** A single inventory item rendered as a type-aware card (zone-contents view). */
export function ItemCard({
  item,
  onSave,
  onDelete,
  onMarkOut,
  onAddToList,
}: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const close = () => setShowDetail(false);

  const status = getItemStatus(item);
  const expiryDays = expiryDateRemainingDays(item.expiryDate);
  const runout = itemRunoutDays(item);
  const isPrior = item.usage?.source === "prior";
  const photo = useProductImage(item);

  const expiryColor =
    expiryDays != null && expiryDays <= 0
      ? "text-red-500"
      : expiryDays != null && expiryDays <= 30
        ? "text-amber-600"
        : "text-slate-400";
  const runoutColor = isPrior
    ? "text-slate-300"
    : runout != null && runout <= 7
      ? "text-red-500"
      : runout != null && runout <= 30
        ? "text-amber-600"
        : "text-slate-400";

  return (
    <>
      {showDetail && (
        <ItemDetailPopup
          item={item}
          onClose={close}
          onSave={(u) => {
            onSave(u);
            close();
          }}
          onDelete={(id) => {
            onDelete(id);
            close();
          }}
          onMarkOut={
            onMarkOut
              ? (i) => {
                  onMarkOut(i);
                  close();
                }
              : undefined
          }
          onAddToList={
            onAddToList
              ? (i) => {
                  onAddToList(i);
                  close();
                }
              : undefined
          }
        />
      )}

      <div
        onClick={() => setShowDetail(true)}
        className={`group flex flex-col gap-2 rounded-xl border bg-white p-3 cursor-pointer hover:shadow-sm transition-all ${
          item.checkedOut
            ? "border-amber-300 bg-amber-50/30"
            : "border-slate-200 hover:border-emerald-300"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {photo ? (
              <img
                src={photo}
                alt=""
                loading="lazy"
                className="w-6 h-6 rounded-md object-cover border border-slate-200 bg-white shrink-0"
              />
            ) : (
              <TypeIcon
                type={item.itemType}
                className="w-3.5 h-3.5 text-slate-400 shrink-0"
              />
            )}
            <span className="text-[12px] font-semibold text-slate-800 truncate">
              {item.name}
            </span>
          </div>
          {item.checkedOut ? (
            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-amber-700">
              Out
            </span>
          ) : (
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${STATUS_PILL[status]}`}
            >
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-[15px] font-bold text-slate-800 tabular-nums leading-none">
            {item.quantity}
          </span>
          {item.unit && (
            <span className="text-[10px] font-mono text-slate-400">
              {item.unit}
            </span>
          )}
        </div>

        {(expiryDays != null || runout != null) && (
          <div className="flex items-center gap-3 text-[10px] font-mono">
            {expiryDays != null && (
              <span
                className={`inline-flex items-center gap-1 ${expiryColor}`}
                title="Expiry"
              >
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                >
                  <circle cx="6" cy="6" r="4.5" />
                  <path d="M6 3.4V6l1.8 1.1" strokeLinecap="round" />
                </svg>
                {expiryDays <= 0 ? "expired" : `${expiryDays}d`}
              </span>
            )}
            {runout != null && (
              <span
                className={runoutColor}
                title={item.usage ? describeUsage(item.usage) : "Est. run-out"}
              >
                {isPrior ? `~${runout}d` : `${runout}d`} left
              </span>
            )}
          </div>
        )}

        {onMarkOut && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkOut(item);
            }}
            className="self-start rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700 opacity-0 group-hover:opacity-100 hover:bg-amber-100 transition-all"
          >
            We're out
          </button>
        )}
      </div>
    </>
  );
}
