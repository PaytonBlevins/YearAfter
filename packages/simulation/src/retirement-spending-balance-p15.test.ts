import { describe, expect, it } from 'vitest';
import { reconcile } from '@yearafter/finance';
import { createNewGame, advanceYear, retireNow, decide, netWorthOf, type GameState } from './index';
function answer(s: GameState) {
  let state = s;
  for (let g = 0; state.pending.length && g < 20; g++) {
    const d = state.pending[0];
    const first = d?.choices[0];
    const last = d?.choices.at(-1);
    if (!d || !first || !last) throw Error('No decision choices');
    let r = decide(state, d.eventId, first.id);
    if (!r.ok) r = decide(state, d.eventId, last.id);
    if (!r.ok) throw Error(d.eventId);
    state = r.value.state;
  }
  if (state.pending.length) throw Error('Unanswered decision');
  return state;
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
describe('P15 paired retirement calibration', () => {
  it.each([0, 150])(
    'spends some wealth down on veh-%s onward without losing reconciliation',
    (start) => {
      const differences: number[] = [];
      for (let seed = start; seed < start + 150; seed++) {
        let s = createNewGame({ seed: `veh-${seed}` });
        let at75: number | undefined;
        for (let g = 0; s.player.alive && g < 110; g++) {
          if (s.player.age >= 65 && s.retirement.retiredAtAge === undefined) {
            const r = retireNow(s);
            if (!r.ok) throw Error(r.error);
            s = r.value.state;
          }
          s = answer(advanceYear(s).state);
          if (s.player.age === 75) at75 = netWorthOf(s);
          if (s.player.age === 85 && at75 !== undefined) differences.push(netWorthOf(s) - at75);
        }
        expect(reconcile(s.finance).ok).toBe(true);
      }
      expect(differences.length).toBeGreaterThan(50);
      expect(median(differences)).toBeLessThan(-15000);
      expect(median(differences)).toBeGreaterThan(-150000);
      expect(differences.filter((x) => x < 0).length / differences.length).toBeGreaterThan(0.7);
    },
    120000,
  );
});
