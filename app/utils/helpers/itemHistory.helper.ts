// Formatting for the item history timeline (ItemDetailPopup). Pure so it's tested
// without a DB; the note strings mirror what the store action writes to itemLogs.

/** A single timeline entry as sent to the client. */
export type ItemHistoryEntry = {
  delta: number;
  note: string | null;
  loggedAt: string | null; // ISO — serialised over the wire
  by: string | null; // resolved display name, null if unknown
};

const NOTE_LABEL: Record<string, string> = {
  out: "Marked out",
  edit: "Adjusted",
  cooked: "Cooked with",
  dose: "Dose taken",
  confirmed: "Confirmed still have",
  restock: "Restocked",
  buy: "Bought",
};

/** Human label for a log's note + delta, e.g. "Restocked" / "Adjusted". */
export function describeLogNote(note: string | null, delta: number): string {
  if (note && NOTE_LABEL[note]) return NOTE_LABEL[note];
  if (delta > 0) return "Restocked";
  if (delta < 0) return "Used";
  return "Updated";
}

/** Signed delta for display ("+3", "−2"); a zero-delta confirmation shows no number. */
export function describeDelta(delta: number): string {
  if (delta === 0) return "";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/** Compact relative day: "today" / "yesterday" / "3d ago" / "2w ago" / "Mar 4". */
export function relativeDay(date: Date | null, now: Date = new Date()): string {
  if (!date) return "";
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
