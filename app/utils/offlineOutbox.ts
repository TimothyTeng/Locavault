// IndexedDB plumbing for the offline outbox. Browser-only: every export no-ops
// (or resolves empty) during SSR and whenever IndexedDB is unavailable — a
// private-mode / blocked-storage browser degrades to "online only", never to a
// crash. Decision logic lives in `~/utils/helpers/outbox.helper`.

import type { OutboxEntry } from "~/utils/helpers/outbox.helper";

const DB_NAME = "locavault-outbox";
const DB_VERSION = 1;
const STORE = "mutations";

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase | null> {
  if (!hasIDB()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** Run `fn` inside a transaction, resolving `fallback` if anything goes wrong. */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  const db = await openDB();
  if (!db) return fallback;
  return new Promise<T>((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(fallback);
      tx.onabort = () => resolve(fallback);
    } catch {
      resolve(fallback);
    } finally {
      // The connection is cheap to reopen; don't hold it across the app's life.
      setTimeout(() => db.close(), 0);
    }
  });
}

/** Append a mutation to the queue. Resolves false if storage is unavailable. */
export async function enqueue(entry: OutboxEntry): Promise<boolean> {
  const res = await withStore<unknown>(
    "readwrite",
    (s) => s.add(entry),
    undefined,
  );
  return res !== undefined;
}

/** Every queued mutation, oldest first. */
export async function readAll(): Promise<OutboxEntry[]> {
  const rows = await withStore<OutboxEntry[]>(
    "readonly",
    (s) => s.getAll(),
    [],
  );
  return (rows ?? []).sort((a, b) => a.queuedAt - b.queuedAt);
}

/** Drop one entry (after a successful replay, or when collapsed away). */
export async function remove(id: string): Promise<void> {
  await withStore<unknown>("readwrite", (s) => s.delete(id), undefined);
}

/** Drop everything. */
export async function clear(): Promise<void> {
  await withStore<unknown>("readwrite", (s) => s.clear(), undefined);
}
