import { supabase } from '@/utils/supabase';
import type { Tables } from '@/types/supabase.types';
import {
  mapItemTypeToCategory,
  toClothingItemType,
  type ClosetItem,
  type IDataService,
  type NewClosetItemInput,
  type Outfit,
  type OwnCloset,
  type StylistCloset,
} from './dataService.types';

// Generic placeholder shown when a live row has no photo yet - reuses the
// same stock image already used elsewhere in the app as a fallback.
const PLACEHOLDER_IMAGE = require('../../assets/images/clothes/outfit_preview.jpg');

const CLOTHING_ITEM_PHOTO_BUCKET = 'clothing_item_photos';

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(uri);
  return match ? match[1].toLowerCase() : 'jpg';
}

function contentTypeFromExtension(extension: string): string {
  if (extension === 'png') return 'image/png';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

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

type StylistClosetRow = {
  closets: Pick<Tables<'closets'>, 'id' | 'closet_name'> | null;
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
  async getClosetItems(closetId?: string): Promise<ClosetItem[]> {
    let query = supabase.from('clothing_items').select(CLOSET_ITEM_SELECT);
    if (closetId) query = query.eq('closet_id', closetId);

    const { data, error } = await query.returns<ClosetItemQueryRow[]>();
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

  async createClosetItem(input: NewClosetItemInput): Promise<ClosetItem> {
    if (!input.photos.some(photo => photo.isPrimary)) {
      throw new Error('At least one photo must be marked as primary.');
    }

    const { data: itemRow, error: itemError } = await supabase
      .from('clothing_items')
      .insert({
        closet_id: input.closetId,
        item_type: input.itemType,
        name: input.name,
        description: input.description,
        fit_notes: input.fitNotes,
        care_instructions: input.careInstructions,
        brand: input.brand,
      })
      .select('id')
      .single();
    if (itemError) throw itemError;

    const itemId = itemRow.id;
    const uploadedPaths: string[] = [];

    try {
      for (const photo of input.photos) {
        const response = await fetch(photo.uri);
        const arrayBuffer = await response.arrayBuffer();
        const extension = extensionFromUri(photo.uri);
        const path = `${itemId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(CLOTHING_ITEM_PHOTO_BUCKET)
          .upload(path, arrayBuffer, { contentType: contentTypeFromExtension(extension) });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);

        const { data: publicUrlData } = supabase.storage.from(CLOTHING_ITEM_PHOTO_BUCKET).getPublicUrl(path);

        const { error: photoError } = await supabase.from('clothing_item_photos').insert({
          clothing_item_id: itemId,
          image_url: publicUrlData.publicUrl,
          is_primary: photo.isPrimary,
        });
        if (photoError) throw photoError;
      }
    } catch (err) {
      // Best-effort cleanup so a failed upload doesn't leave an orphaned,
      // photo-less item or dangling storage objects behind.
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(CLOTHING_ITEM_PHOTO_BUCKET).remove(uploadedPaths);
      }
      await supabase.from('clothing_items').delete().eq('id', itemId);
      throw err;
    }

    const created = await this.getClosetItemById(itemId);
    if (!created) throw new Error('Failed to load the newly created item.');
    return created;
  }

  async getOutfits(closetId?: string): Promise<Outfit[]> {
    let query = supabase.from('outfits').select(OUTFIT_SELECT);
    if (closetId) query = query.eq('closet_id', closetId);

    const { data, error } = await query.returns<OutfitQueryRow[]>();
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

  async getStylistClosets(userId: string): Promise<StylistCloset[]> {
    const { data, error } = await supabase
      .from('closet_collaborators')
      .select('closets(id, closet_name)')
      .eq('user_id', userId)
      .returns<StylistClosetRow[]>();
    if (error) throw error;

    return data
      .filter((row): row is StylistClosetRow & { closets: NonNullable<StylistClosetRow['closets']> } =>
        row.closets !== null,
      )
      .map(row => ({ closet_id: row.closets.id, closet_name: row.closets.closet_name }));
  }

  async getOwnCloset(userId: string): Promise<OwnCloset | null> {
    const { data, error } = await supabase
      .from('closets')
      .select('id, closet_name, pass_phrase')
      .eq('owner_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? { closet_id: data.id, closet_name: data.closet_name, pass_phrase: data.pass_phrase } : null;
  }

  async createOwnCloset(userId: string, closetName: string): Promise<OwnCloset> {
    // pass_phrase is intentionally omitted - the column default generates a
    // random one, since a user-chosen phrase would be far more guessable
    // and can collide with the column's unique constraint.
    const { data, error } = await supabase
      .from('closets')
      .insert({ owner_id: userId, closet_name: closetName })
      .select('id, closet_name, pass_phrase')
      .single();
    if (error) throw error;
    return { closet_id: data.id, closet_name: data.closet_name, pass_phrase: data.pass_phrase };
  }

  async regeneratePassphrase(closetId: string): Promise<string> {
    const { data, error } = await supabase.rpc('regenerate_closet_passphrase', {
      target_closet_id: closetId,
    });
    if (error) throw error;
    return data;
  }
}

export const supabaseService: IDataService = new SupabaseDataService();
