import OutfitDetailPage from '@/components/outfitDetailPage';
import { useDataMode } from '@/context/DataModeContext';
import type { ClosetItem, Outfit } from '@/services/dataService.types';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const outfitId = Array.isArray(id) ? id[0] : id;
  const { dataService } = useDataMode();

  const [outfit, setOutfit] = useState<Outfit | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load outfit.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [outfitId, dataService]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>{error}</Text>
      </View>
    );
  }

  if (!outfit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Outfit not found.</Text>
      </View>
    );
  }

  return (
    <OutfitDetailPage
      outfit={{
        id: outfit.outfit_id,
        name: outfit.name,
        description: outfit.description,
        itemIds: outfit.item_ids,
      }}
      closetItems={closetItems}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  notFoundText: {
    fontSize: 18,
    color: '#666',
  },
});
