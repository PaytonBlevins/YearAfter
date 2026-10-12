/**
 * Ticket 0807 — the one wire that is a sum of other people's pay: modeling is taxed on top of everything else earned
 * in the year. A finished life cannot show which term went missing (a business, a channel, a pro contract, a part and a
 * record are five very different lives to set up), so the five producers are replaced here by themselves plus a fixed amount, one at
 * a time, over a life with no job. The tax on the modeling pay must be the tax over exactly that amount.
 */

import { describe, expect, it, vi } from 'vitest';

const forced = vi.hoisted(() => ({ business: 0, creators: 0, sports: 0, acting: 0, music: 0 }));

vi.mock('./businesses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./businesses')>();
  return {
    ...actual,
    runBusinessesYear: (input: Parameters<typeof actual.runBusinessesYear>[0]) => {
      const year = actual.runBusinessesYear(input);
      return { ...year, drawn: year.drawn + forced.business };
    },
  };
});

vi.mock('./creators', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./creators')>();
  return {
    ...actual,
    runCreatorsYear: (input: Parameters<typeof actual.runCreatorsYear>[0]) => {
      const year = actual.runCreatorsYear(input);
      return { ...year, net: year.net + forced.creators };
    },
  };
});

vi.mock('./acting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./acting')>();
  return {
    ...actual,
    runActingYear: (input: Parameters<typeof actual.runActingYear>[0]) => {
      const year = actual.runActingYear(input);
      return { ...year, pay: year.pay + forced.acting };
    },
  };
});

vi.mock('./music', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./music')>();
  return {
    ...actual,
    runMusicYear: (input: Parameters<typeof actual.runMusicYear>[0]) => {
      const year = actual.runMusicYear(input);
      return { ...year, pay: year.pay + forced.music };
    },
  };
});

vi.mock('./sports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sports')>();
  return {
    ...actual,
    runSportsYear: (input: Parameters<typeof actual.runSportsYear>[0]) => {
      const year = actual.runSportsYear(input);
      return { ...year, pay: year.pay + forced.sports };
    },
  };
});

import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { businessTaxOn } from './businesses';
import { MODELING_OFFER_EVENT_ID } from './modeling';
import { EMPTY_MODELING, type BookedJob } from './modeling-state';
import { createNewGame } from './new-game';

function answerOthers(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending.find((row) => row.eventId !== MODELING_OFFER_EVENT_ID);
    const choice =
      open?.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : open?.choices[0];
    if (!open || !choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

const job: BookedJob = {
  id: '25:0',
  tier: 'catalogue',
  placement: 'featured',
  medium: 'a catalogue shoot',
  client: 'Calloway Outfitters',
  rate: 2_000,
  days: 10,
  usage: 0,
  age: 25,
  bookedAge: 25,
};

/** A grown-up with no job, no business and nothing else to earn, and a model with one job to shoot. */
function model(): GameState {
  let state = createNewGame({ seed: 'tax-wire' });
  for (let guard = 0; guard < 40 && state.player.age < 26; guard += 1) {
    state = answerOthers(advanceYear(answerOthers(state)).state);
  }
  const amount = 50_000;
  const books = {
    ...state.finance,
    balance: (Number(state.finance.balance) + amount * 100) as never,
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:test-tax`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: (amount * 100) as never,
        source: 'A test windfall',
      },
    ],
  };
  return {
    ...state,
    employment: { ...state.employment, job: undefined },
    finance: books,
    player: { ...state.player, cash: books.balance },
    modeling: { ...EMPTY_MODELING, craft: 80, credits: 3, tier: 'catalogue', booked: [job] },
  };
}

describe('the tax on modeling pay', () => {
  const taxWith = (patch: Partial<typeof forced>) => {
    Object.assign(forced, { business: 0, creators: 0, sports: 0, acting: 0, music: 0 }, patch);
    try {
      const next = advanceYear(answerOthers(model())).state;
      const row = next.finance.transactions.find(
        (entry) => entry.year === next.world.year && entry.source === 'Tax on modeling pay',
      );
      return row === undefined ? 0 : -Number(row.amount) / 100;
    } finally {
      Object.assign(forced, { business: 0, creators: 0, sports: 0, acting: 0, music: 0 });
    }
  };

  it('is the tax on twenty thousand over nothing else', () => {
    expect(taxWith({})).toBe(businessTaxOn(0, 20_000));
  });

  it.each([
    ['a business’s draw', { business: 60_000 }],
    ['a channel’s net', { creators: 60_000 }],
    ['a pro contract', { sports: 60_000 }],
    ['a part on screen', { acting: 60_000 }],
    ['a record', { music: 60_000 }],
  ] as const)('is taxed over %s as well', (_label, patch) => {
    const tax = taxWith(patch);
    expect(tax).toBe(businessTaxOn(60_000, 20_000));
    expect(tax).toBeGreaterThan(businessTaxOn(0, 20_000));
  });
});
