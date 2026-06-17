import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAuth } from "~/lib/auth";
import {
  getTradeListings,
  getTradeOffersForUser,
  getStoresByUser,
  getItemsByStores,
  getItemById,
  getItemOwnerContext,
  setItemForTrade,
  createTradeOffer,
  getTradeOfferById,
  setTradeOfferStatus,
  acceptTradeOffer,
} from "~/lib/queries";
import type { TradeOfferStatus } from "~/types/tradeTypes";
import { optText } from "~/utils/helpers/validate.helper";
import { toActionResult } from "~/utils/loaders/actionResult";

// ── Loader ─────────────────────────────────────────────────

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await requireAuth(args);

  const [listings, offers, myStores] = await Promise.all([
    getTradeListings(),
    getTradeOffersForUser(userId),
    getStoresByUser(userId),
  ]);

  const storeName = new Map(myStores.map((s) => [s.id, s.name]));
  const myItemsRaw = await getItemsByStores(myStores.map((s) => s.id));

  // Light shape for the "list one of my items" picker.
  const myItems = myItemsRaw.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    itemType: i.itemType,
    storeId: i.storeId,
    storeName: storeName.get(i.storeId) ?? "",
    forTrade: i.forTrade ?? false,
    tradeNote: i.tradeNote ?? null,
  }));

  return {
    userId,
    bazaar: listings.filter((l) => l.ownerUserId !== userId),
    myListings: listings.filter((l) => l.ownerUserId === userId),
    offers,
    myItems,
  };
};

// ── Action ─────────────────────────────────────────────────

const runTradeAction = async (args: ActionFunctionArgs) => {
  const { request } = args;
  const userId = await requireAuth(args);
  const data = await request.json();

  // List / unlist one of MY items on the Bazaar.
  if (data._action === "listForTrade") {
    const ctx = await getItemOwnerContext(data.itemId);
    if (!ctx || ctx.ownerUserId !== userId)
      throw new Response("Forbidden", { status: 403 });
    await setItemForTrade(
      data.itemId,
      !!data.forTrade,
      optText(data.tradeNote, 280),
    );
    return { ok: true };
  }

  // Propose a trade on someone else's listing.
  if (data._action === "makeOffer") {
    const ctx = await getItemOwnerContext(data.listingItemId);
    if (!ctx) throw new Response("Listing not found", { status: 404 });
    if (ctx.ownerUserId === userId)
      throw new Response("Cannot offer on your own listing", { status: 400 });

    const listing = await getItemById(data.listingItemId);
    if (!listing || !listing.forTrade)
      throw new Response("Listing unavailable", { status: 409 });

    let offeredName: string | null = null;
    if (data.offeredItemId) {
      const offered = await getItemOwnerContext(data.offeredItemId);
      if (!offered || offered.ownerUserId !== userId)
        throw new Response("Forbidden", { status: 403 });
      const offeredItem = await getItemById(data.offeredItemId);
      offeredName = offeredItem?.name ?? null;
    }

    await createTradeOffer({
      listingItemId: data.listingItemId,
      listingStoreId: ctx.storeId,
      listingName: listing.name,
      offeredItemId: data.offeredItemId ?? null,
      offeredName,
      fromUserId: userId,
      toUserId: ctx.ownerUserId,
      message: optText(data.message, 500),
    });
    return { ok: true };
  }

  // Respond to an offer: accept/decline (owner) or cancel (requester).
  if (data._action === "respondOffer") {
    const offer = await getTradeOfferById(data.id);
    if (!offer) throw new Response("Offer not found", { status: 404 });
    const status = data.status as TradeOfferStatus;

    if (status === "accepted" || status === "declined") {
      if (offer.toUserId !== userId)
        throw new Response("Forbidden", { status: 403 });
    } else if (status === "cancelled") {
      if (offer.fromUserId !== userId)
        throw new Response("Forbidden", { status: 403 });
    } else {
      return { ok: false };
    }

    if (status === "accepted") await acceptTradeOffer(data.id);
    else await setTradeOfferStatus(data.id, status);
    return { ok: true };
  }

  return { ok: false };
};

export const action = (args: ActionFunctionArgs) =>
  toActionResult(runTradeAction(args));
