import OutfitsGrid from '@/components/OutfitsGrid';
import { useCloset } from '@/context/ClosetContext';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  // See src/app/(tabs)/index.tsx - the web tab view keeps inactive tabs
  // mounted (only hidden via zIndex/pointer-events), so NVDA still reads
  // this screen after navigating away unless we aria-hide it ourselves.
  const isFocused = useIsFocused();
  const router = useRouter();
  const { closetMode, activeClosetId, activeClosetName, isLoading, error } = useCloset();

  const closetLabel = activeClosetName ?? 'Closet';
  const title = closetMode === 'stylist' ? `Styling for ${closetLabel} outfits` : `${closetLabel} outfits`;

  const handleNavigation = (id: string) => {
    router.push({
      pathname: '/outfit/[id]',
      params: { id },
    });
  };

  const headerRight = () => (
    <Pressable
      onPress={() => router.push('/outfits/new')}
      style={styles.addButton}
      accessibilityRole="button"
      accessibilityLabel="Create new outfit"
      hitSlop={8}
    >
      <Text style={styles.addButtonText}>Create new Outfit</Text>
    </Pressable>
  );

  let content;
  if (isLoading) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  } else if (error) {
    content = (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  } else if (!activeClosetId) {
    content = (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {closetMode === 'stylist' ? "You aren't a stylist on any closets yet." : 'No closet found.'}
        </Text>
      </View>
    );
  } else {
    content = (
      <View style={styles.container}>
        <OutfitsGrid closetId={activeClosetId} onOutfitPress={handleNavigation} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerRight, title }} />
      <View style={styles.flex} aria-hidden={!isFocused}>
        {content}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#c00',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  addButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
