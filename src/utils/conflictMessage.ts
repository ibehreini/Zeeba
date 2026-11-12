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
