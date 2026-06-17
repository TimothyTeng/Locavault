import { useNavigate } from "react-router";
import { Plus, Check } from "lucide-react";
import type { AttentionItem } from "#types/dashboardTypes";
import type { ItemStatus } from "#types/storeTypes";
import { TypeIcon } from "#components/store/typeIcon";

const PILL: Record<ItemStatus, string> = {
  out: "bg-slate-100 text-slate-500 border-slate-200",
  low: "bg-red-50 text-red-600 border-red-200",
  expiring: "bg-amber-50 text-amber-700 border-amber-200",
  ok: "bg-emerald-50 text-emerald-600 border-emerald-200",
};
const LABEL: Record<ItemStatus, string> = {
  out: "Out",
  low: "Low",
  expiring: "Expiring",
  ok: "OK",
};

function hint(it: AttentionItem): string | null {
  if (it.status === "expiring" && it.expiryDays != null) {
    return it.expiryDays <= 0 ? "expired" : `expires in ${it.expiryDays}d`;
  }
  if (it.runoutDays != null) return `~${it.runoutDays}d left`;
  if (it.status === "out") return "out of stock";
  return null;
}

/**
 * Cross-store "needs attention" digest — surfaces the run-out / expiry / low
 * predictions from every store in one place, with one-tap add-to-list. The
 * headline of the app's promise: know what you're running out of before you do.
 */
export function AttentionDigest({
  items,
  onAdd,
}: {
  items: AttentionItem[];
  onAdd: (item: AttentionItem) => void;
}) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="lv-dash-attn mb-8 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-sm font-medium text-emerald-700">
          You're stocked up — nothing needs attention.
        </span>
      </div>
    );
  }

  const out = items.filter((i) => i.status === "out").length;
  const low = items.filter((i) => i.status === "low").length;
  const exp = items.filter((i) => i.status === "expiring").length;

  return (
    <div className="lv-dash-attn mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-sm font-bold text-slate-800">
            Needs attention
          </span>
          <span className="text-xs text-slate-400">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          {out > 0 && <span className="text-slate-500">{out} out</span>}
          {low > 0 && <span className="text-red-500">{low} low</span>}
          {exp > 0 && <span className="text-amber-600">{exp} expiring</span>}
        </div>
      </div>

      <ul className="max-h-96 divide-y divide-slate-50 overflow-auto">
        {items.map((it) => {
          const h = hint(it);
          return (
            <li
              key={`${it.storeId}-${it.id}`}
              onClick={() => navigate(`/store/${it.storeId}`)}
              className="flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors hover:bg-slate-50"
            >
              <TypeIcon
                type={it.itemType}
                className="h-4 w-4 shrink-0 text-slate-400"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-800">
                  {it.name}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {it.storeName}
                  {it.zoneLabel ? ` · ${it.zoneLabel}` : ""}
                </div>
              </div>

              {h && (
                <span className="hidden shrink-0 font-mono text-[11px] text-slate-400 sm:inline">
                  {h}
                </span>
              )}
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${PILL[it.status]}`}
              >
                {LABEL[it.status]}
              </span>

              {it.canAdd &&
                (it.onList ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    <Check size={11} strokeWidth={2.6} />
                    Listed
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(it);
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-600"
                  >
                    <Plus size={11} strokeWidth={2.6} />
                    List
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
