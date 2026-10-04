/**
 * Ticket 0401 — how much of the career catalog a life can actually reach.
 *
 * THIS STARTED AS A THROWAWAY HARNESS AND EARNED ITS PLACE. v0.04's spec asks
 * for 150-250 job titles "without showing huge listing inventories", and before
 * writing two hundred job titles it was worth knowing how many of the
 * forty-nine that already existed a player ever saw. The answer was THIRTEEN,
 * and twenty of the forty-nine were never shown to a single character across a
 * hundred played lives. Adding two hundred more would have added two hundred
 * more that nobody sees.
 *
 * So it stays, and it asserts, because the number it prints is the one that
 * decides whether the catalog ticket is allowed to start — and these assertions
 * are what protect it while that ticket triples the catalog.
 *
 * Three things this file learned the hard way, each recorded because each one
 * produced a confident wrong answer first:
 *
 *  - WHICH LISTING THE SIMULATED PLAYER TAKES BIASES EVERYTHING. The first
 *    version took `openings(state)[0]`, which is the CHEAPEST — the list is
 *    sorted by pay ascending so it reads as a ladder. Every conclusion about
 *    which tracks get held was really a conclusion about which track has the
 *    lowest-paid entry job. Taking the dearest instead, 120 lives worked
 *    exactly two templates. Only "how many jobs were SEEN" survived all three
 *    pickers, so that is what is asserted.
 *  - A POOLED TOTAL HIDES AN ABSENT MECHANIC (13.51). "Distinct jobs shown
 *    across a hundred lives" can move while every individual life still sees
 *    the same thirteen, so the assertion is per-life.
 *  - AND THE RULER MOVES TOO. The composition counter measured step-ups against
 *    the raw held rung; when 0401 moved the gate onto the effective rung the
 *    buckets stopped summing to six, and it read as the mechanic collapsing. It
 *    was the ruler.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_JOBS,
  LISTINGS,
  WORKING_AGE,
  cannotApply,
  findJob,
  listingWeight,
  reachOf,
} from '@yearafter/careers';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { applyFor, atTheDoor, openings, whyNotJob, workHarder } from './careers';
import type { GameState } from './game-state';

/*
  250, not 60. The catalog roughly tripled in 0403 (49 -> 147), spread over
  sixteen tracks instead of eleven, and a rung-3 or rung-4 job is by
  definition the rarest thing any one track offers — reached only by a life
  that both climbed that specific ladder almost to its top AND happened to be
  showing at the moment its `openingsFor` draw favoured it over everything
  else that life was also eligible for. Measured at 60, then 120: a
  top-of-ladder job — unduplicated, no different in shape from before 0403 —
  went unseen by every life in the sample, and it was a DIFFERENT job each
  time the population grew, which is the signature of a coverage problem
  rather than a design one. `LISTINGS` and the stepUp weighting in
  `openingsFor` were both tried first (see git history) and neither moved the
  count without unpredictably starving something else instead. What actually
  cleared it was fixing the catalog shape that WAS a real defect — trades had
  drifted to four parallel titles on one rung, crowding its own top rung out
  before it ever competed with another track — and then sizing the sample to
  the catalog it is measuring: sixteen tracks' worth of rare events need more
  trials than eleven tracks' worth did before "never once drawn" means
  anything.
*/
const LIVES = 250;

const q = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))] ?? 0;
};
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/** Answers the first pending decision until the queue is empty. */
function settle(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 12) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const result = decide(next, decision.eventId, choice.id);
    if (!result.ok) break;
    next = result.value.state;
  }
  return next;
}

interface Life {
  /** Every job this character was ever SHOWN. Picker-independent. */
  readonly seen: Set<string>;
  /**
   * How many YEARS each job was eligible, not merely whether it ever was.
   *
   * Ticket 0407. A count rather than a set because one year of eligibility is
   * not the same claim as ten — see the starvation test below.
   */
  readonly eligible: Map<string, number>;
  /**
   * Per job, the chance this life NEVER saw it listed, given the odds it
   * actually had each year it was eligible (Ticket 0410).
   *
   * 1 means it was never eligible, or was eligible and could not be drawn at
   * all. A small number means the listings had a real run at it.
   */
  readonly missed: Map<string, number>;
  /**
   * Per job, the best single-year share of the six listings this life ever had.
   *
   * Zero while eligible is the shape of a real hole rather than bad luck: the
   * gate admits the job and the draw cannot reach it at all, which no number of
   * years will fix.
   */
  readonly bestShare: Map<string, number>;
  /** Six listings a year, counted while the character already had a job. */
  readonly employedYears: number;
  readonly stepUpsOffered: number;
}

/** One played life that takes a job when it has none and pushes when it does. */
function aCareer(seed: string): Life {
  let state = createNewGame({ seed });
  let nonce = 0;
  const seen = new Set<string>();
  const eligible = new Map<string, number>();
  const missed = new Map<string, number>();
  const bestShare = new Map<string, number>();
  let employedYears = 0;
  let stepUpsOffered = 0;

  for (let step = 0; step < 140; step += 1) {
    if (state.health.diedAtAge !== undefined) break;
    state = settle(advanceYear(state).state);
    if (state.player.age < WORKING_AGE) continue;
    if (state.retirement.retiredAtAge !== undefined) continue;

    const shown = [...openings(state)];
    for (const job of shown) seen.add(String(job.id));
    /*
      THE ODDS THIS YEAR, NOT JUST THE FACT OF BEING ELIGIBLE (Ticket 0410).

      `listingWeight` is the draw's own formula, exported so this cannot drift
      from it. A job's share of the six slots is its weight over the weight of
      everything else the character qualifies for, and multiplying the misses
      together across the years gives the chance the listings genuinely never
      got round to it.
    */
    const context = atTheDoor(state);
    const qualifies = ALL_JOBS.filter((job) => cannotApply(job, context) === undefined);
    const totalWeight = qualifies.reduce((sum, job) => sum + listingWeight(context, job), 0);
    for (const job of ALL_JOBS) {
      if (whyNotJob(state, job) === undefined) {
        const id = String(job.id);
        eligible.set(id, (eligible.get(id) ?? 0) + 1);
        const share =
          totalWeight > 0 ? Math.min(1, (LISTINGS * listingWeight(context, job)) / totalWeight) : 0;
        missed.set(id, (missed.get(id) ?? 1) * (1 - share));
        bestShare.set(id, Math.max(bestShare.get(id) ?? 0, share));
      }
    }

    if (state.employment.job === undefined) {
      nonce += 1;
      const job = shown[(state.player.age * 7 + nonce * 13) % Math.max(1, shown.length)];
      if (job) {
        const applied = applyFor(state, String(job.id));
        if (applied.ok) state = applied.value.state;
      }
    } else {
      const door = atTheDoor(state);
      employedYears += 1;
      for (const job of shown) {
        if (job.rung > 0 && job.rung === reachOf(door, job.track) + 1) stepUpsOffered += 1;
      }
      const pushed = workHarder(state);
      if (pushed.ok) state = pushed.value.state;
    }
  }
  return { seen, eligible, missed, bestShare, employedYears, stepUpsOffered };
}

describe('Ticket 0401 — how much of the catalog a life reaches', () => {
  const lives = Array.from({ length: LIVES }, (_, run) => aCareer(`catalog-${run}`));
  const seenCounts = lives.map((life) => life.seen.size);

  it('shows one life a real share of the jobs that exist', () => {
    const median = q(seenCounts, 0.5);
    console.log(
      `\njobs SEEN in one life (of ${ALL_JOBS.length}): p10 ${q(seenCounts, 0.1)}  median ${median}  p90 ${q(seenCounts, 0.9)}  — ${pct(median / ALL_JOBS.length)} of the catalog`,
    );

    /*
      TWENTY, NOT THE TWENTY-TWO MEASURED. Pinning the measured value would make
      this a tripwire on tuning rather than a floor on reachability. Before 0401
      it was THIRTEEN, so this fails on the old behaviour and holds through
      ordinary balance work.

      An absolute count rather than a fraction, on purpose: 0403 triples the
      catalog and six listings a year cannot keep pace with a fraction of two
      hundred and fifty. What a bigger catalog owes the player is not a bigger
      share — it is at least this many, still, plus variety in WHICH ones. The
      next test guards that half.
    */
    expect(median).toBeGreaterThanOrEqual(20);
  });

  it('never leaves a job eligible to somebody and unreachable by the listings', () => {
    /*
      THE GUARD THAT MATTERS WHEN THE CATALOG GROWS, and derived rather than
      pinned. A job the gate admits but the draw never surfaces is invisible in
      the worst way: the game believes the player could have had it. The count
      is zero today because the eligible set is small — and adding two hundred
      jobs is exactly the change that would break it, since six listings drawn
      from four hundred eligible rows would starve most of them. Which is why
      this is written BEFORE that ticket rather than after it.
    */
    /*
      "ELIGIBLE" MEANS ELIGIBLE FOR LONG ENOUGH TO HAVE SEEN IT (Ticket 0407).

      This counted a single year of eligibility as a claim the player could have
      had the job, which was fine while eligibility was narrow and stopped being
      fine when 0407 put everybody into work: far more characters now climb far
      enough to qualify for the top of a ladder, and many of them get there in
      their last years. Somebody who becomes eligible for a rung-four job at
      sixty-three and dies at sixty-five had two draws at six slots out of a
      hundred-odd rows. Calling that "the game said you could have had it" is
      the assertion measuring the sample rather than the system — and it was
      flaky with it, naming a different job on each run and MORE of them as the
      sample grew, which is the signature of a bound that does not hold rather
      than a defect that does.

      Three years is the threshold: long enough that the listings genuinely had
      a chance to surface it, short enough that a real hole still fails. The
      defect this guards against — a job the gate admits and the draw can never
      reach — starves every year of eligibility, not the first two.

      THE LONGEST SINGLE LIFE, NOT THE SUM ACROSS THE POPULATION. The first
      version added the years up, so three different characters with one year
      each read as three years of exposure — which is three people who each had
      two draws, not one person who had thirty. Summing measured how many people
      brushed past a job; the question is whether ANYBODY had a real run at it.
    */
    /*
      AND THE THRESHOLD IS THE ODDS, NOT THE YEARS (Ticket 0410).

      Three years was a proxy for "the listings had a real run at it", and 0410
      caught it failing as one. Director of pharmacy came up starved: eligible
      to exactly ONE character in 250, for nine years, never listed. Measured
      with `listingWeight`, that job was 10.3% of that character's six slots
      every one of those years, and the draw is independent year to year (the
      key carries the year — 0407), so never seeing it happens 0.897^9 = **37%
      of the time**. The guard was flagging a coin toss.

      A year count cannot tell that from a hole, because it does not know what a
      year was worth. This does: a job is starved when the listings should
      almost certainly have surfaced it — a 95% cumulative chance in a single
      life — and did not. A job with a share of zero is starved the instant
      anybody qualifies, which is what a real hole looks like and what 0407's
      three defects all were.
    */
    const ALMOST_CERTAIN = 0.95;
    const bestChance = new Map<string, number>();
    const reachable = new Map<string, number>();
    const eligibleYears = new Map<string, number>();
    const shownSomewhere = new Set<string>();
    for (const life of lives) {
      for (const [id, years] of life.eligible) {
        eligibleYears.set(id, Math.max(eligibleYears.get(id) ?? 0, years));
      }
      for (const [id, miss] of life.missed) {
        bestChance.set(id, Math.max(bestChance.get(id) ?? 0, 1 - miss));
      }
      for (const [id, share] of life.bestShare) {
        reachable.set(id, Math.max(reachable.get(id) ?? 0, share));
      }
      for (const id of life.seen) shownSomewhere.add(id);
    }
    const starved = [...bestChance]
      .filter(([id, chance]) => {
        if (shownSomewhere.has(id)) return false;
        // A job the draw cannot reach AT ALL is starved the instant anybody
        // qualifies — no number of years makes a zero share add up, and the
        // cumulative-chance test below would sit at zero forever and never fire.
        if ((reachable.get(id) ?? 0) <= 0) return true;
        return chance >= ALMOST_CERTAIN;
      })
      .map(([id]) => id);
    for (const id of starved) {
      console.log(
        `  starved: ${findJob(id)?.title ?? id} — best single life had a ` +
          `${pct(bestChance.get(id) ?? 0)} chance of being shown it across ` +
          `${eligibleYears.get(id)} eligible years, and never was; lives that ever qualified ` +
          `${lives.filter((life) => life.eligible.has(id)).length}`,
      );
    }
    if (starved.length > 0) {
      console.log(
        `eligible but never listed: ${starved.map((id) => findJob(id)?.title ?? id).join(', ')}`,
      );
    }
    expect(starved).toHaveLength(0);
  });

  it('puts a step up in front of somebody who already has a job', () => {
    /*
      Coverage alone would be satisfied by six cold starts a year — a screen
      that only ever offers to put you back at the bottom of something else.
      Measured before 0401: 1.30 of the six were a step up and 4.69 a cold start
      in a field the character had never worked. After: 3.38 and 2.48.
    */
    const years = lives.reduce((total, life) => total + life.employedYears, 0);
    const offered = lives.reduce((total, life) => total + life.stepUpsOffered, 0);
    expect(years).toBeGreaterThan(500);
    const perYear = offered / years;
    console.log(`step-ups among the six listings while employed: ${perYear.toFixed(2)} of 6`);
    // Two, not 3.38: a floor on "the list contains a career", not a pin on the
    // tuning. The pre-0401 figure of 1.30 fails it.
    expect(perYear).toBeGreaterThan(2);
  });

  it('reports what is still unreachable, and why', () => {
    /*
      NOT AN ASSERTION, on purpose — see 0405. What stayed invisible after
      0401 was the credential half of the catalog: Teacher, Analyst,
      Practical nurse, and 30 more, because a passive player earned no
      degree, which 0210b measured. 0405 gave college its own systemic offer,
      the same door 0402 built for a job, and this count went from 33/147 to
      0/147 the same afternoon. Left as a print rather than an assertion
      anyway: the day this catalog grows again, a real gap belongs on the
      screen before it belongs in a failing test.
    */
    const everSeen = new Set<string>();
    for (const life of lives) for (const id of life.seen) everSeen.add(id);
    const unseen = ALL_JOBS.filter((job) => !everSeen.has(String(job.id)));
    console.log(
      `never shown to anybody across ${LIVES} lives: ${unseen.length}/${ALL_JOBS.length}` +
        (unseen.length > 0
          ? `\n  ${unseen.map((job) => `${job.title} (needs ${job.requires})`).join(', ')}`
          : ''),
    );
  });
});
