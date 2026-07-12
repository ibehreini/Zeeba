import DeleteButton from '@/components/DeleteButton';
import OutfitFlatLay from '@/components/OutfitFlatLay';
import { useAuth } from '@/context/AuthContext';
import { useDataMode } from '@/context/DataModeContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { getErrorMessage, toRNImageSource, type ClosetItem, type OutfitPhoto } from '@/services/dataService.types';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { pickLibraryImages } from '@/utils/pickLibraryImages';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// "Worn in the wild" photos are capped at this many per outfit; the Add tile
// hides itself once this many exist.
const MAX_OUTFIT_PHOTOS = 3;

type OutfitDetailItem = {
  id: string;
  closetId: string;
  name: string | null;
  description?: string | null;
  itemIds: readonly string[];
  photos: readonly OutfitPhoto[];
};

type Props = {
  outfit: OutfitDetailItem;
  closetItems: ClosetItem[];
};

export default function OutfitDetailPage({ outfit, closetItems }: Props) {
  const { mode, dataService } = useDataMode();
  const { session } = useAuth();
  // Preview (guest) sessions have no real user id, but the preview data
  // service ignores it entirely - any placeholder value works there.
  const userId = mode === 'preview' ? 'preview-user' : session?.user.id;

  const itemsById = new Map(closetItems.map(item => [item.item_id, item]));
  const pieces = outfit.itemIds.map(itemId => itemsById.get(itemId)).filter((item): item is ClosetItem => Boolean(item));

  const [photos, setPhotos] = useState<OutfitPhoto[]>([...outfit.photos]);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<OutfitPhoto | null>(null);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const [wearCount, setWearCount] = useState(0);
  const [todayWearLogId, setTodayWearLogId] = useState<string | null>(null);
  const [isClosetOwner, setIsClosetOwner] = useState(false);
  const [isTogglingWorn, setIsTogglingWorn] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    Promise.all([dataService.getOutfitWearStatus(outfit.closetId, outfit.id, userId), dataService.getOwnCloset(userId)])
      .then(([status, ownCloset]) => {
        if (cancelled) return;
        setWearCount(status.wearCount);
        setTodayWearLogId(status.todayWearLogId);
        setIsClosetOwner(ownCloset?.closet_id === outfit.closetId);
      })
      .catch(err => {
        if (!cancelled) Alert.alert("Couldn't load wear history", getErrorMessage(err, 'Something went wrong.'));
      });

    return () => {
      cancelled = true;
    };
  }, [dataService, outfit.closetId, outfit.id, userId]);

  const handleToggleWornToday = async () => {
    if (!userId) return;

    setIsTogglingWorn(true);
    try {
      if (todayWearLogId) {
        await dataService.deleteWearLog(todayWearLogId);
        setTodayWearLogId(null);
        setWearCount(prev => Math.max(0, prev - 1));
      } else {
        const newLogId = await dataService.logOutfitWornToday(outfit.closetId, outfit.id, userId);
        setTodayWearLogId(newLogId);
        setWearCount(prev => prev + 1);
      }
    } catch (err) {
      Alert.alert("Couldn't update", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsTogglingWorn(false);
    }
  };

  const { confirmAndDelete, isDeleting } = useDeleteConfirm({
    confirmTitle: 'Delete outfit',
    confirmMessage: `Delete "${outfit.name ?? 'this outfit'}"? This can't be undone.`,
    errorTitle: "Couldn't delete outfit",
    onDelete: async () => {
      await dataService.deleteOutfit(outfit.id);
      markOutfitsDirty();
    },
  });

  const handleAddPhoto = async () => {
    const [uri] = await pickLibraryImages(false);
    if (!uri) return;

    setIsAddingPhoto(true);
    try {
      const photo = await dataService.addOutfitPhoto(outfit.id, uri);
      setPhotos(prev => [...prev, photo]);
    } catch (err) {
      Alert.alert("Couldn't add photo", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsAddingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!viewingPhoto) return;
    const photo = viewingPhoto;

    setIsDeletingPhoto(true);
    try {
      await dataService.deleteOutfitPhoto(photo);
      setPhotos(prev => prev.filter(candidate => candidate.id !== photo.id));
      setViewingPhoto(null);
    } catch (err) {
      Alert.alert("Couldn't delete photo", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.flatLayWrapper}
      >
        <OutfitFlatLay itemIds={outfit.itemIds} closetItems={closetItems} />
      </View>

      <View style={styles.content}>
        {outfit.description ? <Text style={styles.description}>{outfit.description}</Text> : null}

        <Text style={styles.wearCountText}>
          This outfit has been worn {wearCount} {wearCount === 1 ? 'time' : 'times'}
        </Text>

        {isClosetOwner ? (
          <Pressable
            onPress={handleToggleWornToday}
            disabled={isTogglingWorn}
            accessibilityRole="button"
            accessibilityLabel={todayWearLogId ? 'Remove outfit worn today' : 'Mark this outfit as Worn Today'}
            accessibilityState={{ disabled: isTogglingWorn }}
            style={({ pressed }) => [
              styles.wornTodayButton,
              todayWearLogId && styles.wornTodayButtonActive,
              pressed && styles.wornTodayButtonPressed,
              isTogglingWorn && styles.wornTodayButtonDisabled,
            ]}
          >
            {isTogglingWorn ? (
              <ActivityIndicator color={todayWearLogId ? '#1a1a1a' : '#fff'} />
            ) : (
              <Text style={[styles.wornTodayButtonText, todayWearLogId && styles.wornTodayButtonTextActive]}>
                {todayWearLogId ? 'Remove outfit worn today' : 'Mark this outfit as Worn Today'}
              </Text>
            )}
          </Pressable>
        ) : null}

        <Text accessibilityRole="header" style={styles.sectionLabel}>
          Pieces in this outfit
        </Text>

        {pieces.length > 0 ? (
          <View style={styles.pieceGrid}>
            {pieces.map(item => (
              <Link key={item.item_id} href={`/item/${item.item_id}`} asChild>
                <Pressable
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={`View item: ${item.name}`}
                  style={styles.pieceBox}
                >
                  <Image source={toRNImageSource(item.img)} style={styles.pieceImage} resizeMode="contain" />
                  <Text style={styles.pieceLabel} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No clothing items for this outfit yet.</Text>
        )}

        <Text accessibilityRole="header" style={styles.sectionLabel}>
          Worn in the Wild
        </Text>

        <View style={styles.pieceGrid}>
          {photos.map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => setViewingPhoto(photo)}
              accessibilityRole="button"
              accessibilityLabel={`Worn in the wild photo ${index + 1} of ${photos.length}`}
              style={styles.pieceBox}
            >
              <Image source={toRNImageSource(photo.image_url)} style={styles.pieceImage} resizeMode="cover" />
            </Pressable>
          ))}

          {photos.length < MAX_OUTFIT_PHOTOS ? (
            <Pressable
              onPress={handleAddPhoto}
              disabled={isAddingPhoto}
              accessibilityRole="button"
              accessibilityLabel="Add a worn-in-the-wild photo"
              accessibilityState={{ disabled: isAddingPhoto }}
              style={[styles.pieceBox, styles.addPhotoBox]}
            >
              <Text style={styles.addPhotoBoxText}>{isAddingPhoto ? '…' : '+'}</Text>
            </Pressable>
          ) : null}
        </View>

        <DeleteButton label="Delete outfit" onPress={confirmAndDelete} isDeleting={isDeleting} />
      </View>

      <Modal
        visible={viewingPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.modalBackdrop}>
          {viewingPhoto && (
            <Image
              source={toRNImageSource(viewingPhoto.image_url)}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}

          <View style={styles.modalActions}>
            <Pressable
              style={styles.deleteImageButton}
              onPress={handleDeletePhoto}
              disabled={isDeletingPhoto}
              accessibilityRole="button"
              accessibilityLabel="delete image"
              accessibilityState={{ disabled: isDeletingPhoto }}
            >
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </Pressable>

            <Pressable
              style={styles.closeButton}
              onPress={() => setViewingPhoto(null)}
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
  wearCountText: {
    fontSize: 15,
    color: '#555',
    marginBottom: 12,
  },
  wornTodayButton: {
    minHeight: 50,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  wornTodayButtonActive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  wornTodayButtonPressed: {
    opacity: 0.7,
  },
  wornTodayButtonDisabled: {
    opacity: 0.5,
  },
  wornTodayButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  wornTodayButtonTextActive: {
    color: '#1a1a1a',
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
  addPhotoBox: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBoxText: {
    fontSize: 28,
    color: '#999',
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
