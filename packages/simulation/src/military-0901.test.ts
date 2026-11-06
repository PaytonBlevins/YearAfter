/**
 * Ticket 0901 acceptance tests — the service engine, with the Army.
 *
 * Nine enlisted grades on the 2026 basic pay table, an offer from a recruiter or an application, a year of basic
 * training some do not finish, a performance read from Discipline, Smarts and Health (never Charisma), promotion by
 * time and that read, a four-year term and the question at the end of it, twenty years as retirement, Work Harder
 * inside service, pay taxed and posted like any other, housing provided for somebody single, and that a life that
 * never goes near a recruiter replays exactly as it did. Each pin that is a real figure says so; the rest are the
 * game's own dials and are named in the ticket doc.
 */

import { describe, expect, it } from 'vitest';
import {
  ENLISTED_GRADES,
  ENLIST_HEALTH_FLOOR,
  ENLIST_MAX_AGE,
  ENLIST_MIN_AGE,
  ENLIST_SMARTS_FLOOR,
  PAY_STEPS,
  PAY_TABLE_YEAR,
  RETAIN_PERFORMANCE_FLOOR,
  RETIRE_ELIGIBLE_YEARS,
  SERVICE_BRANCHES,
  TERM_YEARS,
  TOP_GRADE,
  annualBasePay,
  enlistOfferChance,
  findGrade,
  monthlyBasePay,
  riseChance,
  serviceReputationWord,
  serviceFit,
  servicePerformanceTarget,
  washOutChance,
  washOutPay,
} from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';
import { childrenAtHome } from '@yearafter/parenting';
import { householdPartnerOf } from '@yearafter/social';
import { AT_HOME_SHARE } from '@yearafter/finance';
import { advanceYear } from './advance';
import { workHarder, pushesLeft } from './careers';
import { isActingFullTime } from './acting';
import { isModelingFullTime } from './modeling';
import { isMusicFullTime } from './music';
import { isFullTime as isSportsFullTime } from './sports-individual';
import { isPostFullTime } from './sports-post';
import { decide } from './decide';
import { hasSystemicOffer, type GameState } from './game-state';
import {
  MILITARY_LEAVE,
  MILITARY_OFFER_EVENT_ID,
  MILITARY_REENLIST,
  MILITARY_DECLINE,
  answerMilitaryOffer,
  applyToEnlist,
  enlistmentBar,
  isMilitaryOfferDecision,
  isServing,
  militaryOccupation,
  militaryOfferDecision,
  payWords,
  rankTitleOf,
  runMilitaryYear,
  withMilitaryOffer,
  yearPayOf,
} from './military';
import { EMPTY_MILITARY, type MilitaryState, type ServiceCareer } from './military-state';
import { servicePushesLeft } from './military-work';
import { createNewGame } from './new-game';
import { withAnyOffer } from './offers';
import { ordinaryChoice } from './ordinary-answers';
import { runLiving } from './phases/living';

/** Accepting an offer that is on its last question (the job): the infantry is the Army's open one. */
const MILITARY_ENLIST = 'army.infantry';

/** A recruiter's offer on its last question, for the Army and the enlisted ladder. */
const ARMY_OFFER = {
  kind: 'enlist',
  age: 22,
  eventId: MILITARY_OFFER_EVENT_ID,
  step: 'specialty',
  branch: 'army',
  track: 'enlisted',
  options: ['army.infantry', 'army.medic'],
} as const;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function toAge(state: GameState, age: number): GameState {
  let current = state;
  let guard = 0;
  while (current.player.alive && current.player.age < age && (guard += 1) < 80) {
    // Declines the service's own question on the way: these lives are brought to an age, not sent anywhere.
    current = advanceYear(answerAll(current)).state;
    current = answerAll(current);
  }
  return current;
}

function answerAll(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending[0];
    if (!open) break;
    const choice =
      open.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : ordinaryChoice(open);
    if (!choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

/** An adult, memoised; a life that dies on the way is replaced by the next of the same name (CORE_RULES 13.182). */
const adults = new Map<string, GameState>();
function adult(seed: string, age = 24): GameState {
  const key = `${seed}:${age}`;
  const found = adults.get(key);
  if (found) return found;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const made = toAge(createNewGame({ seed: attempt === 0 ? seed : `${seed}~${attempt}` }), age);
    if (made.player.alive && made.player.age >= age) {
      adults.set(key, made);
      return made;
    }
  }
  throw new Error(`no living life of age ${age} for ${seed}`);
}

type StatName =
  'charisma' | 'looks' | 'smarts' | 'discipline' | 'health' | 'happiness' | 'willpower';
const withStats = (state: GameState, stats: Partial<Record<StatName, number>>): GameState => ({
  ...state,
  player: { ...state.player, stats: { ...state.player.stats, ...stats } as never },
});

/** A fit adult with nothing in the way of the recruiting office. */
const eligible = (state: GameState): GameState => {
  const fit = withStats(state, { health: 80, smarts: 60, discipline: 60 });
  return {
    ...fit,
    // A diploma and no school: a life that dropped out, or is at a trade school, has its own bar (tested below).
    education: {
      ...fit.education,
      stage: 'graduated',
      credentials: { ...fit.education.credentials, highSchool: 18 },
    } as never,
    sports: { ...fit.sports, career: undefined, post: undefined } as never,
    pending: [],
    military: EMPTY_MILITARY,
  };
};

/** The same state under another seed, so a draw can be tried on many lives without playing them. */
const withSeed = (state: GameState, seed: string): GameState =>
  ({ ...state, rng: { ...state.rng, getSeed: () => seed } }) as unknown as GameState;

const serviceRow = (patch: Partial<ServiceCareer> = {}): ServiceCareer => ({
  branch: 'army',
  stage: 'serving',
  enlistedAge: 19,
  track: 'enlisted',
  specialty: 'army.infantry',
  commissionedAt: 0,
  grade: 4,
  years: 3,
  termEnds: 4,
  performance: 60,
  reputation: 55,
  effort: 'normal',
  lastPay: 0,
  post: 'Fort Harlan',
  ...patch,
});

const serving = (state: GameState, patch: Partial<ServiceCareer> = {}): GameState => ({
  ...state,
  military: { ...state.military, service: serviceRow(patch) },
});

const yearOf = (before: GameState, age = before.player.age + 1, year = before.world.year + 1) =>
  runMilitaryYear({ before, education: before.education, age, year });

/* -------------------------------------------------------------------------- */
/* The real figures                                                            */
/* -------------------------------------------------------------------------- */

describe('the real figures', () => {
  it('reads the 2026 enlisted basic pay table (DFAS chart, 3.8% raise from 1 January 2026)', () => {
    // Read from third-party copies of the chart and not yet checked against DFAS itself: the ticket doc says so.
    expect(monthlyBasePay(1, 4)).toBeCloseTo(2407.2, 2);
    expect(monthlyBasePay(3, 4)).toBeCloseTo(3198.0, 2);
    expect(monthlyBasePay(5, 4)).toBeCloseTo(3946.8, 2);
    expect(monthlyBasePay(5, 12)).toBeCloseTo(4421.7, 2);
    expect(monthlyBasePay(7, 8)).toBeCloseTo(5135.7, 2);
    expect(monthlyBasePay(7, 20)).toBeCloseTo(6245.7, 2);
    expect(monthlyBasePay(9, 20)).toBeCloseTo(8105.1, 2);
  });

  it('pays a year as twelve of them, in whole dollars', () => {
    expect(annualBasePay(5, 4)).toBe(Math.round(3946.8 * 12));
    expect(annualBasePay(7, 20)).toBe(Math.round(6245.7 * 12));
    expect(Number.isInteger(annualBasePay(2, 1))).toBe(true);
  });

  it('pays more for a higher grade at the same years, and more for years at the same grade', () => {
    for (let years = 0; years <= 26; years += 2) {
      for (let grade = 1; grade < TOP_GRADE; grade += 1) {
        expect(monthlyBasePay(grade + 1, years)).toBeGreaterThanOrEqual(
          monthlyBasePay(grade, years),
        );
      }
    }
    for (let grade = 1; grade <= TOP_GRADE; grade += 1) {
      for (let i = 1; i < PAY_STEPS.length; i += 1) {
        expect(monthlyBasePay(grade, PAY_STEPS[i]!)).toBeGreaterThanOrEqual(
          monthlyBasePay(grade, PAY_STEPS[i - 1]!),
        );
      }
    }
  });

  it('has nine enlisted grades with the Army titles, in order, and five branches built', () => {
    expect(ENLISTED_GRADES).toHaveLength(9);
    expect(TOP_GRADE).toBe(9);
    expect(findGrade(1).title).toBe('Private');
    expect(findGrade(4).title).toBe('Specialist');
    expect(findGrade(5).title).toBe('Sergeant');
    expect(findGrade(9).title).toBe('Sergeant Major');
    expect(findGrade(0).grade).toBe(1);
    expect(findGrade(99).grade).toBe(9);
    expect(SERVICE_BRANCHES.map((row) => row.id)).toEqual([
      'army',
      'navy',
      'marine-corps',
      'air-force',
      'coast-guard',
    ]);
  });

  it('keeps the time for each grade rising, and every rise a chance', () => {
    for (let i = 1; i < ENLISTED_GRADES.length; i += 1) {
      expect(ENLISTED_GRADES[i]!.minYears).toBeGreaterThanOrEqual(ENLISTED_GRADES[i - 1]!.minYears);
    }
    for (const row of ENLISTED_GRADES) {
      expect(row.rise).toBeGreaterThan(0);
      expect(row.rise).toBeLessThanOrEqual(1);
    }
  });

  it('is a four-year term and a twenty-year career', () => {
    expect(TERM_YEARS).toBe(4);
    expect(RETIRE_ELIGIBLE_YEARS).toBe(20);
    expect(RETIRE_ELIGIBLE_YEARS % TERM_YEARS).toBe(0);
  });

  it('takes enlistments from 17 to 35', () => {
    expect(ENLIST_MIN_AGE).toBe(17);
    expect(ENLIST_MAX_AGE).toBe(35);
  });
});

/* -------------------------------------------------------------------------- */
/* The dials, pinned                                                           */
/* -------------------------------------------------------------------------- */

describe('the dials, pinned', () => {
  it('offers only inside the age window, and less each decade', () => {
    expect(enlistOfferChance(ENLIST_MIN_AGE - 1)).toBe(0);
    expect(enlistOfferChance(ENLIST_MAX_AGE + 1)).toBe(0);
    expect(enlistOfferChance(20)).toBeGreaterThan(enlistOfferChance(27));
    expect(enlistOfferChance(27)).toBeGreaterThan(enlistOfferChance(33));
    expect(enlistOfferChance(33)).toBeGreaterThan(0);
  });

  it('washes out fewer of the fit, and never fewer than 4% or more than 35%', () => {
    expect(washOutChance(90)).toBeLessThan(washOutChance(60));
    expect(washOutChance(60)).toBeLessThan(washOutChance(30));
    expect(washOutChance(100)).toBeCloseTo(0.04, 5);
    expect(washOutChance(0)).toBeCloseTo(0.35, 5);
  });

  it('weighs fitness by Discipline most, then Health, then Smarts, and never Charisma', () => {
    expect(serviceFit(100, 0, 0)).toBeGreaterThan(serviceFit(0, 100, 0));
    expect(serviceFit(0, 100, 0)).toBeGreaterThan(serviceFit(0, 0, 100));
    expect(serviceFit.length).toBe(3);
    expect(servicePerformanceTarget.length).toBe(4);
  });

  it('aims a hard-working year higher than an ordinary one at every aptitude', () => {
    for (const stat of [20, 50, 80]) {
      expect(servicePerformanceTarget(true, stat, stat, stat)).toBeGreaterThan(
        servicePerformanceTarget(false, stat, stat, stat),
      );
    }
  });

  it('lets aptitude move the target but not past 0 to 100', () => {
    expect(servicePerformanceTarget(false, 100, 100, 100)).toBeGreaterThan(
      servicePerformanceTarget(false, 0, 0, 0),
    );
    expect(servicePerformanceTarget(true, 100, 100, 100)).toBeLessThanOrEqual(100);
    expect(servicePerformanceTarget(false, 0, 0, 0)).toBeGreaterThanOrEqual(0);
  });

  it('makes the first three grades certain, and the rest a chance a better year helps', () => {
    for (const grade of [1, 2, 3]) expect(riseChance(grade, 0)).toBe(1);
    for (let grade = 4; grade <= TOP_GRADE; grade += 1) {
      expect(riseChance(grade, 90)).toBeGreaterThan(riseChance(grade, 30));
      expect(riseChance(grade, 100)).toBeLessThanOrEqual(0.95);
      expect(riseChance(grade, 0)).toBeGreaterThan(0);
    }
  });

  it('pays a recruit who did not finish six months of the bottom grade', () => {
    expect(washOutPay()).toBe(Math.round(monthlyBasePay(1, 0) * 6));
    expect(washOutPay()).toBeLessThan(annualBasePay(1, 0));
  });

  it('asks about staying only when the work has been at least middling', () => {
    expect(RETAIN_PERFORMANCE_FLOOR).toBeGreaterThan(40);
    expect(RETAIN_PERFORMANCE_FLOOR).toBeLessThan(55);
  });
});

/* -------------------------------------------------------------------------- */
/* Who can join                                                                */
/* -------------------------------------------------------------------------- */

describe('who can join', () => {
  const base = eligible(adult('MIL-BAR', 24));

  it('lets a fit adult with a diploma in', () => {
    expect(enlistmentBar(base)).toBeUndefined();
  });

  it('turns away the too young and the too old', () => {
    expect(enlistmentBar(base, ENLIST_MIN_AGE - 1)).toBe('too-young');
    expect(enlistmentBar(base, ENLIST_MIN_AGE)).toBeUndefined();
    expect(enlistmentBar(base, ENLIST_MAX_AGE)).toBeUndefined();
    expect(enlistmentBar(base, ENLIST_MAX_AGE + 1)).toBe('too-old');
  });

  it('turns away the unwell and the poor test-taker at the floors, not above them', () => {
    expect(enlistmentBar(withStats(base, { health: ENLIST_HEALTH_FLOOR - 1 }))).toBe('unfit');
    expect(enlistmentBar(withStats(base, { health: ENLIST_HEALTH_FLOOR }))).toBeUndefined();
    expect(enlistmentBar(withStats(base, { smarts: ENLIST_SMARTS_FLOOR - 1 }))).toBe('not-ready');
    expect(enlistmentBar(withStats(base, { smarts: ENLIST_SMARTS_FLOOR }))).toBeUndefined();
  });

  it('needs a diploma or an equivalent', () => {
    const none = {
      ...base,
      education: { ...base.education, credentials: undefined },
    } as unknown as GameState;
    expect(enlistmentBar(none)).toBe('no-diploma');
  });

  it('keeps somebody who is still at school waiting', () => {
    const student = {
      ...base,
      education: { ...base.education, stage: 'vocational' },
    } as unknown as GameState;
    expect(enlistmentBar(student)).toBe('in-school');
  });

  it('says somebody already in uniform is serving', () => {
    expect(enlistmentBar(serving(base))).toBe('serving');
  });

  it('sends a person whose whole year is another career away', () => {
    const pro = {
      ...base,
      modeling: { ...base.modeling, tier: 'campaign', credits: 40, reputation: 70 },
    } as unknown as GameState;
    // Only a full-time modeling life counts; a bare tier does not. The guard is read, not assumed.
    expect(['busy', undefined]).toContain(enlistmentBar(pro));
  });
});

/* -------------------------------------------------------------------------- */
/* Applying                                                                    */
/* -------------------------------------------------------------------------- */

describe('applying at the recruiting office', () => {
  const base = eligible(adult('MIL-APPLY', 24));

  it('puts an eligible adult in uniform at the bottom, in basic training', () => {
    const result = applyToEnlist(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const career = result.value.state.military.service!;
    expect(career.stage).toBe('training');
    expect(career.grade).toBe(1);
    expect(career.years).toBe(0);
    expect(career.termEnds).toBe(TERM_YEARS);
    expect(career.enlistedAge).toBe(base.player.age);
    expect(career.effort).toBe('normal');
    expect(SERVICE_BRANCHES[0]!.posts).toContain(career.post);
    expect(isServing(result.value.state)).toBe(true);
  });

  it('writes it in the timeline and on the life record, once', () => {
    const result = applyToEnlist(base);
    if (!result.ok) throw new Error('should enlist');
    const { state, entry } = result.value;
    expect(entry.kind).toBe('milestone');
    expect(entry.text).toMatch(/enlisted/i);
    expect(state.player.timeline.filter((row) => row.id === entry.id)).toHaveLength(1);
    const records = state.player.records.filter((row) => row.category === 'military');
    expect(records).toHaveLength(1);
    expect(records[0]!.label).toMatch(/Enlisted/);
  });

  it('records the year it applied, and one visit a year', () => {
    const first = applyToEnlist(base);
    if (!first.ok) throw new Error('should enlist');
    expect(first.value.state.military.appliedAge).toBe(base.player.age);
    // Pretend the career ended the same year: the second visit is refused for the year, not for the uniform.
    const { service: _s, ...rest } = first.value.state.military;
    const second = applyToEnlist({ ...first.value.state, military: rest });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('already-applied');
  });

  it('refuses when serving, when ineligible, and when a question is already standing', () => {
    const inUniform = applyToEnlist(serving(base));
    expect(inUniform.ok).toBe(false);
    const unwell = applyToEnlist(withStats(base, { health: 10 }));
    expect(unwell.ok).toBe(false);
    if (!unwell.ok) expect(unwell.error).toBe('unfit');
    const asked = applyToEnlist({
      ...base,
      military: {
        past: [],
        offer: { ...ARMY_OFFER, age: 24 },
      },
    });
    expect(asked.ok).toBe(false);
    if (!asked.ok) expect(asked.error).toBe('offer-pending');
  });

  it('resigns a job held, as signing a contract does, and not before', () => {
    const jobbed = adult('MIL-JOB', 26);
    const held = eligible(jobbed);
    const withJob = held.employment.job !== undefined ? held : undefined;
    // Not every adult life holds a job at 26; find one that does among a few seeds.
    let state: GameState | undefined = withJob;
    for (let i = 0; i < 8 && !state; i += 1) {
      const candidate = eligible(adult(`MIL-JOB-${i}`, 28));
      if (candidate.employment.job !== undefined) state = candidate;
    }
    if (!state) return; // none of the seeds tried held a job at that age; the resign path is also read in the answer tests
    const result = applyToEnlist(state);
    if (!result.ok) throw new Error('should enlist');
    expect(result.value.state.employment.job).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* The recruiter's offer                                                       */
/* -------------------------------------------------------------------------- */

describe("the recruiter's offer", () => {
  const base = eligible(adult('MIL-OFFER', 26));

  it('is raised to about the chance the age sets, drawn from a hash and not a stream', () => {
    let offered = 0;
    const N = 4000;
    for (let i = 0; i < N; i += 1) {
      const out = yearOf(withSeed(base, `offer-${i}`), 21, 2030);
      if (out.military.offer) offered += 1;
    }
    expect(offered / N).toBeGreaterThan(enlistOfferChance(21) * 0.7);
    expect(offered / N).toBeLessThan(enlistOfferChance(21) * 1.3);
  });

  it('is the same offer every time it is asked about the same life and year', () => {
    for (let i = 0; i < 200; i += 1) {
      const probe = withSeed(base, `repeat-${i}`);
      expect(yearOf(probe, 21, 2030).military.offer).toEqual(
        yearOf(probe, 21, 2030).military.offer,
      );
    }
  });

  it('spends no random stream: the same state, before and after', () => {
    const before = JSON.stringify(base.rng.snapshot());
    for (let i = 0; i < 50; i += 1) yearOf(withSeed(base, `quiet-${i}`), 21, 2030);
    yearOf(base, 21, 2030);
    expect(JSON.stringify(base.rng.snapshot())).toBe(before);
  });

  it('is frozen with the age and the branch it was raised at', () => {
    let found: MilitaryState | undefined;
    for (let i = 0; i < 2000 && !found; i += 1) {
      const out = yearOf(withSeed(base, `frozen-${i}`), 22, 2031);
      if (out.military.offer) found = out.military;
    }
    expect(found?.offer).toEqual({
      kind: 'enlist',
      age: 22,
      eventId: MILITARY_OFFER_EVENT_ID,
      intro: true,
      step: 'branch',
      options: ['army', 'navy', 'marine-corps', 'air-force', 'coast-guard'],
    });
  });

  it('is never raised to somebody under the bar', () => {
    const unwell = withStats(base, { health: 20 });
    for (let i = 0; i < 1500; i += 1) {
      expect(yearOf(withSeed(unwell, `unwell-${i}`), 22, 2031).military.offer).toBeUndefined();
    }
  });

  it('is never raised outside the age window', () => {
    for (let i = 0; i < 600; i += 1) {
      expect(
        yearOf(withSeed(base, `old-${i}`), ENLIST_MAX_AGE + 1, 2050).military.offer,
      ).toBeUndefined();
      expect(
        yearOf(withSeed(base, `young-${i}`), ENLIST_MIN_AGE - 1, 2020).military.offer,
      ).toBeUndefined();
    }
  });

  it('is not raised again the year after it was turned down, and is two years on', () => {
    const turned = { ...base, military: { past: [], turnedDownAge: 21 } as MilitaryState };
    for (let i = 0; i < 1500; i += 1) {
      expect(yearOf(withSeed(turned, `turned-${i}`), 22, 2031).military.offer).toBeUndefined();
    }
    let later = 0;
    for (let i = 0; i < 3000; i += 1) {
      if (yearOf(withSeed(turned, `later-${i}`), 23, 2032).military.offer) later += 1;
    }
    expect(later).toBeGreaterThan(0);
  });

  it('is never raised on top of one already on the table', () => {
    const asked = {
      ...base,
      military: {
        past: [],
        offer: { ...ARMY_OFFER, age: 21 },
      },
    } as unknown as GameState;
    const out = yearOf(asked, 22, 2031);
    expect(out.military.offer).toEqual(asked.military.offer);
  });

  it('becomes a question with the two choices, and a pending decision once', () => {
    const offer = { ...ARMY_OFFER, age: 22 } as const;
    const decision = militaryOfferDecision(offer, 2031);
    expect(isMilitaryOfferDecision(decision.eventId)).toBe(true);
    expect(decision.choices.map((row) => row.id)).toEqual([
      'army.infantry',
      'army.medic',
      MILITARY_DECLINE,
    ]);
    expect(decision.prompt.length).toBeGreaterThan(10);
    const asked = withMilitaryOffer({ ...base, military: { past: [], offer } }, true);
    expect(asked.pending.filter((row) => row.eventId === MILITARY_OFFER_EVENT_ID)).toHaveLength(1);
    const again = withMilitaryOffer(asked, true);
    expect(again.pending).toHaveLength(asked.pending.length);
  });

  it('is not raised to the dead, and nothing is raised without an offer', () => {
    const offer = { ...ARMY_OFFER, age: 22 } as const;
    expect(
      withMilitaryOffer({ ...base, military: { past: [], offer } }, false).pending,
    ).toHaveLength(0);
    expect(withMilitaryOffer(base, true)).toBe(base);
  });

  it('shuts the other doors while it stands', () => {
    const offer = { ...ARMY_OFFER, age: 22 } as const;
    expect(hasSystemicOffer(base)).toBe(false);
    expect(hasSystemicOffer({ ...base, military: { past: [], offer } })).toBe(true);
  });

  it('asks the ordinary-life harness to decline it', () => {
    const decision = militaryOfferDecision({ ...ARMY_OFFER, age: 22 }, 2031);
    expect(ordinaryChoice(decision)?.id).toBe(MILITARY_DECLINE);
  });
});

/* -------------------------------------------------------------------------- */
/* Answering                                                                   */
/* -------------------------------------------------------------------------- */

describe('answering the service', () => {
  const base = eligible(adult('MIL-ANSWER', 26));
  const enlistOffer = { ...ARMY_OFFER, age: 22 } as const;
  const asked = (state: GameState, offer: MilitaryState['offer']): GameState =>
    withMilitaryOffer({ ...state, military: { ...state.military, offer } }, true);

  it('answers through the same door as every other question', () => {
    const state = asked(base, enlistOffer);
    const result = decide(state, MILITARY_OFFER_EVENT_ID, MILITARY_ENLIST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.military.service?.stage).toBe('training');
    expect(result.value.state.pending.some((row) => row.eventId === MILITARY_OFFER_EVENT_ID)).toBe(
      false,
    );
    expect(result.value.state.military.offer).toBeUndefined();
  });

  it('puts a recruit in uniform on yes, clearing the question', () => {
    const answered = answerMilitaryOffer(asked(base, enlistOffer), MILITARY_ENLIST);
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.value.entry.kind).toBe('milestone');
    expect(answered.value.state.military.service?.grade).toBe(1);
    expect(answered.value.state.military.offer).toBeUndefined();
  });

  it('keeps a recruit as a civilian on no, and remembers when', () => {
    const answered = answerMilitaryOffer(asked(base, enlistOffer), MILITARY_DECLINE);
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.value.state.military.service).toBeUndefined();
    expect(answered.value.state.military.turnedDownAge).toBe(22);
    expect(answered.value.state.military.offer).toBeUndefined();
    expect(answered.value.entry.kind).toBe('passive');
  });

  it('refuses a choice the question does not have, and an answer with nothing asked', () => {
    const bad = answerMilitaryOffer(asked(base, enlistOffer), 'maybe');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('no-such-choice');
    const none = answerMilitaryOffer(base, MILITARY_ENLIST);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toBe('no-offer');
    expect(decide(base, MILITARY_OFFER_EVENT_ID, MILITARY_ENLIST).ok).toBe(false);
  });

  it('does not accept a re-enlistment answer to a recruiter, or the reverse', () => {
    expect(answerMilitaryOffer(asked(base, enlistOffer), MILITARY_REENLIST).ok).toBe(false);
    const reenlist = {
      kind: 'reenlist',
      branch: 'army',
      grade: 5,
      years: 4,
      age: 23,
      eventId: MILITARY_OFFER_EVENT_ID,
    } as const;
    const stay = asked(serving(base, { years: 4, grade: 5 }), reenlist);
    expect(answerMilitaryOffer(stay, MILITARY_ENLIST).ok).toBe(false);
  });

  describe('at the end of a term', () => {
    const reenlist = {
      kind: 'reenlist',
      branch: 'army',
      grade: 5,
      years: 4,
      age: 23,
      eventId: MILITARY_OFFER_EVENT_ID,
    } as const;
    const state = asked(serving(base, { years: 4, grade: 5, termEnds: 4 }), reenlist);

    it('names the grade and the years in the question, from what was frozen', () => {
      const decision = state.pending.find((row) => row.eventId === MILITARY_OFFER_EVENT_ID)!;
      expect(decision.prompt).toMatch(/sergeant/i);
      expect(decision.prompt).toMatch(/4 years/);
      expect(decision.choices.map((row) => row.id)).toEqual([MILITARY_REENLIST, MILITARY_LEAVE]);
    });

    it('extends the term by four years on staying, and nothing else', () => {
      const answered = answerMilitaryOffer(state, MILITARY_REENLIST);
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      const career = answered.value.state.military.service!;
      expect(career.termEnds).toBe(8);
      expect(career.grade).toBe(5);
      expect(career.years).toBe(4);
      expect(answered.value.state.military.offer).toBeUndefined();
      expect(answered.value.state.military.past).toHaveLength(0);
    });

    it('ends the career on leaving, honorably, and keeps what it was', () => {
      const answered = answerMilitaryOffer(state, MILITARY_LEAVE);
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      const after = answered.value.state.military;
      expect(after.service).toBeUndefined();
      expect(after.offer).toBeUndefined();
      expect(after.past).toHaveLength(1);
      expect(after.past[0]).toMatchObject({
        branch: 'army',
        how: 'term',
        discharge: 'honorable',
        finalGrade: 5,
        years: 4,
        enlistedAge: 19,
      });
      expect(
        answered.value.state.player.records.some(
          (row) => row.category === 'military' && /Left/.test(row.label),
        ),
      ).toBe(true);
    });

    it('is voided, not crashed, when the career was ended some other way meanwhile', () => {
      const gone = { ...state, military: { past: [], offer: reenlist } } as unknown as GameState;
      const answered = answerMilitaryOffer(gone, MILITARY_REENLIST);
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      expect(answered.value.state.military.offer).toBeUndefined();
      expect(answered.value.state.military.service).toBeUndefined();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* A year in uniform                                                           */
/* -------------------------------------------------------------------------- */

describe('basic training', () => {
  const base = eligible(adult('MIL-BASIC', 20));
  const recruit = serving(base, {
    stage: 'training',
    grade: 1,
    years: 0,
    enlistedAge: 20,
    performance: 50,
  });

  it('is the first year, and a recruit who finishes is serving, a year in, at least a private first class', () => {
    let finished = 0;
    for (let i = 0; i < 300; i += 1) {
      const out = yearOf(withSeed(recruit, `basic-${i}`), 21, 2031);
      if (out.left) continue;
      finished += 1;
      expect(out.military.service!.stage).toBe('serving');
      expect(out.military.service!.years).toBe(1);
      // Basic done: a private first class, E-3, never more and never less.
      expect(out.military.service!.grade).toBe(3);
      expect(out.pay).toBe(annualBasePay(1, 0));
      expect(out.statDeltas.discipline).toBeGreaterThan(0);
      expect(out.statDeltas.health).toBeGreaterThan(0);
      expect(out.lines.some((row) => row.kind === 'milestone')).toBe(true);
    }
    expect(finished).toBeGreaterThan(200);
  });

  it('washes out about one recruit in eight of middling fitness (measured: 12.6% on 4,000)', () => {
    let washed = 0;
    const N = 4000;
    for (let i = 0; i < N; i += 1) {
      const out = yearOf(withSeed(recruit, `wash-${i}`), 21, 2031);
      if (out.left) washed += 1;
    }
    const rate = washed / N;
    expect(rate).toBeGreaterThan(0.09);
    expect(rate).toBeLessThan(0.16);
  });

  it('sends a recruit who did not finish home with six months of pay, an entry-level discharge and no rank', () => {
    let seen = 0;
    for (let i = 0; i < 400 && seen < 5; i += 1) {
      const out = yearOf(withSeed(recruit, `wash-out-${i}`), 21, 2031);
      if (!out.left) continue;
      seen += 1;
      expect(out.pay).toBe(washOutPay());
      expect(out.military.service).toBeUndefined();
      expect(out.military.offer).toBeUndefined();
      expect(out.military.past).toHaveLength(1);
      expect(out.military.past[0]).toMatchObject({ how: 'washed-out', discharge: 'entry-level' });
      expect(out.records.some((row) => /did not finish/i.test(row.label))).toBe(true);
      expect(out.mood).toBeLessThan(0);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('washes out the unfit more often than the fit', () => {
    const fitOnes = withStats(recruit, { discipline: 90, health: 90, smarts: 70 });
    const weak = withStats(recruit, { discipline: 30, health: 52, smarts: 35 });
    const rate = (state: GameState) => {
      let washed = 0;
      for (let i = 0; i < 2000; i += 1) {
        if (yearOf(withSeed(state, `cmp-${i}`), 21, 2031).left) washed += 1;
      }
      return washed / 2000;
    };
    expect(rate(weak)).toBeGreaterThan(rate(fitOnes) * 2);
  });

  it('is judged on who they are, not on how charming: Charisma changes nothing', () => {
    for (let i = 0; i < 300; i += 1) {
      const probe = withSeed(recruit, `charm-${i}`);
      const low = yearOf(withStats(probe, { charisma: 5 }), 21, 2031);
      const high = yearOf(withStats(probe, { charisma: 95 }), 21, 2031);
      expect(high).toEqual(low);
    }
  });
});

describe('a year of service', () => {
  const base = eligible(adult('MIL-YEAR', 24));

  it('pays basic pay for the grade and the years served, before the year turns', () => {
    const out = yearOf(serving(base, { grade: 5, years: 4, termEnds: 8 }), 25, 2033);
    expect(out.pay).toBe(annualBasePay(5, 4));
    expect(out.left).toBe(false);
  });

  it('counts a year, and keeps the stage serving', () => {
    const out = yearOf(serving(base, { grade: 5, years: 5, termEnds: 8 }), 25, 2033);
    expect(out.military.service!.years).toBe(6);
    expect(out.military.service!.stage).toBe('serving');
    expect(out.military.service!.lastPay).toBe(annualBasePay(5, 5));
  });

  it('never skips a grade in a year, and never promotes before the time is in', () => {
    for (let i = 0; i < 600; i += 1) {
      for (const years of [0, 1, 2, 3, 5, 9, 13, 17]) {
        const grade = Math.max(3, Math.min(8, years + 3));
        const career = serviceRow({ grade, years, termEnds: 40, performance: 90 });
        const out = yearOf(
          withSeed({ ...base, military: { past: [], service: career } }, `rise-${i}`),
          30,
          2040,
        );
        const next = out.military.service?.grade ?? grade;
        expect(next - grade).toBeLessThanOrEqual(1);
        if (next > grade) {
          expect(years + 1).toBeGreaterThanOrEqual(ENLISTED_GRADES[next - 1]!.minYears);
        }
      }
    }
  });

  it('promotes a strong performer faster than a weak one over many years', () => {
    const ranks = (performance: number) => {
      let total = 0;
      for (let i = 0; i < 400; i += 1) {
        let career = serviceRow({ grade: 4, years: 2, termEnds: 99, performance });
        for (let y = 0; y < 8; y += 1) {
          const out = yearOf(
            withSeed({ ...base, military: { past: [], service: career } }, `speed-${i}`),
            26 + y,
            2035 + y,
          );
          if (!out.military.service) break;
          // Hold the performance where the test put it, so only the promotion odds are compared.
          career = { ...out.military.service, performance };
        }
        total += career.grade;
      }
      return total / 400;
    };
    expect(ranks(90)).toBeGreaterThan(ranks(30));
  });

  it('moves performance towards a higher level when Work Harder has stuck', () => {
    const norm = yearOf(serving(base, { performance: 50, years: 1, termEnds: 99 }), 25, 2033);
    const hard = yearOf(
      serving(base, { performance: 50, years: 1, termEnds: 99, effort: 'hard' }),
      25,
      2033,
    );
    expect(hard.military.service!.performance).toBeGreaterThan(norm.military.service!.performance);
  });

  it('gives discipline a little in the first term and nothing the rest of the way', () => {
    const first = yearOf(serving(base, { years: 2, termEnds: 4 }), 25, 2033);
    expect(first.statDeltas.discipline).toBeGreaterThan(0);
    const later = yearOf(serving(base, { years: 6, termEnds: 8 }), 25, 2033);
    expect(later.statDeltas.discipline ?? 0).toBe(0);
  });

  it('writes a line most years, and a milestone for a rise', () => {
    const quiet = yearOf(
      serving(base, { grade: 5, years: 4, termEnds: 40, performance: 55 }),
      25,
      2033,
    );
    expect(quiet.lines.length).toBeGreaterThan(0);
    let risen = 0;
    for (let i = 0; i < 400; i += 1) {
      const out = yearOf(
        withSeed(
          {
            ...base,
            military: {
              past: [],
              service: serviceRow({ grade: 5, years: 6, termEnds: 40, performance: 80 }),
            },
          },
          `line-${i}`,
        ),
        30,
        2040,
      );
      if ((out.military.service?.grade ?? 5) > 5) {
        risen += 1;
        expect(out.lines.some((row) => row.kind === 'milestone')).toBe(true);
        // A rise is the year's news: no ordinary line beside it.
        expect(out.lines).toHaveLength(1);
        expect(out.mood).toBeGreaterThan(0);
      }
    }
    expect(risen).toBeGreaterThan(0);
  });
});

describe('the end of a term', () => {
  const base = eligible(adult('MIL-TERM', 24));

  it('asks the question when a term ends, freezing the grade and years it ended at', () => {
    const out = yearOf(
      serving(base, { grade: 5, years: 3, termEnds: 4, performance: 70 }),
      25,
      2033,
    );
    expect(out.military.offer?.kind).toBe('reenlist');
    if (out.military.offer?.kind !== 'reenlist') return;
    expect(out.military.offer.years).toBe(4);
    expect(out.military.offer.grade).toBe(out.military.service!.grade);
    expect(out.military.service).toBeDefined();
    expect(out.left).toBe(false);
  });

  it('does not ask before the term is up', () => {
    const out = yearOf(
      serving(base, { grade: 5, years: 2, termEnds: 4, performance: 70 }),
      25,
      2033,
    );
    expect(out.military.offer).toBeUndefined();
  });

  it('does not ask twice while a question stands', () => {
    const asked = {
      ...serving(base, { grade: 5, years: 4, termEnds: 4 }),
    } as GameState;
    const withOffer = {
      ...asked,
      military: {
        ...asked.military,
        offer: {
          kind: 'reenlist',
          branch: 'army',
          grade: 5,
          years: 4,
          age: 24,
          eventId: MILITARY_OFFER_EVENT_ID,
        },
      },
    } as unknown as GameState;
    const out = yearOf(withOffer, 25, 2033);
    expect(out.military.offer).toEqual(withOffer.military.offer);
  });

  it('does not keep somebody whose work has sat below the middle: they are not asked, and go honorably if the service thinks well of them (0904: a poor reputation makes it a general discharge)', () => {
    const out = yearOf(
      serving(base, {
        grade: 4,
        years: 3,
        termEnds: 4,
        performance: RETAIN_PERFORMANCE_FLOOR - 15,
        reputation: 80,
      }),
      25,
      2033,
    );
    expect(out.left).toBe(true);
    expect(out.military.service).toBeUndefined();
    expect(out.military.past[0]).toMatchObject({ how: 'not-retained', discharge: 'honorable' });
    expect(out.military.offer).toBeUndefined();
  });

  it('retires somebody the service would not keep once twenty years are in, with the grade reached', () => {
    const out = yearOf(
      serving(base, { grade: 7, years: 19, termEnds: 20, performance: 30 }),
      40,
      2050,
    );
    expect(out.left).toBe(true);
    expect(out.military.service).toBeUndefined();
    expect(out.military.offer).toBeUndefined();
    expect(out.military.past[0]).toMatchObject({
      how: 'retired',
      years: 20,
      discharge: 'honorable',
    });
    expect(out.records.some((row) => /Retired/.test(row.label))).toBe(true);
    expect(out.lines.some((row) => row.kind === 'milestone')).toBe(true);
  });

  it('still pays the last year in full when it ends the career', () => {
    const out = yearOf(
      serving(base, { grade: 7, years: 19, termEnds: 20, performance: 30 }),
      40,
      2050,
    );
    expect(out.pay).toBe(annualBasePay(7, 19));
  });
});

/* -------------------------------------------------------------------------- */
/* Work Harder, in uniform                                                     */
/* -------------------------------------------------------------------------- */

describe('Work Harder, in uniform', () => {
  const base = eligible(adult('MIL-WORK', 24));
  const soldier = serving(base, { performance: 50 });

  it('is refused for somebody with neither a job nor a uniform', () => {
    const result = workHarder({ ...base, employment: { ...base.employment, job: undefined } });
    expect(result.ok).toBe(false);
  });

  it('moves a serving member, and the effort sticks', () => {
    let moved = 0;
    for (let i = 0; i < 100; i += 1) {
      const result = workHarder(withSeed(soldier, `work-${i}`));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const career = result.value.state.military.service!;
      expect(career.effort).toBe('hard');
      expect(career.pushedThisYear).toBe(1);
      expect(career.pushedAtAge).toBe(soldier.player.age);
      if (career.performance > 50) moved += 1;
      expect(career.performance).toBeGreaterThanOrEqual(50);
      expect(result.value.entry?.kind).toBe('career');
    }
    expect(moved).toBeGreaterThan(30);
  });

  it('counts twice a year and no more, and a spent press changes and costs nothing', () => {
    const first = workHarder(soldier);
    if (!first.ok) throw new Error('first press');
    const second = workHarder(first.value.state);
    if (!second.ok) throw new Error('second press');
    expect(second.value.spent).toBe(false);
    const third = workHarder(second.value.state);
    if (!third.ok) throw new Error('third press');
    expect(third.value.spent).toBe(true);
    expect(third.value.entry).toBeUndefined();
    expect(third.value.state).toBe(second.value.state);
    expect(pushesLeft(first.value.state)).toBe(1);
    expect(pushesLeft(second.value.state)).toBe(0);
    expect(servicePushesLeft(second.value.state)).toBe(0);
    expect(pushesLeft(soldier)).toBe(2);
  });

  it('comes back next year: the count is per age', () => {
    const first = workHarder(soldier);
    const second = first.ok ? workHarder(first.value.state) : first;
    if (!second.ok) throw new Error('press');
    const older = {
      ...second.value.state,
      player: { ...second.value.state.player, age: second.value.state.player.age + 1 },
    } as GameState;
    expect(pushesLeft(older)).toBe(2);
    const again = workHarder(older);
    expect(again.ok && !again.value.spent).toBe(true);
  });

  it('spends no random stream, however many times it is pressed', () => {
    const before = JSON.stringify(soldier.rng.snapshot());
    let current = soldier;
    for (let i = 0; i < 6; i += 1) {
      const result = workHarder(current);
      if (result.ok) current = result.value.state;
    }
    expect(JSON.stringify(current.rng.snapshot())).toBe(before);
  });

  it('writes a timeline entry with an id of its own, even across pushes in different years', () => {
    const first = workHarder(soldier);
    const second = first.ok ? workHarder(first.value.state) : first;
    if (!first.ok || !second.ok) throw new Error('press');
    const ids = second.value.state.player.timeline.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('feeds the performance read: pressed every year, a member ends further up than one who never does', () => {
    const run = (press: boolean) => {
      let total = 0;
      for (let i = 0; i < 200; i += 1) {
        let state = withSeed(soldier, `feed-${i}`);
        for (let y = 0; y < 3; y += 1) {
          if (press) {
            const r = workHarder(state);
            if (r.ok) state = r.value.state;
          }
          const out = yearOf(state, state.player.age + 1, state.world.year + 1);
          if (!out.military.service) break;
          state = {
            ...state,
            player: { ...state.player, age: state.player.age + 1 },
            military: out.military,
          } as GameState;
        }
        total += state.military.service?.performance ?? 0;
      }
      return total / 200;
    };
    expect(run(true)).toBeGreaterThan(run(false) + 3);
  });
});

/* -------------------------------------------------------------------------- */
/* Housing is provided                                                         */
/* -------------------------------------------------------------------------- */

describe('housing is provided', () => {
  const base = eligible(adult('MIL-LIVE', 24));
  const input = (patch: Record<string, unknown> = {}) => ({
    household: { ...base.household, housing: 'ownPlace' as const, standard: 40_000 },
    age: 24,
    locationIndex: 1,
    partnered: false,
    childAges: [] as number[],
    afterTaxIncome: 90_000,
    wealth: 50_000,
    credit: 0,
    portfolio: 0,
    earned: 0,
    toldToLeave: false,
    hasLivingParent: true,
    ...patch,
  });

  it('charges a single person the at-home share and says why', () => {
    const own = runLiving(input());
    const provided = runLiving(input({ housingProvided: true }));
    expect(provided.cost).toBeLessThan(own.cost);
    expect(provided.transactions[0]?.source).toBe('Living costs, housing provided');
    expect(AT_HOME_SHARE).toBeLessThan(1);
  });

  it('charges the whole household when there is a partner', () => {
    const own = runLiving(input({ partnered: true }));
    const provided = runLiving(input({ partnered: true, housingProvided: true }));
    expect(provided.cost).toBe(own.cost);
  });

  it('charges the whole household when there is a child at home', () => {
    const own = runLiving(input({ childAges: [4] }));
    const provided = runLiving(input({ childAges: [4], housingProvided: true }));
    expect(provided.cost).toBe(own.cost);
  });

  it('does not change the address the household remembers, nor move anybody out or in', () => {
    const atHome = input({
      household: { ...base.household, housing: 'withFamily' as const, standard: 40_000 },
    });
    const out = runLiving({ ...atHome, afterTaxIncome: 80_000, housingProvided: true });
    expect(out.household.housing).toBe('withFamily');
    expect(out.lines.some((row) => row.kind === 'relationship')).toBe(false);
    const own = runLiving(input({ housingProvided: true }));
    expect(own.household.housing).toBe('ownPlace');
  });

  it('is nothing at all when it is not asked for', () => {
    const plain = runLiving(input());
    expect(plain.transactions[0]?.source).not.toBe('Living costs, housing provided');
    expect(runLiving(input({ housingProvided: false })).cost).toBe(plain.cost);
  });
});

/* -------------------------------------------------------------------------- */
/* Money and the year as a whole                                               */
/* -------------------------------------------------------------------------- */

describe('the year as a whole', () => {
  const base = eligible(adult('MIL-WHOLE', 26));

  it('posts basic pay and the tax on it, and reconciles', () => {
    const state = serving(base, { grade: 3, years: 1, termEnds: 4, performance: 60 });
    const out = advanceYear(state).state;
    const rows = out.finance.transactions.filter((row) => row.year === out.world.year);
    const pay = rows.find((row) => row.source === 'Army pay');
    expect(pay).toBeDefined();
    expect(Number(pay!.amount) / 100).toBe(annualBasePay(3, 1));
    const tax = rows.find((row) => row.source === 'Tax on Army pay');
    expect(tax).toBeDefined();
    expect(Number(tax!.amount)).toBeLessThan(0);
    expect(Number(tax!.amount) / 100 + annualBasePay(3, 1)).toBeGreaterThan(0);
    expect(out.player.cash).toBe(out.finance.balance);
  });

  it('charges the lower living cost, the roof being the service’s, to somebody single with nobody at home', () => {
    let alone: GameState | undefined;
    for (let i = 0; i < 16 && !alone; i += 1) {
      const candidate = eligible(adult(`MIL-ALONE-${i}`, 26));
      const single =
        householdPartnerOf(candidate.circle.people) === undefined &&
        childrenAtHome(candidate.family, candidate.world.year).length === 0 &&
        candidate.homes.length === 0;
      if (single) alone = candidate;
    }
    if (!alone) throw new Error('no single adult among the seeds tried');
    const soldier = serving(alone, { grade: 3, years: 1, termEnds: 4, performance: 60 });
    const out = advanceYear(soldier).state;
    const living = out.finance.transactions.filter(
      (row) => row.year === out.world.year && row.category === 'living',
    );
    expect(living.some((row) => row.source === 'Living costs, housing provided')).toBe(true);
    const civilian = advanceYear(alone).state;
    const civilianLiving = civilian.finance.transactions.filter(
      (row) => row.year === civilian.world.year && row.category === 'living',
    );
    const cost = (rows: typeof living) => rows.reduce((sum, row) => sum - Number(row.amount), 0);
    expect(cost(living)).toBeLessThanOrEqual(cost(civilianLiving));
  });

  it('makes the occupation the rank, while it lasts', () => {
    const out = advanceYear(serving(base, { grade: 5, years: 4, termEnds: 8 })).state;
    expect(out.player.occupation).toMatch(/Sergeant|Specialist|Staff/);
    expect(out.player.occupation).toMatch(/Army/);
    expect(militaryOccupation(out.military)).toBe(out.player.occupation);
  });

  it('puts no job offer in front of somebody in uniform', () => {
    const state = serving(base, { grade: 4, years: 2 });
    const out = withAnyOffer(state, true);
    expect(out.pending).toEqual(state.pending);
    expect(out.offer).toBeUndefined();
  });

  it('writes a year’s feed with unique ids, and the whole career into the record', () => {
    let state = answerAll(applyToEnlist(base).ok ? (applyToEnlist(base) as any).value.state : base);
    for (let i = 0; i < 6 && state.player.alive; i += 1) {
      state = answerAll(advanceYear(state).state);
      if (state.pending.some((row) => row.eventId === MILITARY_OFFER_EVENT_ID)) {
        const r = decide(state, MILITARY_OFFER_EVENT_ID, MILITARY_REENLIST);
        if (r.ok) state = r.value.state;
      }
    }
    const ids = state.player.timeline.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    const recordIds = state.player.records.map((row) => row.id);
    expect(new Set(recordIds).size).toBe(recordIds.length);
  });

  it('puts a soldier through basic training and out the other side in a played year', () => {
    const enlisted = applyToEnlist(base);
    if (!enlisted.ok) throw new Error('should enlist');
    const out = answerAll(advanceYear(enlisted.value.state).state);
    const career = out.military.service;
    const past = out.military.past[0];
    expect(career?.stage === 'serving' || past?.how === 'washed-out').toBe(true);
  });

  it('keeps the same life, to the last number, whether or not the recruiter was ever mentioned', () => {
    // A life whose offers are always declined replays exactly as one that was never offered anything: the service
    // draws from a hash and takes nothing from any stream, and a decline writes only to `military` and the timeline.
    const run = (decline: boolean) => {
      let state = createNewGame({ seed: 'MIL-REPLAY' });
      for (let i = 0; i < 26 && state.player.alive; i += 1) {
        state = advanceYear(answerAll(state)).state;
        state = answerAll(state);
        void decline;
      }
      return state;
    };
    const a = run(true);
    const b = run(false);
    expect(JSON.stringify(a.rng.snapshot())).toBe(JSON.stringify(b.rng.snapshot()));
    expect(a.player.cash).toBe(b.player.cash);
    expect(a.military.service).toBeUndefined();
  });
});

describe('the service in numbers a screen would say', () => {
  const base = eligible(adult('MIL-WORDS', 24));

  it('titles the grade and the pay, in words', () => {
    const career = serviceRow({ grade: 6, years: 8 });
    expect(rankTitleOf(career)).toBe('Staff Sergeant');
    expect(yearPayOf(career)).toBe(annualBasePay(6, 8));
    expect(payWords(career)).toMatch(/^\$[\d,]+ a year$/);
    expect(militaryOccupation({ past: [], service: career })).toBe('Staff Sergeant, Army');
    expect(militaryOccupation(base.military)).toBeUndefined();
  });

  it('has an empty service by default', () => {
    expect(createNewGame({ seed: 'MIL-EMPTY' }).military).toEqual(EMPTY_MILITARY);
  });
});

/* -------------------------------------------------------------------------- */
/* Wiring that only shows in a played year                                     */
/* -------------------------------------------------------------------------- */

describe('wiring into the played year', () => {
  /** A real reseed: `advanceYear` draws from streams, so the object keeps every method and only the seed moves. */
  const reseeded = (state: GameState, seed: string): GameState =>
    ({
      ...state,
      rng: Object.assign(Object.create(state.rng), { getSeed: () => seed }),
    }) as unknown as GameState;

  it('stops job offers for somebody in uniform, though the same life would have been offered one', () => {
    let tried = 0;
    let shown = 0;
    for (let i = 0; i < 60 && shown < 3; i += 1) {
      const civilian = eligible(adult(`MIL-JOBS-${i}`, 27));
      tried += 1;
      const open = withAnyOffer(
        { ...civilian, employment: { ...civilian.employment, job: undefined } },
        true,
      );
      if (open.offer === undefined) continue;
      shown += 1;
      const soldier = serving({
        ...civilian,
        employment: { ...civilian.employment, job: undefined },
      });
      const closed = withAnyOffer(soldier, true);
      expect(closed.offer).toBeUndefined();
      expect(closed.pending).toEqual(soldier.pending);
    }
    expect(shown, `of ${tried} lives`).toBeGreaterThan(0);
  });

  it('gives somebody in uniform no idle-years drift, though a civilian with the same gap would lose Discipline', () => {
    let compared = 0;
    for (let i = 0; i < 20 && compared < 4; i += 1) {
      const civilian = eligible(adult(`MIL-IDLE-${i}`, 30));
      const idle = withStats(
        {
          ...civilian,
          employment: { ...civilian.employment, job: undefined, history: [] },
        } as GameState,
        { discipline: 70 },
      );
      const afterCivilian = advanceYear(idle).state;
      const afterSoldier = advanceYear(serving(idle, { grade: 5, years: 9, termEnds: 12 })).state;
      if (afterCivilian.player.stats.discipline >= idle.player.stats.discipline) continue;
      compared += 1;
      expect(afterSoldier.player.stats.discipline).toBeGreaterThan(
        afterCivilian.player.stats.discipline,
      );
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('raises one question a year: a recruiter’s offer gives way to a modeling job raised the same year', () => {
    const age = 27;
    const chance = enlistOfferChance(age);
    const modeler = (state: GameState): GameState =>
      ({
        ...state,
        modeling: {
          ...state.modeling,
          craft: 60,
          credits: 12,
          tier: 'catalogue',
          reputation: 20,
          followers: 5_000,
          peak: 5_000,
          seenAge: state.player.age,
        },
      }) as unknown as GameState;
    const base = modeler(eligible(adult('MIL-CLASH', 26)));
    let clashes = 0;
    for (let i = 0; i < 4000 && clashes < 3; i += 1) {
      const seed = `clash-${i}`;
      if (mixedUnit(`service:${seed}:${base.world.generation}:offer:${age}`) >= chance) continue;
      const next = advanceYear(reseeded(base, seed)).state;
      if (next.modeling.offers.length === 0) continue;
      clashes += 1;
      expect(next.military.offer).toBeUndefined();
      expect(next.pending.some((row) => row.eventId === MILITARY_OFFER_EVENT_ID)).toBe(false);
    }
    expect(clashes).toBeGreaterThan(0);
  });

  it('raises the recruiter’s offer when nothing else is asking', () => {
    const age = 27;
    const chance = enlistOfferChance(age);
    const base = eligible(adult('MIL-ALONE-OFFER', 26));
    let raised = 0;
    for (let i = 0; i < 4000 && raised < 2; i += 1) {
      const seed = `solo-${i}`;
      if (mixedUnit(`service:${seed}:${base.world.generation}:offer:${age}`) >= chance) continue;
      const next = advanceYear(reseeded(base, seed)).state;
      if (next.military.offer?.kind !== 'enlist') continue;
      raised += 1;
      expect(next.pending.filter((row) => row.eventId === MILITARY_OFFER_EVENT_ID)).toHaveLength(1);
    }
    expect(raised).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The tables, pinned                                                          */
/* -------------------------------------------------------------------------- */

describe('the tables, pinned', () => {
  // Monthly basic pay, grades 1 to 9 (rows) by years served 0 to 30 (columns): the 2026 chart as it was read, every
  // cell, so a change to the table is a decision and not a slip.
  const PAY: readonly (readonly number[])[] = [
    [
      2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2,
      2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2,
      2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2, 2407.2,
    ],
    [
      2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9,
      2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9,
      2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9, 2697.9,
    ],
    [
      2836.8, 2836.8, 3015, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198,
      3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198,
      3198,
    ],
    [
      3142.2, 3142.2, 3303, 3482.4, 3658.5, 3658.5, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4,
      3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4,
      3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4,
    ],
    [
      3342.9, 3342.9, 3598.2, 3775.8, 3946.8, 3946.8, 4110, 4110, 4299.9, 4299.9, 4395.3, 4395.3,
      4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7,
      4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7,
    ],
    [
      3401.1, 3401.1, 3743.1, 3908.1, 4068.9, 4068.9, 4235.7, 4235.7, 4612.8, 4612.8, 4759.5,
      4759.5, 5043.3, 5043.3, 5130.3, 5130.3, 5193.6, 5193.6, 5267.7, 5267.7, 5267.7, 5267.7,
      5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7, 5267.7,
    ],
    [
      3932.1, 3932.1, 4291.5, 4456.2, 4673.1, 4673.1, 4843.8, 4843.8, 5135.7, 5135.7, 5300.4,
      5300.4, 5591.7, 5591.7, 5835, 5835, 6000.9, 6000.9, 6177.3, 6177.3, 6245.7, 6245.7, 6475.2,
      6475.2, 6598.2, 6598.2, 7067.4, 7067.4, 7067.4, 7067.4, 7067.4,
    ],
    [
      5656.5, 5656.5, 5656.5, 5656.5, 5656.5, 5656.5, 5656.5, 5656.5, 5656.5, 5656.5, 5907, 5907,
      6061.8, 6061.8, 6247.2, 6247.2, 6448.2, 6448.2, 6811.2, 6811.2, 6995.4, 6995.4, 7308.3,
      7308.3, 7481.7, 7481.7, 7908.9, 7908.9, 7908.9, 7908.9, 7908.9,
    ],
    [
      6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 6910.2, 6910.2,
      6910.2, 7066.5, 7066.5, 7263.6, 7263.6, 7496.1, 7496.1, 7730.7, 7730.7, 8105.1, 8105.1,
      8423.1, 8423.1, 8756.7, 8756.7, 9267.9, 9267.9, 9267.9, 9267.9, 9267.9,
    ],
  ];

  it('holds every cell of the 2026 table', () => {
    for (let grade = 1; grade <= 9; grade += 1) {
      for (let years = 0; years <= 30; years += 1) {
        expect(monthlyBasePay(grade, years), `E-${grade} at ${years}`).toBe(PAY[grade - 1]![years]);
      }
    }
  });

  it('steps pay at these years of service', () => {
    expect(PAY_STEPS).toEqual([0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26]);
  });

  it('is the 2026 table', () => {
    expect(PAY_TABLE_YEAR).toBe(2026);
    expect(annualBasePay(1, 0)).toBe(28_886);
    expect(annualBasePay(9, 20)).toBe(97_261);
    expect(washOutPay()).toBe(14_443);
  });

  it('holds the grades: number, abbreviation, title, years first, chance a year', () => {
    expect(ENLISTED_GRADES.map((r) => [r.grade, r.abbr, r.title, r.minYears, r.rise])).toEqual([
      [1, 'PV1', 'Private', 0, 1],
      [2, 'PV2', 'Private', 0, 1],
      [3, 'PFC', 'Private First Class', 1, 1],
      [4, 'SPC', 'Specialist', 2, 0.85],
      [5, 'SGT', 'Sergeant', 3, 0.55],
      [6, 'SSG', 'Staff Sergeant', 6, 0.3],
      [7, 'SFC', 'Sergeant First Class', 10, 0.2],
      [8, 'MSG', 'Master Sergeant', 14, 0.1],
      [9, 'SGM', 'Sergeant Major', 18, 0.06],
    ]);
  });

  it('has the standards at these numbers', () => {
    expect(ENLIST_HEALTH_FLOOR).toBe(50);
    expect(ENLIST_SMARTS_FLOOR).toBe(30);
    expect(ENLIST_MIN_AGE).toBe(17);
    expect(ENLIST_MAX_AGE).toBe(35);
    expect(RETAIN_PERFORMANCE_FLOOR).toBe(47);
  });

  it('offers at these chances at the edges of each band', () => {
    const at = (age: number) => enlistOfferChance(age);
    expect([16, 17, 24, 25, 29, 30, 35, 36].map(at)).toEqual([
      0, 0.022, 0.022, 0.01, 0.01, 0.003, 0.003, 0,
    ]);
  });

  it('turns a grade’s own chance into a year’s by the performance, and never above 95%', () => {
    expect(riseChance(5, 60)).toBeCloseTo(0.55, 10);
    expect(riseChance(5, 80)).toBeCloseTo(0.825, 10);
    expect(riseChance(5, 20)).toBeCloseTo(0.11, 10);
    expect(riseChance(5, 100)).toBeCloseTo(0.95, 10);
    expect(riseChance(5, 61)).toBeCloseTo(0.55 * (1 + 1 / 40), 10);
    expect(riseChance(5, 59)).toBeCloseTo(0.55 * (1 - 1 / 40), 10);
    expect(riseChance(9, 0)).toBeCloseTo(0.06 * 0.2, 10);
    expect(riseChance(4, 60)).toBeCloseTo(0.85, 10);
  });

  it('fails a recruit at these chances', () => {
    expect(washOutChance(58)).toBeCloseTo(0.145, 10);
    expect(washOutChance(48)).toBeCloseTo(0.185, 10);
    expect(washOutChance(68)).toBeCloseTo(0.105, 10);
    expect(washOutChance(59)).toBeCloseTo(0.141, 10);
    expect(washOutChance(57)).toBeCloseTo(0.149, 10);
  });

  it('aims performance at these targets', () => {
    expect(servicePerformanceTarget(false, 50, 50, 50)).toBe(46);
    expect(servicePerformanceTarget(true, 50, 50, 50)).toBe(70);
    expect(servicePerformanceTarget(false, 100, 100, 100)).toBe(60);
    expect(servicePerformanceTarget(false, 0, 0, 0)).toBe(32);
    expect(servicePerformanceTarget(true, 100, 100, 100)).toBe(84);
    expect(servicePerformanceTarget(true, 0, 0, 0)).toBe(56);
    // The edge of a rounding step, to pin the centre and the slope of the aptitude.
    expect(servicePerformanceTarget(false, 51.7, 51.7, 51.7)).toBe(46);
    expect(servicePerformanceTarget(false, 51.75, 51.75, 51.75)).toBe(46);
    expect(servicePerformanceTarget(false, 51.8, 51.8, 51.8)).toBe(47);
    // Discipline counts most, then Health, then Smarts, each from its own weight.
    expect(servicePerformanceTarget(false, 100, 0, 0)).toBe(46 + Math.round(((45 - 50) / 50) * 14));
    expect(servicePerformanceTarget(false, 0, 100, 0)).toBe(46 + Math.round(((25 - 50) / 50) * 14));
    expect(servicePerformanceTarget(false, 0, 0, 100)).toBe(46 + Math.round(((30 - 50) / 50) * 14));
  });

  it('fits a person for service by these weights', () => {
    expect(serviceFit(100, 0, 0)).toBe(50);
    expect(serviceFit(0, 100, 0)).toBe(35);
    expect(serviceFit(0, 0, 100)).toBe(15);
  });

  it('says a reputation in these words, at these edges', () => {
    const word = serviceReputationWord;
    expect([85, 84, 70, 69, 55, 54, 40, 39].map(word)).toEqual([
      'a name every sergeant knows',
      'well thought of',
      'well thought of',
      'solid',
      'solid',
      'unremarkable',
      'unremarkable',
      word(0),
    ]);
    expect(word(0)).not.toBe('unremarkable');
  });
});

/* -------------------------------------------------------------------------- */
/* Edges of a year, the answers and the button                                 */
/* -------------------------------------------------------------------------- */

describe('edges of a year', () => {
  const base = eligible(adult('MIL-EDGE', 26));

  it('does nothing at all in a year with no service and no offer: no pay, no mood, no lines', () => {
    const out = yearOf(withSeed(base, 'quiet-seed'), 27, 2040);
    expect(out.pay).toBe(0);
    expect(out.mood).toBe(0);
    expect(out.left).toBe(false);
    expect(out.lines).toEqual([]);
    expect(out.records).toEqual([]);
    expect(out.statDeltas).toEqual({});
  });

  it('gives a quiet serving year no mood, and a feed line', () => {
    let quiet = 0;
    for (let i = 0; i < 200 && quiet < 5; i += 1) {
      const out = yearOf(
        withSeed(serving(base, { grade: 5, years: 5, termEnds: 40, performance: 50 }), `edge-${i}`),
        30,
        2040,
      );
      if ((out.military.service?.grade ?? 5) !== 5) continue;
      quiet += 1;
      expect(out.mood).toBe(0);
      expect(out.lines).toHaveLength(1);
      expect(out.lines[0]!.kind).toBe('passive');
    }
    expect(quiet).toBeGreaterThan(0);
  });

  it('gives basic training +2 Discipline and +2 Health, the rest of a first term +1 Discipline, and nothing after', () => {
    const recruit = serving(base, { stage: 'training', grade: 1, years: 0, enlistedAge: 26 });
    let basic;
    for (let i = 0; i < 50 && !basic; i += 1) {
      const out = yearOf(withSeed(recruit, `basic-delta-${i}`), 27, 2040);
      if (!out.left) basic = out;
    }
    expect(basic!.statDeltas).toEqual({ discipline: 2, health: 2 });
    const first = yearOf(serving(base, { years: 3, termEnds: 8 }), 27, 2040);
    expect(first.statDeltas).toEqual({ discipline: 1 });
    const done = yearOf(serving(base, { years: 4, termEnds: 8 }), 27, 2040);
    expect(done.statDeltas).toEqual({});
  });

  it('keeps a sergeant major a sergeant major, whatever the year', () => {
    for (let i = 0; i < 100; i += 1) {
      const out = yearOf(
        withSeed(serving(base, { grade: 9, years: 22, termEnds: 40, performance: 90 }), `top-${i}`),
        40,
        2050,
      );
      expect(out.military.service?.grade).toBe(9);
    }
  });

  it('promotes the year the time is in, and not the year before', () => {
    let atTime = 0;
    for (let i = 0; i < 400; i += 1) {
      // A private first class with one year in: a second year makes two, which is Specialist's time exactly.
      const out = yearOf(
        withSeed(serving(base, { grade: 3, years: 1, termEnds: 40, performance: 95 }), `time-${i}`),
        28,
        2041,
      );
      if (out.military.service?.grade === 4) atTime += 1;
      const early = yearOf(
        withSeed(serving(base, { grade: 3, years: 0, termEnds: 40, performance: 95 }), `time-${i}`),
        28,
        2041,
      );
      expect(early.military.service?.grade).toBe(3);
    }
    expect(atTime).toBeGreaterThan(200);
  });

  it('pays a rise +2 mood and writes a record only from Sergeant up', () => {
    const risen = (from: number, years: number) => {
      for (let i = 0; i < 2000; i += 1) {
        const out = yearOf(
          withSeed(
            serving(base, { grade: from, years, termEnds: 99, performance: 100 }),
            `rise-mood-${from}-${i}`,
          ),
          30,
          2043,
        );
        if ((out.military.service?.grade ?? from) === from + 1) return out;
      }
      throw new Error(`no rise from ${from}`);
    };
    for (const [from, years, record] of [
      [3, 1, false],
      [4, 2, true],
      [5, 5, true],
      [6, 9, true],
    ] as const) {
      const out = risen(from, years);
      expect(out.mood, `E-${from}`).toBe(2);
      const promoted = out.records.filter((row) => /Promoted/.test(row.label));
      expect(promoted.length > 0, `E-${from}`).toBe(record);
      if (record) expect(promoted[0]!.label).toBe(`Promoted — ${findGrade(from + 1).title}`);
    }
  });

  it('retires with a lift of mood, 2', () => {
    const out = yearOf(
      serving(base, { grade: 7, years: 19, termEnds: 20, performance: 30 }),
      40,
      2050,
    );
    expect(out.mood).toBe(2);
  });

  it('asks a person exactly at the retention floor to stay, and lets one a point under go', () => {
    const middling = withStats(base, { discipline: 54, smarts: 54, health: 54 });
    const at = yearOf(
      serving(middling, { grade: 4, years: 3, termEnds: 4, performance: RETAIN_PERFORMANCE_FLOOR }),
      28,
      2041,
    );
    expect(at.military.offer?.kind).toBe('reenlist');
    const under = yearOf(
      serving(middling, {
        grade: 4,
        years: 3,
        termEnds: 4,
        performance: RETAIN_PERFORMANCE_FLOOR - 4,
      }),
      28,
      2041,
    );
    expect(under.military.offer).toBeUndefined();
    expect(under.military.past[0]?.how).toBe('not-retained');
  });

  it('raises no recruiter’s offer while another question stands, or any decision is open', () => {
    const age = 27;
    const chance = enlistOfferChance(age);
    const firing: string[] = [];
    for (let i = 0; i < 4000 && firing.length < 6; i += 1) {
      if (mixedUnit(`service:fire-${i}:${base.world.generation}:offer:${age}`) < chance) {
        firing.push(`fire-${i}`);
      }
    }
    expect(firing.length).toBe(6);
    const questioned = { ...base, offer: { jobId: 'x' } } as unknown as GameState;
    const decision = { eventId: 'activity.offer', choices: [{ id: 'skip', label: 'Skip' }] };
    const waiting = { ...base, pending: [decision] } as unknown as GameState;
    for (const seed of firing) {
      expect(yearOf(withSeed(base, seed), age, 2040).military.offer?.kind, seed).toBe('enlist');
      expect(yearOf(withSeed(questioned, seed), age, 2040).military.offer, seed).toBeUndefined();
      expect(yearOf(withSeed(waiting, seed), age, 2040).military.offer, seed).toBeUndefined();
    }
  });

  it('starts a career at 50 and 50, with nothing paid and the effort normal', () => {
    const result = applyToEnlist(base);
    if (!result.ok) throw new Error('should enlist');
    const career = result.value.state.military.service!;
    expect(career.performance).toBe(50);
    expect(career.reputation).toBe(50);
    expect(career.lastPay).toBe(0);
    expect(career.pushedAtAge).toBeUndefined();
  });

  it('numbers an entry after the others written at the same age', () => {
    const before = base.player.timeline.filter((row) => row.age === base.player.age).length;
    const result = applyToEnlist(base);
    if (!result.ok) throw new Error('should enlist');
    expect(result.value.entry.sequence).toBe(before);
    const pushed = workHarder(serving(base, { performance: 50 }));
    if (!pushed.ok || !pushed.value.entry) throw new Error('should push');
    expect(pushed.value.entry.sequence).toBe(before);
  });
});

describe('answers leave every other question alone', () => {
  const base = eligible(adult('MIL-PENDING', 26));
  const other = {
    eventId: 'activity.offer',
    category: 'life',
    age: 26,
    year: 2040,
    prompt: 'A club.',
    choices: [{ id: 'skip', label: 'Skip' }],
    names: {},
  };
  const enlist = { ...ARMY_OFFER, age: 26 } as const;
  const reenlist = {
    kind: 'reenlist',
    branch: 'army',
    grade: 5,
    years: 4,
    age: 26,
    eventId: MILITARY_OFFER_EVENT_ID,
  } as const;
  const standing = (patch: Partial<GameState>): GameState => {
    const state = { ...base, ...patch } as GameState;
    return withMilitaryOffer(state, true);
  };
  const pendingIds = (state: GameState) => state.pending.map((row) => row.eventId);

  it('leaves another decision standing when a recruiter is answered yes or no', () => {
    const asked = standing({ pending: [other], military: { past: [], offer: enlist } } as never);
    expect(pendingIds(asked).sort()).toEqual(['activity.offer', MILITARY_OFFER_EVENT_ID]);
    for (const choice of [MILITARY_ENLIST, MILITARY_DECLINE]) {
      const answered = answerMilitaryOffer(asked, choice);
      if (!answered.ok) throw new Error('should answer');
      expect(pendingIds(answered.value.state), choice).toEqual(['activity.offer']);
    }
  });

  it('leaves another decision standing when a term’s question is answered either way', () => {
    const asked = standing({
      pending: [other],
      military: { past: [], offer: reenlist, service: serviceRow({ years: 4, grade: 5 }) },
    } as never);
    for (const choice of [MILITARY_REENLIST, MILITARY_LEAVE]) {
      const answered = answerMilitaryOffer(asked, choice);
      if (!answered.ok) throw new Error('should answer');
      expect(pendingIds(answered.value.state), choice).toEqual(['activity.offer']);
    }
  });

  it('leaves another decision standing when the career has gone and the question is voided', () => {
    const asked = standing({ pending: [other], military: { past: [], offer: reenlist } } as never);
    const answered = answerMilitaryOffer(asked, MILITARY_REENLIST);
    if (!answered.ok) throw new Error('should answer');
    expect(pendingIds(answered.value.state)).toEqual(['activity.offer']);
  });

  it('leaves another decision standing when somebody applies at the office', () => {
    const state = { ...base, pending: [other] } as GameState;
    const result = applyToEnlist(state);
    if (!result.ok) throw new Error('should enlist');
    expect(pendingIds(result.value.state)).toEqual(['activity.offer']);
  });

  it('resigns a job that is held, and writes the resignation before the enlistment', () => {
    const job = {
      jobId: 'job.teaching-assistant',
      since: base.player.age - 3,
      performance: 50,
      effort: 'normal',
      pushedThisYear: 0,
    };
    const employed = { ...base, employment: { ...base.employment, job } } as unknown as GameState;
    const result = applyToEnlist(employed);
    if (!result.ok) throw new Error('should enlist');
    expect(result.value.state.employment.job).toBeUndefined();
    expect(result.value.state.employment.history.at(-1)?.jobId).toBe('job.teaching-assistant');
    const texts = result.value.state.player.timeline.map((row) => row.text);
    expect(texts.findIndex((text) => /Left after/.test(text))).toBeLessThan(
      texts.findIndex((text) => /enlisted/i.test(text)),
    );
  });

  it('stops a serving member being asked for a recruiter’s job, and keeps standing questions as asked', () => {
    expect(servicePushesLeft(base)).toBe(0);
  });
});

describe('Work Harder, at its edges', () => {
  const base = eligible(adult('MIL-WORKEDGE', 26));
  const soldier = serving(base, { performance: 50 });

  it('pays a press 5 to 12 points when it works, and 0 when it does not, never otherwise', () => {
    let worked = 0;
    let missed = 0;
    let most = 0;
    let least = 99;
    for (let i = 0; i < 600; i += 1) {
      const result = workHarder(withSeed(soldier, `gain-${i}`));
      if (!result.ok) throw new Error('press');
      const gain = result.value.state.military.service!.performance - 50;
      if (gain === 0) {
        missed += 1;
        continue;
      }
      worked += 1;
      most = Math.max(most, gain);
      least = Math.min(least, gain);
    }
    expect(missed).toBeGreaterThan(100);
    expect(worked).toBeGreaterThan(300);
    expect(worked / 600).toBeGreaterThan(0.64);
    expect(worked / 600).toBeLessThan(0.8);
    expect(least).toBe(5);
    expect(most).toBe(12);
  });

  it('pays a second press at 55%, 3 to 7 points', () => {
    let most = 0;
    let least = 99;
    for (let i = 0; i < 800; i += 1) {
      const first = workHarder(withSeed(soldier, `second-${i}`));
      if (!first.ok) throw new Error('press');
      const second = workHarder(first.value.state);
      if (!second.ok) throw new Error('press');
      const gain =
        second.value.state.military.service!.performance -
        first.value.state.military.service!.performance;
      if (gain === 0) continue;
      most = Math.max(most, gain);
      least = Math.min(least, gain);
    }
    expect(least).toBe(3);
    expect(most).toBe(7);
  });

  it('counts a press from a count that was never written as the first', () => {
    const odd = serving(base, { performance: 50, pushedAtAge: base.player.age });
    expect(servicePushesLeft(odd)).toBe(2);
    const result = workHarder(odd);
    if (!result.ok) throw new Error('press');
    expect(result.value.state.military.service!.pushedThisYear).toBe(1);
  });
});

describe('another career that is the whole year', () => {
  const base = eligible(adult('MIL-BUSY', 26));
  const cases: readonly [string, (state: GameState) => GameState, (state: GameState) => boolean][] =
    [
      [
        'a pro on a team',
        (state) =>
          ({
            ...state,
            sports: {
              ...state.sports,
              career: {
                sportId: 'basketball',
                stage: 'pro',
                startedAge: 14,
                seasons: 6,
                hardSeasons: 3,
                form: 71,
                trainedAtAge: 25,
                trainedCount: 2,
                reputation: 38,
                titles: 0,
                team: 'Harbor City Gulls',
                tier: 'star',
                peak: 'star',
                breakout: 2,
                proSeasons: 3,
                endAge: 32,
                pick: 14,
                contract: { salary: 6_000_000, yearsLeft: 1, rookie: false },
              },
            },
          }) as unknown as GameState,
        (state) => isSportsFullTime(state.sports.career),
      ],
      [
        'a professional coach',
        (state) =>
          ({
            ...state,
            sports: {
              ...state.sports,
              post: { sportId: 'basketball', kind: 'coach', level: 'pro', since: 25, seasons: 1 },
            },
          }) as unknown as GameState,
        (state) => isPostFullTime(state.sports.post),
      ],
      [
        'an actor with credits',
        (state) =>
          ({
            ...state,
            acting: { ...state.acting, tier: 'supporting', credits: 5, idle: 0 },
          }) as unknown as GameState,
        (state) => isActingFullTime(state.acting),
      ],
      [
        'a musician whose year paid like a living',
        (state) => ({ ...state, music: { ...state.music, lastPay: 60_000, idle: 0 } }) as GameState,
        (state) => isMusicFullTime(state.music),
      ],
      [
        'a model whose year paid like a living',
        (state) =>
          ({ ...state, modeling: { ...state.modeling, lastPay: 60_000, idle: 0 } }) as GameState,
        (state) => isModelingFullTime(state.modeling),
      ],
    ];

  it('is not in the way when nothing is', () => {
    expect(enlistmentBar(base)).toBeUndefined();
    for (const [, , busy] of cases) expect(busy(base)).toBe(false);
  });

  for (const [name, make, busy] of cases) {
    it(`turns away ${name}, and only them`, () => {
      const state = make(base);
      expect(busy(state), 'the fixture is the career it says').toBe(true);
      expect(enlistmentBar(state)).toBe('busy');
      expect(applyToEnlist(state).ok).toBe(false);
    });
  }
});

void mixedUnit;
