/**
 * Ticket 0502 acceptance tests — a household of two.
 *
 * Measured on 150 played lives before this ticket (`claude/0502-a-household-
 * of-two.md`): a partner cost the household half again and brought nothing in.
 * Median net worth at 55–64 was $32,000 with a partner and $91,000 without
 * one, and somebody who was only DATING paid for a household of two.
 */

import { describe, expect, it, vi } from 'vitest';
import * as livingPhase from './phases/living';
import {
  homesValue,
  mortgagesOwed,
  portfolioWorth,
  reconcile,
  totalBorrowed,
  totalOwed,
} from '@yearafter/finance';
import { householdPartnerOf, partnerOf } from '@yearafter/social';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { partnerIncomeFor } from './phases/partner';

const LIVES = 150;

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

interface YearRow {
  readonly age: number;
  readonly partnered: boolean;
  readonly dating: boolean;
  readonly netWorth: number;
  readonly owns: boolean;
  readonly partnerPaid: boolean;
}

const SAMPLES: GameState[] = [];
const FINALS: GameState[] = [];

function live(seed: string): readonly YearRow[] {
  let state: GameState = createNewGame({ seed });
  const rows: YearRow[] = [];
  let guard = 0;
  while (state.player.alive && (guard += 1) < 110) {
    state = answerEverything(advanceYear(state).state);
    const age = state.player.age;
    if (age < 18) continue;
    const household = householdPartnerOf(state.circle.people);
    if (household && (age === 30 || age === 45 || age === 56)) SAMPLES.push(state);
    rows.push({
      age,
      partnered: household !== undefined,
      dating: household === undefined && partnerOf(state.circle.people) !== undefined,
      netWorth:
        (Number(state.player.cash) +
          Number(portfolioWorth(state.prices, state.portfolio)) +
          Number(homesValue(state.homes)) -
          Number(totalOwed(state.cards)) -
          Number(totalBorrowed(state.loans)) -
          Number(mortgagesOwed(state.homes))) /
        100,
      owns: state.homes.length > 0,
      partnerPaid: state.finance.transactions.some(
        (entry) => entry.year === state.world.year && entry.category === 'partner',
      ),
    });
  }
  FINALS.push(state);
  return rows;
}

const ALL = Array.from({ length: LIVES }, (_, i) => live(`household-${i}`)).flat();
const between = (from: number, to: number) => ALL.filter((row) => row.age >= from && row.age <= to);
const share = (rows: readonly YearRow[], of: (row: YearRow) => boolean) =>
  rows.length === 0 ? 0 : rows.filter(of).length / rows.length;
const median = (xs: readonly number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

describe('0502 — a household of two', () => {
  it('has a partner who brings money home in most working years', () => {
    const working = between(25, 61).filter((row) => row.partnered);
    const paid = share(working, (row) => row.partnerPaid);
    console.log(`partnered years 25-61 with a partner's pay: ${(paid * 100).toFixed(0)}%`);
    // From an exact zero. About 82% of married adults of working age work.
    expect(paid, 'a partner never earns anything').toBeGreaterThan(0.6);
    expect(paid, 'every partner works every year').toBeLessThan(0.95);
  });

  it('no longer makes a couple poorer than somebody alone', () => {
    /*
      THE CLAIM THE TICKET IS FOR. Set against measured noise (CORE_RULES
      13.81): two disjoint sets of 150 lives read a partnered-to-single median
      ratio at 55–64 of 0.30 and 0.18 with the partner's pay switched off, and
      0.98 and 1.04 with it; the partnered median itself $35,000 and $34,000
      off, $275,000 and $352,000 on.
    */
    const late = between(55, 64);
    const together = median(late.filter((row) => row.partnered).map((row) => row.netWorth));
    const alone = median(late.filter((row) => !row.partnered).map((row) => row.netWorth));
    console.log(
      `median net worth at 55-64: $${Math.round(together)} with a partner, $${Math.round(alone)} without`,
    );
    expect(
      together / Math.max(1, alone),
      'a partner still costs a life its savings',
    ).toBeGreaterThan(0.6);
    expect(together, 'a couple reaches sixty with nothing').toBeGreaterThan(150_000);
  });

  it('lets a couple buy somewhere', () => {
    // With the partner's pay switched off, 21% and 21% of partnered years at
    // 45–54 owned a home; with it, 65% and 72%. Two incomes are most of why
    // couples own and singles rent.
    const owners = share(
      between(45, 54).filter((row) => row.partnered),
      (row) => row.owns,
    );
    console.log(`partnered years at 45-54 owning a home: ${(owners * 100).toFixed(0)}%`);
    expect(owners).toBeGreaterThan(0.5);
  });

  it('charges nothing for somebody the player is only seeing', () => {
    // A date is not a household: no partner's pay and no partner's costs.
    expect(ALL.filter((row) => row.dating).every((row) => !row.partnerPaid)).toBe(true);

    /*
      And no partner's COSTS, which is the half a population cannot see. The
      same household a year on, once with the partner only being seen (and
      seen too recently for that to change this year) and once with nobody at
      all: the living bill has to be the same. Before 0502 a date cost half
      again as much as living alone.
    */
    // Compare the charged bill, not the amount paid after unrelated shortfall
    // clamping. Fix income and verify the real annual caller says single.
    const living = (state: GameState): number => {
      let charged = 0;
      const runLiving = livingPhase.runLiving;
      const phase = vi.spyOn(livingPhase, 'runLiving').mockImplementation((input) => {
        const result = runLiving({ ...input, afterTaxIncome: 40_000 });
        charged = result.transactions
          .filter((row) => row.category === 'living')
          .reduce((sum, row) => sum + Number(row.amount), 0);
        return result;
      });
      try {
        advanceYear(state);
        expect(phase).toHaveBeenCalledTimes(1);
        expect(phase.mock.calls[0]?.[0].partnered).toBe(false);
        return charged;
      } finally {
        phase.mockRestore();
      }
    };
    const late = SAMPLES.filter((sample) => sample.player.age === 56);
    expect(late.length).toBeGreaterThan(5);
    for (const state of late.slice(0, 6)) {
      const partner = householdPartnerOf(state.circle.people)!;
      const age = state.player.age;
      const dating: GameState = {
        ...state,
        circle: {
          ...state.circle,
          people: state.circle.people.map((person) =>
            person.id === partner.id
              ? { ...person, romance: { stage: 'seeing', since: age } }
              : person,
          ),
        },
      };
      const single: GameState = {
        ...state,
        circle: {
          ...state.circle,
          people: state.circle.people.map((person) => {
            if (person.id !== partner.id) return person;
            const { romance: _gone, ...rest } = person;
            return rest;
          }),
        },
      };
      expect(living(dating), partner.firstName).toBe(living(single));
    }
  });

  it('keeps the books balanced with two incomes in them', () => {
    for (const state of FINALS.slice(0, 40)) {
      expect(reconcile(state.finance).ok).toBe(true);
    }
  });

  it('posts the pay and the tax on it under the partner’s name', () => {
    const state = SAMPLES.find(
      (sample) =>
        partnerIncomeFor({
          people: sample.circle.people,
          worldYear: sample.world.year,
          childAges: [],
        }).gross > 0,
    );
    expect(state, 'no sampled partner ever worked').toBeDefined();
    const partner = householdPartnerOf(state!.circle.people)!;
    const year = partnerIncomeFor({
      people: state!.circle.people,
      worldYear: state!.world.year,
      childAges: [],
    });
    expect(year.transactions[0]!.category).toBe('partner');
    expect(year.transactions[0]!.source).toContain(partner.firstName);
    expect(Number(year.transactions[0]!.amount)).toBe(year.gross * 100);
    const tax = year.transactions.find((entry) => entry.category === 'tax');
    expect(Number(tax?.amount ?? 0)).toBe(-(year.gross - year.net) * 100);
  });

  it('stops when the partner is gone', () => {
    const state = SAMPLES[0]!;
    const people = state.circle.people.map((person) =>
      person.romance ? { ...person, alive: false } : person,
    );
    expect(partnerIncomeFor({ people, worldYear: state.world.year, childAges: [] }).net).toBe(0);
  });
});
