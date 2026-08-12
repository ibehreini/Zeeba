export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Web has no photo-upload entry points wired up (see AddClothingItemForm,
 * EditClothingItemForm, ClothingItemDetail, outfitDetailPage - all hide
 * their "add/change photo" controls on Platform.OS === 'web'), so this
 * should never actually run there. It exists only so Metro can resolve
 * `@/utils/compressImage` for the web bundle without pulling in
 * react-native-compressor, which has no web build and breaks Metro's web
 * bundling (imports react-native's native bridge internals directly).
 */
export async function compressImageForUpload(): Promise<string> {
  throw new Error('Image compression/upload is not supported on web.');
}
