import { toRNImageSource, type ClosetItem } from '@/services/dataService.types';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

type OutfitFlatLayProps = {
  itemIds: readonly string[];
  closetItems: ClosetItem[];
  style?: ViewStyle;
};

// Column 1: jacket (optional) on top, then a bag/purse, then shoes -
// stacked in that fixed order, one below the other.
const COLUMN_1_ORDER: ClosetItem['category'][] = ['jacket', 'bag', 'shoes'];

// Column 2: the main garment(s) - a top+bottom pairing, or a single
// dress/romper.
const MAIN_CATEGORIES = new Set(['top', 'bottom', 'dress']);

// Column 3 fits at most 5 accessories (jewelry, sunglasses, etc.); the grid
// resizes its cells based on how many are present.
const MAX_ACCESSORIES = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    rows.push(arr.slice(i, i + size));
  }
  return rows;
}

export default function OutfitFlatLay({ itemIds, closetItems, style }: OutfitFlatLayProps) {
  const itemsById = new Map(closetItems.map(item => [item.item_id, item]));
  const items = itemIds.map(id => itemsById.get(id)).filter((item): item is ClosetItem => Boolean(item));

  const column1Items = COLUMN_1_ORDER.map(category =>
    items.find(item => item.category === category),
  ).filter((item): item is ClosetItem => Boolean(item));

  const mainItems = items.filter(item => MAIN_CATEGORIES.has(item.category));
  const accessoryItems = items
    .filter(item => item.category === 'accessory')
    .slice(0, MAX_ACCESSORIES);

  const accessoryCols = accessoryItems.length > 1 ? 2 : 1;
  const accessoryRows = chunk(accessoryItems, accessoryCols);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        {column1Items.length > 0 && (
          <View style={styles.column}>
            {column1Items.map(item => (
              <View key={item.item_id} style={styles.stackedCell}>
                <Image source={toRNImageSource(item.img)} style={styles.image} resizeMode="contain" />
              </View>
            ))}
          </View>
        )}

        {mainItems.length > 0 && (
          <View style={[styles.column, styles.mainColumn]}>
            {mainItems.map(item => (
              <View key={item.item_id} style={styles.stackedCell}>
                <Image source={toRNImageSource(item.img)} style={styles.image} resizeMode="contain" />
              </View>
            ))}
          </View>
        )}

        {accessoryItems.length > 0 && (
          <View style={styles.column}>
            {accessoryRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.accessoryRow}>
                {row.map(item => (
                  <View key={item.item_id} style={styles.accessoryCell}>
                    <Image source={toRNImageSource(item.img)} style={styles.image} resizeMode="contain" />
                  </View>
                ))}
                {/* Pad an incomplete last row so its cells stay the same
                    size as the rest instead of stretching to fill. */}
                {row.length < accessoryCols &&
                  Array.from({ length: accessoryCols - row.length }).map((_, i) => (
                    <View key={`spacer-${i}`} style={styles.accessorySpacer} />
                  ))}
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
  column: {
    flex: 1,
    gap: 8,
  },
  mainColumn: {
    flex: 1.3,
  },
  // Shared by column 1 (jacket/bag/shoes) and column 2 (main garment):
  // cells split the column's height evenly, so 1 item fills it and 2+
  // items split it cleanly.
  stackedCell: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Accessories: a dynamic grid - rows/cells grow or shrink to fill the
  // column based on how many accessories are present.
  accessoryRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  accessoryCell: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessorySpacer: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
