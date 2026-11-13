/**
 * The wear-count line on the item and outfit pages, e.g.
 * formatWornCount(2, 'This outfit has been worn') -> "This outfit has been worn 2 times".
 * Zero reads "Not worn yet" rather than "worn 0 times".
 */
export function formatWornCount(count: number, sentenceStart: string): string {
  if (count === 0) return 'Not worn yet';
  return `${sentenceStart} ${count} ${count === 1 ? 'time' : 'times'}`;
}
