import { useMemo, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  MapPin,
  Check,
  PackageCheck,
  PackageOpen,
  Luggage,
} from "lucide-react";
import type { Item } from "~/types/storeTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import type { Collection, CollectionKind } from "~/types/collectionTypes";

const KIND_LABEL: Record<CollectionKind, string> = {
  packing: "Packing",
  trade: "Trade",
  custom: "Custom",
};

/**
 * Collections / packing — an OUTPUT surface (DESIGN.md §7). A named set of item
 * references for a purpose (pack a trip, a trade pile, a group). Leans on the
 * canvas: each linked item shows where it lives (pick assistance), and a
 * collection can be "checked out" (taken away → items flagged packed/out, kept
 * in inventory) and "checked in" on return. Gaps draft shopping-list entries.
 */
export function CollectionsPanel({
  isOpen,
  onClose,
  collections,
  items,
  blocks,
  canEdit,
  onCreate,
  onRename,
  onSetKind,
  onDelete,
  onAddItem,
  onTogglePacked,
  onRemoveItem,
  onCheckout,
  onAddGapsToList,
  onLocate,
  isMobile = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  items: Item[];
  blocks: BlocksMap;
  canEdit: boolean;
  onCreate: (id: string, name: string, kind: CollectionKind) => void;
  onRename: (id: string, name: string) => void;
  onSetKind: (id: string, kind: CollectionKind) => void;
  onDelete: (id: string) => void;
  onAddItem: (
    collectionId: string,
    entry: { id: string; itemId: string | null; name: string },
  ) => void;
  onTogglePacked: (collectionId: string, itemId: string, checked: boolean) => void;
  onRemoveItem: (collectionId: string, itemId: string) => void;
  onCheckout: (collectionId: string, checkedOut: boolean) => void;
  onAddGapsToList?: (names: string[]) => void;
  onLocate: (item: Item) => void;
  isMobile?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const open = openId ? collections.find((c) => c.id === openId) ?? null : null;

  if (!isOpen) return null;

  const createAndOpen = () => {
    const name = draftName.trim() || "New collection";
    const id = crypto.randomUUID();
    onCreate(id, name, "packing");
    setDraftName("");
    setOpenId(id);
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
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl font-mono ${
          isMobile ? "" : "max-w-md"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {open && (
              <button
                onClick={() => setOpenId(null)}
                aria-label="Back"
                className="text-slate-400 hover:text-slate-700"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {open ? KIND_LABEL[open.kind] : "Collections"}
              </span>
              <p className="truncate text-[13px] font-bold text-slate-800">
                {open ? open.name : "Pack, lend & group"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 transition-colors hover:text-slate-600"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {open ? (
          <CollectionDetail
            collection={open}
            items={items}
            blocks={blocks}
            canEdit={canEdit}
            onRename={onRename}
            onSetKind={onSetKind}
            onDelete={(id) => {
              onDelete(id);
              setOpenId(null);
            }}
            onAddItem={onAddItem}
            onTogglePacked={onTogglePacked}
            onRemoveItem={onRemoveItem}
            onCheckout={onCheckout}
            onAddGapsToList={onAddGapsToList}
            onLocate={(item) => {
              onLocate(item);
              onClose();
            }}
          />
        ) : (
          <div className="flex-1 overflow-auto px-4 py-4">
            {canEdit && (
              <div className="mb-3 flex gap-2">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createAndOpen()}
                  placeholder="New collection name…"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white"
                />
                <button
                  onClick={createAndOpen}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-slate-700"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  New
                </button>
              </div>
            )}

            {collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Luggage size={26} className="text-slate-300" />
                <p className="text-[12px] font-semibold text-slate-500">
                  No collections yet
                </p>
                <p className="max-w-[16rem] text-[11px] text-slate-400">
                  Group items to pack for a trip, lend out, or set aside — each
                  shows where it lives, and you can check the set out and back in.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {collections.map((c) => {
                  const packed = c.items.filter((i) => i.checked).length;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setOpenId(c.id)}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left hover:border-slate-300"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-bold text-slate-800">
                            {c.name}
                          </span>
                          {c.checkedOut && (
                            <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                              Out
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {KIND_LABEL[c.kind]} · {c.items.length} item
                          {c.items.length === 1 ? "" : "s"}
                          {c.items.length > 0 && ` · ${packed} packed`}
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function CollectionDetail({
  collection,
  items,
  blocks,
  canEdit,
  onRename,
  onSetKind,
  onDelete,
  onAddItem,
  onTogglePacked,
  onRemoveItem,
  onCheckout,
  onAddGapsToList,
  onLocate,
}: {
  collection: Collection;
  items: Item[];
  blocks: BlocksMap;
  canEdit: boolean;
  onRename: (id: string, name: string) => void;
  onSetKind: (id: string, kind: CollectionKind) => void;
  onDelete: (id: string) => void;
  onAddItem: (
    collectionId: string,
    entry: { id: string; itemId: string | null; name: string },
  ) => void;
  onTogglePacked: (collectionId: string, itemId: string, checked: boolean) => void;
  onRemoveItem: (collectionId: string, itemId: string) => void;
  onCheckout: (collectionId: string, checkedOut: boolean) => void;
  onAddGapsToList?: (names: string[]) => void;
  onLocate: (item: Item) => void;
}) {
  const itemById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );

  // A collection entry is a "gap" if it's unlinked or its linked item is out.
  const gapNames = collection.items
    .filter((ci) => {
      if (!ci.itemId) return true;
      const it = itemById.get(ci.itemId);
      return !it || it.quantity <= 0;
    })
    .map((ci) => ci.name);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Meta + check-out */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 shrink-0">
        {canEdit ? (
          <input
            defaultValue={collection.name}
            key={collection.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== collection.name) onRename(collection.id, v);
            }}
            className="w-full rounded-lg border border-transparent bg-slate-50 px-3 py-1.5 text-[13px] font-bold text-slate-800 outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white"
          />
        ) : (
          <p className="px-1 text-[13px] font-bold text-slate-800">
            {collection.name}
          </p>
        )}

        {canEdit && (
          <div className="flex gap-1.5">
            {(["packing", "trade", "custom"] as CollectionKind[]).map((k) => (
              <button
                key={k}
                onClick={() => onSetKind(collection.id, k)}
                className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  collection.kind === k
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}

        {canEdit && (
          <button
            onClick={() => onCheckout(collection.id, !collection.checkedOut)}
            disabled={collection.items.length === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              collection.checkedOut
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-slate-900 hover:bg-slate-700"
            }`}
          >
            {collection.checkedOut ? (
              <>
                <PackageCheck size={14} /> Check back in
              </>
            ) : (
              <>
                <PackageOpen size={14} /> Check out
              </>
            )}
          </button>
        )}
        {collection.checkedOut && (
          <p className="-mt-1 text-center text-[10px] text-amber-600">
            Checked out — items flagged as out (quantities kept). Check in to
            put them back.
          </p>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {collection.items.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-slate-400">
            No items yet — add some below.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {collection.items.map((ci) => {
              const it = ci.itemId ? itemById.get(ci.itemId) : null;
              const zone = it?.blockId ? blocks[it.blockId]?.label : null;
              const isGap = !it || it.quantity <= 0;
              return (
                <div
                  key={ci.id}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-white px-2.5 py-2"
                >
                  <button
                    onClick={() =>
                      canEdit &&
                      onTogglePacked(collection.id, ci.id, !ci.checked)
                    }
                    aria-label={ci.checked ? "Packed" : "Mark packed"}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      ci.checked
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white hover:border-slate-400"
                    }`}
                  >
                    {ci.checked && <Check size={11} strokeWidth={3} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[12px] ${
                        ci.checked
                          ? "text-slate-400 line-through"
                          : "text-slate-700"
                      }`}
                    >
                      {ci.name}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {zone ? (
                        <button
                          onClick={() => it && onLocate(it)}
                          className="inline-flex items-center gap-0.5 text-slate-400 hover:text-slate-700"
                        >
                          <MapPin size={9} />
                          {zone}
                        </button>
                      ) : (
                        it && <span className="text-slate-300">Unplaced</span>
                      )}
                      {isGap && (
                        <span className="rounded bg-amber-50 px-1 text-amber-600">
                          {it ? "out of stock" : "not tracked"}
                        </span>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => onRemoveItem(collection.id, ci.id)}
                      aria-label="Remove"
                      className="shrink-0 text-slate-300 hover:text-rose-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add item + gaps → list */}
      {canEdit && (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 shrink-0">
          <AddItemRow
            items={items}
            existingItemIds={new Set(
              collection.items.map((ci) => ci.itemId).filter(Boolean) as string[],
            )}
            onAdd={(entry) => onAddItem(collection.id, entry)}
          />
          {onAddGapsToList && gapNames.length > 0 && (
            <button
              onClick={() => onAddGapsToList(gapNames)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-slate-300 hover:text-slate-700"
            >
              <Plus size={11} strokeWidth={2.5} />
              Add {gapNames.length} gap{gapNames.length === 1 ? "" : "s"} to list
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onDelete(collection.id)}
              className="flex items-center justify-center gap-1.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-rose-500"
            >
              <Trash2 size={11} />
              Delete collection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Add an item: link an owned store item (autocomplete) or type a free name. */
function AddItemRow({
  items,
  existingItemIds,
  onAdd,
}: {
  items: Item[];
  existingItemIds: Set<string>;
  onAdd: (entry: { id: string; itemId: string | null; name: string }) => void;
}) {
  const [text, setText] = useState("");

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (i) =>
          !existingItemIds.has(i.id) && i.name.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [text, items, existingItemIds]);

  const addFree = () => {
    const name = text.trim();
    if (!name) return;
    onAdd({ id: crypto.randomUUID(), itemId: null, name });
    setText("");
  };

  const addLinked = (item: Item) => {
    onAdd({ id: crypto.randomUUID(), itemId: item.id, name: item.name });
    setText("");
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addFree()}
          placeholder="Add an item — link one you have, or type a new one…"
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white"
        />
        <button
          onClick={addFree}
          disabled={!text.trim()}
          className="flex items-center rounded-lg bg-slate-900 px-3 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-40"
        >
          <Plus size={13} strokeWidth={2.5} />
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-12 mb-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => addLinked(s)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
            >
              <span className="truncate">{s.name}</span>
              <span className="ml-2 shrink-0 text-[10px] text-slate-400">
                link · ×{s.quantity}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
