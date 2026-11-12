import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import LoadingIndicator from '@/components/LoadingIndicator';
import NewClosetForm from '@/components/NewClosetForm';
import { useCloset } from '@/context/ClosetContext';

/**
 * Wraps the add-item / create-outfit forms so the user is stopped up front
 * when there's no closet to add to, instead of filling in the whole form and
 * only failing on save: owners without one get the create-closet form.
 */
export default function RequireCloset({ children }: { children: ReactNode }) {
  const { closetMode, isLoading, needsOwnClosetSetup } = useCloset();

  // Don't show the form until we know whether there's a closet, or it could
  // get swapped out from under the user mid-typing.
  if (isLoading) return <LoadingIndicator label="Loading your closet" />;

  // A stylist closet is only ever selected once it's in the loaded list, so
  // only the user's own closet can be missing.
  if (closetMode === 'my-closet' && needsOwnClosetSetup) {
    return (
      <View style={styles.container}>
        <NewClosetForm />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
  },
});
