import DeleteButton from '@/components/DeleteButton';
import HeaderBackButton from '@/components/HeaderBackButton';
import OutfitFlatLay from '@/components/OutfitFlatLay';
import { useDataMode } from '@/context/DataModeContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { getErrorMessage, type ClosetItem, type ClosetItemPhoto, type Outfit } from '@/services/dataService.types';
import { pickLibraryImages } from '@/utils/pickLibraryImages';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image'; // High-perf native component
import { Link, Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  itemId: string;
};

// Up to this many secondary photos are shown below the primary image.
const MAX_SECONDARY_PHOTOS = 3;

/** Rows shown in the "Item Details" section, in display order. */
function getDetailFields(item: ClosetItem): { label: string; value: string | null }[] {
  return [
    { label: 'Description', value: item.description },
    { label: 'Brand', value: item.brand },
    { label: 'Fit notes', value: item.fit_notes },
    { label: 'Care instructions', value: item.care_instructions },
  ];
}

export default function ClothingItemDetail({ itemId }: Props) {
  const { dataService } = useDataMode();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [featuredOutfits, setFeaturedOutfits] = useState<Outfit[]>([]);
  const [photos, setPhotos] = useState<ClosetItemPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const { confirmAndDelete, isDeleting } = useDeleteConfirm({
    confirmTitle: 'Delete item',
    confirmMessage: `Delete "${item?.name ?? 'this item'}"? This will remove the item from every outfit it is currently a part of, but the outfits will otherwise remain.  this can't be undone.`,
    errorTitle: "Couldn't delete item",
    onDelete: () => dataService.deleteClosetItem(itemId),
  });

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
        setPhotos(fetchedItem?.secondary_photos ?? []);
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

  const handleAddPhoto = async () => {
    const [uri] = await pickLibraryImages(false);
    if (!uri) return;

    setIsAddingPhoto(true);
    try {
      const photo = await dataService.addClosetItemPhoto(itemId, uri);
      setPhotos(prev => [...prev, photo]);
    } catch (err) {
      Alert.alert("Couldn't add photo", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsAddingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (previewIndex === null) return;
    const photo = photos[previewIndex];
    if (!photo) return;

    setIsDeletingPhoto(true);
    try {
      await dataService.deleteClosetItemPhoto(photo);
      setPhotos(prev => prev.filter(candidate => candidate.id !== photo.id));
      setPreviewIndex(null);
    } catch (err) {
      Alert.alert("Couldn't delete photo", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  } else if (error) {
    content = (
      <View style={styles.container}>
        <Text style={styles.text}>{error}</Text>
      </View>
    );
  } else if (!item) {
    content = (
      <View style={styles.container}>
        <Text style={styles.text}>Item not found!</Text>
      </View>
    );
  } else {
    const secondaryPhotos = photos.slice(0, MAX_SECONDARY_PHOTOS);
    const detailFields = getDetailFields(item);

    content = (
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
          <Text accessibilityRole="header" style={styles.sectionLabel}>
            More photos
          </Text>
          {secondaryPhotos.length === 0 ? (
            <Text style={styles.emptyText}>
              Add some photos of the garment in different lighting or a close up of the fabric here
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollRow}>
            {secondaryPhotos.map((photo, index) => (
              <Pressable
                key={photo.id}
                style={styles.photoThumb}
                onPress={() => setPreviewIndex(index)}
                accessibilityRole="button"
                accessibilityLabel={`Photo ${index + 1} of ${secondaryPhotos.length}`}
              >
                <Image source={photo.image_url} style={styles.photoThumbImage} contentFit="cover" />
              </Pressable>
            ))}

            {secondaryPhotos.length < MAX_SECONDARY_PHOTOS ? (
              <Pressable
                onPress={handleAddPhoto}
                disabled={isAddingPhoto}
                style={[styles.photoThumb, styles.addPhotoThumb]}
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
                accessibilityState={{ disabled: isAddingPhoto }}
              >
                <Text style={styles.addPhotoThumbText}>{isAddingPhoto ? '…' : '+'}</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <Text accessibilityRole="header" style={styles.sectionLabel}>
            Item Details
          </Text>
          <View style={styles.detailsList}>
            {detailFields.map(({ label, value }) => (
              <View
                key={label}
                style={styles.detailRow}
                accessible
                accessibilityLabel={`${label}: ${value ?? 'No info yet'}`}
              >
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={value ? styles.text : styles.emptyText}>{value ?? 'No info yet'}</Text>
              </View>
            ))}
          </View>

          <Text accessibilityRole="header" style={styles.sectionLabel}>
            Featured in outfits
          </Text>
          {featuredOutfits.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollRow}>
              {featuredOutfits.map(outfit => (
                <Link key={outfit.outfit_id} href={`/outfit/${outfit.outfit_id}`} asChild>
                  <Pressable
                    style={styles.outfitThumb}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`View outfit: ${outfit.name}`}
                  >
                    <OutfitFlatLay itemIds={outfit.item_ids} closetItems={closetItems} style={styles.outfitFlatLay} />
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>Not featured in any outfits yet.</Text>
          )}

          <DeleteButton label="Delete item" onPress={confirmAndDelete} isDeleting={isDeleting} />
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
                source={secondaryPhotos[previewIndex].image_url}
                style={styles.modalImage}
                contentFit="contain"
                accessibilityLabel={`Photo ${previewIndex + 1} of ${secondaryPhotos.length}`}
              />
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.deleteImageButton}
                onPress={handleDeletePhoto}
                disabled={isDeletingPhoto}
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
                accessibilityState={{ disabled: isDeletingPhoto }}
              >
                <Ionicons name="trash-outline" size={22} color="#fff" />
              </Pressable>

              <Pressable
                style={styles.closeButton}
                onPress={() => setPreviewIndex(null)}
                accessibilityRole="button"
                accessibilityLabel="Close image preview"
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: item?.name ?? 'Item details', headerLeft: HeaderBackButton }} />
      {content}
    </>
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
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 12,
  },
  horizontalScrollRow: {
    width: '100%',
  },
  photoThumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f6f6f6',
    marginRight: 12,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  addPhotoThumb: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoThumbText: {
    fontSize: 28,
    color: '#999',
  },
  detailsList: {
    width: '100%',
  },
  detailRow: {
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
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
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
  deleteImageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
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
