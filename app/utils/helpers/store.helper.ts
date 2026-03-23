import type { BlocksMap, CreateStoreInput } from "~/types/storeViewFinderTypes";

export function blocksToBlocksMap(blocks: CreateStoreInput["blocks"]): BlocksMap {
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
      },
    ]),
  );
}