import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { useUser } from "@clerk/react-router";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  LayoutGrid,
  Pencil,
  Sparkles,
  Loader2,
} from "lucide-react";
import { inferTypeFromLabel } from "~/lib/itemTypes";
import { FOOD_CATEGORY_RE } from "~/utils/helpers/barcode.helper";
import { TypeIcon } from "~/components/store/typeIcon";
import type { TemplateWithBlocks } from "#types/templateTypes";
import type { BlockDetails } from "#types/storeViewFinderTypes";

// Food-first starter items — the flagship use case, one tap each.
const STARTER_ITEMS = [
  "Milk",
  "Eggs",
  "Bread",
  "Butter",
  "Rice",
  "Pasta",
  "Onions",
  "Bananas",
  "Chicken",
  "Coffee",
  "Cheese",
  "Tomatoes",
];

const isStandard = (b: BlockDetails) =>
  (b.kind === "standard" || b.kind === undefined) && b.label.trim().length > 0;

// Rank templates food-first so the flagship use case leads.
function foodScore(t: TemplateWithBlocks): number {
  const hay = `${t.name} ${t.tags}`.toLowerCase();
  return /food|kitchen|pantry|fridge|grocer|freezer/.test(hay) ? 0 : 1;
}

/**
 * First-run onboarding (DESIGN §10 / Phase 10). A signed-in user with zero stores
 * gets template → confirm zones → tap starter items, and lands on a mapped,
 * ~10-item home in well under three minutes — no drawing required. The hero draw
 * tools stay one tap away via "Build from scratch".
 */
export function FirstRunWizard({
  templates,
}: {
  templates: TemplateWithBlocks[];
}) {
  const { user } = useUser();
  const fetcher = useFetcher();
  const submitting = fetcher.state !== "idle";

  const ordered = useMemo(
    () => [...templates].sort((a, b) => foodScore(a) - foodScore(b)),
    [templates],
  );

  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("My Home");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, number>>({});

  const template = ordered.find((t) => t.id === templateId) ?? null;
  const zones = useMemo(
    () => (template ? template.blocks.filter(isStandard) : []),
    [template],
  );

  const chooseTemplate = (t: TemplateWithBlocks) => {
    setTemplateId(t.id);
    setStoreName(t.name);
    setLabels(
      Object.fromEntries(
        t.blocks.filter(isStandard).map((b) => [b.block_id, b.label]),
      ),
    );
    setStep(1);
  };

  // Assign an item to the best-fitting zone: a food item → a food-ish zone,
  // else the first zone. Keeps the ~10 items sensibly placed, not all in one heap.
  const zoneForItem = (name: string): string | null => {
    if (!zones.length) return null;
    const type = inferTypeFromLabel(name);
    if (type === "food") {
      const foodZone = zones.find((z) =>
        FOOD_CATEGORY_RE.test(labels[z.block_id] ?? z.label),
      );
      if (foodZone) return foodZone.block_id;
    }
    return zones[0].block_id;
  };

  const finish = () => {
    if (!template) return;
    const items = Object.entries(picked)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => ({
        name,
        quantity: qty,
        itemType: inferTypeFromLabel(name) ?? "other",
        templateBlockId: zoneForItem(name),
      }));
    fetcher.submit(
      {
        _action: "onboard",
        templateId: template.id,
        storeName,
        zones: zones.map((z) => ({
          templateBlockId: z.block_id,
          label: labels[z.block_id] ?? z.label,
        })),
        items,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const pickedCount = Object.values(picked).reduce(
    (n, q) => n + (q > 0 ? 1 : 0),
    0,
  );

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:py-16">
      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
          <Sparkles size={12} /> Welcome
          {user?.firstName ? `, ${user.firstName}` : ""}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Let's set up your first space
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Three quick steps — a layout, your zones, a few staples. Under three
          minutes, no drawing.
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {["Layout", "Zones", "Staples"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                i <= step
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-400"
              }`}
            >
              {i < step ? <Check size={12} /> : i + 1}
            </span>
            <span
              className={`text-[12px] font-semibold ${
                i <= step ? "text-slate-700" : "text-slate-300"
              }`}
            >
              {label}
            </span>
            {i < 2 && <span className="mx-1 h-px w-6 bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Step 1 — pick a template */}
        {step === 0 && (
          <>
            <h2 className="mb-3 text-[13px] font-bold text-slate-700">
              Pick a starting layout
            </h2>
            {ordered.length === 0 ? (
              <EmptyTemplates />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ordered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => chooseTemplate(t)}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    <LayoutGrid size={16} className="mt-0.5 text-emerald-500" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-800">
                        {t.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {t.blocks.filter(isStandard).length} zones · {t.cols}×
                        {t.rows}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-slate-100 pt-3 text-center">
              <a
                href="/addstore"
                className="text-[12px] font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
              >
                Or build from scratch with the floor-plan editor →
              </a>
            </div>
          </>
        )}

        {/* Step 2 — confirm/rename zones */}
        {step === 1 && template && (
          <>
            <h2 className="mb-1 text-[13px] font-bold text-slate-700">
              Name your zones
            </h2>
            <p className="mb-3 text-[11px] text-slate-400">
              These are the areas in <b>{template.name}</b>. Rename any that
              don't fit — or leave them.
            </p>
            <label className="mb-3 flex flex-col gap-1 text-[11px] font-mono text-slate-500">
              Store name
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-800 outline-none focus:border-emerald-400"
              />
            </label>
            <div className="flex flex-col gap-1.5">
              {zones.map((z) => (
                <div
                  key={z.block_id}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5"
                >
                  <Pencil size={12} className="shrink-0 text-slate-300" />
                  <input
                    value={labels[z.block_id] ?? z.label}
                    onChange={(e) =>
                      setLabels((p) => ({ ...p, [z.block_id]: e.target.value }))
                    }
                    className="flex-1 bg-transparent text-[13px] text-slate-700 outline-none"
                  />
                </div>
              ))}
              {zones.length === 0 && (
                <p className="text-[12px] text-slate-400">
                  This layout has no named zones — you can add them later.
                </p>
              )}
            </div>
          </>
        )}

        {/* Step 3 — tap starter staples */}
        {step === 2 && (
          <>
            <h2 className="mb-1 text-[13px] font-bold text-slate-700">
              Add a few staples
            </h2>
            <p className="mb-3 text-[11px] text-slate-400">
              Tap what you keep on hand — we'll shelve them for you. Skip any
              you don't want.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_ITEMS.map((name) => {
                const qty = picked[name] ?? 0;
                const active = qty > 0;
                return (
                  <button
                    key={name}
                    onClick={() =>
                      setPicked((p) => ({ ...p, [name]: (p[name] ?? 0) + 1 }))
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setPicked((p) => ({
                        ...p,
                        [name]: Math.max(0, (p[name] ?? 0) - 1),
                      }));
                    }}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      active
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <TypeIcon
                      type={inferTypeFromLabel(name) ?? "other"}
                      className="h-3 w-3 opacity-60"
                    />
                    {name}
                    {active && (
                      <span className="ml-0.5 rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
                        {qty}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              {pickedCount > 0
                ? `${pickedCount} staple${pickedCount !== 1 ? "s" : ""} — right-click a tile to remove.`
                : "Optional — you can also finish with an empty store."}
            </p>
          </>
        )}

        {/* Footer nav */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 text-[12px] font-medium text-slate-400 disabled:opacity-0"
          >
            <ArrowLeft size={13} /> Back
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !templateId}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={submitting || !template}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Building…
                </>
              ) : (
                <>
                  <Check size={14} /> Create my home
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyTemplates() {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
      <p className="text-[13px] font-semibold text-slate-500">
        No templates available yet
      </p>
      <a
        href="/addstore"
        className="mt-1 inline-block text-[12px] font-medium text-emerald-600 hover:underline"
      >
        Build your first store from scratch →
      </a>
    </div>
  );
}
