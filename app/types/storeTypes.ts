export type Item = {
  id: string;
  name: string;
  quantity: number;
  description: string | null;
  storeId: string;
  blockId: string | null;
  createdAt: Date | null;
  isPublic: boolean;
};