/**
 * What each sound effect plays, worked out as plain data: every cue in
 * `GAME_CONFIG.sound.cues` becomes a list of soft sine tones (pitch, start,
 * fade). `src/ui/sound.ts` hands these to Web Audio; nothing here touches the
 * browser, so the rules (one scale, short, quiet) are unit tested.
 */
import { GAME_CONFIG, type SoundConfig, type SoundCueId, type SoundGlide, type SoundNote } from '../config/gameConfig';
import type { Rng } from '../core/rng';

/** One sine tone: it fades in over `attack`, slides from `freq` to `endFreq` over `slide`, then fades out over `decay`. */
export interface Tone {
  at: number;
  freq: number;
  endFreq: number;
  slide: number;
  gain: number;
  attack: number;
  decay: number;
}

/** The pitch of a step on the shop's scale; 5 steps up is an octave. */
export function noteFrequency(step: number, sound: SoundConfig = GAME_CONFIG.sound): number {
  const size = sound.scale.length;
  const octave = Math.floor(step / size);
  const semitones = sound.scale[step - octave * size]! + 12 * octave;
  return sound.scaleRootHz * 2 ** (semitones / 12);
}

function noteTones(note: SoundNote, nudge: number, sound: SoundConfig): Tone[] {
  const freq = noteFrequency(note.step, sound) * nudge;
  return sound.voice.map((p) => ({
    at: note.at,
    freq: freq * p.ratio,
    endFreq: freq * p.ratio,
    slide: 0,
    gain: p.gain * note.loudness,
    attack: sound.attack,
    decay: p.decay + p.decayPerLength * note.length,
  }));
}

function glideTone(glide: SoundGlide, nudge: number, sound: SoundConfig): Tone {
  return {
    at: glide.at,
    freq: glide.fromHz * nudge,
    endFreq: glide.toHz * nudge,
    slide: glide.slide,
    gain: glide.loudness,
    attack: sound.attack,
    decay: glide.length,
  };
}

/**
 * The tones for one play of a cue. With an `rng`, the whole cue is nudged up
 * or down a few cents so ten keypad taps in a row don't sound mechanical.
 */
export function cueTones(id: SoundCueId, rng?: Rng, sound: SoundConfig = GAME_CONFIG.sound): Tone[] {
  const cue = sound.cues[id];
  const cents = rng ? (rng.next() * 2 - 1) * sound.jitterCents : 0;
  const nudge = 2 ** (cents / 1200);
  return [
    ...(cue.notes ?? []).flatMap((n) => noteTones(n, nudge, sound)),
    ...(cue.glides ?? []).map((g) => glideTone(g, nudge, sound)),
  ];
}

/** Seconds from a cue's start until its last tone has faded. */
export function cueLength(tones: readonly Tone[]): number {
  return Math.max(0, ...tones.map((t) => t.at + t.attack + t.decay));
}
