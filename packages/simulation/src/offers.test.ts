/**
 * Ticket 0402 — the offer, at the level of a played life.
 *
 * `@yearafter/careers` proves the model in the small. These play whole lives,
 * because the three things most worth asserting here are all statements about a
 * life rather than a function: that an offer ARRIVES at all, that taking it
 * costs what this build claims it costs, and that it never routes around the
 * gate every other way into a job goes through.
 *
 * The tuning harness that produced the numbers quoted below was deleted. These
 * are what is left of it, and they are the parts that can fail.
 */

import { describe, expect, it } from 'vitest';
import { cannotApply, findJob } from '@yearafter/careers';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { applyFor, atTheDoor, openings, workHarder } from './careers';
import {
  OFFER_EVENT_ID,
  TAKE_IT,
  TURN_IT_DOWN,
  answerOffer,
  firstJobChance,
  withAnyOffer,
} from './offers';
import type { GameState } from './game-state';

const LIVES = 60;

type Answer = 'take' | 'decline' | 'leave';

interface Played {
  readonly state: GameState;
  readonly offers: number;
  readonly promotions: number;
  /** Every job an offer ever named, with the door it was judged against. */
  readonly offered: { readonly jobId: string; readonly blocked: string | undefined }[];
}

/** One played life answering every offer the same way. */
function live(seed: string, answer: Answer, stopAt = 140): Played {
  let state = createNewGame({ seed });
  let offers = 0;
  const offered: { jobId: string; blocked: string | undefined }[] = [];

  for (let step = 0; step < stopAt; step += 1) {
    if (state.health.diedAtAge !== undefined) break;
    state = advanceYear(state).state;

    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      if (!decision) break;
      if (decision.eventId === OFFER_EVENT_ID) {
        offers += 1;
        if (state.offer) {
          const job = findJob(state.offer.jobId);
          // Judged BEFORE the answer, against the same door `applyFor` uses.
          offered.push({
            jobId: state.offer.jobId,
            blocked: job ? cannotApply(job, atTheDoor(state)) : 'no-such-job',
          });
        }
        if (answer === 'leave') break;
        const result = decide(state, OFFER_EVENT_ID, answer === 'take' ? TAKE_IT : TURN_IT_DOWN);
        if (!result.ok) break;
        state = result.value.state;
        continue;
      }
      const fallback = decision.choices[0];
      if (!fallback) break;
      const result = decide(state, decision.eventId, fallback.id);
      if (!result.ok) break;
      state = result.value.state;
    }
    if (answer === 'leave' && state.pending.length > 0) break;

    if (state.player.age < 16) continue;
    if (state.retirement.retiredAtAge !== undefined) continue;
    if (state.employment.job === undefined) {
      const shown = [...openings(state)];
      const job = shown[(state.player.age * 7) % Math.max(1, shown.length)];
      if (job) {
        const applied = applyFor(state, String(job.id));
        if (applied.ok) state = applied.value.state;
      }
    } else {
      const pushed = workHarder(state);
      if (pushed.ok) state = pushed.value.state;
    }
  }

  const promotions = state.employment.history.filter((past) => past.because === 'promoted').length;
  return { state, offers, promotions, offered };
}

/**
 * A life stopped at the moment it is holding an unanswered offer.
 *
 * NOT `live(seed, 'leave')` AND A SHRUG IF IT FINDS NOTHING. Three tests below
 * were written that way and every one of them passed with the whole mechanic
 * sabotaged out of `withAnyOffer` — `state.offer` was undefined, the early
 * return fired, and the assertion that ran was that nothing had happened. That
 * is 13.51 with a different face. This searches seeds and FAILS if none of them
 * produces an offer, so a test that needs one cannot quietly proceed without.
 */
/**
 * A life holding a POACHING offer specifically (Ticket 0407).
 *
 * `state.offer` carries both doors now — somebody poaching a worker and
 * somebody offering work to an adult who has none — and the 0402 tests below
 * are about the first: they assert that the job you left lands in `history` and
 * that declining leaves you where you were, neither of which means anything to
 * a character who was nowhere. Without the `fromJobId` check this helper
 * started handing them a first-job offer and the assertions read as failures of
 * the mechanic rather than of the fixture.
 */
function lifeHoldingAnOffer(prefix: string): Played {
  for (let run = 0; run < 40; run += 1) {
    const life = live(`${prefix}-${run}`, 'leave');
    if (life.state.offer?.fromJobId !== undefined) return life;
  }
  throw new Error(
    `no seed under "${prefix}" produced a poaching offer — the setup is broken, not the test`,
  );
}

describe('Ticket 0402 — a job comes looking for you', () => {
  const lives = Array.from({ length: LIVES }, (_, run) => live(`offer-${run}`, 'decline'));

  it('arrives at all, and not to everybody', () => {
    /*
      THE ASSERTION THE WHOLE TICKET RESTS ON. Before 0402, decisions raised in
      an adult year were p10 0, median 0, p90 0, MAX 0 across 4,257 years —
      every decision in the events catalog stops at `ageMax: 17`. So the first
      thing worth proving is that a grown-up is now asked something.

      And the second is that it is earned: standing below `NOTICED_AT_STANDING`
      is never offered anything, so a quarter of lives seeing none is the
      mechanic working, not failing.
    */
    const withAny = lives.filter((life) => life.offers > 0).length;
    expect(withAny).toBeGreaterThan(LIVES * 0.5);
    expect(withAny).toBeLessThan(LIVES);
  });

  it('never offers a job the player could not have applied for', () => {
    /*
      DERIVED, and it is the guard that matters most. An offer is the one route
      into a job that does not go through `applyFor`, so it is the one place the
      gate could be walked past — and 0401 is the ticket about a gate reading
      one field too few. Every job an offer named is re-judged here against the
      same door, at the moment it was named.
    */
    const walkedPast = lives
      .flatMap((life) => life.offered)
      .filter((row) => row.blocked !== undefined);
    expect(walkedPast).toEqual([]);
  });

  it('costs the ladder you were on, which is the price the prompt names', () => {
    /*
      PAIRED SEEDS: the same life lived twice, answering every offer the
      opposite way, so the difference is the answer rather than the life.

      This is here because the price this build FIRST claimed was wrong. Taking
      a job resets performance to a stranger's, which reads like a cost and
      measured as one extra firing across 134 offers — inert, 13.57. The cost
      that bites was in the same table: takers were promoted 173 times against
      the decliners' 306. `since` resets and `promotionChance` scales with years
      served. If that ever stops being true, the prompt is lying to the player.
    */
    let taking = 0;
    let staying = 0;
    let offers = 0;
    for (let run = 0; run < LIVES; run += 1) {
      const took = live(`paired-${run}`, 'take');
      const stayed = live(`paired-${run}`, 'decline');
      if (took.offers === 0) continue;
      offers += took.offers;
      taking += took.promotions;
      staying += stayed.promotions;
    }
    expect(offers).toBeGreaterThan(20);
    expect(taking).toBeLessThan(staying);
  });

  it('is spent by either answer, and clears both halves of itself', () => {
    /*
      The decision and the payload are two objects and they are cleared
      together. Leaving `state.offer` behind would let the next year's offer be
      answered with last year's job — the class of bug 13.31 is about, in a new
      place.
    */
    const life = lifeHoldingAnOffer('spend');
    expect(life.state.pending.some((row) => row.eventId === OFFER_EVENT_ID)).toBe(true);

    for (const answer of [TAKE_IT, TURN_IT_DOWN]) {
      const answered = answerOffer(life.state, answer);
      expect(answered.ok).toBe(true);
      if (!answered.ok) continue;
      expect(answered.value.state.offer).toBeUndefined();
      expect(answered.value.state.pending.some((row) => row.eventId === OFFER_EVENT_ID)).toBe(
        false,
      );
    }
  });

  it('moves the player into the job when taken and leaves it alone when not', () => {
    const life = lifeHoldingAnOffer('move');
    const offer = life.state.offer;
    expect(offer).toBeDefined();
    if (!offer) return;
    const before = life.state.employment.job?.jobId;

    const took = answerOffer(life.state, TAKE_IT);
    expect(took.ok).toBe(true);
    if (took.ok) {
      expect(took.value.took).toBe(true);
      expect(took.value.state.employment.job?.jobId).toBe(offer.jobId);
      expect(took.value.state.employment.job?.since).toBe(offer.age);
      // The job they left is written into the history, or a career reads as a
      // list of jobs that overlapped.
      expect(took.value.state.employment.history.at(-1)?.jobId).toBe(before);
    }

    const stayed = answerOffer(life.state, TURN_IT_DOWN);
    expect(stayed.ok).toBe(true);
    if (stayed.ok) {
      expect(stayed.value.took).toBe(false);
      expect(stayed.value.state.employment.job?.jobId).toBe(before);
      expect(stayed.value.state.employment).toEqual(life.state.employment);
    }
  });

  it('never arrives for somebody who has stopped', () => {
    /*
      THIS TEST USED TO ASSERT THE BUG (Ticket 0407).

      It was called "never arrives for somebody with no job, or somebody who has
      stopped", and the first half of that was a guarantee that an unemployed
      adult would never be offered work. That was true, it was deliberate in
      0402 — which built a POACHING offer and correctly refused to fire it for
      somebody with nothing to be poached from — and it was the single line that
      left 250 of 250 passive lives unemployable. A test can pin a defect in
      place just as firmly as it pins a feature, and the more precisely it is
      worded the harder it is to see which one it is doing.

      The retirement half was always right and is all that survives: 0310 made
      stopping one-way, and an offer that arrives after it would be the game
      asking somebody to un-retire. Spec 1233's bombardment rule, and a
      decision whose real answer is always no.

      The inverse of the half that was removed is asserted in "the way in"
      below, so the behaviour is still covered — it is covered the right way up.
    */
    /*
      AND IT IS ASSERTED DIRECTLY RATHER THAN BY PLAYING, because playing does
      not reach it. The first rewrite looped twenty lives looking for somebody
      retired and found nobody in any of them — retiring is an ACTION the player
      presses (0310), and a harness that answers pending decisions never presses
      it. So the original test's retirement half had never run either: it was
      green because the state it describes never occurred, which is the same
      shape of nothing as the half that was asserting the bug.
    */
    const base = createNewGame({ seed: 'retired' });
    const idle: GameState = {
      ...base,
      player: { ...base.player, age: 70 },
      retirement: { ...base.retirement, retiredAtAge: 66 },
    };
    expect(idle.employment.job, 'the fixture already has a job').toBeUndefined();

    // Sabotage check: the same state, still working, DOES get asked — so this
    // test fails if the retirement guard is removed rather than passing because
    // nothing was ever offered to anybody.
    const working: GameState = { ...idle, retirement: base.retirement };
    expect(withAnyOffer(working, true).offer, 'the door is shut for everybody').toBeDefined();

    expect(
      withAnyOffer(idle, true).offer,
      'somebody was offered work after retiring',
    ).toBeUndefined();
  });

  it('answers through decide, the same door every other decision uses', () => {
    const life = lifeHoldingAnOffer('route');
    const routed = decide(life.state, OFFER_EVENT_ID, TAKE_IT);
    expect(routed.ok).toBe(true);
    const nonsense = decide(life.state, OFFER_EVENT_ID, 'shrug');
    expect(nonsense.ok).toBe(false);
  });
});

describe('Ticket 0407 — the way in', () => {
  /*
    THE BUG THIS EXISTS FOR WAS ONE LINE, and it hid for four tickets.
    `withAnyOffer` opened with `if (!held) return state` — correct for what 0402
    built, which was a POACHING mechanic, and catastrophic as the only systemic
    career door in the game. Measured across 250 passive lives before this
    ticket: 0 ever held a job, 11,419 idle adult years, six listings going in
    every one of them, and 248 of 250 died with nothing.

    An aggregate is what caught it and an aggregate is what guards it, because
    the failure had no symptom in any single life — a character who is never
    offered work looks exactly like a character who declined.
  */
  function passiveLives(count: number) {
    let everEmployed = 0;
    const firstJobAges: number[] = [];
    let idleAdultYears = 0;
    let adultYears = 0;
    for (let i = 0; i < count; i += 1) {
      let state = createNewGame({ seed: `0407-guard-${i}` });
      let worked = false;
      let firstJobAge: number | undefined;
      for (let y = 0; y < 80; y += 1) {
        if (state.health.diedAtAge !== undefined) break;
        state = advanceYear(state).state;
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const decision = state.pending[0];
          const choice = decision?.choices[0];
          if (!decision || !choice) break;
          const result = decide(state, decision.eventId, choice.id);
          if (!result.ok) break;
          state = result.value.state;
        }
        const age = state.player.age;
        if (firstJobAge === undefined && state.employment.job !== undefined) {
          firstJobAge = age;
          firstJobAges.push(age);
        }
        if (age >= 18 && age < 65) {
          adultYears += 1;
          if (state.employment.job === undefined) idleAdultYears += 1;
          else worked = true;
        }
      }
      if (worked) everEmployed += 1;
    }
    return { everEmployed, idleAdultYears, adultYears, firstJobAges };
  }

  it('puts work in front of somebody who never opens the Career screen', () => {
    const N = 120;
    const { everEmployed, idleAdultYears, adultYears, firstJobAges } = passiveLives(N);
    const sorted = [...firstJobAges].sort((a, b) => a - b);
    const medianFirst = sorted[Math.floor(sorted.length / 2)] ?? Infinity;
    console.log(`P5 passive first-job median age: ${medianFirst}`);
    expect(firstJobAges.length).toBeGreaterThan(N * 0.7);
    expect(medianFirst).toBeGreaterThanOrEqual(16);
    expect(medianFirst).toBeLessThanOrEqual(20);
    console.log(
      `\npassive lives that ever worked: ${everEmployed}/${N}` +
        `   idle adult years ${idleAdultYears}/${adultYears}`,
    );

    /*
      A FLOOR WELL BELOW THE MEASURED 98%, not a pin on it. What must never come
      back is a build where a player who does not go looking is unemployable,
      and any number above a handful proves the door exists. Zero — the measured
      value before this ticket — fails it by the width of the assertion.
    */
    expect(everEmployed).toBeGreaterThan(N * 0.7);

    /*
      AND THE OTHER SIDE, because a door that always opens is not a door.
      Unemployment has to stay reachable: 0303's living model has real
      consequences for a character with no income and they should be possible to
      meet. Measured at roughly 3% of adult years idle; this fails only if the
      offer becomes a faucet that nobody can ever be short of.
    */
    expect(idleAdultYears).toBeGreaterThan(0);
  });

  it('asks somebody with nothing more often than somebody with nothing to show', () => {
    /*
      A FLAT CHANCE WAS BUILT FIRST AND MEASURED FIRST. It worked — 247 of 250
      found work — and it worked identically for a dropout and a postgraduate,
      which makes education irrelevant to the outcome it should matter most for.
      This asserts the gradient rather than either endpoint.
    */
    const base = createNewGame({ seed: 'gradient' });
    const withNothing = firstJobChance(base);
    const withDegree = firstJobChance({
      ...base,
      education: { ...base.education, credentials: { highSchool: 18, university: 22 } },
    });
    console.log(
      `first-job chance: no diploma ${withNothing.toFixed(2)}  degree ${withDegree.toFixed(2)}`,
    );
    expect(withDegree).toBeGreaterThan(withNothing);
  });
});
