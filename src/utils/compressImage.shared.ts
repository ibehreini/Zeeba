/** Tunable knobs for compressImageForUpload; defaults hit ~1920px / 80% quality, typically <500KB for iPhone photos. */
export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** 0 (worst) to 1 (best). */
  quality?: number;
}

/**
 * Shared by compressImage.native.ts and compressImage.web.ts so the upload
 * size budget can't silently drift between platforms.
 */
export const DEFAULT_COMPRESS_OPTIONS: Required<CompressImageOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
};
