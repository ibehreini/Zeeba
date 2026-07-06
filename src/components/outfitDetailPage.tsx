import OutfitFlatLay from '@/components/OutfitFlatLay';
import { toRNImageSource, type ClosetItem } from '@/services/dataService.types';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

type OutfitDetailItem = {
  id: string;
  name: string | null;
  description?: string | null;
  itemIds: readonly string[];
};

type Props = {
  outfit: OutfitDetailItem;
  closetItems: ClosetItem[];
};

export default function OutfitDetailPage({ outfit, closetItems }: Props) {
  const itemsById = new Map(closetItems.map(item => [item.item_id, item]));
  const pieces = outfit.itemIds.map(itemId => itemsById.get(itemId)).filter((item): item is ClosetItem => Boolean(item));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${outfit.name ?? 'Outfit'} preview`}
        style={styles.flatLayWrapper}
      >
        <OutfitFlatLay itemIds={outfit.itemIds} closetItems={closetItems} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{outfit.name ?? 'Untitled outfit'}</Text>
        {outfit.description ? <Text style={styles.description}>{outfit.description}</Text> : null}

        <Text accessibilityRole="header" style={styles.sectionLabel}>
          Pieces in this outfit
        </Text>

        {pieces.length > 0 ? (
          <View style={styles.pieceGrid}>
            {pieces.map(item => (
              <View
                key={item.item_id}
                accessible
                accessibilityRole="image"
                accessibilityLabel={item.name}
                style={styles.pieceBox}
              >
                <Image source={toRNImageSource(item.img)} style={styles.pieceImage} resizeMode="contain" />
                <Text style={styles.pieceLabel} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No clothing items for this outfit yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  flatLayWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f1111',
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: '#555',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 8,
    marginBottom: 12,
  },
  pieceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pieceBox: {
    width: 84,
    alignItems: 'center',
  },
  pieceImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#f6f6f6',
  },
  pieceLabel: {
    marginTop: 6,
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
  },
});
