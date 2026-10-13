import FilterPills from '@/components/FilterPills';
import type { ClothingCategory } from '@/constants/closetData';
import { useTheme } from '@/context/ThemeContext';
import { CATEGORY_TITLES, type ClosetSection } from '@/services/dataService.types';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ClosetHeader from './ClosetHeader';
import ClosetRow from './ClosetRow';

type Props = {
  onItemPress: (id: string) => void;
  items: ClosetSection[];
};

const getCategoryTitle = (category: ClothingCategory) => CATEGORY_TITLES[category];

export default function ClosetList({ items, onItemPress }: Props) {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | null>(null);

  // Only categories that actually have items get a pill, so an empty closet
  // shows just "All" and the user never lands on an empty filter. If the
  // selected category's last item is deleted, the filter falls back to All.
  const categories = items.map(section => section.category);
  const visibleSections =
    selectedCategory && categories.includes(selectedCategory)
      ? items.filter(section => section.category === selectedCategory)
      : items;

  return (
    <View style={styles.container}>
      {items.length > 0 && (
        <FilterPills
          options={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          getLabel={getCategoryTitle}
        />
      )}
      <ScrollView contentContainerStyle={styles.listPadding}>
        {items.length > 0 ? (
          visibleSections.map(section => (
            <View key={section.title} style={styles.section}>
              <ClosetHeader title={section.title} count={section.data.length} />
              <ClosetRow items={section.data} onItemPress={onItemPress} />
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No clothing items yet.</Text>
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
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 24,
  },
});
