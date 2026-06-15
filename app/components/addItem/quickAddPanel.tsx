import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { parseQuickAdd } from "~/utils/helpers/quickAdd.helper";
import { inferTypeFromLabel } from "~/lib/itemTypes";
import type { ItemType } from "~/types/itemTypeTypes";
import { TypeIcon } from "~/components/store/typeIcon";

export type QuickAddItem = {
  name: string;
  quantity: number;
  itemType: ItemType;
};

/**
 * Fast capture: paste or type a list (one item per line, "Milk x2" style) and
 * add them all at once. Each line's type is inferred from its name; an optional
 * target zone shelves them together. No barcode required. (DESIGN.md §7 capture.)
 */
export function QuickAddPanel({
  isOpen,
  onClose,
  onSubmit,
  categories,
  defaultBlockId = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (items: QuickAddItem[], blockId: string | null) => void;
  categories: { id: string; label: string }[];
  defaultBlockId?: string | null;
}) {
  const [text, setText] = useState("");
  const [blockId, setBlockId] = useState<string | null>(defaultBlockId);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setBlockId(defaultBlockId);
      setTimeout(() => taRef.current?.focus(), 30);
    }
  }, [isOpen, defaultBlockId]);

  const entries = useMemo<QuickAddItem[]>(
    () =>
      parseQuickAdd(text).map((e) => ({
        ...e,
        itemType: inferTypeFromLabel(e.name) ?? "other",
      })),
    [text],
  );

  if (!isOpen) return null;

  const submit = () => {
    if (!entries.length) return;
    onSubmit(entries, blockId);
    setText("");
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Quick add
            </span>
            <p className="text-[13px] font-bold text-slate-800">
              One item per line
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 transition-colors hover:text-slate-600"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={"Milk x2\nEggs 12\nOlive oil\nPasta, 3"}
            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white"
          />

          <label className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            Shelve in
            <select
              value={blockId ?? ""}
              onChange={(e) => setBlockId(e.target.value || null)}
              className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">No zone (unassigned)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {entries.length > 0 && (
            <div className="max-h-44 overflow-auto rounded-lg border border-slate-100 bg-slate-50/60 p-1">
              {entries.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded px-2 py-1 text-[12px]"
                >
                  <TypeIcon
                    type={e.itemType}
                    className="h-3.5 w-3.5 shrink-0 text-slate-400"
                  />
                  <span className="flex-1 truncate text-slate-700">{e.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-slate-400">
                    ×{e.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <span className="text-[10px] font-mono text-slate-300">⌘/Ctrl+Enter</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!entries.length}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add {entries.length || ""} item{entries.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
