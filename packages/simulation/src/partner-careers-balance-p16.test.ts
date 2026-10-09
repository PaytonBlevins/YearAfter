/** Approved metric: log pay, positive dual-earner years with partner age 25–61. */
import { expect, it } from 'vitest';
import { reconcile } from '@yearafter/finance';
import { householdPartnerOf } from '@yearafter/social';
import { npcAge } from '@yearafter/relationships';
import { createNewGame, advanceYear, decide, netWorthOf, type GameState } from './index';
const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
function correlation(ps: number[][]): number {
  const x = ps.reduce((s, p) => s + p[0]!, 0) / ps.length,
    y = ps.reduce((s, p) => s + p[1]!, 0) / ps.length;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (const p of ps) {
    xx += (p[0]! - x) ** 2;
    yy += (p[1]! - y) ** 2;
    xy += (p[0]! - x) * (p[1]! - y);
  }
  return xy / Math.sqrt(xx * yy);
}
function answer(state: GameState): GameState {
  for (let n = 0; state.pending.length && n < 20; n++) {
    const d = state.pending[0]!;
    let r = decide(state, d.eventId, d.choices[0]!.id);
    if (!r.ok) r = decide(state, d.eventId, d.choices.at(-1)!.id);
    if (!r.ok) throw Error(d.eventId);
    state = r.value.state;
  }
  expect(state.pending).toHaveLength(0);
  return state;
}
it('retains approved matching and unchanged household bands in two independent actual-life cohorts', () => {
  let highPayYears = 0;
  for (const start of [0, 150]) {
    const pairs: number[][] = [],
      worth55: number[] = [],
      worth65: number[] = [];
    let paired45 = 0,
      owned45 = 0;
    for (let seed = start; seed < start + 150; seed++) {
      let s = createNewGame({ seed: `veh-${seed}` });
      for (let year = 0; s.player.alive && year < 110; year++) {
        s = answer(advanceYear(s).state);
        if (s.player.age < 18) continue;
        expect(reconcile(s.finance).ok).toBe(true);
        const p = householdPartnerOf(s.circle.people),
          age = p ? npcAge(p, s.world.year) : -1;
        const rows = s.finance.transactions.filter((t) => t.year === s.world.year);
        const wage = rows
          .filter((t) => t.category === 'salary' || t.category === 'commission')
          .reduce((v, t) => v + Number(t.amount) / 100, 0);
        const pay = rows
          .filter((t) => t.category === 'partner')
          .reduce((v, t) => v + Number(t.amount) / 100, 0);
        if (age >= 25 && age <= 61 && pay > 0) {
          if (wage > 0) pairs.push([wage, pay]);
          if (pay > 250000) highPayYears++;
        }
        if (s.player.age >= 55 && s.player.age <= 64) worth55.push(netWorthOf(s));
        if (s.player.age >= 65 && s.player.age <= 74) worth65.push(netWorthOf(s));
        if (s.player.age >= 45 && s.player.age <= 54 && p) {
          paired45++;
          if (s.homes.length) owned45++;
        }
      }
    }
    const log = correlation(pairs.map((p) => p.map(Math.log))),
      raw = correlation(pairs);
    console.log(
      JSON.stringify({
        start,
        dual: pairs.length,
        logCorrelation: log,
        rawCorrelation: raw,
        worth55: median(worth55),
        worth65: median(worth65),
        ownership: owned45 / paired45,
      }),
    );
    expect(pairs.length).toBeGreaterThan(2000);
    expect(log).toBeGreaterThan(0.3);
    expect(log).toBeLessThan(0.4);
    expect(median(worth55)).toBeGreaterThanOrEqual(220000);
    expect(median(worth55)).toBeLessThanOrEqual(420000);
    expect(median(worth65)).toBeGreaterThanOrEqual(280000);
    expect(median(worth65)).toBeLessThanOrEqual(520000);
    expect(owned45 / paired45).toBeGreaterThan(0.5);
  }
  expect(highPayYears).toBeGreaterThan(0);
}, 120000);
