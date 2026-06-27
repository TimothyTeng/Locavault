import { useMemo, useState } from "react";
import {
  X,
  Clock,
  Users,
  Check,
  Plus,
  Leaf,
  Search,
  ChevronLeft,
  Pencil,
  ExternalLink,
  MapPin,
  ChefHat,
  Minus,
} from "lucide-react";
import type { Item } from "~/types/storeTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import type { Recipe } from "~/lib/recipes";
import {
  matchRecipes,
  prettyIngredient,
  type RecipeMatch,
} from "~/utils/helpers/recipes.helper";
import { formatAmount } from "~/utils/helpers/units";
import { useDialog } from "~/components/common/useDialog";
import { EmptyState } from "~/components/common/EmptyState";
import { RecipeEditor } from "./RecipeEditor";

type Filter = "all" | "cook" | "almost" | "mine";

/** A zero-match stand-in so a freshly-saved recipe still shows under "Mine". */
function emptyMatch(recipe: Recipe): RecipeMatch {
  return {
    recipe,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ingredient,
      inStock: false,
      items: [],
      expiring: false,
    })),
    have: [],
    missing: recipe.ingredients.map((i) => i.name),
    usesExpiring: [],
    total: recipe.ingredients.length,
    haveCount: 0,
    cookable: false,
  };
}

/**
 * Recipes — the flagship OUTPUT surface (DESIGN.md §7). Reads the store's edible
 * inventory and suggests meals you can make from what you keep, plus the user's
 * own saved library (create / import / edit). The detail view highlights which
 * ingredients are on hand and offers one tap to send the lacking ones to the
 * shopping list. "Use it up" leads — recipes consuming items expiring soon.
 */
export function RecipesPanel({
  isOpen,
  onClose,
  items,
  blocks,
  onAddMissing,
  onAddHaveToList,
  onCooked,
  onShowOnMap,
  listedNames,
  listedItemIds,
  isMobile = false,
  userRecipes = [],
  canAddRecipe = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  blocks?: BlocksMap;
  onAddMissing?: (ingredients: string[]) => void;
  onAddHaveToList?: (items: Item[]) => void;
  onCooked?: (
    rows: { itemId: string; amount?: number; unit?: string }[],
    servings: number,
  ) => void;
  onShowOnMap?: (item: Item) => void;
  listedNames?: Set<string>;
  listedItemIds?: Set<string>;
  isMobile?: boolean;
  userRecipes?: Recipe[];
  canAddRecipe?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);
  const dialogRef = useDialog(isOpen, onClose);

  const matches = useMemo(
    () => matchRecipes(items, userRecipes),
    [items, userRecipes],
  );

  // Every user recipe gets a match entry (zero-match ones too) for the "Mine"
  // list, then we overlay the relevance matches on top.
  const matchById = useMemo(() => {
    const map = new Map<string, RecipeMatch>();
    for (const r of userRecipes) map.set(r.id, emptyMatch(r));
    for (const m of matches) map.set(m.recipe.id, m);
    return map;
  }, [matches, userRecipes]);

  const allMine = useMemo(
    () => userRecipes.map((r) => matchById.get(r.id)!),
    [userRecipes, matchById],
  );

  const counts = useMemo(
    () => ({
      all: matches.length,
      cook: matches.filter((m) => m.cookable).length,
      almost: matches.filter((m) => !m.cookable && m.missing.length <= 2)
        .length,
      mine: userRecipes.length,
    }),
    [matches, userRecipes],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = filter === "mine" ? allMine : matches;
    return base.filter((m) => {
      if (q && !m.recipe.name.toLowerCase().includes(q)) return false;
      if (filter === "cook") return m.cookable;
      if (filter === "almost") return !m.cookable && m.missing.length <= 2;
      return true;
    });
  }, [matches, allMine, filter, query]);

  if (!isOpen) return null;

  const detail = detailId ? matchById.get(detailId) : undefined;

  return (
    <>
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Recipes"
        tabIndex={-1}
        className={`absolute inset-y-0 z-30 flex w-full flex-col border-l border-slate-200 bg-white font-mono shadow-2xl outline-none ${
          isMobile ? "right-0" : "right-11 max-w-md"
        }`}
      >
        {detail ? (
          <RecipeDetail
            match={detail}
            blocks={blocks}
            onBack={() => setDetailId(null)}
            onClose={onClose}
            onAddMissing={onAddMissing}
            onAddHaveToList={onAddHaveToList}
            onCooked={onCooked}
            onShowOnMap={onShowOnMap}
            listedNames={listedNames}
            listedItemIds={listedItemIds}
            onEdit={
              detail.recipe.custom ? () => setEditing(detail.recipe) : undefined
            }
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Recipes
                </span>
                <p className="text-[13px] font-bold text-slate-800">
                  Cook from what you keep
                </p>
              </div>
              <div className="flex items-center gap-1">
                {canAddRecipe && (
                  <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
                  >
                    <Plus size={12} strokeWidth={2.5} /> Add
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-1 text-slate-300 transition-colors hover:text-slate-600"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Use-it-up nudge */}
            {filter !== "mine" && countUseItUp(matches) > 0 && (
              <button
                onClick={() => setFilter("all")}
                className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-left transition-colors hover:bg-amber-50"
              >
                <Leaf size={14} className="shrink-0 text-amber-600" />
                <span className="flex-1 text-[11px] text-amber-800">
                  <b>{countUseItUp(matches)}</b> recipe
                  {countUseItUp(matches) === 1 ? "" : "s"} use ingredients
                  expiring soon
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                  Use it up
                </span>
              </button>
            )}

            {/* Search + filters */}
            <div className="flex shrink-0 flex-col gap-2 px-4 py-3">
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
                {(counts.mine > 0 || canAddRecipe) && (
                  <FilterPill
                    label="Mine"
                    n={counts.mine}
                    active={filter === "mine"}
                    onClick={() => setFilter("mine")}
                  />
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto px-4 pb-6">
              {shown.length === 0 ? (
                <EmptyState
                  className="gap-1 py-16"
                  title={
                    filter === "mine"
                      ? "No saved recipes yet"
                      : matches.length === 0
                        ? "Add some food to see recipe ideas"
                        : "No recipes match that filter"
                  }
                  description={
                    filter === "mine"
                      ? "Add your own — by hand or imported from a URL."
                      : matches.length === 0
                        ? "Recipes read the edible items in this store."
                        : "Try “All”, or clear the search."
                  }
                  action={
                    filter === "mine" && canAddRecipe ? (
                      <button
                        onClick={() => setCreating(true)}
                        className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-slate-700"
                      >
                        <Plus size={12} strokeWidth={2.5} /> Add recipe
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {shown.map((m) => (
                    <RecipeCard
                      key={m.recipe.id}
                      match={m}
                      onOpen={() => setDetailId(m.recipe.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {(creating || editing) && (
        <RecipeEditor
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function countUseItUp(matches: RecipeMatch[]): number {
  return matches.filter((m) => m.usesExpiring.length > 0).length;
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

/** Compact list card — opens the detail view on click. */
function RecipeCard({
  match,
  onOpen,
}: {
  match: RecipeMatch;
  onOpen: () => void;
}) {
  const { recipe, usesExpiring, haveCount, total, cookable } = match;
  return (
    <button
      onClick={onOpen}
      className={`flex items-start gap-3 overflow-hidden rounded-xl border bg-white px-3.5 py-3 text-left transition-colors hover:border-slate-300 ${
        cookable ? "border-emerald-200" : "border-slate-200"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-bold text-slate-800">
            {recipe.name}
          </span>
          {recipe.custom && (
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              Yours
            </span>
          )}
          {cookable && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
              Cook now
            </span>
          )}
        </div>
        {recipe.blurb && (
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {recipe.blurb}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
          {recipe.minutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock size={10} />
              {recipe.minutes}m
            </span>
          )}
          {recipe.serves > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users size={10} />
              {recipe.serves}
            </span>
          )}
          <span
            className={
              cookable ? "font-semibold text-emerald-600" : "text-slate-400"
            }
          >
            {haveCount}/{total} on hand
          </span>
          {usesExpiring.length > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <Leaf size={10} />
              use it up
            </span>
          )}
        </div>
      </div>
      <Ring have={haveCount} total={total} cookable={cookable} />
    </button>
  );
}

/** Full recipe — photo, availability, steps, one-tap add-missing. */
function RecipeDetail({
  match,
  blocks,
  onBack,
  onClose,
  onAddMissing,
  onAddHaveToList,
  onCooked,
  onShowOnMap,
  listedNames,
  listedItemIds,
  onEdit,
}: {
  match: RecipeMatch;
  blocks?: BlocksMap;
  onBack: () => void;
  onClose: () => void;
  onAddMissing?: (ingredients: string[]) => void;
  onAddHaveToList?: (items: Item[]) => void;
  onCooked?: (
    rows: { itemId: string; amount?: number; unit?: string }[],
    servings: number,
  ) => void;
  onShowOnMap?: (item: Item) => void;
  listedNames?: Set<string>;
  listedItemIds?: Set<string>;
  onEdit?: () => void;
}) {
  const { recipe, ingredients, missing, cookable } = match;
  const [broken, setBroken] = useState(false);
  const [batch, setBatch] = useState(1);

  // Rows the "Cooked this" action will decrement: in-stock ingredients with a
  // resolved item, carrying the recipe's amount/unit.
  const cookRows = ingredients
    .filter((s) => s.inStock && s.items[0])
    .map((s) => ({
      itemId: s.items[0].id,
      amount: s.ingredient.amount,
      unit: s.ingredient.unit,
    }));

  const missingPretty = missing.map(prettyIngredient);
  const toAdd = missingPretty.filter((n) => !listedNames?.has(n.toLowerCase()));

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="flex-1 truncate text-[13px] font-bold text-slate-800">
          {recipe.name}
        </span>
        {onEdit && (
          <button
            onClick={onEdit}
            aria-label="Edit recipe"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-slate-300 transition-colors hover:text-slate-600"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {recipe.imageUrl && !broken && (
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="h-40 w-full object-cover"
            onError={() => setBroken(true)}
          />
        )}

        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {cookable ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                Cook now
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                {match.haveCount}/{match.total} on hand
              </span>
            )}
            {recipe.minutes > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {recipe.minutes} min
              </span>
            )}
            {recipe.serves > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users size={12} />
                serves {recipe.serves}
              </span>
            )}
          </div>

          {recipe.blurb && (
            <p className="text-[12px] leading-relaxed text-slate-500">
              {recipe.blurb}
            </p>
          )}

          {/* Ingredients */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Ingredients
              </span>
              {onAddMissing && toAdd.length > 0 && (
                <button
                  onClick={() => onAddMissing(toAdd)}
                  className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
                >
                  <Plus size={11} strokeWidth={2.5} /> {toAdd.length} to list
                </button>
              )}
            </div>
            {/* Legend for the per-row icons */}
            {(onShowOnMap || onAddMissing || onAddHaveToList) && (
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                {onShowOnMap && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={10} /> find on the map
                  </span>
                )}
                {(onAddMissing || onAddHaveToList) && (
                  <span className="inline-flex items-center gap-1">
                    <Plus size={10} strokeWidth={2.5} /> add to shopping list
                  </span>
                )}
              </div>
            )}
            <ul className="flex flex-col gap-1">
              {ingredients.map((s, i) => {
                const pretty = prettyIngredient(s.ingredient.name);
                const item = s.items[0];
                const blockLabel = item?.blockId
                  ? blocks?.[item.blockId]?.label
                  : undefined;
                const listed = s.inStock
                  ? s.items.some((it) => listedItemIds?.has(it.id))
                  : !!listedNames?.has(pretty.toLowerCase());
                const canAddRow = s.inStock
                  ? !!onAddHaveToList
                  : !!onAddMissing;
                const addRow = () => {
                  if (s.inStock) {
                    if (item && onAddHaveToList) onAddHaveToList([item]);
                  } else if (onAddMissing) onAddMissing([pretty]);
                };
                const measure =
                  s.ingredient.amount != null
                    ? formatAmount(s.ingredient.amount) +
                      (s.ingredient.unit ? ` ${s.ingredient.unit}` : "") +
                      " "
                    : "";
                return (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg px-1 py-1 text-[12px]"
                  >
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        s.inStock ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        s.inStock ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {measure + pretty}
                    </span>
                    {s.expiring && (
                      <Leaf size={11} className="shrink-0 text-amber-500" />
                    )}
                    {s.inStock && blockLabel && onShowOnMap && item && (
                      <button
                        onClick={() => onShowOnMap(item)}
                        title={`Show ${blockLabel} on the map`}
                        className="flex shrink-0 items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                      >
                        <MapPin size={10} />
                        <span className="max-w-[5rem] truncate">
                          {blockLabel}
                        </span>
                      </button>
                    )}
                    {canAddRow &&
                      (listed ? (
                        <span
                          title="On the shopping list"
                          className="shrink-0 text-emerald-500"
                        >
                          <Check size={13} strokeWidth={2.5} />
                        </span>
                      ) : (
                        <button
                          onClick={addRow}
                          title={
                            s.inStock
                              ? "Restock — add to shopping list"
                              : "Add to shopping list"
                          }
                          className="shrink-0 rounded-md p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
            {onAddMissing && missing.length > 0 && toAdd.length === 0 && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                <Check size={12} strokeWidth={2.5} />
                Missing items on the list
              </div>
            )}
          </div>

          {/* Cooked this → decrement stock */}
          {onCooked && cookRows.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
              <ChefHat size={16} className="shrink-0 text-slate-400" />
              <span className="flex-1 text-[11px] leading-tight text-slate-500">
                Cooked it? Subtract what you used from stock.
              </span>
              <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1">
                <button
                  type="button"
                  onClick={() => setBatch((b) => Math.max(1, b - 1))}
                  disabled={batch <= 1}
                  aria-label="Fewer batches"
                  className="rounded p-1 text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-30"
                >
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-[11px] font-bold text-slate-700">
                  ×{batch}
                </span>
                <button
                  type="button"
                  onClick={() => setBatch((b) => Math.min(20, b + 1))}
                  aria-label="More batches"
                  className="rounded p-1 text-slate-400 transition-colors hover:text-slate-700"
                >
                  <Plus size={12} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onCooked(cookRows, batch)}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-emerald-700"
              >
                Cooked
              </button>
            </div>
          )}

          {/* Steps */}
          {recipe.steps && recipe.steps.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Method
              </span>
              <ol className="mt-2 flex flex-col gap-3">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                      {i + 1}
                    </span>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <p className="text-[12px] leading-relaxed text-slate-600">
                        {step.text}
                      </p>
                      {step.imageUrl && (
                        <img
                          src={step.imageUrl}
                          alt={`Step ${i + 1}`}
                          className="max-h-40 w-full rounded-lg object-cover"
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 transition-colors hover:text-slate-700"
            >
              <ExternalLink size={12} />
              Source
            </a>
          )}
        </div>
      </div>
    </>
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
