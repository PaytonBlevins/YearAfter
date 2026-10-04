/**
 * Ticket 0416 acceptance tests — something to belong to.
 *
 * Roadmap finding 2g said an adult could not join anything. Measured on 120
 * played lives before this ticket, it was wider than that:
 *
 * | | before |
 * |---|---|
 * | lives that EVER joined anything, at any age | **0 of 120** |
 * | share in an activity, any age | **0%** |
 * | adult years in a sport | **0%** |
 * | people met as an adult "through something you do" | **0** |
 * | twenty-year-olds with no friend | 60% |
 *
 * Every joining verb is behind a button. 0204's activities, 0206b's tryouts,
 * practice, seasons and teammates, 0209's parent paying and 0210's "something
 * you still do" meeting door were all built, tested, and unreachable to a
 * player who answers what the game asks. And for an adult there was no list
 * to join from at all.
 */

import { describe, expect, it } from 'vitest';
import { findActivity } from '@yearafter/content';
import { isCurrent, isFriend } from '@yearafter/social';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { lifeShaping } from './shaping';

const LIVES = 100;

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
  readonly held: readonly string[];
  readonly inSport: boolean;
  readonly friendless: boolean;
  /** Systemic questions open at once when the year was handed over. */
  readonly systemicOpen: number;
}

const SAMPLES: GameState[] = [];

function playALife(seed: string): { rows: readonly YearRow[]; final: GameState } {
  let state: GameState = createNewGame({ seed });
  const rows: YearRow[] = [];
  let guard = 0;
  while (state.player.alive && (guard += 1) < 110) {
    const raised = advanceYear(state).state;
    const systemicOpen = raised.pending.filter((decision) =>
      [
        'career.offer',
        'education.offer',
        'romance.offer',
        'family.offer',
        'activity.offer',
        'home.offer',
      ].includes(decision.eventId),
    ).length;
    state = answerEverything(raised);
    const age = state.player.age;
    if (age >= 20 && age % 9 === 0) SAMPLES.push(state);
    rows.push({
      age,
      held: state.education.activities.map((entry) => entry.activityId),
      inSport: state.education.activities.some(
        (entry) => findActivity(entry.activityId)?.kind === 'sport',
      ),
      friendless: !state.circle.people.some(
        (person) => isCurrent(person) && isFriend(person) && person.romance === undefined,
      ),
      systemicOpen,
    });
  }
  return { rows, final: state };
}

const PLAYED = Array.from({ length: LIVES }, (_, i) => playALife(`belong-${i}`));
const ALL = PLAYED.flatMap((life) => [...life.rows]);
const at = (age: number) => ALL.filter((row) => row.age === age);
const between = (from: number, to: number) => ALL.filter((row) => row.age >= from && row.age <= to);
const share = (rows: readonly YearRow[], of: (row: YearRow) => boolean) =>
  rows.length === 0 ? 0 : rows.filter(of).length / rows.length;
const isAdult = (id: string) => findActivity(id)?.requires.stages.includes('adult') ?? false;

describe('0416 — something to belong to', () => {
  it('lets a character who only answers questions join something, at school and after it', () => {
    /*
      THE ASSERTION THAT MATTERS, and it went from an exact zero. Bounded above
      as well: a sign-up that everybody takes is a school rule, not a door, and
      the population it produces is the player who says yes to everything.
    */
    const child = share(between(12, 16), (row) => row.held.length > 0);
    const adult = share(between(25, 60), (row) => row.held.some(isAdult));
    console.log(
      `in something: ${(child * 100).toFixed(1)}% at 12-16, ${(adult * 100).toFixed(1)}% of adult years 25-60`,
    );
    expect(child, 'no child is in anything').toBeGreaterThan(0.4);
    expect(child, 'every child is in something').toBeLessThan(0.92);
    expect(adult, 'no adult is in anything').toBeGreaterThan(0.2);
    expect(adult, 'every adult is in something').toBeLessThan(0.65);
  });

  it('lets an adult put something down', () => {
    // The half a school never needed: nobody is dropped from a choir, they stop
    // going. Counted as a pursuit held one year and not the next.
    let ended = 0;
    let heldYears = 0;
    for (const life of PLAYED) {
      for (let i = 1; i < life.rows.length; i += 1) {
        const before = life.rows[i - 1]!.held.filter(isAdult);
        const after = new Set(life.rows[i]!.held);
        heldYears += before.length;
        ended += before.filter((id) => !after.has(id)).length;
      }
    }
    const rate = ended / Math.max(1, heldYears);
    console.log(`adult pursuits ended per held year: ${(rate * 100).toFixed(1)}%`);
    expect(heldYears).toBeGreaterThan(500);
    expect(rate, 'nobody ever stops').toBeGreaterThan(0.05);
    expect(rate, 'nothing is kept').toBeLessThan(0.3);
  });

  it('makes an adult an athlete, which 0211 found nobody over eighteen was', () => {
    const sport = share(between(18, 70), (row) => row.inSport);
    console.log(`adult years in a sport: ${(sport * 100).toFixed(1)}%`);
    expect(sport).toBeGreaterThan(0.03);
  });

  it('gives the years after school a third door to people', () => {
    /*
      0210 wrote "Three doors" into the adult meeting step — work, "something you
      still do", and where you live — and the middle one read a list that was
      empty for every adult in every life. And 0412's leftover: twenty was the
      loneliest year in the game, at 60% with no friend, because an adult had
      two doors instead of three.
    */
    const metThrough = PLAYED.flatMap((life) =>
      life.final.circle.people.filter((person) => person.metAtAge >= 18 && person.kind === 'peer'),
    );
    const viaSomething = metThrough.filter((person) => person.context === 'activity').length;
    const lonelyAtTwenty = share(at(20), (row) => row.friendless);
    console.log(
      `adults met through something they do: ${viaSomething} of ${metThrough.length}; no friend at 20: ${(lonelyAtTwenty * 100).toFixed(1)}%`,
    );
    expect(viaSomething / Math.max(1, metThrough.length)).toBeGreaterThan(0.1);
    expect(lonelyAtTwenty, 'twenty is still the loneliest year').toBeLessThan(0.45);
  });

  it('asks one systemic question a year, and this one last', () => {
    // A league sign-up must never be the reason a job, a college place or a
    // wedding went unasked. `hasSystemicOffer` is the rule; this is the proof.
    expect(ALL.every((row) => row.systemicOpen <= 1)).toBe(true);
  });

  it('develops the person holding it, read off a real played year', () => {
    /*
      The hobby half of 2c, which 0415 could not build. Proven as numbers in
      `pursuits.test.ts`; this is the plumbing — that a real save's pursuit
      reaches `lifeShaping` and comes back as the trait it is about.
    */
    const holder = SAMPLES.find((state) =>
      state.education.activities.some(
        (entry) => isAdult(entry.activityId) && entry.seasons >= 1 && entry.seasons <= 5,
      ),
    );
    expect(holder, 'no sampled adult held a new pursuit').toBeDefined();
    const shaped = lifeShaping({
      age: holder!.player.age,
      worldYear: holder!.world.year,
      // Without the children, so a small child's discipline cannot answer for
      // the pursuit.
      family: {
        ...holder!.family,
        members: holder!.family.members.filter((member) => member.role !== 'child'),
      },
      conditions: [],
      stressBefore: 5,
      stressAfter: 5,
      willpower: 70,
      activities: holder!.education.activities,
    });
    expect(shaped.happiness, 'a pursuit that is no pleasure').toBe(1);
    const traits = ['smarts', 'charisma', 'willpower', 'discipline'] as const;
    expect(
      traits.some((trait) => shaped[trait] === 1),
      'a new pursuit that builds nothing',
    ).toBe(true);
  });
});
