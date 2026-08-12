import ClosetList from '@/components/ClosetList';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { getErrorMessage, groupClosetItemsBySection, type ClosetSection } from '@/services/dataService.types';
import { Stack, useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  // See src/app/(tabs)/index.tsx - the web tab view keeps inactive tabs
  // mounted (only hidden via zIndex/pointer-events), so NVDA still reads
  // this screen after navigating away unless we aria-hide it ourselves.
  const isFocused = useIsFocused();
  const router = useRouter();
  const { dataService } = useDataMode();
  const {
    closetMode,
    activeClosetId,
    activeClosetName,
    isLoading: closetLoading,
    error: closetError,
  } = useCloset();

  const closetLabel = activeClosetName ?? 'Closet';
  const title = closetMode === 'stylist' ? `Styling for ${closetLabel}` : closetLabel;

  const [sections, setSections] = useState<ClosetSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refetches every time this tab regains focus (not just on mount), so an
  // item created via /closet/new shows up the moment the user comes back.
  useFocusEffect(
    useCallback(() => {
      if (!activeClosetId) return;

      let cancelled = false;
      setSections(null);
      setError(null);

      dataService
        .getClosetItems(activeClosetId)
        .then(items => {
          if (!cancelled) setSections(groupClosetItemsBySection(items));
        })
        .catch(err => {
          if (!cancelled) setError(getErrorMessage(err, 'Failed to load closet items.'));
        });

      return () => {
        cancelled = true;
      };
    }, [dataService, activeClosetId]),
  );

  const handleNavigation = (id: string) => {
    router.push({
      pathname: '/item/[id]',
      params: { id },
    });
  };

  const headerRight = () => (
    <Pressable
      onPress={() => router.push('/closet/new')}
      style={styles.addButton}
      accessibilityRole="button"
      accessibilityLabel="Add new item"
      hitSlop={8}
    >
      <Text style={styles.addButtonText}>Add New</Text>
    </Pressable>
  );

  let content;
  if (closetLoading) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  } else if (closetError) {
    content = (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{closetError}</Text>
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
  } else if (error) {
    content = (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  } else if (!sections) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  } else {
    content = <ClosetList items={sections} onItemPress={handleNavigation} />;
  }

  return (
    <>
      <Stack.Screen options={{ headerRight: Platform.OS === 'web' ? undefined : headerRight, title }} />
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
