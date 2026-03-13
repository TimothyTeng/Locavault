import { useState } from "react";

const PRESET_TAGS = ["Home", "Office", "Storage", "Food", "Electronics"];

const TAG_COLORS: Record<string, { idle: string; active: string }> = {
  Home: {
    idle: "bg-sky-50 border-sky-200 text-sky-600 hover:border-sky-400 hover:bg-sky-100",
    active: "bg-sky-500 border-sky-500 text-white",
  },
  Office: {
    idle: "bg-violet-50 border-violet-200 text-violet-600 hover:border-violet-400 hover:bg-violet-100",
    active: "bg-violet-500 border-violet-500 text-white",
  },
  Storage: {
    idle: "bg-amber-50 border-amber-200 text-amber-600 hover:border-amber-400 hover:bg-amber-100",
    active: "bg-amber-500 border-amber-500 text-white",
  },
  Food: {
    idle: "bg-emerald-50 border-emerald-200 text-emerald-600 hover:border-emerald-400 hover:bg-emerald-100",
    active: "bg-emerald-500 border-emerald-500 text-white",
  },
  Electronics: {
    idle: "bg-rose-50 border-rose-200 text-rose-600 hover:border-rose-400 hover:bg-rose-100",
    active: "bg-rose-500 border-rose-500 text-white",
  },
};

const CUSTOM_COLOR = {
  idle: "bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-200",
  active: "bg-slate-700 border-slate-700 text-white",
};

type Props = {
  onChange?: (values: {
    name: string;
    tags: string[];
    description: string;
  }) => void;
  onSubmit: (name: string, tags: string[], description: string) => void;
};

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
      <span className="inline-block w-1 h-3.5 rounded-full bg-gradient-to-b from-slate-400 to-slate-300" />
      {children}
    </label>
  );
}

export function StoreForm({ onChange, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [customTagInput, setCustomTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [nameError, setNameError] = useState(false);

  const allTags = [...PRESET_TAGS, ...customTags];

  const toggleTag = (tag: string) => {
    const next = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    setTags(next);
    onChange?.({ name, tags: next, description });
  };

  const addCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed || trimmed.length > 20 || allTags.includes(trimmed)) return;
    const nextCustom = [...customTags, trimmed];
    const nextTags = [...tags, trimmed];
    setCustomTags(nextCustom);
    setTags(nextTags);
    setCustomTagInput("");
    onChange?.({ name, tags: nextTags, description });
  };

  const removeCustomTag = (tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
    const nextTags = tags.filter((t) => t !== tag);
    setTags(nextTags);
    onChange?.({ name, tags: nextTags, description });
  };

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[12px] font-mono text-slate-800 placeholder-slate-300 shadow-sm outline-none transition-all duration-150 focus:border-slate-500 focus:ring-2 focus:ring-slate-100";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setNameError(true);
          return;
        }
        setNameError(false);
        onSubmit(name, tags, description);
      }}
      className="flex flex-col gap-6 pb-10"
    >
      {/* Store Name */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Store Name</FieldLabel>
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder="e.g. Main Warehouse"
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(false);
            onChange?.({ name: e.target.value, tags, description });
          }}
          className={`${inputClass} ${nameError ? "border-red-400 ring-2 ring-red-100" : ""}`}
        />
        {nameError && (
          <p className="text-[10px] text-red-500 font-medium mt-0.5">
            Store name is required.
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Tags</FieldLabel>

        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const isCustom = customTags.includes(tag);
            const isSelected = tags.includes(tag);
            const colors = TAG_COLORS[tag] ?? CUSTOM_COLOR;

            return (
              <span
                key={tag}
                onClick={() => toggleTag(tag)}
                className={[
                  "inline-flex items-center gap-1 cursor-pointer select-none rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all duration-150",
                  isSelected ? colors.active : colors.idle,
                ].join(" ")}
              >
                {tag}
                {isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustomTag(tag);
                    }}
                    className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity text-[12px] leading-none"
                    title="Remove tag"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {/* Custom tag input */}
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={customTagInput}
            maxLength={20}
            placeholder="Add custom tag…"
            onChange={(e) => setCustomTagInput(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-[11px] font-mono text-slate-800 placeholder-slate-300 shadow-sm outline-none transition-all focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          />
          <button
            type="button"
            onClick={addCustomTag}
            disabled={!customTagInput.trim()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-all duration-150 hover:bg-slate-800 hover:text-white hover:border-slate-800 disabled:opacity-25 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-2">
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={description}
          placeholder="Describe this store layout…"
          rows={4}
          onChange={(e) => {
            setDescription(e.target.value);
            onChange?.({ name, tags, description: e.target.value });
          }}
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[11px] font-mono text-slate-800 placeholder-slate-300 shadow-sm outline-none transition-all duration-150 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 leading-relaxed"
        />
      </div>

      <button
        type="submit"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm transition-all duration-150 hover:bg-slate-800 hover:text-white hover:border-slate-800"
      >
        Save
      </button>
    </form>
  );
}
