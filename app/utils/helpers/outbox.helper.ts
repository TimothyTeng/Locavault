// Offline outbox — the pure core. The IndexedDB plumbing lives in
// `~/utils/offlineOutbox` and the React glue in `~/utils/useOutbox`; everything
// decidable without a browser is here so it can be tested directly.
//
// Scope is deliberately narrow (DESIGN/plan Phase 14): only two mutations queue
// offline — the "we're out" tap and shopping quick-adds. Both are append-only,
// single-writer intents where a late replay is still the right answer. Generic
// offline mutation is explicitly out of scope: the optimistic layer has no
// multi-writer conflict resolution.

/** A queued mutation: the JSON action call to replay once we're back online. */
export type OutboxEntry = {
  id: string;
  /** Route to POST to (the store route owns these actions). */
  url: string;
  /** The `_action`-discriminated JSON body, exactly as the online path sends. */
  body: Record<string, unknown>;
  queuedAt: number;
  /** Short human label for the "waiting to sync" chip. */
  label: string;
};

/** The only actions allowed to queue offline. Anything else must fail loudly. */
export const QUEUEABLE_ACTIONS = ["markItemOut", "createItems"] as const;
export type QueueableAction = (typeof QUEUEABLE_ACTIONS)[number];

export function isQueueable(body: { _action?: unknown }): boolean {
  return QUEUEABLE_ACTIONS.includes(body._action as QueueableAction);
}

/**
 * Collapse redundant queued work, keeping the LAST intent per target.
 *
 * Repeated "we're out" taps on the same item are idempotent in intent — replaying
 * three of them would log three separate -delta rows and corrupt the usage
 * estimate, so only the newest survives. Quick-adds are additive (each is a
 * distinct batch of new items) and are never collapsed.
 *
 * Order is preserved by each surviving entry's original position, so replay stays
 * chronological.
 */
export function dedupeOutbox(entries: OutboxEntry[]): OutboxEntry[] {
  // Last-wins index for collapsible entries, keyed by action+target.
  const lastIndex = new Map<string, number>();
  entries.forEach((e, i) => {
    const key = collapseKey(e);
    if (key) lastIndex.set(key, i);
  });

  return entries.filter((e, i) => {
    const key = collapseKey(e);
    return key == null || lastIndex.get(key) === i;
  });
}

/** The identity a queued entry collapses on, or null if it never collapses. */
function collapseKey(e: OutboxEntry): string | null {
  if (e.body._action !== "markItemOut") return null;
  const id = e.body.id;
  return typeof id === "string" ? `markItemOut:${id}` : null;
}

/** The "N changes waiting to sync" chip text, or null when the queue is empty. */
export function describeOutbox(entries: OutboxEntry[]): string | null {
  const n = entries.length;
  if (n === 0) return null;
  return `${n} change${n === 1 ? "" : "s"} waiting to sync`;
}
