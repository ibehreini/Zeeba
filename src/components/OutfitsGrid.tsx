import FilterPills from '@/components/FilterPills';
import OutfitFlatLay from '@/components/OutfitFlatLay';
import { MyOutfits_Data } from '@/constants/MyOutfitsData';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  onOutfitPress?: (id: string) => void;
};

export default function OutfitsGrid({ onOutfitPress }: Props) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const labelOptions = useMemo(
    () => Array.from(new Set(MyOutfits_Data.flatMap(outfit => outfit.labels))),
    [],
  );

  const visibleOutfits = selectedLabel
    ? MyOutfits_Data.filter(outfit => outfit.labels.includes(selectedLabel))
    : MyOutfits_Data;

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        My outfits
      </Text>

      <FilterPills options={labelOptions} selected={selectedLabel} onSelect={setSelectedLabel} />

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
                <OutfitFlatLay itemIds={outfit.item_ids} />
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
});
