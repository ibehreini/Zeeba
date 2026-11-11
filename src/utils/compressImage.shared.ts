/** Tunable knobs for compressImageForUpload; defaults hit ~1920px / 80% quality, typically <500KB for iPhone photos. */
export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** 0 (worst) to 1 (best). Ignored when `keepTransparency` is set (PNG is lossless). */
  quality?: number;
  /**
   * Set for background-removed cutouts: the photo is downscaled and stored
   * as a PNG so its transparent background survives. Without it every photo
   * is re-encoded as JPEG, which has no alpha channel.
   */
  keepTransparency?: boolean;
}

/**
 * Shared by compressImage.native.ts and compressImage.web.ts so the upload
 * size budget can't silently drift between platforms.
 */
export const DEFAULT_COMPRESS_OPTIONS: Required<CompressImageOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  keepTransparency: false,
};

/**
 * PNG can't trade quality for size the way JPEG does, so cutouts get a
 * smaller pixel budget instead: at 1280px a garment cutout lands around
 * 1-1.5MB, versus ~3MB at the JPEG path's 1920px.
 */
const TRANSPARENT_MAX_DIMENSION = 1280;

/** Fills in defaults, applying the tighter pixel budget when transparency is kept. */
export function resolveCompressOptions(options: CompressImageOptions): Required<CompressImageOptions> {
  const sizeDefaults = options.keepTransparency
    ? { maxWidth: TRANSPARENT_MAX_DIMENSION, maxHeight: TRANSPARENT_MAX_DIMENSION }
    : {};
  return { ...DEFAULT_COMPRESS_OPTIONS, ...sizeDefaults, ...options };
}
