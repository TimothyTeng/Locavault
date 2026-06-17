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

/** A cross-store item that needs attention (out / low / expiring / predicted). */
export type AttentionItem = {
  id: string;
  name: string;
  itemType: import("./itemTypeTypes").ItemType;
  quantity: number;
  unit: string | null;
  storeId: string;
  storeName: string;
  zoneLabel: string | null;
  status: import("./storeTypes").ItemStatus;
  runoutDays: number | null;
  expiryDays: number | null;
  /** Already on a shopping list. */
  onList: boolean;
  /** Whether the current user can add it to this store's list. */
  canAdd: boolean;
};
