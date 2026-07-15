import type { Item, RunoutBucket } from "~/types/storeTypes";
import {
  describeRunout,
  describeRunoutRange,
} from "~/utils/helpers/usage.helper";

/** Tone per run-out bucket, kept muted per the gentle "no red wall" alert tone. */
const BUCKET_TONE: Record<RunoutBucket, string> = {
  out: "text-slate-400",
  days: "text-red-500",
  this_week: "text-red-500",
  next_week: "text-amber-600",
  later: "text-slate-400",
  learning: "text-slate-300",
};

/**
 * The human run-out phrase ("Likely this week") as the visible chip; the precise
 * p25–p75 range lives in the tooltip. Renders nothing without a usable estimate.
 */
export function RunoutPhrase({
  item,
  className = "",
}: {
  item: Item;
  className?: string;
}) {
  const u = item.usage;
  if (!u || u.runoutDays == null) return null;
  return (
    <span
      className={`${BUCKET_TONE[u.bucket]} ${className}`}
      title={describeRunoutRange(u)}
    >
      {describeRunout(u)}
    </span>
  );
}

/**
 * The confirm loop (DESIGN §2): once a predicted run-out passes but stock still
 * shows, the status turns into a one-tap question. "Yes, out" logs the depletion
 * (and queues a restock); "Still have it" logs a censor point that lengthens the
 * next estimate. Either way the passive prediction becomes a calibration signal.
 */
export function RunoutConfirm({
  item,
  onMarkOut,
  onStillHave,
  className = "",
}: {
  item: Item;
  onMarkOut: (item: Item) => void;
  onStillHave: (item: Item) => void;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
        Out?
      </span>
      <button
        onClick={() => onMarkOut(item)}
        className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700 hover:bg-amber-100 transition-colors"
      >
        Yes, out
      </button>
      <button
        onClick={() => onStillHave(item)}
        className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
      >
        Still have it
      </button>
    </span>
  );
}
