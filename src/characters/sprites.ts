/**
 * Original placeholder pixel art, stored as text so it diffs nicely and needs
 * no image files. Every sprite in a layer stack shares the same 16x20 grid,
 * which is what lets outfits, hats and bows line up on any species.
 *
 * Legend:  .  transparent    o  outline    B  body    A  accent (inner ear)
 *          k  eyes           c  cheeks     n  nose/beak
 *          b  collar/trim    p,w,L,r,g,y  layer colours (see LAYER_COLORS)
 *
 * Real art can replace these later: characterManager only needs a texture
 * per layer with the same frame size.
 */

export const SPRITE_W = 16;
export const SPRITE_H = 20;

export type SpeciesId = 'puppy' | 'bunny' | 'kitten' | 'bear' | 'duckling';

/** Lower face and body shared by the round-headed species. */
const FACE_AND_BODY = [
  '.oBBBBBBBBBBBBo.',
  'oBBBBBBBBBBBBBBo',
  'oBBBkBBBBBBkBBBo',
  'oBBBkBBBBBBkBBBo',
  'oBccBBBnnBBBccBo',
  'oBBBBBBBBBBBBBBo',
  '.oBBBBBBBBBBBBo.',
  '..oooooooooooo..',
  '...oBBBbbBBBo...',
  '..oBBBBBBBBBBo..',
  '..oBBBBBBBBBBo..',
  '...oBBo..oBBo...',
  '...ooo....ooo...',
];

export const SPECIES_ART: Record<SpeciesId, string[]> = {
  // Cloud puppy: long floppy ears hanging beside the face, blue accents.
  puppy: [
    '................',
    '................',
    '................',
    '................',
    '....oooooooo....',
    '...oBBBBBBBBo...',
    '.ooBBBBBBBBBBoo.',
    'oAAoBBBBBBBBoAAo',
    'oAAoBBBBBBBBoAAo',
    'oAAoBkBBBBkBoAAo',
    'oAAoBkBBBBkBoAAo',
    'oAAocBBnnBBcoAAo',
    'oAAoBBBBBBBBoAAo',
    '.oAAoBBBBBBoAAo.',
    '..oo.oooooo.oo..',
    '....oBBbbBBo....',
    '...oBBBBBBBBo...',
    '...oBBBBBBBBo...',
    '....oBBooBBo....',
    '....ooo..ooo....',
  ],
  bunny: [
    '...ooo....ooo...',
    '..oBAo....oABo..',
    '..oBAo....oABo..',
    '..oBAo....oABo..',
    '..oBAo....oABo..',
    '..oBBo....oBBo..',
    '..oBBBooooBBBo..',
    ...FACE_AND_BODY,
  ],
  kitten: [
    '................',
    '................',
    '................',
    '...o........o...',
    '..oAo......oAo..',
    '..oAAo....oAAo..',
    '..oBBBooooBBBo..',
    ...FACE_AND_BODY,
  ],
  bear: [
    '................',
    '................',
    '................',
    '................',
    '..ooo......ooo..',
    '.oAABo....oBAAo.',
    '.oABBBooooBBBAo.',
    ...FACE_AND_BODY,
  ],
  duckling: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......oo.......',
    '....oooBBooo....',
    ...FACE_AND_BODY.map((row, i) => (i === 4 ? 'oBccBBnnnnBBccBo' : row)),
  ],
};

/** Where the eyes are, so expressions can redraw them. Same for every species above. */
export const EYES = { left: { x: 4, y: 9 }, right: { x: 11, y: 9 } } as const;
/** Puppy eyes sit one column further in because of its ears. */
export const EYES_PUPPY = { left: { x: 5, y: 9 }, right: { x: 10, y: 9 } } as const;

export type Expression = 'neutral' | 'happy' | 'thinking';

export interface Palette {
  o: string; B: string; A: string; k: string; c: string; n: string; b: string;
}

export const SPECIES_PALETTE: Record<SpeciesId, Palette> = {
  puppy: { o: '#5b4a6b', B: '#fdfcff', A: '#cfe8ff', k: '#3a2e44', c: '#ffc2d4', n: '#6c8fc7', b: '#7fb8f0' },
  bunny: { o: '#7a4a62', B: '#ffd6e5', A: '#ff9ec0', k: '#3a2e44', c: '#ff8fb3', n: '#e0607e', b: '#ff7fa8' },
  kitten: { o: '#5b4a6b', B: '#fffaf3', A: '#ffc9d9', k: '#3a2e44', c: '#ffc2d4', n: '#f29bb5', b: '#b9a3e3' },
  bear: { o: '#6b4a3a', B: '#e9c8a8', A: '#c99a78', k: '#3a2e44', c: '#ffb3a7', n: '#7a5240', b: '#9ad8b8' },
  duckling: { o: '#7a6232', B: '#fff1a8', A: '#ffe27a', k: '#3a2e44', c: '#ffc2a8', n: '#ffaa55', b: '#9ad8f0' },
};

// ---------------------------------------------------------------------------
// Clothing / accessory layers (same 16x20 grid)
// ---------------------------------------------------------------------------

export type LayerId = 'apron' | 'chef-hat' | 'hat-beret' | 'bow-strawberry' | 'cone';

export const LAYER_COLORS: Record<string, string> = {
  p: '#ff8fb3', w: '#fffaf3', L: '#c7b3f0', r: '#ff5f7e', g: '#7fd6a8', y: '#f5c27a', o: '#5b4a6b',
};

const EMPTY_ROW = '................';
const grid = (rows: Record<number, string>): string[] =>
  Array.from({ length: SPRITE_H }, (_, i) => rows[i] ?? EMPTY_ROW);

export const LAYER_ART: Record<LayerId, string[]> = {
  apron: grid({
    15: '.....pwwwwp.....',
    16: '....pwwppwwp....',
    17: '....pwwwwwwp....',
  }),
  'chef-hat': grid({
    0: '.....oooooo.....',
    1: '....owwwwwwo....',
    2: '...owwwwwwwwo...',
    3: '....owwwwwwo....',
    4: '....oppppppo....',
  }),
  'hat-beret': grid({
    1: '......ooo.......',
    2: '....ooLLLoo.....',
    3: '...oLLLLLLLo....',
    4: '...oooooooooo...',
  }),
  'bow-strawberry': grid({
    5: '..........o.o...',
    6: '.........oror...',
    7: '..........o.o...',
  }),
  cone: grid({
    12: '..............oo',
    13: '.............opp',
    14: '.............opp',
    15: '.............oyy',
    16: '..............oy',
  }),
};

/** Ice cream scoop flavour colours, used for cones, cups and explanations. */
export const FLAVOR_COLORS: Record<string, string> = {
  strawberry: '#ff9ec0',
  'honey-lavender': '#c7b3f0',
  blueberry: '#9cc8ff',
  lemon: '#fff08a',
  chocolate: '#b07a5a',
  mint: '#9ee6c4',
  vanilla: '#fff6df',
};
