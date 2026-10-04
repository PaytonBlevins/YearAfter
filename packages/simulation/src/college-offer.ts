/**
 * Ticket 0405 — the question the game never asked you.
 *
 * `packages/simulation/src/college.ts` gives the player two verbs, apply and
 * leave, and both live behind the College screen. 0210b measured what that
 * costs a player who never opens it: applying every single year they could
 * (and knowing to ask a parent for help, which 0210b also made automatic)
 * reaches a degree 71% of the time; one application at eighteen and nothing
 * after reaches 10.5%. Neither number is the one that matters most, though —
 * a player who never navigates to the College screen at all reaches a degree
 * exactly 0% of the time, forever, because nothing in this build has ever
 * called `applyToCollege` on anybody's behalf. `reachability.test.ts` has
 * been printing the consequence since 0403: 33 of 147 jobs are
 * credential-gated, and every one of them is invisible to that player.
 *
 * SO IT ARRIVES THE WAY 0402 MADE A JOB ARRIVE — pushed into `state.pending`
 * as an ordinary `PendingDecision`, answered through `decide`, rendered by
 * the popup the app already has. No screen has to be found for the question
 * to be asked. This is the reserved door 0402's own docblock named: "0405
 * will want the same door for school."
 *
 * Unlike a job offer, admission here is NOT already decided — nobody has
 * headhunted this character, they are just old enough and just finished
 * something. So answering "yes" does not hire them the way `answerOffer`
 * does; it runs the exact same `applyToCollege` roll a player pressing Apply
 * would have triggered, with a major chosen for them the way an offer's
 * employer is chosen for them. Reusing `applyToCollege` rather than
 * duplicating its admission math is the point — this ticket is about who
 * gets asked, not a second implementation of getting in.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import { findMajor, levelOf, type Major } from '@yearafter/education';
import { err, ok, type Result } from '@yearafter/core';
import type { PendingDecision } from '@yearafter/events';
import { hasSystemicOffer, type CollegeOffer, type GameState } from './game-state';
import { applyToCollege, cannotEnrol, openPrograms } from './college';
import { RngDomains, stableUnit } from './rng/rng';

/** The reserved event id a systemic college offer is raised under. */
export const COLLEGE_OFFER_EVENT_ID = 'education.offer';

export const APPLY = 'apply';
export const NOT_NOW = 'skip';

export type CollegeOfferError = 'no-offer' | 'no-such-choice';

export const COLLEGE_OFFER_ERROR_LABELS: Readonly<Record<CollegeOfferError, string>> = {
  'no-offer': 'There is nothing to answer.',
  'no-such-choice': "That isn't one of the answers.",
};

export interface CollegeOfferOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  readonly applied: boolean;
}

/** Whether a decision id belongs to the systemic college offer. */
export const isCollegeOfferDecision = (eventId: string): boolean =>
  eventId === COLLEGE_OFFER_EVENT_ID;

/*
  THREE TIERS OF COPY, NOT TWO (Ticket 0406). A trade school does not write to
  you about "applications being open" and your "record qualifying" — it has an
  intake and a start date, and the difference in how the two institutions talk
  to a school leaver is most of what tells the player they are different roads.
*/
export function collegeOfferPrompt(major: Major, _postgrad: boolean, age: number): string {
  const lines =
    major.kind === 'graduate'
      ? [
          `{major} is taking applications, and your record qualifies. Apply?`,
          `You could go back for {major}. The deadline for applying is coming up.`,
        ]
      : major.kind === 'vocational'
        ? [
            `There's an intake for {major} starting. It's {years} and there's work at the end.`,
            `A {major} program has places. Nobody there will ask about your grades.`,
            `You could train in {major}. {yearsCap} and you'd be qualified.`,
          ]
        : [
            `College applications are open. {major} is on the list, and you could apply.`,
            `You could still apply to study {major} this year, if you wanted to.`,
            `It isn't too late to apply — {major}, if you're interested.`,
          ];
  const years = major.years === 1 ? 'a year' : `${major.years} years`;
  return pick(lines, `collegeoffer:${major.id}:${major.kind}`, age)
    .replace(/\{major\}/g, major.name.toLowerCase())
    .replace(/\{yearsCap\}/g, years.charAt(0).toUpperCase() + years.slice(1))
    .replace(/\{years\}/g, years);
}

export const collegeOfferChoices = (major: Major) => [
  {
    id: APPLY,
    label:
      major.kind === 'vocational'
        ? `Sign up for ${major.name.toLowerCase()}`
        : `Apply to study ${major.name.toLowerCase()}`,
  },
  { id: NOT_NOW, label: 'Not this year' },
];

export function collegeOfferDecision(
  offer: CollegeOffer,
  major: Major,
  year: number,
): PendingDecision {
  return {
    eventId: COLLEGE_OFFER_EVENT_ID,
    category: 'education',
    age: offer.age,
    year,
    prompt: collegeOfferPrompt(major, offer.postgrad, offer.age),
    choices: collegeOfferChoices(major),
    names: {},
  };
}

/**
 * Answer it.
 *
 * "Apply" hands straight to `applyToCollege` — the same roll, the same odds,
 * the same acceptance and rejection copy a player who found the College
 * screen would have gotten. This decision is about being ASKED, not about
 * getting in for free.
 */
export function answerCollegeOffer(
  state: GameState,
  choiceId: string,
): Result<CollegeOfferOutcome, CollegeOfferError> {
  const offer = state.collegeOffer;
  if (!offer) return err('no-offer');
  if (choiceId !== APPLY && choiceId !== NOT_NOW) return err('no-such-choice');

  const cleared: GameState = {
    ...state,
    pending: state.pending.filter((candidate) => candidate.eventId !== COLLEGE_OFFER_EVENT_ID),
  };
  // The offer is spent either way, same rule 0402 set for career offers — an
  // offer the player can sit on and answer next year is a menu, not a moment.
  delete (cleared as { collegeOffer?: CollegeOffer }).collegeOffer;

  if (choiceId === NOT_NOW) {
    const sequence = state.player.timeline.filter((entry) => entry.age === offer.age).length;
    const entry = createTimelineEntry({
      age: offer.age,
      year: state.world.year,
      kind: 'milestone',
      text: 'Thought about applying. Not this year.',
      id: `t:${state.world.year}:collegeoffer:skip`,
      sequence,
    });
    return ok({
      state: {
        ...cleared,
        player: { ...cleared.player, timeline: appendToTimeline(cleared.player.timeline, entry) },
      },
      entry,
      applied: false,
    });
  }

  const applied = applyToCollege(cleared, offer.majorId);
  // `cannotEnrol` was true when the offer was raised; it is re-checked by
  // `applyToCollege` itself and can only have changed if answering happened
  // on a later day the same in-game year did not — which does not happen,
  // `decide` runs synchronously against the state that raised it. Treated as
  // unreachable rather than silently swallowed, so a real regression here
  // fails loudly instead of quietly declining on the player's behalf.
  if (!applied.ok) {
    throw new Error(`0405: college offer could not be answered (${applied.error})`);
  }
  return ok({ state: applied.value.state, entry: applied.value.entry, applied: true });
}

/* -------------------------------------------------------------------------- */
/* Raising one                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Put a college offer on the table, if this was the year for one.
 *
 * Called at the end of `advanceYear`, ahead of `withAnyOffer` (school before
 * career, and the two cannot collide in practice — a career offer needs an
 * existing job, and the population this reaches has just left school).
 *
 * CERTAIN THE YEAR THEY LEAVE SCHOOL, because that is the actual moment
 * somebody is asked "so what's next" — `finishedAtAge` already marks it,
 * whether that is a high-school graduation or a bachelor's degree finishing
 * into postgrad eligibility. A STANDING 35% CHANCE EVERY YEAR AFTER, for
 * anybody who stayed eligible and either said no or was turned down — real
 * enough to matter, not certain enough to read as an annual summons. Neither
 * number is tuned against a target; they are the same shape 0402 used
 * (certain trigger conditions, a bounded chance elsewhere) because the
 * alternative — asking every single eligible year for a forty-year working
 * life — is the annual-nag failure mode 0402's own offer chance was built to
 * avoid on the career side.
 */
export function withCollegeOffer(state: GameState, alive: boolean): GameState {
  if (!alive) return state;
  if (hasSystemicOffer(state)) return state;
  if (cannotEnrol(state) !== undefined) return state;

  /*
    A CERTIFICATE IS NOT A "SO WHAT'S NEXT" MOMENT (Ticket 0408).

    The certain trigger fires the year education ends, which 0405 wrote when the
    only things that could end were school and a degree. 0406 added the
    vocational tier and this became a treadmill: finish a trade certificate,
    `finishedAtAge` equals the current age, an offer is raised THAT year, accept
    it, finish it, be offered another — forever, or until the catalog of
    fourteen certificates runs out.

    Found by 0408's reachability measurement rather than by reading: a life
    turned up holding EIGHT licenses (culinary, CDL, paramedic, practical
    nursing, electrical, IT, HVAC and architecture), which is not a person. It
    also broke the thing it collided with — 0407's license weighting boosts the
    listings for a track you are licensed in, and somebody licensed in eight
    tracks gets the boost on nearly everything, so it stops discriminating and
    a genuinely rare job (Architect) went eligible-but-never-listed for eleven
    years.

    So the certain trigger is for the two moments it was written for: leaving
    school, and finishing a degree that opens the next one. Finishing a
    certificate leaves the education LEVEL untouched, by design (13.64), and
    leaves this door shut with it. The standing 35% chance still applies to
    anybody who has not yet earned a degree, so a tradesperson adding a second
    ticket is still a thing that happens — just not eight times.
  */
  const lastProgram = state.education.majorId ? findMajor(state.education.majorId) : undefined;
  const justLeftSchool =
    state.education.finishedAtAge === state.player.age && lastProgram?.kind !== 'vocational';
  /*
    WHO THE RECURRING OFFER IS STILL FOR (Ticket 0406).

    0405 asked anybody eligible, every year, at 35% — correct then, because
    eligibility ENDED at a graduate degree: `cannotEnrol` returned
    'nothing-left-to-study' the moment a character held one, so the offer
    switched itself off for everybody who had finished. 0406 deliberately
    removed that ceiling (a postgraduate may still learn a trade — spec 119,
    reinvention), and the offer inherited a population it was never designed
    for: a forty-five-year-old with a master's and a career was being asked
    about cosmetology school every third year until they died.

    Found by a test, not by reading: `investing.test.ts`'s advisor-fee harness
    stopped at forty-five holding an unanswered offer, so `advanceYear` refused
    to advance and the advisor was never billed. The failure was in this
    file's reach, not in that test's subject.

    So the recurring chance now stops at the first degree. A character who
    holds one has demonstrably found the door and the College screen is still
    there; what the systemic offer exists for is the player who never found it.
    The CERTAIN trigger is untouched, which is what keeps graduate school on
    the table: the year you finish a bachelor's, you are asked about the next
    one whether or not you ever opened the screen.
  */
  const settled = levelOf(state.education.credentials) !== 'highSchool';
  if (!justLeftSchool && settled) return state;

  const stream = state.rng.stream(RngDomains.Education);
  if (!justLeftSchool && !stream.chance(0.35)) return state;

  /*
    WHAT IS DRAWN FROM, AND WHY IT IS NOT `MAJORS` (Ticket 0406).

    0405 drew from the whole catalogue, which was correct when the catalogue
    was eight undergraduate majors and every one of them was open to the
    character the moment this fired. It is wrong now: `MAJORS` holds trade
    certificates, bachelor's degrees and medical school together, and offering
    a nineteen-year-old with a high-school diploma a place at law school would
    be the game routing around its own gate — the exact failure `withAnyOffer`
    calls out on the career side.

    `cannotEnrol(state, program)` rather than `openPrograms` alone, because
    affordability is per-program now: a character with $5,000 can start a
    welding certificate and cannot start a bachelor's, and an offer they are
    then refused for is worse than no offer.

    A per-character draw, unlike `college.ts`'s line-picker — that rotates COPY
    for a program the player already chose; this chooses the program
    itself, and every character offered the same subject in the same year would
    be a systemic decision that forgot it was supposed to be personal.
  */
  const affordable = openPrograms(state).filter(
    (program) => cannotEnrol(state, program) === undefined,
  );
  if (affordable.length === 0) return state;
  const major = stream.pick(affordable);

  const offer: CollegeOffer = {
    majorId: String(major.id),
    postgrad: major.kind === 'graduate',
    age: state.player.age,
    eventId: COLLEGE_OFFER_EVENT_ID,
  };

  return {
    ...state,
    collegeOffer: offer,
    pending: [...state.pending, collegeOfferDecision(offer, major, state.world.year)],
  };
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/** CORE_RULES 13.22: the base holds still for the life, age does the moving. */
function pick(lines: readonly string[], key: string, age: number): string {
  const base = Math.floor(stableUnit(key) * lines.length);
  return lines[(base + age) % lines.length] as string;
}
