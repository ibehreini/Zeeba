import type { ClosetItem } from '@/services/dataService.types';
import { StyleSheet, View } from 'react-native';
import ClothingItem from './ClothingItem';

type Props = {
  items: ClosetItem[];
  onItemPress: (id: string) => void;
  /** When provided, renders each card as selectable (used by the outfit item picker). Omit for read-only grids. */
  isItemSelected?: (itemId: string) => boolean;
};

export default function ClosetRow({ items, onItemPress, isItemSelected }: Props) {
  return (
    <View style={styles.row}>
      {items.map(item => (
        <View key={item.item_id} style={styles.itemWrapper}>
          <ClothingItem
            source={item.img}
            accessibilityLabel={item.name}
            onPress={() => onItemPress(item.item_id)}
            selected={isItemSelected?.(item.item_id)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Wraps into a 2-column grid; flex-start (not space-between) keeps a
    // trailing odd item flush left instead of stretching to fill the row.
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  itemWrapper: {
    width: '48%',
    margin: '1%',
  },
});