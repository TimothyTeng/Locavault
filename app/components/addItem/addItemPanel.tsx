import { AddItemForm } from "#components/addItem/addItemForm";
import type { ItemType } from "~/lib/itemTypes";
import type { Item } from "~/types/storeTypes";
import type { BlocksMap } from "~/types/storeViewFinderTypes";
import { SidePanel } from "~/components/common/SidePanel";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    quantity: number;
    selectedBlockId?: string | null;
    itemType: ItemType;
    sku?: string | null;
    unit?: string | null;
    minQuantity?: number | null;
    cost?: number | null;
    expiryDate?: Date | null;
    useRate?: number | null;
    useRatePeriod?: "day" | "week" | "month" | null;
  }) => void;
  /** Restock an existing item instead of adding a duplicate. */
  onRestock?: (itemId: string, qty: number) => void;
  categories?: { id: string; label: string }[];
  selectedBlockId?: string | null;
  selectedBlockLabel?: string;
  /** Store context for smart capture (name → type/unit/block + restock match). */
  items?: Item[];
  blocks?: BlocksMap;
  typeHints?: Record<string, ItemType>;
  crowdHints?: Record<string, ItemType>;
  isMobile?: boolean;
};

export function AddItemPanel({
  isOpen,
  onClose,
  onSubmit,
  onRestock,
  categories,
  selectedBlockId,
  selectedBlockLabel,
  items = [],
  blocks = {},
  typeHints = {},
  crowdHints = {},
  isMobile = false,
}: Props) {
  // On mobile the panel slides down from the top so the zone-picker minimap
  // stays visible in the bottom half; on desktop it's a wide right-edge overlay
  // (opened from the toolbar, above the rail).
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      isMobile={isMobile}
      mobileVariant="sheet"
      desktopVariant="overlay"
      ariaLabel="Add Item"
      title="Add Item"
      bodyClassName="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6"
    >
      <AddItemForm
        onSubmit={onSubmit}
        onRestock={onRestock}
        categories={categories}
        selectedBlockId={selectedBlockId}
        selectedBlockLabel={selectedBlockLabel}
        items={items}
        blocks={blocks}
        typeHints={typeHints}
        crowdHints={crowdHints}
      />
    </SidePanel>
  );
}
