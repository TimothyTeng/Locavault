import type { BlockDetails } from "./storeViewFinderTypes";

export type StoreWithDetails = {
  id: string;
  name: string;
  tags: string;
  description: string | null;
  rows: number;
  cols: number;
  userId: string;
  createdAt: Date | null;
  blocks: BlockDetails[];
  itemCount: number;
  pinned?: boolean;
  role?: "owner" | "editor" | "viewer"; // undefined = owned (legacy), set for member stores
};

export type SortOption = "name" | "created";
export type SortDir = "asc" | "desc";