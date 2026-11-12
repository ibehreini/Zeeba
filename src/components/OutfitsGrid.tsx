import ErrorText from '@/components/ErrorText';
import LoadingIndicator from '@/components/LoadingIndicator';
import FilterPills from '@/components/FilterPills';
import OutfitFlatLay from '@/components/OutfitFlatLay';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  getErrorMessage,
  hasOutfitLabel,
  type ClosetItem,
  type Outfit,
} from '@/services/dataService.types';
import { consumeOutfitsDirty } from '@/state/outfitsRefresh';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  onOutfitPress?: (id: string) => void;
  /** Restricts the grid to outfits from one closet; omit to show every closet the user can see. */
  closetId?: string;
  /** The closet's outfit tags in display order - one filter pill each. Empty or omitted hides the filter row. */
  labels?: readonly string[];
};

const NO_LABELS: readonly string[] = [];

export default function OutfitsGrid({ onOutfitPress, closetId, labels = NO_LABELS }: Props) {
  const { dataService } = useDataMode();
  const { theme } = useTheme();
  const [outfits, setOutfits] = useState<Outfit[] | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

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

  // Derived while rendering, not reset in an effect: if the selected tag is
  // removed in Settings the grid falls back to "All" in the same frame, and
  // the choice comes back if the removal is undone.
  const activeLabel = selectedLabel !== null && labels.includes(selectedLabel) ? selectedLabel : null;

  // Case- and space-insensitive, so outfits tagged "Date Night" still match a
  // pill re-added as "Date night" after the original was removed.
  // One VoiceOver stop per card that says what's in it, since the flat lay
  // picture is all a sighted user needs but says nothing to a screen reader.
  const namesById = new Map(closetItems.map(item => [item.item_id, item.name]));
  const cardLabel = (outfit: Outfit) => {
    const pieces = outfit.item_ids.map(id => namesById.get(id)).filter(Boolean);
    return `${outfit.name}: ${pieces.length > 0 ? pieces.join(', ') : 'no items'}`;
  };

  const visibleOutfits = activeLabel
    ? (outfits ?? []).filter(outfit => hasOutfitLabel(outfit.labels, activeLabel))
    : (outfits ?? []);
  const resultSummary = !outfits
    ? undefined
    : visibleOutfits.length === 0
      ? 'No outfits match this filter'
      : `Showing ${visibleOutfits.length} ${visibleOutfits.length === 1 ? 'outfit' : 'outfits'}${activeLabel ? ` tagged ${activeLabel}` : ''}`;

  return (
    <View style={styles.container}>
      <Text role="heading" style={[styles.heading, { color: theme.textPrimary }]}>
        My outfits
      </Text>

      {/* An "All"-only row would filter nothing, so it's left out entirely
          when the closet has no tags. */}
      {labels.length > 0 && <FilterPills options={labels} selected={activeLabel} onSelect={setSelectedLabel} resultSummary={resultSummary} />}

      {error ? (
        <ErrorText style={[styles.emptyText, { color: theme.textSecondary }]}>{error}</ErrorText>
      ) : !outfits ? (
        <LoadingIndicator label="Loading outfits" />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {visibleOutfits.length > 0 ? (
            <View style={styles.grid}>
              {visibleOutfits.map(outfit => (
                <Pressable
                  key={outfit.outfit_id}
                  style={styles.card}
                  onPress={() => onOutfitPress?.(outfit.outfit_id)}
                  role="button"
                  aria-label={cardLabel(outfit)}
                >
                  <OutfitFlatLay itemIds={outfit.item_ids} closetItems={closetItems} />
                  <Text style={[styles.cardLabel, { color: theme.textPrimary }]} numberOfLines={2}>
                    {outfit.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No outfits match this filter.</Text>
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
    // Caps the two-column grid on wide (desktop web) windows so each square
    // card stays ~320px instead of filling half the viewport. Phone screens
    // (native and PWA) sit under the cap, so nothing changes there.
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  card: {
    width: '48%',
    marginBottom: 16,
  },
  cardLabel: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
  },
});
