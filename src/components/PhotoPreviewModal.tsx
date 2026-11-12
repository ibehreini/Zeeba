import { useWebModalBackHandler } from '@/hooks/useWebModalBackHandler';
import type { ImageSource } from '@/services/dataService.types';
import { showAlert } from '@/utils/alert';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  /** The photo to show full screen; null keeps the preview closed. */
  source: ImageSource | null;
  /** Spoken name of the photo, e.g. "Photo 2 of 3". */
  label: string;
  onClose: () => void;
  /** Called once the user confirms the delete. */
  onDelete: () => void;
  isDeleting: boolean;
};

/** Full-screen view of one extra photo, with Delete (confirmed first) and Close. */
export default function PhotoPreviewModal({ source, label, onClose, onDelete, isDeleting }: Props) {
  // Web-only: the browser back gesture closes the preview instead of
  // navigating the route underneath it away.
  useWebModalBackHandler(source !== null, onClose);

  const confirmDelete = () =>
    showAlert('Delete photo', "Delete this photo? This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <Modal visible={source !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {source !== null && (
          <Image source={source} style={styles.modalImage} contentFit="contain" accessible alt={label} />
        )}

        <View style={styles.modalActions}>
          <Pressable
            style={styles.deleteImageButton}
            onPress={confirmDelete}
            disabled={isDeleting}
            role="button"
            aria-label="Delete photo"
            aria-disabled={isDeleting}
            aria-busy={isDeleting}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
          </Pressable>

          <Pressable style={styles.closeButton} onPress={onClose} role="button" aria-label="Close image preview">
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
