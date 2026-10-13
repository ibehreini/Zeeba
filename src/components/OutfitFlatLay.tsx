import type { ClothingCategory } from '@/constants/closetData';
import { toRNImageSource, type ClosetItem } from '@/services/dataService.types';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';

type OutfitFlatLayProps = {
  itemIds: readonly string[];
  closetItems: ClosetItem[];
  style?: ViewStyle;
};

// Column 1: jacket(s) on top, then a bag/purse, then shoes - stacked in that
// fixed order, one below the other.
const COLUMN_1_ORDER: ClothingCategory[] = ['jacket', 'bag', 'shoes'];

// Column 2: the main garment(s), laid out top-to-bottom the way they're worn.
// Each inner list is one grid: upper-body layers (tops, sweaters, cardigans)
// share a grid so a tee + sweater + cardigan sit in a 2x2 instead of three
// full-width slivers, then a dress/romper, then bottoms (e.g. tights under a
// skirt).
const MAIN_GROUPS: ClothingCategory[][] = [['top', 'sweater', 'cardigan'], ['dress'], ['bottom']];

// Column 3 fits at most 5 accessories (jewelry, sunglasses, etc.).
const MAX_ACCESSORIES = 5;

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    rows.push(arr.slice(i, i + size));
  }
  return rows;
}

/**
 * A group of garments laid out as a grid of equal-sized cells: one wide cell
 * for a single item, two side by side for a pair, and two-column rows beyond
 * that (an odd last row keeps its cell at pair size via an invisible spacer).
 *
 * The grid grows to `rows` flex units, so when several groups share a column
 * (say three layered tops over one pair of pants) every row across the column
 * ends up the same height instead of the taller group being squashed.
 */
function CellGrid({ items, columns = items.length > 1 ? 2 : 1 }: { items: ClosetItem[]; columns?: number }) {
  const rows = chunk(items, columns);
  return (
    <View style={{ flex: rows.length, gap: 8 }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map(item => (
            <View key={item.item_id} style={styles.cell}>
              <Image source={toRNImageSource(item.img)} style={styles.image} resizeMode="contain" />
            </View>
          ))}
          {Array.from({ length: columns - row.length }).map((_, i) => (
            <View key={`spacer-${i}`} style={styles.spacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function OutfitFlatLay({ itemIds, closetItems, style }: OutfitFlatLayProps) {
  const itemsById = new Map(closetItems.map(item => [item.item_id, item]));
  const items = itemIds.map(id => itemsById.get(id)).filter((item): item is ClosetItem => Boolean(item));
  const byCategory = (category: ClothingCategory) => items.filter(item => item.category === category);

  // Everything is grouped by category rather than capped at one each, so an
  // outfit with two jackets or two bags simply stacks both instead of the
  // second one silently vanishing from the flat lay.
  const column1Items = COLUMN_1_ORDER.flatMap(byCategory);
  const mainGroups = MAIN_GROUPS.map(categories => categories.flatMap(byCategory)).filter(group => group.length > 0);
  const accessoryItems = byCategory('accessory').slice(0, MAX_ACCESSORIES);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        {column1Items.length > 0 && (
          <View style={styles.column}>
            <CellGrid items={column1Items} columns={1} />
          </View>
        )}

        {mainGroups.length > 0 && (
          <View style={[styles.column, styles.mainColumn]}>
            {mainGroups.map(group => (
              <CellGrid key={group[0].category} items={group} />
            ))}
          </View>
        )}

        {accessoryItems.length > 0 && (
          <View style={styles.column}>
            <CellGrid items={accessoryItems} />
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
  cell: {
    flex: 1,
    backgroundColor: '#f6f6f6',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
