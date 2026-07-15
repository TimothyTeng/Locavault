// Money is stored in cents everywhere (items.cost, purchaseOrderItems.cost). These
// helpers keep the cents→display and roll-up math in one tested place.

/**
 * Parse a price token into cents. Handles "$12.34", "12.34", "12,34" (comma
 * decimal), "1,234.56" (thousands), and a bare "12" (→ 1200). Returns null if
 * there's no parseable number. Sign is preserved so callers can reject refunds.
 */
export function parseMoneyToCents(raw: string): number | null {
  if (typeof raw !== "string") return null;
  const neg = /-/.test(raw);
  // Keep digits and separators only.
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  // The right-most separator is the decimal point; the other is a thousands sep.
  const decPos = Math.max(lastDot, lastComma);
  let cents: number;
  if (decPos === -1) {
    // No separator at all → whole units.
    const n = parseInt(s, 10);
    if (!Number.isFinite(n)) return null;
    cents = n * 100;
  } else {
    const decimals = s.slice(decPos + 1).replace(/\D/g, "");
    const whole = s.slice(0, decPos).replace(/\D/g, "");
    if (!whole && !decimals) return null;
    const frac = (decimals + "00").slice(0, 2);
    cents = parseInt(whole || "0", 10) * 100 + parseInt(frac, 10);
  }
  if (!Number.isFinite(cents)) return null;
  return neg ? -cents : cents;
}

/** Format a cents amount as "$12.34"; null/undefined → "—". */
export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const neg = cents < 0;
  const s = `$${(Math.abs(cents) / 100).toFixed(2)}`;
  return neg ? `-${s}` : s;
}

/**
 * Basket total (cents) for a set of rows priced per unit: Σ cost × quantity.
 * Rows without a cost contribute nothing. Returns `{ cents, priced, unpriced }`
 * so the UI can note "3 items have no price yet" rather than silently undercount.
 */
export function basketTotal(
  rows: { cost: number | null; quantity: number }[],
): { cents: number; priced: number; unpriced: number } {
  let cents = 0;
  let priced = 0;
  let unpriced = 0;
  for (const r of rows) {
    if (r.cost != null) {
      cents += r.cost * Math.max(0, r.quantity);
      priced += 1;
    } else {
      unpriced += 1;
    }
  }
  return { cents, priced, unpriced };
}

/**
 * Approximate spend over a period from restock logs: for each positive (restock)
 * delta, value it at the item's unit cost. Consumption (negative) and zero-delta
 * confirmations are ignored. Deliberately rough — a passive "~spent this month"
 * signal, not accounting.
 */
export function spentCents(
  logs: { itemId: string; delta: number }[],
  costByItem: Map<string, number | null>,
): number {
  let cents = 0;
  for (const l of logs) {
    if (l.delta <= 0) continue;
    const cost = costByItem.get(l.itemId);
    if (cost != null) cents += cost * l.delta;
  }
  return cents;
}
