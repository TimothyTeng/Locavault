import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { CloseButton } from "~/components/common/CloseButton";
import { PRESET_COLORS, type Block, type BlockKind } from "#types/BlockTypes";
import {
  FIXTURE_IDS,
  FIXTURE_META,
  FIXTURE_CATEGORIES,
  FixtureGraphic,
} from "#lib/fixtures";
import type { CustomFixture, FixtureRef } from "#types/customFixtureTypes";
import { CustomFixtureEditor } from "./CustomFixtureEditor";

type Props = {
  onAdd: (b: Omit<Block, "id">) => void;
  onClose: () => void;
  customFixtures?: CustomFixture[];
};

// SVG icons per kind
const KIND_ICONS: Record<BlockKind, React.ReactNode> = {
  standard: (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
      <rect
        x="2"
        y="4"
        width="16"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  divider: (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
      <line
        x1="2"
        y1="10"
        x2="18"
        y2="10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="2 2.5"
      />
      <circle cx="10" cy="10" r="2" fill="currentColor" />
    </svg>
  ),
  stairs: (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
      <path
        d="M2 16 H8 V11 H13 V7 H18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  room: (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6">
      <rect
        x="2.5"
        y="3.5"
        width="15"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="3 2.5"
      />
    </svg>
  ),
};

const KIND_PLACEHOLDERS: Record<BlockKind, string> = {
  standard: "e.g. Freezer, Rack, Counter…",
  divider: "e.g. Section Break, Zone Border…",
  stairs: "e.g. Main Stairs, Emergency Exit…",
  room: "e.g. Kitchen, Garage, Bedroom…",
};

// Structural entries — a plain coloured zone plus the room/divider/stairs kinds.
// These live in their own picker group rather than being top-level "types".
const STRUCTURAL: {
  key: string;
  label: string;
  kind: BlockKind;
  icon: React.ReactNode;
}[] = [
  { key: "plain", label: "Plain", kind: "standard", icon: KIND_ICONS.standard },
  { key: "room", label: "Room", kind: "room", icon: KIND_ICONS.room },
  { key: "divider", label: "Divider", kind: "divider", icon: KIND_ICONS.divider }, // prettier-ignore
  { key: "stairs", label: "Stairs", kind: "stairs", icon: KIND_ICONS.stairs },
];

export function AddBlockModal({ onAdd, onClose, customFixtures = [] }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [kind, setKind] = useState<BlockKind>("standard");
  const [fixture, setFixture] = useState<FixtureRef | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFixture | null>(null);
  const fixtureFetcher = useFetcher();
  const savingFixture = fixtureFetcher.state !== "idle";
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAdd = () => {
    if (!name.trim()) return;
    // Fixtures only apply to standard blocks; dividers/stairs stay plain.
    onAdd({
      name: name.trim(),
      color,
      kind,
      fixture: kind === "standard" ? fixture : null,
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-sm max-h-[90dvh] bg-white rounded-2xl shadow-2xl
                   flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800 tracking-tight">
            New block type
          </span>
          <CloseButton
            onClick={onClose}
            size={11}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          />
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          {/* Categorised picker — choose what the block represents. Fixtures are
              grouped by category; structural kinds (plain / room / divider /
              stairs) live in their own group instead of being top-level types. */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              What is it?
            </label>

            {FIXTURE_CATEGORIES.map((cat) => (
              <div key={cat.id} className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {cat.label}
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {FIXTURE_IDS.filter(
                    (f) => FIXTURE_META[f].category === cat.id,
                  ).map((f) => {
                    const active = kind === "standard" && fixture === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setKind("standard");
                          setFixture(f);
                          setColor(FIXTURE_META[f].defaultColor);
                          if (!name.trim()) setName(FIXTURE_META[f].label);
                        }}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 transition-all cursor-pointer ${
                          active
                            ? "border-gray-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="w-7 h-7 rounded overflow-hidden bg-gray-50">
                          <FixtureGraphic
                            fixture={f}
                            color={
                              active ? color : FIXTURE_META[f].defaultColor
                            }
                            cols={1}
                            rows={1}
                            className="w-full h-full"
                          />
                        </div>
                        <span
                          className="text-gray-600 text-center leading-tight"
                          style={{ fontSize: "10px" }}
                        >
                          {FIXTURE_META[f].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Custom — the user's own fixtures, plus a tile to create one */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Custom
              </span>
              <div className="grid grid-cols-4 gap-2">
                {customFixtures.map((cf) => {
                  const active = kind === "standard" && fixture === cf.id;
                  return (
                    <div key={cf.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          setKind("standard");
                          setFixture(cf.id);
                          setColor(cf.defaultColor);
                          if (!name.trim()) setName(cf.name);
                        }}
                        className={`w-full flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 transition-all cursor-pointer ${
                          active
                            ? "border-gray-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="w-7 h-7 rounded overflow-hidden bg-gray-50">
                          <FixtureGraphic
                            fixture={cf.id}
                            color={active ? color : cf.defaultColor}
                            cols={1}
                            rows={1}
                            className="w-full h-full"
                          />
                        </div>
                        <span
                          className="text-gray-600 text-center leading-tight truncate w-full"
                          style={{ fontSize: "10px" }}
                        >
                          {cf.name}
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Edit fixture"
                        onClick={() => {
                          setEditing(cf);
                          setEditorOpen(true);
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-white/90 border border-gray-200 text-gray-400 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:text-gray-700 text-[8px] leading-none"
                      >
                        ✎
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setEditorOpen(true);
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors"
                >
                  <span className="w-7 h-7 flex items-center justify-center text-lg leading-none">
                    +
                  </span>
                  <span style={{ fontSize: "10px" }}>New</span>
                </button>
              </div>
            </div>

            {/* Structural — plain zones + room / divider / stairs */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Structural
              </span>
              <div className="grid grid-cols-4 gap-2">
                {STRUCTURAL.map((s) => {
                  const active =
                    s.kind === "standard"
                      ? kind === "standard" && fixture === null
                      : kind === s.kind;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setKind(s.kind);
                        setFixture(null);
                      }}
                      style={active ? { borderColor: color, color } : {}}
                      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 transition-all cursor-pointer ${
                        active
                          ? ""
                          : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
                      }`}
                    >
                      <span className="flex h-7 w-7 items-center justify-center">
                        {s.icon}
                      </span>
                      <span
                        className="text-center leading-tight"
                        style={{ fontSize: "10px" }}
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Name
            </label>
            <input
              ref={inputRef}
              placeholder={KIND_PLACEHOLDERS[kind]}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
                         bg-gray-50 text-gray-800 placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-offset-0 transition"
              style={{ ["--tw-ring-color" as string]: `${color}66` }}
            />
          </div>

          {/* Colour */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Colour
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110
                              ${
                                color === c
                                  ? "ring-2 ring-offset-2 ring-current scale-110"
                                  : ""
                              }`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Custom colour"
                className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300
                           cursor-pointer bg-transparent overflow-hidden p-0
                           hover:border-gray-400 transition-colors"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Preview
            </label>

            {kind === "divider" ? (
              <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                <div
                  className="flex-1"
                  style={{ borderTop: `2px dashed ${color}`, opacity: 0.8 }}
                />
                <span
                  className="text-center text-xs font-medium"
                  style={{ color, opacity: 0.75 }}
                >
                  {name || "Divider"}
                </span>
              </div>
            ) : kind === "stairs" ? (
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                style={{ background: `${color}1a`, borderColor: color }}
              >
                <svg
                  viewBox="0 0 32 24"
                  fill="none"
                  className="w-8 h-6 shrink-0"
                  style={{ color }}
                >
                  <path
                    d="M2 22 H10 V15 H18 V9 H26 V2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm font-medium" style={{ color }}>
                  {name || "Stairs"}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
                style={{ background: `${color}1a`, borderColor: color }}
              >
                {fixture ? (
                  <div className="w-7 h-7 rounded overflow-hidden shrink-0 bg-white">
                    <FixtureGraphic
                      fixture={fixture}
                      color={color}
                      cols={1}
                      rows={1}
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                )}
                <span className="text-sm font-medium" style={{ color }}>
                  {name || "Block name"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-500
                       bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            style={name.trim() ? { background: color } : {}}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed
                       disabled:bg-gray-300 hover:brightness-110"
          >
            Add block
          </button>
        </div>
      </div>

      {editorOpen && (
        <CustomFixtureEditor
          initial={editing}
          busy={savingFixture}
          onClose={() => setEditorOpen(false)}
          onDelete={(id) => {
            fixtureFetcher.submit(
              { _action: "delete", id },
              {
                method: "post",
                action: "/api/fixtures",
                encType: "application/json",
              },
            );
            // If the deleted fixture was selected, fall back to plain.
            if (fixture === id) setFixture(null);
            setEditorOpen(false);
          }}
          onSave={(data) => {
            fixtureFetcher.submit(
              { _action: editing ? "update" : "create", ...data },
              {
                method: "post",
                action: "/api/fixtures",
                encType: "application/json",
              },
            );
            setEditorOpen(false);
          }}
        />
      )}
    </>
  );
}
