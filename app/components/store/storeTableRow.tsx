import { useState, useRef, useEffect } from "react";
import type { Item } from "#types/storeTypes";
import {
  expiryDateRemainingDays,
  remainingDays,
  runOutDays,
} from "~/utils/helpers/store.helper";

type Props = {
  item: Item;
  index: number;
  isSelected: boolean;
  onSelect: (item: Item) => void;
  onSave: (updated: Item) => void;
  isOwner: boolean;
  onToggleVisibility: (itemId: string, isPublic: boolean) => void;
};

// ── Helpers ────────────────────────────────────────────────

function formatCost(cents: number | null) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatExpiry(
  date: Date | null,
): { label: string; status: "expired" | "soon" | "ok" } | "—" {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.ceil(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const label = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (diffDays < 0) return { label, status: "expired" };
  if (diffDays <= 30) return { label, status: "soon" };
  return { label, status: "ok" };
}

function formatUseRate(
  rate: number | null,
  period: "day" | "week" | "month" | null,
) {
  if (!rate || !period) return "—";
  return `${rate} / ${period}`;
}

function predictRunout(
  quantity: number,
  rate: number | null,
  period: "day" | "week" | "month" | null,
) {
  if (!rate || !period || quantity <= 0) return null;
  const periodDays = { day: 1, week: 7, month: 30 }[period];
  const dailyRate = rate / periodDays;
  return Math.floor(quantity / dailyRate);
}

// ── Detail popup ───────────────────────────────────────────

function ItemDetailPopup({
  item,
  onClose,
}: {
  item: Item;
  onClose: () => void;
}) {
  const expiry = formatExpiry(item.expiryDate);
  const runoutDays = predictRunout(
    item.quantity,
    item.useRate,
    item.useRatePeriod,
  );

  const DetailRow = ({
    label,
    value,
  }: {
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-[11px] font-mono text-slate-700 text-right">
        {value}
      </span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Item Details
            </span>
            <p className="text-[13px] font-bold text-slate-800 mt-0.5">
              {item.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-slate-600 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col">
          <DetailRow label="SKU" value={item.sku ?? "—"} />
          <DetailRow label="Unit" value={item.unit ?? "—"} />
          <DetailRow label="Cost" value={formatCost(item.cost)} />
          <DetailRow
            label="Min Stock"
            value={
              item.minQuantity != null
                ? `${item.minQuantity}${item.unit ? ` ${item.unit}` : ""}`
                : "—"
            }
          />
          <DetailRow
            label="Expiry"
            value={
              expiry === "—" ? (
                "—"
              ) : (
                <span
                  className={
                    expiry.status === "expired"
                      ? "text-red-500"
                      : expiry.status === "soon"
                        ? "text-amber-500"
                        : "text-slate-700"
                  }
                >
                  {expiry.label}
                  {expiry.status === "expired" && " · expired"}
                  {expiry.status === "soon" && " · expiring soon"}
                </span>
              )
            }
          />
          <DetailRow
            label="Use Rate"
            value={formatUseRate(item.useRate, item.useRatePeriod)}
          />
          <DetailRow
            label="Runs Out"
            value={
              runoutDays != null ? (
                <span
                  className={
                    runoutDays <= 7
                      ? "text-red-500"
                      : runoutDays <= 30
                        ? "text-amber-500"
                        : "text-slate-700"
                  }
                >
                  {runoutDays === 0
                    ? "today"
                    : `in ${runoutDays} day${runoutDays !== 1 ? "s" : ""}`}
                </span>
              ) : (
                "—"
              )
            }
          />
          {item.minQuantity != null && item.quantity <= item.minQuantity && (
            <DetailRow
              label="Alert"
              value={
                <span className="text-red-500 font-bold">
                  Below minimum stock
                </span>
              }
            />
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-1 w-full px-4 py-2 rounded-md border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────

export function StoreTableRow({
  item,
  index,
  isSelected,
  onSelect,
  onSave,
  isOwner,
  onToggleVisibility,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [description, setDescription] = useState(item.description ?? "");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) nameRef.current?.focus();
  }, [isEditing]);

  const handleSave = () => {
    onSave({ ...item, name, quantity, description });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(item.name);
    setQuantity(item.quantity);
    setDescription(item.description ?? "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  const isLowStock =
    item.minQuantity != null && item.quantity <= item.minQuantity;

  const cellClass = "px-4 py-2.5 text-[11px]";
  const inputClass =
    "w-full bg-transparent outline-none border-b border-slate-300 focus:border-slate-600 text-[11px] font-mono text-slate-800 pb-0.5 transition-colors";

  if (isEditing) {
    return (
      <tr className="border-b border-slate-100 bg-slate-50">
        <td
          className={`${cellClass} text-[10px] font-mono text-slate-300 w-10`}
        >
          {index + 1}
        </td>
        <td className={cellClass}>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
            placeholder="Item name"
          />
        </td>
        <td className={`${cellClass} w-20`}>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            className={`${inputClass} w-16`}
          />
        </td>
        <td className={cellClass}>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
            placeholder="Description"
          />
        </td>
        <td className={`${cellClass} text-[10px] font-mono text-slate-400`}>
          ({item.blockId})
        </td>
        <td className={cellClass}>
          <span
            className={[
              "inline-block w-1.5 h-1.5 rounded-full",
              quantity > 0 ? "bg-emerald-400" : "bg-slate-300",
            ].join(" ")}
          />
        </td>
        {isOwner && (
          <td className={`${cellClass} w-16`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-200" />
          </td>
        )}
        <td className={`${cellClass} w-32`}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {showDetail && (
        <ItemDetailPopup item={item} onClose={() => setShowDetail(false)} />
      )}

      <tr
        onClick={() => onSelect(item)}
        onDoubleClick={() => setIsEditing(true)}
        className={[
          "border-b border-slate-100 cursor-pointer transition-colors duration-100 group",
          isSelected
            ? "bg-slate-800 text-white"
            : "hover:bg-slate-50 text-slate-700",
        ].join(" ")}
      >
        <td className={`${cellClass} text-[10px] font-mono opacity-40`}>
          {index + 1}
        </td>

        {/* Name + low stock badge */}
        <td className={`${cellClass} font-bold`}>
          <div className="flex items-center gap-2">
            {item.name}
            {isLowStock && (
              <span className="text-[8px] font-bold uppercase tracking-widest text-red-400 border border-red-200 rounded px-1 py-0.5 leading-none">
                low
              </span>
            )}
          </div>
        </td>

        {/* Qty + unit */}
        <td className={`${cellClass} font-mono`}>
          {item.quantity}
          {item.unit ? ` ${item.unit}` : ""}
        </td>

        <td
          className={`${cellClass} max-w-[200px] truncate ${isSelected ? "text-slate-300" : "text-slate-400"}`}
        >
          {expiryDateRemainingDays(item.expiryDate)
            ? `${expiryDateRemainingDays(item.expiryDate)} days`
            : ""}
        </td>

        <td className={`${cellClass} text-[10px] font-mono`}>
          {item.useRate && item.useRatePeriod
            ? `${remainingDays(item.createdAt, item.useRate.toString(), item.useRatePeriod, item.quantity)} days`
            : ""}
        </td>

        <td className={cellClass}>
          <span
            className={[
              "inline-block w-1.5 h-1.5 rounded-full",
              item.quantity > 0 ? "bg-emerald-400" : "bg-slate-300",
            ].join(" ")}
          />
        </td>

        {isOwner && (
          <td
            className={`${cellClass} w-16`}
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

        <td
          className={`${cellClass} w-16`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
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
          </div>
        </td>
      </tr>
    </>
  );
}
