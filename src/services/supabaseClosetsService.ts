import { supabase } from '@/utils/supabase';
import type { Tables } from '@/types/supabase.types';
import { DEFAULT_OUTFIT_LABELS, type OwnCloset, type StylistCloset } from './dataService.types';

type ClosetLabelsColumn = { outfit_labels?: string[] | null };

type StylistClosetRow = {
  closets: (Pick<Tables<'closets'>, 'id' | 'closet_name'> & ClosetLabelsColumn) | null;
};

type OwnClosetRow = Pick<Tables<'closets'>, 'id' | 'closet_name' | 'pass_phrase'> & ClosetLabelsColumn;

/** Postgres undefined_column - what PostgREST returns while closets.outfit_labels does not exist yet. */
const UNDEFINED_COLUMN = '42703';
/** PostgREST "function not found" - what an RPC returns while its migration has not been applied. */
const UNDEFINED_FUNCTION = 'PGRST202';

/**
 * Deploy-order safety net: the web client ships independently of the
 * database, so it may run before 20261111000000_closet_outfit_labels.sql has
 * been applied. Runs the query with outfit_labels first and, only if that
 * column turns out not to exist, again without it - so closets keep loading
 * (with the default tags) instead of every screen showing "Failed to load
 * your closet". The message check is belt and braces in case PostgREST
 * reports the missing column inside an embed with a different code.
 */
async function selectWithLabelsFallback<R extends { error: { code?: string; message?: string } | null }>(
  run: (withLabels: boolean) => PromiseLike<R>,
): Promise<R> {
  const first = await run(true);
  const error = first.error;
  if (error && (error.code === UNDEFINED_COLUMN || error.message?.includes('outfit_labels'))) return run(false);
  return first;
}

const labelsOf = (row: ClosetLabelsColumn) => row.outfit_labels ?? [...DEFAULT_OUTFIT_LABELS];

const toOwnCloset = (row: OwnClosetRow): OwnCloset => ({
  closet_id: row.id,
  closet_name: row.closet_name,
  pass_phrase: row.pass_phrase,
  outfit_labels: labelsOf(row),
});

/** Turns a missing-RPC error into a readable message; rethrows anything else unchanged. */
function throwTagRpcError(error: { code?: string }): never {
  if (error.code === UNDEFINED_FUNCTION) throw new Error('Editing tags is not available yet. Please try again later.');
  throw error;
}

/**
 * Closets `userId` collaborates on (stylist access), not counting ones they
 * own. Rows whose joined `closets` came back `null` (e.g. the closet was
 * deleted after the collaborator link was created) are dropped rather than
 * surfaced as broken entries. Throws the Supabase error on failure.
 */
export async function getStylistClosets(userId: string): Promise<StylistCloset[]> {
  const { data, error } = await selectWithLabelsFallback(withLabels =>
    supabase
      .from('closet_collaborators')
      .select(withLabels ? 'closets(id, closet_name, outfit_labels)' : 'closets(id, closet_name)')
      .eq('user_id', userId)
      .returns<StylistClosetRow[]>(),
  );
  if (error) throw error;

  return data
    .filter((row): row is StylistClosetRow & { closets: NonNullable<StylistClosetRow['closets']> } =>
      row.closets !== null,
    )
    .map(row => ({
      closet_id: row.closets.id,
      closet_name: row.closets.closet_name,
      outfit_labels: labelsOf(row.closets),
    }));
}

/** The closet `userId` owns, or `null` if they haven't created one yet. Throws the Supabase error on failure. */
export async function getOwnCloset(userId: string): Promise<OwnCloset | null> {
  const { data, error } = await selectWithLabelsFallback(withLabels =>
    supabase
      .from('closets')
      .select(withLabels ? 'id, closet_name, pass_phrase, outfit_labels' : 'id, closet_name, pass_phrase')
      .eq('owner_id', userId)
      .returns<OwnClosetRow[]>()
      .maybeSingle(),
  );
  if (error) throw error;
  return data ? toOwnCloset(data) : null;
}

/**
 * Creates `userId`'s own closet with a user-chosen name. `pass_phrase` is
 * intentionally omitted from the insert - the column default generates a
 * random one, since a user-chosen phrase would be far more guessable and can
 * collide with the column's unique constraint. outfit_labels is omitted too:
 * its column default is the starting tag list. (A missing-column error fails
 * the whole INSERT ... RETURNING, so the fallback retry can't create a second
 * closet.) Throws the Supabase error on failure.
 */
export async function createOwnCloset(userId: string, closetName: string): Promise<OwnCloset> {
  const { data, error } = await selectWithLabelsFallback(withLabels =>
    supabase
      .from('closets')
      .insert({ owner_id: userId, closet_name: closetName })
      .select(withLabels ? 'id, closet_name, pass_phrase, outfit_labels' : 'id, closet_name, pass_phrase')
      .returns<OwnClosetRow[]>()
      .single(),
  );
  if (error) throw error;
  return toOwnCloset(data);
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

  const { data, error } = await selectWithLabelsFallback(withLabels =>
    supabase
      .from('closets')
      .select(withLabels ? 'id, closet_name, outfit_labels' : 'id, closet_name')
      .eq('id', closetId)
      .returns<NonNullable<StylistClosetRow['closets']>[]>()
      .single(),
  );
  if (error) throw error;
  return { closet_id: data.id, closet_name: data.closet_name, outfit_labels: labelsOf(data) };
}

/** A closet's current outfit tags. Members only (RLS). Throws the Supabase error on failure. */
export async function getClosetOutfitLabels(closetId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('closets')
    .select('outfit_labels')
    .eq('id', closetId)
    .returns<ClosetLabelsColumn[]>()
    .single();
  if (error) {
    if (error.code === UNDEFINED_COLUMN || error.message?.includes('outfit_labels')) return [...DEFAULT_OUTFIT_LABELS];
    throw error;
  }
  return labelsOf(data);
}

/**
 * Adds a tag through the add_closet_outfit_label RPC (atomic on the server,
 * so a second device's edit is never overwritten) and returns the updated
 * list. `atIndex` is 0-based; the RPC's position is 1-based. Throws the
 * Supabase error on failure - its message is the user-facing reason.
 */
export async function addClosetOutfitLabel(closetId: string, label: string, atIndex?: number): Promise<string[]> {
  const { data, error } = await supabase.rpc('add_closet_outfit_label', {
    target_closet_id: closetId,
    target_label: label,
    ...(atIndex === undefined ? {} : { target_position: atIndex + 1 }),
  });
  if (error) throwTagRpcError(error);
  return data as string[];
}

/** Removes a tag through the remove_closet_outfit_label RPC and returns the updated list. Throws the Supabase error on failure. */
export async function removeClosetOutfitLabel(closetId: string, label: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('remove_closet_outfit_label', {
    target_closet_id: closetId,
    target_label: label,
  });
  if (error) throwTagRpcError(error);
  return data as string[];
}
