import { supabase } from '@/utils/supabase';
import type { NewClosetItemPhoto } from './dataService.types';

const CLOTHING_ITEM_PHOTO_BUCKET = 'clothing_item_photos';

/** Pulls the file extension off a picked photo's URI, defaulting to `jpg` when none is present. */
function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(uri);
  return match ? match[1].toLowerCase() : 'jpg';
}

/** Maps a file extension to the MIME type Supabase Storage expects for the upload. */
function contentTypeFromExtension(extension: string): string {
  if (extension === 'png') return 'image/png';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Uploads one locally-picked photo to the clothing item photo bucket and
 * inserts its `clothing_item_photos` row. Returns the storage path so the
 * caller can roll the upload back if a later step in the same batch fails.
 * Throws the underlying Supabase error on either the upload or the insert.
 */
export async function uploadClosetItemPhoto(
  itemId: string,
  photo: NewClosetItemPhoto,
): Promise<{ path: string }> {
  const response = await fetch(photo.uri);
  const arrayBuffer = await response.arrayBuffer();
  const extension = extensionFromUri(photo.uri);
  const path = `${itemId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(CLOTHING_ITEM_PHOTO_BUCKET)
    .upload(path, arrayBuffer, { contentType: contentTypeFromExtension(extension) });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from(CLOTHING_ITEM_PHOTO_BUCKET).getPublicUrl(path);

  const { error: photoError } = await supabase.from('clothing_item_photos').insert({
    clothing_item_id: itemId,
    image_url: publicUrlData.publicUrl,
    is_primary: photo.isPrimary,
  });
  if (photoError) throw photoError;

  return { path };
}

/**
 * Best-effort removal of storage objects for photos that were already
 * uploaded when a later photo in the same batch failed. `storage.remove()`
 * resolves with `{ error }` rather than throwing, and the result is
 * intentionally not checked - deleting the parent `clothing_items` row (done
 * by the caller right after this) matters more than a clean bucket.
 */
export async function removeClosetItemPhotoObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(CLOTHING_ITEM_PHOTO_BUCKET).remove(paths);
}
