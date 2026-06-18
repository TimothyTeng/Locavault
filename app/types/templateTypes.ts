import type { BlockDetails } from "./storeViewFinderTypes";
import type { Wall } from "./wallTypes";

export type TemplateWithBlocks = {
  id: string;
  name: string;
  description: string | null;
  tags: string; // JSON string array
  rows: number;
  cols: number;
  userId: string; // creator (Clerk id)
  isPublic: boolean;
  usageCount: number;
  createdAt: Date | null;
  blocks: BlockDetails[];
  walls: Wall[];
};
