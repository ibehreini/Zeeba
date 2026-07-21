import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCloset } from '@/context/ClosetContext';

/** Tab header banner - turns sky blue while the Stylist closet mode is active. */
export default function HeaderBanner({ title }: { title?: string }) {
  const { closetMode } = useCloset();
  const isStylist = closetMode === 'stylist';

  return (
    <SafeAreaView edges={['top']} style={[styles.container, isStylist && styles.stylist]}>
      <Text accessibilityRole="header" style={[styles.title, isStylist && styles.stylistText]}>
        {title}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  stylist: {
    backgroundColor: '#38bdf8',
    borderBottomColor: '#38bdf8',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#25292e',
  },
  stylistText: {
    color: '#fff',
  },
});
