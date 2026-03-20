import { memo } from "react";
import type { StoreWithDetails } from "~/types/dashboardTypes";
import { useNavigate } from "react-router";
import { useState } from "react";
import { GridThumbnail } from "./gridtumbnail";
import { formatDate } from "~/utils/dashboardUtils";

export const StoreCard = memo(function StoreCard({
  store,
  pinned,
  onDelete,
  onPin,
}: {
  store: StoreWithDetails;
  pinned: boolean;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const tags: string[] = JSON.parse(store.tags ?? "[]");
  const fillPct = Math.round(
    (store.blocks.reduce((acc, b) => acc + b.width * b.height, 0) /
      (store.rows * store.cols)) *
      100,
  );

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    onDelete(store.id);
  };

  return (
    <div
      onClick={() => navigate(`/store/${store.id}`)}
      className="group relative flex flex-col bg-white rounded-2xl border border-slate-200
                 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-50
                 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative h-36 bg-slate-50 border-b border-slate-100 overflow-hidden">
        <GridThumbnail
          blocks={store.blocks}
          rows={store.rows}
          cols={store.cols}
          name={store.name}
        />

        {/* Pin button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin(store.id);
          }}
          title={pinned ? "Unpin" : "Pin to top"}
          className={`absolute top-2 left-2 w-7 h-7 flex items-center justify-center
                      rounded-full border transition-all duration-150 z-10
                      ${
                        pinned
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-white/80 border-slate-200 text-slate-400 opacity-0 group-hover:opacity-100"
                      }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d={
                pinned
                  ? "M6 1l1.5 3.5L11 5l-2.5 2.5.6 3.5L6 9.3 2.9 11l.6-3.5L1 5l3.5-.5L6 1z"
                  : "M6 1l1.5 3.5L11 5l-2.5 2.5.6 3.5L6 9.3 2.9 11l.6-3.5L1 5l3.5-.5L6 1z"
              }
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
              fill={pinned ? "currentColor" : "none"}
            />
          </svg>
        </button>

        {/* Fill badge */}
        <div
          className="absolute bottom-2 right-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm
                        rounded-full border border-slate-200 text-[10px] font-semibold
                        text-slate-500 tabular-nums"
        >
          {fillPct}% filled
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {store.name}
            </span>
            <span className="text-[11px] text-slate-400">
              {store.cols}×{store.rows} · {store.blocks.length} block
              {store.blocks.length !== 1 ? "s" : ""}
              {store.itemCount > 0 &&
                ` · ${store.itemCount} item${store.itemCount !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title={confirmDelete ? "Click again to confirm" : "Delete"}
            className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg
                        border transition-all duration-150 text-xs
                        ${
                          confirmDelete
                            ? "border-red-300 bg-red-50 text-red-500"
                            : "border-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 hover:border-red-200 hover:text-red-400 hover:bg-red-50"
                        }`}
          >
            {deleting ? (
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : confirmDelete ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 2l8 8M10 2L2 10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px]
                           font-medium rounded-full leading-tight"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Created date */}
        <span className="text-[10px] text-slate-300 mt-0.5">
          {formatDate(store.createdAt)}
        </span>
      </div>
    </div>
  );
});
