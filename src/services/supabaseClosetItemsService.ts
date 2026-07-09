import { supabase } from '@/utils/supabase';
import type { ClosetItem, NewClosetItemInput } from './dataService.types';
import { removeClosetItemPhotoObjects, uploadClosetItemPhoto } from './supabasePhotoStorage';
import { CLOSET_ITEM_SELECT, mapClosetItemRow, type ClosetItemQueryRow } from './supabaseRowMappers';

/** All clothing items, optionally scoped to one closet. Throws the Supabase error on failure. */
export async function getClosetItems(closetId?: string): Promise<ClosetItem[]> {
  let query = supabase.from('clothing_items').select(CLOSET_ITEM_SELECT);
  if (closetId) query = query.eq('closet_id', closetId);

  const { data, error } = await query.returns<ClosetItemQueryRow[]>();
  if (error) throw error;
  return data.map(mapClosetItemRow);
}

/** A single clothing item by id, or `null` if no row matches. Throws the Supabase error on failure. */
export async function getClosetItemById(itemId: string): Promise<ClosetItem | null> {
  const { data, error } = await supabase
    .from('clothing_items')
    .select(CLOSET_ITEM_SELECT)
    .eq('id', itemId)
    .returns<ClosetItemQueryRow[]>()
    .maybeSingle();
  if (error) throw error;
  return data ? mapClosetItemRow(data) : null;
}

/**
 * Creates a clothing item row, then uploads its photos and links each to the
 * new item. Requires exactly one photo marked primary (enforced up front, so
 * a bad form submission never reaches the database).
 *
 * If any photo fails to upload, this rolls back: previously-uploaded storage
 * objects and the newly-created item row are removed, then the original
 * error is rethrown, so a failed submission never leaves a photo-less item
 * or an orphaned storage object behind.
 */
export async function createClosetItem(input: NewClosetItemInput): Promise<ClosetItem> {
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
      const { path } = await uploadClosetItemPhoto(itemId, photo);
      uploadedPaths.push(path);
    }
  } catch (err) {
    await removeClosetItemPhotoObjects(uploadedPaths);
    await supabase.from('clothing_items').delete().eq('id', itemId);
    throw err;
  }

  const created = await getClosetItemById(itemId);
  if (!created) throw new Error('Failed to load the newly created item.');
  return created;
}
