/**
 * Ticket 0209 — asking your parents for something.
 *
 * The player's only verb in this system. Spec 61 gives the DECISIONS to the
 * parents and leaves the child with the request, which is both what the spec
 * says and what being fifteen is like.
 *
 * Every one of these can be refused, and a refusal is a real outcome rather
 * than a prompt to try again — the line the feed writes when a parent says no
 * is a line about the year, not a retry button with prose on it.
 */

import { createTimelineEntry, type Character, type TimelineEntry } from '@yearafter/character';
import { add, dollars, err, ok, type Result } from '@yearafter/core';
import {
  alreadyAskedParent,
  alreadyGranted,
  costFor,
  findRequest,
  requestsAt,
  willThey,
  type ParentRequest,
} from '@yearafter/parenting';
import { livingParents, updateMember, type FamilyMember } from '@yearafter/relationships';
import type { GameState } from './game-state';
import { RngDomains, stableUnit } from './rng/rng';

export type AskError =
  | 'no-such-parent'
  | 'not-around'
  | 'no-such-request'
  /** Not something a child of this age asks for. */
  | 'not-available'
  /** Already put this to this parent this year. */
  | 'already-asked';

export interface AskOutcome {
  readonly state: GameState;
  readonly saidYes: boolean;
  /** Whole dollars that actually changed hands. */
  readonly given: number;
  readonly entry: TimelineEntry;
}

/**
 * What a child calls this parent. The same rule the event text follows — a
 * child does not call their mother by her first name (event-writing-rules 5).
 */
const nameFor = (parent: FamilyMember): string => (parent.role === 'mother' ? 'Mom' : 'Dad');

export function askParent(
  state: GameState,
  parentId: string,
  requestId: string,
): Result<AskOutcome, AskError> {
  const parent = state.family.members.find((member) => member.id === parentId);
  if (!parent) return err('no-such-parent');
  if (parent.role !== 'mother' && parent.role !== 'father') return err('no-such-parent');
  if (!parent.alive) return err('not-around');

  const request = findRequest(requestId);
  if (!request) return err('no-such-request');
  if (!requestsAt(state.player.age).some((entry) => entry.id === request.id)) {
    return err('not-available');
  }
  if (alreadyAskedParent(state.parenting, parent.id, request.id, state.player.age)) {
    return err('already-asked');
  }
  // You do not ask for a car you already have.
  if (request.oncePerLife && alreadyGranted(state.parenting, request.id)) {
    return err('already-asked');
  }

  const stream = state.rng.stream(RngDomains.Family);
  const chance = willThey(
    request,
    parent,
    state.family,
    state.education.behaviour,
    state.player.age,
  );
  const saidYes = stream.chance(chance);

  // What actually changes hands. For the big requests this is a share of the
  // household's year rather than a headline number — see `costFor`.
  // What was on the table, and what actually moved. They differ on a refusal,
  // and both are needed: a `no` line may still name the sum that was refused
  // ("looked at the $360"), and rendering $0 there would be a lie with a dollar
  // sign on it.
  const onTheTable = costFor(request, state.family, state.player.age);
  const given = saidYes ? onTheTable : 0;

  // Every request id has an entry in both tables; a test asserts it, so the
  // fallback is a type obligation rather than a real branch.
  const lines = (saidYes ? YES_LINES : NO_LINES)[request.id] ?? ['{parent} answered you.'];
  //
  // The 0207d lesson, for the fourth time and by the same route. Reading output
  // found "Mom gave up an evening to drive you" at eight, nine AND ten. The
  // first fix rotated the index by age, which does not work while the base is a
  // fresh draw every year: a new draw one lower cancels the rotation exactly as
  // often as it helps.
  //
  // So the base holds still for the life — one stable value per parent and
  // request — and AGE does all the moving. Two consecutive years cannot land on
  // the same line, by construction, for any set of two or more.
  const base = Math.floor(stableUnit(`${parent.id}:${request.id}`) * lines.length);
  const index = (base + state.player.age) % lines.length;
  const text = (lines[index] as string)
    .replace(/\{parent\}/g, nameFor(parent))
    .replace(/\{amount\}/g, `$${onTheTable.toLocaleString('en-US')}`);

  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'relationship',
    text,
    id: `t:${state.world.year}:ask:${parent.id}:${request.id}`,
    sequence,
  });

  // Only pocket money reaches the player's own pocket. A car, college and a
  // trip are things the HOUSEHOLD buys — the money never passes through a
  // fifteen-year-old's hands, and pretending otherwise would put four thousand
  // dollars in a child's balance (CORE_RULES 13.6 and the 0204 lesson about
  // money that moves without saying how).
  const toPlayer = saidYes && request.id === 'pocket-money' ? given : 0;

  const player: Character = {
    ...state.player,
    timeline: [...state.player.timeline, entry],
    cash: toPlayer > 0 ? add(state.player.cash, dollars(toPlayer)) : state.player.cash,
  };

  // Asking costs a little of the relationship when it lands badly, and a yes
  // is worth a little. Small either way: a parent is not a friendship meter.
  const family = updateMember(state.family, parent.id, (member) => ({
    ...member,
    relationship: Math.max(
      0,
      Math.min(100, member.relationship + (saidYes ? 2 : -3)),
    ) as typeof member.relationship,
  }));

  const asked = state.parenting.askedParents ?? {};
  return ok({
    state: {
      ...state,
      player,
      family,
      parenting: {
        ...state.parenting,
        // Ticket 0210b. Help with college is a COMMITMENT: they pay this much a
        // year for as long as the character is studying. See `collegeSupport`.
        ...(saidYes && request.id === 'help-with-college' ? { collegeSupport: given } : {}),
        ...(saidYes && request.oncePerLife
          ? { granted: { ...(state.parenting.granted ?? {}), [request.id]: state.player.age } }
          : {}),
        askedParents: {
          ...asked,
          [parent.id]: { ...(asked[parent.id] ?? {}), [request.id]: state.player.age },
        },
      },
    },
    saidYes,
    given,
    entry,
  });
}

/* -------------------------------------------------------------------------- */
/* What the screen asks                                                        */
/* -------------------------------------------------------------------------- */

export const askableOf = (state: GameState): readonly ParentRequest[] =>
  requestsAt(state.player.age);

export const canAsk = (state: GameState, parentId: string, requestId: string): boolean => {
  const request = findRequest(requestId);
  if (request?.oncePerLife && alreadyGranted(state.parenting, requestId)) return false;
  return !alreadyAskedParent(state.parenting, parentId, requestId, state.player.age);
};

export const guardiansOf = (state: GameState): readonly FamilyMember[] =>
  livingParents(state.family);

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Written to the 0207d rules: plain words, contractions, and a line that says
 * what actually happened rather than gesturing at it.
 *
 * A `no` is never softened into a maybe. Spec 61 gives parents the right to
 * refuse and a refusal that reads like an invitation to ask again would take it
 * straight back.
 */
const YES_LINES: Readonly<Record<string, readonly string[]>> = {
  'pocket-money': [
    '{parent} handed over {amount} without really looking up.',
    'Asked {parent} for money and got {amount} and a look.',
    '{parent} gave you {amount} and told you not to make a habit of it.',
  ],
  'a-lift': [
    '{parent} drove you there and waited in the car the whole time.',
    '{parent} gave up an evening to drive you, and did not mention it once.',
    '{parent} drove you both ways and played the same album twice.',
    '{parent} said yes before you finished asking and got the keys.',
  ],
  'pay-for-it': [
    '{parent} paid the {amount}. You found out later what else that money was for.',
    '{parent} said yes and covered the {amount} the same week.',
    '{parent} handed over {amount} and asked you not to mention it to anyone.',
    '{parent} covered the {amount}, and said you owed them nothing.',
  ],
  'a-car': [
    '{parent} put {amount} towards a car. It runs, mostly, and it is yours.',
    'You got a car. {parent} found {amount} somewhere and never said where.',
    '{parent} put {amount} in and made you find the rest. You found the rest.',
    // Every line names the parent. The test that checks so is standing in for
    // "no NPC first name leaks into a line a child speaks" — a child does not
    // call their mother by her first name (event-writing-rules 5) — and a line
    // that names nobody would pass that check by dodging it.
    '{parent} left the keys on the table. {amount} gone from somewhere, and no speech about it.',
  ],
  'help-with-college': [
    '{parent} is putting in {amount} a year. It does not cover it, and it changes everything.',
    '{parent} said yes to {amount}. You will find the rest.',
    '{parent} worked out what they could do. It came to {amount}, and they said it like an apology.',
    '{amount} a year, {parent} said, and do not come home in debt to anybody else.',
  ],
  'stay-a-while': [
    '{parent} said you could stay as long as you needed, and meant it.',
    'You asked to stay. {parent} said the room was yours anyway.',
    '{parent} said of course, and looked relieved you had asked.',
    '{parent} said stay, and started talking about what to do with the room after.',
    'You stayed another year. {parent} asked for rent and then never mentioned it again.',
  ],
};

const NO_LINES: Readonly<Record<string, readonly string[]>> = {
  'pocket-money': [
    '{parent} said no, and then said it again when you asked differently.',
    'Asked {parent} for money at exactly the wrong moment.',
    '{parent} said there was none spare this week, and there was not.',
  ],
  'a-lift': [
    '{parent} was not driving anywhere tonight. You worked something else out.',
    '{parent} said no. You got the bus and were forty minutes late.',
    '{parent} had already had a day of it. You did not push.',
  ],
  'pay-for-it': [
    '{parent} said it was not happening this year, and it was not.',
    'You asked. {parent} did the thing where they do not answer, which is an answer.',
    '{parent} looked at the {amount} and said to ask again when you had half of it.',
    '{parent} said no, and you could tell it was not really about the money.',
  ],
  'a-car': [
    '{parent} laughed, then realized you were serious, then said no.',
    '{parent} said you could buy one yourself when you had the money.',
    '{parent} said they would teach you to drive and that was the end of the offer.',
    'You asked about a car. {parent} asked what you thought insurance cost, and that was that.',
  ],
  'help-with-college': [
    '{parent} said they could not help with it. It was true and it still landed hard.',
    'You asked about college. {parent} changed the subject twice and then said no.',
    '{parent} said there was nothing there. You already knew and asked anyway.',
    '{parent} told you to look at loans, in the voice of somebody who had already looked.',
  ],
  'stay-a-while': [
    '{parent} said it was time. You had a few months to work out where to go.',
    'You asked to stay. {parent} said they loved you and you still needed to go.',
    '{parent} said no, and offered to help you move instead.',
    '{parent} had already turned the room into something else. That was the answer.',
    'You asked. {parent} said they had done their part, and they had.',
  ],
};
