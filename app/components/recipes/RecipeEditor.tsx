import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import {
  X,
  Plus,
  Trash2,
  Link2,
  Loader2,
  ImageOff,
  Search,
} from "lucide-react";
import type { Recipe } from "~/lib/recipes";
import type { RecipeSearchResult } from "~/utils/helpers/mealdb.helper";
import { UNIT_OPTIONS } from "~/utils/helpers/units";

/**
 * Create / edit a saved recipe (DESIGN.md §7). Self-contained: owns its own
 * fetchers for online search (→ /api/recipe-search, TheMealDB), URL import
 * (→ /api/recipe-import), and save/delete (→ /api/recipes) — picking a search
 * result or importing a URL pre-fills the form. Submitting to those resource
 * routes revalidates the store loader, so the new recipe flows back through
 * `userRecipes` — no optimistic bookkeeping. Closes on a successful save/delete.
 */

/** Loose shape that both search results and URL imports satisfy. */
type ImportedLike = {
  name?: string;
  blurb?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  minutes?: number | null;
  serves?: number | null;
  tags?: string[];
  ingredients?: { name: string; amount?: number; unit?: string }[];
  steps?: { text: string; imageUrl?: string }[];
};

type IngRow = { _id: number; name: string; amount: string; unit: string };
type StepRow = { _id: number; text: string; imageUrl: string };

let _seq = 0;
const nextId = () => _seq++;

const num = (n?: number) => (n == null ? "" : String(n));

export function RecipeEditor({
  initial,
  onClose,
}: {
  initial?: Recipe | null;
  onClose: () => void;
}) {
  const save = useFetcher<{ recipe?: Recipe; ok?: boolean; error?: string }>();
  const vis = useFetcher();
  const imp = useFetcher<{ recipe?: Partial<Recipe>; error?: string }>();
  const search = useFetcher<{
    results?: RecipeSearchResult[];
    error?: string;
  }>();
  const busy = save.state !== "idle";
  const importing = imp.state !== "idle";
  const searching = search.state !== "idle";

  const [name, setName] = useState(initial?.name ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [minutes, setMinutes] = useState(num(initial?.minutes));
  const [serves, setServes] = useState(num(initial?.serves));
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [searchQuery, setSearchQuery] = useState("");
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [imgBroken, setImgBroken] = useState(false);
  const [isPublic, setIsPublic] = useState(!!initial?.isPublic);

  const toggleVisibility = () => {
    if (!initial) return;
    const next = !isPublic;
    setIsPublic(next);
    vis.submit(
      { _action: "setVisibility", id: initial.id, isPublic: next },
      { method: "post", action: "/api/recipes", encType: "application/json" },
    );
  };

  const idRef = useRef(0);
  idRef.current = _seq; // keep the shared seq monotonic across instances
  const [ingredients, setIngredients] = useState<IngRow[]>(() =>
    (initial?.ingredients ?? [{ name: "" }]).map((i) => ({
      _id: nextId(),
      name: i.name,
      amount: num(i.amount),
      unit: i.unit ?? "",
    })),
  );
  const [steps, setSteps] = useState<StepRow[]>(() =>
    (initial?.steps ?? []).map((s) => ({
      _id: nextId(),
      text: s.text,
      imageUrl: s.imageUrl ?? "",
    })),
  );

  // Close on a successful save or delete.
  useEffect(() => {
    if (
      save.state === "idle" &&
      save.data &&
      (save.data.recipe || save.data.ok)
    )
      onClose();
  }, [save.state, save.data, onClose]);

  // Fill the form from a search result or URL import.
  const applyRecipe = useCallback((r: ImportedLike) => {
    if (r.name) setName(r.name);
    if (r.blurb != null) setBlurb(r.blurb);
    if (r.imageUrl != null) {
      setImageUrl(r.imageUrl);
      setImgBroken(false);
    }
    if (r.sourceUrl != null) setSourceUrl(r.sourceUrl);
    if (r.minutes != null) setMinutes(num(r.minutes));
    if (r.serves != null) setServes(num(r.serves));
    if (Array.isArray(r.tags) && r.tags.length) setTags(r.tags.join(", "));
    if (Array.isArray(r.ingredients) && r.ingredients.length)
      setIngredients(
        r.ingredients.map((i) => ({
          _id: nextId(),
          name: i.name,
          amount: num(i.amount),
          unit: i.unit ?? "",
        })),
      );
    if (Array.isArray(r.steps) && r.steps.length)
      setSteps(
        r.steps.map((s) => ({
          _id: nextId(),
          text: s.text,
          imageUrl: s.imageUrl ?? "",
        })),
      );
  }, []);

  // Pre-fill from a successful URL import.
  useEffect(() => {
    if (imp.state === "idle" && imp.data?.recipe) applyRecipe(imp.data.recipe);
  }, [imp.state, imp.data, applyRecipe]);

  const setIng = (id: number, patch: Partial<IngRow>) =>
    setIngredients((p) =>
      p.map((r) => (r._id === id ? { ...r, ...patch } : r)),
    );
  const addIng = () =>
    setIngredients((p) => [
      ...p,
      { _id: nextId(), name: "", amount: "", unit: "" },
    ]);
  const removeIng = (id: number) =>
    setIngredients((p) => p.filter((r) => r._id !== id));

  const setStep = (id: number, patch: Partial<StepRow>) =>
    setSteps((p) => p.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  const addStep = () =>
    setSteps((p) => [...p, { _id: nextId(), text: "", imageUrl: "" }]);
  const removeStep = (id: number) =>
    setSteps((p) => p.filter((r) => r._id !== id));

  const canSave = name.trim() !== "" && ingredients.some((r) => r.name.trim());

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) return;
    search.submit(
      { q },
      {
        method: "post",
        action: "/api/recipe-search",
        encType: "application/json",
      },
    );
  };

  const handleImport = () => {
    const url = importUrl.trim();
    if (!url) return;
    imp.submit(
      { url },
      {
        method: "post",
        action: "/api/recipe-import",
        encType: "application/json",
      },
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      _action: initial ? "update" : "create",
      id: initial?.id ?? null,
      name: name.trim(),
      blurb: blurb.trim() || null,
      imageUrl: imageUrl.trim() || null,
      sourceUrl: sourceUrl.trim() || null,
      minutes: minutes ? Number(minutes) : null,
      serves: serves ? Number(serves) : null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ingredients: ingredients
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          amount: r.amount ? Number(r.amount) : undefined,
          unit: r.unit || undefined,
        })),
      steps: steps
        .filter((r) => r.text.trim())
        .map((r) => ({
          text: r.text.trim(),
          imageUrl: r.imageUrl.trim() || undefined,
        })),
    };
    // The JSON SubmitTarget type only models flat string records; this payload
    // is JSON-serialised verbatim by the fetcher.
    save.submit(payload as unknown as Parameters<typeof save.submit>[0], {
      method: "post",
      action: "/api/recipes",
      encType: "application/json",
    });
  };

  const handleDelete = () => {
    if (!initial) return;
    save.submit(
      { _action: "delete", id: initial.id },
      { method: "post", action: "/api/recipes", encType: "application/json" },
    );
  };

  const labelCls =
    "text-[10px] font-bold uppercase tracking-widest text-slate-400";
  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white";
  // Width-free base for the ingredient row cells (each sets its own width — no
  // `w-full` so the fixed amount/unit cells don't fight the flexible name cell).
  const cellCls =
    "rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[13px] text-slate-800 placeholder-slate-300 outline-none focus:border-slate-400 focus:bg-white";

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Edit recipe" : "New recipe"}
        className="fixed left-1/2 top-1/2 z-[61] flex max-h-[92dvh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white font-mono shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <span className="text-[13px] font-bold text-slate-800">
            {initial ? "Edit recipe" : "New recipe"}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-300 transition-colors hover:text-slate-600"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Find a recipe online */}
          {!initial && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <span className={labelCls}>Find a recipe online</span>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search recipes, e.g. chicken curry…"
                    className={inputCls + " pl-8"}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || searching}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[12px] font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
                >
                  {searching ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Search size={13} />
                  )}
                  Search
                </button>
              </div>

              {search.data?.error && (
                <p className="mt-1.5 text-[11px] text-rose-500">
                  Search is unavailable right now — try again, or enter the
                  recipe by hand.
                </p>
              )}
              {search.state === "idle" &&
                search.data?.results &&
                (search.data.results.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    No matches — try another term, paste a link, or enter it by
                    hand.
                  </p>
                ) : (
                  <ul className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto">
                    {search.data.results.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => applyRecipe(r)}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                          {r.imageUrl ? (
                            <img
                              src={r.imageUrl}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 shrink-0 rounded-md bg-slate-100" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-bold text-slate-700">
                              {r.name}
                            </p>
                            {(r.area || r.category) && (
                              <p className="truncate text-[10px] text-slate-400">
                                {[r.area, r.category]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                          <Plus size={13} className="shrink-0 text-slate-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ))}

              {/* Secondary: paste a link (works for cooperative blogs) */}
              <div className="mt-2">
                {showUrlImport ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleImport()}
                        placeholder="https://… (recipe blog)"
                        className={inputCls + " py-1.5 text-[12px]"}
                      />
                      <button
                        type="button"
                        onClick={handleImport}
                        disabled={!importUrl.trim() || importing}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[12px] font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                      >
                        {importing ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Link2 size={13} />
                        )}
                        Import
                      </button>
                    </div>
                    {imp.data?.error && (
                      <p className="mt-1.5 text-[11px] text-rose-500">
                        Couldn’t read that page — many big sites block imports.
                        Search above, or enter it by hand.
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowUrlImport(true)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-slate-600"
                  >
                    <Link2 size={11} /> or paste a recipe link
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Name + blurb */}
          <div className="flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recipe name"
              className={inputCls + " text-[15px] font-bold"}
            />
            <textarea
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="A short description (optional)"
              rows={2}
              className={inputCls + " resize-none"}
            />
          </div>

          {/* Photo + meta */}
          <div className="flex gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {imageUrl && !imgBroken ? (
                <img
                  src={imageUrl}
                  alt="Recipe preview"
                  className="h-full w-full object-cover"
                  onError={() => setImgBroken(true)}
                />
              ) : (
                <ImageOff size={18} className="text-slate-300" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImgBroken(false);
                }}
                placeholder="Photo URL (optional)"
                className={inputCls}
              />
              <div className="flex gap-2">
                <label className="flex flex-1 items-center gap-2">
                  <span className={labelCls}>Mins</span>
                  <input
                    value={minutes}
                    onChange={(e) =>
                      setMinutes(e.target.value.replace(/[^\d]/g, ""))
                    }
                    inputMode="numeric"
                    className={inputCls + " py-1.5"}
                  />
                </label>
                <label className="flex flex-1 items-center gap-2">
                  <span className={labelCls}>Serves</span>
                  <input
                    value={serves}
                    onChange={(e) =>
                      setServes(e.target.value.replace(/[^\d]/g, ""))
                    }
                    inputMode="numeric"
                    className={inputCls + " py-1.5"}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Ingredients</span>
            {ingredients.map((r) => (
              <div key={r._id} className="flex items-center gap-1.5">
                <input
                  value={r.amount}
                  onChange={(e) =>
                    setIng(r._id, {
                      amount: e.target.value.replace(/[^\d.]/g, ""),
                    })
                  }
                  placeholder="Qty"
                  inputMode="decimal"
                  className={cellCls + " w-14 px-2 text-center"}
                />
                <select
                  value={r.unit}
                  onChange={(e) => setIng(r._id, { unit: e.target.value })}
                  className={cellCls + " w-[4.5rem] px-1.5"}
                >
                  <option value="">unit</option>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <input
                  value={r.name}
                  onChange={(e) => setIng(r._id, { name: e.target.value })}
                  placeholder="Ingredient"
                  className={cellCls + " min-w-0 flex-1 px-3"}
                />
                <button
                  type="button"
                  onClick={() => removeIng(r._id)}
                  aria-label="Remove ingredient"
                  className="shrink-0 rounded-md p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addIng}
              className="mt-0.5 flex items-center gap-1 self-start rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100"
            >
              <Plus size={12} strokeWidth={2.5} /> Ingredient
            </button>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Steps</span>
            {steps.map((r, i) => (
              <div key={r._id} className="flex items-start gap-1.5">
                <span className="mt-2 w-4 shrink-0 text-center text-[11px] font-bold text-slate-400">
                  {i + 1}
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <textarea
                    value={r.text}
                    onChange={(e) => setStep(r._id, { text: e.target.value })}
                    placeholder="What to do…"
                    rows={2}
                    className={inputCls + " resize-none py-1.5"}
                  />
                  <input
                    value={r.imageUrl}
                    onChange={(e) =>
                      setStep(r._id, { imageUrl: e.target.value })
                    }
                    placeholder="Step photo URL (optional)"
                    className={inputCls + " py-1 text-[11px]"}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeStep(r._id)}
                  aria-label="Remove step"
                  className="mt-1 shrink-0 rounded-md p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addStep}
              className="mt-0.5 flex items-center gap-1 self-start rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100"
            >
              <Plus size={12} strokeWidth={2.5} /> Step
            </button>
          </div>

          {/* Tags */}
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Tags</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="dinner, quick, vegetarian"
              className={inputCls}
            />
          </label>

          {/* Share to community — only for a saved recipe you own */}
          {initial && (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={toggleVisibility}
                className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  isPublic ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    isPublic ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <div className="min-w-0">
                <span className={labelCls}>Share to community</span>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                  {isPublic ? "Public — " : ""}Only the name, photo, and steps
                  are shared. Never your inventory.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-3.5">
          {initial && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-500 transition-colors hover:bg-rose-100 disabled:opacity-40"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-100 py-2 text-[12px] font-bold text-slate-500 transition-colors hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || busy}
            className="flex-1 rounded-lg bg-slate-900 py-2 text-[12px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving…" : initial ? "Save changes" : "Create recipe"}
          </button>
        </div>
      </div>
    </>
  );
}
