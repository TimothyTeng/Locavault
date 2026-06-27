import { useMemo, useState } from "react";
import {
  X,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
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
} from "~/utils/helpers/calendar.helper";
import { useDialog } from "~/components/common/useDialog";
import { EmptyState } from "~/components/common/EmptyState";

/** Subtle per-meal-type accent. */
const MEAL_TONE: Record<MealType, string> = {
  breakfast: "bg-amber-400",
  lunch: "bg-sky-400",
  dinner: "bg-indigo-400",
  snack: "bg-emerald-400",
};

/**
 * Store calendar (DESIGN.md §7). A week view of scheduled recipes — tap a day to
 * add a recipe to a meal slot, remove with one tap, and "shop for the week" to
 * push every lacking ingredient across the week's plan to the shopping list (the
 * planning → shopping reinforcing loop). Per-store, editor-only. Named generically
 * ("calendar", not "meal plan") to host other reminders/entries in future.
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
}) {
  const dialogRef = useDialog(isOpen, onClose);
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [picking, setPicking] = useState<string | null>(null); // dateKey
  const [pickType, setPickType] = useState<MealType>("dinner");
  const [query, setQuery] = useState("");

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

  const days = weekDays(weekStart);

  if (!isOpen) return null;

  // "Shop for the week": every lacking ingredient across this week's plan.
  const shopForWeek = () => {
    if (!onAddMissing) return;
    const keys = new Set(days.map(dateKey));
    const byId = new Map(library.map((r) => [r.id, r]));
    const planned: Recipe[] = [];
    const seen = new Set<string>();
    for (const meal of meals) {
      if (!keys.has(meal.dateKey)) continue;
      const r = byId.get(meal.recipeRef);
      if (r && !seen.has(r.id)) {
        seen.add(r.id);
        planned.push(r);
      }
    }
    if (!planned.length) return;
    const matchById = new Map(
      matchRecipes(items, planned).map((m) => [m.recipe.id, m]),
    );
    const names = new Set<string>();
    for (const r of planned) {
      const m = matchById.get(r.id);
      // A recipe with zero pantry matches is dropped by matchRecipes — then
      // every ingredient is lacking.
      const missing = m ? m.missing : r.ingredients.map((i) => i.name);
      missing.forEach((n) => names.add(prettyIngredient(n)));
    }
    if (names.size) onAddMissing([...names]);
  };

  const weekHasMeals = days.some((d) => byDay.get(dateKey(d))?.length);

  const shownLibrary = (() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? library.filter((r) => r.name.toLowerCase().includes(q))
      : library;
    return list.slice(0, 60);
  })();

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="Calendar"
      tabIndex={-1}
      className={`absolute inset-y-0 z-30 flex w-full flex-col border-l border-slate-200 bg-white font-mono shadow-2xl outline-none ${
        isMobile ? "right-0" : "right-11 max-w-md"
      }`}
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
      ) : (
        /* ── Week view ── */
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Calendar
              </span>
              <p className="text-[13px] font-bold text-slate-800">
                Plan the week ahead
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

          {/* Week nav */}
          <div className="flex shrink-0 items-center gap-2 px-4 py-3">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              aria-label="Previous week"
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="flex-1 text-center text-[12px] font-bold text-slate-700">
              {weekLabel(weekStart)}
            </span>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              aria-label="Next week"
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(today))}
              className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-100"
            >
              Today
            </button>
          </div>

          {/* Days */}
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
                      onClick={() => {
                        setQuery("");
                        setPicking(key);
                      }}
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
                          <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">
                            {meal.recipeName}
                          </span>
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

            {!weekHasMeals && (
              <EmptyState
                className="gap-1 py-10"
                title="Nothing planned this week"
                description="Tap “Add” on a day to schedule a recipe."
              />
            )}
          </div>

          {/* Shop for the week */}
          {onAddMissing && weekHasMeals && (
            <div className="shrink-0 border-t border-slate-100 p-3">
              <button
                onClick={shopForWeek}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
              >
                <ShoppingCart size={13} />
                Shop for this week
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
