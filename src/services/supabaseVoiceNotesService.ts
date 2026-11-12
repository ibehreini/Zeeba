import { Platform } from 'react-native';
import { revokeIfBlobUrl } from '@/utils/revokeIfBlobUrl';
import { supabase } from '@/utils/supabase';
import type { Tables } from '@/types/supabase.types';
import type { PendingVoiceNote, VoiceNote, VoiceNoteTarget } from './dataService.types';

const VOICE_NOTE_BUCKET = 'voice_notes';

/** Row plus the embedded recorder profile, so the list can show who said it without a second query. */
type VoiceNoteQueryRow = Tables<'voice_notes'> & {
  users: Pick<Tables<'users'>, 'username' | 'email'> | null;
};

const VOICE_NOTE_SELECT = '*, users(username, email)';

function mapVoiceNoteRow(row: VoiceNoteQueryRow): VoiceNote {
  return {
    id: row.id,
    closet_id: row.closet_id,
    created_by_user_id: row.created_by_user_id,
    recorded_by: row.users?.username ?? row.users?.email ?? 'Unknown',
    audio_url: row.audio_url,
    duration_seconds: row.duration_seconds,
    created_at: row.created_at,
  };
}

/** The storage path (folder = the outfit/item id) and the row columns for a target. */
function targetColumns(target: VoiceNoteTarget) {
  return 'outfitId' in target
    ? { folder: target.outfitId, outfit_id: target.outfitId, clothing_item_id: null }
    : { folder: target.clothingItemId, outfit_id: null, clothing_item_id: target.clothingItemId };
}

/**
 * Reads a finished recording into bytes plus its MIME type.
 *
 * The bytes go up as an ArrayBuffer, never a Blob: in React Native,
 * supabase-js uploads a Blob as an empty body (every native voice note was
 * stored as a 0-byte file that could never play). Photo uploads read an
 * ArrayBuffer for the same reason - see supabasePhotoStorage.
 *
 * iOS/Android recordings are `file://...m4a` (AAC); the web recorder hands
 * back a `blob:` URL whose Blob carries the real type (webm or mp4 depending
 * on the browser).
 */
async function readRecording(uri: string): Promise<{ bytes: ArrayBuffer; extension: string; contentType: string }> {
  const response = await fetch(uri);
  let bytes: ArrayBuffer;
  let contentType: string;
  if (Platform.OS === 'web') {
    const blob = await response.blob();
    bytes = await blob.arrayBuffer();
    contentType = blob.type || 'audio/mp4';
  } else {
    bytes = await response.arrayBuffer();
    contentType = 'audio/mp4';
  }
  if (bytes.byteLength === 0) throw new Error('The recording came out empty. Please try recording again.');
  const extension = contentType.includes('webm') ? 'webm' : contentType.includes('ogg') ? 'ogg' : 'm4a';
  return { bytes, extension, contentType };
}

/** Voice notes for one outfit or item, oldest first. Throws the Supabase error on failure. */
export async function getVoiceNotes(target: VoiceNoteTarget): Promise<VoiceNote[]> {
  const column = 'outfitId' in target ? 'outfit_id' : 'clothing_item_id';
  const id = 'outfitId' in target ? target.outfitId : target.clothingItemId;

  const { data, error } = await supabase
    .from('voice_notes')
    .select(VOICE_NOTE_SELECT)
    .eq(column, id)
    .order('created_at', { ascending: true })
    .returns<VoiceNoteQueryRow[]>();
  if (error) throw error;
  return data.map(mapVoiceNoteRow);
}

/**
 * Uploads a finished recording to the voice_notes bucket and inserts its row.
 * Rolls the upload back if the insert fails. Throws the Supabase error on
 * either step.
 */
export async function addVoiceNote(
  target: VoiceNoteTarget,
  closetId: string,
  recording: PendingVoiceNote,
): Promise<VoiceNote> {
  const { folder, outfit_id, clothing_item_id } = targetColumns(target);

  let bytes: ArrayBuffer;
  let extension: string;
  let contentType: string;
  try {
    ({ bytes, extension, contentType } = await readRecording(recording.uri));
  } finally {
    revokeIfBlobUrl(recording.uri);
  }

  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(VOICE_NOTE_BUCKET).upload(path, bytes, { contentType });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from(VOICE_NOTE_BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from('voice_notes')
    .insert({
      closet_id: closetId,
      outfit_id,
      clothing_item_id,
      audio_url: publicUrlData.publicUrl,
      duration_seconds: recording.durationSeconds,
    })
    .select(VOICE_NOTE_SELECT)
    .returns<VoiceNoteQueryRow[]>()
    .single();
  if (error) {
    await supabase.storage.from(VOICE_NOTE_BUCKET).remove([path]);
    throw error;
  }
  return mapVoiceNoteRow(data);
}

/**
 * Deletes a voice note's row, then its storage object. Row first: RLS is
 * what decides whether this user may delete it, and the object policy only
 * checks that they're signed in - so a refused row delete must not leave
 * the audio removed out from under a note that still exists.
 */
export async function deleteVoiceNote(note: VoiceNote): Promise<void> {
  const { data, error } = await supabase.from('voice_notes').delete().eq('id', note.id).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("You can only delete voice notes you recorded, or any note on a closet you own.");

  const marker = `/object/public/${VOICE_NOTE_BUCKET}/`;
  const index = note.audio_url.indexOf(marker);
  if (index !== -1) {
    await supabase.storage.from(VOICE_NOTE_BUCKET).remove([note.audio_url.slice(index + marker.length)]);
  }
}
