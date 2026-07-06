import type { ClosetSection, ClothingLabel } from '@/constants/closetData';
import FilterPills from '@/components/FilterPills';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ClosetHeader from './ClosetHeader';
import ClosetRow from './ClosetRow';

type Props = {
  onItemPress: (id: string) => void;
  items: ClosetSection[];
};

export default function ClosetList({ items, onItemPress }: Props) {
  const [selectedLabel, setSelectedLabel] = useState<ClothingLabel | null>(null);

  const labelOptions = useMemo(
    () => Array.from(new Set(items.flatMap(section => section.data.flatMap(item => item.labels)))),
    [items],
  );

  const visibleSections = selectedLabel
    ? items
        .map(section => ({
          ...section,
          data: section.data.filter(item => item.labels.includes(selectedLabel)),
        }))
        .filter(section => section.data.length > 0)
    : items;

  return (
    <View style={styles.container}>
      <FilterPills options={labelOptions} selected={selectedLabel} onSelect={setSelectedLabel} />

      <ScrollView contentContainerStyle={styles.listPadding}>
        {visibleSections.length > 0 ? (
          visibleSections.map(section => (
            <View key={section.title} style={styles.section}>
              <ClosetHeader title={section.title} />
              <ClosetRow items={section.data} onItemPress={onItemPress} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No clothing items match this filter.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listPadding: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
  },
});
