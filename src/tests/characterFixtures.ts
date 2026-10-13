import type { CharacterDraft } from '../shop/addedCharacters';

/** A tiny stand-in PNG: the checks look at the data URL type and size, not the pixels. */
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

/** A valid 5-frame 32x40 customer draft. */
export function draft(over: Partial<CharacterDraft> = {}): CharacterDraft {
  return {
    name: ' Minty ',
    role: 'customer',
    favoriteFlavor: 'mint',
    greetings: ['Hi hi! '],
    thanks: [],
    image: PNG,
    width: 160,
    height: 40,
    head: { x: 16, y: 4 },
    neck: { x: 16, y: 20 },
    ...over,
  };
}
