import { useRef, useEffect, useState, useCallback } from "react";
import { AddBlockModal } from "./AddBlockModal";
import { DEFAULT_BLOCKS, type Block } from "#types/BlockTypes";

interface DrawToolbarProps {
  selectedBlock: Block;
  onSelectionChange: (block: Block) => void;
  onBlocksChange?: (blocks: Block[]) => void;
}

// ── Colour helpers ────────────────────────────────────────
// Convert a hex colour to its perceived luminance (0–1).
function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// For dark colours we lighten them so text + border remain readable on slate-800.
function readableColor(hex: string): string {
  if (luminance(hex) >= 0.08) return hex; // light enough as-is
  // Blend toward white by ~60% to lift dark colours
  const raw = hex.replace("#", "");
  const blend = (ch: string, target: number) =>
    Math.round(parseInt(ch, 16) + (target - parseInt(ch, 16)) * 0.6)
      .toString(16)
      .padStart(2, "0");
  return `#${blend(raw.slice(0, 2), 255)}${blend(raw.slice(2, 4), 255)}${blend(raw.slice(4, 6), 255)}`;
}

// ── Nav arrow button ──────────────────────────────────────
function NavArrow({
  direction,
  onClick,
  disabled,
}: {
  direction: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        {direction === "left" ? (
          <path
            d="M6.5 1.5L3 5l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M3.5 1.5L7 5l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────

export function DrawToolbar({
  selectedBlock,
  onSelectionChange,
  onBlocksChange,
}: DrawToolbarProps) {
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS);
  const [modalOpen, setModalOpen] = useState(false);
  const [showFadeLeft, setShowFadeLeft] = useState(false);
  const [showFadeRight, setShowFadeRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef(blocks);
  const selectedBlockRef = useRef(selectedBlock);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);
  useEffect(() => {
    selectedBlockRef.current = selectedBlock;
  }, [selectedBlock]);

  const selectedIndex = blocks.findIndex((b) => b.id === selectedBlock.id);

  // ── Scroll fades ──────────────────────────────────────────

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowFadeLeft(el.scrollLeft > 4);
    setShowFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    el?.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);
    return () => {
      el?.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, [blocks, updateFades]);

  // Redirect vertical wheel delta → horizontal so a normal mouse wheel
  // or vertical trackpad swipe scrolls the pill row naturally.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already horizontal — let it pass
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: "auto" });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Scroll selected pill into view whenever it changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pill = el.querySelector<HTMLButtonElement>(
      `[data-id="${selectedBlock.id}"]`,
    );
    pill?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedBlock.id]);

  // ── Arrow key navigation ──────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (modalOpen) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const current = blocksRef.current;
      const idx = current.findIndex(
        (b) => b.id === selectedBlockRef.current.id,
      );
      if (e.key === "ArrowLeft" && idx > 0) {
        onSelectionChange(current[idx - 1]);
      } else if (e.key === "ArrowRight" && idx < current.length - 1) {
        onSelectionChange(current[idx + 1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalOpen, onSelectionChange]);

  // ── Nav arrow scroll ─────────────────────────────────────
  // Pages by the full visible width so each click shows a completely new set.

  const scrollToPill = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === "left" ? -el.clientWidth : el.clientWidth,
      behavior: "smooth",
    });
  };

  // ── Block handlers ────────────────────────────────────────

  const handleAdd = (data: Omit<Block, "id">) => {
    const next = [...blocks, { ...data, id: crypto.randomUUID() }];
    setBlocks(next);
    onBlocksChange?.(next);
    // Auto-select the newly added block
    onSelectionChange(next[next.length - 1]);
  };

  const handleRemove = (id: string) => {
    if (id.startsWith("default-")) return;
    const next = blocks.filter((b) => b.id !== id);
    if (selectedBlock.id === id) onSelectionChange(next[0]);
    setBlocks(next);
    onBlocksChange?.(next);
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="shrink-0 bg-slate-800 border-b border-slate-700 flex items-center gap-1.5 px-2 h-10">
      {/* Mode dot */}
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />

      {/* Left nav arrow */}
      <NavArrow
        direction="left"
        onClick={() => scrollToPill("left")}
        disabled={!showFadeLeft}
      />

      {/* Pill scroller */}
      <div className="relative flex-1 min-w-0">
        {showFadeLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-5 bg-gradient-to-r from-slate-800 to-transparent pointer-events-none z-10" />
        )}

        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {blocks.map((block, i) => {
            const isSelected = block.id === selectedBlock.id;
            const isDefault = block.id.startsWith("default-");
            const displayColor = readableColor(block.color);

            return (
              <div key={block.id} className="relative group shrink-0">
                <button
                  data-id={block.id}
                  onClick={() => onSelectionChange(block)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all"
                  style={{
                    background: isSelected
                      ? `${displayColor}22`
                      : "transparent",
                    color: isSelected ? displayColor : "#94a3b8",
                    border: `1px solid ${isSelected ? displayColor : "transparent"}`,
                    boxShadow: isSelected
                      ? `0 0 0 1px ${displayColor}44`
                      : "none",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 ring-1"
                    style={{
                      background: block.color, // always the real colour
                      borderColor: `${displayColor}66`,
                    }}
                  />
                  {block.name}
                </button>

                {/* Remove × — custom blocks only, on hover */}
                {!isDefault && (
                  <button
                    onClick={() => handleRemove(block.id)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-600 text-slate-300 hidden group-hover:flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors z-20"
                    title="Remove block type"
                  >
                    <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
                      <path
                        d="M1 1l6 6M7 1L1 7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {showFadeRight && (
          <div className="absolute right-0 top-0 bottom-0 w-5 bg-gradient-to-l from-slate-800 to-transparent pointer-events-none z-10" />
        )}
      </div>

      {/* Right nav arrow */}
      <NavArrow
        direction="right"
        onClick={() => scrollToPill("right")}
        disabled={!showFadeRight}
      />

      {/* Add button */}
      <button
        onClick={() => setModalOpen(true)}
        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-600 hover:border-slate-500 transition-all"
      >
        <svg width="8" height="8" viewBox="0 0 11 11" fill="none">
          <path
            d="M5.5 1v9M1 5.5h9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        Add
      </button>

      {modalOpen && (
        <AddBlockModal onAdd={handleAdd} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
