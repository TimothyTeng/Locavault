import StoreViewFinder from "./storeViewFInder";

const fieldClass =
  "w-full px-4 py-3.5 text-base bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-300 focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/10 transition-all duration-150 shadow-sm hover:border-slate-300";

const labelClass =
  "block text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 mb-2";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300">
        {children}
      </span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

export default function StoreForm() {
  return (
    <div className="flex flex-col gap-7 font-sans">
      <div>
        <SectionHeading>Identity</SectionHeading>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Store Name</label>
            <input
              type="text"
              placeholder="e.g. Main Street Branch"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Store Type</label>
            <div className="relative">
              <select
                className={`${fieldClass} appearance-none cursor-pointer pr-9`}
                defaultValue=""
              >
                <option value="" disabled>
                  Select type…
                </option>
                <option value="retail">Retail</option>
                <option value="warehouse">Warehouse</option>
                <option value="popup">Pop-up</option>
                <option value="flagship">Flagship</option>
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
              >
                <path
                  d="M3 5l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeading>Location</SectionHeading>
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Address</label>
            <input
              type="text"
              placeholder="123 Example Street"
              className={fieldClass}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className={labelClass}>City</label>
              <input type="text" placeholder="London" className={fieldClass} />
            </div>
            <div className="w-28">
              <label className={labelClass}>Postcode</label>
              <input
                type="text"
                placeholder="SW1A 1AA"
                className={fieldClass}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeading>Additional Info</SectionHeading>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            rows={4}
            placeholder="Any additional notes about this store…"
            className={`${fieldClass} resize-none leading-relaxed`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        <button className="w-full py-4 text-xs font-bold uppercase tracking-[0.12em] bg-green-700 hover:bg-green-600 active:bg-green-800 text-white rounded-lg transition-colors duration-150 shadow-sm shadow-green-900/20">
          Save Store
        </button>
        <button className="w-full py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-600 hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg transition-colors duration-150">
          Clear
        </button>
      </div>
    </div>
  );
}
