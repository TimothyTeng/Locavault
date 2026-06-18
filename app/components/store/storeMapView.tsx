import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { Plus, Minus, X } from "lucide-react";
import type { Item, ItemStatus } from "~/types/storeTypes";
import type { BlocksMap, BlockState } from "~/types/storeViewFinderTypes";
import {
  getItemStatus,
  itemRunoutDays,
} from "~/utils/helpers/storeTable.helper";
import { FixtureGraphic } from "~/lib/fixtures";
import { GridRuler } from "~/components/addstore/storeViewFinder/GridRuler";
import { useProductImage } from "~/utils/useProductImage";
import { TypeIcon } from "./typeIcon";
import { ItemDetailPopup } from "./ItemDetailPopup";

/**
 * The store as a **map-first, game-like inventory screen** (DESIGN.md §4).
 *
 * The floor plan fills the whole surface. Shelves are richly rendered tiles that
 * glow when their contents need attention (amber = expiring food, red = out/low).
 * Clicking a shelf "opens" it — a floating panel expands the item names, and
 * clicking an item drills into its full detail. Search highlights where an item
 * lives. Everything else (table/cards) lives behind the Inventory toggle.
 *
 * Rendered independently of the editor's `GridCanvas` so we can upgrade the
 * graphics freely without touching the floor-plan builder.
 */

type ZoneStat = {
  total: number;
  out: number;
  low: number;
  expiring: number;
  worst: ItemStatus | null;
};

const SEVERITY: Record<ItemStatus, number> = {
  out: 3,
  low: 2,
  expiring: 1,
  ok: 0,
};

const DOT: Record<ItemStatus, string> = {
  out: "#94a3b8",
  low: "#ef4444",
  expiring: "#f59e0b",
  ok: "#34d399",
};

type Props = {
  blocks: BlocksMap;
  cols: number;
  rows: number;
  items: Item[];
  canEdit: boolean;
  isOwner: boolean;
  storeIsPublic: boolean;
  /** Search-jump target — opens & pulses this zone's panel. */
  pulseZoneId?: string | null;
  /** Item to flag inside the opened panel after a search jump. */
  pulseItemId?: string | null;
  onSaveItem: (updated: Item) => void;
  onDeleteItem: (itemId: string) => void;
  onMarkOut?: (item: Item) => void;
  onAddToList?: (item: Item) => void;
  onToggleVisibility: (itemId: string, isPublic: boolean) => void;
  /** Open the add-item panel pre-targeted to a zone (null = no zone). */
  onAddItemToZone: (blockId: string | null) => void;
};

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

export function StoreMapView({
  blocks,
  cols,
  rows,
  items,
  canEdit,
  isOwner,
  storeIsPublic,
  pulseZoneId,
  pulseItemId,
  onSaveItem,
  onDeleteItem,
  onMarkOut,
  onAddToList,
  onToggleVisibility,
  onAddItemToZone,
}: Props) {
  const { ref, size } = useElementSize();
  const [zoom, setZoom] = useState(1);
  const [openZoneId, setOpenZoneId] = useState<string | null>(null);
  const [unassignedOpen, setUnassignedOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | null>(null);
  // "Plain blocks" view preference (flat coloured blocks, no fixtures).
  const [plain, setPlain] = useState(false);
  useEffect(() => {
    try {
      setPlain(localStorage.getItem("lv-map-plain") === "1");
    } catch {}
  }, []);
  const togglePlain = () =>
    setPlain((p) => {
      const next = !p;
      try {
        localStorage.setItem("lv-map-plain", next ? "1" : "0");
      } catch {}
      return next;
    });
  // A1/B3 coordinate guides around the map.
  const [showRuler, setShowRuler] = useState(true);
  useEffect(() => {
    try {
      setShowRuler(localStorage.getItem("lv-map-ruler") !== "0");
    } catch {}
  }, []);
  const toggleRuler = () =>
    setShowRuler((r) => {
      const next = !r;
      try {
        localStorage.setItem("lv-map-ruler", next ? "1" : "0");
      } catch {}
      return next;
    });
  const RULER = 18;
  // Zoom-to-room: which room to scroll into view after a (possible) zoom change.
  const [focusRoomId, setFocusRoomId] = useState<string | null>(null);
  // Drag-to-place: the item being dragged + the shelf currently hovered.
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverZoneId, setDragOverZoneId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const animatedRef = useRef(false);

  // ── Per-zone aggregates: how many items, and the worst status (drives glow) ──
  const zoneStats = useMemo(() => {
    const map: Record<string, ZoneStat> = {};
    for (const it of items) {
      if (!it.blockId) continue;
      const s = getItemStatus(it);
      const z =
        map[it.blockId] ??
        (map[it.blockId] = {
          total: 0,
          out: 0,
          low: 0,
          expiring: 0,
          worst: null,
        });
      z.total += 1;
      if (s === "out") z.out += 1;
      else if (s === "low") z.low += 1;
      else if (s === "expiring") z.expiring += 1;
      if (!z.worst || SEVERITY[s] > SEVERITY[z.worst]) z.worst = s;
    }
    return map;
  }, [items]);

  const itemsByZone = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const it of items) {
      if (!it.blockId) continue;
      (map[it.blockId] ??= []).push(it);
    }
    return map;
  }, [items]);

  const unassigned = useMemo(() => items.filter((i) => !i.blockId), [items]);

  // Rooms are a passive grouping layer (kind "room") — used for zoom-to-room.
  const rooms = useMemo(
    () =>
      Object.entries(blocks)
        .filter(([, b]) => b.kind === "room")
        .map(([id, b]) => ({ id, ...b })),
    [blocks],
  );

  // Move an item onto a shelf (or off the map). Persisted via onSaveItem.
  const placeItem = (itemId: string, blockId: string | null) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.blockId === blockId) return;
    onSaveItem({ ...item, blockId });
  };

  // ── Geometry: fit the grid to the surface, then apply manual zoom on top ──
  const baseCell =
    size.w > 0 && size.h > 0
      ? Math.max(8, Math.min((size.w - 32) / cols, (size.h - 32) / rows))
      : 0;
  const cell = baseCell * zoom;
  const contentW = cell * cols;
  const contentH = cell * rows;

  // Zoom the view so a room fills most of the viewport, then scroll to it.
  const zoomToRoom = (room: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }) => {
    if (baseCell > 0 && size.w > 0 && size.h > 0) {
      const fit = Math.min(
        (size.w * 0.85) / (room.w * baseCell),
        (size.h * 0.85) / (room.h * baseCell),
      );
      setZoom(Math.max(0.6, Math.min(2.5, +fit.toFixed(2))));
    }
    setFocusRoomId(room.id);
  };

  // After a zoom-to-room (and the resulting re-layout), scroll it into view.
  useEffect(() => {
    if (!focusRoomId) return;
    const el = boardRef.current?.querySelector(
      `[data-room-id="${focusRoomId}"]`,
    );
    el?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }, [focusRoomId, cell]);

  // ── Entrance: shelves rise & fade in with a stagger (once, on first paint) ──
  useEffect(() => {
    if (animatedRef.current || cell <= 0 || !boardRef.current) return;
    const tiles = boardRef.current.querySelectorAll(".lv-tile");
    if (!tiles.length) return;
    animatedRef.current = true;
    gsap.from(tiles, {
      opacity: 0,
      scale: 0.9,
      y: 10,
      duration: 0.45,
      ease: "power3.out",
      stagger: { each: 0.025, from: "center" },
    });
  }, [cell]);

  // ── Search-jump: open the targeted zone's panel ──
  useEffect(() => {
    if (pulseZoneId) {
      setOpenZoneId(pulseZoneId);
      setUnassignedOpen(false);
    }
  }, [pulseZoneId, pulseItemId]);

  // ── Close the open panel on outside click ──
  useEffect(() => {
    if (!openZoneId && !unassignedOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpenZoneId(null);
        setUnassignedOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openZoneId, unassignedOpen]);

  const openBlock = openZoneId ? blocks[openZoneId] : null;
  const openItems = openZoneId ? (itemsByZone[openZoneId] ?? []) : [];

  return (
    <div
      className="relative flex-1 min-h-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 120% at 50% 0%, #f1f5f9 0%, #e7ecf3 55%, #dfe5ee 100%)",
      }}
    >
      {/* Tiled-floor grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(110% 90% at 50% 40%, #000 55%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(110% 90% at 50% 40%, #000 55%, transparent 100%)",
        }}
      />
      {/* Ambient vignette for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 70% at 50% 35%, transparent 55%, rgba(15,23,42,0.12) 100%)",
        }}
      />

      {/* Scrollable board */}
      <div ref={ref} className="absolute inset-0 overflow-auto">
        {cell > 0 && (
          <div
            className="relative mx-auto my-4"
            style={{
              width: contentW + (showRuler ? RULER : 0),
              height: contentH + (showRuler ? RULER : 0),
            }}
          >
            {showRuler && <GridRuler cols={cols} rows={rows} size={RULER} />}
            <div
              ref={boardRef}
              className="absolute"
              style={{
                left: showRuler ? RULER : 0,
                top: showRuler ? RULER : 0,
                width: contentW,
                height: contentH,
              }}
            >
              {/* Room regions — passive grouping layer, behind tiles */}
              {rooms.map((r) => (
                <div
                  key={r.id}
                  data-room-id={r.id}
                  className="absolute rounded-md pointer-events-none"
                  style={{
                    left: r.x * cell,
                    top: r.y * cell,
                    width: r.w * cell,
                    height: r.h * cell,
                    background: `${r.border}0e`,
                    border: `1.5px dashed ${r.border}59`,
                  }}
                >
                  <span
                    className="absolute left-1 top-1 rounded bg-white/80 px-1 font-mono uppercase tracking-wide leading-none"
                    style={{ fontSize: 9, color: r.border, paddingBlock: 1 }}
                  >
                    {r.label}
                  </span>
                </div>
              ))}

              {Object.entries(blocks).map(([bid, b]) => {
                if (b.kind === "room") return null;
                const placeable = b.kind !== "divider" && b.kind !== "stairs";
                return (
                  <BlockTile
                    key={bid}
                    block={b}
                    cell={cell}
                    stat={zoneStats[bid]}
                    sampleItems={itemsByZone[bid] ?? []}
                    active={openZoneId === bid}
                    plain={plain}
                    dragging={!!dragItemId && placeable}
                    dropActive={dragOverZoneId === bid}
                    onClick={() => {
                      if (!placeable) return;
                      setUnassignedOpen(false);
                      setOpenZoneId((cur) => (cur === bid ? null : bid));
                    }}
                    onDragEnter={
                      placeable ? () => setDragOverZoneId(bid) : undefined
                    }
                    onDragLeave={
                      placeable
                        ? () =>
                            setDragOverZoneId((cur) =>
                              cur === bid ? null : cur,
                            )
                        : undefined
                    }
                    onDropItem={
                      placeable
                        ? (itemId) => {
                            placeItem(itemId, bid);
                            setDragOverZoneId(null);
                            setDragItemId(null);
                            setOpenZoneId(bid);
                          }
                        : undefined
                    }
                  />
                );
              })}

              {/* ── Expanded shelf panel (anchored to the block) ── */}
              {openBlock && (
                <ZonePanel
                  ref={panelRef}
                  block={openBlock}
                  cell={cell}
                  contentW={contentW}
                  contentH={contentH}
                  items={openItems}
                  flagItemId={pulseItemId ?? null}
                  canEdit={canEdit}
                  onAddHere={() => onAddItemToZone(openZoneId)}
                  onPickItem={(it) => setDetailItem(it)}
                  onClose={() => setOpenZoneId(null)}
                  onItemDragStart={(id) => setDragItemId(id)}
                  onItemDragEnd={() => {
                    setDragItemId(null);
                    setDragOverZoneId(null);
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Unassigned items rail (so block-less items stay reachable) ── */}
      {unassigned.length > 0 && (
        <div className="absolute bottom-4 left-4 z-20">
          <button
            onClick={() => {
              setOpenZoneId(null);
              setUnassignedOpen((v) => !v);
            }}
            className={`flex items-center gap-1.5 rounded-lg border bg-white/95 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-sm backdrop-blur transition-colors ${
              unassignedOpen
                ? "border-slate-400 text-slate-700"
                : "border-slate-200 text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            {unassigned.length} unplaced
          </button>
          {unassignedOpen && (
            <div
              ref={panelRef}
              className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Not on the map
                </span>
                {canEdit && (
                  <button
                    onClick={() => onAddItemToZone(null)}
                    className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700"
                  >
                    + Add
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-auto py-1">
                {unassigned.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    flagged={false}
                    onClick={() => setDetailItem(it)}
                    draggable={canEdit}
                    onDragStart={() => setDragItemId(it.id)}
                    onDragEnd={() => {
                      setDragItemId(null);
                      setDragOverZoneId(null);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Floating map tools ── */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleRuler}
            title={
              showRuler ? "Hide coordinate guides" : "Show coordinate guides"
            }
            className={`rounded-lg border bg-white/95 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-sm backdrop-blur transition-colors ${
              showRuler
                ? "border-slate-400 text-slate-700"
                : "border-slate-200 text-slate-500 hover:text-slate-700"
            }`}
          >
            A1
          </button>
          <button
            onClick={togglePlain}
            title={plain ? "Show furniture fixtures" : "Show plain blocks"}
            className="rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 shadow-sm backdrop-blur transition-colors hover:text-slate-700"
          >
            {plain ? "Plain" : "Detailed"}
          </button>
        </div>
        {canEdit && (
          <button
            onClick={() => onAddItemToZone(null)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg hover:bg-slate-700 transition-colors"
          >
            <Plus size={12} strokeWidth={2.4} />
            Add item
          </button>
        )}
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <ZoomBtn
            onClick={() =>
              setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))
            }
            label="Zoom out"
          >
            <Minus size={13} />
          </ZoomBtn>
          <button
            onClick={() => setZoom(1)}
            className="px-2 text-[9px] font-mono font-bold tabular-nums text-slate-500 hover:text-slate-800"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ZoomBtn
            onClick={() =>
              setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))
            }
            label="Zoom in"
          >
            <Plus size={13} />
          </ZoomBtn>
        </div>
      </div>

      {/* ── Drag hint ── */}
      {dragItemId && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 shadow-sm">
          Drop on a shelf to place it
        </div>
      )}

      {/* ── Room selector (zoom into a room) ── */}
      {rooms.length > 0 && (
        <div className="absolute top-3 left-3 z-20 flex max-w-[55%] items-center gap-1.5 overflow-x-auto rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur">
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-slate-300">
            Rooms
          </span>
          <button
            onClick={() => {
              setFocusRoomId(null);
              setZoom(1);
            }}
            className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-mono text-slate-500 hover:bg-slate-100"
          >
            All
          </button>
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => zoomToRoom(r)}
              title={`Zoom to ${r.label || "room"}`}
              className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-mono transition-all hover:brightness-95"
              style={{ color: r.border, background: `${r.border}14` }}
            >
              {r.label || "Room"}
            </button>
          ))}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-3 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
        <LegendDot color="#f59e0b" label="Expiring" />
        <LegendDot color="#ef4444" label="Low / out" />
        <LegendDot color="#34d399" label="Stocked" />
      </div>

      {detailItem && (
        <ItemDetailPopup
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onSave={(u) => {
            onSaveItem(u);
            setDetailItem(null);
          }}
          onDelete={(id) => {
            onDeleteItem(id);
            setDetailItem(null);
          }}
          onMarkOut={
            onMarkOut
              ? (i) => {
                  onMarkOut(i);
                  setDetailItem(null);
                }
              : undefined
          }
          onAddToList={
            onAddToList
              ? (i) => {
                  onAddToList(i);
                  setDetailItem(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

// ── A single shelf / structural tile ──────────────────────────────────────
function BlockTile({
  block,
  cell,
  stat,
  sampleItems,
  active,
  plain,
  dragging,
  dropActive,
  onClick,
  onDragEnter,
  onDragLeave,
  onDropItem,
}: {
  block: BlockState;
  cell: number;
  stat?: ZoneStat;
  sampleItems: Item[];
  active: boolean;
  plain: boolean;
  dragging: boolean;
  dropActive: boolean;
  onClick: () => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onDropItem?: (itemId: string) => void;
}) {
  const left = block.x * cell;
  const top = block.y * cell;
  const w = block.w * cell;
  const h = block.h * cell;

  // Dividers render as a thin bar — a wall *between* blocks, not a solid cell.
  if (block.kind === "divider") {
    const horizontal = block.w >= block.h;
    return (
      <div
        className="lv-tile absolute"
        style={{ left, top, width: w, height: h }}
        title={block.label}
      >
        <div
          className="absolute rounded-[2px]"
          style={
            horizontal
              ? {
                  left: 0,
                  right: 0,
                  top: "33%",
                  height: "34%",
                  background: block.border,
                }
              : {
                  top: 0,
                  bottom: 0,
                  left: "33%",
                  width: "34%",
                  background: block.border,
                }
          }
        />
      </div>
    );
  }
  if (block.kind === "stairs") {
    return (
      <div
        className="lv-tile absolute flex items-center justify-center rounded-sm border"
        style={{
          left,
          top,
          width: w,
          height: h,
          background: block.bg,
          borderColor: block.border,
        }}
        title={block.label || "Stairs"}
      >
        <span
          className="px-1 text-center font-mono font-semibold uppercase tracking-wide leading-tight"
          style={{
            fontSize: Math.max(7, Math.min(cell * 0.15, 10)),
            color: block.border,
          }}
        >
          {block.label || "Stairs"}
        </span>
      </div>
    );
  }

  const worst = stat?.worst ?? null;
  const glow =
    worst === "out" || worst === "low"
      ? "#ef4444"
      : worst === "expiring"
        ? "#f59e0b"
        : null;

  const attention = (stat?.out ?? 0) + (stat?.low ?? 0) + (stat?.expiring ?? 0);

  // Flat fill + thin border, matching the floor-plan editor. Status reads as a
  // simple colored ring — calm baseline, no glossy depth.
  const ringColor = dropActive
    ? "#10b981"
    : (glow ?? (active ? block.border : dragging ? "#6ee7b7" : null));
  const boxShadow = ringColor ? `0 0 0 2px ${ringColor}` : undefined;

  return (
    <button
      onClick={onClick}
      onDragOver={
        onDropItem
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={
        onDropItem
          ? (e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) onDropItem(id);
            }
          : undefined
      }
      className={`lv-tile group absolute flex items-center justify-center overflow-hidden rounded-sm text-center transition-[filter] hover:brightness-95 focus:outline-none ${
        dropActive ? "scale-[1.03]" : ""
      }`}
      style={{
        left,
        top,
        width: w,
        height: h,
        background: block.bg,
        border: `1.5px solid ${dropActive ? "#10b981" : block.border}`,
        boxShadow,
      }}
    >
      {block.fixture && !plain && (
        <FixtureGraphic
          fixture={block.fixture}
          color={block.border}
          cols={block.w}
          rows={block.h}
          className="absolute inset-0 pointer-events-none"
        />
      )}
      {/* attention badge */}
      {attention > 0 && (
        <span
          className="absolute right-1 top-1 z-10 inline-flex items-center gap-0.5 rounded-full bg-white px-1 py-px shadow-sm"
          style={{ border: `1px solid ${glow ?? "#e2e8f0"}` }}
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: glow ?? "#94a3b8" }}
          />
          <span
            className="font-mono font-bold leading-none"
            style={{ fontSize: 8, color: glow ?? "#64748b" }}
          >
            {attention}
          </span>
        </span>
      )}

      {/* item glyph stack (bottom-left) */}
      {w > 46 && h > 42 && sampleItems.length > 0 && (
        <div className="absolute bottom-1 left-1 right-1 z-10 flex flex-wrap items-end gap-0.5">
          {sampleItems.slice(0, 6).map((it) => (
            <GlyphChip key={it.id} item={it} />
          ))}
          {sampleItems.length > 6 && (
            <span className="text-[8px] font-mono font-bold text-slate-500">
              +{sampleItems.length - 6}
            </span>
          )}
        </div>
      )}

      {/* centered label (editor style) */}
      <span
        className="px-1 text-center font-mono font-semibold uppercase tracking-wide leading-tight break-words"
        style={{
          fontSize: Math.max(7, Math.min(cell * 0.16, 11)),
          color: block.border,
        }}
      >
        {block.label || "Shelf"}
      </span>
    </button>
  );
}

// ── A tiny item chip on a shelf (product photo, else type glyph) ──
function GlyphChip({ item }: { item: Item }) {
  const photo = useProductImage(item);
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded-[3px] bg-white/75 shadow-sm"
      style={{ width: 15, height: 15 }}
      title={item.name}
    >
      {photo ? (
        <img
          src={photo}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <TypeIcon type={item.itemType} className="h-2.5 w-2.5 text-slate-500" />
      )}
    </span>
  );
}

// ── The "opened shelf" panel — expands item names like a game inventory ────
const ZonePanel = ({
  ref,
  block,
  cell,
  contentW,
  contentH,
  items,
  flagItemId,
  canEdit,
  onAddHere,
  onPickItem,
  onClose,
  onItemDragStart,
  onItemDragEnd,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  block: BlockState;
  cell: number;
  contentW: number;
  contentH: number;
  items: Item[];
  flagItemId: string | null;
  canEdit: boolean;
  onAddHere: () => void;
  onPickItem: (item: Item) => void;
  onClose: () => void;
  onItemDragStart?: (id: string) => void;
  onItemDragEnd?: () => void;
}) => {
  const PW = 244;
  const blockLeft = block.x * cell;
  const blockTop = block.y * cell;
  const blockRight = blockLeft + block.w * cell;

  // Prefer right of the block; flip left if it would overflow.
  let left = blockRight + 10;
  if (left + PW > contentW) left = blockLeft - PW - 10;
  if (left < 0) left = Math.min(blockLeft, contentW - PW - 4);
  left = Math.max(4, left);
  const top = Math.max(4, Math.min(blockTop, contentH - 240));

  return (
    <div
      ref={ref}
      className="absolute z-30 w-[244px] rounded-xl border border-slate-200 bg-white shadow-2xl"
      style={{ left, top }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-bold text-slate-800">
            {block.label || "Shelf"}
          </div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-slate-300">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              onClick={onAddHere}
              title="Add an item to this shelf"
              className="rounded-md bg-slate-900 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-slate-700"
            >
              + Add
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-auto py-1">
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] font-mono text-slate-300">
            Empty shelf
          </div>
        ) : (
          items.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              flagged={it.id === flagItemId}
              onClick={() => onPickItem(it)}
              draggable={canEdit}
              onDragStart={() => onItemDragStart?.(it.id)}
              onDragEnd={() => onItemDragEnd?.()}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ── A single item row inside a panel ───────────────────────────────────────
function ItemRow({
  item,
  flagged,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  item: Item;
  flagged: boolean;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const status = getItemStatus(item);
  const runout = itemRunoutDays(item);
  const isPrior = item.usage?.source === "prior";
  const photo = useProductImage(item);
  return (
    <button
      onClick={onClick}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData("text/plain", item.id);
              e.dataTransfer.effectAllowed = "move";
              onDragStart?.();
            }
          : undefined
      }
      onDragEnd={draggable ? () => onDragEnd?.() : undefined}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-slate-50 ${
        flagged ? "bg-emerald-50" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {draggable && (
        <span className="shrink-0 text-slate-300" aria-hidden>
          <svg width="7" height="11" viewBox="0 0 7 11" fill="currentColor">
            <circle cx="1.5" cy="1.5" r="1.2" />
            <circle cx="5.5" cy="1.5" r="1.2" />
            <circle cx="1.5" cy="5.5" r="1.2" />
            <circle cx="5.5" cy="5.5" r="1.2" />
            <circle cx="1.5" cy="9.5" r="1.2" />
            <circle cx="5.5" cy="9.5" r="1.2" />
          </svg>
        </span>
      )}
      {photo ? (
        <img
          src={photo}
          alt={item.name}
          loading="lazy"
          className="h-5 w-5 shrink-0 rounded object-cover border border-slate-200 bg-white"
        />
      ) : (
        <TypeIcon
          type={item.itemType}
          className="h-3.5 w-3.5 shrink-0 text-slate-400"
        />
      )}
      <span className="flex-1 truncate text-[11px] font-semibold text-slate-800">
        {item.name}
      </span>
      {item.checkedOut && (
        <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-700">
          Out
        </span>
      )}
      {runout != null && (
        <span
          className={`font-mono text-[9px] tabular-nums ${
            isPrior
              ? "text-slate-300"
              : runout <= 7
                ? "text-red-500"
                : "text-slate-400"
          }`}
        >
          {isPrior ? "~" : ""}
          {runout}d
        </span>
      )}
      <span className="font-mono text-[10px] tabular-nums text-slate-500">
        {item.quantity}
        {item.unit ? ` ${item.unit}` : ""}
      </span>
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: DOT[status] }}
      />
    </button>
  );
}

function ZoomBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
    >
      {children}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-slate-400">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
