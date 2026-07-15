import { compressImageForUpload } from '@/utils/compressImage';
import { supabase } from '@/utils/supabase';
import type { ClosetItemPhoto, NewClosetItemPhoto, OutfitPhoto } from './dataService.types';

const CLOTHING_ITEM_PHOTO_BUCKET = 'clothing_item_photos';
const OUTFIT_PHOTO_BUCKET = 'outfit_photos';

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
 * Uploads one locally-picked photo into `bucket`, under a `folderId/`
 * prefix, and returns both its storage path (for rollback/removal) and its
 * public URL (for the DB row). The photo is compressed (downscaled,
 * re-encoded as JPEG - this is also what normalizes iPhone HEIC captures)
 * before upload. Throws the underlying Supabase error on upload failure.
 */
async function uploadPhotoToBucket(
  bucket: string,
  folderId: string,
  uri: string,
): Promise<{ path: string; publicUrl: string }> {
  const compressedUri = await compressImageForUpload(uri);

  const response = await fetch(compressedUri);
  const arrayBuffer = await response.arrayBuffer();
  const extension = extensionFromUri(compressedUri);
  const path = `${folderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: contentTypeFromExtension(extension) });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: publicUrlData.publicUrl };
}

/**
 * Parses the bucket-relative storage path back out of a public URL produced
 * by `uploadPhotoToBucket`. Returns null if the URL doesn't match the
 * expected `.../object/public/<bucket>/<path>` shape.
 */
function storagePathFromPublicUrl(bucket: string, publicUrl: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  return index === -1 ? null : publicUrl.slice(index + marker.length);
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
  const { path, publicUrl } = await uploadPhotoToBucket(CLOTHING_ITEM_PHOTO_BUCKET, itemId, photo.uri);

  const { error: photoError } = await supabase.from('clothing_item_photos').insert({
    clothing_item_id: itemId,
    image_url: publicUrl,
    is_primary: photo.isPrimary,
  });
  if (photoError) throw photoError;

  return { path };
}

/**
 * Uploads one locally-picked additional photo for an existing closet item
 * (always non-primary) and inserts its `clothing_item_photos` row. Rolls the
 * upload back if the insert fails. Throws the underlying Supabase error on
 * either step.
 */
export async function uploadSecondaryClosetItemPhoto(itemId: string, uri: string): Promise<ClosetItemPhoto> {
  const { path, publicUrl } = await uploadPhotoToBucket(CLOTHING_ITEM_PHOTO_BUCKET, itemId, uri);

  const { data, error } = await supabase
    .from('clothing_item_photos')
    .insert({ clothing_item_id: itemId, image_url: publicUrl, is_primary: false })
    .select('id, image_url, created_at')
    .single();
  if (error) {
    await supabase.storage.from(CLOTHING_ITEM_PHOTO_BUCKET).remove([path]);
    throw error;
  }

  return data;
}

/**
 * Uploads a replacement primary photo for a closet item, then removes
 * whichever photo(s) were previously marked primary (row + storage object).
 * The new photo is uploaded first so a failed upload leaves the existing
 * primary photo untouched.
 */
export async function replacePrimaryClosetItemPhoto(itemId: string, uri: string): Promise<void> {
  const { data: existingPrimaryPhotos, error: fetchError } = await supabase
    .from('clothing_item_photos')
    .select('id, image_url')
    .eq('clothing_item_id', itemId)
    .eq('is_primary', true);
  if (fetchError) throw fetchError;

  await uploadClosetItemPhoto(itemId, { uri, isPrimary: true });

  for (const photo of existingPrimaryPhotos ?? []) {
    await supabase.from('clothing_item_photos').delete().eq('id', photo.id);
    const path =
      typeof photo.image_url === 'string' ? storagePathFromPublicUrl(CLOTHING_ITEM_PHOTO_BUCKET, photo.image_url) : null;
    if (path) await supabase.storage.from(CLOTHING_ITEM_PHOTO_BUCKET).remove([path]);
  }
}

/**
 * Deletes one closet item photo's `clothing_item_photos` row, then
 * best-effort removes its storage object - same reasoning as
 * `deleteOutfitPhotoObject`.
 */
export async function deleteClosetItemPhotoObject(photo: ClosetItemPhoto): Promise<void> {
  const { error } = await supabase.from('clothing_item_photos').delete().eq('id', photo.id);
  if (error) throw error;

  const path =
    typeof photo.image_url === 'string'
      ? storagePathFromPublicUrl(CLOTHING_ITEM_PHOTO_BUCKET, photo.image_url)
      : null;
  if (path) await supabase.storage.from(CLOTHING_ITEM_PHOTO_BUCKET).remove([path]);
}

/**
 * Uploads one locally-picked "worn in the wild" photo for an outfit and
 * inserts its `outfit_photos` row. Rolls the upload back if the insert
 * fails. Throws the underlying Supabase error on either step.
 */
export async function uploadOutfitPhoto(outfitId: string, uri: string): Promise<OutfitPhoto> {
  const { path, publicUrl } = await uploadPhotoToBucket(OUTFIT_PHOTO_BUCKET, outfitId, uri);

  const { data, error } = await supabase
    .from('outfit_photos')
    .insert({ outfit_id: outfitId, image_url: publicUrl })
    .select('id, image_url, created_at')
    .single();
  if (error) {
    await supabase.storage.from(OUTFIT_PHOTO_BUCKET).remove([path]);
    throw error;
  }

  return data;
}

/**
 * Deletes one outfit photo's `outfit_photos` row, then best-effort removes
 * its storage object. The storage removal isn't checked for errors - a
 * failed cleanup there shouldn't block the row (and thus the UI) from
 * reflecting the delete, same reasoning as `removeClosetItemPhotoObjects`.
 */
export async function deleteOutfitPhotoObject(photo: OutfitPhoto): Promise<void> {
  const { error } = await supabase.from('outfit_photos').delete().eq('id', photo.id);
  if (error) throw error;

  const path =
    typeof photo.image_url === 'string'
      ? storagePathFromPublicUrl(OUTFIT_PHOTO_BUCKET, photo.image_url)
      : null;
  if (path) await supabase.storage.from(OUTFIT_PHOTO_BUCKET).remove([path]);
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
