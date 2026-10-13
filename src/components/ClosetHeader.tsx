import { useTheme } from '@/context/ThemeContext';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  /** Number of items in this section, shown as "Jackets (21)". */
  count: number;
};

export default function ClosetHeader({ title, count }: Props) {
  const { theme } = useTheme();
  const noun = count === 1 ? 'item' : 'items';
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Screen readers get "Jackets, 21 items" instead of the bare "(21)",
          which NVDA/VoiceOver otherwise read as a lone number. */}
      <Text
        accessibilityRole="header"
        aria-label={`${title}, ${count} ${noun}`}
        style={[styles.headerText, { color: theme.textPrimary }]}
      >
        {title} ({count})
      </Text>
      <View style={[styles.underline, { backgroundColor: theme.textPrimary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  underline: {
    height: 2,
    width: 30,
    marginTop: 4,
    borderRadius: 1,
  },
});
