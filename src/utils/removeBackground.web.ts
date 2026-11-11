import { supabase } from '@/utils/supabase';
import { compressImageForUpload } from './compressImage';
import {
  BackgroundRemovalError,
  GENERIC_FAILURE_MESSAGE,
  NO_SUBJECT_MESSAGE,
} from './removeBackground.shared';

export { BackgroundRemovalError, isCutoutPhotoUrl } from './removeBackground.shared';

/**
 * Web counterpart of removeBackground.native.ts. Browsers have no built-in
 * subject-lifting API, so the web app sends the photo to Zeeba's Cloudflare
 * Worker (cloudflare/background-remover), which runs it through Cloudflare
 * Images and returns a transparent PNG.
 *
 * The Worker's URL comes from EXPO_PUBLIC_BACKGROUND_REMOVER_URL at build
 * time. When it isn't set the feature reports itself unavailable and the
 * Remove background button doesn't render.
 */
const SERVICE_URL = process.env.EXPO_PUBLIC_BACKGROUND_REMOVER_URL?.replace(/\/+$/, '') || null;

// Plenty for the segmentation model, and keeps the upload well under 1 MB.
const UPLOAD_MAX_DIMENSION = 2048;
// Pixels fainter than this are edge feathering, not garment; ignoring them
// keeps a stray near-invisible speck from widening the crop.
const TRIM_ALPHA_THRESHOLD = 12;

export function isBackgroundRemovalAvailable(): boolean {
  return SERVICE_URL !== null;
}

/**
 * Cuts the clothing item out of the photo at `uri` (a picked photo's blob:
 * URL or an already-uploaded photo's URL) and resolves with a blob: URL of a
 * transparent PNG cropped to the item. The caller owns that URL and should
 * revoke it when done (see revokeIfBlobUrl).
 *
 * Throws BackgroundRemovalError with a user-facing message on failure.
 */
export async function removeBackground(uri: string): Promise<string> {
  if (!SERVICE_URL) {
    throw new BackgroundRemovalError('Background removal is not set up for the web app.');
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new BackgroundRemovalError('Sign in to remove photo backgrounds.');
  }

  const upload = await prepareUpload(uri);

  let response: Response;
  try {
    response = await fetch(`${SERVICE_URL}/remove-background`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY!,
        'Content-Type': upload.type,
      },
      body: upload,
    });
  } catch (err) {
    throw new BackgroundRemovalError(
      "Couldn't reach the background removal service. Check your connection and try again.",
      { cause: err },
    );
  }

  if (!response.ok) {
    throw new BackgroundRemovalError(messageForStatus(response.status));
  }

  return trimToSubject(await response.blob());
}

/** Maps the Worker's failure statuses (see cloudflare/background-remover/src/index.js) to user-facing text. */
function messageForStatus(status: number): string {
  if (status === 401) return 'Your sign-in has expired. Please sign in again, then retry.';
  if (status === 413) return 'This photo is too large to process.';
  if (status === 415) return "Couldn't read this photo. Please pick a JPEG or PNG.";
  if (status === 429) {
    return "Zeeba has used up this month's free background removals. They become available again next month.";
  }
  return GENERIC_FAILURE_MESSAGE;
}

/**
 * Re-encodes the photo as an upright JPEG no larger than UPLOAD_MAX_DIMENSION.
 * Fetching it into a same-origin blob first matters for an already-uploaded
 * photo: drawing a cross-origin <img> straight onto a canvas would taint the
 * canvas and block reading the pixels back out.
 */
async function prepareUpload(uri: string): Promise<Blob> {
  let localUrl: string | null = null;
  let jpegUrl: string | null = null;
  try {
    const original = await (await fetch(uri)).blob();
    localUrl = URL.createObjectURL(original);
    jpegUrl = await compressImageForUpload(localUrl, {
      maxWidth: UPLOAD_MAX_DIMENSION,
      maxHeight: UPLOAD_MAX_DIMENSION,
      quality: 0.9,
    });
    return await (await fetch(jpegUrl)).blob();
  } catch (err) {
    throw new BackgroundRemovalError("Couldn't read this photo. Please pick it again.", { cause: err });
  } finally {
    if (localUrl) URL.revokeObjectURL(localUrl);
    if (jpegUrl) URL.revokeObjectURL(jpegUrl);
  }
}

/**
 * Crops the service's full-frame cutout down to the garment itself, so it
 * fills its frame in the closet grid and flat lays the same way an iOS
 * cutout does. Throws the "no clothing item found" error when the result is
 * fully transparent.
 */
async function trimToSubject(cutout: Blob): Promise<string> {
  const sourceUrl = URL.createObjectURL(cutout);
  try {
    const image = await loadImage(sourceUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable.');
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, width, height).data;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[(y * width + x) * 4 + 3] > TRIM_ALPHA_THRESHOLD) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (right < 0) throw new BackgroundRemovalError(NO_SUBJECT_MESSAGE);

    const cropped = document.createElement('canvas');
    cropped.width = right - left + 1;
    cropped.height = bottom - top + 1;
    const croppedContext = cropped.getContext('2d');
    if (!croppedContext) throw new Error('Canvas 2D context unavailable.');
    croppedContext.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);

    const blob = await new Promise<Blob | null>(resolve => cropped.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Canvas PNG encoding failed.');
    return URL.createObjectURL(blob);
  } catch (err) {
    if (err instanceof BackgroundRemovalError) throw err;
    throw new BackgroundRemovalError(GENERIC_FAILURE_MESSAGE, { cause: err });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to decode.'));
    image.src = url;
  });
}
