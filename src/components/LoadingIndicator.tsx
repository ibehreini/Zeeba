import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = { label: string; color?: string; style?: StyleProp<ViewStyle> };

/**
 * A spinner with a spoken name ("Loading tags"). The native ActivityIndicator
 * is a host view that never passes through View's aria-* mapping
 * (ActivityIndicator.js spreads its rest props straight onto the native
 * component), so an aria-label on it is silently dropped on iOS. The name
 * therefore goes on an accessible wrapper; on web the wrapper is the named
 * progressbar and the inner spinner is hidden so it isn't read twice.
 */
export default function LoadingIndicator({ label, color, style }: Props) {
  return (
    <View accessible role="progressbar" aria-label={label} style={[styles.centered, style]}>
      <ActivityIndicator aria-hidden color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
});
