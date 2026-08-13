/**
 * Revokes `uri` if it is a `blob:` object URL, freeing the underlying Blob.
 *
 * On web, both expo-image-picker (the picked original) and
 * compressImage.web.ts (the compressed JPEG) hand back object URLs, which
 * pin their full image bytes in memory for the page's lifetime until
 * explicitly revoked. No-op for native `file://` URIs and remote URLs, so
 * it's safe to call unconditionally from cross-platform code.
 */
export function revokeIfBlobUrl(uri: string | null | undefined): void {
  if (uri && uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}
