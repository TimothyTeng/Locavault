import type { BlockKind } from "./BlockTypes";
import type { FixtureId } from "./fixtureTypes";

/** Single source of truth for a block — position, size, appearance, and kind */
export type BlockState = {
  x: number;
  y: number;
  w: number;
  h: number;
  bg: string;
  border: string;
  label: string;
  kind: BlockKind;
  /** Optional furniture fixture (shelf/fridge/…); null/undefined = plain block. */
  fixture?: FixtureId | null;
};

/** Keyed map of all blocks in the editor: blockId → BlockState */
export type BlocksMap = Record<string, BlockState>;

// ── DB serialisation / API boundaries ─────────────────────

export type BlockStyle = { bg: string; border: string; label: string };

export type BlockDetails = {
  block_id: string;
  background: string;
  border: string;
  label: string;
  height: number;
  width: number;
  x: number;
  y: number;
  kind: BlockKind;
  fixture?: FixtureId | null;
};

export type CreateStoreInput = {
  id: string;
  name: string;
  userId: string;
  tags?: string;
  description?: string;
  rows: number;
  cols: number;
  blocks: BlockDetails[];
  // Phase 3
  isPublic?: boolean;
  canvasVisible?: boolean;
};
