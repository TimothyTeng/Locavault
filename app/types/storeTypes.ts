export type Item = {
  id: string;
  name: string;
  quantity: number;
  description: string | null;
  storeId: string;
  blockId: string | null;
  createdAt: Date | null;
  isPublic: boolean;
  // Extended fields
  sku: string | null;
  unit: string | null;
  minQuantity: number | null;
  cost: number | null;             // cents
  expiryDate: Date | null;
  useRate: number | null;
  useRatePeriod: "day" | "week" | "month" | null;
};

export type ItemStatus = "out" | "low" | "expiring" | "ok";