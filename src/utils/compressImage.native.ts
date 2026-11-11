import { Image } from 'react-native';
import { Image as ImageCompressor } from 'react-native-compressor';
import { resolveCompressOptions, type CompressImageOptions } from './compressImage.shared';

export type { CompressImageOptions };

/**
 * Compresses a locally-picked photo (including iPhone HEIC) into a
 * downscaled JPEG ready for upload - or, with `keepTransparency`, a
 * downscaled PNG so a background-removed cutout stays transparent. Returns a
 * new local file:// URI - the original file is left untouched.
 *
 * Throws on failure rather than falling back to the original file, so a
 * compressor bug can't sneak an uncompressed (possibly still-HEIC) upload
 * past callers unnoticed.
 */
export async function compressImageForUpload(
  uri: string,
  options: CompressImageOptions = {},
): Promise<string> {
  const { maxWidth, maxHeight, quality, keepTransparency } = resolveCompressOptions(options);
  const target = await fitWithoutUpscaling(uri, maxWidth, maxHeight);

  try {
    return await ImageCompressor.compress(uri, {
      compressionMethod: 'manual',
      maxWidth: target.width,
      maxHeight: target.height,
      quality,
      input: 'uri',
      // The compressor's PNG output keeps the alpha channel
      // (disablePngTransparency defaults to false).
      output: keepTransparency ? 'png' : 'jpg',
      returnableOutputType: 'uri',
    });
  } catch (err) {
    throw new Error('Could not compress image. Please try again.', { cause: err });
  }
}

/**
 * The size to ask the compressor for. Its 'manual' mode always scales the
 * image to fill maxWidth/maxHeight, even when the image is already smaller
 * (react-native-compressor's findTargetSize never checks), so a tightly
 * cropped 500x700 cutout would come back upscaled to about 914x1280 - a
 * bigger, blurrier file. Passing the image's own size when it already fits
 * makes that a no-op. If the size can't be read, the limits are used as
 * before.
 */
async function fitWithoutUpscaling(
  uri: string,
  maxWidth: number,
  maxHeight: number,
): Promise<{ width: number; height: number }> {
  try {
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) =>
      Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject),
    );
    if (!width || !height) return { width: maxWidth, height: maxHeight };
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  } catch {
    return { width: maxWidth, height: maxHeight };
  }
}
