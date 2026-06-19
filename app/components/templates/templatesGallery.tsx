import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import type { TemplateWithBlocks } from "~/types/templateTypes";
import { TemplateCard } from "./templateCard";
import { CloseButton } from "~/components/common/CloseButton";
import { Button } from "~/components/common/Button";

type StoreOption = { id: string; name: string };

type Props = {
  templates: TemplateWithBlocks[];
  stores: StoreOption[];
  userId: string;
};

type Scope = "all" | "mine";

export function TemplatesGallery({
  templates: initial,
  stores,
  userId,
}: Props) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [templates, setTemplates] = useState(initial);
  useEffect(() => setTemplates(initial), [initial]);

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const parsedTags = useMemo(
    () =>
      new Map(
        templates.map((t) => [t.id, JSON.parse(t.tags ?? "[]") as string[]]),
      ),
    [templates],
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    parsedTags.forEach((tags) => tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [parsedTags]);

  const filtered = useMemo(() => {
    let result = [...templates];
    if (scope === "mine") result = result.filter((t) => t.userId === userId);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          parsedTags.get(t.id)?.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    if (activeTag)
      result = result.filter((t) => parsedTags.get(t.id)?.includes(activeTag));
    // Food-first: surface kitchen/food layouts first (our flagship use case),
    // then most-recent within each group.
    const foodRe = /food|kitchen|pantry|fridge|grocer|meal/i;
    const isFood = (t: (typeof result)[number]) =>
      foodRe.test(t.name) ||
      (parsedTags.get(t.id) ?? []).some((tag) => foodRe.test(tag));
    return result.sort((a, b) => {
      const rank = (isFood(a) ? 0 : 1) - (isFood(b) ? 0 : 1);
      if (rank !== 0) return rank;
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    });
  }, [templates, scope, search, activeTag, parsedTags, userId]);

  // ── Actions ──
  const handleUse = (template: TemplateWithBlocks) => {
    setUsingId(template.id);
    // Action returns a redirect to the new store; the fetcher follows it.
    fetcher.submit(
      { _action: "useTemplate", templateId: template.id },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    fetcher.submit(
      { _action: "deleteTemplate", templateId: id },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleToggleVisibility = (id: string, isPublic: boolean) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isPublic } : t)),
    );
    fetcher.submit(
      { _action: "setVisibility", templateId: id, isPublic },
      { method: "POST", encType: "application/json" },
    );
  };

  return (
    <div className="px-4 sm:px-8 py-10 max-w-7xl mx-auto md:pt-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Templates
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Reusable store layouts — start a new store from one, or share yours.
          </p>
        </div>

        {/* New template menu */}
        <div className="relative self-start sm:self-auto" ref={menuRef}>
          <Button
            variant="primary"
            size="lg"
            onClick={() => setMenuOpen((v) => !v)}
            className="shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            New template
          </Button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 z-20 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 flex flex-col">
              <button
                onClick={() => navigate("/templates/new")}
                className="px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Build from scratch
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setModalOpen(true);
                }}
                disabled={stores.length === 0}
                className="px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                From an existing store
                {stores.length === 0 && (
                  <span className="block text-[10px] text-slate-400">
                    No stores yet
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search templates or tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition"
          />
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
            {(["all", "mine"] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  scope === s
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {s === "all" ? "All" : "Mine"}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                activeTag === null
                  ? "bg-slate-800 border-slate-800 text-white"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  activeTag === tag
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <p className="text-sm text-slate-400 font-mono">
            {templates.length === 0
              ? "No templates yet — create the first one."
              : "No templates match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isOwner={template.userId === userId}
              busy={usingId === template.id && fetcher.state !== "idle"}
              onUse={handleUse}
              onDelete={handleDelete}
              onToggleVisibility={handleToggleVisibility}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <FromStoreModal
          stores={stores}
          fetcher={fetcher}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Save-from-store modal ──
function FromStoreModal({
  stores,
  fetcher,
  onClose,
}: {
  stores: StoreOption[];
  fetcher: ReturnType<typeof useFetcher>;
  onClose: () => void;
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const submitting = fetcher.state !== "idle";
  const wasSubmitting = useRef(false);

  // Close once the submission completes
  useEffect(() => {
    if (submitting) wasSubmitting.current = true;
    else if (wasSubmitting.current) onClose();
  }, [submitting, onClose]);

  const submit = () => {
    if (!storeId) return;
    fetcher.submit(
      {
        _action: "createFromStore",
        storeId,
        name: name.trim() || stores.find((s) => s.id === storeId)?.name || "",
        description: description.trim() || null,
        isPublic,
      },
      { method: "POST", encType: "application/json" },
    );
  };

  const input =
    "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 bg-white";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-700">
            Save store as template
          </span>
          <CloseButton
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700"
          />
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
              Store
            </label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className={`${input} cursor-pointer`}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Only the layout (blocks) is copied — not items.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
              Template name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={stores.find((s) => s.id === storeId)?.name ?? "Name"}
              className={input}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional"
              className={`${input} resize-none`}
            />
          </div>

          <button
            type="button"
            onClick={() => setIsPublic((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-600"
          >
            <span
              className={`relative w-9 h-5 rounded-full border transition-all ${
                isPublic
                  ? "bg-emerald-500 border-emerald-500"
                  : "bg-white border-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                  isPublic ? "left-[calc(100%-18px)]" : "left-0.5"
                }`}
              />
            </span>
            {isPublic ? "Public — anyone can use it" : "Private — only you"}
          </button>
        </div>

        <div className="px-5 py-3 border-t border-slate-100">
          <Button
            variant="primary"
            size="md"
            onClick={submit}
            disabled={submitting || !storeId}
            className="w-full"
          >
            {submitting ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
