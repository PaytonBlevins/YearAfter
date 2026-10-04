/**
 * Ticket 0210 acceptance tests, at the level of a whole working life.
 *
 * `@yearafter/careers` proves the model in the small; these play 150 lives to
 * fifty-five with a player who wants to work, and assert on the SHAPE. Six
 * defects were found here, every one of them with a green suite:
 *
 *  - ZERO of twelve entry-level jobs would hire a median school leaver, because
 *    `reached` started at -1 and rung 0 therefore counted as a reach. The whole
 *    employment system was unreachable by the only population the build makes.
 *  - an 81% hire rate that did not move between a driven player and one who
 *    barely tried, so applying was a formality rather than a decision.
 *  - four promotions a life and HALF of all characters at the top rung of a
 *    ladder by fifty.
 *  - being let go 0.1 times in a thirty-two-year career — a verb spec 1670 asks
 *    for by name that did not exist, because the population's own Discipline
 *    carried an unpushed worker past the firing floor.
 *  - a character on a median salary holding $226,000 at fifty and a driven one
 *    $467,000, which would have made every price in the game free.
 *  - and the work-demand wiring reaching the stress model as a divisor of zero,
 *    so a character working nights in a kitchen and one who had never worked
 *    had identical stress at fifty.
 */

import { describe, expect, it } from 'vitest';
import { ALL_JOBS, findJob } from '@yearafter/careers';
import { feeFor } from '@yearafter/parenting';
import { ROMANCE_MOVES, costOf } from '@yearafter/social';
import { advanceYear } from './advance';
import { applyFor, chanceOf, openings, resign, workHarder } from './careers';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { Rng } from './rng/rng';

const LIVES = 150;
const UNTIL = 55;

interface Life {
  readonly state: GameState;
  readonly applications: number;
  readonly hires: number;
  readonly cashAt: Readonly<Record<number, number>>;
}

/** A player who wants to work: apply until hired, then push. */
function playALife(seed: string): Life {
  let state = createNewGame({ seed });
  let applications = 0;
  let hires = 0;
  const cashAt: Record<number, number> = {};

  for (let year = 0; year < UNTIL; year += 1) {
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
    if (age >= 18 && !state.employment.job) {
      const list = [...openings(state)].sort((a, b) => chanceOf(state, b) - chanceOf(state, a));
      for (const job of list.slice(0, 2)) {
        applications += 1;
        const result = applyFor(state, String(job.id));
        if (!result.ok) continue;
        state = result.value.state;
        if (result.value.hired) {
          hires += 1;
          break;
        }
      }
    } else if (state.employment.job) {
      const result = workHarder(state);
      if (result.ok) state = result.value.state;
    }
    cashAt[age] = Number(state.player.cash) / 100;
  }
  return { state, applications, hires, cashAt };
}

const LIFETIMES: readonly Life[] = Array.from({ length: LIVES }, (_, index) =>
  playALife(`career-${index}`),
);

/**
 * Ticket 0211a — a player who does not settle.
 *
 * Every year from eighteen: work hard twice, then walk out and take whatever
 * else is going. That is a legal way to play and nothing had ever simulated it,
 * which is why `t:2020:work:1` reached a real player's terminal with a green
 * suite behind it. Resigning resets `pushedThisYear` on the new job, so the
 * next two pushes re-used the year's ids.
 */
function playAJobHoppingLife(seed: string): GameState {
  let state = createNewGame({ seed });
  for (let year = 0; year < 40; year += 1) {
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
    if (state.player.age < 18) continue;

    // Two applications, two pushes, then out — twice over, in one year.
    for (let round = 0; round < 2; round += 1) {
      if (!state.employment.job) {
        for (const job of openings(state)) {
          const applied = applyFor(state, String(job.id));
          if (!applied.ok) continue;
          state = applied.value.state;
          if (applied.value.hired) break;
        }
      }
      if (!state.employment.job) break;
      for (let push = 0; push < 3; push += 1) {
        const pushed = workHarder(state);
        if (pushed.ok) state = pushed.value.state;
      }
      const quit = resign(state);
      if (quit.ok) state = quit.value.state;
    }
  }
  return state;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const cashAt = (age: number) => LIFETIMES.map((life) => life.cashAt[age] ?? 0);

/* -------------------------------------------------------------------------- */
/* The system is reachable at all                                              */
/* -------------------------------------------------------------------------- */

describe('a player who wants to work', () => {
  it('finds work', () => {
    // CORE_RULES 13.16. This is the test that would have caught the first
    // defect, and it caught it before anything shipped.
    const working = LIFETIMES.filter((life) => life.state.employment.history.length > 0);
    expect(working.length / LIVES).toBeGreaterThan(0.9);
  });

  it('does not walk into every job it applies for', () => {
    const applications = LIFETIMES.reduce((total, life) => total + life.applications, 0);
    const hires = LIFETIMES.reduce((total, life) => total + life.hires, 0);
    const rate = hires / applications;
    const perLife = LIFETIMES.filter((life) => life.applications >= 3).map(
      (life) => life.hires / life.applications,
    );
    const sorted = [...perLife].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
    console.log(
      `hire rate ${Math.round(rate * 100)}% overall; per life p10 ${(p10 * 100).toFixed(0)}% p90 ${(p90 * 100).toFixed(0)}%`,
    );

    /*
      THE POOLED RATE MOVED AND THE THING IT WAS PROTECTING DID NOT (0408).

      0.75 was measured against a population where every character was roughly
      average — birth stats ran p10 44 / p90 69 on a hundred-point scale. 0408
      widened that to p10 35 / p90 77, and this harness applies for the job it
      has the BEST odds at, so a population containing genuinely capable people
      pools higher: 78%.

      A pooled average was always the weaker half of this test, because it
      cannot tell "everybody gets hired 78% of the time" from "some people walk
      in and others are turned away repeatedly" — and those are opposite
      outcomes for the question being asked. So the bound moves, and the spread
      it was standing in for is now asserted directly. What must never come back
      is a build where applying is a formality for EVERYBODY.
    */
    expect(rate, `hire rate ${Math.round(rate * 100)}%`).toBeLessThan(0.85);
    expect(rate, `hire rate ${Math.round(rate * 100)}%`).toBeGreaterThan(0.35);
    // Among lives that applied more than a couple of times — the ones the pooled
    // figure is least able to describe — the bottom tenth are genuinely
    // struggling rather than sailing through.
    expect(p10, 'even repeat applicants walk into everything').toBeLessThan(0.7);
  });

  it('climbs, without everybody reaching the top', () => {
    const tops = LIFETIMES.map((life) => {
      const ids = [
        ...life.state.employment.history.map((row) => row.jobId),
        ...(life.state.employment.job ? [life.state.employment.job.jobId] : []),
      ];
      return ids.reduce((best, id) => Math.max(best, findJob(id)?.rung ?? -1), -1);
    });
    // Progress is real...
    expect(median(tops)).toBeGreaterThanOrEqual(1);
    // ...and a ladder somebody always finishes is not a ladder.
    //
    // This harness plays OPTIMALLY: it applies every year it is out of work,
    // takes the best odds going, and presses Work Harder every year it is in
    // work. So this bound is an upper one — spec 1429 wants career success
    // "significantly optimizable by a skilled human player", and a third of
    // perfectly-played lives topping out is that being true rather than broken.
    //
    // RAISED TO 0.65 BY TICKET 0405. This harness auto-answers every pending
    // decision, which now includes the systemic college offer — so an
    // "optimal" life here also finishes a degree close to the ~95% rate
    // 0405 measured, and a real share of rung-4 jobs are credential-gated.
    // Measured at 52% after 0405, up from under a third before it: more
    // people legitimately QUALIFYING for the top of a ladder they could not
    // previously reach is the ticket working, not the old defect this bound
    // was written against (0210's "half of all characters at the top rung by
    // fifty" was a hiring pipeline handing out promotions regardless of
    // merit; this is odds-based admission plus a real ladder climb). 0.65
    // keeps the floor's actual purpose — catch a ladder nobody fails to
    // finish — without pinning a number this ticket had every reason to move.
    const atTheTop = tops.filter((rung) => rung >= 4).length / LIVES;
    expect(atTheTop, `${Math.round(atTheTop * 100)}% reached rung 4`).toBeLessThan(0.65);
  });

  it('lets somebody go, sometimes', () => {
    // Spec 1670 lists firing by name. It happened 0.1 times per life before the
    // steady-effort baseline was measured against the population's own stats.
    const letGo = LIFETIMES.reduce(
      (total, life) =>
        total +
        life.state.employment.history.filter(
          (row) => row.because === 'fired' || row.because === 'laid-off',
        ).length,
      0,
    );
    expect(letGo / LIVES).toBeGreaterThan(0.15);
  });
});

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

describe('what a working life is worth', () => {
  it('leaves a character with a plausible amount of money', () => {
    // Measured before this ticket: cash was p10 $28, median $135, p90 $1,175
    // and IDENTICAL at eighteen, twenty-two, twenty-five, thirty and forty.
    // Nothing had moved money in adulthood, in either direction, ever.
    /*
      THE ARC, NOT EVERY STEP OF IT (Ticket 0410).

      This used to assert 20 < 30 < 40, which was a fair reading of "money moves
      in adulthood" while nothing in the build ever spent any of it on anybody
      else. 0410 gave the population weddings and children, and the curve now
      reads $25k at twenty, $39k at twenty-five, $48k at thirty, $51k at
      thirty-five, **$45k at forty** and $69k at fifty.

      The dip is the point rather than a regression: the late thirties are the
      decade with a wedding behind them and young children in them, and a model
      where that costs nothing is a model where having a family is free. So the
      long arc is asserted, and the dip is bounded rather than banned — a
      thirties that halved the balance would be something else.
    */
    expect(median(cashAt(20))).toBeGreaterThan(500);
    expect(median(cashAt(30))).toBeGreaterThan(median(cashAt(20)));
    expect(median(cashAt(50))).toBeGreaterThan(median(cashAt(30)));
    expect(median(cashAt(40))).toBeGreaterThan(median(cashAt(30)) * 0.8);
    // And not so much that the rest of the game becomes free — see below.
    /*
      Ticket 0502 moved this line from $250,000, and the reason is the model,
      not the noise. This harness works harder every single year, and since
      0502 a partner earns too: the median here went from $145,000 at fifty to
      $275,000 with the partner's pay in the household. The whole-population
      median net worth at 45–54 is about $180,000–$200,000 against a US figure
      of about $250,000, so a household that pushes every year holding a bit
      more than that in cash is the top of the ordinary range, not a fortune.
    */
    expect(median(cashAt(50))).toBeLessThan(400_000);
  });

  it('never lets a character hold less than nothing', () => {
    // CORE_RULES 13.13. A year CAN end behind — a small wage and four children
    // does not break even — and cash still floors at zero until 0307's loans
    // give a character somewhere to fall. The part that could not be paid is a
    // `shortfall` row rather than a silent clamp (0301), and since 0303 the
    // household's own costs are what push a year behind rather than a number
    // netted off a wage.
    for (const life of LIFETIMES) {
      expect(Number(life.state.player.cash), life.state.player.firstName).toBeGreaterThanOrEqual(0);
    }
  });

  it('turns every price in the game into a real price', () => {
    // THE POINT OF THE TICKET.
    //
    // A wedding, a ring and an adoption fee were all written as
    // `min(realPrice, whatYouHave)` because the build had no income — so what
    // they actually charged was a SHARE of a character's pocket, and the real
    // price never bound. Income is what makes the cap the thing that binds, and
    // this asserts it now does for a working adult rather than leaving it to be
    // noticed in a played life.
    const cash = median(cashAt(30)) * 100;
    const wedding = ROMANCE_MOVES.find((move) => move.id === 'marry');
    const ring = ROMANCE_MOVES.find((move) => move.id === 'propose');
    expect(wedding).toBeDefined();
    expect(ring).toBeDefined();

    expect(costOf(ring!, cash)).toBe(ring!.costCap);
    expect(costOf(wedding!, cash)).toBeGreaterThan((wedding!.costCap ?? 0) * 0.8);
    // The adoption fee is a fee again, not "whatever is in the account".
    expect(feeFor(cash)).toBe(180_000);
  });
});

/* -------------------------------------------------------------------------- */
/* Invariants                                                                  */
/* -------------------------------------------------------------------------- */

describe('invariants', () => {
  it('gives every timeline entry a unique id', () => {
    // CORE_RULES 13.12, with a SIXTH phase now writing into the same year.
    for (const life of LIFETIMES) {
      const ids = life.state.player.timeline.map((entry) => entry.id);
      expect(new Set(ids).size, life.state.player.firstName).toBe(ids.length);
    }
  });

  it('never asks the net to save it, for somebody who JOB-HOPS', () => {
    // Ticket 0211a, and this assertion is the interesting part.
    //
    // The test above passed for 150 lives and shipped a duplicate key to the
    // player anyway, because `playALife` never quits: it applies once and then
    // pushes for thirty years. A player who resigns and takes another job in
    // the SAME YEAR was never simulated, and that is the only way to hit it —
    // the population a test plays is the test (CORE_RULES 13.25).
    //
    // But asserting uniqueness alone would now pass whatever the producers do,
    // because `appendToTimeline` guarantees it. So the assertion is on the
    // SUFFIX: a `:dup` in a freshly played life means a producer asked for an id
    // that was already taken and the net caught it. The net exists so React
    // keeps rendering; it is not permission for a producer to collide.
    for (let seed = 0; seed < 25; seed += 1) {
      const life = playAJobHoppingLife(`hop-${seed}`);
      const ids = life.player.timeline.map((entry) => entry.id);
      expect(
        ids.filter((id) => id.includes(':dup')),
        `seed hop-${seed}`,
      ).toEqual([]);
      expect(new Set(ids).size, `seed hop-${seed}`).toBe(ids.length);
    }
  });

  it('never writes a line with an unrendered token', () => {
    for (const life of LIFETIMES) {
      for (const entry of life.state.player.timeline) {
        expect(entry.text).not.toContain('{');
        expect(entry.text).not.toContain('undefined');
        expect(entry.text).not.toContain('NaN');
      }
    }
  });

  it('never says somebody earned nothing', () => {
    // A pay line that reads "$0 for the year" is the money system saying it did
    // not run. CORE_RULES 13.6 wants the amount named; naming zero is worse
    // than saying nothing.
    for (const life of LIFETIMES) {
      for (const entry of life.state.player.timeline) {
        if (entry.kind !== 'career') continue;
        expect(entry.text, entry.text).not.toMatch(/\$0\b/);
      }
    }
  });

  it('never holds a job that is not in the catalog', () => {
    for (const life of LIFETIMES) {
      const held = life.state.employment.job;
      if (held) expect(findJob(held.jobId), held.jobId).toBeDefined();
      for (const past of life.state.employment.history) {
        expect(findJob(past.jobId), past.jobId).toBeDefined();
        expect(past.to).toBeGreaterThanOrEqual(past.from);
      }
    }
  });

  it('never has two jobs at once', () => {
    // The 0207b lesson about two partners, one system over: leaving a job for
    // another has to CLOSE the first, or a career reads as a list of jobs that
    // overlapped.
    for (const life of LIFETIMES) {
      const held = life.state.employment.job;
      if (!held) continue;
      for (const past of life.state.employment.history) {
        expect(past.to, `${past.jobId} overlaps ${held.jobId}`).toBeLessThanOrEqual(held.since);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0210c — the cap the player cannot see                                */
/* -------------------------------------------------------------------------- */

describe('pressing Work Harder past the cap', () => {
  /** A life advanced to the first year with a job in hand. */
  const employed = (): GameState | undefined => {
    for (const life of LIFETIMES) {
      if (life.state.employment.job) return life.state;
    }
    return undefined;
  };

  it('is allowed, and does nothing at all', () => {
    // Review: "I dont want a visual limit, the buttons can be hit as many
    // times, but I only want an affect to happen a maximum of 2 times. So, if i
    // hit the button 10x, my work reputation only went up twice."
    let state = employed();
    expect(state).toBeDefined();
    if (!state) return;

    // Spend the two the year has. They may already be spent by `playALife`;
    // either way, what follows is the state with nothing left in it.
    for (let i = 0; i < 2; i += 1) {
      const result = workHarder(state);
      if (result.ok && !result.value.spent) state = result.value.state;
    }

    const before = state;
    for (let press = 0; press < 10; press += 1) {
      const result = workHarder(state);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.spent).toBe(true);
      expect(result.value.entry).toBeUndefined();
      state = result.value.state;
    }

    // Ten presses, byte for byte the same life. Performance, the feed, and the
    // RNG cursor all sit exactly where they did.
    expect(state).toBe(before);
    expect(state.employment.job?.performance).toBe(before.employment.job?.performance);
    expect(state.player.timeline.length).toBe(before.player.timeline.length);
  });

  it('does not spend a draw, so the seed still means something', () => {
    // The defect this exists to prevent: a dead button that consumes randomness
    // makes two identical lives diverge on how often somebody mashed it, which
    // would quietly break replay from a seed. The early return sits ABOVE the
    // stream in `workHarder` for this reason alone.
    //
    // TICKET 0212 REWROTE THIS TEST, because it was not testing that.
    //
    // `Rng` is a live object with mutable streams, and `GameState` holds a
    // REFERENCE to it. So the original — advance `spent`, then mash `spent` and
    // advance it again — was running the second year on streams the first year
    // had already consumed. It was comparing year N against year N+1 and
    // passing because, with seven writers, the two happened to produce the same
    // sentences. Adding an eighth writer moved the cursor and the comparison
    // came apart, which is the only reason anybody looked.
    //
    // A test of "the seed still means something" has to give both branches the
    // SAME seed and a FRESH cursor. That is what `snapshot`/`restore` are for.
    const state = employed();
    expect(state).toBeDefined();
    if (!state) return;

    let spent = state;
    for (let i = 0; i < 2; i += 1) {
      const result = workHarder(spent);
      if (result.ok && !result.value.spent) spent = result.value.state;
    }

    const snapshot = spent.rng.snapshot();
    const untouched = advanceYear({ ...spent, rng: Rng.restore(snapshot) }).state;

    let mashed: GameState = { ...spent, rng: Rng.restore(snapshot) };
    for (let press = 0; press < 25; press += 1) {
      const result = workHarder(mashed);
      if (result.ok) mashed = result.value.state;
    }
    const after = advanceYear(mashed).state;

    expect(after.player.timeline.map((entry) => entry.text)).toEqual(
      untouched.player.timeline.map((entry) => entry.text),
    );
  });
});

describe('Ticket 0401 — the door widened, the interview did not', () => {
  /*
    `reachOf` decides what a character may APPLY to. `applicantFor` decides how
    likely they are to get it, and it is fed the RAW rung they have actually
    held. Those two must not be the same number: if the effective rung ever
    leaks into the odds, a career changer is both allowed in and treated as
    though they had done the job below, and the ladder stops meaning anything.

    The leak would happen HERE, in `chanceOf`, not in the careers package —
    which is why this guard lives beside the caller. Measured with the leak in
    place, the two chances below come out identical.
  */
  it('an experienced stranger is offered the step up and is still the long shot', () => {
    const insider = playedTo('leak-a', 40);
    // NOT `if (!insider) return`. A guard that opts out when its setup fails is
    // the vacuous test 13.51 was written about — it passes loudest when it has
    // measured nothing.
    expect(insider).toBeDefined();
    if (!insider) return;

    const [state] = insider;
    /*
      A RUNG-TWO JOB, BECAUSE AT RUNG ONE THE CLAIM IS NOT TRUE (Ticket 0408).

      This used the rung-1 job the listings were showing, and for that job an
      experienced stranger and a rung-0 insider are IDENTICAL by design:
      `TRANSFERABLE_AFTER` grants `reachOf` a floor of 0 to anybody with eight
      years behind them, so `gap` is zero either way and `climb` is 0.16 for
      both. The test measured a difference of exactly nothing and read
      0.6876 > 0.6876 as a failure.

      It passed for four tickets because characters used to spend most of their
      adult lives jobless — 0407 measured 0 of 250 passive lives ever working —
      so the experience threshold was rarely met and the stranger really did
      read as rung -1. Giving everybody a career made the shortcut visible; 0408
      changed which character this seed produces and made it fail.

      One rung up, the distinction is real: the stranger sits at gap 1 (-0.3)
      and somebody who has actually held the rung below sits at gap 0 (+0.16).
    */
    const job = ALL_JOBS.find(
      (row) => row.rung === 2 && rungBelow(row) !== undefined && !stateHasWorked(state, row.track),
    );
    expect(job, 'the catalog has no rung-2 job on a track this life never worked').toBeDefined();
    if (!job) return;
    const chance = chanceOf(state, job);
    // A fabricated applicant who has actually held the rung below, all else
    // equal, must beat the one who only has years behind them.
    const asInsider = {
      ...state,
      employment: {
        ...state.employment,
        history: [
          ...state.employment.history,
          { jobId: rungBelow(job)!, from: 20, to: 28, because: 'resigned' as const },
        ],
      },
    };
    expect(chanceOf(asInsider, job)).toBeGreaterThan(chance);
  });
});

/** Plays a life to `age` and returns it with a step-up job it may apply to. */
function playedTo(
  seed: string,
  age: number,
): [GameState, ReturnType<typeof findJob> & object] | undefined {
  let state = createNewGame({ seed });
  while (state.player.age < age && state.health.diedAtAge === undefined) {
    state = advanceYear(state).state;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const d = state.pending[0];
      const c = d?.choices[0];
      if (!d || !c) break;
      const r = decide(state, d.eventId, c.id);
      if (!r.ok) break;
      state = r.value.state;
    }
    if (state.employment.job === undefined) {
      const shown = [...openings(state)];
      const pick = shown[shown.length - 1];
      if (pick) {
        const applied = applyFor(state, String(pick.id));
        if (applied.ok) state = applied.value.state;
      }
    }
  }
  if (state.health.diedAtAge !== undefined) return undefined;
  const step = openings(state).find((job) => job.rung === 1 && rungBelow(job) !== undefined);
  return step ? [state, step] : undefined;
}

/** Whether this life has ever worked the given track — the insider fabrication
 * is only meaningful on a track they are genuinely a stranger to. */
function stateHasWorked(state: GameState, track: string): boolean {
  const ids = [
    ...state.employment.history.map((row) => row.jobId),
    ...(state.employment.job ? [state.employment.job.jobId] : []),
  ];
  return ids.some((id) => findJob(id)?.track === track);
}

/** The job one rung below this one on the same track, if the catalog has it. */
function rungBelow(job: { track: string; rung: number }): string | undefined {
  const below = ALL_JOBS.find((row) => row.track === job.track && row.rung === job.rung - 1);
  return below ? String(below.id) : undefined;
}
