import { useEffect, useRef, useState } from "react";
import { CloseButton } from "~/components/common/CloseButton";
import { PRESET_COLORS } from "#types/BlockTypes";
import { customShapeStyle, FIXTURE_CATEGORIES } from "#lib/fixtures";
import type { FixtureCategory } from "#types/fixtureTypes";
import {
  FIXTURE_BOX,
  SHAPE_TONES,
  type CustomFixture,
  type CustomShape,
  type ShapeTone,
} from "#types/customFixtureTypes";

const BOX = FIXTURE_BOX; // 0–100 design box on both axes
const MIN = 6; // min shape size
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const snap = (v: number) => Math.round(v); // 1-unit grid

// Editor-local shape: a CustomShape plus a transient id for selection / z-order.
type EShape = CustomShape & { _id: number };

const STARTER: Omit<EShape, "_id">[] = [
  { type: "rect", x: 6, y: 6, w: 88, h: 88, tone: "body" },
];

const NEW_DIMS: Record<CustomShape["type"], [number, number]> = {
  rect: [30, 22],
  bar: [44, 8],
  circle: [24, 24],
};

type Props = {
  initial?: CustomFixture | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    name: string;
    category: FixtureCategory;
    defaultColor: string;
    shapes: CustomShape[];
  }) => void;
  onDelete?: (id: string) => void;
};

export function CustomFixtureEditor({
  initial,
  busy,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<FixtureCategory>(
    initial?.category ?? "object",
  );
  const [color, setColor] = useState(initial?.defaultColor ?? PRESET_COLORS[0]);
  const idRef = useRef(0);
  const [shapes, setShapes] = useState<EShape[]>(() =>
    (initial?.shapes ?? STARTER).map((s) => ({ ...s, _id: idRef.current++ })),
  );
  const [sel, setSel] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    id: number;
    ox: number;
    oy: number;
    orig: EShape;
  } | null>(null);

  const add = (type: CustomShape["type"]) => {
    const [w, h] = NEW_DIMS[type];
    const _id = idRef.current++;
    setShapes((prev) => [
      ...prev,
      { _id, type, x: (BOX - w) / 2, y: (BOX - h) / 2, w, h, tone: "body" },
    ]);
    setSel(_id);
  };

  const patchSel = (patch: Partial<EShape>) =>
    setShapes((prev) =>
      prev.map((s) => (s._id === sel ? { ...s, ...patch } : s)),
    );
  const removeSel = () => {
    setShapes((prev) => prev.filter((s) => s._id !== sel));
    setSel(null);
  };
  const reorder = (dir: -1 | 1) =>
    setShapes((prev) => {
      const i = prev.findIndex((s) => s._id === sel);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const duplicateSel = () =>
    setShapes((prev) => {
      const s = prev.find((x) => x._id === sel);
      if (!s) return prev;
      const _id = idRef.current++;
      const copy = {
        ...s,
        _id,
        x: clamp(s.x + 4, 0, BOX - s.w),
        y: clamp(s.y + 4, 0, BOX - s.h),
      };
      setSel(_id);
      return [...prev, copy];
    });

  const toLocal = (e: PointerEvent | React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * BOX,
      y: ((e.clientY - r.top) / r.height) * BOX,
    };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    const handle = target.getAttribute("data-handle");
    const id = target.getAttribute("data-id");
    const l = toLocal(e);
    if (handle && sel !== null) {
      const orig = shapes.find((s) => s._id === sel);
      if (orig)
        dragRef.current = { mode: "resize", id: sel, ox: l.x, oy: l.y, orig };
      e.preventDefault();
      return;
    }
    if (id !== null) {
      const nid = Number(id);
      const orig = shapes.find((s) => s._id === nid)!;
      setSel(nid);
      dragRef.current = { mode: "move", id: nid, ox: l.x, oy: l.y, orig };
      e.preventDefault();
      return;
    }
    setSel(null);
  };

  // Window-level move/up so a drag continues outside the SVG bounds.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const l = toLocal(e);
      const dx = l.x - d.ox,
        dy = l.y - d.oy;
      setShapes((prev) =>
        prev.map((s) => {
          if (s._id !== d.id) return s;
          if (d.mode === "move")
            return {
              ...s,
              x: snap(clamp(d.orig.x + dx, 0, BOX - s.w)),
              y: snap(clamp(d.orig.y + dy, 0, BOX - s.h)),
            };
          return {
            ...s,
            w: snap(clamp(d.orig.w + dx, MIN, BOX - d.orig.x)),
            h: snap(clamp(d.orig.h + dy, MIN, BOX - d.orig.y)),
          };
        }),
      );
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  // Delete / Escape shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel !== null) {
        e.preventDefault();
        removeSel();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const selShape = shapes.find((s) => s._id === sel) ?? null;

  const handleSave = () => {
    if (!name.trim() || !shapes.length) return;
    onSave({
      id: initial?.id,
      name: name.trim(),
      category,
      defaultColor: color,
      // strip the transient editor id
      shapes: shapes.map(({ _id: _drop, ...s }) => s),
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Custom fixture editor"
        className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   w-full max-w-md max-h-[92dvh] bg-white rounded-2xl shadow-2xl
                   flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800">
            {initial ? "Edit fixture" : "New custom fixture"}
          </span>
          <CloseButton
            onClick={onClose}
            size={11}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          />
        </div>

        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
          {/* Add-shape toolbar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Add
            </span>
            {(["rect", "bar", "circle"] as const).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => add(tp)}
                className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors capitalize"
              >
                {tp === "rect" ? "▭ Rect" : tp === "bar" ? "▬ Bar" : "● Circle"}
              </button>
            ))}
          </div>

          {/* Canvas */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${BOX} ${BOX}`}
            className="w-full rounded-xl border border-gray-200 bg-[#f6f7f9] touch-none select-none"
            style={{ aspectRatio: "1 / 1" }}
            onPointerDown={onPointerDown}
          >
            {/* frame guide */}
            <rect
              x="1"
              y="1"
              width={BOX - 2}
              height={BOX - 2}
              rx="3"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
            {shapes.map((s) => {
              const st = customShapeStyle(s.tone, color);
              if (s.type === "circle")
                return (
                  <ellipse
                    key={s._id}
                    data-id={s._id}
                    cx={s.x + s.w / 2}
                    cy={s.y + s.h / 2}
                    rx={s.w / 2}
                    ry={s.h / 2}
                    fill={st.fill}
                    fillOpacity={st.fillOpacity}
                    stroke={st.stroke}
                    strokeWidth={1.4}
                    style={{ cursor: "move" }}
                  />
                );
              return (
                <rect
                  key={s._id}
                  data-id={s._id}
                  x={s.x}
                  y={s.y}
                  width={s.w}
                  height={s.h}
                  rx={
                    s.type === "bar"
                      ? Math.min(s.w, s.h) / 2
                      : Math.min(s.w, s.h) * 0.08
                  }
                  fill={st.fill}
                  fillOpacity={st.fillOpacity}
                  stroke={st.stroke}
                  strokeWidth={1.4}
                  style={{ cursor: "move" }}
                />
              );
            })}
            {selShape && (
              <>
                <rect
                  x={selShape.x}
                  y={selShape.y}
                  width={selShape.w}
                  height={selShape.h}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="0.7"
                  strokeDasharray="2 1.5"
                  style={{ pointerEvents: "none" }}
                />
                <rect
                  data-handle="se"
                  x={selShape.x + selShape.w - 2.4}
                  y={selShape.y + selShape.h - 2.4}
                  width="4.8"
                  height="4.8"
                  rx="1"
                  fill="#0ea5e9"
                  style={{ cursor: "nwse-resize" }}
                />
              </>
            )}
          </svg>

          {/* Selected-shape controls */}
          {selShape ? (
            <div className="flex items-center flex-wrap gap-1.5 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-1">
                Fill
              </span>
              {SHAPE_TONES.map((tn: ShapeTone) => (
                <button
                  key={tn}
                  type="button"
                  onClick={() => patchSel({ tone: tn })}
                  className={`px-2 py-0.5 rounded-md text-[10.5px] capitalize transition-colors ${
                    selShape.tone === tn
                      ? "bg-sky-500 text-white"
                      : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {tn}
                </button>
              ))}
              <span className="w-px h-4 bg-gray-200 mx-0.5" />
              <button
                type="button"
                title="Send back"
                onClick={() => reorder(-1)}
                className="w-6 h-6 rounded-md border border-gray-200 text-gray-500 hover:bg-white text-xs"
              >
                ↓
              </button>
              <button
                type="button"
                title="Bring forward"
                onClick={() => reorder(1)}
                className="w-6 h-6 rounded-md border border-gray-200 text-gray-500 hover:bg-white text-xs"
              >
                ↑
              </button>
              <button
                type="button"
                title="Duplicate"
                onClick={duplicateSel}
                className="w-6 h-6 rounded-md border border-gray-200 text-gray-500 hover:bg-white text-xs"
              >
                ⧉
              </button>
              <button
                type="button"
                onClick={removeSel}
                className="ml-auto px-2 py-0.5 rounded-md border border-rose-200 text-rose-500 text-[10.5px] hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 px-1">
              Click a shape to select; drag the body to move, the blue corner to
              resize. Add shapes above.
            </p>
          )}

          {/* Name + category */}
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fixture name"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FixtureCategory)}
              className="px-2 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-700 focus:outline-none"
            >
              {FIXTURE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Colour */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Colour
            </span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                  color === c ? "ring-2 ring-offset-1 ring-gray-400" : ""
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3.5 border-t border-gray-100">
          {initial && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(initial.id)}
              className="px-3 py-2 rounded-lg text-sm font-medium text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !shapes.length || busy}
            style={name.trim() && shapes.length ? { background: color } : {}}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-300 hover:brightness-110"
          >
            {busy ? "Saving…" : initial ? "Save changes" : "Create fixture"}
          </button>
        </div>
      </div>
    </>
  );
}
