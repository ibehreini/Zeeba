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

/**
 * Moves VoiceOver/TalkBack focus (or keyboard focus on web) to `target` - for
 * when the control the user was on disappears (a deleted row) or something
 * new appears that they'll want next (a just-saved row). Pass the ref's
 * current value; a short delay lets the target finish mounting first.
 */
export function moveScreenReaderFocus(target: unknown, delayMs = 250): void {
  if (!target) return;
  setTimeout(() => {
    if (Platform.OS === 'web') {
      focusOnWeb(target);
    } else {
      AccessibilityInfo.sendAccessibilityEvent(target as Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0], 'focus');
    }
  }, delayMs);
}

/**
 * Speaks `message` and resolves once it has (probably) been spoken - for
 * when the next thing is opening the microphone, which would otherwise
 * record the screen reader's voice. iOS reports when an announcement ends;
 * Android doesn't, so it falls back to a length-based estimate. Resolves
 * immediately when no screen reader is running, and on web.
 */
export async function announceAndWait(message: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const screenReaderOn = await AccessibilityInfo.isScreenReaderEnabled().catch(() => false);
  if (!screenReaderOn) return;

  // ~16 characters a second at default speech rates, plus a margin.
  const estimateMs = Math.min(8000, 500 + message.length * 60);
  await new Promise<void>(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      subscription?.remove();
      clearTimeout(fallback);
      resolve();
    };
    const subscription =
      Platform.OS === 'ios' ? AccessibilityInfo.addEventListener('announcementFinished', finish) : undefined;
    const fallback = setTimeout(finish, estimateMs);
    // Not queued: this follows a button press, and the user is waiting on it.
    AccessibilityInfo.announceForAccessibility(message);
  });
}
