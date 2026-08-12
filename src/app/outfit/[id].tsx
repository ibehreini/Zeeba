import HeaderBackButton from '@/components/HeaderBackButton';
import OutfitDetailPage from '@/components/outfitDetailPage';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { getErrorMessage, type ClosetItem, type Outfit } from '@/services/dataService.types';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const outfitId = Array.isArray(id) ? id[0] : id;
  const { theme } = useTheme();
  const { dataService } = useDataMode();

  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!outfitId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all([dataService.getOutfitById(outfitId), dataService.getClosetItems()])
      .then(([fetchedOutfit, fetchedClosetItems]) => {
        if (cancelled) return;
        setOutfit(fetchedOutfit);
        setClosetItems(fetchedClosetItems);
      })
      .catch(err => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load outfit.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [outfitId, dataService, refreshKey]);

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator />
      </View>
    );
  } else if (error) {
    content = (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>{error}</Text>
      </View>
    );
  } else if (!outfit) {
    content = (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>Outfit not found.</Text>
      </View>
    );
  } else {
    content = (
      // Keyed on updated_at: the detail page seeds photos/compliment count
      // into local state, so a conflict-triggered refetch must remount it or
      // those sections keep showing the stale pre-refresh values.
      <OutfitDetailPage
        key={outfit.updated_at}
        outfit={{
          id: outfit.outfit_id,
          closetId: outfit.closet_id,
          name: outfit.name,
          description: outfit.description,
          itemIds: outfit.item_ids,
          photos: outfit.photos,
          complimentCount: outfit.compliment_count,
          updatedAt: outfit.updated_at,
        }}
        closetItems={closetItems}
        onConflict={() => setRefreshKey(key => key + 1)}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: outfit?.name ?? 'Outfit', headerLeft: () => <HeaderBackButton /> }} />
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 18,
  },
});
