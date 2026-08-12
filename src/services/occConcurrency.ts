import { supabase } from '@/utils/supabase';
import { ConflictError } from './dataService.types';

/** Tables that carry an `updated_at` optimistic-concurrency token. */
type OccTable = 'outfits' | 'clothing_items';

/**
 * Updates a row only if its `updated_at` still equals `expectedUpdatedAt` -
 * classic optimistic concurrency control. `updated_at` itself is never part
 * of `patch`; it's set server-side by a DB trigger, so the client can only
 * ever match against it, never spoof it.
 *
 * Throws `ConflictError` if no row matched (someone else updated or deleted
 * it first), or the underlying Postgrest error for any other failure.
 */
export async function updateWithOcc(
  table: OccTable,
  id: string,
  expectedUpdatedAt: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ConflictError();
}

/** Same idea as {@link updateWithOcc}, but for deletes. */
export async function deleteWithOcc(table: OccTable, id: string, expectedUpdatedAt: string): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ConflictError();
}
