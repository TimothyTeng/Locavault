import type {
  UsageLog,
  Item,
  UsageConfidence,
  UsageEstimate,
  UsageSource,
  RunoutBucket,
} from "~/types/storeTypes";
import type { ItemType } from "~/types/itemTypeTypes";

const DAY_MS = 86_400_000;
const LN2 = Math.log(2);

/** Whole days in each use-rate period. Shared so "a month" is 30 days everywhere. */
export const PERIOD_DAYS: Record<"day" | "week" | "month", number> = {
  day: 1,
  week: 7,
  month: 30,
};

/**
 * Recency half-life: a consumption event from `HALF_LIFE_DAYS` ago counts half
 * as much as one from today. Keeps the estimate responsive to changes in how
 * fast something is actually being used, and bounds the weighted exposure so a
 * long-idle item can't dominate the denominator forever.
 */
const HALF_LIFE_DAYS = 30;

/** Ignore consumption history older than this — stale habits shouldn't skew it. */
const WINDOW_DAYS = 120;

/**
 * Gentle per-type prior daily consumption rate (units/day) — a rough population
 * guess used for cold-start ("still learning") and to dampen noisy early
 * estimates. Non-depleting types have no prior. These are crude on purpose; real
 * history overtakes them quickly. At scale a learned global model would supply
 * these (DESIGN.md §3).
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

/**
 * Prior strength in pseudo-events (the Gamma shape α₀). The rate prior is
 * `λ ~ Gamma(α₀, β₀)` with `β₀ = α₀ / TYPE_PRIOR`, so the prior mean is exactly
 * the type prior. Observed evidence (units consumed `C`, exposure days `T`)
 * updates it conjugately to `Gamma(α₀ + C, β₀ + T)`. Observed data overtakes the
 * prior within a few real cycles.
 */
const PRIOR_STRENGTH = 1.5;

/**
 * Exposure credited (in days) each time the user answers the confirm-loop with
 * "still have it" past a predicted run-out. It's a right-censoring observation —
 * "this survived beyond the prediction" — so it lowers the rate and pushes the
 * next run-out out. Recency-weighted; repeated confirmations compound.
 */
const CONFIRM_CENSOR_DAYS = 7;

function weightAt(ageDays: number): number {
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/**
 * Weighted exposure (in "effective days") over a service span, with the same
 * exponential recency decay applied continuously:
 *   ∫₀^span 0.5^(a/H) da = (H / ln2) · (1 − 0.5^(span/H))
 * Saturates at H/ln2 (~43d) so an ancient first purchase can't inflate the
 * denominator without bound.
 */
function weightedExposureDays(spanDays: number): number {
  if (spanDays <= 0) return 0;
  return (
    (HALF_LIFE_DAYS / LN2) * (1 - Math.pow(0.5, spanDays / HALF_LIFE_DAYS))
  );
}

/**
 * Estimate how fast an item is consumed and when it will run out — as a
 * distribution, not just a point.
 *
 * Model: consumption is a Poisson process with unknown daily rate λ. We form the
 * conjugate posterior `λ ~ Gamma(α, β)` from:
 *  - **C** — recency-weighted units actually logged as consumed (outflow), and
 *  - **T** — recency-weighted *exposure*: the whole span the item has been in
 *    service, running right up to `now`.
 * Because exposure runs to `now` regardless of when consumption last happened,
 * an item that's been restocked and then just sits accrues exposure with no
 * matching consumption — its rate falls and its run-out correctly *lengthens*
 * (right-censoring of the open cycle; fixes the old stockpiler bias). With no
 * logs at all, `C = T = 0` and the posterior mean is exactly the type prior.
 *
 * The run-out band (`runoutEarly`/`runoutLate`) is the Lomax posterior-predictive
 * p25/p75 for the time to draw down the current quantity — wide when we're still
 * learning, tight once cycles are consistent.
 */
export function estimateUsage(
  item: Pick<Item, "quantity" | "useRate" | "useRatePeriod" | "itemType">,
  logs: UsageLog[],
  now: Date = new Date(),
): UsageEstimate {
  const nowMs = now.getTime();
  const inWindow = (t: number) => nowMs - t <= WINDOW_DAYS * DAY_MS;

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

  // ── Evidence: weighted consumed units (C) over weighted exposure days (T) ──
  let C = 0;
  for (const e of consumption) C += weightAt((nowMs - e.t) / DAY_MS) * e.amount;

  // Exposure spans from the earliest observed event (consumption or restock) to
  // now. Running to now is what makes an idle open cycle censor the estimate.
  const firstT = Math.min(
    consumption.length ? consumption[0].t : Infinity,
    restock.length ? restock[0].t : Infinity,
  );
  const spanDays = Number.isFinite(firstT) ? (nowMs - firstT) / DAY_MS : 0;
  let T = weightedExposureDays(spanDays);

  // "Still have it" confirmations past a prediction are survival evidence: each
  // adds censoring exposure with zero consumption, lengthening future estimates.
  for (const l of logs) {
    if (l.delta === 0 && l.note === "confirmed" && l.loggedAt) {
      const age = (nowMs - l.loggedAt.getTime()) / DAY_MS;
      if (age >= 0 && age <= WINDOW_DAYS)
        T += weightAt(age) * CONFIRM_CENSOR_DAYS;
    }
  }

  // Count of independent consumption observations → confidence.
  const events = consumption.length + restock.length;
  const hasRealSignal = consumption.length >= 1 || restock.length >= 2;

  const priorRate = TYPE_PRIOR[item.itemType] ?? null;
  const manualRate =
    item.useRate && item.useRatePeriod
      ? item.useRate / PERIOD_DAYS[item.useRatePeriod]
      : null;

  // Posterior Gamma(α, β) for the rate.
  let alpha: number | null = null;
  let beta: number | null = null;
  let source: UsageSource = "none";
  let confidence: UsageConfidence = "none";

  if (priorRate != null && priorRate > 0) {
    // Type has a depletion prior → always a conjugate posterior (which reduces
    // to exactly the prior when there's no evidence yet).
    alpha = PRIOR_STRENGTH + C;
    beta = PRIOR_STRENGTH / priorRate + T;
    if (hasRealSignal) {
      source = "history";
      confidence =
        consumption.length >= 4 && spanDays >= 14
          ? "high"
          : consumption.length >= 2
            ? "medium"
            : "low";
    } else {
      source = "prior";
      confidence = "low";
    }
  } else if (hasRealSignal && T > 0 && C > 0) {
    // Non-depleting type but real outflow exists → estimate from data alone
    // (flat/uninformative prior).
    alpha = C;
    beta = T;
    source = "history";
    confidence = consumption.length >= 4 && spanDays >= 14 ? "high" : "low";
  } else if (manualRate != null && manualRate > 0) {
    // User-entered rate, treated as a soft posterior for a consistent band.
    alpha = PRIOR_STRENGTH;
    beta = PRIOR_STRENGTH / manualRate;
    source = "manual";
    confidence = "low";
  }

  const dailyRate =
    alpha != null && beta != null && beta > 0 ? alpha / beta : null;

  // ── Project run-out from now (point + Lomax-predictive p25/p75 band) ──
  let runoutDays: number | null = null;
  let runoutDate: Date | null = null;
  let runoutEarly: number | null = null;
  let runoutLate: number | null = null;

  if (item.quantity <= 0) {
    runoutDays = 0;
    runoutDate = now;
    runoutEarly = 0;
    runoutLate = 0;
  } else if (dailyRate && dailyRate > 0 && alpha != null && beta != null) {
    runoutDays = Math.floor(item.quantity / dailyRate);
    runoutDate = new Date(nowMs + runoutDays * DAY_MS);
    // Time to draw down `quantity` units, predictive ~ Lomax(shape α, scale qβ):
    //   quantile(p) = qβ · ((1 − p)^(−1/α) − 1)
    const scale = item.quantity * beta;
    const q = (p: number) => scale * (Math.pow(1 - p, -1 / alpha) - 1);
    runoutEarly = Math.max(0, Math.floor(q(0.25)));
    runoutLate = Math.floor(q(0.75));
  }

  const est: UsageEstimate = {
    dailyRate,
    source,
    confidence,
    runoutDays,
    runoutDate,
    runoutEarly,
    runoutLate,
    bucket: "learning",
    events,
    windowDays: Math.round(spanDays),
  };
  est.bucket = runoutBucket(est);
  return est;
}

/**
 * Collapse an estimate into a coarse, honest run-out band. A wide predictive
 * spread (still learning) reports `learning` rather than committing to a week —
 * except when run-out is imminent, where surfacing the warning matters more than
 * precision.
 */
export function runoutBucket(u: UsageEstimate): RunoutBucket {
  if (u.runoutDays === 0) return "out";
  if (u.runoutDays == null || u.dailyRate == null || u.source === "none")
    return "learning";

  const d = u.runoutDays;
  // Imminent run-out: warn even if the estimate is still rough.
  if (d <= 3) return "days";
  if (d <= 7) return "this_week";

  // Beyond a week, refuse to name a week if the band is too wide to trust.
  const early = u.runoutEarly ?? d;
  const late = u.runoutLate ?? d;
  const spreadWide = late - early > Math.max(7, d);
  if (u.source === "prior" || (u.confidence === "low" && spreadWide))
    return "learning";

  if (d <= 14) return "next_week";
  return "later";
}

const BUCKET_PHRASE: Record<RunoutBucket, string> = {
  out: "Out",
  days: "Runs out in days",
  this_week: "Likely this week",
  next_week: "Likely next week",
  later: "Well stocked",
  learning: "Still learning",
};

/** Short chip phrase for a run-out bucket ("Likely this week"). */
export function describeRunout(u: UsageEstimate | undefined): string {
  if (!u) return BUCKET_PHRASE.learning;
  return BUCKET_PHRASE[u.bucket];
}

/** Precise range for the tooltip, e.g. "Runs out in ~9–20 days (p25–p75)". */
export function describeRunoutRange(u: UsageEstimate | undefined): string {
  if (!u || u.runoutDays == null) return "Not enough data to predict yet";
  if (u.runoutDays === 0) return "Out now";
  const early = u.runoutEarly;
  const late = u.runoutLate;
  if (early != null && late != null && late > early) {
    return `Runs out in ~${early}–${late} days (p25–p75), most likely ~${u.runoutDays}`;
  }
  return `Runs out in ~${u.runoutDays} days`;
}

/**
 * Should the item's status chip turn into the one-tap confirm question
 * ("out? / still have it")? Only for evidence-based estimates whose predicted
 * run-out has already passed while the item still shows stock — and at most once
 * per restock cycle (a prior "still have it"/out answer since the last restock
 * silences it until the next restock or the estimate moves on).
 */
export function needsRunoutConfirm(
  item: Pick<Item, "quantity">,
  estimate: Pick<UsageEstimate, "source" | "runoutDate">,
  logs: UsageLog[],
  now: Date = new Date(),
): boolean {
  if (item.quantity <= 0) return false; // already out — nothing to ask
  if (estimate.source !== "history" && estimate.source !== "manual")
    return false;
  if (!estimate.runoutDate || estimate.runoutDate.getTime() > now.getTime())
    return false;

  const restockTimes = logs
    .filter((l) => l.delta > 0 && l.loggedAt)
    .map((l) => l.loggedAt!.getTime());
  const lastRestockT = restockTimes.length ? Math.max(...restockTimes) : 0;
  const answeredThisCycle = logs.some(
    (l) =>
      l.delta === 0 &&
      l.note === "confirmed" &&
      l.loggedAt != null &&
      l.loggedAt.getTime() >= lastRestockT,
  );
  return !answeredThisCycle;
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

/**
 * Suggested restock quantity: enough to cover the next `RESTOCK_HORIZON_DAYS` at
 * the learned rate while staying above min-stock; falls back to refilling to ~2×
 * min (or a single unit) when there's no rate. One definition, shared by the
 * store view, dashboard, and the auto-queue on "we're out".
 */
export const RESTOCK_HORIZON_DAYS = 30;

export function suggestRestockQty(
  item: Pick<Item, "quantity" | "minQuantity">,
  estimate?: Pick<UsageEstimate, "dailyRate"> | null,
): number {
  const rate = estimate?.dailyRate ?? null;
  const minNeed =
    item.minQuantity != null ? item.minQuantity - item.quantity : 0;
  if (rate && rate > 0) {
    const horizonNeed = Math.ceil(rate * RESTOCK_HORIZON_DAYS) - item.quantity;
    return Math.max(horizonNeed, minNeed, 1);
  }
  const target = item.minQuantity != null ? item.minQuantity * 2 : 1;
  return Math.max(target - item.quantity, minNeed, 1);
}
