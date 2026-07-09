import { getErrorMessage } from '@/services/dataService.types';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

type Options = {
  confirmTitle: string;
  confirmMessage: string;
  errorTitle: string;
  onDelete: () => Promise<void>;
};

/**
 * Shared "delete this thing" flow for the detail pages: confirm, call the
 * delete, navigate back on success, or pop a modal alert on failure (e.g. a
 * network error) so the user knows it never hit the DB.
 */
export function useDeleteConfirm({ confirmTitle, confirmMessage, errorTitle, onDelete }: Options) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmAndDelete = () => {
    Alert.alert(confirmTitle, confirmMessage, [
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
            Alert.alert(errorTitle, getErrorMessage(err, 'Something went wrong. Please try again.'));
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  return { confirmAndDelete, isDeleting };
}
