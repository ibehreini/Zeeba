import ClosetList from '@/components/ClosetList';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { getErrorMessage, groupClosetItemsBySection, type ClosetSection } from '@/services/dataService.types';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  const { theme } = useTheme();
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
    // Visually just a plus; the accessibilityLabel keeps the full action name
    // for screen readers on every platform.
    <Pressable
      onPress={() => router.push('/closet/new')}
      style={styles.addButton}
      accessibilityRole="button"
      accessibilityLabel="Add new item"
      hitSlop={8}
    >
      <Ionicons name="add" size={28} color={theme.textPrimary} />
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
        <Text style={[styles.errorText, { color: theme.danger }]}>{closetError}</Text>
      </View>
    );
  } else if (!activeClosetId) {
    content = (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { color: theme.danger }]}>
          {closetMode === 'stylist' ? "You aren't a stylist on any closets yet." : 'No closet found.'}
        </Text>
      </View>
    );
  } else if (error) {
    content = (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
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
      {/* On web, adding items is only enabled for your own closet; native
          keeps the button in stylist mode too. */}
      <Stack.Screen
        options={{
          headerRight: Platform.OS === 'web' && closetMode !== 'my-closet' ? undefined : headerRight,
          title,
        }}
      />

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
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  addButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
});
