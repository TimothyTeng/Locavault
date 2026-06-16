import type { ItemType } from "./itemTypeTypes";

export type TradeOfferStatus = "pending" | "accepted" | "declined" | "cancelled";

/** An item put up on the global Bazaar, with just enough of its store context. */
export type TradeListing = {
  itemId: string;
  name: string;
  quantity: number;
  unit: string | null;
  itemType: ItemType;
  sku: string | null;
  tradeNote: string | null;
  storeId: string;
  storeName: string;
  storeIsPublic: boolean;
  ownerUserId: string;
};

export type TradeOffer = {
  id: string;
  listingItemId: string | null;
  listingStoreId: string | null;
  listingName: string;
  offeredItemId: string | null;
  offeredName: string | null;
  fromUserId: string;
  toUserId: string;
  message: string | null;
  status: TradeOfferStatus;
  createdAt: Date | null;
};
