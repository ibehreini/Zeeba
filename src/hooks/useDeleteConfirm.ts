import { ConflictError, getErrorMessage } from '@/services/dataService.types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { showAlert } from '@/utils/alert';

type Options = {
  confirmTitle: string;
  confirmMessage: string;
  errorTitle: string;
  onDelete: () => Promise<void>;
  /**
   * Called instead of navigating back when `onDelete` throws `ConflictError`
   * - i.e. someone else already edited or deleted this row first. Callers
   * should refresh their screen's data so the user sees the current state.
   */
  onConflict: () => void;
};

/**
 * Shared "delete this thing" flow for the detail pages: confirm, call the
 * delete, navigate back on success. On failure, a `ConflictError` (the row
 * changed since the caller last read it) triggers `onConflict` instead of
 * the generic error alert, so the user is told someone beat them to it
 * rather than seeing a misleading network-error message.
 */
export function useDeleteConfirm({ confirmTitle, confirmMessage, errorTitle, onDelete, onConflict }: Options) {
  const router = useRouter();
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
            router.back();
          } catch (err) {
            if (err instanceof ConflictError) {
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
