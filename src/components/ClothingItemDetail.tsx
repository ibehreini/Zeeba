import ErrorText from '@/components/ErrorText';
import LoadingIndicator from '@/components/LoadingIndicator';
import DeleteButton from '@/components/DeleteButton';
import EditButton from '@/components/EditButton';
import HeaderBackButton from '@/components/HeaderBackButton';
import NoAccessScreen from '@/components/NoAccessScreen';
import OutfitFlatLay from '@/components/OutfitFlatLay';
import PhotoPreviewModal from '@/components/PhotoPreviewModal';
import ShareLinkButton from '@/components/ShareLinkButton';
import VoiceNotesSection from '@/components/VoiceNotes';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { getErrorMessage, type ClosetItem, type ClosetItemPhoto, type Outfit } from '@/services/dataService.types';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { pickPhoto } from '@/utils/pickPhoto';
import { isCutoutPhotoUrl } from '@/utils/removeBackground';
import { showAlert } from '@/utils/alert';
import { announceForScreenReader } from '@/utils/announce';
import { Image } from 'expo-image'; // High-perf native component
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  itemId: string;
};

// Up to this many secondary photos are shown below the primary image.
const MAX_SECONDARY_PHOTOS = 3;

/** Rows shown in the "Item Details" section, in display order. */
function getDetailFields(item: ClosetItem): { label: string; value: string | null; isLink?: boolean }[] {
  return [
    { label: 'Description', value: item.description },
    { label: 'Brand', value: item.brand },
    { label: 'Fit notes', value: item.fit_notes },
    { label: 'Care instructions', value: item.care_instructions },
    { label: 'Purchase URL', value: item.purchase_url, isLink: true },
  ];
}

export default function ClothingItemDetail({ itemId }: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const { dataService } = useDataMode();
  const [item, setItem] = useState<ClosetItem | null>(null);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [featuredOutfits, setFeaturedOutfits] = useState<Outfit[]>([]);
  const [wearCount, setWearCount] = useState(0);
  const [photos, setPhotos] = useState<ClosetItemPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { confirmAndDelete, isDeleting } = useDeleteConfirm({
    confirmTitle: 'Delete item',
    confirmMessage: `Delete "${item?.name ?? 'this item'}"? This will remove the item from every outfit it is currently a part of, but the outfits will otherwise remain. This can't be undone.`,
    errorTitle: "Couldn't delete item",
    successMessage: 'Item deleted',
    onDelete: async () => {
      await dataService.deleteClosetItem(itemId, item!.updated_at);
      // outfit_items rows cascade-delete in the DB, but the outfits tab caches
      // its closet items - flag it so flat lays drop this item on next focus.
      markOutfitsDirty();
    },
    onConflict: () => setRefreshKey(key => key + 1),
    isGone: async () => !(await dataService.getClosetItemById(itemId)),
  });

  // Focus-based rather than mount-only: returning here after deleting an
  // outfit deeper in the stack must refresh "Featured in outfits", or the
  // deleted outfit stays listed and taps on it dead-end on "not found".
  useFocusEffect(
    useCallback(() => {
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

        const featured = allOutfits.filter(outfit => outfit.item_ids.includes(itemId));
        setFeaturedOutfits(featured);

        // Not awaited with the rest of the page's load - the item's wear
        // count is a secondary detail, not something worth blocking on.
        if (fetchedItem) {
          dataService
            .getWearCountForOutfits(
              fetchedItem.closet_id,
              featured.map(outfit => outfit.outfit_id),
            )
            .then(count => {
              if (!cancelled) setWearCount(count);
            })
            .catch(() => {});
        }
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
    }, [itemId, dataService, refreshKey]),
  );

  const handleAddPhoto = async () => {
    const uri = await pickPhoto();
    if (!uri) return;

    setIsAddingPhoto(true);
    try {
      const photo = await dataService.addClosetItemPhoto(itemId, uri);
      setPhotos(prev => [...prev, photo]);
      announceForScreenReader('Photo added.');
    } catch (err) {
      showAlert("Couldn't add photo", getErrorMessage(err, 'Something went wrong. Please try again.'));
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
      announceForScreenReader('Photo deleted.');
    } catch (err) {
      showAlert("Couldn't delete photo", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  let content: React.ReactNode;

  const screen = { backgroundColor: theme.background };

  // `&& !item`: focus-triggered refetches keep showing the loaded page
  // instead of flashing a spinner on every return to this screen.
  if (isLoading && !item) {
    content = (
      <View style={[styles.container, screen]}>
        <LoadingIndicator label="Loading item" />
      </View>
    );
  } else if (error) {
    content = (
      <View style={[styles.container, screen]}>
        <ErrorText style={[styles.text, { color: theme.textPrimary }]}>{error}</ErrorText>
      </View>
    );
  } else if (!item) {
    // RLS returns zero rows for items in closets the viewer isn't a member
    // of, so a shared link opened by a non-member lands here.
    content = <NoAccessScreen />;
  } else {
    const secondaryPhotos = photos.slice(0, MAX_SECONDARY_PHOTOS);
    const detailFields = getDetailFields(item);

    content = (
      <ScrollView contentContainerStyle={[styles.container, screen]}>
        <View style={styles.imageContainer}>
          <Image
            source={item.img}
            style={styles.image}
            // Background-removed cutouts are trimmed tight to the garment,
            // so filling the square would crop them; show those whole.
            contentFit={isCutoutPhotoUrl(item.img) ? 'contain' : 'cover'}
            transition={200}   // Smooth native fade-in in SDK 55
            accessibilityIgnoresInvertColors
            accessible
            alt={`Photo of ${item.name}`}
          />
        </View>
        <View style={styles.contentContainer}>
          <Text style={[styles.wearCountText, { color: theme.textSecondary }]}>
            You have worn this item {wearCount} {wearCount === 1 ? 'time' : 'times'}
          </Text>

          <Text role="heading" style={[styles.sectionLabel, { color: theme.textPrimary }]}>
            More photos
          </Text>
          {secondaryPhotos.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Add some photos of the garment in different lighting or a close up of the fabric here
            </Text>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollRow}>
            {secondaryPhotos.map((photo, index) => (
              <Pressable
                key={photo.id}
                style={styles.photoThumb}
                onPress={() => setPreviewIndex(index)}
                role="button"
                aria-label={`Photo ${index + 1} of ${secondaryPhotos.length}`}
              >
                <Image source={photo.image_url} style={styles.photoThumbImage} contentFit="cover" />
              </Pressable>
            ))}

            {secondaryPhotos.length < MAX_SECONDARY_PHOTOS ? (
              <Pressable
                onPress={handleAddPhoto}
                disabled={isAddingPhoto}
                style={[
                  styles.photoThumb,
                  styles.addPhotoThumb,
                  { borderColor: theme.border, backgroundColor: theme.surfaceAlt },
                ]}
                role="button"
                aria-label="Add a photo"
                aria-disabled={isAddingPhoto}
                aria-busy={isAddingPhoto}
              >
                <Text style={[styles.addPhotoThumbText, { color: theme.textSecondary }]}>
                  {isAddingPhoto ? '…' : '+'}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <VoiceNotesSection
            target={{ clothingItemId: itemId }}
            closetId={item.closet_id}
            headingStyle={[styles.sectionLabel, { color: theme.textPrimary }]}
          />

          <Text role="heading" style={[styles.sectionLabel, { color: theme.textPrimary }]}>
            Item Details
          </Text>
          <View style={styles.detailsList}>
            {detailFields.map(({ label, value, isLink }) => (
              <View
                key={label}
                style={[styles.detailRow, { borderBottomColor: theme.border }]}
                accessible={!isLink || !value}
                aria-label={`${label}: ${value ?? 'No info yet'}`}
              >
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
                {isLink && value ? (
                  <Pressable onPress={() => Linking.openURL(value)} role="link" aria-label={`Open ${label}`}>
                    <Text style={[styles.text, styles.linkText, { color: theme.link }]} numberOfLines={1}>
                      {value}
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    style={
                      value
                        ? [styles.text, { color: theme.textPrimary }]
                        : [styles.emptyText, { color: theme.textSecondary }]
                    }
                  >
                    {value ?? 'No info yet'}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <Text role="heading" style={[styles.sectionLabel, { color: theme.textPrimary }]}>
            Featured in outfits
          </Text>
          {featuredOutfits.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollRow}>
              {featuredOutfits.map(outfit => (
                <Link key={outfit.outfit_id} href={`/outfit/${outfit.outfit_id}`} asChild>
                  <Pressable
                    style={styles.outfitThumb}
                    accessible
                    role="button"
                    aria-label={`View outfit: ${outfit.name}`}
                  >
                    <OutfitFlatLay itemIds={outfit.item_ids} closetItems={closetItems} style={styles.outfitFlatLay} />
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Not featured in any outfits yet.
            </Text>
          )}

          <EditButton
            label="Edit item"
            onPress={() => router.push({ pathname: '/item/edit/[id]', params: { id: itemId } })}
          />
          <DeleteButton label="Delete item" onPress={confirmAndDelete} isDeleting={isDeleting} />
        </View>

        <PhotoPreviewModal
          source={previewIndex !== null ? secondaryPhotos[previewIndex].image_url : null}
          label={`Photo ${(previewIndex ?? 0) + 1} of ${secondaryPhotos.length}`}
          onClose={() => setPreviewIndex(null)}
          onDelete={handleDeletePhoto}
          isDeleting={isDeletingPhoto}
        />
      </ScrollView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: item?.name ?? 'Item details',
          headerLeft: () => <HeaderBackButton />,
          headerRight: () => (item ? <ShareLinkButton path={`/item/${itemId}`} title={item.name} /> : null),
        }}
      />
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
  },
  // Centered wrapper for the image to mimic Amazon's frame
  imageContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    alignItems: 'center',    // Centers the image horizontally
  },
  // Photo wells stay light in both themes: the garment photos are shot on
  // white, so a dark well would frame each one in a hard white box.
  image: {
    width: '100%',          // Spans full width of its padded parent
    aspectRatio: 1,         // Forces a perfect square dynamically
    borderRadius: 8,        // Optional: slight rounding looks very modern
    backgroundColor: '#f9f9f9',
  },
  text: {
    fontSize: 17,
    lineHeight: 24,
  },
  wearCountText: {
    fontSize: 15,
  },
  linkText: {
    textDecorationLine: 'underline',
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
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoThumbText: {
    fontSize: 28,
  },
  detailsList: {
    width: '100%',
  },
  detailRow: {
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 15,
  },
});
