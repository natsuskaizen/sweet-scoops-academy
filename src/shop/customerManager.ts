/**
 * Customer roster and lineup. Customers are pure data here (who they are,
 * what they say, which sprite they use); the scene animates them. Adding a
 * customer is one entry in CUSTOMERS plus a sprite in characters/sprites.ts.
 */
import type { Rng } from '../core/rng';
import type { Palette, SpeciesId } from '../characters/sprites';

export interface CustomerDef {
  id: string;
  name: string;
  species: SpeciesId;
  /** Optional recolour so one species can make several customers. */
  palette?: Partial<Palette>;
  favoriteFlavor: string;
  greetings: readonly string[];
  thanks: readonly string[];
}

export const CUSTOMERS: readonly CustomerDef[] = [
  {
    id: 'berry', name: 'Berry', species: 'bunny', favoriteFlavor: 'strawberry',
    greetings: ['Hi hi!', 'Hello, friend!'], thanks: ['Yummy! Thank you!', 'So pink! I love it!'],
  },
  {
    id: 'miso', name: 'Miso', species: 'kitten', favoriteFlavor: 'honey-lavender',
    greetings: ['Mew! Hello!', 'Hi there!'], thanks: ['Purr-fect!', 'New flavor idea! Thanks!'],
  },
  {
    id: 'puff', name: 'Puff', species: 'puppy', favoriteFlavor: 'blueberry',
    palette: { B: '#f6e3c8', A: '#e0b48a', b: '#ff9ec0', n: '#7a5240' },
    greetings: ['Woof! Hi!', 'Hello hello!'], thanks: ['Wag wag! Thank you!', 'Best shop ever!'],
  },
  {
    id: 'pip', name: 'Pip', species: 'duckling', favoriteFlavor: 'lemon',
    greetings: ['Quack! Hi!', 'Hello!'], thanks: ['Quack-tastic!', 'Thank you so much!'],
  },
  {
    id: 'mochi', name: 'Mochi', species: 'bear', favoriteFlavor: 'chocolate',
    greetings: ['Hi! I am hungry!', 'Hello!'], thanks: ['Mmm! Thank you!', 'Big bear hug!'],
  },
];

export function customerById(id: string): CustomerDef {
  return CUSTOMERS.find((c) => c.id === id) ?? CUSTOMERS[0]!;
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
