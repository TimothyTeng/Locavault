// Tiny in-memory rate limiter + TTL cache for resource routes. In-memory means
// per-process (fine for a single server instance; a shared store like Redis
// would be needed to scale horizontally). `now` is injectable for testing.

export type RateLimiter = {
  /** Record a hit for `key`; returns true if allowed, false if over the limit. */
  take(key: string, now?: number): boolean;
};

/** Fixed-window limiter: at most `max` hits per `windowMs` per key. */
export function createRateLimiter({
  max,
  windowMs,
}: {
  max: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, { count: number; reset: number }>();
  return {
    take(key, now = Date.now()) {
      const cur = hits.get(key);
      if (!cur || now >= cur.reset) {
        hits.set(key, { count: 1, reset: now + windowMs });
        return true;
      }
      if (cur.count >= max) return false;
      cur.count += 1;
      return true;
    },
  };
}

export type TtlCache<V> = {
  get(key: string, now?: number): V | undefined;
  set(key: string, value: V, now?: number): void;
};

/** Bounded TTL cache; evicts the oldest entry when `max` is exceeded. */
export function createTtlCache<V>({
  ttlMs,
  max,
}: {
  ttlMs: number;
  max: number;
}): TtlCache<V> {
  const store = new Map<string, { value: V; expires: number }>();
  return {
    get(key, now = Date.now()) {
      const e = store.get(key);
      if (!e) return undefined;
      if (now >= e.expires) {
        store.delete(key);
        return undefined;
      }
      return e.value;
    },
    set(key, value, now = Date.now()) {
      if (!store.has(key) && store.size >= max) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expires: now + ttlMs });
    },
  };
}
