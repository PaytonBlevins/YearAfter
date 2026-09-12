/**
 * Ticket 0305 acceptance tests — credit standing.
 *
 * Most of what the spec says about credit is a prohibition, so most of what is
 * asserted here is that a prohibition holds: no score reaches a caller, old
 * trouble genuinely disappears, and the model does not hand out a standing it
 * has no basis for.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { EMPTY_LEDGER, postAll, type Ledger } from './ledger';
import {
  CREDIT_FROM_AGE,
  CREDIT_INPUTS_NOT_YET_BUILT,
  STANDING_ORDER,
  TROUBLE_FADES_OVER,
  atLeast,
  creditReport,
} from './credit';

/** A comfortable year, posted for each of a run of years. */
function career(from: number, years: number, pay: number, cost: number): Ledger {
  let ledger: Ledger = EMPTY_LEDGER;
  for (let i = 0; i < years; i += 1) {
    ledger = postAll(ledger, from + i, 25 + i, [
      { category: 'salary', amount: dollars(pay), source: 'Pay' },
      { category: 'tax', amount: dollars(-Math.round(pay * 0.2)), source: 'Tax' },
      { category: 'living', amount: dollars(-cost), source: 'Living costs' },
    ]).ledger;
  }
  return ledger;
}

describe('what the spec forbids', () => {
  it('never hands a caller a score', () => {
    /*
      Spec 1867 — "No generic risk score" — and spec 1685's "no overbuilt real
      credit-bureau simulation". The report is a word, a sentence and two lists.
      A number would leak straight onto a screen the first time somebody found
      it convenient, so there is not one to find.
    */
    const report = creditReport(career(2030, 6, 70_000, 45_000), 2035, 35);
    for (const [key, value] of Object.entries(report)) {
      expect(typeof value, `${key} is a number`).not.toBe('number');
    }
  });

  it('lets old trouble disappear completely', () => {
    /*
      Spec 25 forbids past defaults as a modelled input while requiring payment
      behaviour, and this is where the two are reconciled: a bureau remembers a
      dated event for seven years, and this asks whether somebody is keeping up.

      Spec 1381 is the other half — "credit should be useful, not universally
      punitive". A bad year at twenty-two must not follow a character to sixty.
    */
    let rough = career(2020, 2, 20_000, 40_000).transactions;
    expect(rough.some((entry) => entry.category === 'shortfall')).toBe(true);

    // The same life, long after: the shortfalls are still in the ledger and
    // must no longer count against them.
    const ledger = career(2020, 2, 20_000, 40_000);
    const later = {
      ...ledger,
      transactions: [...ledger.transactions, ...career(2040, 6, 90_000, 50_000).transactions],
    };
    const soonAfter = creditReport(ledger, 2021, 26);
    const longAfter = creditReport(later, 2045, 50);
    expect(STANDING_ORDER.indexOf(longAfter.standing)).toBeGreaterThan(
      STANDING_ORDER.indexOf(soonAfter.standing),
    );
    expect(longAfter.hurting).not.toContain('You have come up short recently');
  });

  it('forgets trouble on a fixed schedule, not on a curve nobody can name', () => {
    // Several years, so the three-year income window is a real income and the
    // thin-record branch is not what is being measured.
    const ledger = career(2020, 4, 40_000, 60_000);
    const during = creditReport(ledger, 2023, 28);
    const after = creditReport(ledger, 2023 + TROUBLE_FADES_OVER, 28 + TROUBLE_FADES_OVER);
    expect(during.hurting).toContain('You have come up short recently');
    expect(after.hurting).not.toContain('You have come up short recently');
  });
});

describe('a standing the model has no basis for', () => {
  it('is "none" for a child, not "poor"', () => {
    // A twelve-year-old is not a bad risk; they are not a risk. 0306 has to be
    // able to refuse them a card for the right reason.
    const report = creditReport(career(2030, 5, 60_000, 40_000), 2034, CREDIT_FROM_AGE - 1);
    expect(report.standing).toBe('none');
    expect(report.hurting).toEqual([]);
  });

  it('is "none" for an adult with no financial life at all', () => {
    expect(creditReport(EMPTY_LEDGER, 2040, 30).standing).toBe('none');
  });

  it('is never good just because somebody never had money to fail with', () => {
    /*
      THE DEFECT THE FIRST VERSION OF THIS FILE HAD, caught by measuring the
      population rather than by any assertion.

      `keepingUp` rewarded never having come up short — and a character with no
      job never comes up short, because the living phase contracts their
      household instead of letting a bill go unpaid. They scored full marks on
      the heaviest term in the model and came out FAIR while earning nothing,
      holding nothing and owning nothing. The term was rewarding the absence of
      activity. Measured after the fix: a life that never takes a job is 95%
      "none" and 5% "poor", and 0% anything else.
    */
    const nothing = postAll(EMPTY_LEDGER, 2040, 30, [
      { category: 'living', amount: dollars(-50), source: 'Living costs' },
    ]).ledger;
    const report = creditReport(nothing, 2040, 30);
    expect(['none', 'poor']).toContain(report.standing);
  });
});

describe('what moves it', () => {
  it('rewards earning more', () => {
    const small = creditReport(career(2030, 4, 26_000, 24_000), 2033, 30);
    const large = creditReport(career(2030, 4, 140_000, 60_000), 2033, 30);
    expect(STANDING_ORDER.indexOf(large.standing)).toBeGreaterThan(
      STANDING_ORDER.indexOf(small.standing),
    );
    expect(large.helping).toContain('You earn well');
  });

  it('rewards having room between income and costs', () => {
    const tight = creditReport(career(2030, 4, 60_000, 47_000), 2033, 30);
    const roomy = creditReport(career(2030, 4, 60_000, 20_000), 2033, 30);
    expect(STANDING_ORDER.indexOf(roomy.standing)).toBeGreaterThanOrEqual(
      STANDING_ORDER.indexOf(tight.standing),
    );
    expect(roomy.helping).toContain('Your costs leave you room');
  });

  it('says something in the player’s words for every standing it can reach', () => {
    // CORE_RULES 13.6 in spirit and writing rule 10 in letter: a band with no
    // explanation is the opaque score the spec dislikes.
    for (const ledger of [
      EMPTY_LEDGER,
      career(2030, 4, 26_000, 25_000),
      career(2030, 4, 60_000, 40_000),
      career(2030, 4, 160_000, 50_000),
    ]) {
      const report = creditReport(ledger, 2033, 34);
      expect(report.summary.length).toBeGreaterThan(10);
      expect(report.summary).not.toMatch(/\d/);
      expect(report.label.length).toBeGreaterThan(0);
    }
  });
});

describe('the contract 0306 and 0307 get', () => {
  it('orders the bands, so a lender can set a floor', () => {
    expect(atLeast('good', 'fair')).toBe(true);
    expect(atLeast('fair', 'good')).toBe(false);
    expect(atLeast('excellent', 'excellent')).toBe(true);
    // "none" is the bottom of the order, so a floor of "poor" excludes a child.
    expect(atLeast('none', 'poor')).toBe(false);
  });

  it('names the inputs that do not exist yet, so they are not silent zeroes', () => {
    /*
      Spec 25 lists six inputs. Debt load needs a debt, so it cannot exist
      before 0307, and a model that folded it in as zero would be quietly
      asserting that every character owes nothing. Same device as
      `UNWRITTEN_CATEGORIES` and `NOT_YET_OWNED`; this test is the note to the
      ticket that retires it.

      `utilization` was here too until 0306 gave the game cards to utilise —
      which is the list doing exactly what it is for.
    */
    expect(CREDIT_INPUTS_NOT_YET_BUILT.map((row) => row.key)).toEqual(['debtLoad']);
  });
});
