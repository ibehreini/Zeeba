import { supabase } from '@/utils/supabase';
import type { NewOutfitInput, Outfit, OutfitPhoto, UpdateOutfitInput } from './dataService.types';
import { deleteOutfitPhotoObject, uploadOutfitPhoto } from './supabasePhotoStorage';
import { mapOutfitRow, OUTFIT_SELECT, type OutfitQueryRow } from './supabaseRowMappers';

/** All outfits, optionally scoped to one closet. Throws the Supabase error on failure. */
export async function getOutfits(closetId?: string): Promise<Outfit[]> {
  let query = supabase.from('outfits').select(OUTFIT_SELECT);
  if (closetId) query = query.eq('closet_id', closetId);

  const { data, error } = await query.returns<OutfitQueryRow[]>();
  if (error) throw error;
  return data.map(mapOutfitRow);
}

/** A single outfit by id, or `null` if no row matches. Throws the Supabase error on failure. */
export async function getOutfitById(outfitId: string): Promise<Outfit | null> {
  const { data, error } = await supabase
    .from('outfits')
    .select(OUTFIT_SELECT)
    .eq('id', outfitId)
    .returns<OutfitQueryRow[]>()
    .maybeSingle();
  if (error) throw error;
  return data ? mapOutfitRow(data) : null;
}

/**
 * Creates an outfit row, then links each picked closet item via the
 * outfit_items join table. If linking the items fails, the outfit row is
 * rolled back so a failed submission never leaves an empty, orphaned outfit
 * behind - same rollback approach as createClosetItem's photo upload.
 */
export async function createOutfit(input: NewOutfitInput): Promise<Outfit> {
  const { data: outfitRow, error: outfitError } = await supabase
    .from('outfits')
    .insert({
      closet_id: input.closetId,
      created_by_user_id: input.userId,
      name: input.name,
      description: input.description,
      labels: [input.label],
    })
    .select('id')
    .single();
  if (outfitError) throw outfitError;

  const outfitId = outfitRow.id;

  if (input.itemIds.length > 0) {
    const { error: itemsError } = await supabase
      .from('outfit_items')
      .insert(input.itemIds.map(itemId => ({ outfit_id: outfitId, clothing_item_id: itemId })));
    if (itemsError) {
      await supabase.from('outfits').delete().eq('id', outfitId);
      throw itemsError;
    }
  }

  const created = await getOutfitById(outfitId);
  if (!created) throw new Error('Failed to load the newly created outfit.');
  return created;
}

/** Updates an outfit's name and description. Throws the Supabase error on failure. */
export async function updateOutfit(outfitId: string, input: UpdateOutfitInput): Promise<Outfit> {
  const { error } = await supabase
    .from('outfits')
    .update({ name: input.name, description: input.description })
    .eq('id', outfitId);
  if (error) throw error;

  const updated = await getOutfitById(outfitId);
  if (!updated) throw new Error('Failed to load the updated outfit.');
  return updated;
}

/**
 * Deletes an outfit row. Its outfit_items links, outfit_photos, and
 * wear_logs rows all cascade-delete via the DB's `on delete cascade` foreign
 * keys, so this is a single-row delete. Throws the Supabase error on failure.
 */
export async function deleteOutfit(outfitId: string): Promise<void> {
  const { error } = await supabase.from('outfits').delete().eq('id', outfitId);
  if (error) throw error;
}

/** Uploads a "worn in the wild" photo for an outfit. Throws the Supabase error on failure. */
export async function addOutfitPhoto(outfitId: string, uri: string): Promise<OutfitPhoto> {
  return uploadOutfitPhoto(outfitId, uri);
}

/** Deletes one outfit photo (row + storage object). Throws the Supabase error on failure. */
export async function deleteOutfitPhoto(photo: OutfitPhoto): Promise<void> {
  return deleteOutfitPhotoObject(photo);
}
