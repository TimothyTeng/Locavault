// The interactive block-picker UI was replaced by the DrawToolbar in the
// floor-plan editor. Only the `Block` type is still consumed (by
// storeViewFinder + its helper), so this module is now a thin type re-export.
export { type Block } from "#types/BlockTypes";
