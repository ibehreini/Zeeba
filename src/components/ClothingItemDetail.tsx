import OutfitFlatLay from '@/components/OutfitFlatLay';
import { useDataMode } from '@/context/DataModeContext';
import { getErrorMessage, type ClosetItem, type Outfit } from '@/services/dataService.types';
import { Image } from 'expo-image'; // High-perf native component
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  itemId: string;
};

// Placeholder "worn in the wild" shots - reuses the same smiley-face stock
// image already used elsewhere as a generic placeholder. Swap these for
// real photos of the item once we have them.
const WORN_IN_THE_WILD_PLACEHOLDERS = [
  require('../../assets/images/clothes/outfit_preview.jpg'),
  require('../../assets/images/clothes/outfit_preview.jpg'),
  require('../../assets/images/clothes/outfit_preview.jpg'),
];

export default function ClothingItemDetail({ itemId }: Props) {
  const { dataService } = useDataMode();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [featuredOutfits, setFeaturedOutfits] = useState<Outfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      dataService.getClosetItemById(itemId),
      dataService.getClosetItems(),
      dataService.getOutfits(),
    ])
      .then(([fetchedItem, allItems, allOutfits]) => {
        if (cancelled) return;
        setItem(fetchedItem);
        setClosetItems(allItems);
        setFeaturedOutfits(allOutfits.filter(outfit => outfit.item_ids.includes(itemId)));
      })
      .catch(err => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load item.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId, dataService]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{error}</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Item not found!</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={item.img}
          style={styles.image}
          contentFit="cover" // Modern prop replacing resizeMode
          transition={200}   // Smooth native fade-in in SDK 55
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={styles.contentContainer}>
        <Text accessibilityRole="header" style={styles.titleText}>{item.name}</Text>
        <Text style={styles.text}>{item.description}</Text>

        <Text accessibilityRole="header" style={styles.sectionLabel}>
          Worn in the wild
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wildRow}>
          {WORN_IN_THE_WILD_PLACEHOLDERS.map((source, index) => (
            <Pressable
              key={index}
              style={styles.wildThumb}
              onPress={() => setPreviewIndex(index)}
              accessibilityRole="button"
              accessibilityLabel={`Worn in the wild photo ${index + 1} of ${WORN_IN_THE_WILD_PLACEHOLDERS.length}`}
            >
              <Image source={source} style={styles.wildThumbImage} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>

        <Text accessibilityRole="header" style={styles.sectionLabel}>
          Featured in outfits
        </Text>
        {featuredOutfits.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.wildRow}>
            {featuredOutfits.map(outfit => (
              <View
                key={outfit.outfit_id}
                style={styles.outfitThumb}
                accessible
                accessibilityRole="image"
                accessibilityLabel={outfit.name}
              >
                <OutfitFlatLay itemIds={outfit.item_ids} closetItems={closetItems} style={styles.outfitFlatLay} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>Not featured in any outfits yet.</Text>
        )}
      </View>

      <Modal
        visible={previewIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewIndex(null)}
      >
        <View style={styles.modalBackdrop}>
          {previewIndex !== null && (
            <Image
              source={WORN_IN_THE_WILD_PLACEHOLDERS[previewIndex]}
              style={styles.modalImage}
              contentFit="contain"
            />
          )}
          <Pressable
            style={styles.closeButton}
            onPress={() => setPreviewIndex(null)}
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  // Centered wrapper for the image to mimic Amazon's frame
  imageContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: 'center',    // Centers the image horizontally
  },
  image: {
    width: '100%',          // Spans full width of its padded parent
    aspectRatio: 1,         // Forces a perfect square dynamically
    borderRadius: 8,        // Optional: slight rounding looks very modern
    backgroundColor: '#f9f9f9',
  },
  text: {
    fontSize: 17,
    lineHeight: 24,
    color: '#333',
  },
  contentContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'flex-start', // Keeps text left-aligned like Amazon
  },
  titleText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f1111',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 12,
  },
  wildRow: {
    width: '100%',
  },
  wildThumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f6f6f6',
    marginRight: 12,
  },
  wildThumbImage: {
    width: '100%',
    height: '100%',
  },
  outfitThumb: {
    width: 96,
    marginRight: 12,
  },
  outfitFlatLay: {
    width: 96,
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '90%',
    height: '70%',
  },
  closeButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f1111',
  },
});
