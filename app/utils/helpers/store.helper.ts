import type { BlocksMap, CreateStoreInput } from "~/types/storeViewFinderTypes";

export function blocksToBlocksMap(
  blocks: CreateStoreInput["blocks"],
): BlocksMap {
  return Object.fromEntries(
    blocks.map((block) => [
      block.block_id,
      {
        x: block.x,
        y: block.y,
        w: block.width,
        h: block.height,
        bg: block.background,
        border: block.border,
        label: block.label,
        kind: block.kind ?? "standard",
        fixture: block.fixture ?? null,
      },
    ]),
  );
}

export const runOutDays = (
  useRate: string,
  useRatePeriod: "day" | "week" | "month",
  quantity: number,
) => {
  const rate = Number(useRate);
  if (!rate || rate <= 0 || quantity <= 0) return null;
  const periodDays =
    useRatePeriod === "day" ? 1 : useRatePeriod === "week" ? 7 : 30;
  const daily = rate / periodDays;
  if (!daily) return null;
  return Math.floor(quantity / daily);
};

/**
 * Days until an item runs out, measured from *now* using the current quantity.
 * `runOutDays` already returns "days of stock left at the given rate", so the
 * remaining days from today is exactly that — the old version anchored the
 * run-out date to `createdAt`, which wrongly drove long-lived items to 0.
 * (`_createdAt` kept for call-site compatibility.)
 */
export const remainingDays = (
  _createdAt: Date | null,
  useRate: string,
  useRatePeriod: "day" | "week" | "month",
  quantity: number,
) => {
  const daysToRunOut = runOutDays(useRate, useRatePeriod, quantity);
  if (daysToRunOut === null) return null;
  return daysToRunOut >= 0 ? daysToRunOut : 0;
};

export const expiryDateRemainingDays = (expiryDate: Date | null) => {
  if (!expiryDate) return null;
  const today = new Date();
  const msDiff = expiryDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
  return daysRemaining >= 0 ? daysRemaining : 0;
};
