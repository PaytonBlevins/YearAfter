import { describe, expect, it } from 'vitest';
import { reconcile } from '@yearafter/finance';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { netWorthOf } from './businesses';
import type { GameState } from './game-state';
const median = (values: readonly number[]): number => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)] ?? 0;
};
function answer(input: GameState): GameState {
  let state = input;
  for (let guard = 0; state.pending.length > 0 && guard < 16; guard += 1) {
    const question = state.pending[0];
    const first = question?.choices[0];
    const last = question?.choices.at(-1);
    if (!question || !first || !last) throw new Error('Unanswerable question');
    let result = decide(state, question.eventId, first.id);
    if (!result.ok) result = decide(state, question.eventId, last.id);
    if (!result.ok) throw new Error(`Cannot answer ${question.eventId}`);
    state = result.value.state;
  }
  if (state.pending.length > 0) throw new Error('Decision guard exhausted');
  return state;
}
describe('P2 — measured default on two disjoint 150-life samples', () => {
  it.each([0, 150])(
    'retains the literal age-band calibration on veh-%s onward',
    (start) => {
      const fifties: number[] = [];
      const sixties: number[] = [];
      for (let seed = start; seed < start + 150; seed += 1) {
        let state = createNewGame({ seed: `veh-${seed}` });
        for (let year = 0; state.player.alive && year < 110; year += 1) {
          state = answer(advanceYear(state).state);
          expect(state.household.lifestyle).toBe('comfortable');
          const age = state.player.age;
          if (age >= 55 && age <= 64) fifties.push(netWorthOf(state));
          if (age >= 65 && age <= 74) sixties.push(netWorthOf(state));
        }
        expect(reconcile(state.finance).ok).toBe(true);
      }
      expect(fifties.length).toBeGreaterThan(1_000);
      expect(sixties.length).toBeGreaterThan(1_000);
      expect(median(fifties)).toBeGreaterThan(220_000);
      expect(median(fifties)).toBeLessThan(420_000);
      expect(median(sixties)).toBeGreaterThan(280_000);
      expect(median(sixties)).toBeLessThan(520_000);
    },
    120_000,
  );
});
