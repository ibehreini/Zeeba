import { getErrorMessage } from '@/services/dataService.types';
import { useEffect, useState } from 'react';

/**
 * Runs an edit form's loader when the form mounts (and again if `load`
 * changes), tracking whether it is still loading and why it failed. The
 * loader fills the form's own state; once the form unmounts or `load`
 * changes, a late finish no longer touches these two flags.
 */
export function useFormLoad(load: () => Promise<unknown>, errorFallback: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    load()
      .catch(err => {
        if (!cancelled) setLoadError(getErrorMessage(err, errorFallback));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [load, errorFallback]);

  return { isLoading, loadError };
}
