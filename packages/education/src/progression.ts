/**
 * Ticket 0204 — one school year.
 *
 * Pure. Takes the state and the character's situation, returns the new state,
 * the stat deltas to apply, the money to move (with its source), and the lines
 * to write. The phase module in @yearafter/simulation does the applying — this
 * package never touches GameState, so it can be run ten thousand times by the
 * balance tooling without a phone or a save.
 */

import type { Personality, Talents, VisibleStats } from '@yearafter/character';
import { ACTIVITIES, findActivity, findGig, type SchoolStageId } from '@yearafter/content';
import { clampStat } from '@yearafter/core';
import type { WealthBand } from '@yearafter/relationships';
import {
  annualActivityEffects,
  committedCost,
  committedHours,
  leave,
  outgrown,
} from './activities';
import {
  ALTERNATIVE_SCHOOL_EXIT,
  ALTERNATIVE_SCHOOL_THRESHOLD,
  SCHOOL_MODIFIERS,
  advanceBehaviour,
  advancePerformance,
  targetPerformance,
} from './performance';
import {
  GRADES_TO_GRADUATE,
  LEAVING_CHANCE,
  SCHOOL_START_AGE,
  couldLeaveSchool,
  gradeForAge,
  isAtCollege,
  isInSchool,
  letterGrade,
  stageForGrade,
  type EducationState,
} from './school';
import { gigLine, gigPay } from './gigs';
import { runCollegeYear } from './college-year';

/**
 * Weekly hours a degree takes against the hidden capacity model.
 *
 * Spec 1823 allows full-time work during college and says "stress/performance
 * handles overcommitment", so this exists to make that true: a character
 * working a demanding job through a degree pays for it, and nobody warns them.
 */
export const COLLEGE_HOURS = 16;
import { driftStanding, seasonLine } from './standing';
import {
  OVERLOAD_EVENT_THRESHOLD,
  assessWorkload,
  capacityFor,
  overloadPenalties,
} from './workload';

/**
 * Which of a line's two phrasings a season gets.
 *
 * Derived from the activity and the age rather than drawn, because this package
 * is pure and takes no RandomStream — and because a season's phrasing is not
 * worth a draw that would shift every other event in the year.
 */
function seasonRoll(entry: { readonly activityId: string }, age: number): number {
  return ((entry.activityId.length + age) % 2) / 2;
}

export interface SchoolYearInput {
  readonly age: number;
  readonly stats: VisibleStats;
  readonly talents: Talents;
  readonly personality: Personality;
  readonly wealth: WealthBand;
  /**
   * One [0,1) draw for the year, passed IN rather than generated here.
   *
   * This package is pure and stays pure: it receives randomness as a value the
   * way `milestoneFor` does in @yearafter/parenting, so the balance tools can
   * replay a school career exactly and a save still reproduces from its seed.
   * Defaulted so every existing caller and test keeps working unchanged — and
   * defaulted to 1, which is the value that never triggers anything.
   */
  readonly roll?: number;
  /**
   * Ticket 0210b. Whole dollars the character holds, for tuition.
   *
   * College is the first thing in this package that can be priced out of reach,
   * so it is the first that needs to know what the player has.
   */
  readonly cash?: number;
  /** Ticket 0210b. Whole dollars a year a parent committed towards tuition. */
  readonly collegeSupport?: number;
}

/**
 * What the year's activities cost, and who paid.
 *
 * The HOUSEHOLD pays, not the child. An earlier version charged the player's own
 * cash and floored it at zero, which produced a feed line reading "Paid $216
 * over the year for a rented clarinet" beside a balance of $0 — the line said
 * money moved and no money moved. A fifteen-year-old does not pay band fees;
 * their parents do, and whether the family can afford it is already decided by
 * the wealth-band gate on joining.
 *
 * The real ledger entry arrives with Ticket 0301. Until then this is reported,
 * not charged, and the reporting is the part that matters: money that moves
 * without saying why is the bug this whole pass exists to remove.
 */
export interface SchoolCost {
  /** Whole dollars, as a positive amount. */
  readonly dollars: number;
  /** Reads inside a sentence: "a rented clarinet at $18 a month". */
  readonly source: string;
  /**
   * Who is actually out of pocket.
   *
   * 'household' is REPORTED and not charged — a fifteen-year-old does not pay
   * band fees, their parents do. 'self' is charged, and tuition is the first
   * thing in this package that is: a degree the character does not pay for is a
   * degree that costs nothing, and 0209's parent who helps with college would be
   * helping with nothing.
   */
  readonly payer: 'household' | 'self';
}

export interface SchoolYearResult {
  readonly state: EducationState;
  readonly statDeltas: Partial<Record<keyof VisibleStats, number>>;
  /** Written into character.stress.hiddenLoad; Ticket 0205 makes it visible. */
  readonly hiddenLoad: number;
  /** Money the character EARNED this year, each with the job that paid it. */
  readonly earned: readonly GigEarning[];
  /**
   * Committed hours a week, and what this character can carry.
   *
   * Handed to the stress phase (Ticket 0205), which reads PRESSURE rather than
   * overflow. `hiddenLoad` only counts hours ABOVE capacity, and reading 3,400
   * simulated years found that number was zero in every one of them — so a
   * system that consumed only `hiddenLoad` would never once have run.
   */
  readonly hours: number;
  readonly capacity: number;
  readonly costs: readonly SchoolCost[];
  /**
   * Ticket 0210b. Whole dollars of tuition to CHARGE, as opposed to report.
   *
   * `costs` above is reported and not charged — activity fees are borne by the
   * household. Tuition is different: it is the character's own money and it has
   * to actually leave, or a degree is free and 0209's parent who helps with
   * college is helping with nothing.
   */
  readonly tuition?: number;
  /** Feed lines, in order. Milestones first, then consequences. */
  readonly lines: readonly { readonly kind: 'milestone' | 'passive'; readonly text: string }[];
}

const EMPTY: SchoolYearResult['statDeltas'] = {};

/** Money an odd job paid, and the job that paid it (CORE_RULES 13.6). */
export interface GigEarning {
  readonly dollars: number;
  readonly source: string;
}

/**
 * A year of every odd job the character is holding.
 *
 * Pulled out of the school year and run separately because working does not
 * stop when school does: somebody who left at sixteen still has the kitchen
 * shifts, and the school-is-over early return would have silently stopped
 * paying them. Real employment is Ticket 0210; this keeps the gigs honest until
 * then.
 */
export function runGigs(
  state: EducationState,
  age: number,
  stats: VisibleStats,
  talents: Talents,
): { state: EducationState; earned: readonly GigEarning[]; lines: readonly string[] } {
  const earned: GigEarning[] = [];
  const lines: string[] = [];
  let next = state;

  for (const gigId of state.gigs) {
    const gig = findGig(gigId);
    if (!gig) continue;

    // PAID FIRST, then aged out. The other order found a character who took a
    // lemonade stand at eleven being told at twelve that they had got too old
    // for it, having never been paid a cent for the year they worked it.
    const amount = gigPay(gig, stats, talents);
    earned.push({ dollars: amount, source: gig.source });
    lines.push(gigLine(gig, amount, ((gigId.length + age) % 2) / 2));

    // Too old for another year of it. Nobody runs a lemonade stand at sixteen.
    if (age >= gig.ageMax) {
      next = { ...next, gigs: next.gigs.filter((id) => id !== gigId) };
      lines.push(
        `That was the last year of ${gig.name.toLowerCase()}. You had got too old for it.`,
      );
    }
  }

  return { state: next, earned, lines };
}

/**
 * Run a school year for a character who has just turned `age`.
 *
 * Order matters and is fixed: enrol or advance a grade, then score the year,
 * then apply what being in things did, then charge for them. Reordering changes
 * every seeded life.
 */
export function runSchoolYear(state: EducationState, input: SchoolYearInput): SchoolYearResult {
  const lines: SchoolYearResult['lines'] = [];
  const push = (kind: 'milestone' | 'passive', text: string) =>
    (lines as { kind: 'milestone' | 'passive'; text: string }[]).push({ kind, text });

  // ---- enrolment and grade ------------------------------------------------
  let next = state;
  /**
   * True on the year school starts.
   *
   * Performance normally DRIFTS towards its target, which is right for every
   * year but the first — before school there is nothing to drift from, and the
   * placeholder 50 rendered a six-year-old's first report card as an F with a
   * 0.7 GPA. A first report card reports the child, not the placeholder.
   */
  let justEnrolled = false;

  // Ticket 0210b. A degree year is its own thing — no behaviour, no clubs, no
  // grade to repeat — so it runs in `runCollegeYear` and returns here.
  if (isAtCollege(state)) {
    const college = runCollegeYear(state, {
      age: input.age,
      smarts: input.stats.smarts,
      discipline: input.stats.discipline,
      academics: input.talents.academics,
      cash: input.cash ?? 0,
      support: input.collegeSupport ?? 0,
      roll: input.roll ?? 1,
    });
    return {
      state: college.state,
      statDeltas:
        college.ending === 'finished'
          ? { happiness: 8, smarts: 3 }
          : college.ending
            ? { happiness: -6 }
            : { smarts: 2 },
      hiddenLoad: 0,
      earned: [],
      // A degree is a real commitment against the same hidden capacity a job
      // takes (spec 1823: full-time work during college is allowed, and stress
      // handles the overcommitment).
      hours: COLLEGE_HOURS,
      capacity: capacityFor(input.stats, input.personality, input.age),
      costs:
        college.tuition > 0
          ? [{ dollars: college.tuition, source: 'a year of tuition', payer: 'self' as const }]
          : [],
      tuition: college.tuition,
      lines: college.lines.map((line) => ({ kind: line.kind, text: line.text })),
    };
  }

  if (state.stage === 'graduated' || state.stage === 'droppedOut') {
    // School is over; work is not. Somebody who left at sixteen still has the
    // kitchen shifts, and returning early without running them would silently
    // stop paying a character who is very much still turning up.
    const work = runGigs(state, input.age, input.stats, input.talents);
    return {
      state: work.state,
      statDeltas: EMPTY,
      hiddenLoad: 0,
      earned: work.earned,
      // An adult has a capacity too.
      //
      // This returned ZERO until Ticket 0210 measured what happened next:
      // `workloadPressure` bails out when capacity is zero, so the hours a JOB
      // takes contributed nothing to stress for anybody out of school, and
      // stress at fifty was identical for a character working nights in a
      // kitchen and one who had never worked at all. A whole system was wired
      // to a divisor of zero. CORE_RULES 13.7, found by measuring.
      hours: 0,
      capacity: capacityFor(input.stats, input.personality, input.age),
      costs: [],
      lines: work.lines.map((text) => ({ kind: 'passive' as const, text })),
    };
  }

  if (state.stage === 'preschool') {
    if (input.age < SCHOOL_START_AGE) {
      return {
        state,
        statDeltas: EMPTY,
        hiddenLoad: 0,
        earned: [],
        hours: 0,
        capacity: 0,
        costs: [],
        lines: [],
      };
    }
    next = { ...next, gradeLevel: 0, stage: 'elementary' };
    justEnrolled = true;
    push('milestone', 'Started kindergarten.');
  } else {
    // ---- leaving early --------------------------------------------------
    //
    // Before the grade advances, because a character who has stopped going does
    // not get moved up first. See `couldLeaveSchool` for why this is not a
    // button: it is four years of the player's own decisions arriving.
    if (couldLeaveSchool(state, input.age) && (input.roll ?? 1) < LEAVING_CHANCE) {
      return {
        state: {
          ...state,
          stage: 'droppedOut',
          finishedAtAge: input.age,
          activities: [],
        },
        statDeltas: { happiness: -4, discipline: -3 },
        hiddenLoad: 0,
        earned: [],
        hours: 0,
        capacity: 0,
        costs: [],
        lines: [
          {
            kind: 'milestone',
            text: leavingLine(input.age, state.behaviour),
          },
        ],
      };
    }

    const grade = state.gradeLevel + 1;
    if (grade > GRADES_TO_GRADUATE) {
      push(
        'milestone',
        `Graduated from high school with a ${letterGrade(state.performance)} average.`,
      );
      return {
        state: {
          ...state,
          stage: 'graduated',
          finishedAtAge: input.age,
          activities: [],
          // Ticket 0210b. The diploma is a CREDENTIAL now, not just a stage —
          // it is what a job asks for and what a college application needs, and
          // a character who finished school has to be able to prove it after
          // they have gone on to do something else.
          credentials: { ...state.credentials, highSchool: input.age },
        },
        statDeltas: { happiness: 6, discipline: 2 },
        hiddenLoad: 0,
        earned: [],
        hours: 0,
        capacity: 0,
        costs: [],
        lines,
      };
    }
    const stage = stageForGrade(grade);
    if (stage !== state.stage && state.schoolType !== 'alternative') {
      push('milestone', stage === 'middle' ? 'Started middle school.' : 'Started high school.');
    }
    next = { ...next, gradeLevel: grade, stage };
  }

  const stageId = next.stage as SchoolStageId;

  // ---- activities that no longer apply ------------------------------------
  for (const activity of outgrown(next, stageId)) {
    next = leave(next, activity.id);
    push('passive', `Aged out of ${activity.name.toLowerCase()} when you changed schools.`);
  }

  // ---- workload -----------------------------------------------------------
  const hours = committedHours(next);
  const workload = assessWorkload(hours, input.stats, input.personality, input.age);
  const penalties = overloadPenalties(workload.overload);

  // ---- academic performance ----------------------------------------------
  const performanceInputs = {
    age: input.age,
    stats: input.stats,
    talents: input.talents,
    effort: next.effort,
    overloadPenalty: penalties.performance,
    schoolModifier: SCHOOL_MODIFIERS[next.schoolType],
  };
  const performance = justEnrolled
    ? clampStat(Math.round(targetPerformance(performanceInputs)))
    : advancePerformance(next.performance, performanceInputs);
  const behaviour = advanceBehaviour(
    next.behaviour,
    input.personality.temper,
    input.stats.discipline,
  );
  next = { ...next, performance, behaviour };

  // ---- alternative school placement (spec 73) -----------------------------
  if (next.schoolType !== 'alternative' && behaviour <= ALTERNATIVE_SCHOOL_THRESHOLD) {
    next = { ...next, schoolType: 'alternative' };
    push(
      'milestone',
      'Transferred to an alternative school after one meeting too many with the principal.',
    );
  } else if (next.schoolType === 'alternative' && behaviour >= ALTERNATIVE_SCHOOL_EXIT) {
    next = { ...next, schoolType: 'public' };
    push('milestone', 'Transferred back to a mainstream school.');
  }

  // ---- the season ---------------------------------------------------------
  // Every joined activity plays a year: standing drifts towards the level this
  // character naturally sits at, and the year gets a line about how it went
  // (Ticket 0206b). A season nobody mentions is a season nobody had.
  const played = next.activities.map((entry) => {
    const activity = findActivity(entry.activityId);
    if (!activity) return entry;
    return {
      ...entry,
      standing: driftStanding(entry.standing, activity, input.stats, input.talents),
      seasons: entry.seasons + 1,
    };
  });
  next = { ...next, activities: played };

  for (const entry of played) {
    const activity = findActivity(entry.activityId);
    if (!activity) continue;
    // One line each, and only for things with a season worth reporting — a
    // sentence about the chess club every year for six years is the kind of
    // noise spec 725-770 caps a year against.
    if (activity.kind === 'sport' || activity.kind === 'arts' || entry.seasons === 1) {
      push(
        'passive',
        seasonLine(activity, entry.standing, entry.seasons, seasonRoll(entry, input.age)),
      );
    }
  }

  // ---- what the year did --------------------------------------------------
  const activityEffects = annualActivityEffects(next);
  const statDeltas: Record<string, number> = { ...activityEffects };
  const add = (key: string, value: number) => {
    if (value !== 0) statDeltas[key] = (statDeltas[key] ?? 0) + value;
  };
  add('health', penalties.health);
  add('happiness', penalties.happiness);
  /*
    School itself makes you a little smarter every year, and coasting does not.

    HOW MUCH depends on the child, and Ticket 0408 is why. A flat +1/+3 looks
    even-handed and is the opposite, because every stat delta goes through
    `curvedDelta`: a gain is full strength at 50 and tapers to nothing at 100.
    So the same flat push is worth 1.2x to a child on forty Smarts and 0.6x to
    one on seventy — school was handing its biggest gains to the students least
    able to use them, every year, for thirteen years.

    Measured across 500 lives before this changed: Smarts at birth ran p10 44 /
    median 56, and Smarts at EIGHTEEN ran p10 70 / median 76 with a minimum of
    56. Nobody in this game was below average as an adult. Downstream, school
    performance at sixteen had a floor of 50, 91% of lives finished a degree,
    and `FAILING_OUT` — a real branch with real copy, written in 0210b — fired
    0 times in 500 lives. 0203's curve was right about happiness inflation and
    wrong here; an equalising curve applied to aptitude equalises aptitude.

    So the year is worth more to a child who can use it. The bands are coarse
    on purpose: `curvedDelta` rounds to whole points, so a fractional rate would
    quietly floor to zero and be a harder thing to reason about than three
    honest steps. Effort still moves everybody — spec 1821 keeps Study Harder as
    the player's lever, and it is worth MORE to a struggling student than the
    passage of time is.
  */
  const aptitude = Number(input.stats.smarts);
  const fromTheYear = aptitude >= 68 ? 2 : aptitude >= 52 ? 1 : 0;
  add(
    'smarts',
    next.effort === 'coasting' ? 0 : next.effort === 'hard' ? fromTheYear + 2 : fromTheYear,
  );

  if (workload.overload >= OVERLOAD_EVENT_THRESHOLD) {
    push('passive', overloadLine(next, workload.overload, input.age));
  }

  // ---- what the odd jobs paid ---------------------------------------------
  const work = runGigs(next, input.age, input.stats, input.talents);
  next = work.state;
  for (const line of work.lines) push('passive', line);
  const earned = work.earned;

  // ---- money, always with a source ---------------------------------------
  const cost = committedCost(next);
  const costs: SchoolCost[] = [];
  if (cost > 0) {
    const names = joinedCostSources(next);
    costs.push({ dollars: cost, source: names, payer: 'household' });
    // Said differently the first year and after, because a standing cost
    // repeated verbatim every September reads like the game is stuck.
    //
    // Ticket 0416: and differently from one year to the NEXT, too. The two-way
    // split above still printed "Another $70 went on scout dues" every year from
    // the second, and nothing had noticed for twelve tickets because no life a
    // test played had ever joined anything — the sign-up door made it reachable
    // and `guardians.test.ts` caught it the same day. Rotated by age, the rule
    // 13.73 says belongs to the writer.
    // "First year" means a year a COSTED thing was new. Joining a free club the
    // year after a paid one used to re-announce the paid one's fees as news.
    const isFirstYear = next.activities.some(
      (entry) =>
        entry.joinedAtAge === input.age - 1 &&
        (findActivity(entry.activityId)?.annualCost ?? 0) > 0,
    );
    const amount = `$${cost.toLocaleString('en-US')}`;
    const again = [
      `Another ${amount} went on ${names}.`,
      `Your parents paid ${amount} for ${names} again.`,
      `${names.charAt(0).toUpperCase()}${names.slice(1)} came to ${amount} again this year.`,
    ];
    push(
      'passive',
      isFirstYear
        ? `Your parents covered ${amount} for ${names}.`
        : (again[input.age % again.length] as string),
    );
  }

  return {
    state: next,
    statDeltas,
    hiddenLoad: workload.load,
    earned,
    hours: workload.hours,
    capacity: workload.capacity,
    costs,
    lines,
  };
}

/**
 * What being overcommitted looks like from the inside.
 *
 * Deliberately a scene rather than a status report — this line is the only place
 * the workload model is ever visible to the player, and "You fell asleep in
 * third period" tells them more than any number would.
 *
 * Several variants per band, chosen by age. A character who is overloaded for
 * four straight years got the identical sentence four times in testing, which
 * reads as a stuck game rather than a hard stretch. Age is the selector because
 * it is deterministic — this package has no RNG, and a school year must replay
 * from a seed like everything else.
 */
const OVERLOAD_LINES = {
  severeMany: [
    'Between everything you signed up for, you fell asleep in third period most days and stopped being good at any of it.',
    "You were at school from seven in the morning until nine at night and couldn't have said what for.",
    'Something had to give and it turned out to be all of it at once.',
    'You missed two things you had promised to be at, in the same week, and stopped promising after that.',
  ],
  mildMany: [
    'You had signed up for more than fitted in a week, and something gave every time.',
    'Every evening had somewhere to be, and the homework happened in the twenty minutes before it was due.',
    'You got good at doing two things badly at the same time.',
  ],
  severeFew: [
    'You ran yourself into the ground this year and it showed in everything.',
    "You were tired in a way that sleeping didn't fix.",
    "The year went past at a sprint and you don't remember most of it.",
  ],
  mildFew: [
    "There wasn't quite enough week for everything you had taken on.",
    'You were always ten minutes late to the second thing.',
  ],
} as const;

function overloadLine(state: EducationState, overload: number, age: number): string {
  const severe = overload >= 10;
  const many = state.activities.length >= 3;
  const pool = many
    ? severe
      ? OVERLOAD_LINES.severeMany
      : OVERLOAD_LINES.mildMany
    : severe
      ? OVERLOAD_LINES.severeFew
      : OVERLOAD_LINES.mildFew;
  return pool[age % pool.length] as string;
}

/**
 * Cost sources by activity id, built once at module load.
 *
 * A map rather than a lookup per call because this runs inside the year loop,
 * and spec 1247–1263 puts annual processing under 250 ms.
 */
const COST_SOURCES = new Map(
  ACTIVITIES.filter((activity) => activity.costSource).map((activity) => [
    activity.id,
    activity.costSource as string,
  ]),
);

/** "a rented clarinet at $18 a month and swim team fees" — reads in a sentence. */
function joinedCostSources(state: EducationState): string {
  const sources = state.activities
    .map((entry) => COST_SOURCES.get(entry.activityId))
    .filter((value): value is string => Boolean(value));
  if (sources.length === 0) return 'school activities';
  if (sources.length === 1) return sources[0] as string;
  return `${sources.slice(0, -1).join(', ')} and ${sources[sources.length - 1]}`;
}

export { gradeForAge, isInSchool };

/**
 * What the feed says when somebody stops going.
 *
 * A milestone, not a punishment. It reads as a thing that happened to a
 * sixteen-year-old rather than as the game telling them off, because the
 * decisions that led here were theirs and the game has already said so four
 * times. CORE_RULES 13.22: the base holds still, age does the moving.
 */
function leavingLine(age: number, behaviour: number): string {
  const lines =
    behaviour < 25
      ? [
          'Stopped going, and nobody from the school called about it for eleven days.',
          'Left school at ' + age + '. It had stopped being a question some time before.',
          "Walked out in the spring term and didn't go back.",
        ]
      : [
          'Left school at ' + age + ' without finishing. There were reasons, and they were yours.',
          'Stopped going halfway through the year. It was the right call and it still cost something.',
          'Left school early. Everybody had an opinion and none of them were asked for.',
        ];
  return lines[age % lines.length] as string;
}
