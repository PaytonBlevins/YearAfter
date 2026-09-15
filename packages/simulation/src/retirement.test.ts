/**
 * Ticket 0310 — retirement, through the engine.
 *
 * The claims worth testing are not "a balance goes up". They are the ones that
 * would quietly stop being true:
 *
 *   the employer match is real and capped where it says it is
 *   the account moves with the market, including downward
 *   stopping ends the job, and is one-way
 *   every job template has a benefit row, forever
 *   the balance reaches net worth and never gets its own line
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { ALL_JOBS, findJob, type JobTemplate } from '@yearafter/careers';
import {
  BENEFIT_BY_TEMPLATE,
  EARLIEST_RETIREMENT,
  MOST_OF_PAY,
  STATE_PENSION,
  STATE_PENSION_AT,
  UNLOCKS_AT,
  benefitFor,
  contributeYear,
  drawYear,
  growYear,
  openingPrices,
  retire,
  runPriceYear,
  serveYear,
  summariseFinances,
  withdrawEarly,
  NO_RETIREMENT,
  SECTORS,
  INSTRUMENTS,
} from '@yearafter/finance';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { applyFor, openings, workHarder } from './careers';
import {
  contributionPreview,
  estateOf,
  retireNow,
  retirementRefusal,
  setContribution,
  takeOutEarly,
} from './investments';
import type { GameState } from './game-state';

/** A character who worked, earned, and is old enough to have choices. */
function working(seed: string, untilAge = 58): GameState {
  let state = createNewGame({ seed });
  for (let step = 0; step < 140; step += 1) {
    state = advanceYear(state).state;
    if (state.health.diedAtAge !== undefined) break;
    if (state.player.age >= untilAge) break;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const result = decide(state, decision.eventId, choice.id);
      if (!result.ok) break;
      state = result.value.state;
    }
    if (state.player.age < 18) continue;
    if (state.employment.job === undefined) {
      const job = [...openings(state)][0];
      if (job) {
        const applied = applyFor(state, String(job.id));
        if (applied.ok) state = applied.value.state;
      }
    } else {
      const pushed = workHarder(state);
      if (pushed.ok) state = pushed.value.state;
    }
  }
  return state;
}

describe('the benefits a job comes with', () => {
  it('has a row for every template the catalog actually uses', () => {
    /*
      THE DERIVED GUARD FOR A RESTATED LIST.

      `BENEFIT_BY_TEMPLATE` is keyed by a union written out by hand in
      `@yearafter/finance`, because that package does not depend on
      `@yearafter/careers` and should not start. A copied list is exactly what
      went wrong with `UNWRITTEN_CATEGORIES` in 0309 — it drifted for two
      milestones while a test asserted it EQUALLED the stale version.

      So this asks the catalog rather than a remembered answer: every template
      any real job uses must have a benefit, and every benefit must be for a
      template that exists.
    */
    const used = new Set<JobTemplate>(ALL_JOBS.map((job) => job.template));
    expect(used.size).toBeGreaterThan(3);
    for (const template of used) {
      expect(benefitFor(template), `${template} has no benefit row`).toBeDefined();
    }
    for (const named of Object.keys(BENEFIT_BY_TEMPLATE)) {
      expect(used.has(named as JobTemplate), `${named} is a benefit for no job`).toBe(true);
    }
  });

  it('gives a match to the templates whose copy has promised one since 0210', () => {
    // `BENEFITS` in careers says "Retirement match" for salary and professional
    // and "Pension, and it is a real one" for government. Those were display
    // strings with nothing behind them for two milestones.
    expect(BENEFIT_BY_TEMPLATE.salary.match).toBeGreaterThan(0);
    expect(BENEFIT_BY_TEMPLATE.professional.match).toBeGreaterThan(0);
    expect(BENEFIT_BY_TEMPLATE.government.pensionPerYear).toBeGreaterThan(0);
    // And a job whose copy promises neither must not quietly get one.
    expect(BENEFIT_BY_TEMPLATE.performance.match).toBe(0);
    expect(BENEFIT_BY_TEMPLATE.trade.match).toBe(0);
  });
});

describe('paying in', () => {
  const salaried = BENEFIT_BY_TEMPLATE.salary;

  it('matches what it says and stops where it says', () => {
    const at6 = contributeYear({ ...NO_RETIREMENT, rate: 0.06 }, salaried, 100_000);
    expect(at6.own).toBe(6_000);
    expect(at6.matched).toBe(3_000);

    /*
      PUTTING IN MORE DOES NOT BUY MORE MATCH. The employer matches half of the
      first 6% of PAY, so a 15% contribution still gets $3,000 — and a player
      who learned that from a balance rather than from the screen would have
      been misled, which is why the screen says it.
    */
    const at15 = contributeYear({ ...NO_RETIREMENT, rate: 0.15 }, salaried, 100_000);
    expect(at15.own).toBe(15_000);
    expect(at15.matched).toBe(3_000);
  });

  it('adds nothing for a job that promises nothing', () => {
    const year = contributeYear(
      { ...NO_RETIREMENT, rate: 0.1 },
      BENEFIT_BY_TEMPLATE.performance,
      100_000,
    );
    expect(year.own).toBe(10_000);
    expect(year.matched).toBe(0);
  });

  it('never lets anybody put in more than the cap', () => {
    const silly = contributeYear({ ...NO_RETIREMENT, rate: 5 }, salaried, 100_000);
    expect(silly.own).toBe(Math.round(100_000 * MOST_OF_PAY));
  });

  it('stops entirely once somebody has retired', () => {
    const after = contributeYear(
      { ...NO_RETIREMENT, rate: 0.1, retiredAtAge: 62 },
      salaried,
      100_000,
    );
    expect(after.own).toBe(0);
    expect(after.matched).toBe(0);
  });

  it('counts pensionable service only where there is a pension', () => {
    const gov = serveYear(NO_RETIREMENT, BENEFIT_BY_TEMPLATE.government, 80_000);
    expect(gov.serviceYears).toBe(1);
    expect(Number(gov.finalPensionablePay)).toBe(80_000 * 100);

    const notGov = serveYear(NO_RETIREMENT, BENEFIT_BY_TEMPLATE.salary, 80_000);
    expect(notGov.serviceYears).toBe(0);
  });

  it('keeps the BEST pensionable pay, not the last', () => {
    // Somebody who steps down to an easier government job at sixty must not
    // lose the pension they spent thirty years earning.
    let state = serveYear(NO_RETIREMENT, BENEFIT_BY_TEMPLATE.government, 120_000);
    state = serveYear(state, BENEFIT_BY_TEMPLATE.government, 60_000);
    expect(Number(state.finalPensionablePay)).toBe(120_000 * 100);
    expect(state.serviceYears).toBe(2);
  });
});

describe('the account in the market', () => {
  it('moves with prices, and can fall', () => {
    let prices = openingPrices();
    const roll = (seed: number) => {
      let x = seed >>> 0;
      return () => {
        x = (x * 1664525 + 1013904223) >>> 0;
        return x / 4294967296;
      };
    };
    const r = roll(7);
    // A crash year, so the balance has somewhere to go but up.
    prices = runPriceYear(
      prices,
      'severeRecession',
      SECTORS.map(() => r()),
      INSTRUMENTS.map(() => r()),
    ).prices;

    const before = { ...NO_RETIREMENT, balance: dollars(100_000) };
    const after = growYear(before, prices);
    expect(Number(after.balance)).not.toBe(Number(before.balance));
    expect(Number(after.balance)).toBeLessThan(Number(before.balance));
  });

  it('leaves an empty account alone', () => {
    expect(growYear(NO_RETIREMENT, openingPrices())).toEqual(NO_RETIREMENT);
  });
});

describe('stopping', () => {
  it('refuses anybody too young, and names the age', () => {
    const young = createNewGame({ seed: 'ret-young' });
    expect(retirementRefusal(young)).toBe('stillTooYoung');
    expect(EARLIEST_RETIREMENT).toBeGreaterThan(40);
  });

  it('ends the job and is one-way', () => {
    const state = working('ret-stop', 58);
    if (state.health.diedAtAge !== undefined) return;
    expect(state.player.age).toBeGreaterThanOrEqual(EARLIEST_RETIREMENT);

    const done = retireNow(state);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    const after = done.value.state;
    expect(after.retirement.retiredAtAge).toBe(state.player.age);
    // The job goes with it — that is the whole point of the verb.
    expect(after.employment.job).toBeUndefined();
    // And it cannot be done twice.
    expect(retireNow(after).ok).toBe(false);
    expect(retirementRefusal(after)).toBe('alreadyRetired');
  });

  it('says what they actually have rather than just congratulating them', () => {
    const state = working('ret-body', 58);
    if (state.health.diedAtAge !== undefined) return;
    const done = retireNow(state);
    if (!done.ok) return;
    // "You retired" is the decoration this build keeps removing.
    expect(done.value.body.length).toBeGreaterThan(30);
    expect(done.value.body).toMatch(/working years/);
  });
});

describe('living on it', () => {
  it('pays a pension, the state pension and a draw once retired', () => {
    const state = {
      ...NO_RETIREMENT,
      balance: dollars(400_000),
      serviceYears: 30,
      finalPensionablePay: dollars(90_000),
      retiredAtAge: 66,
    };
    const year = drawYear(state, STATE_PENSION_AT, BENEFIT_BY_TEMPLATE.government);
    expect(year.pension).toBe(Math.round(90_000 * 0.016 * 30));
    expect(year.state).toBe(STATE_PENSION);
    expect(year.drawn).toBeGreaterThan(0);
    // And the balance goes down by exactly what was drawn.
    expect(Number(state.balance) - Number(year.after.balance)).toBe(year.drawn * 100);
  });

  it('pays nothing at all to somebody still working', () => {
    const year = drawYear({ ...NO_RETIREMENT, balance: dollars(400_000) }, 70, undefined);
    expect(year.pension).toBe(0);
    expect(year.state).toBe(0);
    expect(year.drawn).toBe(0);
  });

  it('holds the state pension back until the age', () => {
    const retired = { ...NO_RETIREMENT, retiredAtAge: 56 };
    expect(drawYear(retired, STATE_PENSION_AT - 1, undefined).state).toBe(0);
    expect(drawYear(retired, STATE_PENSION_AT, undefined).state).toBe(STATE_PENSION);
  });

  it('empties a small account in one go rather than dribbling it out forever', () => {
    // Eleven dollars a year is not income, it is a row on a screen.
    const small = { ...NO_RETIREMENT, balance: dollars(300), retiredAtAge: 70 };
    const year = drawYear(small, 70, undefined);
    expect(year.drawn).toBe(300);
    expect(Number(year.after.balance)).toBe(0);
  });
});

describe('taking it out early', () => {
  it('charges before the date and does not after it', () => {
    const pot = { ...NO_RETIREMENT, balance: dollars(50_000) };
    const early = withdrawEarly(pot, UNLOCKS_AT - 1, 10_000);
    expect(early.penalty).toBe(2_000);
    expect(early.taken).toBe(8_000);

    const later = withdrawEarly(pot, UNLOCKS_AT, 10_000);
    expect(later.penalty).toBe(0);
    expect(later.taken).toBe(10_000);
  });

  it('never hands out more than is in there', () => {
    const pot = { ...NO_RETIREMENT, balance: dollars(1_000) };
    const out = withdrawEarly(pot, UNLOCKS_AT, 999_999);
    expect(out.taken).toBe(1_000);
    expect(Number(out.after.balance)).toBe(0);
  });

  it('moves the money and writes it down', () => {
    let state = working('ret-take', 58);
    if (state.health.diedAtAge !== undefined) return;
    state = { ...state, retirement: { ...state.retirement, balance: dollars(40_000) } };
    const before = Number(state.player.cash);
    const rows = state.finance.transactions.length;

    const done = takeOutEarly(state, 10_000);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(Number(done.value.state.player.cash)).toBeGreaterThan(before);
    expect(done.value.state.finance.transactions.length).toBeGreaterThan(rows);
  });
});

describe('what it is worth', () => {
  it('rolls into net worth and never gets its own line', () => {
    /*
      Spec 163: "Do not separately show Annual Net Income or Retirement Assets.
      Retirement balances roll into Assets." So the ONLY thing that should
      change on a dashboard when somebody has $400,000 in a pension is the net
      worth, through the one derivation everything else already uses (13.23).
    */
    const state = working('ret-worth', 45);
    if (state.health.diedAtAge !== undefined) return;
    const bare = estateOf(state);
    const withPot = estateOf({
      ...state,
      retirement: { ...state.retirement, balance: dollars(400_000) },
    });
    expect(Number(withPot.investments) - Number(bare.investments)).toBe(400_000 * 100);
    // Liabilities are untouched — a pension is not a debt.
    expect(Number(withPot.liabilities)).toBe(Number(bare.liabilities));

    const books = summariseFinances(state.finance, state.world.year, withPot);
    expect(Number(books.netWorth)).toBeGreaterThan(400_000 * 100 - 1);
  });
});

describe('a year with an account in it', () => {
  it('takes the contribution out of the bank and puts it in the pot', () => {
    let state = working('ret-year', 40);
    if (state.health.diedAtAge !== undefined || !state.employment.job) return;
    state = setContribution(state, 0.06);

    const preview = contributionPreview(state);
    if (preview.own <= 0) return;

    const potBefore = Number(state.retirement.balance);
    const after = advanceYear(state).state;

    expect(Number(after.retirement.balance)).toBeGreaterThan(potBefore);
    // And the ledger says where it went, with a source that names it (13.6).
    expect(
      after.finance.transactions.some((row) => row.source.startsWith('Retirement')),
      'nothing in the ledger mentions retirement',
    ).toBe(true);
  });

  it('puts nothing in for a character who has not asked it to', () => {
    const state = working('ret-none', 40);
    if (state.health.diedAtAge !== undefined) return;
    expect(state.retirement.rate).toBe(0);
    const after = advanceYear(state).state;
    expect(Number(after.retirement.balance)).toBe(0);
  });

  it('knows what a job would put in before a year runs', () => {
    let state = working('ret-preview', 40);
    if (state.health.diedAtAge !== undefined || !state.employment.job) return;
    state = setContribution(state, 0.06);
    const preview = contributionPreview(state);
    const job = findJob(state.employment.job.jobId);
    const benefit = job ? benefitFor(job.template) : undefined;
    if (!benefit || benefit.match <= 0) return;
    expect(preview.own).toBeGreaterThan(0);
    expect(preview.matched).toBeGreaterThan(0);
    expect(preview.matched).toBeLessThanOrEqual(preview.own);
  });
});

describe('the rules the retirement state has to keep', () => {
  it('starts every new character with nothing and no instruction', () => {
    const fresh = createNewGame({ seed: 'ret-fresh' });
    expect(Number(fresh.retirement.balance)).toBe(0);
    expect(fresh.retirement.rate).toBe(0);
    expect(fresh.retirement.serviceYears).toBe(0);
    expect(fresh.retirement.retiredAtAge).toBeUndefined();
  });

  it('clamps a nonsense contribution rate rather than trusting the caller', () => {
    const fresh = createNewGame({ seed: 'ret-clamp' });
    expect(setContribution(fresh, -1).retirement.rate).toBe(0);
    expect(setContribution(fresh, 99).retirement.rate).toBe(MOST_OF_PAY);
  });

  it('keeps retire(), the pure one, out of the business of ending jobs', () => {
    // `retire` in finance only marks the state; ending the job is the
    // simulation's call, because finance has never heard of a job.
    const marked = retire(NO_RETIREMENT, 61);
    expect(marked.retiredAtAge).toBe(61);
    expect(Object.keys(marked).sort()).toEqual(
      [...Object.keys(NO_RETIREMENT), 'retiredAtAge'].sort(),
    );
  });
});
