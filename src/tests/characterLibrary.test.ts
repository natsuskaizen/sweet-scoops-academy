import { describe, expect, it } from 'vitest';
import { CHARACTERS_KEY, CharacterLibrary, readCharacterList } from '../save/characterLibrary';
import { MemoryStorage } from '../save/saveManager';
import { createCharacter } from '../shop/addedCharacters';
import { draft } from './characterFixtures';

let clock = 1_700_000_000_000;
const now = () => (clock += 1000);

describe('CharacterLibrary', () => {
  it('adds, switches off and removes characters, saving each change', () => {
    const storage = new MemoryStorage();
    const library = new CharacterLibrary(storage, now);
    const added = library.add(draft());
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(new CharacterLibrary(storage, now).list()).toEqual([added.character]);

    expect(library.setEnabled(added.character.id, false)).toEqual({ ok: true });
    expect(new CharacterLibrary(storage, now).list()[0]!.enabled).toBe(false);

    expect(library.remove(added.character.id)).toEqual({ ok: true });
    expect(storage.getItem(CHARACTERS_KEY)).toBeNull();
  });

  it('refuses a bad draft without saving', () => {
    const storage = new MemoryStorage();
    expect(new CharacterLibrary(storage, now).add(draft({ name: '' }))).toEqual({
      ok: false,
      error: 'name must be 1-12 characters',
    });
    expect(storage.getItem(CHARACTERS_KEY)).toBeNull();
  });

  it('reports a failed write and keeps the old list', () => {
    const storage = new MemoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    const library = new CharacterLibrary(storage, now);
    expect(library.add(draft())).toEqual({ ok: false, error: 'storage write failed: Error: quota' });
    expect(library.list()).toEqual([]);
  });

  it('merges backup characters it does not have, up to the limit', () => {
    const library = new CharacterLibrary(new MemoryStorage(), now);
    const first = library.add(draft());
    if (!first.ok) throw new Error(first.error);
    const incoming = Array.from({ length: 13 }, (_, i) => createCharacter(draft(), i, []));
    expect(library.merge([first.character])).toEqual({ ok: true });
    expect(library.merge(incoming)).toEqual({ ok: true });
    expect(library.list()).toHaveLength(12);
    expect(library.list()[0]).toEqual(first.character);
  });

  it('starts empty when storage is unreadable or broken', () => {
    const throwing = new MemoryStorage();
    throwing.getItem = () => {
      throw new Error('blocked');
    };
    expect(new CharacterLibrary(throwing, now).list()).toEqual([]);
    const broken = new MemoryStorage();
    broken.setItem(CHARACTERS_KEY, '{nope');
    expect(new CharacterLibrary(broken, now).list()).toEqual([]);
  });

  it('drops invalid stored entries and keeps the rest', () => {
    const good = createCharacter(draft(), 1, []);
    const storage = new MemoryStorage();
    storage.setItem(CHARACTERS_KEY, JSON.stringify({ version: 1, characters: [good, { ...good, name: '' }] }));
    expect(new CharacterLibrary(storage, now).list()).toEqual([good]);
  });
});

describe('readCharacterList', () => {
  it('keeps valid characters and names the dropped ones', () => {
    const good = createCharacter(draft(), 1, []);
    expect(readCharacterList([good, good, 7])).toEqual({
      characters: [good],
      problems: ['character 1: duplicate id', 'character 2: not an object'],
    });
    expect(readCharacterList(undefined)).toEqual({ characters: [], problems: [] });
    expect(readCharacterList('x')).toEqual({ characters: [], problems: ['not a list'] });
  });
});
