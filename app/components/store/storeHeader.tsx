import type { CreateStoreInput } from "~/types/storeViewFinderTypes";

type Props = {
  store: CreateStoreInput;
  id: string | undefined;
};

export function StoreHeader({ store, id }: Props) {
  const tags: string[] = JSON.parse(store.tags ?? "[]");

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-slate-800">{store.name}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {store.cols} × {store.rows} grid · {store.blocks.length} block
            {store.blocks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <span className="text-[10px] font-mono text-slate-300">{id}</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border bg-slate-100 border-slate-300 text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {store.description && (
        <p className="text-[12px] text-slate-500 leading-relaxed">
          {store.description}
        </p>
      )}
    </div>
  );
}
