/**
 * Customer roster and lineup. Customers are pure data here (who they are,
 * what they say, which art they use); the scene animates them. Adding a
 * customer is one entry in CUSTOMERS plus its art in characters/friendArt.ts.
 */
import type { Rng } from '../core/rng';
import type { FriendId } from '../characters/friendArt';

export interface CustomerDef {
  id: string;
  name: string;
  /** Built-in characters' art in characters/friendArt.ts. */
  art?: FriendId;
  /** Set for characters a grown-up added: drawn from their picture. */
  addedId?: string;
  favoriteFlavor: string;
  greetings: readonly string[];
  thanks: readonly string[];
}

const friend = (art: FriendId, favoriteFlavor: string, greetings: string[], thanks: string[]): CustomerDef => ({
  id: art,
  name: art[0]!.toUpperCase() + art.slice(1),
  art,
  favoriteFlavor,
  greetings,
  thanks,
});

/** Everyone who visits the shop. Momo isn't here: she runs it. */
export const CUSTOMERS: readonly CustomerDef[] = [
  friend('mallow', 'chocolate', ['Woof! Hello!', 'Hi hi!'], ['Wag wag! Thank you!', 'Yummy!']),
  friend('bonbon', 'strawberry', ['Hop hop! Hello!', 'Hi, friend!'], ['So pink! Thank you!', 'Hoppy happy!']),
  friend('kiki', 'lemon', ['Mew! Hello!', 'Hi there!'], ['Purr-fect!', 'Sunny and sweet! Thanks!']),
  friend('pom', 'blueberry', ['Hello from the sea!', 'Hi hi!'], ['Splish! Thank you!', 'Cool and yummy!']),
  friend('lulu', 'honey-lavender', ['Baa! Good day!', 'Hello!'], ['Dreamy! Thank you!', 'Soft and sweet!']),
  friend('pickle', 'mint', ['Ribbit! Hi!', 'Hello hello!'], ['Ribbit-tastic!', 'Thank you so much!']),
  friend('pebble', 'vanilla', ['Waddle waddle! Hi!', 'Hello!'], ['Brrr-illiant! Thanks!', 'Just how I like it!']),
  friend('bao', 'strawberry', ['Hello! I am hungry!', 'Hi there!'], ['Mmm! Thank you!', 'Big panda hug!']),
  friend('maple', 'chocolate', ['Hi! Something smells yummy!', 'Hello!'], ['Fox-tastic!', 'Thank you, friend!']),
  friend('koko', 'honey-lavender', ["G'day! Hello!", 'Hi hi!'], ['Sweet as! Thanks!', 'Yum yum!']),
  friend('peep', 'lemon', ['Peep! Hello!', 'Hi hi hi!'], ['Peep peep! Thank you!', 'Tweet treat!']),
  friend('hazel', 'vanilla', ['Squeak! Hello!', 'Hi there!'], ['Cheeks full! Thanks!', 'Squeak-tacular!']),
  friend('olive', 'blueberry', ['Hoo! Hello!', 'Good evening! Hoo!'], ['Hoo-ray! Thank you!', 'A wise choice!']),
];

/** A customer from the roster; one that has since been removed falls back to the first built-in customer. */
export function customerById(id: string, roster: readonly CustomerDef[] = CUSTOMERS): CustomerDef {
  return roster.find((c) => c.id === id) ?? CUSTOMERS[0]!;
}

/** Picks `count` customers, never the same one twice in a row. */
export function lineup(rng: Rng, count: number, roster: readonly CustomerDef[] = CUSTOMERS): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const options = roster.filter((c) => c.id !== ids[i - 1]);
    ids.push(rng.pick(options.length > 0 ? options : roster).id);
  }
  return ids;
}

/** Deterministic line choice so a resumed order reads the same. */
export function lineFor(lines: readonly string[], salt: number): string {
  return lines[Math.abs(salt) % lines.length] ?? '';
}
