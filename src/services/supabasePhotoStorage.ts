import { compressImageForUpload } from '@/utils/compressImage';
import { TRANSPARENT_FALLBACK_DIMENSIONS, TRANSPARENT_MAX_BYTES } from '@/utils/compressImage.shared';
import { revokeIfBlobUrl } from '@/utils/revokeIfBlobUrl';
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
 * Reads a compressed photo's bytes for upload. The web compressor hands back
 * a blob: object URL, which stays alive (holding the full image in memory)
 * until explicitly revoked - so it's revoked here even when the read fails.
 */
async function readAndRelease(compressedUri: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(compressedUri);
    return await response.arrayBuffer();
  } finally {
    revokeIfBlobUrl(compressedUri);
  }
}

/**
 * Uploads one locally-picked photo into `bucket`, under a `folderId/`
 * prefix, and returns both its storage path (for rollback/removal) and its
 * public URL (for the DB row). The photo is compressed (downscaled,
 * re-encoded as JPEG - this is also what normalizes iPhone HEIC captures)
 * before upload. `keepTransparency` is for background-removed cutouts: they
 * are stored as PNG instead so the transparent background survives. Throws
 * the underlying Supabase error on upload failure.
 */
async function uploadPhotoToBucket(
  bucket: string,
  folderId: string,
  uri: string,
  keepTransparency = false,
): Promise<{ path: string; publicUrl: string }> {
  let compressedUri = await compressImageForUpload(uri, { keepTransparency });
  let arrayBuffer = await readAndRelease(compressedUri);

  // Transparent PNGs can't be squeezed with a quality setting, so a
  // cutout of detailed fabric (a knit sweater) can still be large at the
  // normal size. Smaller passes keep it under the bucket's upload limit;
  // the last one is uploaded whatever its size.
  if (keepTransparency) {
    for (const dimension of TRANSPARENT_FALLBACK_DIMENSIONS) {
      if (arrayBuffer.byteLength <= TRANSPARENT_MAX_BYTES) break;
      if (__DEV__) console.log(`[photo upload] cutout is ${(arrayBuffer.byteLength / 1024).toFixed(0)}KB, retrying at ${dimension}px`);
      compressedUri = await compressImageForUpload(uri, {
        keepTransparency,
        maxWidth: dimension,
        maxHeight: dimension,
      });
      arrayBuffer = await readAndRelease(compressedUri);
    }
  }
  if (__DEV__) console.log(`[photo upload] uploading ${(arrayBuffer.byteLength / 1024).toFixed(0)}KB ${keepTransparency ? 'PNG cutout' : 'photo'}`);
  // The web compressor returns an extensionless blob: URL, so the format
  // comes from what was asked for, not from the URI, when transparency is kept.
  const extension = keepTransparency ? 'png' : extensionFromUri(compressedUri);
  return uploadBytesToBucket(bucket, folderId, arrayBuffer, extension, contentTypeFromExtension(extension));
}

/**
 * Uploads raw bytes into `bucket` under a unique `folderId/` path and returns
 * that path plus its public URL. Shared by photo and voice note uploads.
 * Throws the Supabase error on failure.
 */
export async function uploadBytesToBucket(
  bucket: string,
  folderId: string,
  bytes: ArrayBuffer,
  extension: string,
  contentType: string,
): Promise<{ path: string; publicUrl: string }> {
  const path = `${folderId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/**
 * Best-effort removal of the storage object behind a public URL produced by
 * `uploadBytesToBucket`. Does nothing for anything else (a non-string preview
 * asset, or a URL not shaped `.../object/public/<bucket>/<path>`); the
 * removal result is intentionally not checked.
 */
export async function removeObjectByPublicUrl(bucket: string, publicUrl: unknown): Promise<void> {
  if (typeof publicUrl !== 'string') return;
  const marker = `/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index !== -1) await supabase.storage.from(bucket).remove([publicUrl.slice(index + marker.length)]);
}

/**
 * Uploads a picked photo that its caller won't reuse, then frees its URI.
 * On web the picked uri is an object URL pinning the original file in
 * memory (expo-image-picker never revokes it). These flows' callers drop the
 * uri once the call settles (a retry re-picks), so it's freed here.
 * Deliberately NOT used by uploadClosetItemPhoto: the add/edit forms keep
 * their picked uri alive for previews and conflict retries.
 */
async function uploadSingleUsePhoto(bucket: string, folderId: string, uri: string) {
  try {
    return await uploadPhotoToBucket(bucket, folderId, uri);
  } finally {
    revokeIfBlobUrl(uri);
  }
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
): Promise<{ path: string; createdAt: string }> {
  const { path, publicUrl } = await uploadPhotoToBucket(
    CLOTHING_ITEM_PHOTO_BUCKET,
    itemId,
    photo.uri,
    photo.keepTransparency,
  );

  const { data, error: photoError } = await supabase
    .from('clothing_item_photos')
    .insert({
      clothing_item_id: itemId,
      image_url: publicUrl,
      is_primary: photo.isPrimary,
    })
    .select('created_at')
    .single();
  if (photoError) throw photoError;

  return { path, createdAt: data.created_at };
}

/**
 * Uploads one locally-picked additional photo for an existing closet item
 * (always non-primary) and inserts its `clothing_item_photos` row. Rolls the
 * upload back if the insert fails. Throws the underlying Supabase error on
 * either step.
 */
export async function uploadSecondaryClosetItemPhoto(itemId: string, uri: string): Promise<ClosetItemPhoto> {
  const { path, publicUrl } = await uploadSingleUsePhoto(CLOTHING_ITEM_PHOTO_BUCKET, itemId, uri);

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
 * Uploads a replacement primary photo for a closet item, then removes every
 * primary photo older than it (row + storage object). The new photo is
 * uploaded first so a failed upload leaves the existing primary photo
 * untouched. "Older than the new one" rather than "the ones read before the
 * upload": when two people replace the photo at once, the old way left both
 * new photos marked primary; this way the newest one wins and the item keeps
 * exactly one. `keepTransparency` marks a background-removed cutout (see
 * uploadPhotoToBucket).
 */
export async function replacePrimaryClosetItemPhoto(
  itemId: string,
  uri: string,
  keepTransparency = false,
): Promise<void> {
  const { createdAt } = await uploadClosetItemPhoto(itemId, { uri, isPrimary: true, keepTransparency });

  const { data: replacedPhotos } = await supabase
    .from('clothing_item_photos')
    .delete()
    .eq('clothing_item_id', itemId)
    .eq('is_primary', true)
    .lt('created_at', createdAt)
    .select('image_url');

  for (const photo of replacedPhotos ?? []) {
    await removeObjectByPublicUrl(CLOTHING_ITEM_PHOTO_BUCKET, photo.image_url);
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
  await removeObjectByPublicUrl(CLOTHING_ITEM_PHOTO_BUCKET, photo.image_url);
}

/**
 * Uploads one locally-picked "worn in the wild" photo for an outfit and
 * inserts its `outfit_photos` row. Rolls the upload back if the insert
 * fails. Throws the underlying Supabase error on either step.
 */
export async function uploadOutfitPhoto(outfitId: string, uri: string): Promise<OutfitPhoto> {
  const { path, publicUrl } = await uploadSingleUsePhoto(OUTFIT_PHOTO_BUCKET, outfitId, uri);

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
  await removeObjectByPublicUrl(OUTFIT_PHOTO_BUCKET, photo.image_url);
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
