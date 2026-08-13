import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

/**
 * Shown when a shared /outfit or /item link resolves to nothing. Under RLS a
 * row the viewer may not see (not the closet's owner or a stylist on it) and a
 * row that never existed both come back as zero rows, so this one screen
 * covers both - worded for the permission case, since that's what a shared
 * link to live data almost always means.
 */
export default function NoAccessScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Ionicons name="lock-closed-outline" size={48} color={theme.textSecondary} />
      <Text role="heading" style={[styles.title, { color: theme.textPrimary }]}>
        You don&apos;t have permission to view this closet
      </Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Ask the closet&apos;s owner for their passphrase and join as a stylist to see this look.
      </Text>
      <Pressable
        onPress={() => router.replace('/')}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: theme.accent }]}
      >
        <Text style={[styles.buttonText, { color: theme.onAccent }]}>Go to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 320,
  },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
