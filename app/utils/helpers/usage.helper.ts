import type {
  UsageLog,
  Item,
  UsageConfidence,
  UsageEstimate,
  UsageSource,
} from "~/types/storeTypes";
import type { ItemType } from "~/types/itemTypeTypes";

const DAY_MS = 86_400_000;

/**
 * Recency half-life: a consumption event from `HALF_LIFE_DAYS` ago counts half
 * as much as one from today. Keeps the estimate responsive to changes in how
 * fast something is actually being used.
 */
const HALF_LIFE_DAYS = 30;

/** Ignore consumption history older than this — stale habits shouldn't skew it. */
const WINDOW_DAYS = 120;

/**
 * Gentle per-type prior daily consumption rate (units/day) — a rough population
 * guess used for cold-start ("still learning") and to dampen noisy early
 * estimates via shrinkage. Non-depleting types have no prior. These are crude on
 * purpose; real history overtakes them quickly (see PRIOR_STRENGTH). At scale a
 * learned global model would supply these (DESIGN.md §3).
 */
const TYPE_PRIOR: Record<ItemType, number | null> = {
  food: 0.25, // ~1 unit every 4 days
  medication: 0.2, // ~1 dose every few days (until dosing fields exist)
  supplies: 0.1, // ~1 unit every 10 days
  equipment: null,
  clothing: null,
  document: null,
  other: null,
};

/** Prior weight in pseudo-events. Observed data overtakes the prior quickly. */
const PRIOR_STRENGTH = 1.5;

function periodToDays(period: "day" | "week" | "month"): number {
  return period === "day" ? 1 : period === "week" ? 7 : 30;
}

/**
 * Estimate how fast an item is consumed and when it will run out.
 *
 * Priority of signal:
 *  1. **history** — recency-weighted average of the per-interval consumption
 *     rate from real `itemLogs`. Recent intervals dominate (exp. decay), so the
 *     estimate tracks behaviour changes instead of averaging over all time.
 *  2. **manual**  — the user-entered `useRate` / `useRatePeriod` (low trust).
 *  3. **none**    — not enough information.
 *
 * `runoutDays` is always measured from `now` using the *current* quantity, so it
 * stays correct regardless of how old the item is.
 */
export function estimateUsage(
  item: Pick<Item, "quantity" | "useRate" | "useRatePeriod" | "itemType">,
  logs: UsageLog[],
  now: Date = new Date(),
): UsageEstimate {
  const nowMs = now.getTime();
  const inWindow = (t: number) => nowMs - t <= WINDOW_DAYS * DAY_MS;

  // Consumption events (outflow, delta < 0) and restock events (inflow, delta >
  // 0), each oldest → newest within the window.
  const consumption = logs
    .filter((l) => l.delta < 0 && l.loggedAt)
    .map((l) => ({ amount: Math.abs(l.delta), t: l.loggedAt!.getTime() }))
    .filter((e) => inWindow(e.t))
    .sort((a, b) => a.t - b.t);
  const restock = logs
    .filter((l) => l.delta > 0 && l.loggedAt)
    .map((l) => ({ amount: l.delta, t: l.loggedAt!.getTime() }))
    .filter((e) => inWindow(e.t))
    .sort((a, b) => a.t - b.t);

  // ── Recency-weighted history rate, pooled from two independent signals ──
  let weightedRateSum = 0;
  let weightSum = 0;
  let samples = 0; // number of per-interval rate observations
  const addSample = (rate: number, atMs: number) => {
    if (!(rate > 0)) return;
    const ageDays = (nowMs - atMs) / DAY_MS;
    const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    weightedRateSum += weight * rate;
    weightSum += weight;
    samples++;
  };
  // Outflow: each consumption amount happened over the interval since the prior
  // consumption event → an instantaneous rate.
  for (let i = 1; i < consumption.length; i++) {
    const dtDays = (consumption[i].t - consumption[i - 1].t) / DAY_MS;
    if (dtDays > 0) addSample(consumption[i].amount / dtDays, consumption[i].t);
  }
  // Inflow cadence: you rebuy once you've used roughly the previous purchase, so
  // the prior restock's quantity was consumed over the gap before this restock.
  for (let i = 1; i < restock.length; i++) {
    const dtDays = (restock[i].t - restock[i - 1].t) / DAY_MS;
    if (dtDays > 0) addSample(restock[i - 1].amount / dtDays, restock[i].t);
  }

  let histRate: number | null = null;
  let events = 0;
  let windowDays = 0;
  if (samples >= 1 && weightSum > 0) {
    histRate = weightedRateSum / weightSum;
    events = consumption.length + restock.length; // observed changes
    const firstT = Math.min(
      consumption.length ? consumption[0].t : Infinity,
      restock.length ? restock[0].t : Infinity,
    );
    windowDays = Number.isFinite(firstT) ? (nowMs - firstT) / DAY_MS : 0;
  }

  const manualRate =
    item.useRate && item.useRatePeriod
      ? item.useRate / periodToDays(item.useRatePeriod)
      : null;
  const priorRate = TYPE_PRIOR[item.itemType] ?? null;

  let dailyRate: number | null = null;
  let source: UsageSource = "none";
  let confidence: UsageConfidence = "none";

  if (histRate != null && histRate >= 0) {
    // ── 1. History, shrunk toward the type prior (Bayesian-flavoured). The more
    //       rate samples we have, the less the prior matters. ──
    dailyRate =
      priorRate != null
        ? (PRIOR_STRENGTH * priorRate + samples * histRate) /
          (PRIOR_STRENGTH + samples)
        : histRate;
    source = "history";
    confidence =
      samples >= 4 && windowDays >= 14
        ? "high"
        : samples >= 2
          ? "medium"
          : "low";
  } else if (manualRate != null && manualRate > 0) {
    // ── 2. User-entered rate ──
    dailyRate = manualRate;
    source = "manual";
    confidence = "low";
  } else if (priorRate != null && priorRate > 0) {
    // ── 3. Cold start: a gentle guess from the item type ("still learning") ──
    dailyRate = priorRate;
    source = "prior";
    confidence = "low";
  }

  // ── Project run-out from now ──
  let runoutDays: number | null = null;
  let runoutDate: Date | null = null;
  if (item.quantity <= 0) {
    runoutDays = 0;
    runoutDate = now;
  } else if (dailyRate && dailyRate > 0) {
    runoutDays = Math.floor(item.quantity / dailyRate);
    runoutDate = new Date(nowMs + runoutDays * DAY_MS);
  }

  return {
    dailyRate,
    source,
    confidence,
    runoutDays,
    runoutDate,
    events,
    windowDays: Math.round(windowDays),
  };
}

/** Human label for a usage source / confidence, e.g. for tooltips. */
export function describeUsage(u: UsageEstimate | undefined): string {
  if (!u || u.dailyRate == null || u.dailyRate <= 0) return "No usage data yet";
  const perDay = u.dailyRate;
  const rateLabel =
    perDay >= 1
      ? `${perDay.toFixed(1)}/day`
      : `${(perDay * 7).toFixed(1)}/week`;
  if (u.source === "history") {
    return `Learned from ${u.events} change${u.events !== 1 ? "s" : ""} over ${u.windowDays}d · ${u.confidence} confidence · ~${rateLabel}`;
  }
  if (u.source === "manual") return `Manual estimate · ~${rateLabel}`;
  if (u.source === "prior") {
    return `Still learning — rough guess from item type · ~${rateLabel}`;
  }
  return `~${rateLabel}`;
}
