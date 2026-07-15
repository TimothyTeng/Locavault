import { memo, useState } from "react";
import { GridThumbnail } from "../home/dashboard/gridtumbnail";
import { formatDate } from "~/utils/dashboardUtils";
import type { TemplateWithBlocks } from "~/types/templateTypes";
import { Button } from "~/components/common/Button";

export const TemplateCard = memo(function TemplateCard({
  template,
  isOwner,
  busy,
  onUse,
  onDelete,
  onToggleVisibility,
}: {
  template: TemplateWithBlocks;
  isOwner: boolean;
  busy: boolean;
  onUse: (template: TemplateWithBlocks) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, isPublic: boolean) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tags: string[] = JSON.parse(template.tags ?? "[]");

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onDelete(template.id);
  };

  return (
    <div className="group relative flex flex-col bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-50 transition-all duration-200 overflow-hidden">
      {/* Thumbnail */}
      <div className="relative h-36 bg-slate-50 border-b border-slate-100 overflow-hidden">
        <GridThumbnail
          blocks={template.blocks}
          rows={template.rows}
          cols={template.cols}
          name={template.name}
          walls={template.walls}
        />

        {/* Visibility pill / toggle */}
        {isOwner ? (
          <button
            onClick={() => onToggleVisibility(template.id, !template.isPublic)}
            title="Toggle public / private"
            className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-colors ${
              template.isPublic
                ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                : "bg-white/90 border-slate-200 text-slate-400 hover:border-slate-300"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${template.isPublic ? "bg-emerald-400" : "bg-slate-300"}`}
            />
            {template.isPublic ? "Public" : "Private"}
          </button>
        ) : (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full border border-slate-200 bg-white/90 text-[10px] font-semibold text-slate-400">
            Template
          </div>
        )}

        {/* Usage badge */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-full border border-slate-200 text-[10px] font-semibold text-slate-500 tabular-nums">
          {template.usageCount} use{template.usageCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 px-4 py-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {template.name}
            </span>
            <span className="text-[11px] text-slate-400">
              {template.cols}×{template.rows} · {template.blocks.length} block
              {template.blocks.length !== 1 ? "s" : ""}
            </span>
          </div>

          {isOwner && (
            <button
              onClick={handleDelete}
              title={confirmDelete ? "Click again to confirm" : "Delete"}
              className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border transition-all duration-150 text-xs ${
                confirmDelete
                  ? "border-red-300 bg-red-50 text-red-500"
                  : "border-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 hover:border-red-200 hover:text-red-400 hover:bg-red-50"
              }`}
            >
              {confirmDelete ? (
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
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-full leading-tight"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {template.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">
            {template.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 gap-2">
          <span className="text-[10px] text-slate-300">
            {formatDate(template.createdAt)}
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onUse(template)}
            disabled={busy}
          >
            {busy ? (
              <span className="w-3 h-3 border border-white/70 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1v12M1 7h12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
            Use template
          </Button>
        </div>
      </div>
    </div>
  );
});
