import { describe, expect, it } from 'vitest';
import { aidBeats } from '../learning/aidBeats';

describe('aidBeats', () => {
  it('fills one cup per beat with a skip-count label', () => {
    const beats = aidBeats({ kind: 'groups', groups: 3, perGroup: 4, showTotal: true, caption: '' });
    expect(beats.map((b) => b.label)).toEqual(['4', '8', '12']);
    expect(beats.map((b) => b.final)).toEqual([false, false, true]);
    expect(beats[2]).toMatchObject({ kind: 'fill', group: 2 });
  });

  it('deals one scoop to every cup per round until the pile is empty', () => {
    const beats = aidBeats({ kind: 'share', total: 12, groups: 4, perGroup: 3, caption: '' });
    expect(beats.map((b) => (b.kind === 'deal' ? b.pileLeft : -1))).toEqual([8, 4, 0]);
    expect(beats.map((b) => b.label)).toEqual(['1', '2', '3']);
    expect(beats.at(-1)?.final).toBe(true);
  });

  it('has no beats for hints and other aids, which are drawn at once', () => {
    expect(aidBeats({ kind: 'groups', groups: 3, perGroup: 4, showTotal: false, caption: '' })).toEqual([]);
    expect(aidBeats({ kind: 'share', total: 12, groups: 4, perGroup: null, caption: '' })).toEqual([]);
    expect(aidBeats({ kind: 'count', total: 3, showNumbers: false, caption: '' })).toEqual([]);
    expect(aidBeats({ kind: 'combine', parts: [2, 3], showTotal: true, caption: '' })).toEqual([]);
    expect(aidBeats({ kind: 'text', caption: 'hi' })).toEqual([]);
  });

  it('numbers each scoop of a count one at a time, the last being the answer', () => {
    const beats = aidBeats({ kind: 'count', total: 3, showNumbers: true, caption: '' });
    expect(beats.map((b) => (b.kind === 'count' ? b.label : null))).toEqual(['1', '2', '3']);
    expect(beats.map((b) => b.final)).toEqual([false, false, true]);
  });

  it('lights a word’s letters one beat at a time when sounding it out', () => {
    const beats = aidBeats({ kind: 'word', word: 'sun', lit: 0, sound: true, caption: '' });
    expect(beats.map((b) => b.label)).toEqual(['s', 'u', 'n']);
    expect(beats.map((b) => b.final)).toEqual([false, false, true]);
    expect(aidBeats({ kind: 'word', word: 'sun', lit: 1, caption: '' })).toEqual([]);
  });
});
