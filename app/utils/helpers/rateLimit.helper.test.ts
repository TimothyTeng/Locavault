import { describe, it, expect } from "vitest";
import { createRateLimiter, createTtlCache } from "./rateLimit.helper";

describe("createRateLimiter", () => {
  it("allows up to max hits within the window, then blocks", () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(rl.take("a", 0)).toBe(true);
    expect(rl.take("a", 100)).toBe(true);
    expect(rl.take("a", 200)).toBe(true);
    expect(rl.take("a", 300)).toBe(false); // 4th in window
  });

  it("resets after the window elapses", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(rl.take("a", 0)).toBe(true);
    expect(rl.take("a", 500)).toBe(false);
    expect(rl.take("a", 1000)).toBe(true); // window rolled over
  });

  it("tracks keys independently", () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(rl.take("a", 0)).toBe(true);
    expect(rl.take("b", 0)).toBe(true);
    expect(rl.take("a", 0)).toBe(false);
  });
});

describe("createTtlCache", () => {
  it("returns a value within its TTL and expires it after", () => {
    const c = createTtlCache<number>({ ttlMs: 1000, max: 10 });
    c.set("k", 42, 0);
    expect(c.get("k", 500)).toBe(42);
    expect(c.get("k", 1000)).toBeUndefined();
  });

  it("evicts the oldest entry past max", () => {
    const c = createTtlCache<number>({ ttlMs: 10_000, max: 2 });
    c.set("a", 1, 0);
    c.set("b", 2, 0);
    c.set("c", 3, 0); // evicts "a"
    expect(c.get("a", 0)).toBeUndefined();
    expect(c.get("b", 0)).toBe(2);
    expect(c.get("c", 0)).toBe(3);
  });
});
