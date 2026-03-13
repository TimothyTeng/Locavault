import { useState, useMemo } from "react";
import { useNavigate, useFetcher } from "react-router";
import { useUser } from "@clerk/react-router";

// ── Types ──────────────────────────────────────────────────
export type Store = {
  id: string;
  name: string;
  tags: string;
  description: string | null;
  rows: number;
  cols: number;
  userId: string;
  createdAt: Date | null;
};

type SortOption = "name" | "created";

type Props = {
  stores: Store[];
};

// ── Store Card ─────────────────────────────────────────────
function StoreCard({
  store,
  onDelete,
}: {
  store: Store;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    await onDelete(store.id);
    setDeleting(false);
  };

  const tags: string[] = JSON.parse(store.tags ?? "[]");

  return (
    <div className="store-card" onClick={() => navigate(`/store/${store.id}`)}>
      <div className="store-card-body">
        <div className="store-card-info">
          <div className="store-card-name">{store.name}</div>
          <div className="store-card-tags">
            {tags.map((tag) => (
              <span key={tag} className="store-card-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <button
          className={`store-card-delete${confirmDelete ? " confirming" : ""}`}
          onClick={handleDelete}
          disabled={deleting}
          title={confirmDelete ? "Click again to confirm" : "Delete store"}
        >
          {deleting ? (
            <span className="store-card-delete-spinner" />
          ) : confirmDelete ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 7l4 4 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────
export default function Dashboard({ stores: initialStores }: Props) {
  const { user } = useUser();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [stores, setStores] = useState<Store[]>(initialStores);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...stores];
    if (search.trim()) {
      result = result.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()),
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sort === "name") cmp = a.name.localeCompare(b.name);
      if (sort === "created")
        cmp = (a.createdAt?.toString() ?? "").localeCompare(
          b.createdAt?.toString() ?? "",
        );
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [stores, search, sort, sortDir]);

  const handleDelete = (id: string) => {
    fetcher.submit(
      { storeId: id, _action: "deleteStore" },
      { method: "POST", action: "/" },
    );
    setStores((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleSortDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  return (
    <div className="dash-page">
      {/* ── Header ── */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-title">
            {user?.firstName ? `${user.firstName}'s` : "Your"} stores
          </h1>
          <p className="dash-subtitle">
            {stores.length} {stores.length === 1 ? "location" : "locations"} ·
            manage your inventory
          </p>
        </div>
        <button className="btn-add-store" onClick={() => navigate("/addstore")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2v12M2 8h12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Add new store
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="dash-toolbar">
        {/* Search */}
        <div className="dash-search-wrap">
          <svg
            className="dash-search-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="7"
              cy="7"
              r="4.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M10.5 10.5l3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            className="dash-search"
            type="text"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="dash-search-clear" onClick={() => setSearch("")}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="dash-sort-wrap">
          <span className="dash-sort-label">Sort by</span>
          <select
            className="dash-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
          >
            <option value="name">Name</option>
            <option value="created">Date created</option>
          </select>
          <button
            className="dash-sort-dir"
            onClick={toggleSortDir}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{
                transform: sortDir === "asc" ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            >
              <path
                d="M7 2v10M3 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Cards Grid ── */}
      {filtered.length === 0 ? (
        <div className="dash-empty">
          {search ? (
            <>
              <div className="dash-empty-icon">🔍</div>
              <div className="dash-empty-title">No stores match "{search}"</div>
              <div className="dash-empty-sub">Try a different search term</div>
            </>
          ) : (
            <>
              <div className="dash-empty-icon">🏪</div>
              <div className="dash-empty-title">No stores yet</div>
              <div className="dash-empty-sub">
                Create your first store to start tracking inventory
              </div>
              <button
                className="btn-add-store"
                onClick={() => navigate("/addstore")}
              >
                Add your first store
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="stores-grid">
          {filtered.map((store) => (
            <StoreCard key={store.id} store={store} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
