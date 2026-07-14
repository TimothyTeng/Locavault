import { useMemo, useState } from "react";
import {
  X,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Check,
} from "lucide-react";
import type { Item } from "~/types/storeTypes";
import { RECIPES, type Recipe } from "~/lib/recipes";
import {
  type MealType,
  MEAL_TYPES,
  type ScheduledMeal,
} from "~/types/recipeTypes";
import { matchRecipes, prettyIngredient } from "~/utils/helpers/recipes.helper";
import {
  startOfWeek,
  weekDays,
  addDays,
  dateKey,
  parseDateKey,
  dayParts,
  weekLabel,
  isSameDay,
  startOfMonth,
  addMonths,
  isSameMonth,
  monthGrid,
  monthLabel,
} from "~/utils/helpers/calendar.helper";
import { SidePanel } from "~/components/common/SidePanel";
import { EmptyState } from "~/components/common/EmptyState";

/** Subtle per-meal-type accent. */
const MEAL_TONE: Record<MealType, string> = {
  breakfast: "bg-amber-400",
  lunch: "bg-sky-400",
  dinner: "bg-indigo-400",
  snack: "bg-emerald-400",
};

const WEEKDAY_HEADS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Aggregated ingredient need across a set of planned recipes. */
type Needs = { have: string[]; missing: string[] };

/**
 * Store calendar (DESIGN.md §7). Schedule recipes onto days (week or month view),
 * see what's planned at a glance, and track the ingredients those meals need —
 * pushing the lacking ones to the shopping list (the planning → shopping
 * reinforcing loop). Per-store, editor-only. Named generically ("calendar", not
 * "meal plan") to host other reminders/entries in future.
 */
export function CalendarPanel({
  isOpen,
  onClose,
  isMobile = false,
  meals,
  items,
  userRecipes = [],
  onSchedule,
  onUnschedule,
  onAddMissing,
  onOpenRecipe,
}: {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  meals: ScheduledMeal[];
  items: Item[];
  userRecipes?: Recipe[];
  onSchedule: (
    recipeRef: string,
    recipeName: string,
    dateKey: string,
    mealType: MealType,
  ) => void;
  onUnschedule: (mealId: string) => void;
  onAddMissing?: (names: string[]) => void;
  /** Open a scheduled recipe's detail (in the recipes panel). */
  onOpenRecipe?: (recipeRef: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<"week" | "month">("week");
  // Anchor date — the week (via startOfWeek) or month (via startOfMonth) shown.
  const [cursor, setCursor] = useState<Date>(today);
  const [picking, setPicking] = useState<string | null>(null); // dateKey
  const [pickType, setPickType] = useState<MealType>("dinner");
  const [query, setQuery] = useState("");
  const [dayDetail, setDayDetail] = useState<string | null>(null); // dateKey
  const [showNeeds, setShowNeeds] = useState(false);

  // The full pickable library: the user's saved recipes first, then the seeds.
  const library = useMemo<Recipe[]>(
    () => [...userRecipes, ...RECIPES],
    [userRecipes],
  );

  // meals grouped by day for quick lookup
  const byDay = useMemo(() => {
    const m = new Map<string, ScheduledMeal[]>();
    for (const meal of meals) {
      const arr = m.get(meal.dateKey);
      if (arr) arr.push(meal);
      else m.set(meal.dateKey, [meal]);
    }
    return m;
  }, [meals]);

  const weekStart = startOfWeek(cursor);
  const monthStart = startOfMonth(cursor);
  const days = view === "week" ? weekDays(weekStart) : monthGrid(monthStart);

  // The actual dates in the visible period (week = 7 days; month = same-month
  // cells only) — what "needs" and the period label cover.
  const periodKeys = useMemo(() => {
    const list =
      view === "week"
        ? weekDays(weekStart)
        : monthGrid(monthStart).filter((d) => isSameMonth(d, monthStart));
    return new Set(list.map(dateKey));
  }, [view, weekStart, monthStart]);

  // Ingredients needed across every recipe planned in the visible period.
  const needs = useMemo<Needs>(() => {
    const byId = new Map(library.map((r) => [r.id, r]));
    const planned: Recipe[] = [];
    const seen = new Set<string>();
    for (const meal of meals) {
      if (!periodKeys.has(meal.dateKey)) continue;
      const r = byId.get(meal.recipeRef);
      if (r && !seen.has(r.id)) {
        seen.add(r.id);
        planned.push(r);
      }
    }
    const matchById = new Map(
      matchRecipes(items, planned).map((m) => [m.recipe.id, m]),
    );
    // ingredient (pretty) → in stock anywhere it appears
    const status = new Map<string, boolean>();
    for (const r of planned) {
      const m = matchById.get(r.id);
      if (m) {
        for (const s of m.ingredients) {
          const name = prettyIngredient(s.ingredient.name);
          status.set(name, (status.get(name) ?? false) || s.inStock);
        }
      } else {
        // Zero pantry matches → every ingredient lacking.
        for (const ing of r.ingredients) {
          const name = prettyIngredient(ing.name);
          if (!status.has(name)) status.set(name, false);
        }
      }
    }
    const have: string[] = [];
    const missing: string[] = [];
    for (const [name, inStock] of status) (inStock ? have : missing).push(name);
    have.sort((a, b) => a.localeCompare(b));
    missing.sort((a, b) => a.localeCompare(b));
    return { have, missing };
  }, [library, meals, periodKeys, items]);

  const periodHasMeals = [...periodKeys].some((k) => byDay.get(k)?.length);

  const step = (dir: 1 | -1) =>
    setCursor((c) =>
      view === "week" ? addDays(c, dir * 7) : addMonths(c, dir),
    );

  const openPicker = (key: string) => {
    setQuery("");
    setPicking(key);
  };

  const shownLibrary = (() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? library.filter((r) => r.name.toLowerCase().includes(q))
      : library;
    return list.slice(0, 60);
  })();

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      isMobile={isMobile}
      ariaLabel="Calendar"
      chromeless
    >
      {picking ? (
        /* ── Recipe picker for a day ── */
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-3">
            <button
              onClick={() => setPicking(null)}
              aria-label="Back"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="flex-1 truncate text-[13px] font-bold text-slate-800">
              Add to {dayParts(parseDateKey(picking)).weekday}{" "}
              {dayParts(parseDateKey(picking)).day}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-slate-300 transition-colors hover:text-slate-600"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Meal slot */}
          <div className="flex shrink-0 flex-wrap gap-1.5 px-4 py-3">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setPickType(t)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest capitalize transition-colors ${
                  pickType === t
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${MEAL_TONE[t]}`} />
                {t}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="shrink-0 px-4 pb-2">
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
          </div>

          {/* Library */}
          <div className="flex-1 overflow-auto px-4 pb-6">
            <div className="flex flex-col gap-1">
              {shownLibrary.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onSchedule(r.id, r.name, picking, pickType);
                    setPicking(null);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-700">
                    {r.name}
                  </span>
                  {r.custom && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                      Yours
                    </span>
                  )}
                  <Plus size={13} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : dayDetail ? (
        /* ── Single-day detail ── */
        <DayDetail
          dateKey={dayDetail}
          meals={byDay.get(dayDetail) ?? []}
          isToday={isSameDay(parseDateKey(dayDetail), today)}
          onBack={() => setDayDetail(null)}
          onClose={onClose}
          onAdd={() => openPicker(dayDetail)}
          onUnschedule={onUnschedule}
          onOpenRecipe={onOpenRecipe}
        />
      ) : showNeeds ? (
        /* ── Needs for the period ── */
        <NeedsView
          label={
            view === "week" ? weekLabel(weekStart) : monthLabel(monthStart)
          }
          period={view}
          needs={needs}
          onBack={() => setShowNeeds(false)}
          onClose={onClose}
          onAddMissing={onAddMissing}
        />
      ) : (
        /* ── Grid (week or month) ── */
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Calendar
              </span>
              <p className="text-[13px] font-bold text-slate-800">
                Plan your meals
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 text-slate-300 transition-colors hover:text-slate-600"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* View toggle + Today */}
          <div className="flex shrink-0 items-center justify-between px-4 pt-3">
            <div className="flex rounded-lg border border-slate-200 p-0.5">
              {(["week", "month"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-widest capitalize transition-colors ${
                    view === v
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCursor(today)}
              className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-100"
            >
              Today
            </button>
          </div>

          {/* Period nav */}
          <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
            <button
              onClick={() => step(-1)}
              aria-label={view === "week" ? "Previous week" : "Previous month"}
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="flex-1 text-center text-[12px] font-bold text-slate-700">
              {view === "week" ? weekLabel(weekStart) : monthLabel(monthStart)}
            </span>
            <button
              onClick={() => step(1)}
              aria-label={view === "week" ? "Next week" : "Next month"}
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Body */}
          {view === "week" ? (
            <div className="flex-1 overflow-auto px-3 pb-4">
              {days.map((d) => {
                const key = dateKey(d);
                const dayMeals = byDay.get(key) ?? [];
                const p = dayParts(d);
                const isToday = isSameDay(d, today);
                return (
                  <div key={key} className="border-b border-slate-100 py-2">
                    <div className="mb-1 flex items-center justify-between px-1">
                      <span
                        className={`text-[11px] font-bold ${
                          isToday ? "text-indigo-600" : "text-slate-700"
                        }`}
                      >
                        {p.weekday} {p.day}
                        {isToday && (
                          <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest text-indigo-400">
                            today
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => openPicker(key)}
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Plus size={11} strokeWidth={2.5} /> Add
                      </button>
                    </div>
                    {dayMeals.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {dayMeals.map((meal) => (
                          <div
                            key={meal.id}
                            className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${MEAL_TONE[meal.mealType]}`}
                              title={meal.mealType}
                            />
                            <button
                              type="button"
                              onClick={() => onOpenRecipe?.(meal.recipeRef)}
                              disabled={!onOpenRecipe}
                              title={onOpenRecipe ? "Open recipe" : undefined}
                              className="min-w-0 flex-1 truncate text-left text-[12px] text-slate-700 enabled:hover:text-indigo-600 enabled:hover:underline"
                            >
                              {meal.recipeName}
                            </button>
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400 capitalize">
                              {meal.mealType}
                            </span>
                            <button
                              onClick={() => onUnschedule(meal.id)}
                              aria-label="Remove meal"
                              className="shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {!periodHasMeals && (
                <EmptyState
                  className="gap-1 py-10"
                  title="Nothing planned this week"
                  description="Tap “Add” on a day to schedule a recipe."
                />
              )}
            </div>
          ) : (
            /* Month grid */
            <div className="flex-1 overflow-auto px-3 pb-4">
              <div className="grid grid-cols-7 border-b border-slate-100 pb-1">
                {WEEKDAY_HEADS.map((w) => (
                  <span
                    key={w}
                    className="py-1 text-center text-[9px] font-bold uppercase tracking-widest text-slate-300"
                  >
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d) => {
                  const key = dateKey(d);
                  const dayMeals = byDay.get(key) ?? [];
                  const inMonth = isSameMonth(d, monthStart);
                  const isToday = isSameDay(d, today);
                  return (
                    <button
                      key={key}
                      onClick={() => setDayDetail(key)}
                      className={`flex min-h-[3.25rem] flex-col items-center gap-1 border-b border-r border-slate-50 py-1.5 transition-colors hover:bg-slate-50 ${
                        inMonth ? "" : "opacity-40"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          isToday
                            ? "bg-indigo-600 text-white"
                            : "text-slate-600"
                        }`}
                      >
                        {dayParts(d).day}
                      </span>
                      {dayMeals.length > 0 && (
                        <span className="flex flex-wrap items-center justify-center gap-0.5">
                          {dayMeals.slice(0, 4).map((m) => (
                            <span
                              key={m.id}
                              className={`h-1.5 w-1.5 rounded-full ${MEAL_TONE[m.mealType]}`}
                            />
                          ))}
                          {dayMeals.length > 4 && (
                            <span className="text-[8px] font-bold text-slate-400">
                              +{dayMeals.length - 4}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!periodHasMeals && (
                <EmptyState
                  className="gap-1 py-8"
                  title="Nothing planned this month"
                  description="Tap a day to schedule a recipe."
                />
              )}
            </div>
          )}

          {/* Needs / shop for the period */}
          {onAddMissing && periodHasMeals && (
            <div className="shrink-0 border-t border-slate-100 p-3">
              <button
                onClick={() => setShowNeeds(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
              >
                <ShoppingCart size={13} />
                What this {view} needs
                {needs.missing.length > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
                    {needs.missing.length} to buy
                  </span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </SidePanel>
  );
}

/** A single day's meals, with add + per-meal remove. */
function DayDetail({
  dateKey: key,
  meals,
  isToday,
  onBack,
  onClose,
  onAdd,
  onUnschedule,
  onOpenRecipe,
}: {
  dateKey: string;
  meals: ScheduledMeal[];
  isToday: boolean;
  onBack: () => void;
  onClose: () => void;
  onAdd: () => void;
  onUnschedule: (mealId: string) => void;
  onOpenRecipe?: (recipeRef: string) => void;
}) {
  const p = dayParts(parseDateKey(key));
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="flex-1 truncate text-[13px] font-bold text-slate-800">
          {p.weekday} {p.month} {p.day}
          {isToday && (
            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest text-indigo-400">
              today
            </span>
          )}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-slate-300 transition-colors hover:text-slate-600"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="shrink-0 px-4 py-3">
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
        >
          <Plus size={13} strokeWidth={2.5} /> Add a meal
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6">
        {meals.length === 0 ? (
          <EmptyState
            className="gap-1 py-10"
            title="Nothing planned"
            description="Add a recipe to this day."
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${MEAL_TONE[meal.mealType]}`}
                  title={meal.mealType}
                />
                <button
                  type="button"
                  onClick={() => onOpenRecipe?.(meal.recipeRef)}
                  disabled={!onOpenRecipe}
                  title={onOpenRecipe ? "Open recipe" : undefined}
                  className="min-w-0 flex-1 truncate text-left text-[12px] text-slate-700 enabled:hover:text-indigo-600 enabled:hover:underline"
                >
                  {meal.recipeName}
                </button>
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-400 capitalize">
                  {meal.mealType}
                </span>
                <button
                  onClick={() => onUnschedule(meal.id)}
                  aria-label="Remove meal"
                  className="shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Ingredients the period's meals need — missing (to buy) and on-hand. */
function NeedsView({
  label,
  period,
  needs,
  onBack,
  onClose,
  onAddMissing,
}: {
  label: string;
  period: "week" | "month";
  needs: Needs;
  onBack: () => void;
  onClose: () => void;
  onAddMissing?: (names: string[]) => void;
}) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3 py-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 truncate">
          <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Needs · {period}
          </span>
          <span className="block truncate text-[13px] font-bold text-slate-800">
            {label}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-slate-300 transition-colors hover:text-slate-600"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3">
        {needs.have.length === 0 && needs.missing.length === 0 ? (
          <EmptyState
            className="gap-1 py-10"
            title="No ingredients to tally"
            description="Schedule recipes to see what they need."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* To buy */}
            {needs.missing.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    To buy ({needs.missing.length})
                  </span>
                  {onAddMissing && (
                    <button
                      onClick={() => onAddMissing(needs.missing)}
                      className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
                    >
                      <Plus size={11} strokeWidth={2.5} /> All to list
                    </button>
                  )}
                </div>
                <ul className="flex flex-col gap-1">
                  {needs.missing.map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-2 rounded-lg px-1 py-1 text-[12px]"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full bg-slate-300"
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-600">
                        {name}
                      </span>
                      {onAddMissing && (
                        <button
                          onClick={() => onAddMissing([name])}
                          title="Add to shopping list"
                          className="shrink-0 rounded-md p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* On hand */}
            {needs.have.length > 0 && (
              <div>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  In stock ({needs.have.length})
                </span>
                <ul className="flex flex-col gap-1">
                  {needs.have.map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-2 rounded-lg px-1 py-1 text-[12px]"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-700">
                        {name}
                      </span>
                      <Check size={13} className="shrink-0 text-emerald-500" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
