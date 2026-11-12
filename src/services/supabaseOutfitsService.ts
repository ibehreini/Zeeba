import { supabase } from '@/utils/supabase';
import { ConflictError, type NewOutfitInput, type Outfit, type OutfitPhoto, type UpdateOutfitInput } from './dataService.types';
import { deleteWithOcc, updateWithOcc } from './occConcurrency';
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

// foreign_key_violation: a picked item was deleted (e.g. by another closet
// member) after the picker loaded.
const DELETED_ITEM_CODE = '23503';
const DELETED_ITEM_MESSAGE = 'One of the items you picked was just deleted. Please refresh and pick again.';

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
      description: input.description || null,
      labels: input.labels,
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
      if (itemsError.code === DELETED_ITEM_CODE) throw new Error(DELETED_ITEM_MESSAGE);
      throw itemsError;
    }
  }

  const created = await getOutfitById(outfitId);
  if (!created) throw new Error('Failed to load the newly created outfit.');
  return created;
}

/**
 * Updates an outfit's name, description, tags and item list in one
 * transaction (the `update_outfit_with_items` RPC), so the row and its
 * outfit_items can't be half-written or interleaved with someone else's save.
 * `expectedUpdatedAt` must match the row's current `updated_at` (i.e. what a
 * stylist or the closet owner last read) or this throws `ConflictError`
 * without writing - same contract as occConcurrency.ts. Throws the Supabase
 * error on any other failure.
 */
export async function updateOutfit(
  outfitId: string,
  expectedUpdatedAt: string,
  input: UpdateOutfitInput,
): Promise<Outfit> {
  const description = input.description || null;
  const { data, error } = await supabase.rpc('update_outfit_with_items', {
    p_outfit_id: outfitId,
    p_expected_updated_at: expectedUpdatedAt,
    p_name: input.name,
    p_description: description,
    p_labels: input.labels,
    p_item_ids: input.itemIds,
  });
  if (error?.code === DELETED_ITEM_CODE) throw new Error(DELETED_ITEM_MESSAGE);
  if (error?.code === 'PGRST202') {
    // The database predates the RPC's migration. Keep name/description/tag
    // edits working the old way; an item change can't be saved safely.
    const current = await getOutfitById(outfitId);
    if (!current) throw new ConflictError();
    if ([...current.item_ids].sort().join() !== [...input.itemIds].sort().join()) {
      throw new Error('Changing an outfit’s items isn’t available yet. Undo the item changes to save the rest.');
    }
    await updateWithOcc('outfits', outfitId, expectedUpdatedAt, { name: input.name, description, labels: input.labels });
  } else if (error) {
    throw error;
  } else if (!data) {
    throw new ConflictError();
  }

  const updated = await getOutfitById(outfitId);
  if (!updated) throw new Error('Failed to load the updated outfit.');
  return updated;
}

/**
 * Deletes an outfit row. Its outfit_items links, outfit_photos, and
 * wear_logs rows all cascade-delete via the DB's `on delete cascade` foreign
 * keys, so this is a single-row delete. `expectedUpdatedAt` must match the
 * row's current `updated_at` or this throws `ConflictError` without
 * deleting - see occConcurrency.ts. Throws the Supabase error on any other
 * failure.
 */
export async function deleteOutfit(outfitId: string, expectedUpdatedAt: string): Promise<void> {
  await deleteWithOcc('outfits', outfitId, expectedUpdatedAt);
}

/**
 * Increments an outfit's compliment_count and returns the new value. The
 * increment happens atomically in the `increment_outfit_compliment_count`
 * RPC rather than a client-side read-then-write, so two people tapping "Log
 * compliment" around the same time can't lose an update. Throws the
 * Supabase error on failure.
 */
export async function logCompliment(outfitId: string): Promise<number> {
  const { data, error } = await supabase.rpc('increment_outfit_compliment_count', {
    target_outfit_id: outfitId,
  });
  if (error) throw error;
  return data;
}

/** Uploads a "worn in the wild" photo for an outfit. Throws the Supabase error on failure. */
export async function addOutfitPhoto(outfitId: string, uri: string): Promise<OutfitPhoto> {
  return uploadOutfitPhoto(outfitId, uri);
}

/** Deletes one outfit photo (row + storage object). Throws the Supabase error on failure. */
export async function deleteOutfitPhoto(photo: OutfitPhoto): Promise<void> {
  return deleteOutfitPhotoObject(photo);
}
