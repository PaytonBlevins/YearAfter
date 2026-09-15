/**
 * Ticket 0308c — the investment screens, checked through the engine.
 *
 * The browser harness could not get a character into work: every life it drove
 * arrived at thirty-four unemployed with $0, so the buy flow was unreachable
 * and only the empty state could be read. That is the harness, not the game.
 *
 * So this is the routine the 0306 write-up recorded as the one that works:
 * build a real state through the engine and assert what the screen WOULD say.
 * It is better than a screenshot in one way that matters — it stays.
 *
 * The defects it is written against are the ones this build keeps shipping:
 *   a subtitle that repeats the number already on the row      (13.26)
 *   a column of identical sentences                            (13.26)
 *   a subtitle too long for a row that also carries a value    (0304-0307)
 *   a refusal that names a true thing which is not the reason  (13.49)
 *   a reference to an id that does not exist                   (0308c's own)
 */
import { describe, expect, it } from 'vitest';
import {
  ADVISORS,
  INSTRUMENTS,
  KIND_LABELS,
  UNWRITTEN_CATEGORIES,
  SECTORS,
  findInstrument,
  portfolioWorth,
  priceOf,
  summariseFinances,
} from '@yearafter/finance';
import { dollars } from '@yearafter/core';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { applyFor, openings, workHarder } from './careers';
import {
  actOnAdvice,
  adviceFor,
  dismissAdvisor,
  divest,
  estateOf,
  feeThisYear,
  hireAdvisor,
  holdingsOf,
  invest,
  marketFor,
  previewBuy,
  previewSell,
} from './investments';
import type { GameState } from './game-state';

/** A character who worked, earned, and has money in the bank. */
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

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

describe('the catalog', () => {
  it('has every tier the hub screen offers, and nothing empty', () => {
    for (const kind of ['stock', 'penny', 'crypto', 'fund', 'bond'] as const) {
      const rows = INSTRUMENTS.filter((row) => row.kind === kind);
      expect(rows.length, kind).toBeGreaterThan(5);
      expect(KIND_LABELS[kind]).toBeTruthy();
    }
  });

  it('gives every sector enough names that spreading inside one is possible', () => {
    for (const sector of SECTORS) {
      const rows = INSTRUMENTS.filter((row) => row.sector === sector);
      expect(rows.length, sector).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps every blurb short enough for a row that also carries a price', () => {
    /*
      Five tickets in a row nearly shipped a clipped subtitle. A row with a
      value on the right has roughly 48 characters before it truncates on a
      390pt screen; a detail sheet has more room, which is where the blurb
      lands, so 64 is the bound the generator enforces and this re-checks
      against the rendered catalog rather than the generator source.
    */
    for (const instrument of INSTRUMENTS) {
      expect(
        instrument.blurb.length,
        `${instrument.id}: "${instrument.blurb}"`,
      ).toBeLessThanOrEqual(64);
    }
  });

  it('gives no two instruments the same blurb', () => {
    // CORE_RULES 13.26. Eighty-nine rows is exactly where a writer starts
    // reaching for a template, and a template is a column of one sentence.
    const lines = INSTRUMENTS.map((row) => row.blurb);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('opens at a price a young character can actually reach', () => {
    // 0308 measured cash at twenty as $13,180 median. A catalog whose cheapest
    // unit costs more than that opens above the ground (CORE_RULES 13.16).
    const cheapest = Math.min(...INSTRUMENTS.map((row) => row.priceCents));
    expect(cheapest).toBeLessThan(5_000);
  });
});

describe('what the market list says', () => {
  const state = working('mkt-1');

  it('prices every row and attaches what the player already holds', () => {
    /*
      HOLDING IS SHOWN WHILE BROWSING, which the reference app does not do: its
      market list says what everything costs and never what you already own, so
      the one number you need in order to decide is on another screen.
    */
    const rows = marketFor(state, 'stock');
    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      expect(row.price).toBeGreaterThan(0);
      expect(row.held).toBe(0);
    }

    const bought = invest(state, 'eq.northline', 20_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const after = marketFor(bought.value.state, 'stock');
    const held = after.find((row) => row.instrument.id === 'eq.northline');
    expect(held?.held).toBeGreaterThan(0);
  });

  it('offers everything to somebody with money, and nothing to somebody without', () => {
    const rows = marketFor(state, 'stock');
    expect(rows.every((row) => row.refusal === undefined)).toBe(true);

    const broke = { ...state, player: { ...state.player, cash: dollars(0) } };
    expect(marketFor(broke, 'stock').every((row) => row.refusal !== undefined)).toBe(true);
  });

  it('lets a thin wallet reach the cheap tier and not the dear one', () => {
    // The in-between case: $40 buys penny stocks and cannot open a $1,000 bond.
    const thin = { ...state, player: { ...state.player, cash: dollars(40) } };
    expect(marketFor(thin, 'penny').some((row) => row.refusal === undefined)).toBe(true);
    expect(marketFor(thin, 'bond').every((row) => row.refusal !== undefined)).toBe(true);
  });
});

describe('buying and selling in units', () => {
  it('buys units at the price and spends only what they cost', () => {
    const state = working('mkt-1');
    const price = priceOf(state.prices, 'eq.northline');
    const before = Number(state.player.cash);

    const bought = invest(state, 'eq.northline', 10_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const holding = bought.value.state.portfolio[0]!;

    expect(holding.instrumentId).toBe('eq.northline');
    expect(holding.units).toBeCloseTo((10_000 * 100) / price, 2);
    // Cash out matches what the units cost, to the dollar.
    const spent = (before - Number(bought.value.state.player.cash)) / 100;
    expect(spent).toBeCloseTo((holding.units * price) / 100, 0);
  });

  it('buys whole bonds only, and does not keep the change', () => {
    /*
      A bond is whole units, so money left over stays in the account. This is
      the card row that said "some" and spent everything, in a new place.

      NOT ASSUMING PAR. The first version of this test expected four bonds for
      $4,500 and got five, because a bond's price drifts — by forty it was
      trading at $1,087, not $1,000. A test that hard-codes a catalog's opening
      price is testing the catalog, not the rounding.
    */
    const state = working('mkt-1');
    const price = priceOf(state.prices, 'bd.cald10');
    const before = Number(state.player.cash);
    const bought = invest(state, 'bd.cald10', 4_500);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;

    const holding = bought.value.state.portfolio[0]!;
    expect(holding.units).toBe(Math.floor((4_500 * 100) / price));
    expect(Number.isInteger(holding.units)).toBe(true);
    // And the change stayed in the account rather than vanishing.
    const spent = before - Number(bought.value.state.player.cash);
    // Within a dollar: the ledger moves whole dollars, so the cost of a whole
    // number of units rounds by up to fifty cents on its way through.
    expect(Math.abs(spent - holding.units * price)).toBeLessThanOrEqual(100);
    expect(spent).toBeLessThan(4_500 * 100);
  });

  it('values a holding from the price book rather than storing a number', () => {
    /*
      CORE_RULES 13.23, which this build has paid for four times. There is one
      place a holding is worth something. Move the price and the portfolio
      moves with it — no second derivation to disagree.
    */
    const state = working('mkt-1');
    const bought = invest(state, 'eq.northline', 10_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const held = bought.value.state;

    const worth = Number(portfolioWorth(held.prices, held.portfolio));
    const doubled = {
      ...held.prices,
      history: {
        ...held.prices.history,
        'eq.northline': [priceOf(held.prices, 'eq.northline') * 2],
      },
    };
    expect(Number(portfolioWorth(doubled, held.portfolio))).toBeCloseTo(worth * 2, -2);
  });

  it('sells units back and reports the gain against what was paid', () => {
    const state = working('mkt-1');
    const bought = invest(state, 'eq.northline', 10_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const holding = bought.value.state.portfolio[0]!;

    const sold = divest(bought.value.state, 'eq.northline', holding.units / 2);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    // Half gone, half left, and no penalty on something with no term.
    expect(sold.value.state.portfolio[0]!.units).toBeCloseTo(holding.units / 2, 2);
    expect(sold.value.title).toBe('Sold');
  });

  it('charges for leaving a bond early and says so in the same breath', () => {
    const state = working('mkt-1');
    const bought = invest(state, 'bd.cald10', 5_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;

    const sold = divest(bought.value.state, 'bd.cald10', 5);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.value.title).toBe('Sold early');
    expect(sold.value.body).toMatch(/cost/);
  });
});

describe('what the held list says', () => {
  it('reports the gap rather than repeating the price beside it', () => {
    const state = working('mkt-1');
    const bought = invest(state, 'eq.northline', 20_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;

    const rows = holdingsOf(bought.value.state);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.instrument.name).toBe('Northline Freight');
    /*
      Fresh, so it is level — and the number the screen shows is the GAP.

      Within a cent rather than exactly zero: the ledger moves whole dollars, so
      `paid` is a round number while `worth` is units times a price to the cent.
      A one-cent difference on a $20,000 position is the rounding, not a gain,
      and asserting an exact zero would be asserting that the two never round
      apart.
    */
    expect(Math.abs(row.gain)).toBeLessThanOrEqual(1);
    expect(row.worth).toBeCloseTo(row.paid, -2);
  });

  it('moves with the market over a few years', () => {
    const bought = invest(working('mkt-2'), 'eq.verrell', 20_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    let state = bought.value.state;
    for (let y = 0; y < 8 && state.health.diedAtAge === undefined; y += 1) {
      state = advanceYear(state).state;
    }
    const row = holdingsOf(state)[0];
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.worth).not.toBe(row.paid);
    // And the units did not change: a price move is not a share issue.
    expect(row.holding.units).toBeCloseTo(bought.value.state.portfolio[0]!.units, 4);
  });
});

describe('the dashboard', () => {
  it('adds the portfolio and subtracts what is owed', () => {
    const bought = invest(working('mkt-1'), 'fd.broadindex', 20_000);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const state = bought.value.state;
    const books = summariseFinances(state.finance, state.world.year, estateOf(state));

    expect(Number(books.investments)).toBe(Number(portfolioWorth(state.prices, state.portfolio)));
    expect(Number(books.netWorth)).toBe(
      Number(state.finance.balance) + Number(books.investments) - Number(books.liabilities),
    );
    expect(books.onlyCash).toBe(false);
  });

  it('does not count buying as an expense, nor selling as income', () => {
    // Spec 44-46. Moving $20,000 into a fund has not tripled anybody's cost of
    // living, and selling it is not a payday.
    const before = working('mkt-1');
    const plain = summariseFinances(before.finance, before.world.year, estateOf(before));

    const bought = invest(before, 'fd.broadindex', 20_000);
    if (!bought.ok) return;
    const after = summariseFinances(
      bought.value.state.finance,
      bought.value.state.world.year,
      estateOf(bought.value.state),
    );
    expect(Number(after.monthlyOutflow)).toBe(Number(plain.monthlyOutflow));

    const holding = bought.value.state.portfolio[0]!;
    const sold = divest(bought.value.state, 'fd.broadindex', holding.units);
    if (!sold.ok) return;
    const back = summariseFinances(
      sold.value.state.finance,
      sold.value.state.world.year,
      estateOf(sold.value.state),
    );
    expect(Number(back.income)).toBe(Number(plain.income));
    expect(Number(back.monthlyOutflow)).toBe(Number(plain.monthlyOutflow));
    // And the money is back within a dollar of where it started — rounding to
    // whole units is the only permitted difference.
    expect(
      Math.abs(Number(sold.value.state.player.cash) - Number(before.player.cash)),
    ).toBeLessThan(200);
  });
});

describe('every id this code names actually exists', () => {
  it('resolves every instrument the tests and migration reach for', () => {
    /*
      0308c's own defect, caught by a migration test: the v22 mapping pointed at
      `bd.cald8`, a Caldonian eight-year bond. Caldonian issues three, five and
      ten. Nothing complained — a holding whose instrument cannot be found
      simply has no price, so every government bond a player owned became
      silently worthless. The content validator walks catalogs, not the code
      that refers to them.
    */
    for (const id of [
      'eq.northline',
      'eq.verrell',
      'eq.bramble',
      'fd.broadindex',
      'fd.keelworthactive',
      'bd.cald10',
      'bd.rhen7',
      'cx.meridiancoin',
    ]) {
      expect(findInstrument(id), `${id} is not in the catalog`).toBeDefined();
    }
  });

  it('prices everything in the catalog, with no zeroes', () => {
    const state = working('mkt-1', 20);
    for (const instrument of INSTRUMENTS) {
      expect(priceOf(state.prices, instrument.id), instrument.id).toBeGreaterThan(0);
    }
    expect(money(1_234)).toBe('$1,234');
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0308d — the typed amount, and the promise the screen makes about it  */
/* -------------------------------------------------------------------------- */

describe('what a typed amount would do', () => {
  /*
    The preview exists because the player can now type any number, and the
    number they type is not always the number that moves: buying rounds down to
    whole units, hard on a bond, and selling a bond early arrives smaller than
    it left.

    So the thing worth asserting is NOT that the preview returns a figure. It is
    that the figure is the one the trade then moves. A preview that drifts from
    its trade is worse than no preview at all, because the player believed it.
  */
  const richEnough = (): GameState => {
    const state = working('preview-1', 45);
    return state;
  };

  it('promises exactly what a buy then spends, at every amount', () => {
    const state = richEnough();
    const cash = Math.round(Number(state.player.cash) / 100);
    expect(cash, 'the test character needs money to be a test').toBeGreaterThan(5_000);

    const bond = INSTRUMENTS.find((row) => row.kind === 'bond')!;
    const share = INSTRUMENTS.find((row) => row.kind === 'stock')!;

    for (const instrument of [bond, share]) {
      for (const amount of [1, 137, 1_009, 4_137, Math.floor(cash / 2)]) {
        const preview = previewBuy(state, instrument.id, amount);
        const done = invest(state, instrument.id, amount);

        if (preview.refusal !== undefined || preview.units === 0) {
          expect(done.ok, `${instrument.id} at ${amount} previewed a refusal`).toBe(false);
          continue;
        }
        expect(done.ok, `${instrument.id} at ${amount}`).toBe(true);
        if (!done.ok) continue;

        const spent = cash - Math.round(Number(done.value.state.player.cash) / 100);
        expect(spent, `${instrument.id} at ${amount}: spent vs promised`).toBe(preview.cash);
        const holding = done.value.state.portfolio.find(
          (row) => row.instrumentId === instrument.id,
        );
        expect(holding?.units, `${instrument.id} at ${amount}: units`).toBe(preview.units);
      }
    }
  });

  it('rounds a bond down rather than charging what was asked', () => {
    const state = richEnough();
    const bond = INSTRUMENTS.find((row) => row.kind === 'bond')!;
    const unit = priceOf(state.prices, bond.id) / 100;
    const asked = Math.round(unit * 4.6);
    if (asked > Math.round(Number(state.player.cash) / 100)) return;

    const preview = previewBuy(state, bond.id, asked);
    expect(preview.units).toBe(4);
    expect(preview.cash).toBeLessThan(asked);
  });

  it('names WHICH wall an amount hit, not just that there was one', () => {
    const state = richEnough();
    const share = INSTRUMENTS.find((row) => row.kind === 'stock')!;
    const cash = Math.round(Number(state.player.cash) / 100);

    // Three different problems have to give three different answers, or the
    // player cannot tell which number to change (CORE_RULES 13.49).
    expect(previewBuy(state, share.id, cash * 10).refusal).toBe('noCash');
    expect(previewBuy(state, 'no.such.thing', 100).refusal).toBe('noSuchInstrument');
    const bond = INSTRUMENTS.find((row) => row.kind === 'bond')!;
    expect(previewBuy(state, bond.id, 1).refusal).toBe('notEnoughForOneUnit');
  });

  it('says nothing at all about an empty field', () => {
    const state = richEnough();
    const share = INSTRUMENTS.find((row) => row.kind === 'stock')!;
    expect(previewBuy(state, share.id, 0).units).toBe(0);
  });

  it('promises exactly what a sell then raises', () => {
    let state = richEnough();
    const share = INSTRUMENTS.find((row) => row.kind === 'stock')!;
    const cash = Math.round(Number(state.player.cash) / 100);
    const bought = invest(state, share.id, Math.floor(cash / 2));
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    state = bought.value.state;

    const held = state.portfolio.find((row) => row.instrumentId === share.id)!;
    const worth = Math.round((held.units * priceOf(state.prices, share.id)) / 100);
    const before = Math.round(Number(state.player.cash) / 100);

    for (const amount of [50, Math.round(worth / 3), worth]) {
      const preview = previewSell(state, share.id, amount);
      if (preview.units === 0) continue;
      const done = divest(state, share.id, preview.units);
      expect(done.ok, `selling ${amount}`).toBe(true);
      if (!done.ok) continue;
      const raised = Math.round(Number(done.value.state.player.cash) / 100) - before;
      expect(raised, `selling ${amount}: raised vs promised`).toBe(preview.cash);
    }
  });

  it('treats an absurd sell amount as "everything" rather than refusing it', () => {
    let state = richEnough();
    const share = INSTRUMENTS.find((row) => row.kind === 'stock')!;
    const cash = Math.round(Number(state.player.cash) / 100);
    const bought = invest(state, share.id, Math.floor(cash / 2));
    if (!bought.ok) return;
    state = bought.value.state;
    const held = state.portfolio.find((row) => row.instrumentId === share.id)!;

    expect(previewSell(state, share.id, 999_999_999).units).toBeCloseTo(held.units, 4);
  });

  it('has nothing to say about something the character does not hold', () => {
    const state = richEnough();
    const share = INSTRUMENTS.find((row) => row.kind === 'stock')!;
    expect(previewSell(state, share.id, 100).refusal).toBe('nothingHeld');
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0309 — the categories an investing life actually writes              */
/* -------------------------------------------------------------------------- */

describe('what investing puts in the ledger', () => {
  it('produces the categories the ledger claims nobody produces', () => {
    /*
      THE GUARD THAT HAD TO LIVE HERE.

      `UNWRITTEN_CATEGORIES` still listed `assetIncome` and `investment` two
      milestones after 0308 gave them producers, and the test watching that list
      asserted it EQUALLED four names — so it passed the whole time (CORE_RULES
      13.51). The obvious fix, a derived check in `ledger.test.ts`, turned out to
      be VACUOUS: none of those lives ever buys anything, so no investment
      category can appear there no matter how wrong the list is. Verified by
      putting `assetIncome` back and watching the suite stay green.

      A category is only reachable where somebody reaches it. This is that place.
    */
    let state = working('ledger-cat', 45);
    const cash = Math.round(Number(state.player.cash) / 100);
    expect(cash, 'the test character needs money to invest').toBeGreaterThan(5_000);

    // Something that PAYS, so a coupon lands, and a bond so a maturity can.
    const payer = INSTRUMENTS.filter((row) => row.payout > 0.02 && row.kind !== 'bond')[0]!;
    const bought = invest(state, payer.id, Math.floor(cash / 2));
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    state = bought.value.state;

    // The purchase itself is an `investment` row (spec 44-46: a transfer).
    expect(state.finance.transactions.some((row) => row.category === 'investment')).toBe(true);

    // And a year of holding it produces the payout.
    state = advanceYear(state).state;
    expect(
      state.finance.transactions.some((row) => row.category === 'assetIncome'),
      'a year of holding something that pays produced no assetIncome',
    ).toBe(true);

    for (const category of ['investment', 'assetIncome'] as const) {
      expect(
        UNWRITTEN_CATEGORIES.includes(category),
        `${category} is listed as having no producer, and this test just produced one`,
      ).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0309 — advisors, through the engine                                  */
/* -------------------------------------------------------------------------- */

describe('paying somebody for advice', () => {
  it('charges the fee, and the money actually leaves', () => {
    /*
      THE TEST THE WHOLE TICKET RESTS ON. An advisor whose fee is deducted
      somewhere nobody can see is FREE, and a free paid advisor makes hiring one
      a non-decision — the mirror of CORE_RULES 13.7. Measured, following an
      advisor adds 31% to a stock-picking character's median outcome, and the
      fee is the only thing standing against that.
    */
    let state = working('advice-fee', 45);
    const cash = Math.round(Number(state.player.cash) / 100);
    expect(cash).toBeGreaterThan(5_000);

    // Buy enough that a percentage fee is a real number.
    const fund = INSTRUMENTS.find((row) => row.kind === 'fund')!;
    const bought = invest(state, fund.id, Math.floor(cash * 0.8));
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    state = bought.value.state;

    const paid = ADVISORS.find((row) => row.feeBasis > 0)!;
    const hired = hireAdvisor(state, paid.id);
    // A character under the minimum is refused, which is itself the right
    // behaviour — the test only proceeds when they are over it.
    if (!hired.ok) {
      expect(hired.error).toBe('notEnoughForOneUnit');
      return;
    }
    state = hired.value;
    expect(state.advisorId).toBe(paid.id);

    const expected = feeThisYear(state);
    expect(expected).toBeGreaterThan(0);

    const after = advanceYear(state).state;
    const charged = after.finance.transactions.filter((row) =>
      row.source.includes(paid.name),
    );
    /*
      Verified once by printing it: this character hires adv.independent with a
      $90,471 portfolio and pays $181. The early return above is a real branch —
      a poorer character genuinely is refused — so without checking that, this
      test could have been passing by never charging anybody.
    */
    expect(charged.length, 'the advisor was never billed for').toBe(1);
    expect(Number(charged[0]!.amount)).toBeLessThan(0);
  });

  it('charges nothing at all when nobody is hired', () => {
    const state = working('advice-none', 40);
    expect(state.advisorId).toBeUndefined();
    expect(feeThisYear(state)).toBe(0);
    const after = advanceYear(state).state;
    for (const advisor of ADVISORS) {
      expect(after.finance.transactions.some((row) => row.source.includes(advisor.name))).toBe(
        false,
      );
    }
  });

  it('lets somebody go, and the fee stops', () => {
    let state = working('advice-fire', 45);
    const free = ADVISORS.find((row) => row.feeBasis === 0)!;
    const hired = hireAdvisor(state, free.id);
    expect(hired.ok).toBe(true);
    if (!hired.ok) return;
    state = hired.value;
    expect(adviceFor(state).length).toBeGreaterThan(0);

    const gone = dismissAdvisor(state);
    expect(gone.advisorId).toBeUndefined();
    expect(adviceFor(gone)).toEqual([]);
    expect(feeThisYear(gone)).toBe(0);
  });

  it('acts on what it was told, or says why it cannot', () => {
    let state = working('advice-act', 45);
    const cash = Math.round(Number(state.player.cash) / 100);
    const free = ADVISORS.find((row) => row.feeBasis === 0)!;
    const hired = hireAdvisor(state, free.id);
    if (!hired.ok) return;
    state = hired.value;

    const recs = adviceFor(state);
    expect(recs.length).toBeGreaterThan(0);

    for (const rec of recs) {
      const done = actOnAdvice(state, rec.id);
      if (rec.verb === 'hold') {
        // The one with nothing to press, which is deliberate rather than
        // missing — the same shape as 0308's absent HOLD button.
        expect(done.ok).toBe(false);
        continue;
      }
      if (!done.ok) continue;
      // Whatever it did, the money moved and the ledger knows about it.
      expect(done.value.state.finance.transactions.length).toBeGreaterThan(
        state.finance.transactions.length,
      );
    }
    void cash;
  });

  it('refuses a recommendation that is not on the table', () => {
    const state = working('advice-bogus', 40);
    expect(actOnAdvice(state, 'rec.9999.nonsense').ok).toBe(false);
  });
});
