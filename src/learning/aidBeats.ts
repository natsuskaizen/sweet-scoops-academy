/**
 * Turns a VisualAid explanation into the beats the shop animates, one at a
 * time. Works on the subject-agnostic VisualAid data, so the scene never needs
 * to know which operation produced it. Hints and other aids have no beats:
 * they are drawn all at once.
 */
import type { VisualAid } from './types';

export type AidBeat =
  /** Fill cup `group` and show the skip-count total so far. */
  | { kind: 'fill'; group: number; label: string; final: boolean }
  /** Deal one scoop from the pile into every cup; `round` scoops are now in each. */
  | { kind: 'deal'; round: number; pileLeft: number; label: string; final: boolean };

const range = (n: number): number[] => Array.from({ length: Math.max(0, n) }, (_, i) => i);

export function aidBeats(aid: VisualAid): AidBeat[] {
  if (aid.kind === 'groups' && aid.showTotal) {
    return range(aid.groups).map((i) => ({
      kind: 'fill',
      group: i,
      label: String(aid.perGroup * (i + 1)),
      final: i === aid.groups - 1,
    }));
  }
  if (aid.kind === 'share' && aid.perGroup !== null) {
    const { total, groups, perGroup } = aid;
    return range(perGroup).map((r) => ({
      kind: 'deal',
      round: r + 1,
      pileLeft: total - (r + 1) * groups,
      label: String(r + 1),
      final: r === perGroup - 1,
    }));
  }
  return [];
}
