import { useState } from "react";
import { createPortal } from "react-dom";
import type { Item } from "~/types/storeTypes";
import {
  fieldsForType,
  ITEM_TYPES,
  TYPE_META,
  type ItemType,
} from "~/lib/itemTypes";
import {
  formatCost,
  formatExpiry,
  formatUseRate,
  itemRunoutDays,
} from "~/utils/helpers/storeTable.helper";
import { describeUsage } from "~/utils/helpers/usage.helper";

export function ItemDetailPopup({
  item,
  onClose,
  onSave,
  onDelete,
  onMarkOut,
  onAddToList,
}: {
  item: Item;
  onClose: () => void;
  onSave: (updated: Item) => void;
  onDelete: (itemId: string) => void;
  onMarkOut?: (item: Item) => void;
  onAddToList?: (item: Item) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Editable fields
  const [name, setName] = useState(item.name);
  const [itemType, setItemType] = useState<ItemType>(item.itemType);
  const [quantity, setQuantity] = useState(item.quantity);
  const [description, setDescription] = useState(item.description ?? "");
  const [sku, setSku] = useState(item.sku ?? "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [minQuantity, setMinQuantity] = useState(
    item.minQuantity != null ? String(item.minQuantity) : "",
  );
  const [cost, setCost] = useState(
    item.cost != null ? String(item.cost / 100) : "",
  );
  const [expiryDate, setExpiryDate] = useState(
    item.expiryDate
      ? new Date(item.expiryDate).toISOString().split("T")[0]
      : "",
  );
  const [useRate, setUseRate] = useState(
    item.useRate != null ? String(item.useRate) : "",
  );
  const [useRatePeriod, setUseRatePeriod] = useState<
    "day" | "week" | "month" | ""
  >(item.useRatePeriod ?? "");

  const expiry = formatExpiry(item.expiryDate);
  const runoutDaysVal = itemRunoutDays(item);

  // The type's traits decide which tracking fields are relevant. Keep showing a
  // field if the item already holds a value for it, so editing never hides data.
  const fields = fieldsForType(itemType);
  const showUnit = fields.unit || item.unit != null;
  const showMin = fields.minQuantity || item.minQuantity != null;
  const showExpiry = fields.expiry || item.expiryDate != null;
  const showUseRate = fields.useRate || item.useRate != null;

  const handleSave = () => {
    onSave({
      ...item,
      name: name.trim() || item.name,
      itemType,
      quantity: Number(quantity) || 0,
      description: description || null,
      sku: sku || null,
      unit: unit || null,
      minQuantity: minQuantity !== "" ? Number(minQuantity) : null,
      cost: cost !== "" ? Math.round(Number(cost) * 100) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      useRate: useRate !== "" ? Number(useRate) : null,
      useRatePeriod: useRatePeriod || null,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setName(item.name);
    setItemType(item.itemType);
    setQuantity(item.quantity);
    setDescription(item.description ?? "");
    setSku(item.sku ?? "");
    setUnit(item.unit ?? "");
    setMinQuantity(item.minQuantity != null ? String(item.minQuantity) : "");
    setCost(item.cost != null ? String(item.cost / 100) : "");
    setExpiryDate(
      item.expiryDate
        ? new Date(item.expiryDate).toISOString().split("T")[0]
        : "",
    );
    setUseRate(item.useRate != null ? String(item.useRate) : "");
    setUseRatePeriod(item.useRatePeriod ?? "");
    setIsEditing(false);
  };

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono text-slate-800 focus:outline-none focus:border-slate-400 transition-colors";

  const DetailRow = ({
    label,
    value,
    editContent,
  }: {
    label: string;
    value: React.ReactNode;
    editContent?: React.ReactNode;
  }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 shrink-0 pt-1">
        {label}
      </span>
      <div className="text-[11px] font-mono text-slate-700 text-right min-w-0 flex-1">
        {isEditing && editContent != null ? editContent : value}
      </div>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Item Details
            </span>
            {isEditing ? (
              <input
                className="block mt-0.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[13px] font-bold text-slate-800 focus:outline-none focus:border-slate-400 w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            ) : (
              <p className="text-[13px] font-bold text-slate-800 mt-0.5">
                {item.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-slate-600 transition-colors ml-3 shrink-0"
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
          <DetailRow
            label="Description"
            value={item.description ?? "—"}
            editContent={
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
            }
          />
          <DetailRow
            label="Type"
            value={TYPE_META[item.itemType].label}
            editContent={
              <select
                className={inputClass}
                value={itemType}
                onChange={(e) => setItemType(e.target.value as ItemType)}
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>
            }
          />
          <DetailRow
            label="Quantity"
            value={`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`}
            editContent={
              <input
                className={inputClass}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            }
          />
          <DetailRow label="Location" value={item.blockId ?? "—"} />
          <DetailRow
            label="In Store"
            value={item.quantity > 0 ? "Yes" : "No"}
          />
          <DetailRow
            label="SKU"
            value={item.sku ?? "—"}
            editContent={
              <input
                className={inputClass}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU"
              />
            }
          />
          {showUnit && (
            <DetailRow
              label="Unit"
              value={item.unit ?? "—"}
              editContent={
                <input
                  className={inputClass}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. kg, pcs"
                />
              }
            />
          )}
          <DetailRow
            label="Cost"
            value={formatCost(item.cost)}
            editContent={
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            }
          />
          {showMin && (
            <DetailRow
              label="Min Stock"
              value={
                item.minQuantity != null
                  ? `${item.minQuantity}${item.unit ? ` ${item.unit}` : ""}`
                  : "—"
              }
              editContent={
                <input
                  className={inputClass}
                  type="number"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  placeholder="—"
                />
              }
            />
          )}
          {showExpiry && (
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
              editContent={
                <input
                  className={inputClass}
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              }
            />
          )}
          {showUseRate && (
            <DetailRow
              label="Use Rate"
              value={formatUseRate(item.useRate, item.useRatePeriod)}
              editContent={
                <div className="flex gap-1">
                  <input
                    className={`${inputClass} w-16`}
                    type="number"
                    value={useRate}
                    onChange={(e) => setUseRate(e.target.value)}
                    placeholder="0"
                  />
                  <select
                    className={`${inputClass} w-24`}
                    value={useRatePeriod}
                    onChange={(e) =>
                      setUseRatePeriod(
                        e.target.value as "day" | "week" | "month" | "",
                      )
                    }
                  >
                    <option value="">—</option>
                    <option value="day">day</option>
                    <option value="week">week</option>
                    <option value="month">month</option>
                  </select>
                </div>
              }
            />
          )}
          <DetailRow
            label="Runs Out"
            value={
              runoutDaysVal != null ? (
                <span
                  className={
                    Number(runoutDaysVal) <= 7
                      ? "text-red-500"
                      : Number(runoutDaysVal) <= 30
                        ? "text-amber-500"
                        : "text-slate-700"
                  }
                >
                  {Number(runoutDaysVal) === 0
                    ? "today"
                    : `in ${runoutDaysVal} day${Number(runoutDaysVal) !== 1 ? "s" : ""}`}
                </span>
              ) : (
                "—"
              )
            }
          />
          {item.usage &&
            item.usage.dailyRate != null &&
            item.usage.dailyRate > 0 && (
              <DetailRow
                label="Est. usage"
                value={
                  <span
                    className="text-slate-600"
                    title={describeUsage(item.usage)}
                  >
                    {item.usage.dailyRate >= 1
                      ? `~${item.usage.dailyRate.toFixed(1)}/day`
                      : `~${(item.usage.dailyRate * 7).toFixed(1)}/week`}
                    <span className="ml-1.5 text-[10px] text-slate-400 uppercase tracking-wide">
                      {item.usage.source === "history"
                        ? `learned · ${item.usage.confidence}`
                        : item.usage.source === "prior"
                          ? "still learning"
                          : "manual"}
                    </span>
                  </span>
                }
              />
            )}
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

        {/* Actions */}
        {isEditing ? (
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 rounded-md bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex-1 px-4 py-2 rounded-md border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-4 py-2 rounded-md bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all"
            >
              Edit
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
            >
              Close
            </button>
          </div>
        )}

        {/* Restock actions — one-tap "we're out" + add to the shopping list */}
        {!isEditing && (onMarkOut || onAddToList) && (
          <div className="flex gap-2">
            {onMarkOut && (
              <button
                onClick={() => onMarkOut(item)}
                title="Mark as finished and add to your shopping list"
                className="flex-1 px-4 py-2 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-all"
              >
                We're out
              </button>
            )}
            {onAddToList && (
              <button
                onClick={() => onAddToList(item)}
                title="Add to your shopping list"
                className="flex-1 px-4 py-2 rounded-md border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
              >
                Add to list
              </button>
            )}
          </div>
        )}

        {/* Delete */}
        {!isEditing &&
          (confirmDelete ? (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] text-slate-500 text-center">
                Are you sure? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onDelete(item.id)}
                  className="flex-1 px-4 py-2 rounded-md bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-4 py-2 rounded-md border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full px-4 py-2 rounded-md border border-red-100 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-50 hover:border-red-200 transition-all"
            >
              Delete Item
            </button>
          ))}
      </div>
    </div>,
    document.body,
  );
}
