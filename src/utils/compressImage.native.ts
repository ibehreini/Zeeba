import { Image as ImageCompressor } from 'react-native-compressor';
import { DEFAULT_COMPRESS_OPTIONS, type CompressImageOptions } from './compressImage.shared';

export type { CompressImageOptions };

/**
 * Compresses a locally-picked photo (including iPhone HEIC) into a
 * downscaled JPEG ready for upload. Returns a new local file:// URI - the
 * original file is left untouched.
 *
 * Throws on failure rather than falling back to the original file, so a
 * compressor bug can't sneak an uncompressed (possibly still-HEIC) upload
 * past callers unnoticed.
 */
export async function compressImageForUpload(
  uri: string,
  options: CompressImageOptions = {},
): Promise<string> {
  const { maxWidth, maxHeight, quality } = { ...DEFAULT_COMPRESS_OPTIONS, ...options };

  try {
    return await ImageCompressor.compress(uri, {
      compressionMethod: 'manual',
      maxWidth,
      maxHeight,
      quality,
      input: 'uri',
      output: 'jpg',
      returnableOutputType: 'uri',
    });
  } catch (err) {
    throw new Error('Could not compress image. Please try again.', { cause: err });
  }
}
