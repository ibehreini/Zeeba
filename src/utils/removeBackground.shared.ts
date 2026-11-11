/**
 * Thrown by removeBackground() with a message that is safe to show the user
 * as-is. Platform files translate their own failure modes (native error
 * codes, HTTP statuses) into this so the UI has one thing to catch.
 */
export class BackgroundRemovalError extends Error {}

export const NO_SUBJECT_MESSAGE =
  "Couldn't find a clothing item in this photo. Try a photo with the item laid flat on a plain surface that contrasts with it.";

export const GENERIC_FAILURE_MESSAGE = 'Something went wrong removing the background. Please try again.';

/**
 * Cutouts are always stored as PNG and regular photos as JPEG (see
 * compressImageForUpload), so a `.png` photo URL identifies a
 * background-removed photo. Screens use this to show the whole garment
 * (`contain`) rather than cropping a tightly-trimmed cutout to fill its frame.
 */
export function isCutoutPhotoUrl(source: string | number | null | undefined): boolean {
  return typeof source === 'string' && /\.png(\?|#|$)/i.test(source);
}
