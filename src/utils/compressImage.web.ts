import { DEFAULT_COMPRESS_OPTIONS, type CompressImageOptions } from './compressImage.shared';

export type { CompressImageOptions };

const UNSUPPORTED_FORMAT_MESSAGE =
  "Your browser can't read this image format (iPhone HEIC photos aren't supported on the web). Please use a JPEG or PNG, or add the photo from the mobile app.";

/**
 * Web counterpart of compressImage.native.ts. react-native-compressor has no
 * web build (it imports react-native's native bridge internals directly and
 * breaks Metro's web bundling), so this re-implements the same downscale +
 * JPEG re-encode with a canvas instead.
 *
 * Returns a blob: object URL. uploadPhotoToBucket fetch()es it back into an
 * ArrayBuffer and revokes it, and its extension parser falls back to `jpg`
 * for extensionless URIs - which matches the JPEG this always produces.
 *
 * Throws on failure rather than falling back to the original file, so an
 * undecodable format can't sneak an unprocessed upload past callers. Decode
 * failures (e.g. HEIC, which browsers can't read even though the picker's
 * image/* filter admits it) get a format-specific message instead of the
 * generic "please try again" - retrying the same file can never succeed.
 */
export async function compressImageForUpload(
  uri: string,
  options: CompressImageOptions = {},
): Promise<string> {
  const { maxWidth, maxHeight, quality } = { ...DEFAULT_COMPRESS_OPTIONS, ...options };

  const image = await decodeImage(uri);

  try {
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable.');
    // JPEG has no alpha channel - flatten transparent PNGs onto white so
    // they don't come out on black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) throw new Error('Canvas JPEG encoding failed.');
    return URL.createObjectURL(blob);
  } catch (err) {
    throw new Error('Could not compress image. Please try again.', { cause: err });
  }
}

function decodeImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Some inputs "decode" with no intrinsic size (e.g. an SVG without
      // width/height attributes reports naturalWidth 0). Without this guard
      // the scale math degenerates (maxWidth / 0 = Infinity, canvas clamped
      // to 1px) and a blank 1x1 JPEG would silently upload as the photo.
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error(UNSUPPORTED_FORMAT_MESSAGE));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error(UNSUPPORTED_FORMAT_MESSAGE));
    image.src = uri;
  });
}
