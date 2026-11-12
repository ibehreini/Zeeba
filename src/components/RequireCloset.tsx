import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NewClosetForm from '@/components/NewClosetForm';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';

/**
 * Wraps the add-item / create-outfit forms so the user is stopped up front
 * when there's no closet to add to, instead of filling in the whole form and
 * only failing on save. Owners get the create-closet form; stylists can't
 * create one, so they're told to join one instead.
 */
export default function RequireCloset({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { closetMode, activeClosetId, isLoading, error, needsOwnClosetSetup } = useCloset();

  if (needsOwnClosetSetup) {
    return (
      <View style={styles.container}>
        <NewClosetForm />
      </View>
    );
  }

  if (closetMode === 'stylist' && !isLoading && !error && !activeClosetId) {
    return (
      <View style={styles.container}>
        <Text style={[styles.text, { color: theme.textPrimary }]} role="alert">
          You aren&apos;t a stylist on any closets yet. Join one from the Home tab first.
        </Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
  },
  text: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
