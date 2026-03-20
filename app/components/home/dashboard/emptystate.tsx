export function EmptyState({
  search,
  onClear,
  onCreate,
}: {
  search: string;
  onClear: () => void;
  onCreate: () => void;
}) {
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="#94a3b8" strokeWidth="1.5" />
            <path
              d="M13.5 13.5l3 3"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            No results for "{search}"
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Try a different name or tag
          </p>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2"
        >
          Clear search
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect
            x="3"
            y="7"
            width="22"
            height="16"
            rx="3"
            stroke="#10b981"
            strokeWidth="1.5"
          />
          <path
            d="M9 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M14 12v6M11 15h6"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">No stores yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Create your first store to start mapping inventory
        </p>
      </div>
      <button
        onClick={onCreate}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm
                   font-semibold rounded-xl transition-colors"
      >
        Create your first store
      </button>
    </div>
  );
}
