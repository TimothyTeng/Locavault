export const PRESET_COLORS = [
  "#2d6b44", "#3d8a58", "#1f4d30",
  "#b8821e", "#d4a244", "#f97316",
  "#1e2520", "#3a4a3f", "#6d7d72",
  "#4a90b8", "#8b5cf6", "#ef4444",
];

// ─── Block kinds ──────────────────────────────────────────────────────────────

export type BlockKind = "standard" | "divider" | "stairs";

export const BLOCK_KIND_META: Record<
  BlockKind,
  { label: string; description: string }
> = {
  standard: {
    label: "Standard",
    description: "A regular named area or zone",
  },
  divider: {
    label: "Divider",
    description: "A line that separates sections",
  },
  stairs: {
    label: "Stairs",
    description: "A stepped transition between levels",
  },
};

// ─── Block types ──────────────────────────────────────────────────────────────

interface BlockBase {
  id:    string;
  name:  string;
  color: string;
}

export interface StandardBlock extends BlockBase {
  kind: "standard";
}

export interface DividerBlock extends BlockBase {
  kind: "divider";
}

export interface StairsBlock extends BlockBase {
  kind: "stairs";
}

export type Block = StandardBlock | DividerBlock | StairsBlock;

// ─── Default blocks ───────────────────────────────────────────────────────────

export const DEFAULT_BLOCKS: Block[] = [
  { id: "default-door",    name: "Door",    color: "#3d8a58", kind: "divider" },
  { id: "default-shelf",   name: "Shelf",   color: "#2d6b44", kind: "standard" },
  { id: "default-cabinet", name: "Cabinet", color: "#b8821e", kind: "standard" },
  { id: "default-wall",    name: "Wall",    color: "#1e2520", kind: "divider" },
];