/**
 * Ticket 0601 acceptance tests — owning a business (simulation side).
 *
 * Measured before this ticket on 150 lives: nobody owned a business, and
 * Assets → Businesses had said "not built yet" since 0108. Four in five adults
 * over 25 held $25,000, so a small business was within reach of most lives and
 * a hotel of none; nobody who played passively ever asked for one, so the block
 * has no door and a passive life has to come out exactly as it did.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { taxRate } from '@yearafter/careers';
import {
  MAX_BUSINESSES,
  MAX_LOCATIONS,
  branchCostFor,
  businessesValue,
  locationsOf,
  newBusiness,
} from '@yearafter/finance';
import { findBusinessType } from '@yearafter/content';
import { advanceYear } from './advance';
import {
  businessMarket,
  businessTaxOn,
  closeBusiness,
  closeLocation,
  expandBusiness,
  netWorthOf as netWorthDollars,
  hireStaff,
  letStaffGo,
  liquidOf,
  nudgePrice,
  offerFor,
  openBusiness,
  runBusinessesYear,
  sellBusiness,
  setAutoStaff,
  setPayroll,
  setPrice,
  setSupplier,
  viewOf,
} from './businesses';
import { continueAsChild, heirsIn } from './continue';
import { decide } from './decide';
import type { GameState } from './game-state';
import { estateOf } from './investments';
import { createNewGame } from './new-game';
import { earnedIncomeOf } from './vehicles';

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

function topUp(state: GameState, amount: number): GameState {
  const books = {
    ...state.finance,
    balance: (Number(state.finance.balance) + amount * 100) as never,
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:test-${amount}`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: (amount * 100) as never,
        source: 'A test windfall',
      },
    ],
  };
  return { ...state, finance: books, player: { ...state.player, cash: books.balance } };
}

const netWorthOf = (state: GameState): number => {
  const estate = estateOf(state);
  return (
    Number(state.player.cash) +
    Number(estate.investments) +
    Number(estate.assets ?? 0) -
    Number(estate.liabilities)
  );
};

function liveTo(seed: string, age: number): GameState {
  let state = createNewGame({ seed });
  let guard = 0;
  while (state.player.alive && state.player.age < age && (guard += 1) < 80) {
    state = answerEverything(advanceYear(state).state);
  }
  return state;
}

const ADULT = topUp(liveTo('biz-adult', 30), 400_000);

const opened = (typeId = 'biz.cafe', from: GameState = ADULT): GameState => {
  const result = openBusiness(from, typeId);
  if (!result.ok) throw new Error(`could not open ${typeId}: ${result.error}`);
  return result.value.state;
};

describe('0601 — who can start one', () => {
  it('offers nothing to a child, and a ladder to an adult with money', () => {
    const child = createNewGame({ seed: 'biz-child' });
    expect(businessMarket(child)).toHaveLength(0);
    const open = openBusiness(child, 'biz.cleaning');
    expect(open.ok).toBe(false);
    const market = businessMarket(ADULT);
    expect(market.length).toBeGreaterThan(3);
    for (let i = 1; i < market.length; i += 1) {
      expect(market[i]!.startup).toBeGreaterThanOrEqual(market[i - 1]!.startup);
    }
  });

  it('hides what is far beyond the money, so nothing tells anybody which tier they are', () => {
    const broke = topUp(ADULT, -Math.floor(Number(ADULT.player.cash) / 100));
    expect(liquidOf(broke)).toBeLessThan(20_000);
    expect(businessMarket(broke).some((type) => type.id === 'biz.hotel')).toBe(false);
    expect(businessMarket(ADULT).some((type) => type.id === 'biz.hotel')).toBe(false);
  });

  it('refuses what you cannot afford and does not touch the money', () => {
    const rich = businessMarket(ADULT)[businessMarket(ADULT).length - 1]!;
    const poor = topUp(ADULT, -(Math.floor(Number(ADULT.player.cash) / 100) - 1_000));
    const refused = openBusiness(poor, rich.id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/cannot-afford|no-such-type/);
  });
});

describe('0601 — opening one', () => {
  it('takes the startup out of cash as a transfer, not a loss, and names the place', () => {
    const before = netWorthOf(ADULT);
    const result = openBusiness(ADULT, 'biz.cafe');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const type = findBusinessType('biz.cafe')!;
    const { state, business } = result.value;
    expect(state.businesses).toHaveLength(1);
    expect(business.name.length).toBeGreaterThan(2);
    expect(Number(ADULT.player.cash) - Number(state.player.cash)).toBe(type.startup * 100);
    // The fittings and float are owned: net worth moves by a small amount, not by the startup.
    expect(Math.abs(netWorthOf(state) - before)).toBeLessThan(type.startup * 100 * 0.6);
    expect(state.player.timeline.some((entry) => entry.text.includes(business.name))).toBe(true);
  });

  it('caps the number you can run at three, and gives each a different name', () => {
    let state = opened('biz.cleaning');
    state = opened('biz.cleaning', state);
    state = opened('biz.cleaning', state);
    expect(state.businesses).toHaveLength(MAX_BUSINESSES);
    expect(new Set(state.businesses.map((business) => business.name)).size).toBe(MAX_BUSINESSES);
    const fourth = openBusiness(state, 'biz.cleaning');
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.error).toBe('too-many');
  });
});

describe('0601 — running one', () => {
  const state = opened('biz.cafe');
  const id = state.businesses[0]!.id;
  const ok = <T,>(result: { ok: boolean; value?: T }): T => {
    expect(result.ok).toBe(true);
    return result.value as T;
  };

  it('moves the price in steps and keeps it on the slider', () => {
    expect(ok(setPrice(state, id, 120)).businesses[0]!.price).toBe(120);
    expect(ok(setPrice(state, id, 999)).businesses[0]!.price).toBe(140);
    expect(ok(nudgePrice(state, id, -2)).businesses[0]!.price).toBe(90);
  });

  it('changes the supplier and the payroll level', () => {
    expect(ok(setSupplier(state, id, 'premium')).businesses[0]!.supplier).toBe('premium');
    expect(ok(setPayroll(state, id, 'bigBucks')).businesses[0]!.payroll).toBe('bigBucks');
  });

  it('turns the manager off the moment you hire or let go by hand, and back on at will', () => {
    const hired = ok(hireStaff(state, id));
    expect(hired.businesses[0]!.staff).toBe(state.businesses[0]!.staff + 1);
    expect(hired.businesses[0]!.autoStaff).toBe(false);
    const back = ok(setAutoStaff(hired, id, true));
    expect(back.businesses[0]!.autoStaff).toBe(true);
    const gone = ok(letStaffGo(hired, id));
    expect(gone.businesses[0]!.staff).toBe(state.businesses[0]!.staff);
  });

  it('will not let go below what the doors need, or hire past the ceiling', () => {
    const type = findBusinessType('biz.cafe')!;
    const minimal = {
      ...state,
      businesses: [{ ...state.businesses[0]!, staff: type.staffMin }],
    };
    expect(letStaffGo(minimal, id).ok).toBe(false);
    const view = viewOf(minimal, minimal.businesses[0]!)!;
    expect(view.canLetGo).toBe(false);
    expect(view.canHire).toBe(true);
  });

  it('answers a made-up id with an error, not a crash', () => {
    const result = setPrice(state, 'biz:nope', 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('no-such-business');
  });
});

describe('0601 — a year of owning', () => {
  it('pays the owner from what the business clears, as taxed income', () => {
    let state = opened('biz.accounting');
    const startCash = Number(state.player.cash);
    let drawn = 0;
    for (let year = 0; year < 6; year += 1) {
      const step = advanceYear(state);
      state = answerEverything(step.state);
      drawn += state.finance.transactions
        .filter((row) => row.year === step.state.world.year - 1 || row.category === 'business')
        .filter((row) => row.category === 'business')
        .reduce((sum, row) => sum + Number(row.amount), 0);
    }
    expect(state.businesses.length).toBeLessThanOrEqual(1);
    const rows = state.finance.transactions.filter((row) => row.category === 'business');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Number(row.amount)).toBeGreaterThan(0);
    expect(startCash).toBeGreaterThan(0);
    expect(drawn).toBeGreaterThan(0);
  });

  it('is deterministic: the same life, built the same way, gives the same books', () => {
    // Built from scratch each time: a game state carries a live random source
    // (finding 36), so two runs from one state object are not comparable.
    const run = () => {
      let state = opened('biz.salon', topUp(liveTo('biz-det', 30), 400_000));
      for (let year = 0; year < 4; year += 1) state = answerEverything(advanceYear(state).state);
      return JSON.stringify(state.businesses, (_key, value) =>
        typeof value === 'bigint' ? String(value) : value,
      );
    };
    expect(run()).toEqual(run());
  });

  it('leaves a life with no business exactly as it was', () => {
    let state = createNewGame({ seed: 'biz-passive' });
    for (let year = 0; year < 30; year += 1) state = answerEverything(advanceYear(state).state);
    expect(state.businesses).toEqual([]);
    expect(state.finance.transactions.some((row) => row.category === 'business')).toBe(false);
  });

  it('taxes a draw on top of the salary, with the self-employment tax', () => {
    const none = businessTaxOn(60_000, 0);
    const some = businessTaxOn(60_000, 40_000);
    expect(none).toBe(0);
    // The income tax the whole pay costs, plus 7.65% of the business's share.
    const incomeTax = taxRate(100_000) * 100_000 - taxRate(60_000) * 60_000;
    expect(some).toBe(Math.round(incomeTax + 40_000 * 0.0765));
    expect(some).toBeLessThan(40_000 * 0.6);
    expect(businessTaxOn(0, 40_000)).toBeLessThan(some);
  });
});

describe('0601 — when it goes wrong', () => {
  const type = findBusinessType('biz.restaurant')!;
  const losing = {
    ...newBusiness(type, 'biz:2000:restaurant:0', 'The Losing Place', 2000, 0.55),
    staff: type.staff * 2,
    cash: dollars(0),
    reputation: 5,
  };
  const input = {
    businesses: [losing],
    year: 2001,
    seed: 'insolvent',
    market: 'severeRecession' as const,
    holdsJob: false,
    stat: () => 10,
  };

  it('puts the owner’s money in to cover a bad year, as a transfer', () => {
    const year = runBusinessesYear({ ...input, available: 5_000_000 });
    expect(year.businesses).toHaveLength(1);
    const injection = year.transactions.find((row) => row.category === 'property');
    expect(injection).toBeDefined();
    expect(Number(injection!.amount)).toBeLessThan(0);
    expect(year.lines.join(' ')).toMatch(/lost/);
  });

  it('closes the business when the owner cannot cover it, and says so', () => {
    const year = runBusinessesYear({ ...input, available: 0 });
    expect(year.businesses).toHaveLength(0);
    expect(year.records.some((record) => record.category === 'business')).toBe(true);
    expect(year.lines.join(' ')).toMatch(/could not carry on/);
  });
});

describe('0601 — getting out', () => {
  const state = opened('biz.hvac', topUp(ADULT, 200_000));
  const id = state.businesses[0]!.id;

  it('sells for an offer less the broker, with the till handed over', () => {
    const offer = offerFor(state, id)!;
    expect(offer.proceeds).toBe(offer.price - offer.fee + offer.cash);
    const sold = sellBusiness(state, id);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.value.state.businesses).toHaveLength(0);
    expect(Number(sold.value.state.player.cash) - Number(state.player.cash)).toBe(
      sold.value.proceeds * 100,
    );
    expect(sold.value.entry.text).toMatch(/Sold/);
  });

  it('asks the same price for the same business in the same year', () => {
    expect(offerFor(state, id)).toEqual(offerFor(state, id));
  });

  it('closes for less than a sale would bring', () => {
    const closed = closeBusiness(state, id);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.state.businesses).toHaveLength(0);
    expect(closed.value.proceeds).toBeLessThanOrEqual(offerFor(state, id)!.proceeds);
  });

  it('knows nothing of a business that is not there', () => {
    expect(sellBusiness(state, 'biz:nope').ok).toBe(false);
    expect(closeBusiness(state, 'biz:nope').ok).toBe(false);
  });
});

describe('0601 — what the books call it', () => {
  it('counts what a business paid the owner as earned income when pricing a car', () => {
    const paid: GameState = {
      ...ADULT,
      finance: {
        ...ADULT.finance,
        transactions: [
          ...ADULT.finance.transactions,
          {
            id: 'f:test:biz',
            year: ADULT.world.year,
            age: ADULT.player.age,
            category: 'business' as const,
            amount: dollars(30_000),
            source: 'The Corner Cup — profit',
          },
        ],
      },
    };
    expect(earnedIncomeOf(paid) - earnedIncomeOf(ADULT)).toBe(30_000);
  });
});

describe('0601 — what it is worth', () => {
  it('counts a business in net worth, and the startup is not a loss on day one', () => {
    const before = netWorthOf(ADULT);
    const state = opened('biz.salon');
    const startup = findBusinessType('biz.salon')!.startup * 100;
    const worth = Number(businessesValue(state.businesses, findBusinessType, state.world.year));
    expect(worth).toBeGreaterThan(0);
    // What left cash came back as something owned: the books move by the gap
    // between the two, and by nothing else.
    expect(netWorthOf(state) - before).toBe(worth - startup);
  });

  it('is sold at death, to the heir, as a gift, when the heir is not taking it on', () => {
    let tried = 0;
    for (let i = 0; i < 12 && tried < 1; i += 1) {
      let state = opened('biz.cafe', topUp(liveTo(`biz-heir-${i}`, 30), 400_000));
      let guard = 0;
      while (state.player.alive && (guard += 1) < 90) {
        state = answerEverything(advanceYear(state).state);
      }
      const heir = heirsIn(state.family)[0];
      if (state.player.alive || !heir || state.businesses.length === 0) continue;
      // Ticket 0604: handed on by default; this is the other answer, "sell it".
      const next = continueAsChild(state, heir.id, { keepBusinesses: false });
      if (!next) continue;
      tried += 1;
      expect(next.businesses).toEqual([]);
      expect(
        next.finance.transactions.some(
          (row) => row.category === 'gift' && /business/i.test(row.source),
        ),
      ).toBe(true);
    }
    expect(tried).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0602                                                                 */
/* -------------------------------------------------------------------------- */

/** A business that has traded long enough, and earned, to be allowed to grow. */
const established = (typeId = 'biz.cleaning', from: GameState = ADULT): GameState => {
  const state = opened(typeId, from);
  const business = state.businesses[0]!;
  return {
    ...state,
    businesses: [
      {
        ...business,
        openedYear: state.world.year - 4,
        last: {
          year: state.world.year - 1, revenue: 300_000, costs: 260_000, profit: 40_000,
          drawn: 20_000, injected: 0, turnedAway: 0, idle: 0,
        },
      },
    ],
  };
};

describe('0602 — the marketplace reads net worth', () => {
  it('counts what a person owns, not only what is in the bank', () => {
    const rich = topUp(ADULT, 6_000_000);
    expect(businessMarket(rich).some((type) => type.id === 'biz.hotel')).toBe(true);
    const hotel = openBusiness(rich, 'biz.hotel');
    expect(hotel.ok).toBe(true);
    if (!hotel.ok) return;
    // Spend the cash down to almost nothing. The hotel is still theirs.
    const cashPoor = topUp(
      hotel.value.state,
      -(Math.floor(Number(hotel.value.state.player.cash) / 100) - 2_000),
    );
    expect(liquidOf(cashPoor)).toBeLessThan(5_000);
    expect(netWorthDollars(cashPoor)).toBeGreaterThan(2_000_000);
    expect(businessMarket(cashPoor).some((type) => type.id === 'biz.restaurant')).toBe(true);
    expect(businessMarket(cashPoor).some((type) => type.id === 'biz.hotel')).toBe(true);
  });

  it('shows a beginner the small ones and the very rich all of them', () => {
    const small = businessMarket(ADULT);
    const big = businessMarket(topUp(ADULT, 40_000_000));
    expect(big.length).toBe(31);
    expect(small.length).toBeLessThan(big.length);
    expect(small.length).toBeGreaterThan(8);
    expect(small.every((type) => type.startup < 1_000_000)).toBe(true);
    // And nothing on the list is labelled with a tier (spec 912).
    for (const type of big) expect(JSON.stringify(type)).not.toMatch(/tier|wealth/i);
  });
});

describe('0602 — opening another location', () => {
  it('is for a business that has traded and earned, not a new one', () => {
    const fresh = opened('biz.cleaning');
    const refused = expandBusiness(fresh, fresh.businesses[0]!.id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('too-new');
    expect(viewOf(fresh, fresh.businesses[0]!)!.expansion).toBe('too-new');
  });

  it('takes the cost from cash as a transfer and gives the business a second door', () => {
    const state = established();
    const id = state.businesses[0]!.id;
    const type = findBusinessType('biz.cleaning')!;
    const before = netWorthOf(state);
    const result = expandBusiness(state, id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const grown = result.value.state;
    expect(locationsOf(grown.businesses[0]!)).toBe(2);
    expect(Number(state.player.cash) - Number(grown.player.cash)).toBe(branchCostFor(type) * 100);
    expect(grown.businesses[0]!.staff).toBeGreaterThanOrEqual(type.staffMin * 2);
    // The fittings and the float come back as something owned on the day: a
    // transfer, not a loss. Net worth moves by rounding and nothing else.
    expect(Math.abs(netWorthOf(grown) - before)).toBeLessThanOrEqual(100);
    expect(result.value.entry.text).toMatch(/another location/i);
    expect(grown.finance.transactions.some((row) => row.category === 'property' && /another/i.test(row.source))).toBe(true);
  });

  it('refuses a business that lost money, one without the cash, and a fifth door', () => {
    const state = established();
    const id = state.businesses[0]!.id;
    const losing = {
      ...state,
      businesses: [{ ...state.businesses[0]!, last: { ...state.businesses[0]!.last!, profit: -1 } }],
    };
    const a = expandBusiness(losing, id);
    expect(a.ok ? undefined : a.error).toBe('not-earning');
    const broke = topUp(state, -(Math.floor(Number(state.player.cash) / 100) - 100));
    const b = expandBusiness(broke, id);
    expect(b.ok ? undefined : b.error).toBe('cannot-afford');
    const full = {
      ...state,
      businesses: [{ ...state.businesses[0]!, branches: [1990, 1991, 1992] }],
    };
    expect(locationsOf(full.businesses[0]!)).toBe(MAX_LOCATIONS);
    const c = expandBusiness(full, id);
    expect(c.ok ? undefined : c.error).toBe('at-limit');
    const d = expandBusiness(state, 'biz:nope');
    expect(d.ok ? undefined : d.error).toBe('no-such-business');
  });

  it('serves more custom, pays for two leases and two crews, and counts the fittings in its worth', () => {
    const state = established('biz.cleaning');
    const id = state.businesses[0]!.id;
    const grown = (expandBusiness(state, id) as { value: { state: GameState } }).value.state;
    const run = (from: GameState) =>
      runBusinessesYear({
        businesses: from.businesses,
        year: from.world.year + 1,
        seed: 'expand',
        market: 'normal',
        available: 1e9,
        holdsJob: false,
        stat: () => 50,
      }).businesses[0]!;
    const single = run(state);
    const double = run(grown);
    expect(double.last!.revenue).toBeGreaterThan(single.last!.revenue);
    expect(double.last!.costs).toBeGreaterThan(single.last!.costs);
    expect(Number(businessesValue(grown.businesses, findBusinessType, grown.world.year))).toBeGreaterThan(
      Number(businessesValue(state.businesses, findBusinessType, state.world.year)),
    );
  });

  it('lets the manager staff the extra door, and the owner hire past the old ceiling', () => {
    const state = established('biz.cleaning');
    const id = state.businesses[0]!.id;
    const type = findBusinessType('biz.cleaning')!;
    const grown = (expandBusiness(state, id) as { value: { state: GameState } }).value.state;
    let tops = grown;
    for (let i = 0; i < 20; i += 1) {
      const next = hireStaff(tops, id);
      if (!next.ok) break;
      tops = next.value;
    }
    expect(tops.businesses[0]!.staff).toBeGreaterThan(Math.ceil(type.staff * 1.6));
    let one = state;
    for (let i = 0; i < 20; i += 1) {
      const next = hireStaff(one, id);
      if (!next.ok) break;
      one = next.value;
    }
    expect(one.businesses[0]!.staff).toBeLessThanOrEqual(Math.ceil(type.staff * 1.6));
  });
});

describe('0602 — closing a location', () => {
  it('sells the newest door for part of its fittings and leaves the business smaller', () => {
    const state = established('biz.cleaning');
    const id = state.businesses[0]!.id;
    const grown = (expandBusiness(state, id) as { value: { state: GameState } }).value.state;
    const closed = closeLocation(grown, id);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(locationsOf(closed.value.state.businesses[0]!)).toBe(1);
    expect(closed.value.proceeds).toBeGreaterThan(0);
    expect(closed.value.proceeds).toBeLessThan(branchCostFor(findBusinessType('biz.cleaning')!));
    expect(Number(closed.value.state.player.cash) - Number(grown.player.cash)).toBe(
      closed.value.proceeds * 100,
    );
  });

  it('will not close the only door — that is closing the business', () => {
    const state = established('biz.cleaning');
    const result = closeLocation(state, state.businesses[0]!.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('only-one');
  });
});

describe('0602 — a business with more doors at a death', () => {
  it('is sold with its branches, for more than the same business with one door', () => {
    const state = established('biz.cleaning');
    const id = state.businesses[0]!.id;
    const grown = (expandBusiness(state, id) as { value: { state: GameState } }).value.state;
    expect(offerFor(grown, id)!.price).toBeGreaterThanOrEqual(offerFor(state, id)!.price);
  });
});
