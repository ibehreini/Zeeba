import { supabase } from '@/utils/supabase';
import type { Tables } from '@/types/supabase.types';
import type { OwnCloset, StylistCloset } from './dataService.types';

type StylistClosetRow = {
  closets: Pick<Tables<'closets'>, 'id' | 'closet_name'> | null;
};

/**
 * Closets `userId` collaborates on (stylist access), not counting ones they
 * own. Rows whose joined `closets` came back `null` (e.g. the closet was
 * deleted after the collaborator link was created) are dropped rather than
 * surfaced as broken entries. Throws the Supabase error on failure.
 */
export async function getStylistClosets(userId: string): Promise<StylistCloset[]> {
  const { data, error } = await supabase
    .from('closet_collaborators')
    .select('closets(id, closet_name)')
    .eq('user_id', userId)
    .returns<StylistClosetRow[]>();
  if (error) throw error;

  return data
    .filter((row): row is StylistClosetRow & { closets: NonNullable<StylistClosetRow['closets']> } =>
      row.closets !== null,
    )
    .map(row => ({ closet_id: row.closets.id, closet_name: row.closets.closet_name }));
}

/** The closet `userId` owns, or `null` if they haven't created one yet. Throws the Supabase error on failure. */
export async function getOwnCloset(userId: string): Promise<OwnCloset | null> {
  const { data, error } = await supabase
    .from('closets')
    .select('id, closet_name, pass_phrase')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { closet_id: data.id, closet_name: data.closet_name, pass_phrase: data.pass_phrase } : null;
}

/**
 * Creates `userId`'s own closet with a user-chosen name. `pass_phrase` is
 * intentionally omitted from the insert - the column default generates a
 * random one, since a user-chosen phrase would be far more guessable and can
 * collide with the column's unique constraint. Throws the Supabase error on
 * failure.
 */
export async function createOwnCloset(userId: string, closetName: string): Promise<OwnCloset> {
  const { data, error } = await supabase
    .from('closets')
    .insert({ owner_id: userId, closet_name: closetName })
    .select('id, closet_name, pass_phrase')
    .single();
  if (error) throw error;
  return { closet_id: data.id, closet_name: data.closet_name, pass_phrase: data.pass_phrase };
}

/**
 * Replaces a closet's passphrase and returns the new value. Caller must own
 * the closet - enforced server-side by the `regenerate_closet_passphrase` RPC,
 * not re-checked here. Throws the Supabase error on failure.
 */
export async function regeneratePassphrase(closetId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_closet_passphrase', {
    target_closet_id: closetId,
  });
  if (error) throw error;
  return data;
}

/**
 * Joins the caller (as a stylist/collaborator) to the closet matching
 * `passphrase`. A non-member can't SELECT the closets table or INSERT into
 * closet_collaborators directly under RLS, so the lookup + insert happen
 * server-side in the `join_closet_by_passphrase` RPC instead, which returns
 * just the new closet_id. The name is fetched as a normal follow-up SELECT -
 * that's RLS-legal now, since the RPC just made the caller a member. Throws
 * if the passphrase doesn't match any closet, or belongs to a closet the
 * caller already owns.
 */
export async function joinClosetByPassphrase(passphrase: string): Promise<StylistCloset> {
  const { data: closetId, error: joinError } = await supabase.rpc('join_closet_by_passphrase', {
    target_pass_phrase: passphrase,
  });
  if (joinError) throw joinError;

  const { data, error } = await supabase.from('closets').select('id, closet_name').eq('id', closetId).single();
  if (error) throw error;
  return { closet_id: data.id, closet_name: data.closet_name };
}
