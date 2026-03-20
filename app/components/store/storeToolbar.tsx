import { useNavigate } from "react-router";
import type { AccessLevel } from "~/types/memberTypes";
import type { CreateStoreInput } from "~/types/storeViewFinderTypes";

type Props = {
  storeId: string;
  search: string;
  onSearchChange: (val: string) => void;
  onAddItem: () => void;
  onMembersToggle: () => void;
  accessLevel: AccessLevel;
  store: CreateStoreInput | null;
  onToggleVisibility: (
    field: "isPublic" | "canvasVisible",
    value: boolean,
  ) => void;
};

export function StoreToolbar({
  storeId,
  search,
  onSearchChange,
  onAddItem,
  onMembersToggle,
  accessLevel,
  store,
  onToggleVisibility,
}: Props) {
  const navigate = useNavigate();
  const canEdit = accessLevel === "owner" || accessLevel === "editor";
  const isOwner = accessLevel === "owner";

  return (
    <div className="flex items-center gap-3 px-6 h-14 shrink-0 border-b border-slate-200 bg-white">
      {/* Edit Store — owner/editor only */}
      {canEdit && (
        <button
          onClick={() => navigate(`/store/${storeId}/edit`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit Store
        </button>
      )}

      {/* Add Item — owner/editor only */}
      {canEdit && (
        <button
          onClick={onAddItem}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1v10M1 6h10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          Add Item
        </button>
      )}

      {/* Visibility toggles — owner only */}
      {isOwner && store && (
        <>
          <div className="w-px h-5 bg-slate-200" />

          {/* Public toggle */}
          <button
            onClick={() => onToggleVisibility("isPublic", !store.isPublic)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
              store.isPublic
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                store.isPublic ? "bg-emerald-400" : "bg-slate-300"
              }`}
            />
            {store.isPublic ? "Public" : "Private"}
          </button>

          {/* Canvas visible toggle — only meaningful when public */}
          {store.isPublic && (
            <button
              onClick={() =>
                onToggleVisibility("canvasVisible", !store.canvasVisible)
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all duration-150 ${
                store.canvasVisible
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  store.canvasVisible ? "bg-emerald-400" : "bg-slate-300"
                }`}
              />
              {store.canvasVisible ? "Map Visible" : "Map Hidden"}
            </button>
          )}

          <div className="w-px h-5 bg-slate-200" />
        </>
      )}

      {/* Members button — owner only */}
      {isOwner && (
        <button
          onClick={onMembersToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle
              cx="4.5"
              cy="3.5"
              r="2"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M1 10c0-2 1.5-3.5 3.5-3.5S8 8 8 10"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path
              d="M8.5 5v3M10 6.5H7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Members
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative flex items-center">
        <svg
          className="absolute left-2.5 text-slate-300"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <circle
            cx="5.5"
            cy="5.5"
            r="3.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M8 8l2.5 2.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search items..."
          className="pl-7 pr-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all w-52"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 text-slate-300 hover:text-slate-500"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1 1l8 8M9 1L1 9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
