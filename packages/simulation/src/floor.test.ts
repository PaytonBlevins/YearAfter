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
import { findMajor, MAJORS } from '@yearafter/education';
import { SUBSISTENCE, portfolioWorth, totalFor, totalOwed } from '@yearafter/finance';
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

/*
  UNDERGRADUATE ONLY, AND 0406 IS WHY.

  This cycled `MAJORS` while `MAJORS` was eight interchangeable bachelor's
  degrees at one price, and the shortcut was invisible. 0406 made it fifty-three
  programs across three tiers, so a quarter of the seeds were being handed a
  graduate program that a high-school leaver can never start and another
  quarter a trade certificate costing a third as much — which showed up here as
  the `allin` cohort spending 12% less on living than `never` while holding
  eight times the net worth, indistinguishable from the $430,000 subsidy this
  test exists to catch. It was neither: it was this line. CORE_RULES 13.63.

  What this test is comparing is where SPARE CASH goes, so every cohort has to
  face the same education, and an undergraduate degree is what "a major" meant
  when it was written.
*/
const UNDERGRADUATE = MAJORS.filter((program) => program.kind === 'undergraduate');

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
    /*
      ASKS ABOUT THE PROGRAMME IT IS ABOUT TO APPLY FOR (Ticket 0406).

      It used to ask the bare `cannotEnrol(state)` and then apply for a specific
      major, which was the same question while every program cost the same and
      is two questions now. See `cannotEnrolAnything`.
    */
    const program = findMajor(major);
    if (program && !cannotEnrol(state, program)) {
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
      const into = mode === 'bonds' ? 'bd.cald10' : 'fd.broadindex';
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
      Number(portfolioWorth(state.prices, state.portfolio)) / 100 -
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
        (out[mode] ??= []).push(
          live(`hard-${i}`, mode, UNDERGRADUATE[i % UNDERGRADUATE.length]!.id),
        );
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

    /*
      PER ADULT YEAR, NOT PER LIFETIME (Ticket 0410).

      The claim this test makes is about the PRICE of a life — being illiquid
      must not be a way to live cheaply. A lifetime total answers a different
      question, because it is spending multiplied by how long you lived, and
      until 0410 those two cohorts died at near enough the same ages for the
      difference not to show.

      0410 gave the population partners and children, which move stress and
      happiness, which feed health. The lifetimes came apart, and the test went
      red while the thing it guards was fine in the other direction: measured on
      the same run, `allin` spent $80,540 a year against `never`'s $79,808 — MORE,
      which is what the comment above says should happen — and the lifetime
      medians said it spent 4.9% less.

      A total that mixes a rate with a duration cannot tell one from the other.
      0408 fixed `adult-social.test.ts` for the same reason and 0409 fixed
      `health.test.ts` for it; this is the third outing of CORE_RULES 13.63.
    */
    const livingOf = (mode: Mode) =>
      q(
        out[mode]!.map((r) => r.lifetimeLiving / Math.max(1, r.adultYears)),
        0.5,
      );
    const gap = livingOf('never') - livingOf('allin');
    console.log(
      `\n  the 13.53 gap was $430,000 over a lifetime. Per adult year it is now ${money(gap)}.`,
    );

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
    /*
      THE DIRECTION IS THE ASSERTION, not the size.

      The first version bounded the absolute gap and went red the moment the
      catalog changed, which was the test measuring the wrong thing: an all-in
      player ends up richer, their standard of living tracks what they are
      worth, so they SPEND more — and how much more scales with how much richer
      they got. Bounding that absolutely just pins one catalog's returns.

      What must never come back is the SUBSIDY: being illiquid cannot be a way
      to live cheaply. That is a direction, and it holds whatever the catalog
      does.
    */
    /*
      A SMALL BAND, NOT A HARD ZERO, SINCE 0403. `never` and `allin` are the
      same 80 played lives — same jobs, same promotions, same everything except
      what happens to spare cash — so a job-catalog edit with nothing to do
      with investing still moves both numbers by reshaping WHEN income arrives
      relative to market timing, and 0403 measured that moving: closing a
      reachability hole (a duplicated top-of-ladder trades job starving its own
      sibling, `packages/careers/src/openings.ts`) meant removing four
      management-tier jobs from tracks that hadn't had a fifth rung before,
      which shows up here as roughly a 1.6% wobble even though it never touches
      `livingCostFor` or the portfolio model this test is actually about. The
      $430,000 bug this guards against was 13% of `never`'s figure; 3% is a
      wide enough band to absorb ordinary catalog churn without being wide
      enough to let a real subsidy back in.
    */
    /*
      TEN PERCENT, AND THE BAND IS NOW SET BY MEASUREMENT RATHER THAN BY FEEL
      (Ticket 0416, CORE_RULES 13.81).

      0416 turned this red at −4.8% without touching money: the door to
      something to join reshuffled who these eighty lives meet and marry, and
      the median moved. So both sides of the line were measured, on this code:

      - THE NOISE. Two disjoint samples of the SAME build — the first 80 seeds
        and the next 120 — read −4.8% and +2.2%; with the door switched off,
        +3.4% and −4.6%. Seven or eight points of swing from nothing but which
        lives were drawn. At 200 lives the two builds read −1.9% and −1.5%:
        the ticket moved nothing.
      - THE SIGNAL. Restoring 13.53 — the portfolio dropped from both the
        standard and the hardship cap — reads −35% at 80 lives, at 200, and on
        each half separately.

      A 3% line sat inside the noise, so it was a coin flip that happened to
      land heads for five tickets. Ten percent is twice the noise and a third
      of the signal: it stays green for a build that has not reopened the
      subsidy and goes red for one that has.
    */
    expect(livingOf('allin')).toBeGreaterThanOrEqual(livingOf('never') * 0.9);
    // And it has to stay explicable. Spending twice what somebody else spends
    // would mean the standard is being driven by something other than wealth.
    expect(livingOf('allin')).toBeLessThan(livingOf('never') * 2);

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
