import type { ItemType } from "./itemTypeTypes";

export type PurchaseOrderItem = {
  id: string;
  itemId: string | null;
  storeId: string;
  name: string;
  quantity: number;
  blockId: string | null;
  description: string | null;
  sku: string | null;
  unit: string | null;
  minQuantity: number | null;
  cost: number | null; // cents
  expiryDate: Date | null;
  useRate: number | null;
  useRatePeriod: "day" | "week" | "month" | null;
  /** Mirrors the item's type so a confirmed guess flows through on buy. */
  itemType: ItemType;
  /** Free-text pack size from a barcode (e.g. "500 g"); display-only. */
  packageSize: string | null;
  createdAt: Date | null;
  createdBy: string | null;
};
