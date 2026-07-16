import { useCallback, useEffect, useRef, useState } from "react";
import {
  dedupeOutbox,
  isQueueable,
  type OutboxEntry,
} from "~/utils/helpers/outbox.helper";
import { enqueue, readAll, remove } from "~/utils/offlineOutbox";

/**
 * The offline outbox (plan Phase 14). Queues the two in-scope mutations — the
 * "we're out" tap and shopping quick-adds — while offline, and replays them
 * through the normal JSON actions once the connection is back.
 *
 * The caller still applies its optimistic update, so the UI is identical online
 * and off; this only decides where the write goes. On reconnect the queue is
 * de-duped (repeat "out" taps collapse to the newest) and replayed oldest-first,
 * then the caller revalidates to reconcile against the server's real state.
 */
export function useOutbox(onSynced?: () => void) {
  const [pending, setPending] = useState<OutboxEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  // `online` starts true so SSR and the first paint agree (navigator is absent
  // on the server); the effect below corrects it immediately on mount.
  const [online, setOnline] = useState(true);
  const syncingRef = useRef(false);
  const syncedCb = useRef(onSynced);
  syncedCb.current = onSynced;

  const refresh = useCallback(async () => {
    setPending(await readAll());
  }, []);

  /** Replay the queue oldest-first. Stops at the first failure so ordering and
   *  the retry-on-next-reconnect story stay simple. */
  const flush = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const queued = await readAll();
      const live = dedupeOutbox(queued);
      const liveIds = new Set(live.map((e) => e.id));
      // Collapsed-away entries are dropped without ever hitting the network.
      for (const e of queued) if (!liveIds.has(e.id)) await remove(e.id);

      let synced = 0;
      for (const e of live) {
        try {
          const res = await fetch(e.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(e.body),
          });
          if (!res.ok) {
            // 4xx means the server rejected this intent (stale item, lost
            // access…) — retrying forever would wedge the queue, so drop it.
            // 5xx/network stay queued for the next reconnect.
            if (res.status >= 400 && res.status < 500) await remove(e.id);
            break;
          }
          await remove(e.id);
          synced += 1;
        } catch {
          break; // still offline — leave the rest queued
        }
      }
      await refresh();
      if (synced > 0) syncedCb.current?.();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refresh]);

  // Track connectivity + drain whenever we come back.
  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();
    if (navigator.onLine) void flush();

    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flush, refresh]);

  /**
   * Queue a mutation for later. Returns false when it wasn't queued (out of
   * scope, or storage unavailable) so the caller can fall back to a live submit.
   */
  const queue = useCallback(
    async (url: string, body: Record<string, unknown>, label: string) => {
      if (!isQueueable(body)) return false;
      const ok = await enqueue({
        id: crypto.randomUUID(),
        url,
        body,
        queuedAt: Date.now(),
        label,
      });
      if (ok) await refresh();
      return ok;
    },
    [refresh],
  );

  return { pending, queue, flush, online, syncing };
}
