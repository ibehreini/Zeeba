import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Speaks `message` through VoiceOver/TalkBack. Queued on iOS so it follows
 * whatever VoiceOver is already saying (typically the name of the button
 * that was just pressed) instead of cutting it off or being cut off - same
 * reasoning as RemoveBackgroundButton. No-op on web, where react-native-web's
 * announce API is an empty function and live regions do this job.
 */
export function announceForScreenReader(message: string): void {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
  } else if (Platform.OS !== 'web') {
    AccessibilityInfo.announceForAccessibility(message);
  }
}

/**
 * Web only: moves keyboard and screen-reader focus to an element that is not
 * normally focusable (a heading), after the control that held focus left the
 * page. No-op on native, where the screen reader relocates focus itself.
 */
export function focusOnWeb(target: unknown): void {
  if (Platform.OS !== 'web' || !target) return;
  const node = target as HTMLElement;
  node.tabIndex = -1;
  node.focus();
}
