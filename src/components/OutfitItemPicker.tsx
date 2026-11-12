import ClosetRow from '@/components/ClosetRow';
import ErrorText from '@/components/ErrorText';
import { Field } from '@/components/FormField';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useToast } from '@/components/Toast';
import type { ClothingCategory } from '@/constants/closetData';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  CATEGORY_TITLES,
  getErrorMessage,
  groupClosetItemsByAllCategories,
  type ClosetItem,
} from '@/services/dataService.types';
import { showAlert } from '@/utils/alert';
import { announceForScreenReader, moveScreenReaderFocus } from '@/utils/announce';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const itemCount = (n: number) => `${n} ${n === 1 ? 'item' : 'items'} in this outfit.`;

/**
 * Max picks per clothing category, mirroring how an outfit is actually worn.
 * Upper-body layers each allow a pair (tee + tank, two sweaters, cardigan +
 * cardigan, vest + coat), bottoms allow a pair for tights/leggings under a
 * skirt, and accessories commonly stack a few (necklace + earrings +
 * bracelet). Dress, shoes, and bag are one-at-a-time; a dress also replaces
 * any top/bottom picks (and vice versa), while sweaters and cardigans still
 * layer over a dress. OutfitFlatLay sizes its groups from these, so any
 * outfit picked within them shows in full there.
 */
export const CATEGORY_SELECTION_LIMITS: Record<ClothingCategory, number> = {
  top: 2,
  sweater: 2,
  cardigan: 2,
  bottom: 2,
  dress: 1,
  shoes: 1,
  jacket: 2,
  bag: 1,
  accessory: 3,
};

/**
 * The "Items" field shared by Create outfit and Edit outfit: loads the
 * closet's items, applies the per-category picking rules, and reports what
 * is picked. `closetId` is the closet the outfit belongs to (null while it
 * isn't known yet). Edit seeds the picks with `setSelectedItemIds`.
 *
 * Picks are kept as plain ids and filtered against the loaded items while
 * rendering, so `reloadItems` (after a failed save) is all it takes to drop
 * an item someone else just deleted.
 */
export function useOutfitItemPicker(closetId: string | null) {
  const { theme } = useTheme();
  const { dataService } = useDataMode();
  const { showToast } = useToast();

  const [picks, setSelectedItemIds] = useState<string[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<ClothingCategory | null>(null);
  const [spoken, setSpoken] = useState('');
  const summaryRef = useRef<Text>(null);
  const chipRefs = useRef(new Map<string, View | null>());

  useEffect(() => {
    if (!closetId) return;
    let cancelled = false;

    dataService
      .getClosetItems(closetId)
      .then(items => {
        if (!cancelled) setClosetItems(items);
      })
      .catch(err => {
        if (!cancelled) setItemsError(getErrorMessage(err, 'Failed to load closet items.'));
      });

    return () => {
      cancelled = true;
    };
  }, [dataService, closetId]);

  const itemById = useMemo(() => new Map((closetItems ?? []).map(item => [item.item_id, item])), [closetItems]);
  const selectedItemIds = closetItems ? picks.filter(id => itemById.has(id)) : picks;
  const pickedIn = (category: ClothingCategory) =>
    selectedItemIds.filter(id => itemById.get(id)?.category === category);

  const closetSections = useMemo(
    () => (closetItems ? groupClosetItemsByAllCategories(closetItems) : []),
    [closetItems],
  );

  // Picks the initial tab once items load: the first category with a picked
  // item (Edit), else the first that has items, else "Tops". Every category
  // tab is always shown (even empty ones) so the picker's layout is stable.
  useEffect(() => {
    if (!closetItems || activeCategory) return;
    const first =
      closetSections.find(section => section.data.some(item => picks.includes(item.item_id))) ??
      closetSections.find(section => section.data.length > 0) ??
      closetSections[0];
    setActiveCategory(first?.category ?? null);
  }, [closetItems, closetSections, activeCategory, picks]);

  const activeSection = closetSections.find(section => section.category === activeCategory) ?? null;
  // The picks in the order they're worn (the tab order), for the summary.
  const pickedItems = closetSections.flatMap(section => section.data.filter(item => selectedItemIds.includes(item.item_id)));

  /** Spoken confirmation of each pick change: VoiceOver on iOS, a live region on web. */
  const announce = (message: string) => {
    announceForScreenReader(message);
    setSpoken(message);
  };

  /**
   * Tapping an item toggles it on/off. Single-select categories (dress,
   * shoes, bag) swap in the new pick instead of requiring the old one to be
   * manually deselected first. Picking a dress clears any picked top/bottom
   * (and vice versa), since an outfit is one or the other, not both.
   * Multi-select categories (tops, bottoms, jackets, accessories) stack up to
   * their limit; tapping past it just shows a message instead of silently
   * dropping an old pick.
   */
  const handleToggleItem = (item: ClosetItem) => {
    const { category } = item;
    const limit = CATEGORY_SELECTION_LIMITS[category];
    const current = pickedIn(category);

    if (current.includes(item.item_id)) {
      setSelectedItemIds(prev => prev.filter(id => id !== item.item_id));
      announce(`Removed ${item.name}. ${itemCount(selectedItemIds.length - 1)}`);
      return;
    }
    if (limit > 1 && current.length >= limit) {
      showAlert('Limit reached', `You can pick up to ${limit} ${CATEGORY_TITLES[category].toLowerCase()} per outfit.`);
      return;
    }

    // These swaps untick other cards out of sight, so say so.
    const replacedIds = [
      ...(limit === 1 ? current : []),
      ...(category === 'dress' ? [...pickedIn('top'), ...pickedIn('bottom')] : []),
      ...(category === 'top' || category === 'bottom' ? pickedIn('dress') : []),
    ];
    const replaced = replacedIds.map(id => itemById.get(id)?.name).join(' and ');
    const count = itemCount(selectedItemIds.length - replacedIds.length + 1);
    announce(replaced ? `Selected ${item.name}, replacing ${replaced}. ${count}` : `Added ${item.name}. ${count}`);
    setSelectedItemIds(prev => [...prev.filter(id => !replacedIds.includes(id)), item.item_id]);
  };

  /**
   * Removes a pick from the summary. Its chip disappears, so focus moves on
   * to the next chip (or the previous, or the summary heading when it was
   * the last one) instead of being dropped at the top of the screen.
   */
  const removeFromSummary = (item: ClosetItem) => {
    const index = pickedItems.indexOf(item);
    const next = pickedItems[index + 1] ?? pickedItems[index - 1];
    handleToggleItem(item);
    moveScreenReaderFocus(next ? chipRefs.current.get(next.item_id) : summaryRef.current);
  };

  /** After a failed save: reload the items and tell the user which picks were deleted meanwhile. */
  const reloadItems = () => {
    if (!closetId) return;
    dataService
      .getClosetItems(closetId)
      .then(items => {
        const ids = new Set(items.map(item => item.item_id));
        const dropped = selectedItemIds.filter(id => !ids.has(id)).length;
        setClosetItems(items);
        if (dropped > 0) showToast(`Removed ${dropped} deleted ${dropped === 1 ? 'item' : 'items'} from your picks.`);
      })
      .catch(() => {});
  };

  const field = (
    <Field label="Items" required>
      {itemsError ? (
        <ErrorText style={[styles.messageText, { color: theme.danger }]}>{itemsError}</ErrorText>
      ) : !closetItems ? (
        <LoadingIndicator label="Loading your clothes" />
      ) : closetItems.length === 0 ? (
        <Text style={[styles.messageText, { color: theme.danger }]}>No items in this closet yet.</Text>
      ) : (
        <>
          {Platform.OS === 'web' && (
            <Text role="status" aria-live="polite" style={styles.srOnly}>
              {spoken}
            </Text>
          )}
          {/* One screen-reader stop reads the whole outfit (a heading, so
              it's also on the VoiceOver rotor); the chips after it are only
              there to remove a pick without hunting for its tab. */}
          <Text
            ref={summaryRef}
            role="heading"
            aria-label={
              pickedItems.length === 0
                ? 'In this outfit: no items picked yet.'
                : `In this outfit, ${pickedItems.length === 1 ? '1 item' : `${pickedItems.length} items`}: ${pickedItems.map(item => item.name).join(', ')}.`
            }
            style={[styles.summaryText, { color: theme.textSecondary }]}
          >
            {pickedItems.length === 0 ? 'No items picked yet.' : `In this outfit (${pickedItems.length})`}
          </Text>
          {pickedItems.length > 0 && (
            <View style={styles.chipRow}>
              {pickedItems.map(item => (
                <Pressable
                  key={item.item_id}
                  ref={node => {
                    chipRefs.current.set(item.item_id, node);
                  }}
                  onPress={() => removeFromSummary(item)}
                  role="button"
                  aria-label={`Remove ${item.name} from outfit`}
                  style={({ pressed }) => [
                    styles.chip,
                    { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    pressed && styles.tabPressed,
                  ]}
                >
                  <Text numberOfLines={1} style={[styles.chipText, { color: theme.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.chipText, { color: theme.textSecondary }]}>✕</Text>
                </Pressable>
              ))}
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
            role="tablist"
          >
            {closetSections.map(section => {
              const isActive = section.category === activeCategory;
              const picked = pickedIn(section.category).length;
              return (
                <Pressable
                  key={section.category}
                  onPress={() => setActiveCategory(section.category)}
                  role="tab"
                  aria-label={picked ? `${section.title}, ${picked} picked` : section.title}
                  aria-selected={isActive}
                  style={({ pressed }) => [
                    styles.tab,
                    { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    isActive && { backgroundColor: theme.accent, borderColor: theme.accent },
                    pressed && styles.tabPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: theme.textPrimary },
                      isActive && { color: theme.onAccent },
                    ]}
                  >{picked ? `${section.title} (${picked})` : section.title}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {activeSection && activeSection.data.length === 0 ? (
            <Text style={[styles.emptyTabText, { color: theme.textSecondary }]}>No {activeSection.title.toLowerCase()} in this closet yet.</Text>
          ) : (
            activeSection && (
              <ClosetRow
                items={activeSection.data}
                onItemPress={id => {
                  const item = itemById.get(id);
                  if (item) handleToggleItem(item);
                }}
                isItemSelected={id => selectedItemIds.includes(id)}
              />
            )
          )}
        </>
      )}
    </Field>
  );

  return {
    field,
    selectedItemIds,
    setSelectedItemIds,
    reloadItems,
    /** For the form's "Still needed: …" list. */
    missing: selectedItemIds.length === 0 && 'at least one clothing item',
  };
}

const styles = StyleSheet.create({
  summaryText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 14,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  tabRow: {
    gap: 8,
    paddingBottom: 12,
  },
  tab: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
  },
  emptyTabText: {
    fontSize: 15,
    paddingHorizontal: 10,
  },
});
