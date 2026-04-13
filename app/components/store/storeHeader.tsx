import type { CreateStoreInput } from "~/types/storeViewFinderTypes";
import { ZoomControls } from "#components/addstore/storeViewFinder/ZoomControl";

type Props = {
  store: CreateStoreInput;
  id: string | undefined;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function StoreHeader({ store, id, zoom, onZoomIn, onZoomOut }: Props) {
  const tags: string[] = JSON.parse(store.tags ?? "[]");

  return (
    <div className="flex items-center gap-3 px-1 pb-3">
      {/* Name + tags */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-[12px] font-bold text-slate-700 truncate">
          {store.name}
        </span>
        {tags.map((tag) => (
          <span
            key={tag}
            className="hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border bg-slate-100 border-slate-200 text-slate-500 shrink-0"
          >
            {tag}
          </span>
        ))}
        <span className="text-[9px] font-mono text-slate-300 shrink-0">
          {store.cols}×{store.rows}
        </span>
      </div>

      {/* Zoom */}
      <ZoomControls zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
    </div>
  );
}
