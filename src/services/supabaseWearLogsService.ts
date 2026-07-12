import { supabase } from '@/utils/supabase';
import { todayDateString, type OutfitWearStatus } from './dataService.types';

/**
 * Wear count for an outfit (all closet members' logs), plus whether `userId`
 * already logged it worn today. Two independent queries run in parallel
 * rather than one combined query, since the count is scoped to the whole
 * closet+outfit while "logged today" is scoped to this specific user.
 * Throws the Supabase error on failure.
 */
export async function getOutfitWearStatus(
  closetId: string,
  outfitId: string,
  userId: string,
): Promise<OutfitWearStatus> {
  const [countResult, todayResult] = await Promise.all([
    supabase
      .from('wear_logs')
      .select('id', { count: 'exact', head: true })
      .eq('closet_id', closetId)
      .eq('outfit_id', outfitId),
    supabase
      .from('wear_logs')
      .select('id')
      .eq('closet_id', closetId)
      .eq('outfit_id', outfitId)
      .eq('user_id', userId)
      .eq('worn_on_date', todayDateString())
      .maybeSingle(),
  ]);
  if (countResult.error) throw countResult.error;
  if (todayResult.error) throw todayResult.error;

  return { wearCount: countResult.count ?? 0, todayWearLogId: todayResult.data?.id ?? null };
}

/** Logs an outfit as worn today by `userId`. Returns the new wear_logs row id. Throws the Supabase error on failure. */
export async function logOutfitWornToday(closetId: string, outfitId: string, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('wear_logs')
    .insert({ closet_id: closetId, outfit_id: outfitId, user_id: userId, worn_on_date: todayDateString() })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Deletes a wear_logs row (e.g. undoing today's log). Throws the Supabase error on failure. */
export async function deleteWearLog(wearLogId: string): Promise<void> {
  const { error } = await supabase.from('wear_logs').delete().eq('id', wearLogId);
  if (error) throw error;
}

/**
 * Total wear_logs count across `outfitIds` - used to derive a clothing
 * item's own wear count from the outfits it's featured in, without a
 * dedicated per-item log. Throws the Supabase error on failure.
 */
export async function getWearCountForOutfits(closetId: string, outfitIds: string[]): Promise<number> {
  if (outfitIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('wear_logs')
    .select('id', { count: 'exact', head: true })
    .eq('closet_id', closetId)
    .in('outfit_id', outfitIds);
  if (error) throw error;
  return count ?? 0;
}
