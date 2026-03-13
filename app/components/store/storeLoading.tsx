export function StoreLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-4">
      <div
        className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-slate-600"
        style={{ animation: "spin 0.8s linear infinite" }}
      />
      <p className="text-slate-400 font-mono text-[11px] uppercase tracking-widest">
        Loading store...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
