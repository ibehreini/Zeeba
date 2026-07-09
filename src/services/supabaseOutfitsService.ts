import { supabase } from '@/utils/supabase';
import type { Outfit } from './dataService.types';
import { mapOutfitRow, OUTFIT_SELECT, type OutfitQueryRow } from './supabaseRowMappers';

/** All outfits, optionally scoped to one closet. Throws the Supabase error on failure. */
export async function getOutfits(closetId?: string): Promise<Outfit[]> {
  let query = supabase.from('outfits').select(OUTFIT_SELECT);
  if (closetId) query = query.eq('closet_id', closetId);

  const { data, error } = await query.returns<OutfitQueryRow[]>();
  if (error) throw error;
  return data.map(mapOutfitRow);
}

/** A single outfit by id, or `null` if no row matches. Throws the Supabase error on failure. */
export async function getOutfitById(outfitId: string): Promise<Outfit | null> {
  const { data, error } = await supabase
    .from('outfits')
    .select(OUTFIT_SELECT)
    .eq('id', outfitId)
    .returns<OutfitQueryRow[]>()
    .maybeSingle();
  if (error) throw error;
  return data ? mapOutfitRow(data) : null;
}
