// Money is stored in cents everywhere (items.cost, purchaseOrderItems.cost). These
// helpers keep the cents→display and roll-up math in one tested place.

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
