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

  try {
    return await ImageCompressor.compress(uri, {
      compressionMethod: 'manual',
      maxWidth,
      maxHeight,
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
