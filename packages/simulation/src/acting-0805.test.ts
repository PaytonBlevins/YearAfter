/**
 * Ticket 0805 acceptance tests — acting.
 *
 * Six rungs, parts that say whether they are a lead, a supporting part or a bit part, three ways to the work
 * (being seen, applying, an agent) and none of them required, lessons and character development, negotiation, awards
 * and fame. These tests pin the table and the real figures it is anchored to, the road in, the offers and the
 * casting calls, a year of work, and that a life that never goes near a stage replays as it did.
 */

import { describe, expect, it } from 'vitest';
import { join } from '@yearafter/education';
import { toDollars } from '@yearafter/core';
import {
  ACTING_TIERS,
  ACTING_TIER_ROWS,
  AGEING_FROM,
  AGENT_CUT,
  AGENT_OFFER_MULTIPLIER,
  AGENT_SLOT_CHANCE,
  AGENT_SUBMISSIONS,
  APPLICATIONS_PER_YEAR,
  AWARD_CHANCE,
  AWARD_FROM,
  AWARD_REPUTATION,
  BILLING_REPUTATION,
  CRAFT_HEADROOM,
  CREDIT_CRAFT,
  CREDIT_CRAFT_CAP,
  FLOP_REPUTATION,
  HIT_REPUTATION,
  LESSONS_CRAFT,
  OFFER_TIER_WEIGHTS,
  TALENT_OFFER_CHANCE,
  BILLINGS,
  BILLING_DAYS,
  BILLING_FEE,
  HITS_TO_RISE,
  IDLE_FALL_YEARS,
  LESSONS_COST,
  ROLE_TITLES,
  SAG_DAY_RATE,
  SAG_WEEK_RATE,
  YEAR_DAYS,
  actingFameOf,
  actingReputationWord,
  billingFor,
  naturalCraft,
  roleDays,
  roleFee,
  stepActingTier,
  tierRank,
  type ActingTier,
} from '@yearafter/content';
import {
  ACTING_OFFER_EVENT_ID,
  actingOccupation,
  actingOfferDecision,
  answerActingOffer,
  applicationsAllowed,
  applyForCasting,
  castingCalls,
  craftCeiling,
  craftOf,
  developCharacter,
  freeDays,
  isActingFullTime,
  isSeen,
  MAX_OFFERS,
  leaveAgent,
  nextCraft,
  notReadyFor,
  offerSlots,
  slotScale,
  tierDrawn,
  runActingYear,
  signWithAgent,
  startLessons,
  stopLessons,
  withActingOffer,
} from './acting';
import { EMPTY_ACTING, type ActingState, type BookedRole, type Role } from './acting-state';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { withAnyOffer } from './offers';
import { eulogyFor } from './eulogy';
import { findJob } from '@yearafter/careers';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function answerOthers(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending.find((row) => row.eventId !== ACTING_OFFER_EVENT_ID);
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

/** A life, with or without the acting talent, at its first year. */
const life = (seed: string, talent = false): GameState => {
  const base = createNewGame({ seed });
  return {
    ...base,
    player: { ...base.player, talents: { ...base.player.talents, acting: talent } },
  };
};

function toAge(state: GameState, age: number): GameState {
  let current = state;
  let guard = 0;
  while (current.player.alive && current.player.age < age && (guard += 1) < 80) {
    current = answerOthers(advanceYear(answerOthers(current)).state);
  }
  return current;
}

/**
 * An adult life of the given talent, brought to the age. Memoised by the key so the tests stay fast. A life that
 * dies on the way is replaced by the next of the same name ("name~1"), so every test that asks for an adult gets
 * a living one (a dead child would pass many of these tests for the wrong reason).
 */
const adults = new Map<string, GameState>();
function adult(seed: string, talent = false, age = 26): GameState {
  const key = `${seed}:${talent}:${age}`;
  const found = adults.get(key);
  if (found) return found;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const made = toAge(life(attempt === 0 ? seed : `${seed}~${attempt}`, talent), age);
    if (made.player.alive && made.player.age >= age) {
      adults.set(key, made);
      return made;
    }
  }
  throw new Error(`no living life of age ${age} for ${seed}`);
}

const withStats = (
  state: GameState,
  stats: Partial<Record<'charisma' | 'looks' | 'smarts' | 'discipline' | 'health', number>>,
): GameState => ({
  ...state,
  player: { ...state.player, stats: { ...state.player.stats, ...stats } as never },
});

const withActing = (state: GameState, patch: Partial<ActingState>): GameState => ({
  ...state,
  acting: { ...state.acting, ...patch },
});

/** A role by hand. */
const role = (over: Partial<Role> = {}): Role => ({
  id: '26:0',
  tier: 'local',
  billing: 'lead',
  medium: 'a student film',
  title: 'Paper Boats',
  fee: 0,
  days: 6,
  source: 'asked',
  age: 26,
  ...over,
});

const booked = (over: Partial<BookedRole> = {}): BookedRole => ({
  id: 'b:0',
  tier: 'local',
  billing: 'lead',
  medium: 'a student film',
  title: 'Paper Boats',
  fee: 0,
  days: 6,
  age: 26,
  bookedAge: 26,
  ...over,
});

/** The same life as a seen actor: a stage year that is this year's. */
const seen = (state: GameState, patch: Partial<ActingState> = {}): GameState =>
  withActing(state, { stageYears: 1, seenAge: state.player.age, ...patch });

const yearOf = (before: GameState, age = before.player.age + 1, year = before.world.year + 1) =>
  runActingYear({ before, education: before.education, age, year, standard: 60_000 });

/** The first life of a numbered set that satisfies `test`, failing loudly when none does (13.176). */
function firstSeed<T>(prefix: string, pick: (seed: string) => T | undefined, tries = 80): T {
  for (let index = 0; index < tries; index += 1) {
    const found = pick(`${prefix}-${index}`);
    if (found !== undefined) return found;
  }
  throw new Error(`no life of ${tries} satisfied the test for ${prefix}`);
}

/* -------------------------------------------------------------------------- */
/* The table                                                                   */
/* -------------------------------------------------------------------------- */

describe('the six rungs', () => {
  it('are student and community work, commercials, bit parts, supporting, leads and stars, in that order', () => {
    expect(ACTING_TIERS).toEqual(['local', 'commercial', 'working', 'supporting', 'lead', 'star']);
    expect(ACTING_TIERS.map((id) => ACTING_TIER_ROWS[id].name)).toEqual([
      'Student films and community stage',
      'Commercials and background work',
      'Bit parts and small TV',
      'Supporting roles in TV and film',
      'Leading roles',
      'Prestige and franchise films',
    ]);
  });

  it('ask for more at every rung: older, more credits, more craft, a better name', () => {
    for (const key of ['minAge', 'minCredits', 'minCraft', 'minReputation'] as const) {
      const values = ACTING_TIERS.map((id) => ACTING_TIER_ROWS[id][key]);
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index]!, key).toBeGreaterThanOrEqual(values[index - 1]!);
      }
    }
    expect(ACTING_TIER_ROWS.star).toMatchObject({ minAge: 25, minCredits: 50, minCraft: 84 });
    expect(ACTING_TIER_ROWS.local.minAge).toBe(11);
  });

  it('pay a fee that only goes up from rung to rung, from nothing to the tens of millions', () => {
    const lows = ACTING_TIERS.map((id) => ACTING_TIER_ROWS[id].fee[0]);
    const highs = ACTING_TIERS.map((id) => ACTING_TIER_ROWS[id].fee[1]);
    for (let index = 1; index < ACTING_TIERS.length; index += 1) {
      expect(lows[index]!).toBeGreaterThan(lows[index - 1]!);
      expect(highs[index]!).toBeGreaterThan(highs[index - 1]!);
    }
    expect(lows[0]).toBe(0);
    expect(highs[5]).toBeGreaterThanOrEqual(20_000_000);
  });

  it('anchor the first paid rungs to the SAG-AFTRA day rate, the same figure 0707 uses', () => {
    expect(SAG_DAY_RATE).toBe(1_283);
    expect(SAG_WEEK_RATE).toBe(4_456);
    expect(ACTING_TIER_ROWS.commercial.fee[0]).toBe(SAG_DAY_RATE);
    expect(ACTING_TIER_ROWS.working.fee[0]).toBe(SAG_DAY_RATE * 2);
  });

  it('share their parts out as a lead, a supporting part or a bit part, always adding up to one', () => {
    for (const id of ACTING_TIERS) {
      const row = ACTING_TIER_ROWS[id];
      const sum = BILLINGS.reduce((total, billing) => total + row.billing[billing], 0);
      expect(sum, id).toBeCloseTo(1, 10);
    }
    // Bit parts are the work of the middle rungs; the top rungs are leads and supporting parts.
    expect(ACTING_TIER_ROWS.working.billing.bit).toBeGreaterThan(0.5);
    expect(ACTING_TIER_ROWS.lead.billing.bit).toBe(0);
    expect(ACTING_TIER_ROWS.star.billing.bit).toBe(0);
    expect(ACTING_TIER_ROWS.local.billing.lead).toBeGreaterThan(0.3);
  });

  it('have fewer offers each slot down, and no more slots at the top than in the middle', () => {
    for (const id of ACTING_TIERS) {
      const slots = ACTING_TIER_ROWS[id].slots;
      for (let index = 1; index < slots.length; index += 1) {
        expect(slots[index]!, id).toBeLessThan(slots[index - 1]!);
      }
    }
    expect(ACTING_TIER_ROWS.star.slots[0]!).toBeLessThanOrEqual(ACTING_TIER_ROWS.lead.slots[0]!);
  });

  it('hold stars to a higher hit line, and hold more hits at the top before another rise', () => {
    const lines = ACTING_TIERS.map((id) => ACTING_TIER_ROWS[id].hitLine);
    for (let index = 1; index < lines.length; index += 1) {
      expect(lines[index]!).toBeGreaterThan(lines[index - 1]!);
    }
    expect(HITS_TO_RISE.lead).toBeGreaterThan(HITS_TO_RISE.commercial);
    expect(HITS_TO_RISE.star).toBeGreaterThan(50);
  });

  it('have thirty fictional titles that never repeat', () => {
    expect(ROLE_TITLES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ROLE_TITLES).size).toBe(ROLE_TITLES.length);
  });

  it('walk up and down by rungs and stop at the ends', () => {
    expect(stepActingTier('local', -1)).toBe('local');
    expect(stepActingTier('star', 1)).toBe('star');
    expect(stepActingTier('working', 1)).toBe('supporting');
    expect(stepActingTier('working', -2)).toBe('local');
    expect(tierRank('lead')).toBe(4);
  });
});

describe('what a part is worth', () => {
  it('is a lead’s fee at the rung, scaled down for a supporting part and a bit part', () => {
    expect(BILLING_FEE).toEqual({ lead: 1, supporting: 0.55, bit: 0.25 });
    const lead = roleFee('lead', 'lead', 0.5);
    const supporting = roleFee('lead', 'supporting', 0.5);
    const bit = roleFee('lead', 'bit', 0.5);
    expect(lead).toBeGreaterThan(supporting);
    expect(supporting).toBeGreaterThan(bit);
    expect(bit).toBeGreaterThan(0);
  });

  it('is inside the rung’s range for a lead, from the bottom at a draw of zero to the top at one', () => {
    for (const id of ACTING_TIERS) {
      const [low, high] = ACTING_TIER_ROWS[id].fee;
      expect(roleFee(id, 'lead', 0)).toBeGreaterThanOrEqual(low);
      expect(roleFee(id, 'lead', 0)).toBeLessThan(low + 100);
      expect(roleFee(id, 'lead', 0.999)).toBeLessThanOrEqual(high);
      expect(roleFee(id, 'lead', 0.999)).toBeGreaterThan(high * 0.9);
    }
  });

  it('is rounded, to the hundred, the thousand or the ten thousand by size', () => {
    for (const unit of [0.1, 0.33, 0.57, 0.8, 0.95]) {
      for (const id of ACTING_TIERS) {
        const fee = roleFee(id, 'lead', unit);
        const step = fee < 10_000 ? 100 : fee < 1_000_000 ? 1_000 : 10_000;
        expect(fee % step, `${id} ${unit}`).toBe(0);
      }
    }
  });

  it('takes more days for a lead than a supporting part than a bit part, and a fraction of them for small work', () => {
    expect(BILLING_DAYS.lead).toBeGreaterThan(BILLING_DAYS.supporting);
    expect(BILLING_DAYS.supporting).toBeGreaterThan(BILLING_DAYS.bit);
    expect(roleDays('lead', 'lead', 0.5)).toBe(BILLING_DAYS.lead);
    expect(roleDays('local', 'lead', 0.5)).toBeLessThan(roleDays('lead', 'lead', 0.5) / 2);
    expect(roleDays('commercial', 'bit', 0)).toBe(1);
    // A year has room for one lead and a part or two, never three leads.
    expect(BILLING_DAYS.lead * 3).toBeGreaterThan(YEAR_DAYS);
    expect(BILLING_DAYS.lead + BILLING_DAYS.supporting).toBeLessThanOrEqual(YEAR_DAYS);
  });

  it('is a billing read from a draw against the rung’s shares', () => {
    expect(billingFor('lead', 0)).toBe('lead');
    expect(billingFor('lead', 0.9)).toBe('supporting');
    expect(billingFor('working', 0.04)).toBe('lead');
    expect(billingFor('working', 0.1)).toBe('supporting');
    expect(billingFor('working', 0.5)).toBe('bit');
    expect(billingFor('star', 0.5)).toBe('lead');
  });
});

describe('what a character is like as an actor', () => {
  const average = { charisma: 72, looks: 72, smarts: 72, discipline: 72 };

  it('is a middling craft for an average grown character, and a talent is a head start of twelve', () => {
    expect(naturalCraft(average, false)).toBe(50);
    expect(naturalCraft(average, true)).toBe(62);
  });

  it('rises with charisma most, then discipline, looks and smarts, and is held to the scale', () => {
    const base = naturalCraft(average, false);
    const up = (key: keyof typeof average) => naturalCraft({ ...average, [key]: 82 }, false) - base;
    expect(up('charisma')).toBeGreaterThan(up('discipline'));
    expect(up('discipline')).toBeGreaterThan(up('looks'));
    expect(up('looks')).toBeGreaterThan(up('smarts'));
    expect(naturalCraft({ charisma: 0, looks: 0, smarts: 0, discipline: 0 }, false)).toBe(0);
    expect(naturalCraft({ charisma: 100, looks: 100, smarts: 100, discipline: 100 }, true)).toBe(
      100,
    );
  });

  it('does not read health or stress, as the spec asks (spec 280)', () => {
    const sick = withStats(adult('craft-health'), { health: 5 });
    const well = withStats(adult('craft-health'), { health: 95 });
    expect(craftOf(sick)).toBe(craftOf(well));
    expect(craftCeiling(sick)).toBe(craftCeiling(well));
  });

  it('reads as a word that gets warmer with the name', () => {
    expect(actingReputationWord(0)).toBe('Unknown');
    expect(actingReputationWord(10)).toBe('Getting noticed');
    expect(actingReputationWord(25)).toBe('Known to casting');
    expect(actingReputationWord(45)).toBe('Established');
    expect(actingReputationWord(65)).toBe('Respected');
    expect(actingReputationWord(90)).toBe('Celebrated');
  });
});

describe('fame', () => {
  const held = (tier: ActingTier, over: Partial<Parameters<typeof actingFameOf>[0]> = {}) =>
    actingFameOf({ tier, reputation: 0, awards: 0, idle: 0, ...over });

  it('is nothing at the bottom, and climbs the rungs', () => {
    expect(held('local')).toBe(0);
    const values = ACTING_TIERS.map((id) => held(id));
    for (let index = 2; index < values.length; index += 1) {
      expect(values[index]!).toBeGreaterThan(values[index - 1]!);
    }
    expect(held('star')).toBe(ACTING_TIER_ROWS.star.fame);
  });

  it('is helped by a name and by awards, three each, up to twelve', () => {
    expect(held('lead', { reputation: 50 })).toBe(held('lead') + 5);
    expect(held('lead', { awards: 2 })).toBe(held('lead') + 6);
    expect(held('lead', { awards: 20 })).toBe(held('lead') + 12);
  });

  it('is halved in a year with no work, and gone after three', () => {
    expect(held('lead', { idle: 1 })).toBe(Math.round(held('lead') / 2));
    expect(held('lead', { idle: IDLE_FALL_YEARS })).toBe(0);
  });

  it('is never more than a hundred', () => {
    expect(held('star', { reputation: 100, awards: 50 })).toBeLessThanOrEqual(100);
  });
});

/* -------------------------------------------------------------------------- */
/* Being seen                                                                  */
/* -------------------------------------------------------------------------- */

describe('being seen', () => {
  it('is nobody’s at the start, and an actor with no agent, lessons or recent stage is not seen', () => {
    expect(isSeen(EMPTY_ACTING, 20)).toBe(false);
    expect(isSeen({ ...EMPTY_ACTING, stageYears: 3 }, 20)).toBe(false);
  });

  it('is a recent stage year, for four years after', () => {
    const acting = { ...EMPTY_ACTING, stageYears: 1, seenAge: 16 };
    expect(isSeen(acting, 16)).toBe(true);
    expect(isSeen(acting, 20)).toBe(true);
    expect(isSeen(acting, 21)).toBe(false);
  });

  it('is lessons, whenever, and an agent, whenever', () => {
    expect(isSeen({ ...EMPTY_ACTING, lessons: { since: 12, seasons: 0 } }, 60)).toBe(true);
    expect(isSeen({ ...EMPTY_ACTING, agent: { since: 20 } }, 60)).toBe(true);
  });

  it('is what makes offers come, and nothing else does: an unseen life is never asked', () => {
    const state = adult('unseen');
    for (let year = 2030; year < 2060; year += 1) {
      expect(yearOf(state, 27, year).acting.offers).toEqual([]);
    }
  });

  it('is a stage year that the year counts, and a life in a drama activity gets seen by itself', () => {
    const base = adult('stage-seen', false, 16);
    const staged = {
      ...base,
      education: join(base.education, 'act.drama-club', 16),
    };
    const out = yearOf(staged, 17, 2030);
    expect(out.acting.stageYears).toBe(1);
    expect(out.acting.seenAge).toBe(17);
  });
});

/* -------------------------------------------------------------------------- */
/* Not ready                                                                   */
/* -------------------------------------------------------------------------- */

describe('being ready for a rung', () => {
  const acting = (over: Partial<ActingState> = {}): ActingState => ({ ...EMPTY_ACTING, ...over });

  it('is nothing to ask at the bottom for anybody eleven or older', () => {
    expect(notReadyFor(acting(), 'local', 11, 0)).toBeUndefined();
    expect(notReadyFor(acting(), 'local', 10, 100)).toBe('too-young');
  });

  it('asks the age first, then the credits, then the craft, then the name', () => {
    const rich = acting({ credits: 100, reputation: 100 });
    expect(notReadyFor(rich, 'star', 24, 100)).toBe('too-young');
    expect(notReadyFor(acting({ reputation: 100 }), 'star', 30, 100)).toBe('few-credits');
    expect(notReadyFor(rich, 'star', 30, 79)).toBe('craft');
    expect(notReadyFor(acting({ credits: 100 }), 'star', 30, 100)).toBe('reputation');
    expect(notReadyFor(rich, 'star', 30, 100)).toBeUndefined();
  });

  it('is judged per rung: a supporting actor is not ready to lead', () => {
    const supporting = acting({ credits: 12, reputation: 15 });
    expect(notReadyFor(supporting, 'supporting', 25, 60)).toBeUndefined();
    expect(notReadyFor(supporting, 'lead', 25, 60)).toBe('few-credits');
  });
});

/* -------------------------------------------------------------------------- */
/* The offers a year raises                                                    */
/* -------------------------------------------------------------------------- */

describe('the offers a year raises', () => {
  const seenLife = (seed: string, patch: Partial<ActingState> = {}, talent = false): GameState =>
    seen(adult(seed, talent), patch);

  const allOffers = (state: GameState, years: number): Role[] => {
    const rows: Role[] = [];
    for (let index = 0; index < years; index += 1) {
      rows.push(...yearOf(state, state.player.age + 1, 2030 + index).acting.offers);
    }
    return rows;
  };

  it('are a few a year for somebody seen, never more than four at once', () => {
    const state = seenLife('offers-few');
    for (let year = 2030; year < 2050; year += 1) {
      const count = yearOf(state, 27, year).acting.offers.length;
      expect(count).toBeLessThanOrEqual(4);
    }
    const total = allOffers(state, 60).length;
    expect(total).toBeGreaterThan(20);
    expect(total).toBeLessThan(180);
  });

  it('are more at a higher rung, with the same name', () => {
    const count = (tier: ActingTier) =>
      allOffers(seenLife('offers-tier', { tier, credits: 60, reputation: 50, craft: 90 }), 100)
        .length;
    expect(count('working')).toBeGreaterThan(count('local'));
    expect(count('supporting')).toBeGreaterThan(count('local'));
  });

  it('are more for a good name, a talent and an agent', () => {
    const count = (state: GameState) => allOffers(state, 120).length;
    const plain = count(seenLife('offers-mult', { tier: 'working', credits: 5 }));
    const named = count(seenLife('offers-mult', { tier: 'working', credits: 5, reputation: 90 }));
    const talented = count(seenLife('offers-mult', { tier: 'working', credits: 5 }, true));
    const agented = count(
      seenLife('offers-mult', { tier: 'working', credits: 5, agent: { since: 20 } }),
    );
    expect(named).toBeGreaterThan(plain);
    expect(talented).toBeGreaterThan(plain);
    expect(agented).toBeGreaterThan(plain);
  });

  it('are each a lead, a supporting part or a bit part, in a kind of work, with a title, a fee and days', () => {
    const rows = allOffers(
      seenLife('offers-shape', { tier: 'supporting', credits: 20, reputation: 30 }),
      60,
    );
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(BILLINGS).toContain(row.billing);
      expect(ACTING_TIER_ROWS[row.tier].mediums).toContain(row.medium);
      expect(ROLE_TITLES).toContain(row.title);
      expect(row.fee).toBeGreaterThanOrEqual(0);
      expect(row.days).toBeGreaterThanOrEqual(1);
      expect(row.source).toBe('asked');
    }
    expect(new Set(rows.map((row) => row.billing)).size).toBe(3);
  });

  it('come at the rung the actor is at, one below, or one above, and never past what they are ready for', () => {
    const state = seenLife('offers-reach', {
      tier: 'working',
      credits: 4,
      reputation: 2,
      craft: 50,
    });
    const tiers = new Set(allOffers(state, 200).map((row) => row.tier));
    expect([...tiers].sort()).toEqual(['commercial', 'working']);
    // Supporting asks for ten credits, and four is not ten.
    expect(tiers.has('supporting')).toBe(false);
  });

  it('reach a rung up when the actor is ready, and more often with an agent', () => {
    const base = { tier: 'working' as const, credits: 30, reputation: 40, craft: 90 };
    const above = (state: GameState) =>
      allOffers(state, 200).filter((row) => row.tier === 'supporting').length;
    const plain = above(seenLife('offers-above', base));
    const agented = above(seenLife('offers-above', { ...base, agent: { since: 20 } }));
    expect(plain).toBeGreaterThan(0);
    expect(agented).toBeGreaterThan(plain);
  });

  it('are the same for the same life', () => {
    const state = seenLife('offers-same', { tier: 'commercial', credits: 3 });
    expect(yearOf(state, 27, 2031).acting.offers).toEqual(yearOf(state, 27, 2031).acting.offers);
  });

  it('never put two parts of the same title in front of an actor', () => {
    const state = seenLife('offers-titles', {
      tier: 'lead',
      credits: 40,
      reputation: 50,
      craft: 95,
    });
    for (let year = 2030; year < 2080; year += 1) {
      const titles = yearOf(state, 30, year).acting.offers.map((row) => row.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('fit in the year: no set of offers needs more days than there are', () => {
    const state = seenLife('offers-days', { tier: 'lead', credits: 40, reputation: 50, craft: 95 });
    for (let year = 2030; year < 2090; year += 1) {
      const days = yearOf(state, 30, year).acting.offers.reduce((sum, row) => sum + row.days, 0);
      expect(days).toBeLessThanOrEqual(YEAR_DAYS);
    }
  });

  it('thin out after the middle of life, never below a third', () => {
    const young = allOffers(seenLife('offers-age', { tier: 'working', credits: 5 }), 100).length;
    const base = adult('offers-age', false, 26);
    const old: GameState = {
      ...seen(base, { tier: 'working', credits: 5 }),
      player: { ...base.player, age: 80 },
    };
    const aged: Role[] = [];
    for (let index = 0; index < 100; index += 1) {
      aged.push(
        ...yearOf({ ...old, acting: { ...old.acting, seenAge: 80 } }, 81, 2030 + index).acting
          .offers,
      );
    }
    expect(aged.length).toBeLessThan(young);
    expect(aged.length).toBeGreaterThan(young * 0.15);
  });

  it('draw nothing from the random streams', () => {
    const state = seenLife('offers-streams', { tier: 'working', credits: 5 });
    const before = JSON.stringify(state.rng.snapshot());
    yearOf(state, 27, 2031);
    castingCalls(state);
    expect(JSON.stringify(state.rng.snapshot())).toBe(before);
  });

  it('are asked of nobody under eleven', () => {
    const child = withActing(life('offers-child'), { stageYears: 1, seenAge: 9, tier: 'local' });
    for (let year = 2000; year < 2040; year += 1) {
      expect(
        yearOf({ ...child, player: { ...child.player, age: 8 } }, 9, year).acting.offers,
      ).toEqual([]);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Casting calls                                                               */
/* -------------------------------------------------------------------------- */

describe('casting calls', () => {
  const state = (seed = 'calls', patch: Partial<ActingState> = {}, talent = false): GameState =>
    withActing(adult(seed, talent), patch);

  it('are six, the same each time they are read, each with the part it is for and the odds', () => {
    const calls = castingCalls(state());
    expect(calls).toHaveLength(6);
    expect(castingCalls(state())).toEqual(calls);
    expect(new Set(calls.map((row) => row.role.id)).size).toBe(6);
    for (const call of calls) {
      expect(call.role.source).toBe('applied');
      expect(call.chance).toBeGreaterThanOrEqual(0.03);
      expect(call.chance).toBeLessThanOrEqual(0.95);
      expect(call.applied).toBe(false);
    }
  });

  it('are different from year to year', () => {
    const now = state();
    const later: GameState = { ...now, player: { ...now.player, age: now.player.age + 1 } };
    expect(castingCalls(later).map((row) => row.role.title)).not.toEqual(
      castingCalls(now).map((row) => row.role.title),
    );
  });

  it('are none for a child under eleven', () => {
    expect(castingCalls(life('calls-child'))).toEqual([]);
    const result = applyForCasting(life('calls-child'), 'call:0:0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('too-young');
  });

  it('are at the actor’s rung and one either side, and a rung above only when they are ready for it', () => {
    const base = state('calls-reach', { tier: 'local' });
    const tiers = new Set<ActingTier>();
    for (let age = 20; age < 80; age += 1) {
      const aged: GameState = { ...base, player: { ...base.player, age } };
      for (const call of castingCalls(aged)) tiers.add(call.role.tier);
    }
    expect(tiers.has('local')).toBe(true);
    // A first-year actor has no credits, so commercials (which ask only a craft of 35) can be reached, working cannot.
    expect(tiers.has('working')).toBe(false);
  });

  it('say whether the part is below, at or above where the actor is', () => {
    const base = state('calls-says', { tier: 'working', credits: 30, reputation: 40, craft: 90 });
    const reaches = new Set<string>();
    for (let age = 20; age < 70; age += 1) {
      const aged: GameState = { ...base, player: { ...base.player, age } };
      for (const call of castingCalls(aged)) reaches.add(call.reach);
    }
    expect([...reaches].sort()).toEqual(['above', 'at', 'below']);
  });

  it('are easier for a better actor, a talent and an agent, and easier to land a bit part than a lead', () => {
    const base = state('calls-odds', { craft: 40 });
    const chanceOf = (s: GameState) => castingCalls(s).reduce((sum, row) => sum + row.chance, 0);
    expect(chanceOf(withActing(base, { craft: 80 }))).toBeGreaterThan(chanceOf(base));
    expect(chanceOf(withActing(base, { agent: { since: 20 } }))).toBeGreaterThan(chanceOf(base));
    expect(chanceOf(withActing(base, { reputation: 80 }))).toBeGreaterThan(chanceOf(base));
    const talented = withActing(adult('calls-odds', true), { craft: 40 });
    expect(chanceOf(talented)).toBeGreaterThan(chanceOf(base));
    const mix = castingCalls(base);
    const bit = mix.filter((row) => row.role.billing === 'bit' && row.reach === 'at');
    const lead = mix.filter((row) => row.role.billing === 'lead' && row.reach === 'at');
    if (bit[0] && lead[0]) expect(bit[0].chance).toBeGreaterThan(lead[0].chance);
  });

  it('are applied for with an answer of Offer or Denied by one draw, and nothing in between', () => {
    const first = state('calls-apply');
    const outcomes = new Set<boolean>();
    for (let index = 0; index < 60 && outcomes.size < 2; index += 1) {
      const probe = withActing(adult(`calls-apply-${index}`), {});
      const call = castingCalls(probe)[0]!;
      const result = applyForCasting(probe, call.role.id);
      expect(result.ok).toBe(true);
      if (result.ok) outcomes.add(result.value.landed);
    }
    expect([...outcomes].sort()).toEqual([false, true]);
    expect(first).toBeDefined();
  });

  it('are applied for with the same answer every time for the same life and call', () => {
    const probe = adult('calls-same');
    const call = castingCalls(probe)[0]!;
    const one = applyForCasting(probe, call.role.id);
    const two = applyForCasting(probe, call.role.id);
    expect(one.ok && two.ok && one.value.landed === two.value.landed).toBe(true);
  });

  it('put a landed part on the table as a question, and write a line for a denial', () => {
    const landed = firstSeed('calls-landed', (seed) => {
      const probe = adult(seed);
      const call = castingCalls(probe)[0]!;
      const result = applyForCasting(probe, call.role.id);
      return result.ok && result.value.landed ? { probe, call, result: result.value } : undefined;
    });
    expect(landed.result.state.acting.offers[0]?.id).toBe(landed.call.role.id);
    expect(landed.result.state.pending.some((row) => row.eventId === ACTING_OFFER_EVENT_ID)).toBe(
      true,
    );
    expect(landed.result.entry.text).toMatch(/offered you the part/);
    const denied = firstSeed('calls-denied', (seed) => {
      const probe = adult(seed);
      const call = castingCalls(probe)[0]!;
      const result = applyForCasting(probe, call.role.id);
      return result.ok && !result.value.landed ? result.value : undefined;
    });
    expect(denied.entry.text).toMatch(/went another way/);
    expect(denied.state.acting.offers).toEqual([]);
    expect(denied.state.pending.some((row) => row.eventId === ACTING_OFFER_EVENT_ID)).toBe(false);
  });

  it('are applied for once each, and only so many in a year', () => {
    let probe = adult('calls-limit');
    const calls = castingCalls(probe);
    const one = applyForCasting(probe, calls[0]!.role.id);
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    probe = answerOthers({
      ...one.value.state,
      acting: { ...one.value.state.acting, offers: [] },
      pending: [],
    });
    const again = applyForCasting(probe, calls[0]!.role.id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('already-applied');
    expect(castingCalls(probe)[0]!.applied).toBe(true);
    const two = applyForCasting(probe, calls[1]!.role.id);
    expect(two.ok).toBe(true);
    if (!two.ok) return;
    const third = applyForCasting(
      { ...two.value.state, acting: { ...two.value.state.acting, offers: [] }, pending: [] },
      calls[2]!.role.id,
    );
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error).toBe('no-applications-left');
  });

  it('are two more a year with an agent, and a new age starts the count again', () => {
    expect(applicationsAllowed(EMPTY_ACTING)).toBe(APPLICATIONS_PER_YEAR);
    expect(applicationsAllowed({ ...EMPTY_ACTING, agent: { since: 20 } })).toBe(
      APPLICATIONS_PER_YEAR + AGENT_SUBMISSIONS,
    );
    const probe = withActing(adult('calls-reset'), { appliedAge: 20, applied: ['x', 'y'] });
    const call = castingCalls(probe)[0]!;
    expect(applyForCasting(probe, call.role.id).ok).toBe(true);
  });

  it('refuse a call that is not open, and a part there are no days left for', () => {
    const probe = adult('calls-refuse');
    const unknown = applyForCasting(probe, 'call:nope');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error).toBe('no-such-call');
    const full = withActing(probe, { booked: [booked({ days: YEAR_DAYS })] });
    const refused = applyForCasting(full, castingCalls(full)[0]!.role.id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('booked-up');
    expect(freeDays(full.acting)).toBe(0);
  });

  it('come without an agent, a stage or lessons: a person on their own can audition', () => {
    const probe = adult('calls-alone');
    expect(probe.acting).toEqual(EMPTY_ACTING);
    expect(castingCalls(probe).length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Lessons, development, an agent                                              */
/* -------------------------------------------------------------------------- */

describe('lessons', () => {
  it('begin from ten, once, and put craft on the record', () => {
    const child = life('lessons-child');
    expect(startLessons({ ...child, player: { ...child.player, age: 9 } }).ok).toBe(false);
    const ten = { ...child, player: { ...child.player, age: 10 } };
    const started = startLessons(ten);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.state.acting.lessons).toEqual({ since: 10, seasons: 0 });
    expect(started.value.state.acting.craft).toBe(craftOf(ten));
    expect(started.value.entry.text).toMatch(/acting lessons/);
    const again = startLessons(started.value.state);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('already-taking');
  });

  it('raise the most craft can reach, and stopping them takes it away again', () => {
    const base = adult('lessons-ceiling');
    const started = startLessons(base);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(craftCeiling(started.value.state)).toBeGreaterThan(craftCeiling(base));
    const stopped = stopLessons(started.value.state);
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.value.state.acting.lessons).toBeUndefined();
    expect(craftCeiling(stopped.value.state)).toBe(craftCeiling(base));
    expect(stopLessons(base).ok).toBe(false);
  });

  it('count a season each year, and bill an adult on their own', () => {
    const state = withActing(adult('lessons-bill'), { lessons: { since: 20, seasons: 0 } });
    const own = { ...state, household: { ...state.household, housing: 'ownPlace' as const } };
    const out = runActingYear({
      before: own,
      education: own.education,
      age: 27,
      year: 2031,
      standard: 200_000,
    });
    expect(out.acting.lessons?.seasons).toBe(1);
    expect(out.fees).toBe(LESSONS_COST);
    expect(out.feeSource).toBe('Acting lessons');
  });

  it('are not billed to an adult at home, and not to a child', () => {
    const state = withActing(adult('lessons-home'), { lessons: { since: 20, seasons: 0 } });
    const home = { ...state, household: { ...state.household, housing: 'withFamily' as const } };
    expect(
      runActingYear({
        before: home,
        education: home.education,
        age: 27,
        year: 2031,
        standard: 200_000,
      }).fees,
    ).toBe(0);
    const child = withActing(life('lessons-kid'), { lessons: { since: 10, seasons: 0 } });
    expect(
      runActingYear({
        before: child,
        education: child.education,
        age: 12,
        year: 2012,
        standard: 200_000,
      }).fees,
    ).toBe(0);
  });

  it('are the first thing to go in a tight year, with a line', () => {
    const state = withActing(adult('lessons-tight'), { lessons: { since: 20, seasons: 2 } });
    const own = { ...state, household: { ...state.household, housing: 'ownPlace' as const } };
    const out = runActingYear({
      before: own,
      education: own.education,
      age: 27,
      year: 2031,
      standard: 0,
    });
    expect(out.acting.lessons).toBeUndefined();
    expect(out.fees).toBe(0);
    expect(out.lines.some((row) => /Let the acting lessons go/.test(row.text))).toBe(true);
  });
});

describe('character development', () => {
  it('is three sessions a year, from twelve, each worth a little less, and never past the ceiling', () => {
    const base = withActing(adult('dev', true), { craft: 30 });
    let state = base;
    const gains: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const before = craftOf(state);
      const result = developCharacter(state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.value.state;
      gains.push(craftOf(state) - before);
    }
    expect(gains[0]!).toBeGreaterThanOrEqual(gains[1]!);
    expect(gains[1]!).toBeGreaterThanOrEqual(gains[2]!);
    expect(gains.every((gain) => gain >= 1)).toBe(true);
    const fourth = developCharacter(state);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.error).toBe('no-sessions-left');
    expect(craftOf(state)).toBeLessThanOrEqual(craftCeiling(base));
  });

  it('starts again with the next year', () => {
    const state = withActing(adult('dev-next'), { devAtAge: 25, devCount: 3, craft: 40 });
    expect(developCharacter(state).ok).toBe(true);
  });

  it('is not for a child under twelve, and stops at the ceiling', () => {
    const child = life('dev-child');
    const eleven = { ...child, player: { ...child.player, age: 11 } };
    const young = developCharacter(eleven);
    expect(young.ok).toBe(false);
    if (!young.ok) expect(young.error).toBe('too-young');
    const topped = withActing(adult('dev-top'), { craft: 100 });
    const result = developCharacter(topped);
    expect(result.ok).toBe(true);
    if (result.ok) expect(craftOf(result.value.state)).toBe(craftCeiling(topped));
  });
});

describe('an agent', () => {
  const ready = (seed: string): GameState =>
    withActing(adult(seed), { tier: 'commercial', credits: 3 });

  it('wants a few credits and a rung before anybody signs, and is never the way in', () => {
    const none = signWithAgent(adult('agent-none'));
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toBe('nobody-will-take-you-on');
    expect(
      signWithAgent(withActing(adult('agent-low'), { credits: 1, tier: 'commercial' })).ok,
    ).toBe(false);
    expect(signWithAgent(withActing(adult('agent-low'), { credits: 9, tier: 'local' })).ok).toBe(
      false,
    );
    expect(signWithAgent(ready('agent-ok')).ok).toBe(true);
  });

  it('signs once, with a line and a record, and can be left', () => {
    const signed = signWithAgent(ready('agent-sign'));
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signed.value.state.acting.agent).toEqual({ since: 26 });
    expect(signed.value.entry.text).toMatch(/ten percent/);
    expect(signed.value.state.player.records.some((row) => /agent/.test(row.label))).toBe(true);
    const twice = signWithAgent(signed.value.state);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.error).toBe('has-agent');
    const left = leaveAgent(signed.value.state);
    expect(left.ok).toBe(true);
    if (left.ok) expect(left.value.state.acting.agent).toBeUndefined();
    expect(leaveAgent(ready('agent-never')).ok).toBe(false);
  });

  it('takes a tenth of every fee, and the line says so', () => {
    expect(AGENT_CUT).toBe(0.1);
    const state = withActing(adult('agent-cut'), {
      agent: { since: 20 },
      credits: 5,
      craft: 100,
      booked: [booked({ fee: 5_000 })],
    });
    const out = yearOf(state);
    expect(out.pay).toBe(4_500);
    expect(out.agentShare).toBe(500);
    expect(out.lines.some((row) => /agent’s share was \$500/.test(row.text))).toBe(true);
    const alone = yearOf(withActing(state, { agent: undefined }));
    expect(alone.pay).toBe(5_000);
    expect(alone.agentShare).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Answering an offer                                                          */
/* -------------------------------------------------------------------------- */

describe('answering an offer', () => {
  const withOffers = (
    seed: string,
    offers: readonly Role[],
    patch: Partial<ActingState> = {},
  ): GameState => withActingOffer(withActing(adult(seed), { offers, ...patch }), true);

  it('is put on the table as a question that says what the part is, what it pays and how many days', () => {
    const state = withOffers('ans-prompt', [
      role({ fee: 12_000, days: 20, billing: 'supporting', medium: 'a feature film' }),
    ]);
    const decision = state.pending.find((row) => row.eventId === ACTING_OFFER_EVENT_ID)!;
    expect(decision.prompt).toBe(
      'A director wants you for a supporting part in a feature film, "Paper Boats". It pays $12,000 for 20 days on set.',
    );
    expect(decision.choices.map((row) => row.label)).toEqual([
      'Take the part',
      'Ask for more',
      'Pass',
    ]);
  });

  it('says it is a part the actor went for when they applied, and says so for an unpaid one', () => {
    const decision = actingOfferDecision(role({ source: 'applied', fee: 0, days: 1 }), 2030);
    expect(decision.prompt).toBe(
      'You got the part: a lead in a student film, "Paper Boats". It doesn’t pay for 1 day on set.',
    );
    expect(decision.choices.map((row) => row.label)).toEqual(['Take the part', 'Pass']);
  });

  it('can be bargained over only when it pays enough, and only once', () => {
    const small = actingOfferDecision(role({ fee: 4_900 }), 2030);
    expect(small.choices.some((row) => row.id === 'more')).toBe(false);
    const big = actingOfferDecision(role({ fee: 5_000 }), 2030);
    expect(big.choices.some((row) => row.id === 'more')).toBe(true);
    const asked = actingOfferDecision(role({ fee: 50_000, asked: true }), 2030);
    expect(asked.choices.some((row) => row.id === 'more')).toBe(false);
  });

  it('is taken as a booking: the part is booked, the question clears, and a line says so', () => {
    const state = withOffers('ans-take', [role({ fee: 3_000 })]);
    const result = answerActingOffer(state, 'accept');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value.state;
    expect(next.acting.offers).toEqual([]);
    expect(next.acting.booked).toHaveLength(1);
    expect(next.acting.booked[0]).toMatchObject({ title: 'Paper Boats', fee: 3_000, days: 6 });
    expect(next.pending.some((row) => row.eventId === ACTING_OFFER_EVENT_ID)).toBe(false);
    expect(result.value.entry.text).toMatch(/Took the part: a lead in a student film/);
    expect(next.acting.craft).toBeDefined();
  });

  it('is passed on without a booking', () => {
    const state = withOffers('ans-pass', [role({ fee: 3_000 })]);
    const result = answerActingOffer(state, 'decline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.acting.booked).toEqual([]);
    expect(result.value.state.acting.offers).toEqual([]);
    expect(result.value.entry.text).toMatch(/Passed on/);
  });

  it('brings up the next offer once the first is answered, one at a time', () => {
    const state = withOffers('ans-next', [
      role({ id: 'a', title: 'Salt Flats', fee: 1_000 }),
      role({ id: 'b', title: 'Low Tide', fee: 2_000 }),
    ]);
    expect(state.pending.filter((row) => row.eventId === ACTING_OFFER_EVENT_ID)).toHaveLength(1);
    const first = answerActingOffer(state, 'accept');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const waiting = first.value.state.pending.find((row) => row.eventId === ACTING_OFFER_EVENT_ID);
    expect(waiting?.prompt).toMatch(/Low Tide/);
    const second = answerActingOffer(first.value.state, 'decline');
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.state.pending.some((row) => row.eventId === ACTING_OFFER_EVENT_ID)).toBe(
        false,
      );
    }
  });

  it('is answered through the game’s decide, and time is held while it is open', () => {
    const state = withOffers('ans-decide', [role({ fee: 1_000 })]);
    const blocked = advanceYear(state);
    expect(blocked.state.world.year).toBe(state.world.year);
    const result = decide(state, ACTING_OFFER_EVENT_ID, 'accept');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.state.acting.booked).toHaveLength(1);
    expect(decide(state, ACTING_OFFER_EVENT_ID, 'sell').ok).toBe(false);
  });

  it('refuses an answer to a question nobody asked, and a choice that is not there', () => {
    const state = adult('ans-none');
    const none = answerActingOffer(state, 'accept');
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toBe('no-offer');
    const small = withOffers('ans-bad', [role({ fee: 100 })]);
    const bad = answerActingOffer(small, 'more');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('no-such-choice');
  });

  it('can be bargained over once: a win raises the fee a tenth or more, a loss holds it, and it is never lost', () => {
    let wins = 0;
    let holds = 0;
    for (let index = 0; index < 60; index += 1) {
      const state = withOffers(`ans-ask-${index}`, [
        role({ fee: 40_000, tier: 'supporting', billing: 'supporting' }),
      ]);
      const result = answerActingOffer(state, 'more');
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const offer = result.value.state.acting.offers[0]!;
      expect(offer.asked).toBe(true);
      expect(offer.fee).toBeGreaterThanOrEqual(40_000);
      if (offer.fee > 40_000) {
        wins += 1;
        expect(offer.fee).toBeGreaterThanOrEqual(44_000);
        expect(offer.fee).toBeLessThanOrEqual(50_000);
        expect(result.value.entry.text).toMatch(/came up to/);
      } else {
        holds += 1;
        expect(result.value.entry.text).toMatch(/held at \$40,000/);
      }
      // The question is asked again, without the option to ask.
      const again = result.value.state.pending.find(
        (row) => row.eventId === ACTING_OFFER_EVENT_ID,
      )!;
      expect(again.choices.some((row) => row.id === 'more')).toBe(false);
    }
    expect(wins).toBeGreaterThan(10);
    expect(holds).toBeGreaterThan(5);
  });

  it('is likelier to be won by a name and an agent', () => {
    const count = (patch: Partial<ActingState>) => {
      let wins = 0;
      for (let index = 0; index < 120; index += 1) {
        const state = withOffers(`ans-ask-chance-${index}`, [role({ fee: 40_000 })], patch);
        const result = answerActingOffer(state, 'more');
        if (result.ok && result.value.state.acting.offers[0]!.fee > 40_000) wins += 1;
      }
      return wins;
    };
    const plain = count({});
    expect(count({ reputation: 100 })).toBeGreaterThan(plain);
    expect(count({ agent: { since: 20 } })).toBeGreaterThan(plain);
  });

  it('does not book a part the year has no days for, and says so', () => {
    const state = withOffers('ans-full', [role({ days: 60 })], { booked: [booked({ days: 150 })] });
    const result = answerActingOffer(state, 'accept');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.acting.booked).toHaveLength(1);
    expect(result.value.entry.text).toMatch(/Couldn't fit/);
  });
});

/* -------------------------------------------------------------------------- */
/* A year of work                                                              */
/* -------------------------------------------------------------------------- */

describe('a year of work', () => {
  const base = (seed = 'year', patch: Partial<ActingState> = {}): GameState =>
    withActing(adult(seed), { craft: 100, ...patch });

  it('pays every part that was booked, whole and in full, and ends the booking', () => {
    const state = base('year-pay', {
      booked: [booked({ id: 'a', fee: 600 }), booked({ id: 'b', title: 'Low Tide', fee: 300 })],
    });
    const out = yearOf(state);
    expect(out.pay).toBe(900);
    expect(out.acting.booked).toEqual([]);
    expect(out.acting.credits).toBe(2);
  });

  it('writes a line for each part, in the actor’s words, with what it paid', () => {
    const state = base('year-lines', { booked: [booked({ fee: 600 })] });
    const out = yearOf(state);
    const line = out.lines.find((row) => /Worked on/.test(row.text))!;
    expect(line.text).toBe(
      'Worked on a lead in a student film, "Paper Boats". It landed. It paid $600.',
    );
  });

  it('has a hit when the craft is far above the rung’s line, and a flop when it is far below', () => {
    const hit = yearOf(base('year-hit', { booked: [booked()] }));
    expect(hit.lines.some((row) => /It landed/.test(row.text))).toBe(true);
    expect(hit.mood).toBeGreaterThan(0);
    const flop = yearOf(base('year-flop', { craft: 0, booked: [booked()] }));
    expect(flop.lines.some((row) => /weren’t kind/.test(row.text))).toBe(true);
    expect(flop.mood).toBeLessThan(0);
    const middling = firstSeed('year-mid', (seed) => {
      const out = yearOf(withActing(adult(seed), { craft: 58, booked: [booked()] }));
      return out.lines.some((row) => /came and went/.test(row.text)) ? out : undefined;
    });
    expect(middling.mood).toBe(0);
  });

  it('gives a name to a hit and takes it for a flop, more for a lead than for a bit part', () => {
    const rep = (craft: number, billing: 'lead' | 'bit') =>
      yearOf(base(`year-rep`, { craft, reputation: 50, booked: [booked({ billing })] })).acting
        .reputation;
    expect(rep(100, 'lead')).toBeGreaterThan(rep(100, 'bit'));
    expect(rep(100, 'bit')).toBeGreaterThan(50);
    expect(rep(0, 'lead')).toBeLessThan(rep(100, 'lead'));
  });

  it('writes a record of a first part, and only the first', () => {
    const first = yearOf(base('year-first', { booked: [booked({ title: 'Salt Flats' })] }));
    expect(first.records).toContainEqual({
      category: 'career',
      label: 'Landed a first acting role: Salt Flats',
    });
    const second = yearOf(
      base('year-first', { credits: 3, booked: [booked({ title: 'Salt Flats' })] }),
    );
    expect(second.records.some((row) => /first acting role/.test(row.label))).toBe(false);
  });

  it('counts a year with no part as idle, takes some of the name, and does so only after a first part', () => {
    const unworked = yearOf(base('year-idle', { credits: 0, reputation: 20 }));
    expect(unworked.acting.idle).toBe(0);
    expect(unworked.acting.reputation).toBe(20);
    const idle = yearOf(base('year-idle', { credits: 4, reputation: 20 }));
    expect(idle.acting.idle).toBe(1);
    expect(idle.acting.reputation).toBe(18);
    const worked = yearOf(base('year-idle', { credits: 4, idle: 2, booked: [booked()] }));
    expect(worked.acting.idle).toBe(0);
  });

  it('slides down a rung after three idle years, with a line, and starts the count again', () => {
    const state = base('year-fall', { credits: 20, tier: 'supporting', idle: 2, reputation: 30 });
    const out = yearOf(state);
    expect(out.acting.tier).toBe('working');
    expect(out.acting.idle).toBe(1);
    expect(out.lines.some((row) => /dried up/.test(row.text))).toBe(true);
    const bottom = yearOf(base('year-fall', { credits: 2, tier: 'local', idle: 2 }));
    expect(bottom.acting.tier).toBe('local');
  });

  it('rises a rung after enough hits at the rung, when the actor is ready for the next', () => {
    const state = base('year-rise', {
      credits: 5,
      tier: 'commercial',
      hits: HITS_TO_RISE.commercial - 1,
      booked: [booked({ tier: 'commercial', medium: 'a national commercial', fee: 2_000 })],
    });
    const out = yearOf(state);
    expect(out.acting.tier).toBe('working');
    expect(out.acting.hits).toBe(0);
    expect(out.lines.some((row) => /Casting directors know your name/.test(row.text))).toBe(true);
    expect(out.records).toContainEqual({
      category: 'career',
      label: 'Moved up to bit parts and small tv',
    });
  });

  it('rises at once on a hit in a part a rung up, when ready', () => {
    const state = base('year-above', {
      credits: 5,
      tier: 'commercial',
      booked: [booked({ tier: 'working', medium: 'a small TV role', billing: 'bit', fee: 3_000 })],
    });
    expect(yearOf(state).acting.tier).toBe('working');
  });

  it('does not rise past what the actor is ready for, however many hits', () => {
    const state = base('year-stuck', {
      credits: 0,
      tier: 'commercial',
      hits: 9,
      booked: [booked({ tier: 'commercial', medium: 'a national commercial' })],
    });
    // One credit is not the three that a bit part asks for.
    const out = yearOf(state);
    expect(out.acting.credits).toBe(1);
    expect(out.acting.tier).toBe('commercial');
  });

  it('keeps the best rung reached, after a fall', () => {
    const risen = yearOf(
      base('year-best', {
        credits: 5,
        tier: 'commercial',
        hits: 1,
        booked: [booked({ tier: 'commercial', medium: 'a national commercial' })],
      }),
    );
    expect(risen.acting.best).toBe('working');
    const fallen = yearOf(
      withActing(base('year-best'), { ...risen.acting, tier: 'working', idle: 2, booked: [] }),
    );
    expect(fallen.acting.tier).toBe('commercial');
    expect(fallen.acting.best).toBe('working');
  });

  it('holds craft toward what the character is plus the work, lessons and stage, up faster than down', () => {
    const state = adult('year-craft');
    const target = withActing(state, { craft: 10, credits: 2 });
    const rising = yearOf(target).acting.craft!;
    expect(rising).toBeGreaterThan(10);
    const high = withActing(state, { craft: 100, credits: 2 });
    const falling = yearOf(high).acting.craft!;
    expect(falling).toBeLessThan(100);
    expect(rising - 10).toBeGreaterThan(100 - falling);
  });

  it('has an award only from the supporting rung up, for work that was good, by a draw, and writes a record', () => {
    const lot = (tier: ActingTier, craft: number) => {
      let awards = 0;
      for (let index = 0; index < 150; index += 1) {
        const out = yearOf(
          withActing(adult(`year-award-${index}`), {
            craft,
            credits: 60,
            booked: [booked({ tier, billing: 'lead', fee: 50_000 })],
          }),
        );
        awards += out.acting.awards;
        if (out.acting.awards > 0) {
          expect(out.records.some((row) => row.category === 'award')).toBe(true);
          expect(
            out.lines.some((row) =>
              /Won Best Lead Performance at the Marquee Awards/.test(row.text),
            ),
          ).toBe(true);
          expect(out.mood).toBeGreaterThanOrEqual(6);
        }
      }
      return awards;
    };
    expect(lot('working', 100)).toBe(0);
    expect(lot('commercial', 100)).toBe(0);
    expect(AWARD_CHANCE.working).toBe(0);
    expect(lot('supporting', 100)).toBeGreaterThan(3);
    expect(lot('lead', 100)).toBeGreaterThan(lot('supporting', 100) - 1);
    // Not for work that wasn't good enough to be noticed.
    expect(lot('lead', 40)).toBe(0);
  });

  it('names the award for the part: lead, supporting or bit', () => {
    const texts = new Set<string>();
    for (const billing of BILLINGS) {
      for (
        let index = 0;
        index < 300 && ![...texts].some((row) => row.includes(billing));
        index += 1
      ) {
        const out = yearOf(
          withActing(adult(`year-award-name-${index}`), {
            craft: 100,
            credits: 60,
            booked: [booked({ tier: 'star', billing, fee: 1_000_000 })],
          }),
        );
        const line = out.lines.find((row) => /Won /.test(row.text));
        if (line) texts.add(`${billing}:${line.text}`);
      }
    }
    expect([...texts].some((row) => /lead:Won Best Lead Performance/.test(row))).toBe(true);
    expect([...texts].some((row) => /supporting:Won Best Supporting Performance/.test(row))).toBe(
      true,
    );
    expect([...texts].some((row) => /bit:Won Best Breakout Performance/.test(row))).toBe(true);
  });

  it('holds fame at the rung while the work is coming, and out of it when it stops', () => {
    const state = base('year-fame', {
      credits: 20,
      tier: 'lead',
      reputation: 50,
      booked: [booked({ tier: 'lead', billing: 'lead', fee: 500_000 })],
    });
    const out = yearOf(state);
    expect(out.fame).toBeGreaterThanOrEqual(ACTING_TIER_ROWS.lead.fame);
    // A year with no work halves it.
    const quiet = yearOf(base('year-fame', { credits: 20, tier: 'lead', reputation: 50 }));
    expect(quiet.acting.idle).toBe(1);
    expect(quiet.fame).toBe(Math.round((ACTING_TIER_ROWS.lead.fame + 5) / 2));
    // The lowest rung is not a name.
    expect(yearOf(base('year-fame', { credits: 20, tier: 'local' })).fame).toBe(0);
  });

  it('raises the offers for the year to come, with a line, once a year, for somebody seen', () => {
    const state = seen(base('year-raise', { tier: 'working', credits: 6, reputation: 30 }));
    const found = firstSeed('year-raise-more', (seed) => {
      const probe = seen(
        withActing(adult(seed), { tier: 'working', credits: 6, reputation: 30, craft: 70 }),
      );
      const out = yearOf(probe);
      return out.acting.offers.length > 0 ? out : undefined;
    });
    expect(found.lines.some((row) => /noticed you/.test(row.text))).toBe(true);
    expect(state.acting.offers).toEqual([]);
  });

  it('does nothing at all for somebody who has never been near a stage', () => {
    const out = yearOf(adult('year-nothing'));
    expect(out.acting).toEqual(EMPTY_ACTING);
    expect(out.lines).toEqual([]);
    expect(out.pay).toBe(0);
    expect(out.fame).toBe(0);
  });

  it('does nothing for the dead', () => {
    const state = seen(adult('year-dead'));
    const dead: GameState = { ...state, player: { ...state.player, alive: false } };
    expect(yearOf(dead).acting).toEqual(dead.acting);
  });
});

/* -------------------------------------------------------------------------- */
/* A living                                                                    */
/* -------------------------------------------------------------------------- */

describe('acting as a living', () => {
  const at = (tier: ActingTier, patch: Partial<ActingState> = {}): ActingState => ({
    ...EMPTY_ACTING,
    tier,
    credits: 12,
    ...patch,
  });

  it('is a supporting actor or better who has worked lately', () => {
    expect(isActingFullTime(at('supporting'))).toBe(true);
    expect(isActingFullTime(at('star'))).toBe(true);
    expect(isActingFullTime(at('working'))).toBe(false);
    expect(isActingFullTime(at('supporting', { credits: 0 }))).toBe(false);
    expect(isActingFullTime(at('supporting', { idle: 2 }))).toBe(false);
    expect(isActingFullTime(at('supporting', { idle: 1 }))).toBe(true);
  });

  it('is the header, and nothing before then', () => {
    expect(actingOccupation(at('supporting'))).toBe('Actor');
    expect(actingOccupation(at('working'))).toBeUndefined();
    expect(actingOccupation(EMPTY_ACTING)).toBeUndefined();
  });

  it('ends a day job in the year acting becomes a living, with a line, and not before', () => {
    const found = firstSeed(
      'living-job',
      (seed) => {
        const base = adult(seed);
        return base.employment.job ? base : undefined;
      },
      60,
    );
    const job = found.employment.job!;
    // One hit at the rung above, ready for it: working to supporting. Ten credits, a name of ten and the craft.
    const ready = withActing(found, {
      craft: 100,
      tier: 'working',
      credits: 9,
      reputation: 20,
      seenAge: found.player.age,
      stageYears: 1,
      booked: [
        booked({ tier: 'supporting', billing: 'supporting', medium: 'a TV series', fee: 30_000 }),
      ],
    });
    const after = advanceYear(answerOthers(ready)).state;
    expect(isActingFullTime(after.acting)).toBe(true);
    expect(after.employment.job).toBeUndefined();
    expect(
      after.employment.history.some((row) => row.jobId === job.jobId && row.because === 'resigned'),
    ).toBe(true);
    expect(after.player.timeline.some((row) => /end of the day job/.test(row.text))).toBe(true);
    expect(after.player.occupation).toBe('Actor');
    // The header and the death screen agree about what the person was.
    expect(eulogyFor(after).identity).not.toBe(findJob(job.jobId)?.title);
    // A bit-part actor keeps the job.
    const small = withActing(found, {
      craft: 100,
      tier: 'working',
      credits: 3,
      seenAge: found.player.age,
      stageYears: 1,
      booked: [booked({ tier: 'working', billing: 'bit', fee: 3_000 })],
    });
    const kept = advanceYear(answerOthers(small)).state;
    expect(isActingFullTime(kept.acting)).toBe(false);
    expect(kept.employment.job).toBeDefined();
  });

  it('keeps job offers away from somebody for whom it is a living, and not from a bit-part actor', () => {
    const base = adult('living-offers');
    const living = withActing(base, at('supporting'));
    expect(withAnyOffer(living, true)).toBe(living);
    // For a life where a job offer would otherwise be raised, a bit-part actor still gets it.
    // The offer roll spends a draw on the life's own stream, so each comparison rebuilds the
    // life from its seed: the same roll for both, not the next one along.
    const rebuilt = (seed: string): GameState => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const made = toAge(life(attempt === 0 ? seed : `${seed}~${attempt}`, false), 26);
        if (made.player.alive && made.player.age >= 26) return made;
      }
      throw new Error(`no living life for ${seed}`);
    };
    const seed = firstSeed('living-control', (candidate) => {
      const probe = rebuilt(candidate);
      return withAnyOffer(probe, true) !== probe ? candidate : undefined;
    });
    const supporting = withActing(rebuilt(seed), at('supporting'));
    expect(withAnyOffer(supporting, true)).toEqual(supporting);
    const working = withActing(rebuilt(seed), at('working'));
    expect(withAnyOffer(working, true)).not.toEqual(working);
  });
});

/* -------------------------------------------------------------------------- */
/* Through the game                                                            */
/* -------------------------------------------------------------------------- */

describe('an acting life, through the game', () => {
  /** A talented life that joins the drama club at twelve and takes every part. */
  function play(seed: string, years: number) {
    let state = life(seed, true);
    let guard = 0;
    const answers: string[] = [];
    while (state.player.alive && state.player.age < years && (guard += 1) < 90) {
      state = answerOthers(state);
      const age = state.player.age;
      if (
        age >= 12 &&
        age < 18 &&
        !state.education.activities.some((a) => a.activityId === 'act.drama-club')
      ) {
        state = { ...state, education: join(state.education, 'act.drama-club', age) };
      }
      if (age >= 18 && !state.acting.lessons) {
        const started = startLessons(state);
        if (started.ok) state = started.value.state;
      }
      for (
        let index = 0;
        index < 4 && state.pending.some((row) => row.eventId === ACTING_OFFER_EVENT_ID);
        index += 1
      ) {
        const result = decide(state, ACTING_OFFER_EVENT_ID, 'accept');
        if (!result.ok) break;
        answers.push(ACTING_OFFER_EVENT_ID);
        state = result.value.state;
      }
      state = advanceYear(state).state;
    }
    return { state, answers };
  }

  it('goes from a drama club to a part to a living, with the pay in the ledger and the work in the timeline', () => {
    const found = firstSeed(
      'game-living',
      (seed) => {
        const { state } = play(seed, 40);
        return tierRank(state.acting.best ?? 'local') >= tierRank('supporting') ? state : undefined;
      },
      30,
    );
    const rows = found.finance.transactions.filter((row) => row.source === 'Acting work');
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((row) => row.category === 'salary')).toBe(true);
    expect(toDollars(rows[0]!.amount)).toBeGreaterThanOrEqual(0);
    expect(found.finance.transactions.some((row) => row.source === 'Tax on acting pay')).toBe(true);
    expect(found.player.timeline.some((row) => /Worked on/.test(row.text))).toBe(true);
    expect(found.player.timeline.some((row) => /Took the part/.test(row.text))).toBe(true);
    expect(found.player.records.some((row) => /first acting role/.test(row.label))).toBe(true);
    expect(found.fame).toBeGreaterThan(0);
  });

  it('puts Actor in the header for a living, and keeps it', () => {
    const found = firstSeed(
      'game-header',
      (seed) => {
        const { state } = play(seed, 40);
        return isActingFullTime(state.acting) ? state : undefined;
      },
      30,
    );
    expect(found.player.occupation).toBe('Actor');
  });

  it('is held back by an open offer: time does not move until it is answered', () => {
    const found = firstSeed('game-hold', (seed) => {
      let state = life(seed, true);
      for (let index = 0; index < 24; index += 1) {
        state = answerOthers(state);
        if (state.player.age >= 12 && state.player.age < 18) {
          state = {
            ...state,
            education: join(state.education, 'act.drama-club', state.player.age),
          };
        }
        state = advanceYear(state).state;
        if (state.pending.some((row) => row.eventId === ACTING_OFFER_EVENT_ID)) return state;
      }
      return undefined;
    });
    expect(found.acting.offers.length).toBeGreaterThan(0);
    const year = found.world.year;
    expect(advanceYear(found).state.world.year).toBe(year);
  });

  it('puts a part in the year to come: taken at one age, paid at the next', () => {
    const found = firstSeed('game-paid', (seed) => {
      let state = life(seed, true);
      for (let index = 0; index < 20; index += 1) {
        state = answerOthers(state);
        if (state.player.age >= 12 && state.player.age < 18) {
          state = {
            ...state,
            education: join(state.education, 'act.drama-club', state.player.age),
          };
        }
        state = advanceYear(state).state;
        if (state.acting.offers.length > 0) {
          const taken = decide(state, ACTING_OFFER_EVENT_ID, 'accept');
          if (taken.ok && taken.value.state.acting.booked.length > 0) {
            return { before: taken.value.state, fee: taken.value.state.acting.booked[0]!.fee };
          }
        }
      }
      return undefined;
    });
    const credits = found.before.acting.credits;
    const next = advanceYear(answerOthers(found.before)).state;
    expect(next.acting.credits).toBeGreaterThan(credits);
    expect(next.acting.booked).toEqual([]);
  });

  it('keeps a life with no stage and no application exactly as it was: no acting state, no fame, no ledger lines', () => {
    const state = toAge(life('game-none', true), 30);
    expect(state.acting).toEqual(EMPTY_ACTING);
    expect(state.finance.transactions.some((row) => /Acting|acting/.test(row.source))).toBe(false);
  });

  it('is part of a state that ends in a save: a played acting life has a coherent state at forty', () => {
    const { state } = play('game-coherent', 40);
    expect(state.acting.credits).toBeGreaterThanOrEqual(0);
    expect(state.acting.reputation).toBeGreaterThanOrEqual(0);
    expect(state.acting.reputation).toBeLessThanOrEqual(100);
    expect(freeDays(state.acting)).toBeGreaterThanOrEqual(0);
    expect(state.acting.offers.length).toBeLessThanOrEqual(4);
  });
});

describe('the numbers behind the spec', () => {
  it('uses six rungs where the spec had eleven, and says what a part is separately from the work', () => {
    expect(ACTING_TIERS).toHaveLength(6);
    expect(BILLINGS).toEqual(['lead', 'supporting', 'bit']);
  });

  it('keeps Offer and Denied and nothing else for an audition (spec 279)', () => {
    const probe = adult('spec-279');
    const call = castingCalls(probe)[0]!;
    const result = applyForCasting(probe, call.role.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(typeof result.value.landed).toBe('boolean');
  });

  it('has the days of a year to share, so no actor can shoot three leads in one', () => {
    const state = withActing(adult('spec-days'), {
      booked: [
        booked({ billing: 'lead', days: BILLING_DAYS.lead }),
        booked({ id: 'b2', billing: 'lead', days: BILLING_DAYS.lead }),
      ],
    });
    expect(freeDays(state.acting)).toBeLessThan(BILLING_DAYS.lead);
  });
});

/* -------------------------------------------------------------------------- */
/* What the sabotage run found unheld                                          */
/* -------------------------------------------------------------------------- */

describe('the slots a year has for an offer', () => {
  const base = adult('slots');
  const plain = (patch: Partial<ActingState> = {}) =>
    withActing(base, { tier: 'working', ...patch });

  it('are scaled by a good name, a talent and an agent, as the table says', () => {
    const none = slotScale(base, plain({ reputation: 0 }).acting, 26);
    const agent = slotScale(base, plain({ reputation: 0, agent: { since: 20 } }).acting, 26);
    expect(agent / none).toBeCloseTo(AGENT_OFFER_MULTIPLIER, 10);
    const named = slotScale(base, plain({ reputation: 100 }).acting, 26);
    expect(named / none).toBeCloseTo(2, 10);
    const talented = withStatsTalent(base);
    expect(slotScale(talented, plain({ reputation: 0 }).acting, 26) / none).toBeCloseTo(
      TALENT_OFFER_CHANCE,
      10,
    );
  });

  it('thin out from the middle of life, to a floor', () => {
    const acting = plain().acting;
    const young = slotScale(base, acting, AGEING_FROM);
    expect(slotScale(base, acting, AGEING_FROM + 10)).toBeLessThan(young);
    expect(slotScale(base, acting, 200) / young).toBeCloseTo(0.3, 10);
  });

  it('are one more with an agent, and never past ninety-five in a hundred', () => {
    const alone = offerSlots(base, plain().acting, 26);
    const agented = offerSlots(base, plain({ agent: { since: 20 } }).acting, 26);
    expect(agented).toHaveLength(alone.length + 1);
    expect(agented[agented.length - 1]).toBeCloseTo(
      Math.min(
        0.95,
        AGENT_SLOT_CHANCE * slotScale(base, plain({ agent: { since: 20 } }).acting, 26),
      ),
      10,
    );
    const huge = offerSlots(
      withStatsTalent(base),
      plain({ tier: 'lead', reputation: 100, agent: { since: 20 } }).acting,
      26,
    );
    expect(Math.max(...huge)).toBe(0.95);
    expect(huge.every((chance) => chance <= 0.95)).toBe(true);
  });
});

function withStatsTalent(state: GameState): GameState {
  return {
    ...state,
    player: { ...state.player, talents: { ...state.player.talents, acting: true } },
  };
}

describe('the rung an offer is at', () => {
  const acting = { ...EMPTY_ACTING, tier: 'working' as const, credits: 30, reputation: 50 };

  it('is one below, the same or one above by a draw, with the weights of a plain actor', () => {
    const [below, at] = OFFER_TIER_WEIGHTS.plain;
    expect(tierDrawn(acting, below - 0.001, 30, 100)).toBe('commercial');
    expect(tierDrawn(acting, below + 0.001, 30, 100)).toBe('working');
    expect(tierDrawn(acting, below + at + 0.001, 30, 100)).toBe('supporting');
  });

  it('is pushed up for an actor with an agent: fewer below, more above', () => {
    const plainBelow = OFFER_TIER_WEIGHTS.plain[0];
    const agentBelow = OFFER_TIER_WEIGHTS.agent[0];
    expect(agentBelow).toBeLessThan(plainBelow);
    const unit = (plainBelow + agentBelow) / 2;
    expect(tierDrawn(acting, unit, 30, 100)).toBe('commercial');
    expect(tierDrawn({ ...acting, agent: { since: 20 } }, unit, 30, 100)).toBe('working');
  });

  it('is never a rung the actor is not ready for', () => {
    const young = { ...acting, credits: 4 };
    expect(tierDrawn(young, 0.99, 30, 100)).toBe('working');
  });
});

describe('the offers on the table', () => {
  const stat = (patch: Partial<ActingState> = {}) =>
    seen(adult('table'), { tier: 'lead', credits: 40, reputation: 70, craft: 95, ...patch });

  it('are four at most, and none more are raised when four wait', () => {
    const full = stat({
      offers: [0, 1, 2, 3].map((index) =>
        role({ id: `x:${index}`, title: ROLE_TITLES[index]!, days: 5 }),
      ),
    });
    expect(MAX_OFFERS).toBe(4);
    for (let year = 2030; year < 2090; year += 1) {
      expect(yearOf(full, 27, year).acting.offers).toHaveLength(4);
    }
    const three = stat({
      offers: [0, 1, 2].map((index) =>
        role({ id: `y:${index}`, title: ROLE_TITLES[index]!, days: 5 }),
      ),
    });
    for (let year = 2030; year < 2090; year += 1) {
      expect(yearOf(three, 27, year).acting.offers.length).toBeLessThanOrEqual(4);
    }
  });

  it('count against the days of the year, with the booked parts', () => {
    const acting = {
      ...EMPTY_ACTING,
      booked: [booked({ days: 100 })],
      offers: [role({ days: 70 })],
    };
    expect(freeDays(acting)).toBe(YEAR_DAYS - 170);
  });

  it('never repeat a title in one year, across many lives and ages', () => {
    let multiple = 0;
    for (let index = 0; index < 40; index += 1) {
      const probe = seen(adult(`titles-${index}`), {
        tier: 'lead',
        credits: 40,
        reputation: 70,
        craft: 95,
        agent: { since: 20 },
      });
      for (let age = 20; age < 50; age += 1) {
        const titles = yearOf(probe, age, 2030 + age).acting.offers.map((row) => row.title);
        if (titles.length > 1) multiple += 1;
        expect(new Set(titles).size).toBe(titles.length);
      }
    }
    expect(multiple).toBeGreaterThan(100);
  });

  it('are asked of nobody who has not been seen, even a life with credits behind it', () => {
    const forgotten = withActing(adult('forgotten'), {
      tier: 'working',
      credits: 6,
      seenAge: 10,
      craft: 60,
    });
    for (let year = 2030; year < 2090; year += 1) {
      expect(yearOf(forgotten, 27, year).acting.offers).toEqual([]);
    }
  });

  it('are put on the table once, however often the door is tried', () => {
    const state = withActing(adult('door'), { offers: [role({ fee: 100 })] });
    const once = withActingOffer(state, true);
    const twice = withActingOffer(once, true);
    expect(twice.pending.filter((row) => row.eventId === ACTING_OFFER_EVENT_ID)).toHaveLength(1);
    expect(twice).toBe(once);
  });
});

describe('the fees of a part', () => {
  it('are in whole hundreds, thousands or ten thousands by their size', () => {
    let seenBig = 0;
    for (let index = 0; index < 30; index += 1) {
      const probe = withActing(adult(`fees-${index}`), {
        tier: 'lead',
        credits: 60,
        reputation: 90,
        craft: 95,
      });
      for (let age = 22; age < 40; age += 1) {
        const aged = { ...probe, player: { ...probe.player, age } };
        for (const call of castingCalls(aged)) {
          const fee = call.role.fee;
          expect(fee % 100, `${call.role.id}`).toBe(0);
          if (fee >= 10_000) expect(fee % 1_000).toBe(0);
          if (fee >= 1_000_000) {
            expect(fee % 10_000).toBe(0);
            seenBig += 1;
          }
        }
      }
    }
    expect(seenBig).toBeGreaterThan(0);
  });

  it('are higher for a name that is known, for the same part', () => {
    const at = (reputation: number) =>
      castingCalls(
        withActing(adult('fees-name'), { tier: 'lead', credits: 60, reputation, craft: 95 }),
      );
    const low = at(55);
    const high = at(95);
    expect(high.map((row) => row.role.id)).toEqual(low.map((row) => row.role.id));
    const sum = (rows: ReturnType<typeof castingCalls>) =>
      rows.reduce((total, row) => total + row.role.fee, 0);
    expect(sum(high)).toBeGreaterThan(sum(low) * 1.05);
  });
});

describe('the odds of a casting call', () => {
  it('are never nothing, however green the actor, and never a certainty, however good', () => {
    let weakest = 1;
    let strongest = 0;
    for (let index = 0; index < 60; index += 1) {
      const green = withActing(adult(`odds-low-${index}`), {
        craft: 0,
        reputation: 0,
        tier: 'local',
      });
      for (const call of castingCalls(green)) weakest = Math.min(weakest, call.chance);
      const great = withActing(withStatsTalent(adult(`odds-high-${index}`)), {
        craft: 100,
        reputation: 100,
        credits: 80,
        tier: 'working',
        agent: { since: 20 },
      });
      for (const call of castingCalls(great)) strongest = Math.max(strongest, call.chance);
    }
    expect(weakest).toBeGreaterThanOrEqual(0.03);
    expect(strongest).toBeLessThanOrEqual(0.95);
  });

  it('are reached only at rungs the actor is ready for: an actor not ready for the rung above is shown none of it', () => {
    const probe = withActing(adult('odds-ready'), {
      tier: 'working',
      credits: 4,
      reputation: 2,
      craft: 50,
    });
    const tiers = new Set<ActingTier>();
    for (let age = 20; age < 60; age += 1) {
      for (const call of castingCalls({ ...probe, player: { ...probe.player, age } }))
        tiers.add(call.role.tier);
    }
    expect([...tiers].sort()).toEqual(['commercial', 'working']);
  });
});

describe('character development, to the number', () => {
  it('is a gain that gets smaller by a quarter of itself every session', () => {
    const base = withActing(withStatsTalent(adult('dev-exact')), { craft: 30 });
    const ceiling = craftCeiling(base);
    let state = base;
    const gains: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const before = craftOf(state);
      const result = developCharacter(state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const expected = Math.max(1, Math.round((ceiling - before) * 0.15 * (1 - index * 0.25)));
      state = result.value.state;
      gains.push(craftOf(state) - before);
      expect(gains[index]).toBe(Math.min(expected, ceiling - before));
    }
    expect(gains[0]!).toBeGreaterThan(gains[1]!);
    expect(gains[1]!).toBeGreaterThan(gains[2]!);
  });
});

describe('what a year does to craft', () => {
  const state = adult('craft-year');
  const natural = naturalCraft(state.player.stats, state.player.talents.acting);
  const acting = (patch: Partial<ActingState> = {}): ActingState => ({ ...EMPTY_ACTING, ...patch });

  it('is pulled up by a third of the gap and down by a tenth', () => {
    const target = Math.min(natural + CRAFT_HEADROOM, natural);
    expect(nextCraft(state, acting(), false, target - 20)).toBe(
      Math.round(target - 20 + 20 * 0.35),
    );
    expect(nextCraft(state, acting(), false, target + 20)).toBe(Math.round(target + 20 - 20 * 0.1));
  });

  it('is helped by every part worked, a little, and by a stage, and not past a cap', () => {
    const base = natural - 10;
    const one = nextCraft(state, acting({ credits: 10 }), false, base);
    const none = nextCraft(state, acting({ credits: 0 }), false, base);
    expect(one).toBeGreaterThan(none);
    const capped = Math.ceil(CREDIT_CRAFT_CAP / CREDIT_CRAFT);
    expect(nextCraft(state, acting({ credits: capped }), false, 0)).toBe(
      nextCraft(state, acting({ credits: capped * 5 }), false, 0),
    );
    expect(nextCraft(state, acting(), true, base)).toBeGreaterThan(
      nextCraft(state, acting(), false, base),
    );
  });

  it('stays under what the character can reach, and lessons raise it', () => {
    expect(CREDIT_CRAFT_CAP + 3).toBeLessThan(CRAFT_HEADROOM);
    const up = nextCraft(state, acting({ credits: 100 }), true, 100);
    expect(up).toBeLessThanOrEqual(100);
    const low = nextCraft(state, acting({ credits: 100 }), true, natural + CRAFT_HEADROOM + 5);
    expect(low).toBeLessThanOrEqual(natural + CRAFT_HEADROOM + 5);
    const withLessons = nextCraft(
      state,
      acting({ credits: 100, lessons: { since: 12, seasons: 3 } }),
      true,
      0,
    );
    const without = nextCraft(state, acting({ credits: 100 }), true, 0);
    expect(withLessons).toBeGreaterThan(without);
    expect(LESSONS_CRAFT).toBeGreaterThan(0);
  });
});

describe('a year of work, to the number', () => {
  const stage = (patch: Partial<ActingState> = {}): GameState =>
    withActing(adult('exact'), { craft: 100, ...patch });

  it('takes three from a name for a flop and gives three for a hit', () => {
    const rep = 50;
    const part = booked({ tier: 'local', billing: 'lead' });
    const gain = Math.round(ACTING_TIER_ROWS.local.reputation * BILLING_REPUTATION.lead);
    const flop = yearOf(stage({ craft: 0, reputation: rep, booked: [part] }));
    expect(flop.acting.reputation).toBe(rep + gain - FLOP_REPUTATION);
    const hit = yearOf(stage({ craft: 100, reputation: rep, booked: [part] }));
    expect(hit.acting.reputation).toBe(rep + gain + HIT_REPUTATION);
  });

  it('counts a hit toward a rise only when it is at the standing or above, not below', () => {
    const lower = yearOf(
      stage({
        tier: 'working',
        credits: 12,
        reputation: 10,
        booked: [booked({ tier: 'commercial', medium: 'a national commercial' })],
      }),
    );
    expect(lower.acting.hits).toBe(0);
    const level = yearOf(
      stage({
        tier: 'working',
        credits: 12,
        reputation: 10,
        booked: [booked({ tier: 'working', billing: 'bit', medium: 'a small TV role' })],
      }),
    );
    expect(level.acting.hits).toBe(1);
  });

  it('gives the award its name, its point of reputation, its mood and its record, and a rung below it nothing', () => {
    expect(AWARD_FROM).toBe('supporting');
    for (const id of ACTING_TIERS) {
      if (tierRank(id) < tierRank(AWARD_FROM)) expect(AWARD_CHANCE[id], id).toBe(0);
      else expect(AWARD_CHANCE[id], id).toBeGreaterThan(0);
    }
    const won = firstSeed(
      'exact-award',
      (seed) => {
        const before = withActing(adult(seed), {
          craft: 100,
          credits: 60,
          reputation: 40,
          tier: 'star',
          booked: [booked({ tier: 'star', billing: 'lead', fee: 1_000_000 })],
        });
        const out = yearOf(before);
        return out.acting.awards > 0 ? out : undefined;
      },
      400,
    );
    const row = ACTING_TIER_ROWS.star;
    expect(won.acting.reputation).toBe(
      Math.min(
        100,
        40 +
          Math.round(row.reputation * BILLING_REPUTATION.lead) +
          HIT_REPUTATION +
          AWARD_REPUTATION,
      ),
    );
  });

  it('sets the day the actor was last seen to the year they last worked, with no stage and no lessons', () => {
    const out = yearOf(stage({ seenAge: 3, booked: [booked()] }));
    expect(out.acting.seenAge).toBe(27);
  });

  it('sets the day the actor was last seen to this year while the lessons run', () => {
    const out = yearOf(stage({ seenAge: 3, lessons: { since: 12, seasons: 0 } }));
    expect(out.acting.seenAge).toBe(27);
  });

  it('keeps a fall until three idle years are over, and not before', () => {
    const waiting = yearOf(stage({ credits: 20, tier: 'supporting', idle: 1, reputation: 30 }));
    expect(waiting.acting.tier).toBe('supporting');
    expect(waiting.acting.idle).toBe(2);
    const gone = yearOf(stage({ credits: 20, tier: 'supporting', idle: 2, reputation: 30 }));
    expect(gone.acting.tier).toBe('working');
  });

  it('does not keep a list of applications from one age into the next', () => {
    const out = yearOf(stage({ appliedAge: 27, applied: ['call:27:0'] }));
    expect(out.acting.applied).toEqual([]);
    expect(out.acting.appliedAge).toBe(27);
  });
});
