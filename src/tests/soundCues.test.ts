import { describe, expect, it } from 'vitest';
import { cueLength, cueTones, noteFrequency } from '../audio/soundCues';
import { GAME_CONFIG, type SoundConfig, type SoundCueId } from '../config/gameConfig';
import { createRng } from '../core/rng';

const sound = GAME_CONFIG.sound;
const CUES = Object.keys(sound.cues) as SoundCueId[];

/** Worst case loudness: the tones sounding at once, all at their peak together, sampled every 10 ms. */
function peakLoudness(id: SoundCueId): number {
  const tones = cueTones(id);
  let peak = 0;
  for (let t = 0; t < cueLength(tones); t += 0.01) {
    const sounding = tones.filter((tone) => tone.at <= t && t < tone.at + tone.attack + tone.decay);
    peak = Math.max(
      peak,
      sounding.reduce((sum, tone) => sum + tone.gain, 0),
    );
  }
  return peak;
}

describe('sound cues', () => {
  it('puts every step on the C major pentatonic scale, an octave every 5 steps', () => {
    expect(noteFrequency(0)).toBeCloseTo(261.63, 2); // C4
    expect(noteFrequency(3)).toBeCloseTo(392.0, 1); // G4
    expect(noteFrequency(5)).toBeCloseTo(523.25, 1); // C5
    expect(noteFrequency(9)).toBeCloseTo(880.0, 1); // A5
    expect(noteFrequency(-1)).toBeCloseTo(220.0, 1); // A3
  });

  it('uses whole scale steps only, so no note falls between the scale notes', () => {
    for (const id of CUES)
      for (const note of sound.cues[id].notes ?? []) expect(Number.isInteger(note.step)).toBe(true);
  });

  it('makes a music-box note from one tone per partial of the voice', () => {
    const tones = cueTones('keyTap');
    expect(tones).toHaveLength(sound.voice.length);
    const base = noteFrequency(9);
    expect(tones.map((t) => t.freq / base)).toEqual(sound.voice.map((p) => p.ratio));
    expect(tones.every((t) => t.slide === 0 && t.endFreq === t.freq)).toBe(true);
  });

  it('slides the scoop plop up in pitch', () => {
    const [plop] = cueTones('scoopPlop');
    expect(plop!.endFreq).toBeGreaterThan(plop!.freq);
    expect(plop!.slide).toBeGreaterThan(0);
  });

  it('keeps taps short and every shop sound under two seconds', () => {
    for (const id of ['keyTap', 'keyBack', 'submit', 'scoopPlop'] as const) {
      expect(cueLength(cueTones(id))).toBeLessThan(1);
    }
    for (const id of CUES) expect(cueLength(cueTones(id))).toBeLessThan(2);
  });

  it('keeps every sound soft: starts fade in, and even with every tone at its loudest a cue stays under half volume', () => {
    for (const id of CUES) {
      for (const tone of cueTones(id)) expect(tone.attack).toBeGreaterThan(0);
      expect(peakLoudness(id) * sound.volume).toBeLessThan(0.5);
    }
  });

  it('nudges pitch by at most the jitter, the same way for the same seed', () => {
    const plain = cueTones('keyTap')[0]!.freq;
    const a = cueTones('keyTap', createRng(42))[0]!.freq;
    expect(cueTones('keyTap', createRng(42))[0]!.freq).toBe(a);
    const cents = Math.abs(1200 * Math.log2(a / plain));
    expect(cents).toBeGreaterThan(0);
    expect(cents).toBeLessThanOrEqual(sound.jitterCents);
  });

  it('follows a config override', () => {
    const quiet: SoundConfig = { ...sound, voice: [{ ratio: 1, gain: 0.1, decay: 0.2, decayPerLength: 0 }] };
    const tones = cueTones('orderServed', undefined, quiet);
    expect(tones).toHaveLength(3);
    expect(cueLength(tones)).toBeCloseTo(0.2 + 0.2 + quiet.attack, 5);
  });

  it('is silent for an empty cue', () => {
    const empty: SoundConfig = { ...sound, cues: { ...sound.cues, keyTap: {} } };
    expect(cueTones('keyTap', undefined, empty)).toEqual([]);
    expect(cueLength([])).toBe(0);
  });
});
