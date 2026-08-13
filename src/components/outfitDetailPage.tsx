import DeleteButton from '@/components/DeleteButton';
import EditButton from '@/components/EditButton';
import OutfitFlatLay from '@/components/OutfitFlatLay';
import { useAuth } from '@/context/AuthContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import { useWebModalBackHandler } from '@/hooks/useWebModalBackHandler';
import { getErrorMessage, toRNImageSource, type ClosetItem, type OutfitPhoto } from '@/services/dataService.types';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { pickLibraryImages } from '@/utils/pickLibraryImages';
import { showAlert } from '@/utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
  complimentCount: number;
  updatedAt: string;
};

type Props = {
  outfit: OutfitDetailItem;
  closetItems: ClosetItem[];
  /** Re-fetches this outfit's data - called when a delete is rejected because someone else already changed or deleted it. */
  onConflict: () => void;
};

export default function OutfitDetailPage({ outfit, closetItems, onConflict }: Props) {
  const router = useRouter();
  const { theme } = useTheme();
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

  useWebModalBackHandler(viewingPhoto !== null, () => setViewingPhoto(null));

  const [wearCount, setWearCount] = useState(0);
  const [todayWearLogId, setTodayWearLogId] = useState<string | null>(null);
  const [isClosetOwner, setIsClosetOwner] = useState(false);
  const [isTogglingWorn, setIsTogglingWorn] = useState(false);

  const [complimentCount, setComplimentCount] = useState(outfit.complimentCount);
  const [isLoggingCompliment, setIsLoggingCompliment] = useState(false);

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
        if (!cancelled) showAlert("Couldn't load wear history", getErrorMessage(err, 'Something went wrong.'));
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
      showAlert("Couldn't update", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsTogglingWorn(false);
    }
  };

  const handleLogCompliment = async () => {
    setIsLoggingCompliment(true);
    try {
      const newCount = await dataService.logCompliment(outfit.id);
      setComplimentCount(newCount);
    } catch (err) {
      showAlert("Couldn't log compliment", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsLoggingCompliment(false);
    }
  };

  const { confirmAndDelete, isDeleting } = useDeleteConfirm({
    confirmTitle: 'Delete outfit',
    confirmMessage: `Delete "${outfit.name ?? 'this outfit'}"? This can't be undone.`,
    errorTitle: "Couldn't delete outfit",
    onDelete: async () => {
      await dataService.deleteOutfit(outfit.id, outfit.updatedAt);
      markOutfitsDirty();
    },
    onConflict,
  });

  const handleAddPhoto = async () => {
    const [uri] = await pickLibraryImages(false);
    if (!uri) return;

    setIsAddingPhoto(true);
    try {
      const photo = await dataService.addOutfitPhoto(outfit.id, uri);
      setPhotos(prev => [...prev, photo]);
    } catch (err) {
      showAlert("Couldn't add photo", getErrorMessage(err, 'Something went wrong. Please try again.'));
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
      showAlert("Couldn't delete photo", getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
      <View
        aria-hidden={true}
        style={styles.flatLayWrapper}
      >
        <OutfitFlatLay itemIds={outfit.itemIds} closetItems={closetItems} />
      </View>

      <View style={styles.content}>
        {outfit.description ? (
          <Text style={[styles.description, { color: theme.textSecondary }]}>{outfit.description}</Text>
        ) : null}

        <Text style={[styles.wearCountText, { color: theme.textSecondary }]}>
          This outfit has been worn {wearCount} {wearCount === 1 ? 'time' : 'times'}
        </Text>

        {isClosetOwner ? (
          <Pressable
            onPress={handleToggleWornToday}
            disabled={isTogglingWorn}
            role="button"
            aria-label={todayWearLogId ? 'Remove outfit worn today' : 'Mark this outfit as Worn Today'}
            aria-disabled={isTogglingWorn}
            style={({ pressed }) => [
              styles.wornTodayButton,
              todayWearLogId
                ? { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.accent }
                : { backgroundColor: theme.accent },
              pressed && styles.wornTodayButtonPressed,
              isTogglingWorn && styles.wornTodayButtonDisabled,
            ]}
          >
            {isTogglingWorn ? (
              <ActivityIndicator color={todayWearLogId ? theme.textPrimary : theme.onAccent} />
            ) : (
              <Text
                style={[
                  styles.wornTodayButtonText,
                  { color: todayWearLogId ? theme.textPrimary : theme.onAccent },
                ]}
              >
                {todayWearLogId ? 'Remove outfit worn today' : 'Mark this outfit as Worn Today'}
              </Text>
            )}
          </Pressable>
        ) : null}

        <Text style={[styles.complimentCountText, { color: theme.textSecondary }]}>
          This outfit has received {complimentCount} {complimentCount === 1 ? 'compliment' : 'compliments'}
        </Text>

        <Pressable
          onPress={handleLogCompliment}
          disabled={isLoggingCompliment}
          role="button"
          aria-label="Log compliment"
          aria-disabled={isLoggingCompliment}
          style={({ pressed }) => [
            styles.logComplimentButton,
            { borderColor: theme.accent },
            pressed && styles.logComplimentButtonPressed,
            isLoggingCompliment && styles.logComplimentButtonDisabled,
          ]}
        >
          {isLoggingCompliment ? (
            <ActivityIndicator color={theme.textPrimary} />
          ) : (
            <Text style={[styles.logComplimentButtonText, { color: theme.textPrimary }]}>
              Log compliment
            </Text>
          )}
        </Pressable>

        <Text role="heading" style={[styles.sectionLabel, { color: theme.textPrimary }]}>
          Pieces in this outfit
        </Text>

        {pieces.length > 0 ? (
          <View style={styles.pieceGrid}>
            {pieces.map(item => (
              <Link key={item.item_id} href={`/item/${item.item_id}`} asChild>
                <Pressable
                  accessible
                  role="button"
                  aria-label={`View item: ${item.name}`}
                  style={styles.pieceBox}
                >
                  <Image source={toRNImageSource(item.img)} style={styles.pieceImage} resizeMode="contain" />
                  <Text style={[styles.pieceLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No clothing items for this outfit yet.
          </Text>
        )}

        <Text role="heading" style={[styles.sectionLabel, { color: theme.textPrimary }]}>
          Worn in the Wild
        </Text>

        <View style={styles.pieceGrid}>
          {photos.map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => setViewingPhoto(photo)}
              role="button"
              aria-label={`Worn in the wild photo ${index + 1} of ${photos.length}`}
              style={styles.pieceBox}
            >
              <Image source={toRNImageSource(photo.image_url)} style={styles.pieceImage} resizeMode="cover" />
            </Pressable>
          ))}

          {photos.length < MAX_OUTFIT_PHOTOS ? (
            <Pressable
              onPress={handleAddPhoto}
              disabled={isAddingPhoto}
              role="button"
              aria-label="Add a worn-in-the-wild photo"
              aria-disabled={isAddingPhoto}
              style={[
                styles.pieceBox,
                styles.addPhotoBox,
                { borderColor: theme.border, backgroundColor: theme.surfaceAlt },
              ]}
            >
              <Text style={[styles.addPhotoBoxText, { color: theme.textSecondary }]}>
                {isAddingPhoto ? '…' : '+'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <EditButton
          label="Edit outfit"
          onPress={() => router.push({ pathname: '/outfit/edit/[id]', params: { id: outfit.id } })}
        />
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
              role="button"
              aria-label="delete image"
              aria-disabled={isDeletingPhoto}
            >
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </Pressable>

            <Pressable
              style={styles.closeButton}
              onPress={() => setViewingPhoto(null)}
              role="button"
              aria-label="Close image preview"
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
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
  wearCountText: {
    fontSize: 15,
    marginBottom: 12,
  },
  wornTodayButton: {
    minHeight: 50,
    width: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  },
  complimentCountText: {
    fontSize: 15,
    marginBottom: 12,
  },
  logComplimentButton: {
    minHeight: 50,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logComplimentButtonPressed: {
    opacity: 0.7,
  },
  logComplimentButtonDisabled: {
    opacity: 0.5,
  },
  logComplimentButtonText: {
    fontSize: 16,
    fontWeight: '700',
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
  // Photo wells stay light in both themes: the garment photos are shot on
  // white, so a dark well would frame each one in a hard white box.
  pieceImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#f6f6f6',
  },
  pieceLabel: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  addPhotoBox: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBoxText: {
    fontSize: 28,
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
