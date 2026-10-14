/**
 * The grown-ups area's reset actions and the start screen's player actions,
 * as plain changes to the save. The scene only confirms, calls one of
 * these, writes the save and restarts.
 */
import { GAME_CONFIG } from '../config/gameConfig';
import { randomSeed } from '../core/rng';
import type { ChallengeSpec, LearningSubject } from '../learning/types';
import { createProfile } from './saveManager';
import { resetSubjectProgress, type Profile, type SaveFile, type ShopDetails } from './saveTypes';

type Subject = Pick<LearningSubject<ChallengeSpec, unknown>, 'id' | 'createProgress'>;
type PlayersConfig = typeof GAME_CONFIG.players;

/** Clears the subject's practice progress and the round in play. Sprinkles, items and history stay. */
export function resetLearning(profile: Profile, subject: Subject): void {
  resetSubjectProgress(profile, subject);
  profile.learning.roundsStarted = 0;
  profile.currentRound = null;
}

/** Starts the active player over under the same name and shop; any other players are left alone. */
export function resetProfile(save: SaveFile, now: number): Profile {
  const old = save.profiles[save.activeProfileId];
  const fresh = createProfile(old?.displayName ?? 'Player 1', now, randomSeed(), old?.shop);
  delete save.profiles[save.activeProfileId];
  save.profiles[fresh.id] = fresh;
  save.activeProfileId = fresh.id;
  return fresh;
}

/** A typed name made tidy: no spaces at the ends or doubled inside, at most `max` letters. */
export function cleanName(raw: string, max: number): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, max).trim();
}

/** Everyone who plays on this device, whoever played most recently first. */
export function playersInOrder(save: SaveFile): Profile[] {
  return Object.values(save.profiles).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt || a.createdAt - b.createdAt);
}

/** A player's totals in one line, as the grown-ups area and backup files show them. */
export function playerStats(p: Profile): string {
  return `${p.sprinkles} Sprinkles, ${p.roundHistory.length} rounds finished`;
}

/** A grown-up renames a player: null when done, or why not. */
export function renamePlayer(
  save: SaveFile,
  id: string,
  raw: string,
  config: PlayersConfig = GAME_CONFIG.players,
): string | null {
  const profile = save.profiles[id];
  if (!profile) return 'That player is no longer here.';
  if (!cleanName(raw, config.maxNameLength)) return 'Type a name first.';
  updatePlayer(profile, { name: raw }, config);
  return null;
}

export function canAddPlayer(save: SaveFile, config: PlayersConfig = GAME_CONFIG.players): boolean {
  return Object.keys(save.profiles).length < config.maxPlayers;
}

export interface NewPlayer {
  name: string;
  shop: ShopDetails;
}

/** Adds a player and makes them the one playing. Null when the device is full or a name is blank. */
export function addPlayer(
  save: SaveFile,
  player: NewPlayer,
  now: number,
  config: PlayersConfig = GAME_CONFIG.players,
): Profile | null {
  const name = cleanName(player.name, config.maxNameLength);
  const shopName = cleanName(player.shop.name, config.maxShopNameLength);
  if (!canAddPlayer(save, config) || !name || !shopName || !player.shop.keeper) return null;
  let profile = createProfile(name, now, randomSeed(), { name: shopName, keeper: player.shop.keeper });
  // Two players added in the same millisecond would otherwise be able to share an id.
  while (save.profiles[profile.id]) profile = createProfile(name, now, randomSeed(), profile.shop);
  save.profiles[profile.id] = profile;
  save.activeProfileId = profile.id;
  return profile;
}

/** Makes `id` the player playing and marks them as just played. Null for an unknown id. */
export function choosePlayer(save: SaveFile, id: string, now: number): Profile | null {
  const profile = save.profiles[id];
  if (!profile) return null;
  profile.lastPlayedAt = Math.max(profile.lastPlayedAt, now);
  save.activeProfileId = id;
  return profile;
}

/**
 * Removes a player and everything that is theirs. The last player can't be
 * removed (the game always has someone to play as); removing the one
 * playing hands over to whoever played most recently.
 */
export function removePlayer(save: SaveFile, id: string): boolean {
  if (!save.profiles[id] || Object.keys(save.profiles).length <= 1) return false;
  delete save.profiles[id];
  if (save.activeProfileId === id) save.activeProfileId = playersInOrder(save)[0]!.id;
  return true;
}

export interface PlayerChanges {
  name?: string;
  shopName?: string;
  keeper?: string;
}

/** Applies the changes a child or grown-up made; blank names are ignored so nothing invalid is saved. */
export function updatePlayer(
  profile: Profile,
  changes: PlayerChanges,
  config: PlayersConfig = GAME_CONFIG.players,
): void {
  const name = cleanName(changes.name ?? '', config.maxNameLength);
  const shopName = cleanName(changes.shopName ?? '', config.maxShopNameLength);
  if (name) profile.displayName = name;
  if (shopName) profile.shop.name = shopName;
  if (changes.keeper) profile.shop.keeper = changes.keeper;
}
