import { CATEGORY_SELECTION_LIMITS } from '@/components/OutfitItemPicker';
import type { ClothingCategory } from '@/constants/closetData';
import type { ClosetItem } from '@/services/dataService.types';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

type OutfitFlatLayProps = {
  itemIds: readonly string[];
  closetItems: ClosetItem[];
  style?: ViewStyle;
};

/**
 * The flat lay's three columns, each a list of groups laid out top-to-bottom
 * the way they're worn. Every group is one grid, with `columns` cells per row
 * (0 = one wide cell for a lone item, a pair side by side otherwise).
 *
 * Column 1: jacket(s), then a bag/purse, then shoes, stacked one per row.
 * Column 2: upper-body layers (tops, sweaters, cardigans share a grid so a
 * tee + sweater + cardigan sit in a 2x2 instead of three full-width slivers),
 * then a dress/romper, then bottoms (e.g. tights under a skirt).
 * Column 3: accessories, stacked one per row (pairs in this narrow column
 * were thin slivers).
 */
const COLUMNS: { groups: ClothingCategory[][]; columns: number; flex: number }[] = [
  { groups: [['jacket', 'bag', 'shoes']], columns: 1, flex: 1 },
  { groups: [['top', 'sweater', 'cardigan'], ['dress'], ['bottom']], columns: 0, flex: 1.3 },
  { groups: [['accessory']], columns: 1, flex: 1 },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    rows.push(arr.slice(i, i + size));
  }
  return rows;
}

/**
 * A group of garments laid out as a grid of equal-sized cells (an odd last
 * row keeps its cell at pair size via an invisible spacer).
 *
 * A group shows at most as many cells as the outfit picker lets you pick for
 * its categories, so every new outfit fits in full. Older outfits that go
 * over (picked before the limits existed) show a "+N" last cell rather than
 * silently dropping the extras.
 *
 * The grid grows to `rows` flex units, so when several groups share a column
 * (say three layered tops over one pair of pants) every row across the column
 * ends up the same height instead of the taller group being squashed.
 */
function CellGrid({ items, max, columns }: { items: ClosetItem[]; max: number; columns: number }) {
  const overflow = items.length > max ? items.length - max + 1 : 0;
  const cells: (ClosetItem | number)[] = overflow ? [...items.slice(0, max - 1), overflow] : items;
  const perRow = columns || (cells.length > 1 ? 2 : 1);
  const rows = chunk(cells, perRow);
  return (
    <View style={{ flex: rows.length, gap: 8 }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map(cell => (
            <View key={typeof cell === 'number' ? 'more' : cell.item_id} style={styles.cell}>
              {typeof cell === 'number' ? (
                <Text style={styles.moreText}>+{cell}</Text>
              ) : (
                <Image source={cell.img} style={styles.image} contentFit="contain" cachePolicy="memory-disk" />
              )}
            </View>
          ))}
          {Array.from({ length: perRow - row.length }).map((_, i) => (
            <View key={`spacer-${i}`} style={styles.spacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * A picture of the outfit's pieces. Purely visual: it is hidden from screen
 * readers, and each place that shows it names the outfit or lists its pieces
 * in text instead.
 */
export default function OutfitFlatLay({ itemIds, closetItems, style }: OutfitFlatLayProps) {
  const itemsById = new Map(closetItems.map(item => [item.item_id, item]));
  const items = itemIds.map(id => itemsById.get(id)).filter((item): item is ClosetItem => Boolean(item));
  const byCategories = (categories: ClothingCategory[]) =>
    categories.flatMap(category => items.filter(item => item.category === category));
  const limitOf = (categories: ClothingCategory[]) =>
    categories.reduce((sum, category) => sum + CATEGORY_SELECTION_LIMITS[category], 0);

  // Only the columns this outfit has items for; they share the card's width,
  // and a lone column (just accessories, say) lays out as pairs.
  const columns = COLUMNS.map(column => ({
    ...column,
    groups: column.groups.filter(categories => byCategories(categories).length > 0),
  })).filter(column => column.groups.length > 0);

  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.card, style]}>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No items</Text>
      ) : (
        <View style={styles.row}>
          {columns.map(column => (
            <View key={column.groups[0][0]} style={[styles.column, { flex: column.flex }]}>
              {column.groups.map(categories => (
                <CellGrid
                  key={categories[0]}
                  items={byCategories(categories)}
                  max={limitOf(categories)}
                  columns={columns.length > 1 ? column.columns : 0}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Fixed light colours (not theme tokens) in both themes: the garment photos
// are shot on white, so the card stays a white "table" they're laid out on.
const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    padding: 8,
    justifyContent: 'center',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    gap: 8,
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
  moreText: {
    color: '#595f68',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: '#595f68',
    fontSize: 15,
    textAlign: 'center',
  },
});
