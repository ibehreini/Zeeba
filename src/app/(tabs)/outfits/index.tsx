import ErrorText from '@/components/ErrorText';
import LoadingIndicator from '@/components/LoadingIndicator';
import OutfitsGrid from '@/components/OutfitsGrid';
import { useCloset } from '@/context/ClosetContext';
import { useTheme } from '@/context/ThemeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function Index() {
  // See src/app/(tabs)/index.tsx - the web tab view keeps inactive tabs
  // mounted (only hidden via zIndex/pointer-events), so NVDA still reads
  // this screen after navigating away unless we aria-hide it ourselves.
  const isFocused = useIsFocused();
  const router = useRouter();
  const { theme } = useTheme();
  const { closetMode, activeClosetId, activeClosetName, activeClosetLabels, isLoading, error, refreshActiveClosetLabels } =
    useCloset();

  // Picks up tag edits made in Settings > Edit tags, by the closet owner, or
  // on another device since the closet was loaded.
  useFocusEffect(
    useCallback(() => {
      refreshActiveClosetLabels();
    }, [refreshActiveClosetLabels]),
  );

  const closetLabel = activeClosetName ?? 'Closet';
  const title = closetMode === 'stylist' ? `${closetLabel} outfits (stylist)` : `${closetLabel} outfits`;

  const handleNavigation = (id: string) => {
    router.push({
      pathname: '/outfit/[id]',
      params: { id },
    });
  };

  const headerRight = () => (
    // Visually just a plus; the accessibilityLabel keeps the full action name
    // for screen readers on every platform.
    <Pressable
      onPress={() => router.push('/outfits/new')}
      style={styles.addButton}
      accessibilityRole="button"
      accessibilityLabel="Create new outfit"
      hitSlop={8}
    >
      <Ionicons name="add" size={28} color={theme.textPrimary} />
    </Pressable>
  );

  let content;
  if (isLoading) {
    content = (
      <View style={styles.centered}>
        <LoadingIndicator label="Loading outfits" />
      </View>
    );
  } else if (error) {
    content = (
      <View style={styles.centered}>
        <ErrorText style={[styles.errorText, { color: theme.danger }]}>{error}</ErrorText>
      </View>
    );
  } else if (!activeClosetId) {
    content = (
      <View style={styles.centered}>
        <ErrorText style={[styles.errorText, { color: theme.danger }]}>
          {closetMode === 'stylist' ? "You aren't a stylist on any closets yet." : 'No closet found.'}
        </ErrorText>
      </View>
    );
  } else {
    content = (
      <View style={styles.container}>
        <OutfitsGrid closetId={activeClosetId} labels={activeClosetLabels} onOutfitPress={handleNavigation} />
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
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  addButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
