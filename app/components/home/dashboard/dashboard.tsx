import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import gsap from "gsap";
import { Plus, Search, ArrowDown, X } from "lucide-react";
import { useNavigate, useFetcher } from "react-router";
import { useUser } from "@clerk/react-router";
import type {
  StoreWithDetails,
  SortOption,
  SortDir,
  AttentionItem,
} from "#types/dashboardTypes";
import { StoreCard } from "./storecard";
import { EmptyState } from "./emptystate";
import { AttentionDigest } from "./attentionDigest";
import { CountUp } from "#components/common/countUp";

// ── Main Dashboard ─────────────────────────────────────────

type Props = { stores: StoreWithDetails[]; attention: AttentionItem[] };

export default function Dashboard({
  stores: initialStores,
  attention: initialAttention,
}: Props) {
  const { user } = useUser();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const addFetcher = useFetcher();

  const [stores, setStores] = useState<StoreWithDetails[]>(initialStores);
  const [attention, setAttention] = useState<AttentionItem[]>(initialAttention);
  useEffect(() => setAttention(initialAttention), [initialAttention]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("lv_pinned");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });

  // Parse tags once per store, reused by allTags and filtered
  const parsedTags = useMemo(() => {
    return new Map(
      stores.map((store) => [
        store.id,
        JSON.parse(store.tags ?? "[]") as string[],
      ]),
    );
  }, [stores]);

  // All unique tags across stores
  const allTags = useMemo(() => {
    const s = new Set<string>();
    parsedTags.forEach((tags) => tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [parsedTags]);

  const filtered = useMemo(() => {
    let result = [...stores];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          parsedTags.get(s.id)?.some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (activeTag) {
      result = result.filter((s) => parsedTags.get(s.id)?.includes(activeTag));
    }

    result.sort((a, b) => {
      const aPinned = pinned.has(a.id);
      const bPinned = pinned.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      let cmp = 0;
      if (sort === "name") cmp = a.name.localeCompare(b.name);
      if (sort === "created")
        cmp =
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [stores, search, sort, sortDir, activeTag, pinned, parsedTags]);

  const handleDelete = useCallback(
    (id: string) => {
      fetcher.submit(
        { storeId: id, _action: "deleteStore" },
        {
          method: "POST",
          encType: "application/x-www-form-urlencoded",
        },
      );

      setStores((prev) => prev.filter((s) => s.id !== id));
    },
    [fetcher],
  );

  const handleAddToList = useCallback(
    (it: AttentionItem) => {
      addFetcher.submit(
        { _action: "addToList", itemId: it.id, storeId: it.storeId },
        { method: "POST", encType: "application/x-www-form-urlencoded" },
      );
      setAttention((prev) =>
        prev.map((a) =>
          a.id === it.id && a.storeId === it.storeId
            ? { ...a, onList: true }
            : a,
        ),
      );
    },
    [addFetcher],
  );

  const handlePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem("lv_pinned", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const pinnedCount = stores.filter((s) => pinned.has(s.id)).length;

  // ── Entrance: header + cards reveal once on mount ──
  const rootRef = useRef<HTMLDivElement>(null);
  const didAnim = useRef(false);
  useEffect(() => {
    if (didAnim.current || !rootRef.current) return;
    didAnim.current = true;
    const ctx = gsap.context(() => {
      gsap.from(".lv-dash-head", {
        opacity: 0,
        y: -12,
        duration: 0.5,
        ease: "power3.out",
      });
      gsap.from(".lv-store-card", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.06,
        delay: 0.08,
        clearProps: "all",
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-slate-50 px-4 sm:px-8 py-10 max-w-7xl mx-auto"
    >
      {/* ── Header ── */}
      <div className="lv-dash-head flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {user?.firstName ? `${user.firstName}'s` : "Your"} stores
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            <CountUp value={stores.length} /> {stores.length === 1 ? "location" : "locations"}
            {pinnedCount > 0 && ` · ${pinnedCount} pinned`}
          </p>
        </div>
        <button
          onClick={() => navigate("/addstore")}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500
                     text-white text-sm font-semibold rounded-xl transition-colors
                     shadow-sm shadow-emerald-900/10 self-start sm:self-auto"
        >
          <Plus size={15} strokeWidth={2.4} />
          New store
        </button>
      </div>

      {/* ── Foresight digest ── */}
      <AttentionDigest items={attention} onAdd={handleAddToList} />

      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Search + sort row */}
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search stores or tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200
                         rounded-xl text-slate-700 placeholder-slate-400
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/30
                         focus:border-emerald-400 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                           hover:text-slate-600 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sort select */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl
                       text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30
                       focus:border-emerald-400 transition cursor-pointer"
          >
            <option value="created">Date</option>
            <option value="name">Name</option>
          </select>

          {/* Sort direction */}
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-500
                       hover:border-slate-300 hover:text-slate-700 transition"
          >
            <ArrowDown
              size={15}
              style={{
                transform: sortDir === "asc" ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                          ${
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
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                            ${
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

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <EmptyState
          search={search || (activeTag ?? "")}
          onClear={() => {
            setSearch("");
            setActiveTag(null);
          }}
          onCreate={() => navigate("/addstore")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((store) => (
            <div key={store.id} className="lv-store-card">
              <StoreCard
                store={store}
                pinned={pinned.has(store.id)}
                onDelete={handleDelete}
                onPin={handlePin}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
