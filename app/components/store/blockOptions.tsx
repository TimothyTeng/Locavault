import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * A block a user can assign an item to (a labelled standard shelf), plus a
 * resolver for turning any block id into its display label. Shared via context
 * so the item-detail popup can show a real location and offer a re-assign
 * dropdown without every intermediate component threading blocks down.
 */
export type BlockOption = { id: string; label: string };

type BlockOptionsValue = {
  /** Assignable shelves for the location dropdown. */
  options: BlockOption[];
  /** Human label for a block id, or null if unknown/unlabelled. */
  labelOf: (id: string | null | undefined) => string | null;
};

const BlockOptionsContext = createContext<BlockOptionsValue>({
  options: [],
  labelOf: () => null,
});

export function BlockOptionsProvider({
  options,
  labels,
  children,
}: {
  options: BlockOption[];
  /** id → label for *all* blocks (labelled or not), used for display. */
  labels: Record<string, string>;
  children: ReactNode;
}) {
  const value = useMemo<BlockOptionsValue>(
    () => ({
      options,
      labelOf: (id) => {
        if (!id) return null;
        const label = labels[id];
        return label && label.trim() ? label : null;
      },
    }),
    [options, labels],
  );
  return (
    <BlockOptionsContext.Provider value={value}>
      {children}
    </BlockOptionsContext.Provider>
  );
}

export function useBlockOptions(): BlockOptionsValue {
  return useContext(BlockOptionsContext);
}
