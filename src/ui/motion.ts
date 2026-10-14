/**
 * Calm mode (a player's "Less bouncing and confetti" setting): characters
 * stand still instead of breathing, hopping and tilting, and no confetti
 * falls. Set from the active player whenever the shop is built, like LAYOUT.
 */
let calm = false;

export function isCalm(): boolean {
  return calm;
}

export function setCalm(on: boolean): void {
  calm = on;
}
