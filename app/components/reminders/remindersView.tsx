import { useFetcher, useNavigate } from "react-router";
import type {
  RemindersData,
  DoseScheduleView,
  ReminderItem,
} from "~/types/doseTypes";
import {
  describeSchedule,
  nextSlotHour,
  formatHour,
} from "~/utils/helpers/dose.helper";

/**
 * The /reminders surface (DESIGN.md §4/§6): dose schedules due today (one-tap
 * Take / Snooze — blue "action" pills), medications running low, and expiring
 * medications, aggregated across every store. Gentle: quiet when nothing's due.
 */
export function RemindersView({ data }: { data: RemindersData }) {
  const { doses, refill, expiring } = data;
  const empty =
    doses.length === 0 && refill.length === 0 && expiring.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
        Reminders
      </h1>
      <p className="text-sm text-slate-400 mb-8">
        Doses, refills, and expiry across all your stores.
      </p>

      {empty ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-medium text-emerald-700">
            Nothing to take or refill right now.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {doses.length > 0 && (
            <Section title="Doses">
              {doses.map((d) => (
                <DoseCard key={d.id} dose={d} />
              ))}
            </Section>
          )}
          {refill.length > 0 && (
            <Section title="Refill soon">
              {refill.map((r) => (
                <MedRow key={r.id} item={r} kind="refill" />
              ))}
            </Section>
          )}
          {expiring.length > 0 && (
            <Section title="Expiring">
              {expiring.map((r) => (
                <MedRow key={r.id} item={r} kind="expiring" />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function DoseCard({ dose }: { dose: DoseScheduleView }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const due = dose.dueCount > 0;
  const next = nextSlotHour(dose.timesPerDay, new Date());
  const outOfStock = dose.quantity <= 0;

  const post = (body: Record<string, string | number>) =>
    fetcher.submit(body, {
      method: "POST",
      action: "/api/doses",
      encType: "application/json",
    });

  return (
    <div
      className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
        due ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">
          {dose.itemName}
        </div>
        <div className="text-[11px] text-slate-400">
          {dose.storeName} · {describeSchedule(dose)} · {dose.takenToday}/
          {dose.timesPerDay} taken
          {!due && next != null && (
            <span className="text-slate-500"> · next {formatHour(next)}</span>
          )}
          {outOfStock && <span className="text-red-500"> · out of stock</span>}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        <button
          onClick={() => post({ _action: "takeDose", scheduleId: dose.id })}
          disabled={busy || !due || outOfStock}
          className={`rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            due && !outOfStock
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-slate-100 text-slate-400 cursor-default"
          }`}
        >
          Take
        </button>
        <button
          onClick={() =>
            post({ _action: "snooze", itemId: dose.itemId, hours: 24 })
          }
          disabled={busy}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
        >
          Snooze
        </button>
      </div>
    </div>
  );
}

function MedRow({
  item,
  kind,
}: {
  item: ReminderItem;
  kind: "refill" | "expiring";
}) {
  const navigate = useNavigate();
  const hint =
    kind === "expiring"
      ? item.expiryDays != null
        ? item.expiryDays <= 0
          ? "expired"
          : `expires in ${item.expiryDays}d`
        : "expiring"
      : item.quantity <= 0
        ? "out of stock"
        : item.runoutDays != null
          ? `~${item.runoutDays}d left`
          : "running low";

  return (
    <button
      onClick={() => navigate(`/store/${item.storeId}`)}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 transition-colors"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800 truncate">
          {item.name}
        </div>
        <div className="text-[11px] text-slate-400">
          {item.storeName} · {item.quantity}
          {item.unit ? ` ${item.unit}` : ""} left
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
          kind === "expiring"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-red-200 bg-red-50 text-red-600"
        }`}
      >
        {hint}
      </span>
    </button>
  );
}
