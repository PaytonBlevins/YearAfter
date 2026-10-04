/**
 * Ticket 0410 — the door into a private life.
 *
 * 0406 measured that a passive player never got a job and 0407 built the way
 * in. This is the same hole, one system over, and it is bigger: measured across
 * 90 played lives and 4,828 adult years, a player who only answers what the
 * game asks **never meets anybody, never marries and never has a child. Zero
 * partnered adult years. Zero weddings. Zero children.**
 *
 * Every verb in `romance.ts` and `parenting.ts` lives behind the Love screen or
 * the Family screen. `romanticMove` is only ever called by a button, and so are
 * `tryForBaby` and `applyToAdopt`. Nothing in fourteen tickets has ever called
 * any of them on a player's behalf, so the entire romantic and parenting model
 * — six stages, eight moves, a fertility curve, an adoption queue — was
 * unreachable to anybody who did not go looking for it.
 *
 * WHAT THAT COST THE EVENT CATALOG, which is how the hole was found. 0409 left
 * `family` and `friendship` as the last thin adult categories. They are not
 * thin. Of the eleven `family` events that can fire at forty, **all eleven are
 * gated on `hasChildren`** — 0208's entire parenting library — and across those
 * same 4,828 adult years not one of them fired, because nobody ever had a
 * child. It was not a content gap. It was dead content sitting behind a door
 * that had never been built, exactly like the 33 credential-gated jobs 0405
 * found and the 68,514 unclaimed listings 0407 found.
 *
 * SO IT ARRIVES THE WAY THE OTHER THREE DO — pushed into `state.pending` as an
 * ordinary `PendingDecision`, answered through `decide`, rendered by the popup
 * the app already has.
 *
 * AND IT RUNS THE REAL ROLL. Answering yes calls `romanticMove`, `tryForBaby`
 * or `applyToAdopt` — the same functions, the same odds, the same money, the
 * same copy a player pressing the button would have gotten. It can fail. That
 * is 0405's rule and it matters more here than anywhere: the ladder carries age
 * gates, relationship thresholds, a `minYearsAtStage` clock and two
 * share-of-what-you-hold prices, and a door that skipped any of them would be
 * the game routing around its own gate to be generous.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It never breaks anybody up, never files for
 * divorce, and never offers a single person an adoption. The first two are the
 * player ending something and this door only ever opens one; leaving somebody
 * already happens to a player without their pressing anything, in the romance
 * year the social phase runs. The third is a real route 0208 built on purpose
 * and it stays a screen action, because an unprompted "have you thought about
 * adopting" aimed every year at every unpartnered adult in the game is the
 * annual-summons failure 0402 named and 0406 had to go back and fix.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import { err, ok, type Result } from '@yearafter/core';
import type { PendingDecision } from '@yearafter/events';
import { livingChildren } from '@yearafter/relationships';
import {
  displayName,
  isCurrent,
  movesFor,
  partnerOf,
  romanceChance,
  type Acquaintance,
  type RomanceMove,
} from '@yearafter/social';
import { hasSystemicOffer, type GameState, type LifeOffer } from './game-state';
import { applyToAdopt, canAdoptNow, canTryForBaby, tryForBaby } from './parenting';
import { romanticMove } from './romance';
import { RngDomains, stableUnit } from './rng/rng';

/** The reserved event ids a systemic life offer is raised under. */
export const ROMANCE_OFFER_EVENT_ID = 'romance.offer';
export const CHILD_OFFER_EVENT_ID = 'family.offer';

export const GO_AHEAD = 'yes';
export const LEAVE_IT = 'skip';

export type LifeOfferError = 'no-offer' | 'no-such-choice';

export const LIFE_OFFER_ERROR_LABELS: Readonly<Record<LifeOfferError, string>> = {
  'no-offer': 'There is nothing to answer.',
  'no-such-choice': "That isn't one of the answers.",
};

export interface LifeOfferOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  /** Whether the player said yes. Not whether it worked — the roll decides that. */
  readonly went: boolean;
}

/** Whether a decision id belongs to a systemic life offer. */
export const isLifeOfferDecision = (eventId: string): boolean =>
  eventId === ROMANCE_OFFER_EVENT_ID || eventId === CHILD_OFFER_EVENT_ID;

/* -------------------------------------------------------------------------- */
/* How often                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A standing chance per eligible year, and two of them rather than one.
 *
 * STARTING something is rarer than CONTINUING it, and that is the whole shape
 * of this door. Somebody you have known for years becoming somebody you ask out
 * is an unusual year. A couple who have been together three years being asked
 * whether this is the year they get married is an ordinary one — the
 * `minYearsAtStage` clock has already made them wait, so the question has
 * earned itself by the time it can be asked at all.
 *
 * Neither number is tuned against an outcome target. They are the same shape
 * 0402 and 0405 used, and the population they produce is measured in the ticket
 * document rather than aimed at.
 */
export const OPENING_CHANCE = 0.3;
export const NEXT_STEP_CHANCE = 0.55;
export const CHILD_CHANCE = 0.4;

/**
 * How likely the question is this year.
 *
 * A MOVE THAT ALREADY CARRIES A CLOCK IS ASKED EVERY YEAR IT IS AVAILABLE, and
 * the reasoning is 0407's `prefers` objection in a different system: charging
 * the same wait twice. `make-official`, `propose` and `marry` all carry a
 * `minYearsAtStage` that has ALREADY held the couple at this rung for one or
 * two years, on top of a relationship threshold they had to climb to. Putting a
 * second independent 55% gate in front of that is not pacing, it is the same
 * lever pulled twice, and it is measurable: with it the median marriage landed
 * at forty-seven, which is past the fertility curve for most of the population
 * and therefore also most of why almost nobody had children.
 *
 * `flirt` and `ask-out` carry no clock, so for those the chance IS the pacing
 * and it stays.
 *
 * Asking every year is not a summons, because the question stops being asked
 * the moment it stops being available — a heavy move that misses costs warmth
 * (`onBad` runs −12 to −20), which drops the couple back under the threshold
 * for the next rung until they climb it again.
 */
export const chanceFor = (move: RomanceMove, opening: boolean): number =>
  move.minYearsAtStage !== undefined ? 1 : opening ? OPENING_CHANCE : NEXT_STEP_CHANCE;

/**
 * Warmth a person needs before the game will suggest them.
 *
 * `flirt` carries no `minRelationship` by design — on the Love screen a player
 * may flirt with anybody, and that is theirs to do. A door that picks FOR them
 * needs a floor, or the game spends a year of somebody's life on a colleague
 * they have exchanged four sentences with. Set at `ask-out`'s own threshold,
 * which is the build's existing answer to "somebody you actually like".
 */
export const WORTH_ASKING = 45;

/** Beyond this many living children the game stops raising the question. */
export const ENOUGH_CHILDREN = 3;

/* -------------------------------------------------------------------------- */
/* Picking the step                                                            */
/* -------------------------------------------------------------------------- */

/** Moves this door may run: the ones that move a relationship forward. */
const advancing = (move: RomanceMove): boolean => move.to !== undefined && !move.certain;

/**
 * The furthest step available with this person, or nothing.
 *
 * LAST rather than first, because `ROMANCE_MOVES` is in ladder order and both
 * rungs are usually available at once: somebody at `interested` can be flirted
 * with again or asked out, and a door that took the first match would flirt
 * with the same person forever. The player still has both on the screen.
 */
const furthestStep = (person: Acquaintance, age: number, cash: number): RomanceMove | undefined => {
  const open = movesFor(person, age, cash).filter(advancing);
  return open.length > 0 ? open[open.length - 1] : undefined;
};

/**
 * Who the question is about, and what it asks.
 *
 * With a partner there is no choice to make — the question is about them, and
 * it is whatever the ladder says comes next. Without one, the candidate is
 * drawn from the people the character actually knows, weighted by
 * `romanceChance`, which is the same function the Love screen scores a move
 * with. Weighting by warmth alone would score "have you known them longest" and
 * call it love, which is the mistake `romanceChance`'s own docblock records
 * having made and fixed.
 */
function romanceStep(
  state: GameState,
  draw: number,
): { readonly person: Acquaintance; readonly move: RomanceMove } | undefined {
  const age = state.player.age;
  const cash = Number(state.player.cash);

  const partner = partnerOf(state.circle.people);
  if (partner) {
    const move = furthestStep(partner, age, cash);
    return move ? { person: partner, move } : undefined;
  }

  const open = state.circle.people
    .filter(isCurrent)
    .filter((person) => person.kind === 'peer')
    .filter((person) => person.relationship >= WORTH_ASKING)
    .map((person) => ({ person, move: furthestStep(person, age, cash) }))
    .filter((entry): entry is { person: Acquaintance; move: RomanceMove } => entry.move !== undefined);

  /*
    FINISH WHAT YOU STARTED BEFORE STARTING SOMETHING ELSE (measured).

    The first version drew from everybody warm enough, which meant a character
    with eight friends who had already flirted with one of them had a one-in-
    eight chance of the question being about that person — so the door spent
    twenty years flirting with somebody new every time and almost never asked
    anybody out. Measured at forty: 43 of 90 characters stood at `interested`
    with nobody, against 15 who had never started at all, and the median
    marriage landed at FIFTY-NINE, well past the fertility curve, which is most
    of why only 7 of 90 ever had a child.

    A crush is already the answer to "who is this about", exactly the way a
    partner is one rung up. The draw below is for the year there is nobody yet.
  */
  const crushes = open.filter((entry) => entry.person.romance?.stage === 'interested');
  const candidates = crushes.length > 0 ? crushes : open;
  if (candidates.length === 0) return undefined;

  const weights = candidates.map((entry) =>
    romanceChance(
      entry.person,
      state.player.personality,
      state.player.stats.charisma,
      state.player.stats.looks,
      entry.move.base,
    ),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = draw * total;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index] as number;
    if (cursor <= 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
}

/**
 * Whether there is a child question this year, and which one.
 *
 * Settled couples only. `canTryForBaby` already carries the age window, the
 * pregnancy check and the partner check, so this adds the two things it has no
 * reason to know: that the game should stop asking somebody who already has a
 * houseful, and that an adoption is a question for a couple who have been
 * trying rather than for every adult in the world.
 */
function childStep(state: GameState): 'baby' | 'adopt' | undefined {
  if (livingChildren(state.family).length >= ENOUGH_CHILDREN) return undefined;
  const partner = partnerOf(state.circle.people);
  const stage = partner?.romance?.stage;
  if (stage !== 'together' && stage !== 'engaged' && stage !== 'married') return undefined;
  if (state.parenting.pregnancy) return undefined;
  if (canTryForBaby(state)) return 'baby';
  return canAdoptNow(state) ? 'adopt' : undefined;
}

/* -------------------------------------------------------------------------- */
/* Raising one                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Put a life question on the table, if this was the year for one.
 *
 * RAISED LAST of the three systemic doors, and that ordering was measured
 * rather than reasoned. The first version put it first, on the argument that
 * this ladder carries `minYearsAtStage` clocks and a fertility curve, so a
 * skipped year is subtracted from the far end. That argument is wrong about
 * almost all of it: a couple who miss a year at `together` are asked again next
 * year and marry a year later, over a life that runs to eighty.
 *
 * What DOES get permanently lost sits behind the other two doors. College's
 * recurring offer switches itself off at the first degree and its population
 * lives in a seven-year window; a career offer compounds, because a year not
 * worked is a rung not climbed. Measured on the same 90 seeds, going first cost
 * **21 degrees and two extra idle years a life**, and bought **two fewer
 * marriages and eight more children**. Going last costs the eight children and
 * leaves everything else where 0405 and 0407 had it.
 *
 * Splitting the two questions so the child one could go first was tried, on the
 * grounds that the fertility curve is the only deadline in the build that
 * cannot be waited out. It bought nothing — 55 lives with a child against 56 —
 * and cost five degrees, so there is one door and it is at the back.
 *
 * WITHIN the year, the child question still goes ahead of the next rung, for
 * the same deadline reason, and that one does measure: see below.
 */
export function withLifeOffer(state: GameState, alive: boolean): GameState {
  if (!alive) return state;
  if (hasSystemicOffer(state)) return state;

  const stream = state.rng.stream(RngDomains.Relationships);

  /*
    THE CHILD QUESTION GOES FIRST INSIDE THE YEAR. A couple who are together can
    get married at thirty or at sixty and it is the same wedding; they cannot
    have a child at sixty. Asking about the next rung first meant a couple at
    `together` were asked about proposing every year the clock allowed and never
    asked about a child until the wedding landed, which at the time measured at
    a median of forty-seven — past the curve. 18 of 90 lives ever held a child;
    reversing these two took it to 26 and the rest of the ticket took it to 64.

    Both draws happen in the same year and at most one offer is raised.
  */
  const route = childStep(state);
  const partner = partnerOf(state.circle.people);
  if (route && partner && stream.chance(CHILD_CHANCE)) {
    const offer: LifeOffer = {
      kind: 'child',
      route,
      age: state.player.age,
      eventId: CHILD_OFFER_EVENT_ID,
    };
    return {
      ...state,
      lifeOffer: offer,
      pending: [...state.pending, childDecision(offer, partner, state.world.year)],
    };
  }

  const step = romanceStep(state, stream.next());
  if (!step) return state;
  const opening = step.person.romance?.stage === undefined;
  if (!stream.chance(chanceFor(step.move, opening))) return state;

  const offer: LifeOffer = {
    kind: 'romance',
    personId: String(step.person.id),
    moveId: step.move.id,
    age: state.player.age,
    eventId: ROMANCE_OFFER_EVENT_ID,
  };
  return {
    ...state,
    lifeOffer: offer,
    pending: [...state.pending, romanceDecision(offer, step.person, step.move, state.world.year)],
  };
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/*
  NAMED, SPECIFIC AND IN CONTRACTIONS — `claude/event-writing-rules.md` rules 1,
  7 and 11. These prompts never pass through the content validator, because they
  are not catalog entries, so the rules are kept here by hand and the labels say
  what pressing them does (rule 8) rather than "Yes" and "No".
*/
const ROMANCE_LINES: Readonly<Record<string, readonly string[]>> = {
  flirt: [
    `You keep ending up talking to {name}, and it's stopped being an accident.`,
    `{name} waited for you after the thing you both went to. Neither of you mentioned it.`,
    `You've been getting on with {name} for a while now and you know it.`,
  ],
  'ask-out': [
    `{name} said something about being free this weekend, and then looked at you.`,
    `You've got {name}'s number and you've been holding your phone for ten minutes.`,
    `{name} is standing right there and you're either going to ask or you're not.`,
  ],
  'make-official': [
    `You and {name} have been seeing each other a while, and nobody's said what this is.`,
    `{name}'s friends asked what you two are. You didn't have an answer.`,
  ],
  propose: [
    `You and {name} have been together long enough that people have started asking.`,
    `{name} left a jeweler's window open on their phone. It might've been nothing.`,
  ],
  marry: [
    `You and {name} are engaged, and you still haven't set a date.`,
    `{name}'s mom asked about the wedding again. There isn't one booked.`,
  ],
};

const ROMANCE_LABELS: Readonly<Record<string, string>> = {
  flirt: 'Tell them you like them',
  'ask-out': 'Ask them out',
  'make-official': 'Ask them to be a couple',
  propose: 'Propose to them · Costs money',
  marry: 'Book the wedding · Costs money',
};

export function romanceDecision(
  offer: Extract<LifeOffer, { kind: 'romance' }>,
  person: Acquaintance,
  move: RomanceMove,
  year: number,
): PendingDecision {
  const lines = ROMANCE_LINES[move.id] ?? ROMANCE_LINES['flirt'] ?? [];
  const name = displayName(person);
  return {
    eventId: ROMANCE_OFFER_EVENT_ID,
    category: 'friendship',
    age: offer.age,
    year,
    prompt: pick(lines, `romanceoffer:${person.id}:${move.id}`, offer.age).replace(/\{name\}/g, name),
    choices: [
      { id: GO_AHEAD, label: (ROMANCE_LABELS[move.id] ?? move.label).replace(/them/g, person.firstName) },
      { id: LEAVE_IT, label: 'Leave it for now' },
    ],
    names: {},
  };
}

const BABY_LINES: readonly string[] = [
  `You and {name} have talked about kids twice this year, and neither time went anywhere.`,
  `{name} asked, straight out, whether you want to start trying.`,
  `Your place has a spare room in it, and you and {name} both keep calling it the spare room.`,
];

const ADOPT_LINES: readonly string[] = [
  `You and {name} have been trying a while. {name} brought up adopting.`,
  `Somebody you know adopted, and you and {name} talked about it the whole drive home.`,
];

export function childDecision(
  offer: Extract<LifeOffer, { kind: 'child' }>,
  partner: Acquaintance,
  year: number,
): PendingDecision {
  const lines = offer.route === 'baby' ? BABY_LINES : ADOPT_LINES;
  return {
    eventId: CHILD_OFFER_EVENT_ID,
    category: 'family',
    age: offer.age,
    year,
    prompt: pick(lines, `childoffer:${offer.route}:${partner.id}`, offer.age).replace(
      /\{name\}/g,
      partner.firstName,
    ),
    choices: [
      {
        id: GO_AHEAD,
        label: offer.route === 'baby' ? 'Start trying for a baby' : 'Apply to adopt · Costs money',
      },
      { id: LEAVE_IT, label: 'Not right now' },
    ],
    names: {},
  };
}

/** CORE_RULES 13.22: the base holds still for the life, age does the moving. */
function pick(lines: readonly string[], key: string, age: number): string {
  if (lines.length === 0) return '';
  const base = Math.floor(stableUnit(key) * lines.length);
  return lines[(base + age) % lines.length] as string;
}

const DECLINED: Readonly<Record<'romance' | 'child', readonly string[]>> = {
  romance: ['Thought about saying something to {name}. Didn’t.', 'Left it where it was with {name}.'],
  child: ['Talked about it with {name} and agreed to leave it a while.', 'Not this year, you both said.'],
};

/* -------------------------------------------------------------------------- */
/* Answering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Answer it.
 *
 * "Yes" hands straight to the verb the screen would have called. The offer is
 * spent either way — the rule 0402 set for career offers, because an offer a
 * player can sit on and answer next year is a menu, not a moment.
 */
export function answerLifeOffer(
  state: GameState,
  choiceId: string,
): Result<LifeOfferOutcome, LifeOfferError> {
  const offer = state.lifeOffer;
  if (!offer) return err('no-offer');
  if (choiceId !== GO_AHEAD && choiceId !== LEAVE_IT) return err('no-such-choice');

  const cleared: GameState = {
    ...state,
    pending: state.pending.filter((candidate) => !isLifeOfferDecision(candidate.eventId)),
  };
  delete (cleared as { lifeOffer?: LifeOffer }).lifeOffer;

  const other =
    offer.kind === 'romance'
      ? state.circle.people.find((person) => person.id === offer.personId)
      : partnerOf(state.circle.people);
  const name = other?.firstName ?? 'them';

  if (choiceId === LEAVE_IT) {
    return ok(declined(cleared, offer, name));
  }

  /*
    WHAT HAPPENS WHEN THE VERB REFUSES.

    0405 treats the equivalent as unreachable and throws, and it is right to: a
    college offer is answered synchronously against the state that raised it, so
    `applyToCollege` cannot have changed its mind in between. This one genuinely
    can. The Love screen and the Family screen are both open while a decision is
    pending, and both are allowed one heavy move a year — so a player can be
    asked "propose to Mara?", go press Propose on the screen themselves, and
    come back to a question whose verb will now return `already-this-year`.

    That is a player doing two reasonable things, not a regression, so it
    declines gracefully rather than throwing or leaving an unanswerable decision
    wedged in the queue and stopping time (CORE_RULES 13.15).
  */
  if (offer.kind === 'romance') {
    const moved = romanticMove(cleared, offer.personId, offer.moveId);
    if (!moved.ok) return ok(declined(cleared, offer, name));
    return ok({ state: moved.value.state, entry: moved.value.entry, went: true });
  }

  const outcome = offer.route === 'baby' ? tryForBaby(cleared) : applyToAdopt(cleared);
  if (!outcome.ok) return ok(declined(cleared, offer, name));
  return ok({ state: outcome.value.state, entry: outcome.value.entry, went: true });
}

function declined(state: GameState, offer: LifeOffer, name: string): LifeOfferOutcome {
  const lines = DECLINED[offer.kind];
  const sequence = state.player.timeline.filter((entry) => entry.age === offer.age).length;
  const entry = createTimelineEntry({
    age: offer.age,
    year: state.world.year,
    kind: 'relationship',
    text: pick(lines, `lifeoffer:skip:${offer.kind}`, offer.age).replace(/\{name\}/g, name),
    id: `t:${state.world.year}:lifeoffer:${offer.kind}:skip`,
    sequence,
  });
  return {
    state: {
      ...state,
      player: {
        ...state.player,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
    entry,
    went: false,
  };
}
