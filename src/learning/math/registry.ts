/**
 * The list of math operations the game knows about. Every known operation is
 * kept (so saved rounds stay valid if one is switched off); only the enabled
 * ones are used to plan new rounds.
 */
import { GAME_CONFIG, type MathConfig } from '../../config/gameConfig';
import { createAddition } from './addition';
import { createCounting } from './counting';
import { createDivision } from './division';
import { createMultiplication } from './multiplication';
import type { MathOperation } from './operation';
import { createSubtraction } from './subtraction';

export interface OperationRegistry {
  all: readonly MathOperation[];
  enabled: readonly MathOperation[];
  get(id: string): MathOperation | undefined;
}

export function createOperations(math: MathConfig = GAME_CONFIG.math): OperationRegistry {
  const all = [
    createMultiplication(math),
    createDivision(math),
    createAddition(math),
    createSubtraction(math),
    createCounting(math),
  ];
  const byId = new Map(all.map((op) => [op.id, op]));
  const enabled = math.enabledOperations.map((id) => {
    const op = byId.get(id);
    if (!op) throw new Error(`Unknown math operation "${id}" in config`);
    return op;
  });
  if (enabled.length === 0) throw new Error('Enable at least one math operation');
  return { all, enabled, get: (id) => byId.get(id) };
}

/** The operations built from GAME_CONFIG. */
export const OPERATIONS = createOperations();
