import { useEffect, useRef } from "react";
import type { Item } from "~/types/storeTypes";

type Props = {
  blockId: string | null;
  blockLabel: string;
  items: Item[];
  onClose: () => void;
  onSelectItem: (item: Item) => void;
  selectedItemId: string | null;
};

export function BlockDrawer({
  blockId,
  blockLabel,
  items,
  onClose,
  onSelectItem,
  selectedItemId,
}: Props) {
  const isOpen = blockId !== null;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on outside click — but only the drawer bg, not the grid
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const blockItems = items.filter((item) => item.blockId === blockId);

  return (
    <>
      {/* Backdrop — only on mobile */}
      <div
        className={[
          "lg:hidden fixed inset-0 z-20 transition-opacity duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={[
          "lg:hidden fixed bottom-0 left-0 right-0 z-30",
          "bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ maxHeight: "45vh" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-800">
              {blockLabel || "Block"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {blockItems.length} item{blockItems.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-400 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1 1l8 8M9 1L1 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Items list */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(45vh - 90px)" }}
        >
          {blockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <span className="text-2xl">📦</span>
              <p className="text-[11px] text-slate-300 font-mono uppercase tracking-widest">
                No items in this block
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {blockItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={[
                    "flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors",
                    selectedItemId === item.id
                      ? "bg-slate-800"
                      : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className={[
                        "text-[12px] font-bold truncate",
                        selectedItemId === item.id
                          ? "text-white"
                          : "text-slate-700",
                      ].join(" ")}
                    >
                      {item.name}
                    </span>
                    {item.description && (
                      <span
                        className={[
                          "text-[10px] truncate",
                          selectedItemId === item.id
                            ? "text-slate-300"
                            : "text-slate-400",
                        ].join(" ")}
                      >
                        {item.description}
                      </span>
                    )}
                  </div>
                  <span
                    className={[
                      "text-[11px] font-mono font-bold ml-4 shrink-0",
                      selectedItemId === item.id
                        ? "text-slate-300"
                        : "text-slate-500",
                    ].join(" ")}
                  >
                    ×{item.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
