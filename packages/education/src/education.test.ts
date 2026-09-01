/**
 * Ticket 0204 acceptance tests.
 */

import { describe, expect, it } from 'vitest';
import { createPersonality, createStats, createTalents } from '@yearafter/character';
import { ACTIVITIES, findActivity } from '@yearafter/content';
import { asNpcId, dollars } from '@yearafter/core';
import type { FamilyMember, Household } from '@yearafter/relationships';
import {
  activityOffers,
  annualActivityEffects,
  committedCost,
  committedHours,
  join,
  leave,
  unavailableReason,
} from './activities';
import {
  ALTERNATIVE_SCHOOL_THRESHOLD,
  advanceBehaviour,
  advancePerformance,
  behaviourBaseline,
  targetPerformance,
} from './performance';
import { runSchoolYear } from './progression';
import { STUDY_GAIN_MAX, STUDY_GAIN_MIN, studyHarder } from './study';
import {
  EFFORT_HOURS,
  NOT_YET_ENROLLED,
  enrolmentLabel,
  statusLabel,
  gradePointAverage,
  isInSchool,
  hasStudiedThisYear,
  letterGrade,
  schoolLabel,
  stageForGrade,
  type EducationState,
} from './school';
import { assessWorkload, capacityFor, overloadPenalties } from './workload';

const parent = (): FamilyMember => ({
  id: asNpcId('npc:mother'),
  role: 'mother',
  firstName: 'Ana',
  lastName: 'Reyes',
  sex: 'female',
  birthYear: 1975,
  alive: true,
  tier: 1,
  personality: createPersonality(),
  relationship: 70,
});

const household = (members: FamilyMember[] = [parent()]): Household => ({
  members,
  finances: { band: 'comfortable', annualIncome: dollars(90_000) },
});

const input = (age: number, overrides: Partial<Parameters<typeof runSchoolYear>[1]> = {}) => ({
  age,
  stats: createStats(),
  talents: createTalents(),
  personality: createPersonality(),
  wealth: 'comfortable' as const,
  ...overrides,
});

/** Play a school career forward, returning every state along the way. */
function career(
  start: EducationState,
  toAge: number,
  overrides: Partial<Parameters<typeof runSchoolYear>[1]> = {},
): EducationState[] {
  const states: EducationState[] = [];
  let state = start;
  for (let age = 1; age <= toAge; age += 1) {
    state = runSchoolYear(state, input(age, overrides)).state;
    states.push(state);
  }
  return states;
}

describe('enrolment and progression', () => {
  it('starts school at five and graduates at eighteen', () => {
    // states[i] is the state at age i + 1.
    const states = career(NOT_YET_ENROLLED, 19);
    expect(states[3]?.stage).toBe('preschool'); // age 4
    expect(states[4]?.stage).toBe('elementary'); // age 5
    expect(states[4]?.gradeLevel).toBe(0);
    expect(states[16]?.gradeLevel).toBe(12); // age 17, final year
    expect(states[16]?.stage).toBe('high');
    expect(states[17]?.stage).toBe('graduated'); // age 18
  });

  it('passes through middle and high school on the way', () => {
    const stages = career(NOT_YET_ENROLLED, 18).map((state) => state.stage);
    expect(stages).toContain('elementary');
    expect(stages).toContain('middle');
    expect(stages).toContain('high');
  });

  it('maps grades to stages', () => {
    expect(stageForGrade(-1)).toBe('preschool');
    expect(stageForGrade(0)).toBe('elementary');
    expect(stageForGrade(5)).toBe('elementary');
    expect(stageForGrade(6)).toBe('middle');
    expect(stageForGrade(9)).toBe('high');
    expect(stageForGrade(13)).toBe('graduated');
  });

  it('is a no-op once school is over', () => {
    const graduated: EducationState = { ...NOT_YET_ENROLLED, stage: 'graduated' };
    const result = runSchoolYear(graduated, input(25));
    expect(result.state).toBe(graduated);
    expect(result.lines).toHaveLength(0);
  });

  it('names the enrolment honestly at every age', () => {
    // "Preschooler" for a one-year-old was the v0.01 placeholder problem with a
    // different word on it.
    expect(enrolmentLabel(NOT_YET_ENROLLED, 1)).toBe('Newborn');
    expect(enrolmentLabel(NOT_YET_ENROLLED, 2)).toBe('Toddler');
    expect(enrolmentLabel(NOT_YET_ENROLLED, 4)).toBe('Preschooler');

    const states = career(NOT_YET_ENROLLED, 18);
    expect(enrolmentLabel(states[4]!, 5)).toBe('Kindergartner');
    expect(enrolmentLabel(states[7]!, 8)).toBe('3rd Grader');
    expect(enrolmentLabel(states[13]!, 14)).toBe('Freshman');
    expect(enrolmentLabel(states[16]!, 17)).toBe('Senior');
    expect(enrolmentLabel(states[17]!, 18)).toBe('High School Graduate');
  });

  it('gives the same kind of answer at every school age', () => {
    // Review: "It should track grades consistently. When my character was 11, it
    // simply said I was in public school, now that I am 13, it says that I am in
    // 8th grade." The label must be a school year for the whole of school — one
    // age reading as a school TYPE was the bug.
    const states = career(NOT_YET_ENROLLED, 18);
    const schoolYear = /^(Kindergartner|\d+(st|nd|rd|th) Grader|Freshman|Sophomore|Junior|Senior)$/;
    for (let age = 5; age <= 17; age += 1) {
      const label = statusLabel(states[age - 1]!, age);
      expect(label, `age ${age}`).toMatch(schoolYear);
    }
    expect(statusLabel(states[17]!, 18)).toBe('High School Graduate');
  });

  it('grades the first report card on the child, not on the placeholder', () => {
    // A six-year-old's Career card read "F · 0.7 GPA". Performance starts at a
    // neutral 50 and drifts, so year one showed the starting value rather than
    // the child. A bright kid gets a bright first report card.
    const bright = career(NOT_YET_ENROLLED, 5, {
      stats: createStats({ smarts: 80, discipline: 70 }),
    });
    expect(letterGrade(bright[4]!.performance)).not.toBe('F');
    // And it still reflects the character rather than being a free pass.
    const struggling = career(NOT_YET_ENROLLED, 5, {
      stats: createStats({ smarts: 30, discipline: 30 }),
    });
    expect(struggling[4]!.performance).toBeLessThan(bright[4]!.performance);
  });

  it('does not announce a school a character has not started', () => {
    // A newborn's Career card read "Newborn / Public School" — `schoolType` has
    // a value from birth, and reading it unconditionally invented an enrolment.
    expect(schoolLabel(NOT_YET_ENROLLED)).toBeUndefined();
    const states = career(NOT_YET_ENROLLED, 18);
    expect(schoolLabel(states[4]!)).toBe('Public School');
    expect(schoolLabel(states[17]!)).toBe('Finished school');
  });

  it('derives the same label the stored one is written from', () => {
    // The header and the Career screen both call statusLabel; the save summary
    // stores what it returns. Three places, one function, no drift.
    const states = career(NOT_YET_ENROLLED, 18);
    expect(statusLabel(states[12]!, 13)).toBe('8th Grader');
    expect(statusLabel(NOT_YET_ENROLLED, 0)).toBe('Newborn');
    const dropout: EducationState = { ...NOT_YET_ENROLLED, stage: 'droppedOut', finishedAtAge: 16 };
    expect(statusLabel(dropout, 17)).toBe('Left School');
    expect(statusLabel(dropout, 30)).toBe('Unemployed');
    expect(statusLabel(dropout, 70)).toBe('Retired');
  });

  it('announces each milestone exactly once', () => {
    let state = NOT_YET_ENROLLED;
    const milestones: string[] = [];
    for (let age = 1; age <= 19; age += 1) {
      const result = runSchoolYear(state, input(age));
      state = result.state;
      milestones.push(...result.lines.filter((l) => l.kind === 'milestone').map((l) => l.text));
    }
    const starts = milestones.filter((text) => text.startsWith('Started'));
    expect(new Set(starts).size).toBe(starts.length);
    expect(milestones.filter((text) => text.includes('Graduated'))).toHaveLength(1);
  });
});

describe('Study Harder', () => {
  // Review: "I want there to just be a button that says study harder and it
  // potentially (most of the time) boosts their grades."

  it('boosts grades most of the time, but not always', () => {
    let worked = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (studyHarder(60, i / 1000, 0.5, 0.5).worked) worked += 1;
    }
    // "Most of the time" with room for a term that did not land.
    expect(worked / 1000).toBeGreaterThan(0.6);
    expect(worked / 1000).toBeLessThan(0.9);
  });

  it('is worth roughly a letter grade when it lands', () => {
    const small = studyHarder(60, 0, 0, 0);
    const big = studyHarder(60, 0, 1, 0);
    expect(small.gained).toBeGreaterThanOrEqual(STUDY_GAIN_MIN);
    expect(big.gained).toBeLessThanOrEqual(STUDY_GAIN_MAX);
    expect(letterGrade(big.performance)).not.toBe(letterGrade(60));
  });

  it('still says something happened when the term did not land', () => {
    const missed = studyHarder(60, 0.99, 0.5, 0);
    expect(missed.worked).toBe(false);
    // Not zero: a result of exactly nothing reads as a broken button.
    expect(missed.gained).toBeGreaterThan(0);
    expect(missed.text.length).toBeGreaterThan(0);
  });

  it('cannot push a character past the top of the scale', () => {
    const topped = studyHarder(100, 0, 1, 0);
    expect(topped.performance).toBe(100);
  });

  it('is available once per school year', () => {
    const state: EducationState = { ...NOT_YET_ENROLLED, studiedAtAge: 12 };
    expect(hasStudiedThisYear(state, 12)).toBe(true);
    expect(hasStudiedThisYear(state, 13)).toBe(false);
  });
});

describe('grades', () => {
  it('reports a letter and a GPA, never the raw number', () => {
    expect(letterGrade(95)).toBe('A');
    expect(letterGrade(72)).toBe('C');
    expect(letterGrade(20)).toBe('F');
    expect(gradePointAverage(100)).toBe(4);
    expect(gradePointAverage(45)).toBe(0);
    expect(gradePointAverage(30)).toBe(0);
  });

  it('grades a child against children their own age', () => {
    // Stats grow through childhood, but the formula's constant was fitted at the
    // top of that curve — so an ordinary six-year-old was graded an F with a 0.7
    // GPA. A screenshot caught it; no test could, because every test compared a
    // character against the same formula that produced them.
    const shared = {
      talents: createTalents(),
      effort: 'normal' as const,
      overloadPenalty: 0,
      schoolModifier: 0,
    };
    // Roughly the mean child at each age, measured across 150 simulated lives.
    const sixYearOld = targetPerformance({
      ...shared,
      age: 6,
      stats: createStats({ smarts: 63, discipline: 59 }),
    });
    const senior = targetPerformance({
      ...shared,
      age: 17,
      stats: createStats({ smarts: 76, discipline: 66 }),
    });
    expect(letterGrade(sixYearOld)).toBe(letterGrade(senior));
    expect(Math.abs(sixYearOld - senior)).toBeLessThan(8);
  });

  it('rewards effort by more than a rounding error', () => {
    // Spec 1821: "major + Study Harder is generally enough" — so the one lever
    // the player has must visibly move the outcome.
    const stats = createStats({ smarts: 60, discipline: 55 });
    const shared = { stats, talents: createTalents(), overloadPenalty: 0, schoolModifier: 0 };
    const coasting = targetPerformance({ ...shared, effort: 'coasting' });
    const hard = targetPerformance({ ...shared, effort: 'hard' });
    expect(hard - coasting).toBeGreaterThanOrEqual(15);
  });

  it('lets Smarts set the ceiling and Discipline decide how much is realised', () => {
    const shared = {
      talents: createTalents(),
      effort: 'normal' as const,
      overloadPenalty: 0,
      schoolModifier: 0,
    };
    const bright = targetPerformance({
      ...shared,
      stats: createStats({ smarts: 85, discipline: 35 }),
    });
    const steady = targetPerformance({
      ...shared,
      stats: createStats({ smarts: 60, discipline: 85 }),
    });
    const both = targetPerformance({
      ...shared,
      stats: createStats({ smarts: 85, discipline: 85 }),
    });
    expect(both).toBeGreaterThan(bright);
    expect(both).toBeGreaterThan(steady);
    expect(bright).toBeGreaterThan(steady);
  });

  it('gives the Academics talent a real but not decisive edge', () => {
    const shared = {
      stats: createStats({ smarts: 65 }),
      effort: 'normal' as const,
      overloadPenalty: 0,
      schoolModifier: 0,
    };
    const without = targetPerformance({ ...shared, talents: createTalents() });
    const with_ = targetPerformance({ ...shared, talents: createTalents(['academics']) });
    expect(with_ - without).toBe(9);
  });

  it('moves towards the target rather than jumping to it', () => {
    const inputs = {
      stats: createStats({ smarts: 90 }),
      talents: createTalents(),
      effort: 'normal' as const,
      overloadPenalty: 0,
      schoolModifier: 0,
    };
    const first = advancePerformance(40, inputs);
    const second = advancePerformance(first, inputs);
    expect(first).toBeGreaterThan(40);
    expect(second).toBeGreaterThan(first);
    expect(first).toBeLessThan(targetPerformance(inputs));
  });
});

describe('behaviour and alternative school', () => {
  it('settles at a baseline instead of climbing forever', () => {
    // The first version added a flat recovery every year, so all 300 test lives
    // finished on 96-100 and spec 73's alternative school was unreachable.
    let calm = 70;
    let volatile = 70;
    for (let i = 0; i < 12; i += 1) {
      calm = advanceBehaviour(calm, 20, 70);
      volatile = advanceBehaviour(volatile, 92, 35);
    }
    expect(calm).toBeGreaterThan(80);
    expect(volatile).toBeLessThan(45);
    expect(behaviourBaseline(92, 35)).toBeLessThan(behaviourBaseline(20, 70));
  });

  it('places a character in an alternative school once standing collapses', () => {
    const troubled: EducationState = {
      ...NOT_YET_ENROLLED,
      stage: 'middle',
      gradeLevel: 7,
      behaviour: ALTERNATIVE_SCHOOL_THRESHOLD - 5,
    };
    const result = runSchoolYear(
      troubled,
      input(13, { personality: createPersonality({ temper: 95 }) }),
    );
    expect(result.state.schoolType).toBe('alternative');
    expect(result.lines.some((line) => line.text.includes('alternative school'))).toBe(true);
  });

  it('lets a character earn their way back out', () => {
    const recovering: EducationState = {
      ...NOT_YET_ENROLLED,
      stage: 'high',
      gradeLevel: 10,
      schoolType: 'alternative',
      behaviour: 80,
    };
    const result = runSchoolYear(recovering, input(16));
    expect(result.state.schoolType).toBe('public');
  });
});

describe('activities — the menu never refuses', () => {
  const enrolled: EducationState = {
    ...NOT_YET_ENROLLED,
    stage: 'high',
    gradeLevel: 10,
  };
  const context = {
    age: 16,
    stage: 'high' as const,
    stats: createStats({ smarts: 70, charisma: 70 }),
    talents: createTalents(['music']),
    wealth: 'comfortable' as const,
    household: household(),
  };

  it('lets a character join as many as they like', () => {
    // This is the whole point of Ticket 0204's activities fix: the shipped 0203
    // build allowed exactly one, forever, and the product owner rejected it.
    let state = enrolled;
    for (const activity of ACTIVITIES.filter((a) => a.requires.stages.includes('high'))) {
      state = join(state, activity.id, 16);
    }
    expect(state.activities.length).toBeGreaterThan(5);
    expect(committedHours(state)).toBeGreaterThan(50);
  });

  it('never reports an activity as unavailable merely because the character is busy', () => {
    let state = enrolled;
    for (const activity of ACTIVITIES) state = join(state, activity.id, 16);
    const offers = activityOffers(state, context);
    for (const offer of offers) {
      expect(offer.unavailable, offer.activity.id).not.toBe('too-busy' as never);
    }
  });

  it('shows what cannot be joined rather than hiding it', () => {
    // A menu that silently drops the rows you cannot have teaches the player
    // nothing. "Nobody free to drive you home" is a fact about their life.
    const limited = {
      ...context,
      stats: createStats({ smarts: 40, charisma: 30 }),
      wealth: 'struggling' as const,
      household: household([]),
    };
    const offers = activityOffers(enrolled, limited);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.some((offer) => offer.unavailable !== undefined)).toBe(true);
    expect(offers.some((offer) => offer.unavailable === undefined)).toBe(true);
  });

  it('closes late-finishing activities to a character with no living parent', () => {
    const orphaned = { ...context, household: household([]) };
    const play = findActivity('act.school-play');
    expect(play).toBeDefined();
    if (!play) return;
    expect(unavailableReason(play, orphaned)).toBe('needs-a-parent');
    expect(unavailableReason(play, context)).toBeUndefined();
  });

  it('closes paid activities to a struggling household', () => {
    const poor = { ...context, wealth: 'struggling' as const };
    const swim = findActivity('act.swimming');
    expect(swim).toBeDefined();
    if (!swim) return;
    expect(unavailableReason(swim, poor)).toBe('too-expensive');
  });

  it('is idempotent on join and leave', () => {
    const once = join(enrolled, 'act.chess', 16);
    expect(join(once, 'act.chess', 16).activities).toHaveLength(1);
    expect(leave(once, 'act.chess').activities).toHaveLength(0);
    expect(leave(enrolled, 'act.chess')).toBe(enrolled);
  });

  it('ignores an activity id that is not in the catalog', () => {
    expect(join(enrolled, 'act.nope', 16)).toBe(enrolled);
  });

  it('sums hours, cost and effects across everything joined', () => {
    const state = join(join(enrolled, 'act.chess', 16), 'act.cross-country', 16);
    const chess = findActivity('act.chess')!;
    const xc = findActivity('act.cross-country')!;
    expect(committedHours(state)).toBe(
      EFFORT_HOURS[state.effort] + chess.hoursPerWeek + xc.hoursPerWeek,
    );
    const effects = annualActivityEffects(state);
    expect(effects.smarts).toBe(chess.effects.smarts);
    expect(effects.health).toBe(xc.effects.health);
  });

  it('drops activities that do not exist at the next school', () => {
    const inMiddle: EducationState = { ...NOT_YET_ENROLLED, stage: 'middle', gradeLevel: 8 };
    const withScouts = join(inMiddle, 'act.scouts', 13);
    const result = runSchoolYear(withScouts, input(14));
    expect(result.state.stage).toBe('high');
    expect(result.state.activities).toHaveLength(0);
    expect(result.lines.some((line) => line.text.includes('Aged out'))).toBe(true);
  });
});

describe('money always says where it went', () => {
  it('charges for paid activities with a named source', () => {
    const state = join({ ...NOT_YET_ENROLLED, stage: 'high', gradeLevel: 10 }, 'act.band', 16);
    const band = findActivity('act.band')!;
    expect(committedCost(state)).toBe(band.annualCost);

    const result = runSchoolYear(state, input(17));
    expect(result.costs).toHaveLength(1);
    expect(result.costs[0]?.dollars).toBe(band.annualCost);
    expect(result.costs[0]?.payer).toBe('household');
    expect(result.costs[0]?.source.length).toBeGreaterThan(0);
    // The charge and the sentence explaining it are written together, never
    // separately — an unexplained balance change is the bug this prevents.
    const line = result.lines.find((entry) => entry.text.includes('$'));
    expect(line?.text).toContain(band.costSource);
  });

  it('never moves money without a source line', () => {
    const state = join({ ...NOT_YET_ENROLLED, stage: 'high', gradeLevel: 10 }, 'act.chess', 16);
    const result = runSchoolYear(state, input(17));
    expect(result.costs).toHaveLength(0);
    expect(result.lines.some((line) => line.text.includes('$'))).toBe(false);
  });

  it('never quietly drains the player\u2019s own cash for a school fee', () => {
    // The household pays. Charging the child and flooring at zero produced a
    // line claiming $216 had been paid beside a balance of $0.
    const state = join({ ...NOT_YET_ENROLLED, stage: 'high', gradeLevel: 10 }, 'act.band', 16);
    const result = runSchoolYear(state, input(17));
    expect(result.costs.every((cost) => cost.payer === 'household')).toBe(true);
    expect(result.costs.every((cost) => cost.dollars > 0)).toBe(true);
  });

  it('does not repeat the same overload sentence year after year', () => {
    // Four identical sentences in four years reads as a stuck game, not a hard
    // stretch. Variants are selected by age so a year still replays from a seed.
    let state: EducationState = { ...NOT_YET_ENROLLED, stage: 'high', gradeLevel: 9 };
    for (const id of ['act.football', 'act.band', 'act.wrestling', 'act.debate']) {
      state = join(state, id, 15);
    }
    const seen = new Set<string>();
    for (let age = 15; age <= 18; age += 1) {
      const result = runSchoolYear(
        { ...state, gradeLevel: 9 },
        input(age, { stats: createStats({ discipline: 30 }) }),
      );
      for (const line of result.lines) seen.add(line.text);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('gives every catalog activity that costs money a source', () => {
    for (const activity of ACTIVITIES) {
      if (activity.annualCost) {
        expect(activity.costSource, activity.id).toBeTruthy();
      }
    }
  });
});

describe('workload — the limit is real, not arbitrary', () => {
  it('gives a disciplined character more capacity than a scattered one', () => {
    const steady = capacityFor(
      createStats({ discipline: 85, willpower: 80 }),
      createPersonality(),
      16,
    );
    const scattered = capacityFor(
      createStats({ discipline: 25, willpower: 30 }),
      createPersonality(),
      16,
    );
    expect(steady).toBeGreaterThan(scattered);
  });

  it('gives a sixteen-year-old more capacity than a nine-year-old', () => {
    const stats = createStats();
    expect(capacityFor(stats, createPersonality(), 16)).toBeGreaterThan(
      capacityFor(stats, createPersonality(), 9),
    );
  });

  it('costs nothing until the character is genuinely over capacity', () => {
    const assessment = assessWorkload(6, createStats(), createPersonality(), 15);
    expect(assessment.overload).toBe(0);
    expect(assessment.load).toBe(0);
    expect(overloadPenalties(0)).toEqual({ performance: 0, health: 0, happiness: 0 });
  });

  it('takes grades hardest, then happiness, then health', () => {
    const penalties = overloadPenalties(12);
    expect(penalties.performance).toBeLessThan(penalties.happiness);
    expect(penalties.happiness).toBeLessThan(penalties.health);
    expect(penalties.health).toBeLessThan(0);
  });

  it('makes an over-committed year cost something and say so', () => {
    let state: EducationState = { ...NOT_YET_ENROLLED, stage: 'high', gradeLevel: 10 };
    for (const id of ['act.football', 'act.band', 'act.wrestling', 'act.debate']) {
      state = join(state, id, 16);
    }
    const result = runSchoolYear(state, input(17, { stats: createStats({ discipline: 30 }) }));
    expect(result.hiddenLoad).toBeGreaterThan(0);
    expect(result.statDeltas.health ?? 0).toBeLessThan(0);
    expect(result.statDeltas.happiness ?? 0).toBeLessThan(0);
    expect(result.lines.some((line) => line.text.length > 0)).toBe(true);
  });

  it('reports load without touching visible stress, which is 0205', () => {
    const result = runSchoolYear({ ...NOT_YET_ENROLLED, stage: 'high', gradeLevel: 10 }, input(17));
    expect(typeof result.hiddenLoad).toBe('number');
  });
});

describe('purity', () => {
  it('never mutates the state it was given', () => {
    const start: EducationState = { ...NOT_YET_ENROLLED, stage: 'middle', gradeLevel: 7 };
    const snapshot = JSON.parse(JSON.stringify(start));
    runSchoolYear(start, input(13));
    expect(JSON.parse(JSON.stringify(start))).toEqual(snapshot);
  });

  it('produces the same year twice from the same inputs', () => {
    const start: EducationState = { ...NOT_YET_ENROLLED, stage: 'middle', gradeLevel: 7 };
    expect(runSchoolYear(start, input(13))).toEqual(runSchoolYear(start, input(13)));
  });

  it('knows when a character is in school', () => {
    expect(isInSchool(NOT_YET_ENROLLED)).toBe(false);
    expect(isInSchool({ ...NOT_YET_ENROLLED, stage: 'high' })).toBe(true);
    expect(isInSchool({ ...NOT_YET_ENROLLED, stage: 'graduated' })).toBe(false);
  });
});
