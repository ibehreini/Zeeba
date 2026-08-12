import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';

/** Tab header banner - turns sky blue while the Stylist closet mode is active. */
export default function HeaderBanner({ title }: { title?: string }) {
  const { closetMode } = useCloset();
  const { theme } = useTheme();
  const isStylist = closetMode === 'stylist';

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.container,
        {
          backgroundColor: isStylist ? theme.stylist : theme.surface,
          borderBottomColor: isStylist ? theme.stylist : theme.border,
        },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: isStylist ? theme.onStylist : theme.textPrimary }]}
      >
        {title}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
});
