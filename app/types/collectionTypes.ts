export type CollectionKind = "packing" | "trade" | "custom";

export type CollectionItem = {
  id: string;
  collectionId: string;
  itemId: string | null; // links an owned item, or null for a free-text gap
  name: string;
  desiredQty: number;
  checked: boolean; // "packed" tick
  createdAt: Date | null;
};

export type Collection = {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  kind: CollectionKind;
  checkedOut: boolean;
  userId: string;
  createdAt: Date | null;
  items: CollectionItem[];
};
