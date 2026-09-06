/**
 * Ticket 0208 — the things a parent actually does.
 *
 * There are four, and the list is short on purpose. Spec 61 removed paying for
 * activities, discipline, funding college, refusing assistance, buying a
 * vehicle and providing housing as direct player actions, and added exactly one
 * thing: Kick Out of House. Spec 1813 says player-parent interaction stays
 * lightweight. So:
 *
 *   try for a baby · apply to adopt · answer what a child asked · kick them out
 *
 * Everything else about raising a child is the family phase, and most of it is
 * abstracted (spec 1986). A parent in this game is somebody who says yes or no
 * and then lives with it, which is both what the spec asks for and closer to
 * the thing than a management screen would be.
 */

import { createTimelineEntry, type Character, type TimelineEntry } from '@yearafter/character';
import { cents, err, ok, subtract, type Result } from '@yearafter/core';
import {
  feeFor,
  CHILD_ASKS,
  askCost,
  PARENT_AGE,
  canApply,
  canBecomeParent,
  conceptionChance,
  isWaiting,
  triedThisYear,
  type ParentingState,
} from '@yearafter/parenting';
import { livingChildren, updateMember, type Household } from '@yearafter/relationships';
import { partnerOf } from '@yearafter/social';
import type { GameState } from './game-state';
import { RngDomains } from './rng/rng';

export type ParentingError =
  /** Under eighteen. The same hard gate romance uses (0207). */
  | 'too-young'
  /** Trying for a baby needs somebody to try with. */
  | 'no-partner'
  | 'already-expecting'
  | 'already-this-year'
  | 'cannot-afford'
  | 'already-applied'
  | 'no-such-child'
  | 'nothing-asked'
  | 'still-a-child';

export interface ParentingOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

const write = (
  state: GameState,
  text: string,
  id: string,
  spend = 0,
): { player: Character; entry: TimelineEntry } => {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'relationship',
    text,
    id,
    sequence,
  });
  return {
    player: {
      ...state.player,
      timeline: [...state.player.timeline, entry],
      cash: spend > 0 ? subtract(state.player.cash, cents(spend)) : state.player.cash,
    },
    entry,
  };
};

/* -------------------------------------------------------------------------- */
/* Try for a baby                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Once a year, and it can simply not happen — which is the point.
 *
 * The line the feed writes when it does not is deliberately not an apology or a
 * nudge to try again. It is a year that passed.
 */
export function tryForBaby(state: GameState): Result<ParentingOutcome, ParentingError> {
  if (!canBecomeParent(state.player.age)) return err('too-young');
  if (state.parenting.pregnancy) return err('already-expecting');
  if (triedThisYear(state.parenting, state.player.age)) return err('already-this-year');

  const partner = partnerOf(state.circle.people);
  if (!partner) return err('no-partner');

  const stream = state.rng.stream(RngDomains.Family);
  const kids = livingChildren(state.family).length;
  const worked = stream.chance(conceptionChance(state.player.age, kids));

  const text = worked
    ? `You and ${partner.firstName} are expecting.`
    : NOT_THIS_YEAR[Math.floor(stream.next() * NOT_THIS_YEAR.length)] ?? NOT_THIS_YEAR[0]!;

  const { player, entry } = write(
    state,
    text,
    `t:${state.world.year}:baby:${state.player.age}`,
  );

  const parenting: ParentingState = {
    ...state.parenting,
    triedAtAge: state.player.age,
    ...(worked ? { pregnancy: { since: state.player.age, otherParentId: partner.id } } : {}),
  };

  return ok({ state: { ...state, player, parenting }, entry });
}

const NOT_THIS_YEAR: readonly string[] = [
  'Another year of trying, and no news.',
  'You spent the year hoping. It did not happen this time.',
  'Nothing this year. You are both fine about it, mostly.',
];

/* -------------------------------------------------------------------------- */
/* Adopt                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Deliberately open to a single parent, and deliberately slow.
 *
 * Adoption is not a second button that does what the first one does — it does
 * not need a partner and does not care about the fertility curve, and it costs
 * money and years instead. Those are the trade, and they are what make it a
 * decision rather than a fallback for an unlucky roll.
 */
export function applyToAdopt(state: GameState): Result<ParentingOutcome, ParentingError> {
  if (!canBecomeParent(state.player.age)) return err('too-young');
  if (isWaiting(state.parenting.adoption)) return err('already-applied');
  const cash = Number(state.player.cash);
  if (!canApply(state.player.age, cash, state.parenting.adoption)) return err('cannot-afford');

  const { player, entry } = write(
    state,
    'Started the adoption paperwork. There is a great deal of it, and then you wait.',
    `t:${state.world.year}:adopt`,
    feeFor(cash),
  );

  return ok({
    state: {
      ...state,
      player,
      parenting: { ...state.parenting, adoption: { appliedAtAge: state.player.age } },
    },
    entry,
  });
}

/* -------------------------------------------------------------------------- */
/* Answer what a child asked                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Spec 61 and spec 1147: the one parenting decision the player actually makes.
 *
 * Saying yes costs money and moves the child closer. Saying no is not a
 * punishment and does not have to be wrong — a broke parent turning down a $650
 * computer is doing the only thing they can, and the model should not read that
 * as neglect. What it does read as is one fewer year of showing up, which is
 * `closenessYear`, and which is recoverable.
 */
export function answerChild(
  state: GameState,
  yes: boolean,
): Result<ParentingOutcome, ParentingError> {
  const ask = state.parenting.ask;
  if (!ask || ask.age !== state.player.age) return err('nothing-asked');

  const child = state.family.members.find((member) => member.id === ask.childId);
  if (!child) return err('no-such-child');
  const wanted = CHILD_ASKS.find((entry) => entry.id === ask.askId);
  if (!wanted) return err('nothing-asked');

  // What the parent can actually put towards it. See `askCost` — a hard gate
  // here made the one parenting decision in the game unreachable for everybody.
  const paying = askCost(wanted.cost, Number(state.player.cash));

  const them = child.sex === 'female' ? 'her' : 'him';
  const text = yes
    ? `Said yes. ${child.firstName} got ${wanted.wants.replace(/^to /, 'to ')}, and it mattered more to ${them} than it cost you.`
    : `Told ${child.firstName} no. ${child.sex === 'female' ? 'She' : 'He'} took it better than you did.`;

  const { player, entry } = write(
    state,
    text,
    `t:${state.world.year}:ask:${child.id}`,
    yes ? paying : 0,
  );

  const family: Household = updateMember(state.family, child.id, (member) => ({
    ...member,
    // The yes itself is worth something on the day. The rest is `closenessYear`
    // next year, which is where showing up actually gets counted.
    relationship: Math.min(100, member.relationship + (yes ? 4 : -2)) as typeof member.relationship,
  }));

  return ok({
    state: {
      ...state,
      player,
      family,
      parenting: {
        ...state.parenting,
        ask: undefined,
        ...(yes
          ? { answered: { ...state.parenting.answered, [child.id]: state.player.age } }
          : { refused: { ...(state.parenting.refused ?? {}), [child.id]: state.player.age } }),
      },
    },
    entry,
  });
}

/* -------------------------------------------------------------------------- */
/* Kick out                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The one thing spec 61 ADDS to the parent's menu, and the only irreversible
 * one. Only for a child who is legally an adult — the age gate again, and this
 * one matters more than most.
 */
export function kickOut(
  state: GameState,
  childId: string,
): Result<ParentingOutcome, ParentingError> {
  const child = state.family.members.find((member) => member.id === childId);
  if (!child || child.role !== 'child') return err('no-such-child');
  const childAge = state.world.year - child.birthYear;
  if (childAge < PARENT_AGE) return err('still-a-child');

  const { player, entry } = write(
    state,
    `Told ${child.firstName} it was time to go. ${child.sex === 'female' ? 'She' : 'He'} was out within a month, and it was quiet in the house after.`,
    `t:${state.world.year}:kickout:${child.id}`,
  );

  const family = updateMember(state.family, child.id, (member) => ({
    ...member,
    relationship: Math.max(0, member.relationship - 28) as typeof member.relationship,
  }));

  return ok({ state: { ...state, player, family }, entry });
}

/* -------------------------------------------------------------------------- */
/* What the screens ask                                                        */
/* -------------------------------------------------------------------------- */

export const canTryForBaby = (state: GameState): boolean =>
  canBecomeParent(state.player.age) &&
  state.parenting.pregnancy === undefined &&
  partnerOf(state.circle.people) !== undefined;

export const canAdoptNow = (state: GameState): boolean =>
  canBecomeParent(state.player.age) && !isWaiting(state.parenting.adoption);

export const openAskOf = (state: GameState) =>
  state.parenting.ask?.age === state.player.age ? state.parenting.ask : undefined;
