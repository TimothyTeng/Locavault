import { useState, useRef, useEffect } from "react";
import type { Item } from "#types/storeTypes";

type Props = {
  item: Item;
  index: number;
  isSelected: boolean;
  onSelect: (item: Item) => void;
  onSave: (updated: Item) => void;
  isOwner: boolean;
  onToggleVisibility: (itemId: string, isPublic: boolean) => void;
};

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

  const cellClass = "px-4 py-2.5 text-[11px]";
  const inputClass =
    "w-full bg-transparent outline-none border-b border-slate-300 focus:border-slate-600 text-[11px] font-mono text-slate-800 pb-0.5 transition-colors";

  if (isEditing) {
    return (
      <tr className="border-b border-slate-100 bg-slate-50">
        {/* Index */}
        <td
          className={`${cellClass} text-[10px] font-mono text-slate-300 w-10`}
        >
          {index + 1}
        </td>

        {/* Name */}
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

        {/* Quantity */}
        <td className={`${cellClass} w-20`}>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            className={`${inputClass} w-16`}
          />
        </td>

        {/* Description */}
        <td className={cellClass}>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClass}
            placeholder="Description"
          />
        </td>

        {/* Location — not editable */}
        <td className={`${cellClass} text-[10px] font-mono text-slate-400`}>
          ({item.blockId})
        </td>

        {/* In store */}
        <td className={cellClass}>
          <span
            className={[
              "inline-block w-1.5 h-1.5 rounded-full",
              quantity > 0 ? "bg-emerald-400" : "bg-slate-300",
            ].join(" ")}
          />
        </td>

        {/* Public toggle — owner only, disabled while editing */}
        {isOwner && (
          <td className={`${cellClass} w-16`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-200" />
          </td>
        )}

        {/* Actions */}
        <td className={`${cellClass} w-20`}>
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
      <td className={`${cellClass} font-bold`}>{item.name}</td>
      <td className={`${cellClass} font-mono`}>{item.quantity}</td>
      <td
        className={`${cellClass} max-w-[200px] truncate ${
          isSelected ? "text-slate-300" : "text-slate-400"
        }`}
      >
        {item.description ?? "—"}
      </td>
      <td className={`${cellClass} text-[10px] font-mono`}>({item.blockId})</td>
      <td className={cellClass}>
        <span
          className={[
            "inline-block w-1.5 h-1.5 rounded-full",
            item.quantity > 0 ? "bg-emerald-400" : "bg-slate-300",
          ].join(" ")}
        />
      </td>

      {/* Public toggle — owner only */}
      {isOwner && (
        <td
          className={`${cellClass} w-16`}
          onClick={(e) => e.stopPropagation()} // don't trigger row select
        >
          <button
            onClick={() => onToggleVisibility(item.id, !item.isPublic)}
            title={item.isPublic ? "Visible to public" : "Hidden from public"}
            className={`w-7 h-4 rounded-full transition-colors duration-150 relative flex items-center ${
              item.isPublic ? "bg-slate-700" : "bg-slate-200"
            }`}
          >
            <span
              className={`absolute w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                item.isPublic ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </td>
      )}

      <td className={`${cellClass} w-20`}>
        <span
          className={[
            "text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity",
            isSelected ? "text-slate-300" : "text-slate-400",
          ].join(" ")}
        >
          dbl-click
        </span>
      </td>
    </tr>
  );
}
