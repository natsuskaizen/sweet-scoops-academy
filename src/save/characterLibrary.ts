/**
 * The characters a grown-up added, kept in their own storage key on this
 * device (apart from the game save, so pictures aren't copied into the save's
 * backup slot on every write). Backup files carry them too (see backup.ts).
 *
 * Like the save, nothing invalid is loaded: a bad entry is dropped with a
 * warning instead of breaking the shop.
 */
import { checkDraft, createCharacter, validateAddedCharacter, type AddedCharacter } from '../shop/addedCharacters';
import type { CharacterDraft } from '../shop/addedCharacters';
import { GAME_CONFIG } from '../config/gameConfig';
import type { StorageLike, WriteResult } from './saveManager';

export const CHARACTERS_KEY = 'sweet-scoops-academy.characters';
const FORMAT_VERSION = 1;

export type AddResult = { ok: true; character: AddedCharacter } | { ok: false; error: string };

/** Keeps the valid characters from untrusted data (storage or a backup file) and lists what was dropped. */
export function readCharacterList(data: unknown): { characters: AddedCharacter[]; problems: string[] } {
  if (!Array.isArray(data)) return { characters: [], problems: data === undefined ? [] : ['not a list'] };
  const characters: AddedCharacter[] = [];
  const problems: string[] = [];
  const ids = new Set<string>();
  data.forEach((c, i) => {
    const found = validateAddedCharacter(c);
    if (found.length === 0 && ids.has((c as AddedCharacter).id)) found.push('duplicate id');
    if (found.length > 0) return problems.push(`character ${i}: ${found[0]}`);
    ids.add((c as AddedCharacter).id);
    characters.push(c as AddedCharacter);
  });
  return { characters, problems };
}

export class CharacterLibrary {
  private characters: AddedCharacter[];

  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.characters = this.load();
  }

  list(): readonly AddedCharacter[] {
    return this.characters;
  }

  add(draft: CharacterDraft): AddResult {
    const problems = checkDraft(draft, this.characters.length);
    if (problems.length > 0) return { ok: false, error: problems[0]! };
    const character = createCharacter(
      draft,
      this.now(),
      this.characters.map((c) => c.id),
    );
    const result = this.write([...this.characters, character]);
    return result.ok ? { ok: true, character } : result;
  }

  setEnabled(id: string, enabled: boolean): WriteResult {
    return this.write(this.characters.map((c) => (c.id === id ? { ...c, enabled } : c)));
  }

  remove(id: string): WriteResult {
    return this.write(this.characters.filter((c) => c.id !== id));
  }

  /** Loading a backup file adds the characters this device doesn't have yet, up to the limit. */
  merge(characters: readonly AddedCharacter[]): WriteResult {
    const have = new Set(this.characters.map((c) => c.id));
    const room = Math.max(0, GAME_CONFIG.addedCharacters.maxCharacters - this.characters.length);
    const extra = characters.filter((c) => !have.has(c.id)).slice(0, room);
    return extra.length === 0 ? { ok: true } : this.write([...this.characters, ...extra]);
  }

  private load(): AddedCharacter[] {
    let raw: string | null;
    try {
      raw = this.storage.getItem(CHARACTERS_KEY);
    } catch {
      return [];
    }
    if (raw === null) return [];
    try {
      const { characters, problems } = readCharacterList((JSON.parse(raw) as { characters?: unknown }).characters);
      if (problems.length > 0) console.warn('Dropped added characters:', problems);
      return characters;
    } catch {
      console.warn('Added characters could not be read.');
      return [];
    }
  }

  private write(characters: AddedCharacter[]): WriteResult {
    try {
      if (characters.length === 0) this.storage.removeItem(CHARACTERS_KEY);
      else this.storage.setItem(CHARACTERS_KEY, JSON.stringify({ version: FORMAT_VERSION, characters }));
    } catch (err) {
      return { ok: false, error: `storage write failed: ${String(err)}` };
    }
    this.characters = characters;
    return { ok: true };
  }
}
