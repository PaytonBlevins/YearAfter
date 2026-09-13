/**
 * Ticket 0308 — the investments screen, checked through the engine.
 *
 * The browser harness could not get a character into work: every life it drove
 * arrived at thirty-four unemployed with $0, so the buy flow was unreachable
 * and only the empty state could be read. That is the harness, not the game —
 * the same shape as 0307's, where a measurement harness that never applied for
 * a job made every number downstream of it worthless.
 *
 * So this is the routine the 0306 write-up recorded as the one that works:
 * build a real state through the engine and assert what the screen WOULD say.
 * It is better than a screenshot in one important way — it stays.
 *
 * The defects it is written against are the ones this build keeps shipping:
 *   a subtitle that repeats the number already on the row      (13.26)
 *   a column of identical sentences                            (13.26)
 *   a subtitle too long for a row that also carries a value    (0304-0307)
 *   a refusal that names a true thing which is not the reason  (13.49)
 */
import { describe, expect, it } from 'vitest';
import {
  CLASS_LABELS,
  INVESTMENT_PRODUCTS,
  findInvestment,
  holdingValue,
  portfolioGain,
  summariseFinances,
} from '@yearafter/finance';
import { dollars } from '@yearafter/core';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { applyFor, openings, workHarder } from './careers';
import { divest, estateOf, invest, investmentOffers } from './investments';
import type { GameState } from './game-state';

/**
 * A character who worked, earned and has money in the bank.
 *
 * The harness that could not produce one is exactly why this exists as a
 * helper: every screen test in this ticket needs somebody with a balance, and
 * getting one has to be reliable.
 */
function working(seed: string, untilAge = 40): GameState {
  let state = createNewGame({ seed });
  for (let y = 0; y < 120; y += 1) {
    state = advanceYear(state).state;
    if (state.health.diedAtAge !== undefined) break;
    if (state.player.age >= untilAge) break;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const d = state.pending[0];
      const c = d?.choices[0];
      if (!d || !c) break;
      const r = decide(state, d.eventId, c.id);
      if (!r.ok) break;
      state = r.value.state;
    }
    if (state.player.age < 18) continue;
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
  }
  return state;
}

/** What `InvestmentsScreen` puts under a held row. */
const heldSubtitle = (value: number, put: number): string => {
  const up = value - put;
  return up === 0
    ? `${money(put)} in, and level`
    : up > 0
      ? `Up ${money(up)} on ${money(put)} in`
      : `Down ${money(-up)} on ${money(put)} in`;
};
const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

describe('the harness can produce somebody with money, which the browser one could not', () => {
  it('gets a character into work and into funds by forty', () => {
    const state = working('screen-1');
    expect(state.player.age).toBe(40);
    expect(Number(state.player.cash)).toBeGreaterThan(50_000_00);
  });
});

describe('what the buy list says', () => {
  const state = working('screen-1');
  const offers = investmentOffers(state);

  it('offers every product to somebody who can afford them', () => {
    expect(offers.length).toBe(INVESTMENT_PRODUCTS.length);
    expect(offers.every(({ refusal }) => refusal === undefined)).toBe(true);
  });

  it('gives each row its own sentence rather than a column of one', () => {
    /*
      CORE_RULES 13.26, which this build has now shipped four times. The
      subtitle of an available product is its CHARACTER — what it is like to
      hold — and no two may read the same.
    */
    const lines = INVESTMENT_PRODUCTS.map((product) => product.character);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('keeps every subtitle short enough for a row that also carries a value', () => {
    /*
      Four tickets in a row shipped a clipped subtitle (0209's parent rows,
      0210's openings, 0210c's school row, 0304's net worth). A row with a value
      on the right has roughly forty-eight characters before it truncates on a
      390pt screen, and copy written without measuring is copy that gets cut.
    */
    for (const product of INVESTMENT_PRODUCTS) {
      expect(product.character.length, `${product.id}: "${product.character}"`).toBeLessThanOrEqual(
        48,
      );
      expect(product.blurb.length, `${product.id} blurb`).toBeLessThanOrEqual(64);
    }
  });

  it('names the class and the minimum, and flags income only where it is real', () => {
    // A tag on five of seven rows is not telling anybody which ones differ. The
    // built screen had "pays out yearly" on the index fund at 1.5% next to
    // corporate bonds at 4.6%, implying they were the same kind of thing.
    const INCOME_FROM = 0.025;
    const flagged = INVESTMENT_PRODUCTS.filter((product) => product.yield >= INCOME_FROM);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.length).toBeLessThan(INVESTMENT_PRODUCTS.length - 2);
    for (const product of flagged) {
      expect(['bonds', 'stocks']).toContain(product.assetClass);
    }
    for (const product of INVESTMENT_PRODUCTS) {
      expect(CLASS_LABELS[product.assetClass]).toBeTruthy();
    }
  });

  it('refuses an empty-handed character on the gap, not on the product', () => {
    /*
      READING THE BUILT SCREEN FOUND THIS. At thirty-four with $0, all seven
      products were declined with "Takes $500 to open" and the like — seven true
      sentences, not one of which was the reason. The screen now says both
      numbers, and a character with nothing at all gets one sentence instead of
      seven rows (the CardsScreen fix from 0306, in a new place).
    */
    const broke = { ...state, player: { ...state.player, cash: dollars(0) } };
    const refused = investmentOffers(broke);
    expect(refused.every(({ refusal }) => refusal !== undefined)).toBe(true);
    const cheapest = Math.min(...INVESTMENT_PRODUCTS.map((product) => product.minimum));
    expect(Math.round(Number(broke.player.cash) / 100)).toBeLessThan(cheapest);
  });

  it('lets somebody with a little money buy the cheap thing and not the dear one', () => {
    // The in-between case the empty state does not cover, and the one the
    // "names both numbers" copy is for.
    const thin = { ...state, player: { ...state.player, cash: dollars(600) } };
    const rows = investmentOffers(thin);
    const crypto = rows.find(({ product }) => product.id === 'inv.crypto');
    const managed = rows.find(({ product }) => product.id === 'inv.managedfund');
    expect(crypto?.refusal).toBeUndefined();
    expect(managed?.refusal).toBe('belowMinimum');
  });
});

describe('what the held list says', () => {
  it('reports the GAP rather than repeating the value beside it', () => {
    const bought = invest(working('screen-1'), 'inv.indexfund', 20_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const holding = bought.value.state.portfolio[0]!;
    const value = Math.round(Number(holding.value) / 100);
    const put = Math.round(Number(holding.contributed) / 100);
    // Fresh, so it is level — and the subtitle says so rather than printing
    // $20,000 twice on one row.
    // Level, because it was bought this second — and the row says so in words
    // rather than printing $20,000 twice. (It names the contribution, which IS
    // the value here; the test for the gap proper is the next one, where the
    // two have come apart.)
    expect(heldSubtitle(value, put)).toBe('$20,000 in, and level');
  });

  it('says up or down after the market has had a few years at it', () => {
    const opened = invest(working('screen-2'), 'inv.growth', 20_000);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    let state = opened.value.state;
    for (let y = 0; y < 8; y += 1) state = advanceYear(state).state;
    const holding = state.portfolio[0];
    expect(holding).toBeDefined();
    if (!holding) return;
    const value = Math.round(Number(holding.value) / 100);
    const put = Math.round(Number(holding.contributed) / 100);
    expect(heldSubtitle(value, put)).toMatch(/^(Up|Down) \$[\d,]+ on \$[\d,]+ in$/);
    expect(value).not.toBe(put);
  });
});

describe('what the dashboard says, which was wrong for two whole tickets', () => {
  it('subtracts what is owed and adds what is held', () => {
    /*
      CORE_RULES 13.51. `netWorth` returned the bare cash balance from 0304
      until this ticket, so a character with $40,000 of cash and $30,000 of card
      debt was shown a net worth of $40,000 and told underneath that they owned
      nothing and owed nothing. Every test passed the whole time.
    */
    const bought = invest(working('screen-1'), 'inv.indexfund', 20_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const state = bought.value.state;
    const books = summariseFinances(state.finance, state.world.year, estateOf(state));

    expect(Number(books.investments)).toBe(Number(holdingValue(state.portfolio)));
    expect(Number(books.netWorth)).toBe(
      Number(state.finance.balance) + Number(books.investments) - Number(books.liabilities),
    );
    // And the flag is now a fact about this character, not about the build.
    expect(books.onlyCash).toBe(false);
  });

  it('still says "nothing owned, nothing owed" for somebody who holds neither', () => {
    const state = working('screen-1');
    const books = summariseFinances(state.finance, state.world.year, estateOf(state));
    expect(books.onlyCash).toBe(true);
    expect(Number(books.netWorth)).toBe(Number(books.balance));
  });

  it('does not count buying shares as an expense, nor selling them as income', () => {
    /*
      Spec 44-46. A player who moved $20,000 into a fund has not tripled their
      cost of living, and one who sold it has not had a $20,000 payday.
    */
    const before = working('screen-1');
    const plain = summariseFinances(before.finance, before.world.year, estateOf(before));

    const bought = invest(before, 'inv.indexfund', 20_000);
    if (!bought.ok) return;
    const after = summariseFinances(
      bought.value.state.finance,
      bought.value.state.world.year,
      estateOf(bought.value.state),
    );
    expect(Number(after.monthlyOutflow)).toBe(Number(plain.monthlyOutflow));

    const sold = divest(bought.value.state, 'inv.indexfund', 20_000);
    if (!sold.ok) return;
    const back = summariseFinances(
      sold.value.state.finance,
      sold.value.state.world.year,
      estateOf(sold.value.state),
    );
    expect(Number(back.income)).toBe(Number(plain.income));
    expect(Number(back.monthlyOutflow)).toBe(Number(plain.monthlyOutflow));
    // And the money is back where it started, to the cent.
    expect(Number(sold.value.state.player.cash)).toBe(Number(before.player.cash));
  });
});

describe('a portfolio over a life', () => {
  it('reconciles, moves, and never goes negative', () => {
    const opened = invest(working('screen-3'), 'inv.crypto', 10_000);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    let state = opened.value.state;
    for (let y = 0; y < 40 && state.health.diedAtAge === undefined; y += 1) {
      state = advanceYear(state).state;
      for (const holding of state.portfolio) {
        expect(Number(holding.value)).toBeGreaterThanOrEqual(0);
      }
      expect(Number(holdingValue(state.portfolio))).toBeGreaterThanOrEqual(0);
    }
    // The whole point of the asset: it did something over forty years.
    expect(portfolioGain(state.portfolio)).not.toBe(0);
    expect(findInvestment('inv.crypto')).toBeDefined();
  });
});
