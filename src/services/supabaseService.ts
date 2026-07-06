import { supabase } from '@/utils/supabase';
import type { Tables } from '@/types/supabase.types';
import {
  mapItemTypeToCategory,
  toClothingItemType,
  type ClosetItem,
  type IDataService,
  type Outfit,
} from './dataService.types';

// Generic placeholder shown when a live row has no photo yet - reuses the
// same stock image already used elsewhere in the app as a fallback.
const PLACEHOLDER_IMAGE = require('../../assets/images/clothes/outfit_preview.jpg');

type ClothingItemPhotoRow = Pick<Tables<'clothing_item_photos'>, 'image_url' | 'is_primary'>;
type ClosetItemQueryRow = Tables<'clothing_items'> & {
  clothing_item_photos: ClothingItemPhotoRow[];
};

type OutfitItemRow = Pick<Tables<'outfit_items'>, 'clothing_item_id'>;
type OutfitPhotoRow = Pick<Tables<'outfit_photos'>, 'image_url' | 'created_at'>;
type OutfitQueryRow = Tables<'outfits'> & {
  outfit_items: OutfitItemRow[];
  outfit_photos: OutfitPhotoRow[];
};

const CLOSET_ITEM_SELECT = '*, clothing_item_photos(image_url, is_primary)';
const OUTFIT_SELECT = '*, outfit_items(clothing_item_id), outfit_photos(image_url, created_at)';

function mapClosetItemRow(row: ClosetItemQueryRow): ClosetItem {
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
    created_at: row.created_at,
  };
}

function mapOutfitRow(row: OutfitQueryRow): Outfit {
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

class SupabaseDataService implements IDataService {
  async getClosetItems(): Promise<ClosetItem[]> {
    const { data, error } = await supabase
      .from('clothing_items')
      .select(CLOSET_ITEM_SELECT)
      .returns<ClosetItemQueryRow[]>();
    if (error) throw error;
    return data.map(mapClosetItemRow);
  }

  async getClosetItemById(itemId: string): Promise<ClosetItem | null> {
    const { data, error } = await supabase
      .from('clothing_items')
      .select(CLOSET_ITEM_SELECT)
      .eq('id', itemId)
      .returns<ClosetItemQueryRow[]>()
      .maybeSingle();
    if (error) throw error;
    return data ? mapClosetItemRow(data) : null;
  }

  async getOutfits(): Promise<Outfit[]> {
    const { data, error } = await supabase
      .from('outfits')
      .select(OUTFIT_SELECT)
      .returns<OutfitQueryRow[]>();
    if (error) throw error;
    return data.map(mapOutfitRow);
  }

  async getOutfitById(outfitId: string): Promise<Outfit | null> {
    const { data, error } = await supabase
      .from('outfits')
      .select(OUTFIT_SELECT)
      .eq('id', outfitId)
      .returns<OutfitQueryRow[]>()
      .maybeSingle();
    if (error) throw error;
    return data ? mapOutfitRow(data) : null;
  }
}

export const supabaseService: IDataService = new SupabaseDataService();
