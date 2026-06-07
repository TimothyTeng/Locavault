import { useEffect } from "react";
import { AddItemForm } from "#components/addItem/addItemForm";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    quantity: number;
    inStore: boolean;
    selectedBlockId?: string | null;
    sku?: string | null;
    unit?: string | null;
    minQuantity?: number | null;
    cost?: number | null;
    expiryDate?: Date | null;
    useRate?: number | null;
    useRatePeriod?: "day" | "week" | "month" | null;
  }) => void;
  categories?: { id: string; label: string }[];
  selectedBlockId?: string | null;
  selectedBlockLabel?: string;
  isMobile?: boolean;
};

export function AddItemPanel({
  isOpen,
  onClose,
  onSubmit,
  categories,
  selectedBlockId,
  selectedBlockLabel,
  isMobile = false,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (isMobile) {
    // Slides DOWN from top (below navbar), takes top half of screen.
    // MiniMap stays expanded in the bottom half for block selection.
    return (
      <div
        className={[
          "fixed top-10 left-0 right-0 z-20",
          "h-[calc(57vh-7rem)] bg-white border-b border-slate-200 shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-out",
          isOpen
            ? "translate-y-0"
            : "-translate-y-full invisible pointer-events-none",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800">
            Add Item
          </span>
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

        {/* Form — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <AddItemForm
            onSubmit={onSubmit}
            categories={categories}
            selectedBlockId={selectedBlockId}
            selectedBlockLabel={selectedBlockLabel}
          />
        </div>
      </div>
    );
  }

  // Desktop: slides in from right
  return (
    <div
      className={[
        "fixed top-16 right-0 h-[calc(100vh-4rem)] z-50 w-1/2",
        "bg-white border-l border-slate-200 shadow-2xl",
        "flex flex-col transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-slate-200 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800">
          Add Item
        </span>
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

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <AddItemForm
          onSubmit={onSubmit}
          selectedBlockId={selectedBlockId}
          selectedBlockLabel={selectedBlockLabel}
        />
      </div>
    </div>
  );
}
