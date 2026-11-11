import { requireOptionalNativeModule } from 'expo';
import {
  BackgroundRemovalError,
  GENERIC_FAILURE_MESSAGE,
  NO_SUBJECT_MESSAGE,
} from './removeBackground.shared';

export { BackgroundRemovalError, isCutoutPhotoUrl } from './removeBackground.shared';

type NativeBackgroundRemover = {
  isAvailable(): boolean;
  removeBackground(uri: string): Promise<{ uri: string; width: number; height: number }>;
};

// Optional: the module (modules/zeeba-background-remover) is iOS-only, and a
// dev build made before it was added doesn't contain it either. In both
// cases this is null and the feature simply reports itself unavailable.
const nativeModule = requireOptionalNativeModule<NativeBackgroundRemover>('ZeebaBackgroundRemover');

/**
 * Whether this device can remove photo backgrounds. True on iOS 17+ builds
 * that include the native module; callers hide the option otherwise.
 */
export function isBackgroundRemovalAvailable(): boolean {
  return nativeModule?.isAvailable() ?? false;
}

/**
 * Cuts the clothing item out of the photo at `uri` (a local picked photo or
 * an already-uploaded photo's URL), on device, and resolves with the local
 * `file://` URI of a transparent PNG cropped to the item.
 *
 * Throws BackgroundRemovalError with a user-facing message on failure.
 */
export async function removeBackground(uri: string): Promise<string> {
  if (!nativeModule) {
    throw new BackgroundRemovalError('Background removal is not available on this device.');
  }
  try {
    const result = await nativeModule.removeBackground(uri);
    return result.uri;
  } catch (err) {
    // Codes are derived from the Swift exception class names in
    // ZeebaBackgroundRemoverModule.swift.
    const code = (err as { code?: string } | null)?.code;
    if (code === 'ERR_NO_SUBJECT_FOUND') throw new BackgroundRemovalError(NO_SUBJECT_MESSAGE, { cause: err });
    if (code === 'ERR_UNSUPPORTED_OS') {
      throw new BackgroundRemovalError('Background removal needs iOS 17 or later.', { cause: err });
    }
    if (code === 'ERR_UNREADABLE_IMAGE') {
      throw new BackgroundRemovalError("Couldn't read this photo. Please pick it again.", { cause: err });
    }
    throw new BackgroundRemovalError(GENERIC_FAILURE_MESSAGE, { cause: err });
  }
}
