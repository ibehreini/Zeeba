import { useToast } from '@/components/Toast';
import { useTheme } from '@/context/ThemeContext';
import { showAlert } from '@/utils/alert';
import {
  BackgroundRemovalError,
  isBackgroundRemovalAvailable,
  removeBackground,
} from '@/utils/removeBackground';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  /**
   * The photo to cut out: a freshly picked local uri, or an already-uploaded
   * photo's URL. Null hides the button (nothing to work on).
   */
  sourceUri: string | null;
  /** True while the form is showing the cutout instead of `sourceUri`. */
  isRemoved: boolean;
  /** Called with the transparent PNG's local uri once the background is removed. */
  onRemoved: (cutoutUri: string) => void;
  /** Called when the user undoes the removal and wants `sourceUri` back. */
  onRestore: () => void;
  /** Lets the form hold its Save button while a removal is in flight. */
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
};

const REMOVE_LABEL = 'Remove background';
const BUSY_LABEL = 'Removing background';
const RESTORE_LABEL = 'Restore original photo';

/**
 * Toggle under a photo well: cuts the clothing item out of the picked photo,
 * and afterwards offers the original back. Renders nothing on devices that
 * can't remove backgrounds (see isBackgroundRemovalAvailable).
 *
 * Screen reader behaviour: it is one button whose name always matches its
 * visible text, so VoiceOver focus stays put as it flips between "Remove
 * background" and "Restore original photo". Progress and outcome are spoken
 * (the spinner and the swapped preview are invisible to a VoiceOver user):
 * "Removing background" when it starts, then the toast's "Background
 * removed" - or an alert describing the failure.
 */
export default function RemoveBackgroundButton({
  sourceUri,
  isRemoved,
  onRemoved,
  onRestore,
  onBusyChange,
  disabled,
}: Props) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  // A removal takes about a second. If the user picks a different photo (or
  // leaves the screen) meanwhile, the result belongs to a photo that is no
  // longer shown and must be dropped rather than applied.
  const latestSourceUri = useRef(sourceUri);
  const isMounted = useRef(true);
  useEffect(() => {
    latestSourceUri.current = sourceUri;
  }, [sourceUri]);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (!isBackgroundRemovalAvailable()) return null;
  if (!sourceUri) return null;

  const isDisabled = !!disabled || busy;

  const handlePress = async () => {
    if (isDisabled) return;

    if (isRemoved) {
      onRestore();
      showToast('Original photo restored');
      return;
    }

    const startedWith = sourceUri;
    const isStale = () => !isMounted.current || latestSourceUri.current !== startedWith;

    setBusy(true);
    onBusyChange?.(true);
    announceStart();
    try {
      const cutoutUri = await removeBackground(startedWith);
      if (isStale()) return;
      onRemoved(cutoutUri);
      showToast('Background removed');
    } catch (err) {
      if (isStale()) return;
      showAlert(
        "Couldn't remove background",
        err instanceof BackgroundRemovalError
          ? err.message
          : 'Something went wrong removing the background. Please try again.',
      );
    } finally {
      if (isMounted.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  };

  const label = busy ? BUSY_LABEL : isRemoved ? RESTORE_LABEL : REMOVE_LABEL;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        role="button"
        aria-label={label}
        aria-disabled={isDisabled}
        aria-busy={busy}
        accessibilityHint={
          isRemoved
            ? 'Puts the photo back the way you took it'
            : 'Cuts the clothing item out of the photo so only the item shows'
        }
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.textPrimary },
          isDisabled && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        {busy && <ActivityIndicator color={theme.textPrimary} style={styles.spinner} />}
        <Text style={[styles.buttonText, { color: theme.textPrimary }]}>{busy ? `${BUSY_LABEL}…` : label}</Text>
      </Pressable>
      {/* Web has no announce API (react-native-web's is a no-op), so the
          start of a removal is spoken through this live region instead.
          Native announces it directly - see announceStart. */}
      {Platform.OS === 'web' && (
        <Text role="status" style={styles.srOnly}>
          {busy ? BUSY_LABEL : ''}
        </Text>
      )}
    </View>
  );
}

/**
 * Speaks "Removing background" on native. Queued on iOS so it follows
 * VoiceOver's own read-out of the button press instead of being cut off by it.
 */
function announceStart() {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibilityWithOptions(BUSY_LABEL, { queue: true });
  } else if (Platform.OS !== 'web') {
    AccessibilityInfo.announceForAccessibility(BUSY_LABEL);
  }
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  button: {
    // 48pt tall: above the 44pt minimum touch target.
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  spinner: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
