/**
 * Lets outfit create/delete flows signal that the outfits list is stale,
 * without forcing a refetch every time the outfits tab merely regains focus
 * (e.g. after viewing an outfit's detail page and navigating back).
 */
let dirty = false;

export function markOutfitsDirty() {
  dirty = true;
}

export function consumeOutfitsDirty(): boolean {
  if (!dirty) return false;
  dirty = false;
  return true;
}
