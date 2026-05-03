export const CHARACTER_BASE_MOVE_DURATION_MS = 1500;
export const ROUND_MOVEMENT_SETTLE_MS = 120;
export const ROUND_INTRO_DURATION_MS = 2000;
export const ROUND_RESULT_HOLD_MS = 1800;
export const ROUND_THREE_RESULT_HOLD_MS = 2700;
export const ROUND_REVEAL_BUFFER_MS = 2500;

/**
 * Maps the internal 1/2/3 round number to the user-facing 0/1/2 label.
 * Internal data structures, contract round IDs, and state machines keep
 * 1/2/3 indexing; only display strings are 0-indexed.
 */
export function displayRoundNumber(internalRound: number, padded = true): string {
  const value = Math.max(0, internalRound - 1);
  return padded ? String(value).padStart(2, '0') : String(value);
}
export const FINAL_RESULT_EXPAND_DELAY_MS = 950;

export const FLOW_REVEAL_INITIAL_DELAY_MS = 520;
export const FLOW_REVEAL_STEP_MS = 1180;
export const FLOW_REVEAL_SETTLE_MS = 1600;

export function flowRevealItemDelayMs(index: number) {
  return FLOW_REVEAL_INITIAL_DELAY_MS + index * FLOW_REVEAL_STEP_MS;
}

export function roundProcessDurationMs(itemCount: number) {
  if (itemCount <= 0) return FLOW_REVEAL_SETTLE_MS;
  return flowRevealItemDelayMs(itemCount - 1) + FLOW_REVEAL_SETTLE_MS;
}
