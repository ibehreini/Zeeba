import { ClothingItemMap } from '@/constants/closetData';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

type OutfitFlatLayProps = {
  itemIds: readonly string[];
  style?: ViewStyle;
};

// Tops, bottoms, and dresses are the "main" garments and always go in the
// left column. Everything else (shoes, accessories) is smaller and goes
// in the right column.
const LEFT_COLUMN_CATEGORIES = new Set(['top', 'bottom', 'dress']);

export default function OutfitFlatLay({ itemIds, style }: OutfitFlatLayProps) {
  const items = itemIds.map(id => ClothingItemMap[id]).filter(Boolean);
  const leftItems = items.filter(item => LEFT_COLUMN_CATEGORIES.has(item.category));
  const rightItems = items.filter(item => !LEFT_COLUMN_CATEGORIES.has(item.category));

  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        {leftItems.length > 0 && (
          <View style={styles.leftColumn}>
            {leftItems.map(item => (
              <View key={item.id} style={styles.leftCell}>
                <Image source={item.img} style={styles.image} resizeMode="contain" />
              </View>
            ))}
          </View>
        )}

        {rightItems.length > 0 && (
          <View style={styles.rightColumn}>
            {rightItems.map(item => (
              <View key={item.id} style={styles.rightCell}>
                <Image source={item.img} style={styles.image} resizeMode="contain" />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    padding: 8,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  // Main garments: stacked evenly, each cell taking an equal share of the
  // column's height so 1 dress fills it and 2+ garments split it cleanly.
  leftColumn: {
    flex: 2,
    gap: 8,
  },
  leftCell: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Shoes/accessories: fixed-size square tiles that wrap onto new rows, so
  // any number of items lays out the same way without stretching the grid.
  rightColumn: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    gap: 6,
  },
  rightCell: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#f6f6f6',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
