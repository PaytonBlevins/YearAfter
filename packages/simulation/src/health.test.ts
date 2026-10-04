/**
 * Ticket 0211 acceptance tests — a life that ends.
 *
 * The measured baseline this ticket exists to fix, taken before a line of it was
 * written: health was p10 38 / median 52 / p90 63 at TWENTY, and identical at
 * thirty, forty, fifty, sixty, seventy and eighty. Nothing in the build had ever
 * written to it after childhood, and 80 of 80 characters were alive at eighty.
 *
 * So these do not assert the constants. They play lives and assert the SHAPE of
 * the population that comes out, which is the only thing that can catch a curve
 * that is right in the comment and wrong in the game (CORE_RULES 13.25).
 */

import { describe, expect, it } from 'vitest';
import { CONDITIONS, INJURY_PERMANENT, findCondition, injuryChance } from '@yearafter/health';
import { findActivity } from '@yearafter/content';
import { advanceYear } from './advance';
import { joinActivity } from './joining';
import { tryOut } from './tryout';
import { applyFor, chanceOf, openings, workHarder } from './careers';
import { decide } from './decide';
import type { GameState } from './game-state';
import { isInSchool } from '@yearafter/education';
import { HURT_LINES } from './phases/health';
import { createNewGame } from './new-game';
import { activityOffers } from '@yearafter/education';

/**
 * What this character could sign up for right now.
 *
 * Ticket 0405 found the bug this guards against: this used to hardcode
 * `stage: 'middle'` regardless of the character's real one, which was
 * harmless only because nobody in this harness ever reached college with an
 * empty activity list before. `isInSchool` correctly counts college as
 * school (0210b's own fix), so a character mid-degree passed that gate and
 * then got handed MIDDLE SCHOOL sports back, because the context lied about
 * which stage they were actually in. 0405 routes most of this harness's
 * population through college, which is what finally exercised it — a
 * twenty-year-old "joining" `act.basketball` and carrying the athlete
 * classification for the rest of their life, which is what inverted this
 * test's ratio until this was found.
 *
 * `SchoolStageId` only has room for elementary/middle/high — there is no
 * college activity system to route a real stage to — so anybody outside
 * those three actual stages is offered nothing, which is the correct answer
 * rather than a special case of one.
 */
const anyOffer = (state: GameState) => {
  const stage = state.education.stage;
  if (stage !== 'elementary' && stage !== 'middle' && stage !== 'high') return [];
  return activityOffers(state.education, {
    age: state.player.age,
    stage,
    stats: state.player.stats,
    talents: state.player.talents,
    wealth: state.family.finances.band,
    household: state.family,
  });
};

const LIVES = 150;
/** Long enough that nobody should still be standing. */
const UNTIL = 115;

/**
 * What a feed line reads like when this year hurt somebody.
 *
 * Ticket 0405 found the bug in this heuristic rather than in the ticket
 * itself: "fall" alone also matches `college.ts`'s "Got in. Four years of
 * {major}, starting in the fall." — a line that used to be rare enough,
 * before a passive player had any systemic way into college, that a false
 * match here never moved the ratio. 0405 makes that line common, which is
 * the ticket working, and it turned a dormant imprecision in THIS regex into
 * a real one: the "ordinary" bucket (everybody not an athlete or in a
 * hazard-track job — which includes every college acceptance) picked up
 * hundreds of false "hurt" years from the word "fall" meaning autumn.
 *
 * The negative lookbehind is the whole fix: an injury reads "a bad fall",
 * never "in the fall". `packages/simulation/src/phases/health.ts`'s
 * `HURT_LINES` is the source of truth this pattern is checked against.
 */
/**
 * An injury is one of the health phase's OWN lines (Ticket 0409).
 *
 * This was a regex — `hurt|fall|accident|came off` — standing in for "the
 * health phase reported an injury", and it drifted from that meaning twice.
 * 0405 found it matching "starting in the fall" in a college acceptance letter,
 * rare enough then not to move a ratio. 0409 wrote the first adult injury
 * content in the catalog ("Hurt your back lifting something stupid") and every
 * one of those lines landed in the bucket labelled "a classmate who joined
 * nothing", inverting the comparison.
 *
 * Matching the phase's actual lines removes the proxy. The list is imported
 * rather than copied, so copy edits move both sides together.
 */
const wasHurt = (text: string): boolean =>
  HURT_LINES.some((line) => text.includes(line.replace(/\.$/, '')));

const answerAll = (state: GameState): GameState => {
  let current = state;
  let guard = 0;
  while (current.pending.length > 0 && (guard += 1) < 12) {
    const decision = current.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const result = decide(current, decision.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
};

interface Life {
  readonly state: GameState;
  /** Every condition this character ever picked up, cleared or not. */
  readonly everHeld: ReadonlySet<string>;
  readonly diedAt: number;
  readonly healthAt: Readonly<Record<number, number>>;
  readonly everInjured: number;
  readonly athleteYears: number;
  readonly hazardYears: number;
  readonly ordinaryYears: number;
  readonly injuredAthlete: number;
  readonly injuredHazard: number;
  readonly injuredOrdinary: number;
}

/** Somebody who works and never sees a doctor. The default way to play. */
function live(seed: string): Life {
  let state = createNewGame({ seed });
  const healthAt: Record<number, number> = {};
  let everInjured = 0;
  let athleteYears = 0;
  let hazardYears = 0;
  let ordinaryYears = 0;
  let injuredAthlete = 0;
  let injuredHazard = 0;
  let injuredOrdinary = 0;
  const everHeld = new Set<string>();
  const HAZARD = ['trade', 'labour', 'food', 'transport', 'care'];

  for (let year = 0; year < UNTIL; year += 1) {
    if (!state.player.alive) break;
    const wasAthlete = state.education.activities.some(
      (entry) => findActivity(entry.activityId)?.kind === 'sport',
    );
    const track = state.employment.job ? state.employment.job.jobId.split('.')[1] : undefined;
    const wasHazard = track !== undefined && HAZARD.includes(track);
    const before = state.player.timeline.length;

    state = answerAll(advanceYear(state).state);

    const hurt = state.player.timeline
      .slice(before)
      .some((entry) => wasHurt(entry.text));
    /*
      THE ATHLETE COMPARISON IS A SCHOOL COMPARISON (Ticket 0409).

      This test is called "hurts a school athlete more often than a classmate
      who joined nothing" and was bucketing all eighty years of a life, which
      was the same measurement while the adult catalog had no injuries in it —
      0409 measured 26 events able to fire at forty and not one about a body.
      Now an adult can hurt their back lifting something, and every one of those
      lines was landing in the "classmate who joined nothing" bucket and
      inverting the ratio.

      `wasHazard` deliberately still counts at any age: that bucket is about
      dangerous WORK, which is an adult thing by definition. CORE_RULES 13.63.
    */
    const atSchool = isInSchool(state.education);
    if (wasAthlete && atSchool) {
      athleteYears += 1;
      if (hurt) injuredAthlete += 1;
    } else if (wasHazard) {
      hazardYears += 1;
      if (hurt) injuredHazard += 1;
    } else if (atSchool) {
      ordinaryYears += 1;
      if (hurt) injuredOrdinary += 1;
    }
    if (hurt) everInjured += 1;

    // Join something, once, as soon as there is something to join. The first
    // version of this harness never did, and reported ZERO school years in a
    // sport across 150 lives — so the athlete branch of the injury model, which
    // spec 541-543 puts FIRST, was measured entirely on a population that could
    // not reach it. The population a test plays is the test (CORE_RULES 13.25).
    if (state.education.activities.length === 0) {
      // EVERY sport needs a tryout — 0204b made that true and the first version
      // of this harness looked for one that did not, found none, and reported
      // zero athlete-years. So it tries out, every year, until it makes a team.
      const sport = anyOffer(state).find(
        (row) => !row.unavailable && findActivity(row.activity.id)?.kind === 'sport',
      );
      if (sport) {
        const attempt = tryOut(state, sport.activity.id);
        if (attempt.ok) state = attempt.value.state;
      } else {
        const other = anyOffer(state).find((row) => !row.needsTryout && !row.unavailable);
        if (other) state = joinActivity(state, other.activity.id);
      }
    }

    if (state.player.age >= 18 && !state.employment.job) {
      const list = [...openings(state)].sort((a, b) => chanceOf(state, b) - chanceOf(state, a));
      for (const job of list.slice(0, 2)) {
        const result = applyFor(state, String(job.id));
        if (!result.ok) continue;
        state = result.value.state;
        if (result.value.hired) break;
      }
    } else if (state.employment.job) {
      const result = workHarder(state);
      if (result.ok) state = result.value.state;
    }
    healthAt[state.player.age] = state.player.stats.health;
    for (const held of state.health.conditions) everHeld.add(held.conditionId);
  }
  return {
    state,
    everHeld,
    diedAt: state.health.diedAtAge ?? UNTIL,
    healthAt,
    everInjured,
    athleteYears,
    hazardYears,
    ordinaryYears,
    injuredAthlete,
    injuredHazard,
    injuredOrdinary,
  };
}

const LIFETIMES: readonly Life[] = Array.from({ length: LIVES }, (_, index) =>
  live(`health-${index}`),
);

const pct = (xs: number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0;
};
const healthAt = (age: number) =>
  LIFETIMES.map((life) => life.healthAt[age]).filter((h): h is number => h !== undefined);

describe('a life ends', () => {
  it('prints the shape of a played population', () => {
    const ages = LIFETIMES.map((life) => life.diedAt);
    // eslint-disable-next-line no-console
    console.log(
      `\nAGE AT DEATH  p10 ${pct(ages, 0.1)}  median ${pct(ages, 0.5)}  p90 ${pct(ages, 0.9)}`,
      `\n  before 40: ${ages.filter((a) => a < 40).length}/${LIVES}`,
      `  before 60: ${ages.filter((a) => a < 60).length}/${LIVES}`,
      `  still alive at ${UNTIL}: ${LIFETIMES.filter((l) => l.state.player.alive).length}`,
      `\nHEALTH  ` +
        [20, 40, 60, 80]
          .map(
            (age) =>
              `age ${age}: ${pct(healthAt(age), 0.1)}/${pct(healthAt(age), 0.5)}/${pct(healthAt(age), 0.9)}`,
          )
          .join('   '),
      `\nCONDITIONS held at death: median ${pct(
        LIFETIMES.map((l) => l.state.health.conditions.length),
        0.5,
      )}`,
      `\nCAUSES: ${JSON.stringify(
        LIFETIMES.reduce<Record<string, number>>((counts, life) => {
          const cause = life.state.health.causeOfDeath ?? 'still alive';
          counts[cause] = (counts[cause] ?? 0) + 1;
          return counts;
        }, {}),
      )}`,
    );
    expect(LIVES).toBeGreaterThan(0);
  });

  it('kills everybody eventually', () => {
    // The baseline was 80/80 alive at eighty. A life sim in which nobody dies is
    // not a life sim, and 0212 has nothing to build on.
    const alive = LIFETIMES.filter((life) => life.state.player.alive).length;
    expect(alive, `${alive} still alive at ${UNTIL}`).toBeLessThanOrEqual(2);
  });

  it('does not kill healthy young people', () => {
    // Spec 559: "unexpected sudden death in otherwise healthy characters should
    // almost never occur." This is the assertion that constrains every constant
    // in the mortality curve, so it is stated as a hard bound rather than a
    // preference.
    const ages = LIFETIMES.map((life) => life.diedAt);
    const young = ages.filter((age) => age < 40).length / LIVES;
    expect(young, `${Math.round(young * 100)}% died before 40`).toBeLessThan(0.05);
    const child = ages.filter((age) => age < 18).length;
    expect(child, `${child} died as children`).toBeLessThanOrEqual(1);
  });

  it('produces a plausible span rather than a single number', () => {
    const ages = LIFETIMES.map((life) => life.diedAt);
    expect(pct(ages, 0.5), 'median age at death').toBeGreaterThan(70);
    expect(pct(ages, 0.5), 'median age at death').toBeLessThan(92);
    // A life sim where everybody dies at the same age has a timer, not a body.
    expect(pct(ages, 0.9) - pct(ages, 0.1), 'p90 - p10 span').toBeGreaterThan(18);
  });

  it('moves health, which is the whole reason this ticket exists', () => {
    // The baseline: median 52 at twenty AND at eighty. Anything is better than
    // that; this asserts the direction and that the fall is real.
    const at30 = pct(healthAt(30), 0.5);
    const at70 = pct(healthAt(70), 0.5);
    expect(at30, `median health at 30 was ${at30}`).toBeGreaterThan(at70);
    expect(at30 - at70, `fall from 30 to 70 was ${at30 - at70}`).toBeGreaterThan(12);
  });

  it('keeps injuries in the order spec 541-543 puts them', () => {
    // Measured on the MODEL rather than on the feed, and the first version of
    // this test is the reason. It counted timeline lines matching a regex of
    // injury-sounding words, which matched illness lines too and reported an
    // ordinary-person injury rate of 0.0124 — five times the actual constant.
    // A test instrument that is wrong reports a defect that is not there and
    // hides the one that is.
    //
    // It also reported athletes at exactly zero, which IS real and is recorded
    // as a finding rather than fixed here: `education.activities` only exists
    // while a character is at school, so nobody over eighteen is an athlete in
    // this build. Adult sport arrives in v0.08.
    const runs = 200_000;
    const rate = (exposure: { athlete: boolean; hazardous: boolean }) => {
      let hurt = 0;
      const chance = injuryChance(exposure);
      for (let i = 0; i < runs; i += 1) if (i / runs < chance) hurt += 1;
      return hurt / runs;
    };
    const athlete = rate({ athlete: true, hazardous: false });
    const hazardous = rate({ athlete: false, hazardous: true });
    const ordinary = rate({ athlete: false, hazardous: false });

    expect(athlete, 'athletes first').toBeGreaterThan(hazardous);
    expect(hazardous, 'then hazardous work').toBeGreaterThan(ordinary);
    // "still not overly frequent" — an athlete should not expect an injury
    // every few seasons, which at 0.035 is roughly one in a school career.
    expect(athlete, 'and still rare').toBeLessThan(0.06);
    expect(ordinary, 'ordinary people extremely rare').toBeLessThan(0.005);
    // "Permanent injuries are rarer still."
    expect(INJURY_PERMANENT).toBeLessThan(0.5);
  });

  it('hurts a school athlete more often than a classmate who joined nothing', () => {
    // The ordering, in a played population this time — because a rule that is
    // true in the constant and false in the game is the 0210 lesson, and the
    // model test above cannot catch a phase that passes the wrong flag.
    let athleteYears = 0;
    let athleteHurt = 0;
    let idleYears = 0;
    let idleHurt = 0;
    for (const life of LIFETIMES) {
      athleteYears += life.athleteYears;
      athleteHurt += life.injuredAthlete;
      idleYears += life.ordinaryYears;
      idleHurt += life.injuredOrdinary;
    }
    // eslint-disable-next-line no-console
    console.log(
      `\nSCHOOL YEARS — in a sport ${athleteYears}, in nothing ${idleYears}`,
      `\nhurt lines: ${athleteHurt} vs ${idleHurt}`,
    );
    expect(athleteYears, 'characters do join sports').toBeGreaterThan(500);
    const athleteRate = athleteHurt / athleteYears;
    const idleRate = idleHurt / idleYears;
    // Measured: 100 hurt lines in 1,533 sport-years against 38 in 8,596 without.
    // The absolute rates are inflated because this counts feed lines and some
    // illness copy reads like an injury — but the RATIO is what spec 541-543
    // constrains, and a school athlete is an order of magnitude likelier.
    expect(athleteRate, 'athletes get hurt more').toBeGreaterThan(idleRate * 4);
  });

  it('every condition in the catalog can actually be reached', () => {
    // CORE_RULES 13.7. A condition nobody ever gets is content that does not
    // exist, and twelve of them shipped untested would be twelve chances to be
    // wrong about which ones the roll can even select.
    // Measured on STATE, not on the feed. The first version searched timeline
    // text for each condition's label and broke the moment 0211b renamed them —
    // the feed lowercases a label mid-sentence, so "A bad back" never matched
    // "a bad back". A test that reads prose to find out what the model did is
    // testing the copy.
    const seen = new Set<string>();
    for (const life of LIFETIMES) {
      for (const id of life.everHeld) seen.add(id);
    }
    const missing = CONDITIONS.filter((condition) => !seen.has(condition.id)).map((c) => c.id);
    expect(missing, `never reached in ${LIVES} lives`).toEqual([]);
  });

  it('never leaves a condition on a character that is not in the catalog', () => {
    for (const life of LIFETIMES) {
      for (const held of life.state.health.conditions) {
        expect(findCondition(held.conditionId), held.conditionId).toBeDefined();
      }
    }
  });

  it('stops the world when the character dies', () => {
    for (const life of LIFETIMES) {
      if (life.state.player.alive) continue;
      // No open question on a dead character — `advanceYear` refuses to run
      // while one is pending, so leaving one would lock the app forever.
      expect(life.state.pending, life.state.player.firstName).toEqual([]);
      expect(life.state.health.causeOfDeath).toBeTruthy();
      expect(life.state.health.diedAtAge).toBe(life.state.player.age);
      // And advancing again changes nothing at all.
      const after = advanceYear(life.state);
      expect(after.state).toBe(life.state);
      expect(after.newEntries).toEqual([]);
    }
  });

  it('says so in the feed, once', () => {
    for (const life of LIFETIMES) {
      const deaths = life.state.player.timeline.filter((entry) =>
        entry.text.startsWith('You died'),
      );
      expect(deaths.length, life.state.player.firstName).toBe(life.state.player.alive ? 0 : 1);
    }
  });
});
