import { describe, it, expect } from "vitest";
import {
  dedupeOutbox,
  describeOutbox,
  isQueueable,
  type OutboxEntry,
} from "./outbox.helper";

const entry = (
  id: string,
  body: Record<string, unknown>,
  queuedAt = 0,
): OutboxEntry => ({ id, url: "/store/s1", body, queuedAt, label: "x" });

describe("isQueueable", () => {
  it("allows only the two in-scope actions", () => {
    expect(isQueueable({ _action: "markItemOut" })).toBe(true);
    expect(isQueueable({ _action: "createItems" })).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isQueueable({ _action: "updateItem" })).toBe(false);
    expect(isQueueable({ _action: "deleteItem" })).toBe(false);
    expect(isQueueable({})).toBe(false);
  });
});

describe("dedupeOutbox", () => {
  it("keeps only the last mark-out per item", () => {
    const out = dedupeOutbox([
      entry("a", { _action: "markItemOut", id: "milk", wasted: false }, 1),
      entry("b", { _action: "markItemOut", id: "eggs" }, 2),
      entry("c", { _action: "markItemOut", id: "milk", wasted: true }, 3),
    ]);
    expect(out.map((e) => e.id)).toEqual(["b", "c"]);
    // The surviving milk entry is the newest intent (tossed, not used up).
    expect(out.find((e) => e.body.id === "milk")?.body.wasted).toBe(true);
  });

  it("never collapses quick-adds — each batch is additive", () => {
    const out = dedupeOutbox([
      entry("a", { _action: "createItems", items: [{ name: "rice" }] }),
      entry("b", { _action: "createItems", items: [{ name: "beans" }] }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("preserves chronological order of survivors", () => {
    const out = dedupeOutbox([
      entry("a", { _action: "markItemOut", id: "milk" }),
      entry("b", { _action: "createItems", items: [] }),
      entry("c", { _action: "markItemOut", id: "milk" }),
      entry("d", { _action: "createItems", items: [] }),
    ]);
    expect(out.map((e) => e.id)).toEqual(["b", "c", "d"]);
  });

  it("leaves a malformed mark-out (no item id) alone rather than collapsing", () => {
    const out = dedupeOutbox([
      entry("a", { _action: "markItemOut" }),
      entry("b", { _action: "markItemOut" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("handles an empty queue", () => {
    expect(dedupeOutbox([])).toEqual([]);
  });
});

describe("describeOutbox", () => {
  it("returns null when empty and pluralises otherwise", () => {
    expect(describeOutbox([])).toBeNull();
    expect(describeOutbox([entry("a", {})])).toBe("1 change waiting to sync");
    expect(describeOutbox([entry("a", {}), entry("b", {})])).toBe(
      "2 changes waiting to sync",
    );
  });
});
