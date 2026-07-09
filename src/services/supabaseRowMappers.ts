import type { Tables } from '@/types/supabase.types';
import { mapItemTypeToCategory, toClothingItemType, type ClosetItem, type Outfit } from './dataService.types';

/**
 * Generic placeholder shown when a live row has no photo yet - reuses the
 * same stock image already used elsewhere in the app as a fallback.
 */
export const PLACEHOLDER_IMAGE = require('../../assets/images/clothes/outfit_preview.jpg');

type ClothingItemPhotoRow = Pick<Tables<'clothing_item_photos'>, 'image_url' | 'is_primary'>;
export type ClosetItemQueryRow = Tables<'clothing_items'> & {
  clothing_item_photos: ClothingItemPhotoRow[];
};

type OutfitItemRow = Pick<Tables<'outfit_items'>, 'clothing_item_id'>;
type OutfitPhotoRow = Pick<Tables<'outfit_photos'>, 'image_url' | 'created_at'>;
export type OutfitQueryRow = Tables<'outfits'> & {
  outfit_items: OutfitItemRow[];
  outfit_photos: OutfitPhotoRow[];
};

/** `.select()` fragment for a clothing item plus enough photo data to resolve its primary image. */
export const CLOSET_ITEM_SELECT = '*, clothing_item_photos(image_url, is_primary)';

/** `.select()` fragment for an outfit plus enough join data to resolve its item ids and preview image. */
export const OUTFIT_SELECT = '*, outfit_items(clothing_item_id), outfit_photos(image_url, created_at)';

/** Maps a `clothing_items` row (+ joined photos) to the app-facing `ClosetItem` shape. */
export function mapClosetItemRow(row: ClosetItemQueryRow): ClosetItem {
  const primaryPhoto =
    row.clothing_item_photos.find(photo => photo.is_primary) ?? row.clothing_item_photos[0];
  const itemType = toClothingItemType(row.item_type);

  return {
    item_id: row.id,
    closet_id: row.closet_id,
    item_type: itemType,
    category: mapItemTypeToCategory(itemType),
    name: row.name,
    description: row.description,
    brand: row.brand,
    fit_notes: row.fit_notes,
    care_instructions: row.care_instructions,
    purchase_url: row.purchase_url,
    img: primaryPhoto?.image_url ?? PLACEHOLDER_IMAGE,
    secondary_photos: row.clothing_item_photos
      .filter(photo => photo !== primaryPhoto)
      .map(photo => photo.image_url),
    created_at: row.created_at,
  };
}

/**
 * Maps an `outfits` row (+ joined items and photos) to the app-facing `Outfit`
 * shape. The preview image is the earliest-uploaded photo, so an outfit's
 * thumbnail stays stable as newer photos are added.
 */
export function mapOutfitRow(row: OutfitQueryRow): Outfit {
  const earliestPhoto = [...row.outfit_photos].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )[0];

  return {
    outfit_id: row.id,
    closet_id: row.closet_id,
    name: row.name,
    description: row.description,
    labels: row.labels,
    item_ids: row.outfit_items.map(outfitItem => outfitItem.clothing_item_id),
    compliment_count: row.compliment_count,
    outfit_img_preview: { img: earliestPhoto?.image_url ?? PLACEHOLDER_IMAGE },
    created_at: row.created_at,
  };
}
