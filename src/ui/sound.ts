/**
 * Plays the shop's sound effects with Web Audio, from the tones in
 * `src/audio/soundCues.ts`. There are no audio files.
 *
 * Browsers only allow sound after a tap, so the audio starts on the first
 * touch, click or key. On iPhone and iPad the audio session is "ambient": the
 * silent switch mutes the game and a grown-up's music keeps playing. Sound
 * pauses while the game is hidden. If Web Audio is missing or fails, every
 * call quietly does nothing and the game plays the same.
 */
import { cueTones, type Tone } from '../audio/soundCues';
import { GAME_CONFIG, type SoundCueId } from '../config/gameConfig';
import { createRng, randomSeed } from '../core/rng';

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;
let output: AudioNode | null = null;
const rng = createRng(randomSeed());

/** Master volume, then a soft lowpass, then a gentle limiter so overlapping sounds never get loud. */
function buildOutput(c: AudioContext): AudioNode {
  const { volume: level, lowpassHz, limiter: limits } = GAME_CONFIG.sound;
  const volume = c.createGain();
  volume.gain.value = level;
  const soften = c.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = lowpassHz;
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = limits.thresholdDb;
  limiter.knee.value = limits.kneeDb;
  limiter.ratio.value = limits.ratio;
  volume.connect(soften).connect(limiter).connect(c.destination);
  return volume;
}

function createContext(): void {
  const audioSession = (navigator as AudioSessionNavigator).audioSession;
  if (audioSession) audioSession.type = 'ambient';
  ctx = new AudioContext();
  output = buildOutput(ctx);
}

/** Called on every tap: the first one creates the audio, later ones wake it if the system paused it. */
function wake(): void {
  try {
    if (!ctx) createContext();
    if (ctx && ctx.state !== 'running' && !document.hidden) void ctx.resume().catch(() => undefined);
  } catch (err) {
    console.warn('Sound is off: Web Audio could not start.', err);
    removeListeners();
  }
}

function onVisibility(): void {
  if (!ctx) return;
  const change = document.hidden ? ctx.suspend() : ctx.resume();
  void change.catch(() => undefined);
}

const WAKE_EVENTS = ['pointerdown', 'touchend', 'keydown'] as const;

function removeListeners(): void {
  for (const type of WAKE_EVENTS) window.removeEventListener(type, wake, true);
}

/** Starts listening for the first tap. Call once when the game starts. */
export function initSound(): void {
  if (typeof window.AudioContext !== 'function') return;
  for (const type of WAKE_EVENTS) window.addEventListener(type, wake, true);
  document.addEventListener('visibilitychange', onVisibility);
}

function scheduleTone(c: AudioContext, out: AudioNode, tone: Tone, start: number): void {
  const t0 = start + tone.at;
  const end = t0 + tone.attack + tone.decay;
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(tone.freq, t0);
  if (tone.slide > 0) osc.frequency.exponentialRampToValueAtTime(tone.endFreq, t0 + tone.slide);
  const env = c.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(tone.gain, t0 + tone.attack);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(env).connect(out);
  osc.start(t0);
  osc.stop(end + 0.05);
}

/** Plays one sound effect now, if sound has started. */
export function playSound(id: SoundCueId): void {
  if (!ctx || !output || ctx.state !== 'running') return;
  try {
    const start = ctx.currentTime + 0.01;
    for (const tone of cueTones(id, rng)) scheduleTone(ctx, output, tone, start);
  } catch (err) {
    console.warn('A sound could not play.', err);
  }
}
