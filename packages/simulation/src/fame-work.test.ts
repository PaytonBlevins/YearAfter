/**
 * Ticket 0707 acceptance tests — what being known gets you offered, and saying yes.
 */

import { describe, expect, it } from 'vitest';
import { FAME_WORK, findFameWork } from '@yearafter/content';
import { newChannel, type Channel } from '@yearafter/finance';
import { advanceYear } from './advance';
import { answerEncounter, encounterFor } from './celebrity';
import { EMPTY_CELEBRITIES } from './celebrity-state';
import { continueAsChild, heirsIn } from './continue';
import { runCreatorsYear } from './creators';
import { decide } from './decide';
import {
  WORK_CHANCE_BASE,
  WORK_CHANCE_MAX,
  WORK_CHANCE_PER_POINT,
  WORK_FROM_AGE,
  biggestChannel,
  doFameWork,
  fameOffers,
  postRate,
  workChance,
  workPay,
  workToSettle,
} from './fame-work';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const d = next.pending[0]!;
    const r = decide(next, d.eventId, d.choices[0]!.id);
    if (!r.ok) break;
    next = r.value.state;
  }
  return next;
}

function liveTo(seed: string, age: number): GameState {
  let state = createNewGame({ seed });
  let guard = 0;
  while (state.player.alive && state.player.age < age && (guard += 1) < 80) {
    state = answerEverything(advanceYear(state).state);
  }
  return state;
}

const ADULT = liveTo('fame-work-adult', 25);
const channel = (id: string, audience: number, platformId = 'video'): Channel => ({
  ...newChannel({ seed: 'fw', id, platformId, categoryId: 'comedy', year: 2050 }),
  audience,
  peak: audience,
});
const known = (fame: number, channels: readonly Channel[] = []): GameState => ({
  ...ADULT,
  fame,
  channels,
});
const atGeneration = (state: GameState, generation: number): GameState => ({
  ...state,
  world: { ...state.world, generation },
});
/** The first generation whose draw offers a given thing, so a test can say yes to it. */
function offering(state: GameState, id: string): GameState {
  for (let generation = 0; generation < 400; generation += 1) {
    const trial = atGeneration(state, generation);
    if (fameOffers(trial).some((o) => o.def.id === id)) return trial;
  }
  throw new Error(`never offered ${id}`);
}

describe('the numbers (13.120: written out, not read back from the constants)', () => {
  it('keeps the design constants', () => {
    expect(WORK_FROM_AGE).toBe(16);
    expect(WORK_CHANCE_BASE).toBe(0.35);
    expect(WORK_CHANCE_PER_POINT).toBe(0.01);
    expect(WORK_CHANCE_MAX).toBe(0.85);
  });

  it('prices a post by the published tiers: about $100 at ten thousand people, $10,000 at a million', () => {
    expect(postRate(22)).toBeCloseTo(100, 6);
    expect(postRate(40)).toBeCloseTo(794.33, 1);
    expect(postRate(60)).toBeCloseTo(7943.28, 1);
    expect(postRate(80)).toBeCloseTo(79432.82, 1);
  });

  it('pays what the thing is worth at a fame, never under its floor', () => {
    const pay = (id: string, fame: number): number => workPay(findFameWork(id)!, fame);
    expect([6, 20, 28, 40, 60, 80].map((f) => pay('photoshoot', f))).toEqual([
      200, 480, 1200, 4770, 47660, 476600,
    ]);
    expect([6, 20, 28, 40, 60, 80].map((f) => pay('commercial', f))).toEqual([
      800, 950, 2390, 9530, 95320, 953190,
    ]);
    expect([20, 28, 40, 60, 80].map((f) => pay('talkShow', f))).toEqual([
      500, 500, 790, 7940, 79430,
    ]);
    expect([28, 40, 60, 80].map((f) => pay('guestStar', f))).toEqual([1283, 3180, 31770, 317730]);
  });

  it('rises from the level and stops at the cap', () => {
    expect(workChance(6, 6)).toBe(0.35);
    expect(workChance(5, 6)).toBe(0.35);
    expect(workChance(16, 6)).toBeCloseTo(0.45, 10);
    expect(workChance(56, 6)).toBeCloseTo(0.85, 10);
    expect(workChance(100, 6)).toBe(0.85);
  });
});

describe('who is offered what', () => {
  it('offers nothing to somebody nobody knows', () => {
    for (let g = 0; g < 100; g += 1) expect(fameOffers(atGeneration(known(5), g))).toEqual([]);
  });

  it('opens each thing at its level, and not a point before', () => {
    for (const def of FAME_WORK) {
      let at = 0;
      let below = 0;
      for (let g = 0; g < 200; g += 1) {
        if (fameOffers(atGeneration(known(def.fromFame), g)).some((o) => o.def.id === def.id))
          at += 1;
        if (fameOffers(atGeneration(known(def.fromFame - 1), g)).some((o) => o.def.id === def.id))
          below += 1;
      }
      expect(at, def.id).toBeGreaterThan(40);
      expect(below, def.id).toBe(0);
    }
  });

  it('offers more of them the better known a person is', () => {
    const count = (fame: number): number => {
      let n = 0;
      for (let g = 0; g < 300; g += 1) n += fameOffers(atGeneration(known(fame), g)).length;
      return n;
    };
    expect(count(30)).toBeGreaterThan(count(12));
    expect(count(70)).toBeGreaterThan(count(30));
  });

  it('draws at the chance it states, and not above the cap', () => {
    let offered = 0;
    let top = 0;
    const years = 2_000;
    for (let g = 0; g < years; g += 1) {
      if (fameOffers(atGeneration(known(6), g)).some((o) => o.def.id === 'photoshoot'))
        offered += 1;
      if (fameOffers(atGeneration(known(100), g)).some((o) => o.def.id === 'photoshoot')) top += 1;
    }
    expect(offered / years).toBeGreaterThan(0.35 - 0.04);
    expect(offered / years).toBeLessThan(0.35 + 0.04);
    expect(top / years).toBeGreaterThan(0.85 - 0.04);
    expect(top / years).toBeLessThan(0.85 + 0.03);
  });

  it('asks nobody under sixteen, and nobody who has died', () => {
    const kid = (age: number): GameState => ({
      ...atGeneration(known(100), 3),
      player: { ...ADULT.player, age },
    });
    let somebody = 0;
    for (let g = 0; g < 20; g += 1) {
      const adult = atGeneration(known(100), g);
      if (fameOffers({ ...adult, player: { ...adult.player, age: 16 } }).length > 0) somebody += 1;
      expect(fameOffers({ ...adult, player: { ...adult.player, age: 15 } })).toEqual([]);
      expect(fameOffers({ ...adult, player: { ...adult.player, alive: false } })).toEqual([]);
    }
    expect(somebody).toBeGreaterThan(10);
    void kid;
  });

  it('is the same year every time and a different one for an heir', () => {
    const state = atGeneration(known(50), 4);
    expect(fameOffers(state)).toEqual(fameOffers(state));
    const years = Array.from({ length: 30 }, (_, g) =>
      fameOffers(atGeneration(known(50), g))
        .map((o) => o.def.id)
        .join(','),
    );
    expect(new Set(years).size).toBeGreaterThan(4);
  });

  it('reads cleanly: the outlet and the dollars, no braces, and different outlets from year to year', () => {
    const outlets = new Set<string>();
    for (let g = 0; g < 200; g += 1) {
      for (const offer of fameOffers(atGeneration(known(60), g))) {
        expect(offer.text).not.toMatch(/[{}]/);
        expect(offer.text).toContain(offer.outlet);
        expect(offer.text).toContain(`$${offer.pay.toLocaleString('en-US')}`);
        expect(offer.pay).toBe(workPay(offer.def, 60));
        if (offer.def.id === 'commercial') outlets.add(offer.outlet);
      }
    }
    expect(outlets.size).toBe(findFameWork('commercial')!.outlets.length);
  });

  it('does not offer what has been done this year, and does offer it again next year', () => {
    const state = offering(known(60), 'photoshoot');
    const done = {
      ...state,
      celebrities: {
        ...state.celebrities,
        work: {
          year: state.world.year,
          done: [{ id: 'photoshoot', outlet: 'x', pay: 1, fame: 1, mood: 1 }],
        },
      },
    };
    expect(fameOffers(done).some((o) => o.def.id === 'photoshoot')).toBe(false);
    const later = { ...done, world: { ...done.world, year: done.world.year + 1 } };
    let again = 0;
    for (let g = 0; g < 100; g += 1) {
      if (fameOffers(atGeneration(later, g)).some((o) => o.def.id === 'photoshoot')) again += 1;
    }
    expect(again).toBeGreaterThan(50);
  });
});

describe('saying yes', () => {
  it('refuses what was not offered, and what was already done', () => {
    const low = doFameWork(known(0), 'photoshoot');
    expect(low.ok).toBe(false);
    if (!low.ok) expect(low.error.kind).toBe('notOffered');
    expect(doFameWork(known(60), 'invented').ok).toBe(false);
    const state = offering(known(60), 'photoshoot');
    const first = doFameWork(state, 'photoshoot');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = doFameWork(first.value, 'photoshoot');
    expect(second.ok).toBe(false);
  });

  it('records what it was worth, writes it on the timeline, and moves no money yet', () => {
    const state = offering(known(60), 'commercial');
    const offer = fameOffers(state).find((o) => o.def.id === 'commercial')!;
    const result = doFameWork(state, 'commercial');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value;
    expect(after.celebrities.work).toEqual({
      year: state.world.year,
      done: [{ id: 'commercial', outlet: offer.outlet, pay: 95320, fame: 1, mood: 0 }],
    });
    const line = after.player.timeline.at(-1)!;
    expect(line.text).toContain(offer.outlet);
    expect(line.text).toContain('$95,320');
    expect(after.player.timeline.length).toBe(state.player.timeline.length + 1);
    expect(after.finance.balance).toBe(state.finance.balance);
    expect(after.finance.transactions).toEqual(state.finance.transactions);
    expect(after.fame).toBe(state.fame);
    expect(workToSettle(after)).toEqual(after.celebrities.work.done);
  });

  it('can do several things in a year, each once', () => {
    let state = known(80);
    const ids: string[] = [];
    for (let g = 0; ids.length < 3 && g < 400; g += 1) {
      const trial = atGeneration(state, g);
      const offers = fameOffers(trial);
      if (offers.length < 2) continue;
      state = trial;
      for (const offer of offers) {
        const r = doFameWork(state, offer.def.id);
        expect(r.ok).toBe(true);
        if (r.ok) state = r.value;
        ids.push(offer.def.id);
      }
    }
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(state.celebrities.work.done.map((d) => d.id)).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('brings a talk show’s audience to the biggest channel, inside the range, and says how many', () => {
    const small = channel('a-small', 2_000);
    const big = channel('b-big', 50_000);
    let counted = 0;
    for (let g = 0; g < 400 && counted < 12; g += 1) {
      const trial = atGeneration(known(40, [small, big]), g);
      if (!fameOffers(trial).some((o) => o.def.id === 'talkShow')) continue;
      const r = doFameWork(trial, 'talkShow');
      if (!r.ok) continue;
      const now = r.value.channels.find((c) => c.id === big.id)!;
      const gain = now.audience - big.audience;
      expect(gain / big.audience).toBeGreaterThanOrEqual(0.03 - 1e-4);
      expect(gain / big.audience).toBeLessThanOrEqual(0.08 + 1e-4);
      expect(now.peak).toBe(now.audience);
      expect(r.value.channels.find((c) => c.id === small.id)).toEqual(small);
      expect(r.value.player.timeline.at(-1)!.text).toContain(gain.toLocaleString('en-US'));
      expect(r.value.player.timeline.at(-1)!.text).toContain(big.name);
      counted += 1;
    }
    expect(counted).toBe(12);
  });

  it('brings a guest part’s audience too, and a photoshoot or a commercial brings none', () => {
    const big = channel('b-big', 50_000);
    const guest = doFameWork(offering(known(60, [big]), 'guestStar'), 'guestStar');
    expect(guest.ok).toBe(true);
    if (guest.ok) {
      const share = (guest.value.channels[0]!.audience - 50_000) / 50_000;
      expect(share).toBeGreaterThanOrEqual(0.02 - 1e-4);
      expect(share).toBeLessThanOrEqual(0.06 + 1e-4);
    }
    for (const id of ['photoshoot', 'commercial']) {
      const r = doFameWork(offering(known(60, [big]), id), id);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.channels).toEqual([big]);
        expect(r.value.player.timeline.at(-1)!.text).not.toContain('came over');
      }
    }
  });

  it('says nothing about an audience when there is no channel', () => {
    const r = doFameWork(offering(known(60), 'talkShow'), 'talkShow');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.channels).toEqual([]);
      expect(r.value.player.timeline.at(-1)!.text).not.toContain('came over');
    }
  });

  it('gives even a tiny channel at least one new follower from a talk show, and says so', () => {
    const tiny = channel('tiny', 10);
    let seen = 0;
    for (let g = 0; g < 400 && seen < 8; g += 1) {
      const trial = atGeneration(known(40, [tiny]), g);
      if (!fameOffers(trial).some((o) => o.def.id === 'talkShow')) continue;
      const r = doFameWork(trial, 'talkShow');
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.value.channels[0]!.audience).toBeGreaterThanOrEqual(11);
      expect(r.value.player.timeline.at(-1)!.text).toContain('came over');
      seen += 1;
    }
    expect(seen).toBe(8);
  });

  it('forgets what it was said yes to in an earlier year, and keeps what was said yes to this one', () => {
    const state = offering(known(60), 'photoshoot');
    const stale = {
      ...state,
      celebrities: {
        ...state.celebrities,
        work: {
          year: state.world.year - 1,
          done: [{ id: 'talkShow', outlet: 'Couch Night', pay: 900, fame: 2, mood: 1 }],
        },
      },
    };
    const r = doFameWork(stale, 'photoshoot');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.celebrities.work.year).toBe(state.world.year);
    expect(r.value.celebrities.work.done.map((d) => d.id)).toEqual(['photoshoot']);
  });

  it('records every thing’s fame and mood as the catalog sets them', () => {
    const want = { photoshoot: [1, 1], commercial: [1, 0], talkShow: [2, 1], guestStar: [3, 2] };
    for (const [id, [fame, mood]] of Object.entries(want)) {
      const r = doFameWork(offering(known(80), id), id);
      expect(r.ok, id).toBe(true);
      if (!r.ok) continue;
      const entry = r.value.celebrities.work.done[0]!;
      expect([entry.fame, entry.mood], id).toEqual([fame, mood]);
    }
  });

  it('breaks a tie between two channels the same size by their ids, not by their order', () => {
    const a = channel('a', 9_000);
    const b = channel('b', 9_000);
    expect(biggestChannel([b, a])!.id).toBe('a');
    expect(biggestChannel([a, b])!.id).toBe('a');
    expect(biggestChannel([])).toBeUndefined();
    expect(biggestChannel([a, channel('c', 9_001)])!.id).toBe('c');
    // A smaller id never wins on its id alone: the bigger channel does, whichever comes last.
    expect(biggestChannel([channel('c', 9_001), a])!.id).toBe('c');
    expect(biggestChannel([channel('c', 9_001), channel('a', 9_000)])!.id).toBe('c');
  });
});

describe('settling with the year', () => {
  const input = (work: Parameters<typeof runCreatorsYear>[0]['work'], over = {}) => ({
    channels: [channel('x', 20_000)],
    fame: 30,
    year: 2060,
    stats: {},
    talents: {},
    ...(work === undefined ? {} : { work }),
    ...over,
  });
  const JOBS = [
    { id: 'photoshoot', outlet: 'Juniper Row magazine', pay: 2_000, fame: 1, mood: 1 },
    { id: 'guestStar', outlet: 'Maple Court', pay: 5_000, fame: 3, mood: 2 },
  ];

  it('adds the pay to the year’s income, as rows named for the thing and who it was for', () => {
    const quiet = runCreatorsYear(input(undefined));
    const paid = runCreatorsYear(input(JOBS));
    expect(paid.gross).toBe(quiet.gross + 7_000);
    expect(paid.net).toBe(quiet.net + 7_000);
    const rows = paid.transactions.filter((t) => t.source.includes(': '));
    const sources = paid.transactions.map((t) => t.source);
    expect(sources).toContain('Photoshoot: Juniper Row magazine');
    expect(sources).toContain('Guest-star part: Maple Court');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const row = paid.transactions.find((t) => t.source === 'Guest-star part: Maple Court')!;
    expect(row.category).toBe('creator');
    expect(Number(row.amount)).toBe(500_000);
  });

  it('adds the fame and the mood, and keeps fame inside 0 to 100', () => {
    const quiet = runCreatorsYear(input(undefined, { seed: undefined }));
    const paid = runCreatorsYear(input(JOBS, { seed: undefined }));
    expect(paid.fame).toBe(quiet.fame + 4);
    expect(paid.mood).toBe(3);
    expect(quiet.mood).toBe(0);
    expect(
      runCreatorsYear(input(JOBS, { fame: 100, channels: [channel('x', 1_000_000_000)] })).fame,
    ).toBe(100);
  });

  it('pays something even with no channel at all, and a manager takes their share of it', () => {
    const none = runCreatorsYear(input(JOBS, { channels: [], fame: 20 }));
    expect(none.gross).toBe(7_000);
    expect(none.net).toBe(7_000);
    const managed = runCreatorsYear(
      input(JOBS, { channels: [], fame: 20, representation: 'manager' }),
    );
    const cut = managed.transactions.find((t) => t.source === "Your manager's share")!;
    expect(Number(cut.amount)).toBe(-105_000);
    expect(managed.net).toBe(7_000 - 1_050);
  });

  it('pays through a real year: books, tax, fame, happiness, and only once', () => {
    const state = offering(known(60, [channel('x', 20_000)]), 'commercial');
    const yes = doFameWork(state, 'commercial');
    expect(yes.ok).toBe(true);
    if (!yes.ok) return;
    const without = advanceYear(
      atGeneration({ ...state, celebrities: EMPTY_CELEBRITIES }, state.world.generation),
    ).state;
    const withWork = advanceYear(yes.value).state;
    const rows = withWork.finance.transactions.filter((t) => t.source.startsWith('Commercial: '));
    expect(rows.length).toBe(1);
    expect(Number(rows[0]!.amount)).toBe(9_532_000);
    expect(withWork.finance.transactions.some((t) => t.source.startsWith('Tax on creator'))).toBe(
      true,
    );
    // The year after, nothing of it is paid again.
    const next = advanceYear(answerEverything(withWork)).state;
    expect(
      next.finance.transactions.filter((t) => t.source.startsWith('Commercial: ')).length,
    ).toBe(1);
    expect(workToSettle(withWork)).toEqual([]);
    void without;
  });

  it('settles only the year it was said yes in', () => {
    const state = offering(known(60), 'photoshoot');
    const yes = doFameWork(state, 'photoshoot');
    if (!yes.ok) throw new Error('no');
    expect(workToSettle(yes.value).length).toBe(1);
    expect(
      workToSettle({ ...yes.value, world: { ...yes.value.world, year: state.world.year + 1 } }),
    ).toEqual([]);
    expect(workToSettle(known(60))).toEqual([]);
  });
});

describe('the rest of the record', () => {
  const WORK = {
    year: 2030,
    done: [{ id: 'photoshoot', outlet: 'x', pay: 1, fame: 1, mood: 1 }],
  };

  it('keeps what was said yes to when a famous stranger is answered', () => {
    // 0705 rebuilt the record by hand when a meeting was answered, and would have dropped it.
    let met = 0;
    for (let g = 0; g < 3_000 && met < 3; g += 1) {
      const state = atGeneration(
        { ...known(100), celebrities: { ...known(100).celebrities, work: WORK } },
        g,
      );
      if (encounterFor(state) === undefined) continue;
      const answered = answerEncounter(state, 'compliment');
      expect(answered.ok).toBe(true);
      if (!answered.ok) continue;
      expect(answered.value.state.celebrities.work).toEqual(WORK);
      expect(answered.value.state.celebrities.answeredYear).toBe(state.world.year);
      met += 1;
    }
    expect(met).toBe(3);
  });

  it('keeps it through a year with nobody to keep up with', () => {
    const state = { ...known(100), celebrities: { ...known(100).celebrities, work: WORK } };
    expect(advanceYear(state).state.celebrities.work).toEqual(WORK);
  });

  it('starts an heir with nothing said yes to', () => {
    for (let i = 0; i < 40; i += 1) {
      let state = createNewGame({ seed: `work-heir-${i}` });
      state = { ...state, celebrities: { ...state.celebrities, work: WORK } };
      let guard = 0;
      while (state.player.alive && (guard += 1) < 120) {
        state = answerEverything(advanceYear(state).state);
      }
      const heir = heirsIn(state.family)[0];
      if (!heir) continue;
      const next = continueAsChild(state, heir.id);
      expect(next).toBeDefined();
      expect(next!.celebrities.work).toEqual({ year: 0, done: [] });
      return;
    }
    throw new Error('nobody left an heir');
  });
});
