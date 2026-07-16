import { Package, TrendingDown, Wallet, BarChart3 } from "lucide-react";
import type { Insights } from "#types/dashboardTypes";
import { formatMoney } from "#utils/helpers/money.helper";
import { TYPE_META } from "~/lib/itemTypes";
import { TypeIcon } from "#components/store/typeIcon";

/**
 * Dashboard insights: three headline stat tiles, a 6-month spend trend (from the
 * accurate itemLogs.costCents snapshots), and a spend-by-category breakdown.
 * Spend tracking begins when items are bought from a shopping list, so the chart
 * shows a gentle empty state until there's tracked spend to show.
 */
export function InsightsPanel({ insights }: { insights: Insights }) {
  const { itemsTracked, runoutsThisWeek, spendThisMonthCents, spendByMonth } =
    insights;
  const hasSpend = spendByMonth.some((m) => m.cents > 0);
  const peak = Math.max(1, ...spendByMonth.map((m) => m.cents));
  const typeTotal = insights.spendByType.reduce((s, t) => s + t.cents, 0);

  const tiles = [
    {
      icon: Package,
      label: "Items tracked",
      value: String(itemsTracked),
      tint: "text-slate-600",
    },
    {
      icon: TrendingDown,
      label: "Run-outs this week",
      value: String(runoutsThisWeek),
      tint: runoutsThisWeek > 0 ? "text-amber-600" : "text-slate-600",
    },
    {
      icon: Wallet,
      label: "Tracked this month",
      value: formatMoney(spendThisMonthCents),
      tint: "text-emerald-700",
    },
  ];

  return (
    <div className="lv-dash-attn mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        <BarChart3 size={13} className="text-slate-300" />
        Insights
      </div>

      {/* Stat tiles */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
            >
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <Icon size={12} />
                {t.label}
              </div>
              <div className={`text-lg font-bold tabular-nums ${t.tint}`}>
                {t.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Spend trend */}
      {hasSpend ? (
        <>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Spend · last 6 months
          </div>
          <div className="flex items-end gap-1.5" style={{ height: 72 }}>
            {spendByMonth.map((m) => (
              <div
                key={m.key}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${m.label}: ${formatMoney(m.cents)}`}
              >
                <div
                  className="w-full rounded-t bg-emerald-500/80"
                  style={{
                    height: `${Math.round((m.cents / peak) * 56)}px`,
                    minHeight: m.cents > 0 ? 3 : 0,
                  }}
                />
                <span className="text-[9px] font-medium text-slate-400">
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          {/* By category */}
          {insights.spendByType.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                By category
              </div>
              {insights.spendByType.slice(0, 5).map((t) => (
                <div key={t.itemType} className="flex items-center gap-2">
                  <span className="flex w-24 items-center gap-1.5 text-[11px] text-slate-500">
                    <TypeIcon type={t.itemType} className="h-3 w-3" />
                    {TYPE_META[t.itemType].label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{
                        width: `${Math.round((t.cents / Math.max(1, typeTotal)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-14 text-right text-[11px] font-medium tabular-nums text-slate-600">
                    {formatMoney(t.cents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] text-slate-400">
          Spend tracking starts when you buy items from a shopping list —
          restock a few things to see your spending here. 💸
        </p>
      )}
    </div>
  );
}
