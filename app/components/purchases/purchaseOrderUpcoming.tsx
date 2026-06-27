import { useState } from "react";
import type { MealNeed } from "~/types/recipeTypes";
import {
  dateKey,
  parseDateKey,
  addDays,
  dayParts,
} from "~/utils/helpers/calendar.helper";
import { EmptyState } from "~/components/common/EmptyState";

const RANGES = [
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
] as const;

type Props = {
  /** Per-meal needs (day + missing-from-stock ingredient names), today onward. */
  mealNeeds: MealNeed[];
  /** Names already on the shopping list (lowercased). */
  existingNames: Set<string>;
  onAdd: (names: string[]) => void;
};

/**
 * The shopping list's "Upcoming" tab — ingredients the meals scheduled within a
 * chosen timeframe call for but the store is out of, each tagged with the soonest
 * day it's needed. One-tap add (and add-all), so a week's cooking plan becomes a
 * shopping list. dateKeys are "YYYY-MM-DD", so lexical compares are chronological.
 */
export function PurchaseOrderUpcoming({
  mealNeeds,
  existingNames,
  onAdd,
}: Props) {
  const [days, setDays] = useState<number>(7);

  const today = new Date();
  const todayKey = dateKey(today);
  const endKey = dateKey(addDays(today, days - 1));

  // ingredient name → soonest day in range it's needed
  const earliest = new Map<string, string>();
  for (const need of mealNeeds) {
    if (need.dateKey < todayKey || need.dateKey > endKey) continue;
    for (const name of need.names) {
      const prev = earliest.get(name);
      if (!prev || need.dateKey < prev) earliest.set(name, need.dateKey);
    }
  }

  const rows = [...earliest.entries()]
    .map(([name, dk]) => ({
      name,
      dk,
      added: existingNames.has(name.toLowerCase()),
    }))
    .sort((a, b) =>
      a.dk === b.dk ? a.name.localeCompare(b.name) : a.dk.localeCompare(b.dk),
    );

  const toBuy = rows.filter((r) => !r.added).map((r) => r.name);

  const dayChip = (dk: string) => {
    if (dk === todayKey) return "Today";
    const p = dayParts(parseDateKey(dk));
    return `${p.weekday} ${p.day}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Timeframe selector */}
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-4 py-3 border-b border-slate-100">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              days === r.days
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="flex-1 gap-1"
          title="Nothing coming up"
          description="Schedule meals on the calendar to see what to buy."
        />
      ) : (
        <>
          <div className="shrink-0 flex items-center justify-between px-4 h-9">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Needed soon
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {toBuy.length}
              </span>
            </span>
            {toBuy.length > 0 && (
              <button
                onClick={() => onAdd(toBuy)}
                className="text-[9px] font-bold uppercase tracking-widest text-indigo-700 hover:text-indigo-900 transition-colors"
              >
                + Add all
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1">
            {rows.map((r) => (
              <button
                key={r.name}
                onClick={() => !r.added && onAdd([r.name])}
                disabled={r.added}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                  r.added
                    ? "opacity-40 cursor-default"
                    : "hover:bg-slate-50 cursor-pointer"
                }`}
              >
                <span className="min-w-0 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-700 truncate">
                    {r.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                    {dayChip(r.dk)}
                  </span>
                </span>
                {r.added ? (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="#94a3b8"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="shrink-0 text-indigo-600 text-sm leading-none font-bold">
                    +
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
