import { BackgroundRemovalError } from './removeBackground.shared';

export { BackgroundRemovalError, isCutoutPhotoUrl } from './removeBackground.shared';

/**
 * Web counterpart of removeBackground.native.ts. Browsers have no built-in
 * subject-lifting API, so the web app has nothing to call yet and reports
 * the feature as unavailable - the Remove background button doesn't render.
 */
export function isBackgroundRemovalAvailable(): boolean {
  return false;
}

export async function removeBackground(_uri: string): Promise<string> {
  throw new BackgroundRemovalError('Background removal is not available in the browser yet.');
}
