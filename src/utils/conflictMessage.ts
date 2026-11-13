import { showAlert } from '@/utils/alert';

/**
 * The alert text for an edit form whose save hit a conflict: names the fields
 * someone else changed between the version the form loaded (`before`) and the
 * fresh one (`after`), so pressing Save again isn't a blind overwrite.
 * Lists compare as sets: an outfit's item ids come back in no fixed order.
 */
export function conflictMessage<T>(before: T, after: T, fieldLabels: Partial<Record<keyof T, string>>): string {
  const key = (value: unknown) => JSON.stringify(Array.isArray(value) ? [...value].sort() : value);
  const changed = (Object.keys(fieldLabels) as (keyof T)[])
    .filter(field => key(before[field]) !== key(after[field]))
    .map(field => fieldLabels[field]);
  const what = changed.length > 0 ? `Someone else changed: ${changed.join(', ')}.` : 'Someone else saved changes.';
  return `${what} Your edits are still in the form. Press Save Changes to replace theirs with yours, or go back without saving to keep theirs.`;
}

type SaveConflict<T> = {
  /** The record as the form loaded it. */
  before: T;
  /** Re-reads the record; null if it has since been deleted. */
  fetchFresh: () => Promise<T | null>;
  /** Stores the re-read record as the form's new baseline. */
  setFresh: (fresh: T | null) => void;
  fieldLabels: Partial<Record<keyof T, string>>;
  /** 'item' or 'outfit', for the deleted-while-editing alert. */
  noun: string;
};

/**
 * Handles an edit form's save that failed with a ConflictError. Refreshes only
 * the OCC baseline (updated_at) - deliberately NOT the form's fields or picked
 * photo, so the user's in-progress edits survive the conflict and pressing
 * Save again applies them against the fresh token. This also self-heals a save
 * whose response was lost to a network drop: the retry hits a false conflict
 * and then succeeds.
 */
export async function handleSaveConflict<T>({ before, fetchFresh, setFresh, fieldLabels, noun }: SaveConflict<T>) {
  try {
    const fresh = await fetchFresh();
    setFresh(fresh);
    showAlert(
      fresh ? 'Someone else saved changes' : `${noun[0].toUpperCase()}${noun.slice(1)} deleted`,
      fresh ? conflictMessage(before, fresh, fieldLabels) : `This ${noun} was deleted while you were editing.`,
    );
  } catch {
    showAlert('Couldn’t save changes', 'Please check your connection and try again.');
  }
}
