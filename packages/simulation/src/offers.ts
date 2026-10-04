/**
 * Ticket 0402 — answering the job that came looking for you.
 *
 * THE FIRST QUESTION THIS GAME EVER ASKS AN ADULT. Measured across 4,257 adult
 * years in 80 played lives, decisions raised were p10 0, median 0, p90 0, max 0
 * — every one of the 59 decision and opportunity entries in the catalog is
 * capped at `ageMax: 17`, and the remaining adult events are all passive. From
 * eighteen to death the game had nothing to ask.
 *
 * SO IT ARRIVES THE WAY A DECISION ARRIVES. It is pushed into `state.pending`
 * as an ordinary `PendingDecision` and answered through `decide`, which means
 * the app renders it with the popup it already has and no screen has to be
 * visited for it to be found. That is the whole point of the ticket: 0401
 * widened what a player may apply to, and 345 of 356 moves up a ladder were
 * still promotions the game made FOR them.
 *
 * WHICH IS WHY `decide` HAS A BRANCH IN IT NOW, and the branch is honest rather
 * than a shortcut. There are two kinds of decision in this build: authored ones
 * resolved out of the content catalog, and systemic ones a phase module raises
 * because something happened in a system. A job offer cannot be authored — its
 * choices have to move employment state, and `@yearafter/events` resolves a
 * choice into stat deltas and must never learn what a job is. 0405 will want
 * the same door for school and a later ticket for health, so the reserved id
 * below is the first of a family, not a special case.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  ALL_JOBS,
  START_STANDING,
  WORKING_AGE,
  cannotApply,
  findJob,
  offerChance,
  offerFor,
  type Job,
} from '@yearafter/careers';
import { employerFor } from '@yearafter/content';
import { clampStat, err, ok, type Result, type StatValue } from '@yearafter/core';
import type { PendingDecision } from '@yearafter/events';
import { hasSystemicOffer, type GameState, type JobOffer } from './game-state';
import { atTheDoor, openings } from './careers';
import { levelOf } from '@yearafter/education';
import { RngDomains, stableUnit } from './rng/rng';

/** The reserved event id a systemic career offer is raised under. */
export const OFFER_EVENT_ID = 'career.offer';

export const TAKE_IT = 'take';
export const TURN_IT_DOWN = 'decline';

export type OfferError = 'no-offer' | 'no-such-choice' | 'job-is-gone';

export const OFFER_ERROR_LABELS: Readonly<Record<OfferError, string>> = {
  'no-offer': 'There is nothing on the table.',
  'no-such-choice': "That isn't one of the answers.",
  'job-is-gone': 'That job is no longer in the catalog.',
};

export interface OfferOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  readonly took: boolean;
}

/** Whether a decision id belongs to the systemic offer rather than the catalog. */
export const isOfferDecision = (eventId: string): boolean => eventId === OFFER_EVENT_ID;

/**
 * The question, in the words a player reads.
 *
 * IT NAMES THE PRICE, AND THE PRICE IS THE MEASURED ONE. Paired seeds put the
 * cost of taking at roughly two thirds of a promotion — 178 promotions among
 * takers against 265 among decliners across 134 offers — because the tenure
 * clock resets and `promotionChance` scales with years served. The performance
 * reset, which is what this prompt first described, was worth one extra firing
 * in the same experiment and is not a cost at all.
 *
 * So the sentence says you start at the bottom of their ladder. A prompt that named
 * the wrong price would be worse than one that named none: it would teach the
 * player a rule the game does not run on. 13.15's rule about a refusal naming
 * its own threshold, read forwards — a choice has to say what it costs.
 */
export function offerPrompt(offer: JobOffer, to: Job, from: Job | undefined): string {
  const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;
  /*
    THE FIRST-JOB VERSION SAYS A DIFFERENT THING, because the price is
    different (Ticket 0407). Poaching costs you the tenure you had built;
    starting costs you nothing, and pretending otherwise would be the same
    mistake this docblock was written about — naming a price the game does not
    charge. What it says instead is what the work IS and what it pays, because
    for somebody with nothing that is the entire decision.
  */
  if (!from) {
    return (
      `${offer.employer} is hiring, and they would take you as a ${to.title.toLowerCase()} ` +
      `— ${money(to.pay)}. Nobody is going to ask twice.`
    );
  }
  const raise = to.pay - from.pay;
  const sideways = to.track !== from.track;
  const opening = `Someone at ${offer.employer} got in touch. They want you as a ${to.title.toLowerCase()} — ${money(to.pay)}, which is ${money(raise)} more than you are on.`;
  const price = 'You would be starting at the bottom of their ladder for anything above it.';
  return sideways
    ? `${opening} It is a different line of work, and the standing you have built where you are would not follow you. ${price}`
    : `${opening} ${price}`;
}

/** The two answers. Declining is a real answer, not a dismissal. */
export const offerChoices = (to: Job, from: Job | undefined) => [
  { id: TAKE_IT, label: `Take the ${to.title.toLowerCase()} job` },
  // "Stay where you are" is meaningless to somebody who is nowhere.
  { id: TURN_IT_DOWN, label: from ? 'Stay where you are' : 'Turn it down' },
];

/** The pending decision an offer is delivered as. */
export function offerDecision(
  offer: JobOffer,
  to: Job,
  from: Job | undefined,
  year: number,
): PendingDecision {
  return {
    eventId: OFFER_EVENT_ID,
    category: 'career',
    age: offer.age,
    year,
    prompt: offerPrompt(offer, to, from),
    choices: offerChoices(to, from),
    names: {},
  };
}

/**
 * Answer it.
 *
 * Hiring is certain here and that is deliberate — this is not an application.
 * Somebody decided they wanted this character, and `offerChance` already paid
 * for that decision with standing, performance and tenure. Rolling again at the
 * point of acceptance would turn an offer into a second interview the player
 * never asked for, which is the 0209 lesson about refusals wearing a different
 * hat.
 */
export function answerOffer(state: GameState, choiceId: string): Result<OfferOutcome, OfferError> {
  const offer = state.offer;
  if (!offer) return err('no-offer');
  if (choiceId !== TAKE_IT && choiceId !== TURN_IT_DOWN) return err('no-such-choice');

  const to = findJob(offer.jobId);
  // Ticket 0407: no `fromJobId` is the first-job offer, and is not a missing
  // job. Only a NAMED job that has left the catalog is an error.
  const from = offer.fromJobId !== undefined ? findJob(offer.fromJobId) : undefined;
  if (!to) return err('job-is-gone');
  if (offer.fromJobId !== undefined && !from) return err('job-is-gone');

  const cleared = {
    ...state,
    pending: state.pending.filter((candidate) => candidate.eventId !== OFFER_EVENT_ID),
  };
  // The offer is spent either way. An offer the player can sit on is a menu.
  delete (cleared as { offer?: JobOffer }).offer;

  const sequence = state.player.timeline.filter((entry) => entry.age === offer.age).length;

  if (choiceId === TURN_IT_DOWN) {
    const entry = createTimelineEntry({
      age: offer.age,
      year: state.world.year,
      kind: 'career',
      text: from
        ? `Turned down ${offer.employer}. You stayed where you were.`
        : `Turned down the job at ${offer.employer}.`,
      /*
        AN EXPLICIT ID, because `sequence` alone stopped being unique (0407).

        A derived id is (year, kind, sequence), and `sequence` is counted from
        the timeline as it stands when the entry is built. That was safe while
        an offer was the only career entry a year could produce; 0407 lets a
        character be offered work AND take a job in the same year, and
        `careers.test.ts`'s job-hop invariant caught the collision immediately —
        six `:dup` suffixes in one life. The net exists so React keeps
        rendering, not as permission for a producer to collide (CORE_RULES
        13.22's note on this exact suffix).
      */
      id: `t:${state.world.year}:offer-no:${offer.jobId}`,
      sequence,
    });
    return ok({
      state: { ...cleared, player: withEntry(cleared, entry) },
      entry,
      took: false,
    });
  }

  const stream = state.rng.stream(RngDomains.Careers);
  const held = state.employment.job;
  const entry = createTimelineEntry({
    age: offer.age,
    year: state.world.year,
    kind: 'career',
    text: from
      ? `Left ${from.title.toLowerCase()} for ${offer.employer}. You are a ${to.title.toLowerCase()} now.`
      : `Started at ${offer.employer}. ${to.title} — it is work, and it is yours.`,
    // See the decline branch above: derived ids collide now that a year can
    // hold both an offer and a hire.
    id: `t:${state.world.year}:offer-yes:${offer.jobId}`,
    sequence,
  });

  return ok({
    state: {
      ...cleared,
      employment: {
        ...cleared.employment,
        history: held
          ? [
              ...cleared.employment.history,
              { jobId: held.jobId, from: held.since, to: offer.age, because: 'resigned' as const },
            ]
          : cleared.employment.history,
        job: {
          jobId: String(to.id),
          since: offer.age,
          /*
            The same 38-52 a hire through `applyFor` pays, for the same reason:
            you are not good at a job you have not done. It is kept for
            consistency with every other route into a job, NOT because it is the
            cost — measured, it was worth one extra firing across 134 offers.

            The cost that bites is the line below it: `since` resets, and
            `promotionChance` scales with years served. See `careers/offers.ts`.
          */
          performance: clampStat(stream.range(38, 52)) as StatValue,
          effort: held?.effort ?? 'steady',
          pushedThisYear: 0,
        },
      },
      player: withEntry(cleared, entry),
    },
    entry,
    took: true,
  });
}

const withEntry = (state: GameState, entry: TimelineEntry) => ({
  ...state.player,
  timeline: appendToTimeline(state.player.timeline, entry),
});

/* -------------------------------------------------------------------------- */
/* Raising one                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Put an offer on the table, if this was the kind of year that produces one.
 *
 * Called at the very end of `advanceYear` with the state the year produced, so
 * it reads the standing the employment phase just moved and the job it may just
 * have promoted somebody into.
 *
 * FOUR REASONS NOTHING ARRIVES, and none of them are randomness:
 *
 *   no job          nobody headhunts the unemployed; the listings are for that
 *   retired         the whole point of stopping was that it is one-way (0310)
 *   a question open the queue already holds something, and two at once is the
 *                   bombardment spec 1233 forbids
 *   nothing better  every job they could take pays the same or less
 */
export function withAnyOffer(state: GameState, alive: boolean): GameState {
  if (!alive) return state;
  if (hasSystemicOffer(state)) return state;
  if (state.retirement.retiredAtAge !== undefined) return state;

  const held = state.employment.job;
  /*
    THE LINE THAT USED TO BE `if (!held) return state` (Ticket 0407).

    0402 built this as a POACHING mechanic — a better offer for somebody who
    already works — and nothing in the build ever put a FIRST job in front of a
    player who did not go to the Career screen and apply. Measured across 250
    passive lives: 0 ever held a job, across 11,419 idle adult years, with six
    listings going in every one of them — 68,514 openings shown to nobody — and
    248 of 250 died with nothing. Of the 91 decisions the game raised to an
    adult in all 250 lives, every single one was 0405's college offer.

    So this is the same door with its other half built. It is NOT a job handed
    over: it is an offer, it can be turned down, and `cannotApply` decides what
    may be offered exactly as it decides what may be applied for — the game
    does not route around its own gate to be generous.
  */
  if (!held) return withFirstJobOffer(state);

  const from = findJob(held.jobId);
  if (!from) return state;

  const standing = state.employment.standing[from.track] ?? START_STANDING;
  const years = Math.max(0, state.player.age - held.since);
  const chance = offerChance(standing, Number(held.performance), years);
  /*
    NO DRAW IS SPENT ON A ZERO. `offerChance` is 0 for anybody below the
    standing floor or inside their first two years, which is most characters
    most of the time — and consuming a roll to learn that would advance the
    careers stream for every life in the build, so a character's hiring luck
    would depend on how many years somebody else's offer was impossible. Same
    reason 0210c's spent Work Harder returns above the stream rather than below.
  */
  if (chance <= 0) return state;

  const stream = state.rng.stream(RngDomains.Careers);
  if (!stream.chance(chance)) return state;

  /*
    WHAT THEY COULD TAKE IS `cannotApply`'s QUESTION AND IT IS ASKED ONCE. An
    offer for a job the character could not have applied for would be the game
    routing around its own gate — and 0401 is the ticket about a gate that was
    reading one field too few, so this one reads the same door everything else
    does.
  */
  const door = atTheDoor(state);
  const eligible = ALL_JOBS.filter((job) => cannotApply(job, door) === undefined);
  const to = offerFor(eligible, from, stream.next());
  if (!to) return state;

  const offer: JobOffer = {
    jobId: String(to.id),
    employer: employerFor(to.track, stableUnit(`${state.world.year}:offer:${String(to.id)}`)),
    pay: to.pay,
    fromJobId: String(from.id),
    age: state.player.age,
    eventId: OFFER_EVENT_ID,
  };

  return {
    ...state,
    offer,
    pending: [...state.pending, offerDecision(offer, to, from, state.world.year)],
  };
}

/* -------------------------------------------------------------------------- */
/* The way in                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Certain the year a character's education ends, and a standing chance after.
 *
 * THE CERTAIN TRIGGER IS THE SAME ONE 0405 USED, for the same reason: the year
 * somebody leaves school is the actual moment the world asks what they are
 * going to do. `finishedAtAge` already marks it, whether that is a high-school
 * graduation, a dropout, or a degree finishing.
 *
 * THE STANDING CHANCE IS NOT A GUARANTEE OF WORK. A life where every idle year
 * produces an offer is a life with no unemployment in it, and 0303's living
 * model has real consequences for a character with no income that ought to stay
 * reachable. It is high enough that an ordinary adult works — which is the
 * whole ticket — and low enough that a run of bad years is still a thing that
 * happens to people.
 */
export const FIRST_JOB_FLOOR = 0.22;
export const FIRST_JOB_CEILING = 0.66;

/**
 * How readily the world offers this particular person work.
 *
 * A FLAT CHANCE WAS BUILT FIRST AND REJECTED ON THE MEASUREMENT. At a flat 50%
 * it worked — 247 of 250 lives found work against 0 before — but it worked
 * identically for a dropout and a postgraduate, which makes the entire
 * education system irrelevant to the one outcome it should matter most for, and
 * turns unemployment from a state a life can be in into a formality nobody
 * spends more than a year or two in. CORE_RULES 13.16 read backwards: a system
 * everybody clears is not a system either.
 *
 * So it reads the same two things an employer reads and `hireChance` already
 * charges for — what they hold and who they are — and it reads them gently,
 * because this is whether somebody is ASKED, not whether they are hired. The
 * ceiling is short of certain and the floor is well short of hopeless.
 */
export function firstJobChance(state: GameState): number {
  const level = levelOf(state.education.credentials);
  const paper =
    level === 'postgraduate' ? 0.2 : level === 'university' ? 0.16 : level === 'highSchool' ? 0.08 : 0;
  // A license is worth being asked about, which is most of what one is for.
  const licensed = (state.education.credentials?.licenses?.length ?? 0) > 0 ? 0.08 : 0;
  const { smarts, charisma, discipline } = state.player.stats;
  const person = ((Number(smarts) + Number(charisma) + Number(discipline)) / 3 - 50) / 50;
  return Math.max(
    FIRST_JOB_FLOOR,
    Math.min(FIRST_JOB_CEILING, 0.3 + paper + licensed + person * 0.14),
  );
}

export function withFirstJobOffer(state: GameState): GameState {
  if (state.retirement.retiredAtAge !== undefined) return state;
  if (state.player.age < WORKING_AGE) return state;

  /*
    WHAT IS OFFERED IS ONE OF THE JOBS THAT WERE ACTUALLY GOING.

    `openings` is the six listings this character would have seen on the Career
    screen this year — already gated by `cannotApply`, already weighted so a
    plausible move outranks a cold start in a field they have never touched.
    Drawing the offer from that same list rather than from `ALL_JOBS` means the
    systemic door and the screen can never disagree about what was available,
    which is 13.51 said forwards. It also costs no RNG to build: `openings`
    draws with `stableUnit`, so asking what was going does not move anybody's
    luck.
  */
  const going = openings(state);
  if (going.length === 0) return state;

  const leftEducation = state.education.finishedAtAge === state.player.age;
  const stream = state.rng.stream(RngDomains.Careers);
  if (!leftEducation && !stream.chance(firstJobChance(state))) return state;

  const to = stream.pick(going);
  const offer: JobOffer = {
    jobId: String(to.id),
    employer: employerFor(to.track, stableUnit(`${state.world.year}:first:${String(to.id)}`)),
    pay: to.pay,
    age: state.player.age,
    eventId: OFFER_EVENT_ID,
  };

  return {
    ...state,
    offer,
    pending: [...state.pending, offerDecision(offer, to, undefined, state.world.year)],
  };
}
