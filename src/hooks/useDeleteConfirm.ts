import { ConflictError, getErrorMessage } from '@/services/dataService.types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { showAlert } from '@/utils/alert';
import { useToast } from '@/components/Toast';
import { markOutfitsDirty } from '@/state/outfitsRefresh';

type Options = {
  confirmTitle: string;
  confirmMessage: string;
  errorTitle: string;
  /** Toast (and screen reader announcement) after a successful delete, e.g. "Item deleted". */
  successMessage: string;
  onDelete: () => Promise<void>;
  /**
   * Called instead of navigating back when `onDelete` throws `ConflictError`
   * - i.e. someone else already edited or deleted this row first. Callers
   * should refresh their screen's data so the user sees the current state.
   */
  onConflict: () => void;
  /** After a conflict: resolves true if the row no longer exists (someone else deleted it). */
  isGone: () => Promise<boolean>;
};

/**
 * Shared "delete this thing" flow for the detail pages: confirm, call the
 * delete, navigate back on success. On failure, a `ConflictError` (the row
 * changed since the caller last read it) triggers `onConflict` instead of
 * the generic error alert, so the user is told someone beat them to it
 * rather than seeing a misleading network-error message.
 */
export function useDeleteConfirm({
  confirmTitle,
  confirmMessage,
  errorTitle,
  successMessage,
  onDelete,
  onConflict,
  isGone,
}: Options) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmAndDelete = () => {
    showAlert(confirmTitle, confirmMessage, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          try {
            await onDelete();
            // Without this the only feedback is the page vanishing.
            showToast(successMessage);
            router.back();
          } catch (err) {
            if (err instanceof ConflictError && (await isGone().catch(() => false))) {
              // Refreshing would land on a "not found" screen; just leave.
              // Items and outfits both show in the outfits tab, so refresh it.
              markOutfitsDirty();
              showToast('Someone else already deleted this.');
              router.back();
            } else if (err instanceof ConflictError) {
              showAlert('Already changed', err.message);
              onConflict();
            } else {
              showAlert(errorTitle, getErrorMessage(err, 'Something went wrong. Please try again.'));
            }
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  return { confirmAndDelete, isDeleting };
}
