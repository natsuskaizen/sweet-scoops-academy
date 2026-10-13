import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../config/gameConfig';
import {
  checkDraft,
  chosenShopkeeper,
  createCharacter,
  customerRoster,
  frameFor,
  hasWalkFrames,
  sheetLayout,
  validateAddedCharacter,
  type AddedCharacter,
  type CharacterDraft,
} from '../shop/addedCharacters';
import { draft } from './characterFixtures';
import { CUSTOMERS } from '../shop/customerManager';

describe('sheetLayout', () => {
  it('reads frames on the 16x20 grid', () => {
    expect(sheetLayout(160, 40)).toEqual({ ok: true, frameW: 32, frameH: 40, frames: 5 });
    expect(sheetLayout(16, 20)).toEqual({ ok: true, frameW: 16, frameH: 20, frames: 1 });
    expect(sheetLayout(192, 80)).toEqual({ ok: true, frameW: 64, frameH: 80, frames: 3 });
  });

  it('says what size a picture should be', () => {
    expect(sheetLayout(32, 41)).toEqual({
      ok: false,
      error: 'The picture should be 20, 40, 60, 80 pixels tall. This one is 41.',
    });
    const fourFrames = sheetLayout(128, 40);
    expect(fourFrames.ok).toBe(false);
    if (!fourFrames.ok) expect(fourFrames.error).toContain('32, 64, 96, 160 pixels wide');
  });
});

describe('poses', () => {
  it('falls back to standing when a frame is missing', () => {
    expect(frameFor(5, 'walkB')).toBe(4);
    expect(frameFor(3, 'thinking')).toBe(2);
    expect(frameFor(3, 'walkA')).toBe(0);
    expect(frameFor(1, 'happy')).toBe(0);
  });

  it('only steps with both walk frames', () => {
    expect(hasWalkFrames(5)).toBe(true);
    expect(hasWalkFrames(3)).toBe(false);
  });
});

describe('checkDraft', () => {
  it('accepts a complete draft, with or without points', () => {
    expect(checkDraft(draft(), 0)).toEqual([]);
    expect(checkDraft(draft({ head: null, neck: null }), 0)).toEqual([]);
  });

  it('lists each problem', () => {
    const problems = checkDraft(
      draft({
        name: '',
        role: 'boss' as never,
        favoriteFlavor: 'pickle',
        greetings: ['a', 'b', 'c', 'd'],
        image: 'data:image/gif;base64,x',
      }),
      0,
    );
    expect(problems).toEqual([
      'name must be 1-12 characters',
      'role must be customer or shopkeeper',
      'unknown favourite flavour',
      'at most 3 hello lines',
      'picture must be a PNG',
    ]);
    expect(checkDraft(draft({ thanks: ['x'.repeat(25)] }), 0)).toEqual([
      'thank-you lines must be 1-24 characters each',
    ]);
    expect(checkDraft(draft({ greetings: 'hi' as never }), 0)).toEqual(['hello lines must be a list of text']);
  });

  it('checks the picture size and the tapped points', () => {
    expect(checkDraft(draft({ width: 100 }), 0)[0]).toMatch(/pixels wide/);
    expect(checkDraft(draft({ head: { x: 32, y: 0 } }), 0)).toEqual(['head point is outside the frame']);
    expect(checkDraft(draft({ neck: { x: 1.5, y: 2 } }), 0)).toEqual(['neck point is outside the frame']);
    const rules = { ...GAME_CONFIG.addedCharacters, maxStoredBytes: 10 };
    expect(checkDraft(draft(), 0, rules)).toEqual(['picture is too big; pixel art pictures are usually a few KB']);
  });

  it('stops at the character limit', () => {
    expect(checkDraft(draft(), 12)).toEqual(['there are already 12 added characters']);
  });
});

describe('createCharacter and validateAddedCharacter', () => {
  it('creates a valid character with a fresh id and trimmed text', () => {
    const c = createCharacter(draft(), 1000, ['added-rs']);
    expect(c).toMatchObject({
      id: 'added-rs-2',
      name: 'Minty',
      greetings: ['Hi hi!'],
      frameW: 32,
      frames: 5,
      enabled: true,
    });
    expect(validateAddedCharacter(c)).toEqual([]);
  });

  it('refuses a draft with a bad picture size', () => {
    expect(() => createCharacter(draft({ height: 41 }), 1, [])).toThrow(/pixels tall/);
  });

  it('refuses stored characters that were tampered with', () => {
    const c = createCharacter(draft(), 1, []);
    expect(validateAddedCharacter(null)).toEqual(['not an object']);
    expect(validateAddedCharacter({ ...c, id: 'cocoa' })).toEqual(['id invalid']);
    expect(validateAddedCharacter({ ...c, frameW: 30 })).toEqual(['frame size invalid']);
    expect(validateAddedCharacter({ ...c, frames: 4 })).toEqual(['frame size invalid']);
    expect(validateAddedCharacter({ ...c, head: { x: 99, y: 0 } })).toEqual(['head point is outside the frame']);
    expect(validateAddedCharacter({ ...c, enabled: 'yes', addedAt: '1' })).toEqual([
      'enabled invalid',
      'addedAt invalid',
    ]);
  });
});

describe('in the shop', () => {
  const at = (n: number, over: Partial<CharacterDraft> = {}): AddedCharacter => createCharacter(draft(over), n, []);

  it('adds switched-on customers to the roster with default lines', () => {
    const minty = at(1);
    const off = { ...at(2), enabled: false };
    const keeper = at(3, { role: 'shopkeeper' });
    const roster = customerRoster([minty, off, keeper]);
    expect(roster).toHaveLength(CUSTOMERS.length + 1);
    expect(roster.at(-1)).toMatchObject({
      id: minty.id,
      addedId: minty.id,
      greetings: ['Hi hi!'],
      thanks: ['Thank you!', 'Yummy!'],
    });
  });

  it('picks the newest switched-on shopkeeper', () => {
    const older = at(1, { role: 'shopkeeper' });
    const newer = at(2, { role: 'shopkeeper' });
    expect(chosenShopkeeper([newer, older])).toBe(newer);
    expect(chosenShopkeeper([{ ...newer, enabled: false }, older])).toBe(older);
    expect(chosenShopkeeper([at(3)])).toBeNull();
  });
});
