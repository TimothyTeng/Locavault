import { parseMoneyToCents } from "./money.helper";

/**
 * Turn pasted receipt text into inventory-ready rows. Each row is a purchase:
 * a `name`, a whole `quantity`, and the **per-unit** `costCents` (or null when
 * the line had no parseable price). Cost is per-unit to match `items.cost`
 * semantics, so a later restock values the spend chip correctly.
 *
 * The parser is deliberately conservative — it favours dropping an ambiguous
 * line over inventing a bogus item. It runs fully in-memory (no infra) so it's
 * exhaustively unit-testable with real-ish fixtures.
 */
export type ReceiptRow = {
  name: string;
  quantity: number;
  costCents: number | null;
};

// Lines that are receipt scaffolding, never products.
const STOP_WORDS =
  /\b(sub\s*total|total|tax|vat|gst|hst|qst|pst|balance|tender(ed)?|change|cash|debit|credit|card|visa|mastercard|amex|discover|paypal|savings?|discounts?|coupons?|loyalty|points?|rewards?|member|cashier|register|lane|auth|approval|approved|reference|terminal|invoice|receipt|thank|thanks|welcome|store|phone|tel|fax|survey|returns?|policy|net|gross|items?\s+sold|you\s+saved)\b/i;

// A price at the very end of a line: "3.49", "$1,234.56", "12,34 F" (tax code).
const PRICE_AT_END = /([-$£€]?\s*\d[\d,]*[.,]\d{2})\s*[A-Za-z*]{0,3}$/;

// A line that is *only* a price (two-line layout: name above, price below).
const PRICE_ONLY = /^[-$£€\s]*\d[\d,]*[.,]\d{2}\s*$/;

// A leading quantity: "2 Milk", "2x Milk" (but not a price like "2.50 Milk").
const LEADING_QTY = /^(\d{1,3})\s*[xX]?\s+(?=\D)/;

// "N @ unitprice" — qty and the explicit per-unit price in one shot.
const QTY_AT_PRICE = /(\d+)\s*@\s*([$£€]?\d[\d.,]*\d)/;

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Strip SKU/UPC runs, bullet cruft, and stray punctuation; de-SHOUT all-caps. */
function cleanName(s: string): string {
  let n = s
    .replace(/[*#]+/g, " ")
    .replace(/\b\d{5,}\b/g, " ") // SKUs / UPCs / barcodes
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "")
    .trim();
  if (n && n === n.toUpperCase()) n = titleCase(n);
  return n;
}

/** Guard the no-price branch: does this read like a product, not an address/header? */
function looksLikeItem(s: string): boolean {
  const letters = (s.match(/[a-z]/gi) ?? []).length;
  const digits = (s.match(/\d/g) ?? []).length;
  if (letters < 2) return false;
  if (s.length > 32) return false;
  if (digits > letters) return false;
  if (/[:@]|https?:|www\./i.test(s)) return false;
  return true;
}

const MAX_ROWS = 200;

export function parseReceipt(text: string): ReceiptRow[] {
  const rows: ReceiptRow[] = [];
  if (typeof text !== "string") return rows;

  // A name-line with no price yet — committed only if the *next* line is a lone
  // price. Anything else discards it, so store-name/address headers don't leak.
  let pending: ReceiptRow | null = null;

  for (const raw of text.split(/\r?\n/)) {
    if (rows.length >= MAX_ROWS) break;
    const line = raw.trim();
    if (!line) continue; // blank lines don't break a name→price pair

    // A lone price completes the pending name above it.
    if (PRICE_ONLY.test(line)) {
      const cents = parseMoneyToCents(line);
      if (pending && cents != null && cents > 0) {
        pending.costCents =
          pending.quantity > 1 ? Math.round(cents / pending.quantity) : cents;
        rows.push(pending);
      }
      pending = null;
      continue;
    }

    // Scaffolding line — also cancels any dangling header we were holding.
    if (STOP_WORDS.test(line)) {
      pending = null;
      continue;
    }

    let working = line;
    let quantity = 1;
    let unitCents: number | null = null;
    let hasPrice = false;

    const at = working.match(QTY_AT_PRICE);
    if (at) {
      // "2 @ 1.50" → qty 2 at $1.50 each; drop any trailing line-total too.
      quantity = Math.max(1, parseInt(at[1], 10));
      unitCents = parseMoneyToCents(at[2]);
      working = working.replace(at[0], " ").replace(PRICE_AT_END, " ");
      hasPrice = true;
    } else {
      const pm = working.match(PRICE_AT_END);
      if (pm) {
        const total = parseMoneyToCents(pm[1]);
        if (total != null && total < 0) {
          pending = null;
          continue; // refund / discount
        }
        working = working.slice(0, pm.index).trim();
        const lead = working.match(LEADING_QTY);
        if (lead) {
          quantity = Math.max(1, parseInt(lead[1], 10));
          working = working.slice(lead[0].length).trim();
        }
        unitCents =
          total == null
            ? null
            : quantity > 1
              ? Math.round(total / quantity)
              : total;
        hasPrice = true;
      } else {
        // No price on this line. Hold it as a pending name (awaiting a price-only
        // line) iff it reads like a product; otherwise drop it as noise.
        pending = null;
        if (!looksLikeItem(working)) continue;
        const lead = working.match(LEADING_QTY);
        if (lead) {
          quantity = Math.max(1, parseInt(lead[1], 10));
          working = working.slice(lead[0].length).trim();
        }
        const pendingName = cleanName(working);
        if (pendingName && /[a-z]/i.test(pendingName)) {
          pending = { name: pendingName, quantity, costCents: null };
        }
        continue;
      }
    }

    const name = cleanName(working);
    if (name && /[a-z]/i.test(name)) {
      // Inline "name … price" — a fully-priced line supersedes any dangling header.
      pending = null;
      rows.push({ name, quantity, costCents: hasPrice ? unitCents : null });
    } else if (pending && hasPrice) {
      // A bare "3 @ 1.50 4.50" / price line whose product name sat on the line
      // above — attach the price (and any explicit qty) to that pending name.
      if (quantity > 1) pending.quantity = quantity;
      pending.costCents = unitCents;
      rows.push(pending);
      pending = null;
    }
  }

  return rows;
}

/** Total of a parsed receipt in cents (per-unit cost × quantity), priced rows only. */
export function receiptTotalCents(rows: ReceiptRow[]): number {
  return rows.reduce(
    (sum, r) => sum + (r.costCents != null ? r.costCents * r.quantity : 0),
    0,
  );
}
