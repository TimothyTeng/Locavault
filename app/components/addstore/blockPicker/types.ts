export interface Block {
  id:    string;
  name:  string;
  color: string;
}

export const DEFAULT_BLOCKS: Block[] = [
  { id: "default-door",    name: "Door",    color: "#3d8a58" },
  { id: "default-shelf",   name: "Shelf",   color: "#2d6b44" },
  { id: "default-cabinet", name: "Cabinet", color: "#b8821e" },
  { id: "default-wall",    name: "Wall",    color: "#1e2520" },
];

export const PRESET_COLORS = [
  "#2d6b44", "#3d8a58", "#1f4d30",
  "#b8821e", "#d4a244", "#f97316",
  "#1e2520", "#3a4a3f", "#6d7d72",
  "#4a90b8", "#8b5cf6", "#ef4444",
];