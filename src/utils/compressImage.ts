import { Image as ImageCompressor } from 'react-native-compressor';

/** Tunable knobs for compressImageForUpload; defaults hit ~1920px / 80% quality, typically <500KB for iPhone photos. */
export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** 0 (worst) to 1 (best). */
  quality?: number;
}

const DEFAULT_OPTIONS: Required<CompressImageOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
};

/**
 * Compresses a locally-picked photo (including iPhone HEIC) into a
 * downscaled JPEG ready for upload. Returns a new local file:// URI - the
 * original file is left untouched.
 *
 * Falls back to the original URI on failure so a compressor bug never
 * blocks an upload outright; the fallback just means that one photo goes
 * up uncompressed (and possibly still HEIC).
 */
export async function compressImageForUpload(
  uri: string,
  options: CompressImageOptions = {},
): Promise<string> {
  const { maxWidth, maxHeight, quality } = { ...DEFAULT_OPTIONS, ...options };

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
    console.warn('[compressImageForUpload] compression failed, uploading original file', err);
    return uri;
  }
}
