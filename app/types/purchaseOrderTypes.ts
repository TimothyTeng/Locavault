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
  createdAt: Date | null;
  createdBy: string | null;
};
