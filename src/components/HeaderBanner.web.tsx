import { StyleSheet, Text, View } from 'react-native';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Web page-title bar - turns sky blue while the Stylist closet mode is active.
 *
 * Differs from the iOS banner in three web-specific ways: no safe-area inset
 * (it sits under the site header, not under a notch), left-aligned in the same
 * max-width column as the header nav rather than centred like a native title
 * bar, and marked up as an explicit level-1 heading so it - not the brand in
 * the header - is the page's <h1>.
 */
export default function HeaderBanner({ title }: { title?: string }) {
  const { closetMode } = useCloset();
  const { theme } = useTheme();
  const isStylist = closetMode === 'stylist';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isStylist ? theme.stylist : theme.surface,
          borderBottomColor: isStylist ? theme.stylist : theme.border,
        },
      ]}
    >
      <View style={styles.inner}>
        <Text
          role="heading"
          aria-level={1}
          style={[styles.title, { color: isStylist ? theme.onStylist : theme.textPrimary }]}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
});
