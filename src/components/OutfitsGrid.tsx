import FilterPills from '@/components/FilterPills';
import OutfitFlatLay from '@/components/OutfitFlatLay';
import { useDataMode } from '@/context/DataModeContext';
import {
  getErrorMessage,
  OUTFIT_LABELS,
  type ClosetItem,
  type Outfit,
  type OutfitLabel,
} from '@/services/dataService.types';
import { consumeOutfitsDirty } from '@/state/outfitsRefresh';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  onOutfitPress?: (id: string) => void;
  /** Restricts the grid to outfits from one closet; omit to show every closet the user can see. */
  closetId?: string;
};

export default function OutfitsGrid({ onOutfitPress, closetId }: Props) {
  const { dataService } = useDataMode();
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<OutfitLabel | null>(null);

  const fetchOutfits = useCallback(
    (onCancelledRef: { cancelled: boolean }) => {
      setOutfits(null);
      setError(null);

      Promise.all([dataService.getOutfits(closetId), dataService.getClosetItems(closetId)])
        .then(([fetchedOutfits, fetchedClosetItems]) => {
          if (onCancelledRef.cancelled) return;
          setOutfits(fetchedOutfits);
          setClosetItems(fetchedClosetItems);
        })
        .catch(err => {
          if (!onCancelledRef.cancelled) setError(getErrorMessage(err, 'Failed to load outfits.'));
        });
    },
    [dataService, closetId],
  );

  useEffect(() => {
    const ref = { cancelled: false };
    fetchOutfits(ref);
    return () => {
      ref.cancelled = true;
    };
  }, [fetchOutfits]);

  // Refetches when a create/delete elsewhere marked the list stale, so
  // returning to this tab shows the change without needing a full app
  // restart - but skips the refetch when focus regains for an unrelated
  // reason (e.g. just viewing an outfit's detail page and going back).
  useFocusEffect(
    useCallback(() => {
      const ref = { cancelled: false };
      if (consumeOutfitsDirty()) fetchOutfits(ref);
      return () => {
        ref.cancelled = true;
      };
    }, [fetchOutfits]),
  );

  const visibleOutfits = selectedLabel
    ? (outfits ?? []).filter(outfit => outfit.labels.includes(selectedLabel))
    : (outfits ?? []);

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        My outfits
      </Text>

      <FilterPills options={OUTFIT_LABELS} selected={selectedLabel} onSelect={setSelectedLabel} />

      {error ? (
        <Text style={styles.emptyText}>{error}</Text>
      ) : !outfits ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {visibleOutfits.length > 0 ? (
            <View style={styles.grid}>
              {visibleOutfits.map(outfit => (
                <Pressable
                  key={outfit.outfit_id}
                  style={styles.card}
                  onPress={() => onOutfitPress?.(outfit.outfit_id)}
                  accessibilityRole="button"
                  accessibilityLabel={outfit.name}
                >
                  <OutfitFlatLay itemIds={outfit.item_ids} closetItems={closetItems} />
                  <Text style={styles.cardLabel} numberOfLines={1}>
                    {outfit.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No outfits match this filter.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
  },
  heading: {
    color: '#000',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    marginBottom: 16,
  },
  cardLabel: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
  },
  loading: {
    marginTop: 24,
  },
});
