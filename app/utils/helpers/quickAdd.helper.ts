/**
 * Parse a free-typed/pasted list into item entries. One item per line; quantity
 * is inferred from common shorthands so capture stays fast:
 *   "Milk"          → { Milk, 1 }
 *   "Milk x2"       → { Milk, 2 }      (also ×, *)
 *   "Eggs 12"       → { Eggs, 12 }
 *   "Eggs, 12"      → { Eggs, 12 }
 *   "2 Milk" / "2x Milk" → { Milk, 2 }
 */
export type QuickAddEntry = { name: string; quantity: number };

export function parseQuickAdd(text: string): QuickAddEntry[] {
  const out: QuickAddEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    let qty = 1;

    let m = line.match(/[\s,]*[x×*]\s*(\d+)\s*$/i);
    if (m) {
      qty = parseInt(m[1], 10);
      line = line.slice(0, m.index).trim();
    } else if ((m = line.match(/[\s,]+(\d+)\s*$/))) {
      qty = parseInt(m[1], 10);
      line = line.slice(0, m.index).trim();
    } else if ((m = line.match(/^(\d+)\s*[x×*]?\s+(.+)$/i))) {
      qty = parseInt(m[1], 10);
      line = m[2].trim();
    }

    line = line.replace(/[,;]+$/, "").trim();
    if (!line) continue;
    out.push({ name: line, quantity: Math.max(1, qty || 1) });
  }
  return out;
}
