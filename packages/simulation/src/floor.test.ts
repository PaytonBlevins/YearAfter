/**
 * Ticket 0308b — DID THE SUBSIDY CLOSE, AND DO THE STRATEGIES SEPARATE NOW?
 *
 * Two changes to test, on the same 80 paired seeds 13.53 was measured on:
 *
 *   the portfolio now counts toward what a household can afford, so somebody
 *     with $2,000,000 in a fund and an empty current account is charged in
 *     full rather than handed 0303's hardship discount;
 *   bonds have a date, so money put into one is genuinely away.
 *
 * What should happen: `allin`'s lifetime living cost rises to meet `never`'s,
 * because being illiquid stops being a way to live cheaply. What must NOT
 * happen: a genuinely destitute character carrying unpayable bills again —
 * that is the defect 0303's cliff exists to prevent, and widening the cliff is
 * how it would come back.
 */
import { describe, expect, it } from 'vitest';
import { MAJORS } from '@yearafter/education';
import { SUBSISTENCE, holdingValue, totalFor, totalOwed } from '@yearafter/finance';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { applyToCollege, cannotEnrol } from './college';
import { applyFor, openings, workHarder } from './careers';
import { applyForNewCard } from './cards';
import { invest } from './investments';

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

type Mode = 'never' | 'balanced' | 'allin' | 'bonds';

function live(seed: string, mode: Mode, major: string) {
  let state = createNewGame({ seed });
  let adultYears = 0;
  let subsistenceYears = 0;
  let shortYears = 0;
  let lifetimeLiving = 0;
  let lifetimeShort = 0;
  let everWorked = false;

  for (let y = 0; y < 120; y += 1) {
    state = advanceYear(state).state;
    if (state.health.diedAtAge !== undefined) break;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const d = state.pending[0];
      const c = d?.choices[0];
      if (!d || !c) break;
      const r = decide(state, d.eventId, c.id);
      if (!r.ok) break;
      state = r.value.state;
    }
    const age = state.player.age;
    if (age < 18) continue;
    adultYears += 1;
    if (state.household.standard <= SUBSISTENCE) subsistenceYears += 1;
    const short = -Number(totalFor(state.finance, 'shortfall', state.world.year)) / 100;
    if (short > 0) {
      shortYears += 1;
      lifetimeShort += short;
    }
    lifetimeLiving += -Number(totalFor(state.finance, 'living', state.world.year)) / 100;
    if (state.employment.job !== undefined) everWorked = true;

    if (state.cards.length === 0) {
      for (const id of ['card.everyday', 'card.starter', 'card.secured']) {
        const c = applyForNewCard(state, id);
        if (c.ok && c.value.good) {
          state = c.value.state;
          break;
        }
      }
    }
    if (!cannotEnrol(state)) {
      const r = applyToCollege(state, major);
      if (r.ok) state = r.value.state;
    }
    if (state.employment.job === undefined) {
      const job = [...openings(state)][0];
      if (job) {
        const r = applyFor(state, String(job.id));
        if (r.ok) state = r.value.state;
      }
    } else {
      const r = workHarder(state);
      if (r.ok) state = r.value.state;
    }

    if (mode === 'never') continue;
    const cash = Math.round(Number(state.player.cash) / 100);
    const keep = mode === 'balanced' ? 40_000 : 0;
    const spare = cash - keep;
    if (spare > 1_000) {
      const into = mode === 'bonds' ? 'inv.govbonds' : 'inv.indexfund';
      const r = invest(state, into, spare);
      if (r.ok) state = r.value.state;
    }
  }

  return {
    adultYears,
    subsistenceYears,
    shortYears,
    lifetimeLiving,
    lifetimeShort,
    everWorked,
    worth:
      Number(state.player.cash) / 100 +
      Number(holdingValue(state.portfolio)) / 100 -
      Number(totalOwed(state.cards)) / 100,
    happiness: state.player.stats.happiness,
  };
}

describe('0308b — the floor and the date', () => {
  it('closes the hardship subsidy without re-opening the unpayable-bill hole', () => {
    const N = 80;
    const modes: Mode[] = ['never', 'balanced', 'allin', 'bonds'];
    const out: Record<string, ReturnType<typeof live>[]> = {};

    for (let i = 0; i < N; i += 1) {
      for (const mode of modes) {
        (out[mode] ??= []).push(live(`hard-${i}`, mode, MAJORS[i % MAJORS.length]!.id));
      }
    }

    console.log(`\nsame ${N} seeds — 13.53 was measured on these exact lives:`);
    console.log(
      '  strategy   subsistence   short yrs   lifetime living   net worth (med)   happiness',
    );
    for (const mode of modes) {
      const rows = out[mode]!;
      const years = rows.reduce((s, r) => s + r.adultYears, 0);
      const sub = rows.reduce((s, r) => s + r.subsistenceYears, 0);
      const shortY = rows.reduce((s, r) => s + r.shortYears, 0);
      console.log(
        `  ${mode.padEnd(9)} ${`${Math.round((sub / years) * 100)}%`.padStart(11)}` +
          `  ${`${Math.round((shortY / years) * 100)}%`.padStart(10)}` +
          `   ${money(
            q(
              rows.map((r) => r.lifetimeLiving),
              0.5,
            ),
          ).padStart(15)}` +
          `   ${money(
            q(
              rows.map((r) => r.worth),
              0.5,
            ),
          ).padStart(15)}` +
          `   ${String(
            Math.round(
              q(
                rows.map((r) => r.happiness),
                0.5,
              ),
            ),
          ).padStart(9)}`,
      );
    }

    const livingOf = (mode: Mode) =>
      q(
        out[mode]!.map((r) => r.lifetimeLiving),
        0.5,
      );
    const gap = livingOf('never') - livingOf('allin');
    console.log(`\n  the 13.53 gap was $430,000. It is now ${money(gap)}.`);

    /*
      THE ASSERTION IS THE TICKET, AND IT IS TWO-SIDED.

      Emptying your current account into a fund must not buy a cheaper life —
      that was the $430,000 subsidy. It came out NEGATIVE once the standard of
      living started tracking net worth instead of the bank balance, which is
      correct: a millionaire lives like a millionaire wherever they keep it, so
      the all-in player now spends MORE. Both directions are bounded, because a
      large swing either way would mean the standard is being driven by where
      money sits rather than by how much of it there is.
    */
    expect(Math.abs(gap)).toBeLessThan(250_000);
    expect(gap).toBeLessThan(150_000);

    /*
      AND THE GUARD THAT MATTERS MORE. 0303's cliff exists because the first
      version of the living phase left a jobless character carrying unpayable
      bills in 5,789 of 5,789 adult years. Counting the portfolio widens who is
      charged in full, so the thing to prove is that somebody with NOTHING is
      still caught by the cliff rather than billed forever.
    */
    const destitute = out.never!.filter((r) => !r.everWorked);
    for (const row of destitute) {
      expect(row.shortYears / Math.max(1, row.adultYears)).toBeLessThan(0.5);
    }
    console.log(`  (${destitute.length} lives never worked at all, and none is billed forever)`);
  });
});
