import { useMemo, useState } from "react";
import { X, Clock, Users, Check, Plus, Leaf, Search } from "lucide-react";
import type { Item } from "~/types/storeTypes";
import {
  matchRecipes,
  prettyIngredient,
  type RecipeMatch,
} from "~/utils/helpers/recipes.helper";

type Filter = "all" | "cook" | "almost" | "useup";

/**
 * Recipes — the flagship OUTPUT surface (DESIGN.md §7). Reads the store's edible
 * inventory and suggests meals you can make from what you keep. Three jobs:
 * suggest from what's available, surface the lacking ingredients (one tap to the
 * shopping list), and lead with "use it up" — recipes that consume items expiring
 * soon, the emotional core of food-first.
 */
export function RecipesPanel({
  isOpen,
  onClose,
  items,
  onAddMissing,
  listedNames,
  isMobile = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  onAddMissing?: (ingredients: string[]) => void;
  listedNames?: Set<string>;
  isMobile?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const matches = useMemo(() => matchRecipes(items), [items]);

  const counts = useMemo(
    () => ({
      all: matches.length,
      cook: matches.filter((m) => m.cookable).length,
      almost: matches.filter((m) => !m.cookable && m.missing.length <= 2)
        .length,
      useup: matches.filter((m) => m.usesExpiring.length > 0).length,
    }),
    [matches],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter((m) => {
      if (q && !m.recipe.name.toLowerCase().includes(q)) return false;
      if (filter === "cook") return m.cookable;
      if (filter === "almost") return !m.cookable && m.missing.length <= 2;
      if (filter === "useup") return m.usesExpiring.length > 0;
      return true;
    });
  }, [matches, filter, query]);

  if (!isOpen) return null;

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
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Recipes
            </span>
            <p className="text-[13px] font-bold text-slate-800">
              Cook from what you keep
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 transition-colors hover:text-slate-600"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Use-it-up nudge */}
        {counts.useup > 0 && (
          <button
            onClick={() => setFilter(filter === "useup" ? "all" : "useup")}
            className={`mx-4 mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
              filter === "useup"
                ? "border-amber-300 bg-amber-50"
                : "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
            }`}
          >
            <Leaf size={14} className="shrink-0 text-amber-600" />
            <span className="flex-1 text-[11px] text-amber-800">
              <b>{counts.useup}</b> recipe{counts.useup === 1 ? "" : "s"} use
              ingredients expiring soon
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
              Use it up
            </span>
          </button>
        )}

        {/* Search + filters */}
        <div className="flex flex-col gap-2 px-4 py-3 shrink-0">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-[12px] text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>
          <div className="flex gap-1.5">
            <FilterPill
              label="All"
              n={counts.all}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterPill
              label="Cook now"
              n={counts.cook}
              active={filter === "cook"}
              onClick={() => setFilter("cook")}
              tone="emerald"
            />
            <FilterPill
              label="Almost"
              n={counts.almost}
              active={filter === "almost"}
              onClick={() => setFilter("almost")}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto px-4 pb-6">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
              <p className="text-[12px] font-semibold text-slate-500">
                {matches.length === 0
                  ? "Add some food to see recipe ideas"
                  : "No recipes match that filter"}
              </p>
              <p className="text-[11px] text-slate-400">
                {matches.length === 0
                  ? "Recipes read the edible items in this store."
                  : "Try “All”, or clear the search."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((m) => (
                <RecipeCard
                  key={m.recipe.id}
                  match={m}
                  onAddMissing={onAddMissing}
                  listedNames={listedNames}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FilterPill({
  label,
  n,
  active,
  onClick,
  tone = "slate",
}: {
  label: string;
  n: number;
  active: boolean;
  onClick: () => void;
  tone?: "slate" | "emerald";
}) {
  const activeCls =
    tone === "emerald"
      ? "bg-emerald-600 text-white border-emerald-600"
      : "bg-slate-900 text-white border-slate-900";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
        active
          ? activeCls
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      {label}
      <span className={active ? "opacity-80" : "text-slate-300"}>{n}</span>
    </button>
  );
}

function RecipeCard({
  match,
  onAddMissing,
  listedNames,
}: {
  match: RecipeMatch;
  onAddMissing?: (ingredients: string[]) => void;
  listedNames?: Set<string>;
}) {
  const { recipe, have, missing, usesExpiring, haveCount, total, cookable } =
    match;
  const [open, setOpen] = useState(false);

  // Missing ingredients not already on the shopping list.
  const missingPretty = missing.map(prettyIngredient);
  const toAdd = missingPretty.filter((n) => !listedNames?.has(n.toLowerCase()));

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white transition-colors ${
        cookable ? "border-emerald-200" : "border-slate-200"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-bold text-slate-800">
              {recipe.name}
            </span>
            {cookable && (
              <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                Cook now
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {recipe.blurb}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock size={10} />
              {recipe.minutes}m
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={10} />
              {recipe.serves}
            </span>
            <span
              className={
                cookable ? "font-semibold text-emerald-600" : "text-slate-400"
              }
            >
              {haveCount}/{total} on hand
            </span>
          </div>
        </div>
        {/* Ring progress */}
        <Ring have={haveCount} total={total} cookable={cookable} />
      </button>

      {usesExpiring.length > 0 && (
        <div className="mx-3.5 mb-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
          <Leaf size={10} className="shrink-0" />
          Uses {usesExpiring.map(prettyIngredient).join(", ")} — expiring soon
        </div>
      )}

      {open && (
        <div className="border-t border-slate-100 px-3.5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {have.map((ing) => (
              <span
                key={ing}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700"
              >
                <Check size={9} strokeWidth={3} />
                {prettyIngredient(ing)}
              </span>
            ))}
            {missing.map((ing) => (
              <span
                key={ing}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {prettyIngredient(ing)}
              </span>
            ))}
          </div>
        </div>
      )}

      {onAddMissing && missing.length > 0 && (
        <div className="border-t border-slate-100 px-3.5 py-2.5">
          {toAdd.length > 0 ? (
            <button
              onClick={() => onAddMissing(toAdd)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
            >
              <Plus size={12} strokeWidth={2.5} />
              Add {toAdd.length} missing to list
            </button>
          ) : (
            <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              <Check size={12} strokeWidth={2.5} />
              Missing items on the list
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Tiny circular gauge of ingredients-on-hand. */
function Ring({
  have,
  total,
  cookable,
}: {
  have: number;
  total: number;
  cookable: boolean;
}) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const pct = total ? have / total : 0;
  const color = cookable ? "#059669" : pct >= 0.5 ? "#64748b" : "#cbd5e1";
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" className="shrink-0">
      <circle
        cx="13"
        cy="13"
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth="3"
      />
      <circle
        cx="13"
        cy="13"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 13 13)"
      />
    </svg>
  );
}
