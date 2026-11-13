import { useTheme } from '@/context/ThemeContext';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  label: string;
  ariaLabel: string;
  onPress: () => void;
  /** Shows the spinner and marks the button aria-busy. */
  submitting: boolean;
  /**
   * Blocks presses. Defaults to `submitting`; the item forms also block while
   * a background removal is still running.
   */
  disabled?: boolean;
  /**
   * Required fields are missing. Only dims the button: it stays pressable so
   * pressing it can say what is still needed.
   */
  incomplete: boolean;
  /**
   * Pads below the button for the iPhone home indicator. Only for screens
   * outside the tab navigator - the tab bar under the create screens already
   * covers that inset, so padding there too would double it.
   */
  insetBottom?: boolean;
};

/**
 * The Save bar pinned under a form's ScrollView. Save deliberately lives
 * outside the scroll view: users flick to the bottom to reach it, and a tap
 * that lands while the scroll is still decelerating or bouncing is taken by
 * the scroll view to stop the scroll, so the button silently got no press and
 * had to be tapped twice. Don't move it back into the scrolling content.
 */
export default function FormSubmitFooter({
  label,
  ariaLabel,
  onPress,
  submitting,
  disabled = submitting,
  incomplete,
  insetBottom = false,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // On web the site footer below <main> is what meets the bottom edge, so
  // the form footer never needs the inset (and viewport-fit=cover would
  // otherwise report one in an iOS home-screen PWA).
  const bottomInset = insetBottom && Platform.OS !== 'web' ? insets.bottom : 0;

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: BAR_PADDING + bottomInset },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.accent },
          (disabled || incomplete) && { backgroundColor: theme.textSecondary },
          pressed && styles.buttonPressed,
        ]}
        role="button"
        aria-label={ariaLabel}
        aria-disabled={disabled}
        aria-busy={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.onAccent }]}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
}

const BAR_PADDING = 12;

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: BAR_PADDING,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
