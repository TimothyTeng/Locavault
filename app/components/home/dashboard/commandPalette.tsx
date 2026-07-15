import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import {
  Search,
  Package,
  Plus,
  ShoppingCart,
  Bell,
  ArrowLeftRight,
  LayoutGrid,
  CornerDownLeft,
} from "lucide-react";
import { TypeIcon } from "~/components/store/typeIcon";
import type { ItemIndexEntry } from "#types/dashboardTypes";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Package;
  run: () => void;
};

/**
 * ⌘/Ctrl+K command palette for the dashboard: fuzzy item search across every
 * store (jump straight to that store) plus quick navigation actions. Opens on
 * the shortcut or the "/" key, arrow-navigable, Enter to run. Desktop power-user
 * retention — reuses the same lightweight cross-store index the loader builds.
 */
export function CommandPalette({ items }: { items: ItemIndexEntry[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global shortcut: ⌘K / Ctrl+K (and a bare "/" when not already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (
        k === "/" &&
        !open &&
        !/^(input|textarea|select)$/i.test(
          (e.target as HTMLElement)?.tagName ?? "",
        )
      ) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const close = () => setOpen(false);

  const actions: Action[] = useMemo(
    () => [
      {
        id: "new-store",
        label: "New store",
        hint: "Create",
        icon: Plus,
        run: () => navigate("/addstore"),
      },
      {
        id: "templates",
        label: "Browse templates",
        icon: LayoutGrid,
        run: () => navigate("/templates"),
      },
      {
        id: "reminders",
        label: "Open reminders",
        icon: Bell,
        run: () => navigate("/reminders"),
      },
      {
        id: "trade",
        label: "Open the Bazaar",
        icon: ArrowLeftRight,
        run: () => navigate("/trade"),
      },
    ],
    [navigate],
  );

  const q = query.trim().toLowerCase();

  const itemResults = useMemo(() => {
    if (!q) return [];
    return items
      .filter((i) => i.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((i) => ({
        id: `item-${i.id}`,
        label: i.name,
        hint: i.storeName,
        icon: Package,
        itemType: i.itemType,
        run: () => navigate(`/store/${i.storeId}`),
      }));
  }, [items, q, navigate]);

  const actionResults = useMemo(
    () => actions.filter((a) => !q || a.label.toLowerCase().includes(q)),
    [actions, q],
  );

  // Flat list drives arrow navigation; items first, then actions.
  const flat = useMemo(
    () => [...itemResults, ...actionResults],
    [itemResults, actionResults],
  );

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const runAt = (idx: number) => {
    const entry = flat[idx];
    if (!entry) return;
    entry.run();
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-start justify-center pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search items or jump to…"
            className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder-slate-300 outline-none"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
          {flat.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-slate-400">
              {q ? "Nothing matches." : "Type to search your items."}
            </p>
          )}

          {itemResults.length > 0 && (
            <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-300">
              Items
            </p>
          )}
          {itemResults.map((r, i) => (
            <Row
              key={r.id}
              icon={
                <TypeIcon
                  type={r.itemType}
                  className="h-4 w-4 text-slate-400"
                />
              }
              label={r.label}
              hint={r.hint}
              activeRow={active === i}
              onMouseEnter={() => setActive(i)}
              onClick={() => runAt(i)}
            />
          ))}

          {actionResults.length > 0 && (
            <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-300">
              Actions
            </p>
          )}
          {actionResults.map((a, i) => {
            const idx = itemResults.length + i;
            const Icon = a.icon;
            return (
              <Row
                key={a.id}
                icon={<Icon size={15} className="text-slate-400" />}
                label={a.label}
                hint={a.hint}
                activeRow={active === idx}
                onMouseEnter={() => setActive(idx)}
                onClick={() => runAt(idx)}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <ShoppingCart size={11} /> Dashboard
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft size={11} /> to select · ↑↓ to move
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({
  icon,
  label,
  hint,
  activeRow,
  onMouseEnter,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  activeRow: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors ${
        activeRow ? "bg-slate-100" : "hover:bg-slate-50"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate text-slate-700">{label}</span>
      {hint && (
        <span className="shrink-0 text-[11px] text-slate-400">{hint}</span>
      )}
    </button>
  );
}
