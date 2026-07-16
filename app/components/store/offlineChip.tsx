import { CloudOff, RefreshCw } from "lucide-react";
import {
  describeOutbox,
  type OutboxEntry,
} from "~/utils/helpers/outbox.helper";

/**
 * Connectivity + outbox status. Silent when online with an empty queue — it only
 * appears when there's something the user should know: you're offline (and taps
 * are still being captured), or work is queued/syncing.
 */
export function OfflineChip({
  online,
  syncing,
  pending,
}: {
  online: boolean;
  syncing: boolean;
  pending: OutboxEntry[];
}) {
  const queued = describeOutbox(pending);
  if (online && !queued && !syncing) return null;

  const tone = !online
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div
      role="status"
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono ${tone}`}
      title={
        !online
          ? "You're offline — “we're out” taps and quick-adds are saved and sync when you're back"
          : "Syncing what you captured offline"
      }
    >
      {syncing ? (
        <RefreshCw size={11} className="animate-spin" />
      ) : (
        <CloudOff size={11} />
      )}
      <span>
        {syncing ? "Syncing…" : !online ? "Offline" : null}
        {!syncing && queued
          ? !online
            ? ` · ${pending.length} saved`
            : queued
          : null}
      </span>
    </div>
  );
}
