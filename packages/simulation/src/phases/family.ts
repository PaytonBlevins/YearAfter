/**
 * Ticket 0208 — the family phase.
 *
 * Fifth phase module, and its position is load-bearing like every other one's:
 * it runs AFTER social and BEFORE events.
 *
 *  - after social, because a pregnancy needs to know who the player is with,
 *    and 0207b's social phase is where a relationship can end;
 *  - before events, because an event that fires this year should be able to
 *    name a child who already exists. Run the other way round, the year a baby
 *    arrives could produce an event about a child the engine has not made yet.
 *
 * What happens here, in order: a pregnancy comes due, an adoption is placed,
 * every child gets a year older, and one of them may ask for something. Spec
 * 1986 abstracts the rest — "most childcare is abstracted unless a meaningful
 * event occurs" — so an ordinary year with a small child writes nothing at all,
 * which is correct and is also why the feed does not drown once a family has
 * three of them.
 */

import type { Personality, Sex, TimelineKind } from '@yearafter/character';
import { asNpcId, clampStat, type StatValue } from '@yearafter/core';
import {
  ASK_CHANCE,
  alreadyAsked,
  parentYearFor,
  asksFor,
  childPersonality,
  closenessYear,
  isDue,
  milestoneFor,
  placementChance,
  ageOnArrival,
  type ParentingState,
} from '@yearafter/parenting';
import { livingChildren, type FamilyMember, type Household } from '@yearafter/relationships';
import type { RandomStream } from '../rng/rng';

export interface FamilyPhaseInput {
  readonly family: Household;
  readonly parenting: ParentingState;
  readonly stream: RandomStream;
  readonly age: number;
  readonly worldYear: number;
  /** The player's own personality, half of what a newborn inherits. */
  readonly personality: Personality;
  /** The other parent's personality, when there is one. */
  readonly partnerPersonality?: Personality;
  readonly partnerId?: string;
  readonly partnerLastName?: string;
  readonly playerLastName: string;
  /** Given names already in use, so no two people in one family share one. */
  readonly takenNames: ReadonlySet<string>;
  /** Draws a given name for this sex from the character's naming tradition. */
  readonly nameFor: (sex: Sex, taken: ReadonlySet<string>) => string;
}

export interface FamilyPhaseOutput {
  readonly family: Household;
  readonly parenting: ParentingState;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
}

export function runFamily(input: FamilyPhaseInput): FamilyPhaseOutput {
  const lines: { kind: TimelineKind; text: string }[] = [];
  let members = [...input.family.members];
  let parenting = input.parenting;
  const taken = new Set(input.takenNames);

  const arrive = (bornYear: number, by: 'birth' | 'adoption'): FamilyMember => {
    const sex: Sex = input.stream.chance(0.5) ? 'male' : 'female';
    const firstName = input.nameFor(sex, taken);
    taken.add(firstName);
    return {
      id: asNpcId(`npc:child:${input.worldYear}:${members.length}`),
      role: 'child',
      firstName,
      // A child born to a couple takes the player's surname here. Whose name a
      // family uses is a real decision and a later ticket's; picking one and
      // saying so is better than picking one silently.
      lastName: input.playerLastName,
      sex,
      birthYear: bornYear,
      alive: true,
      // Tier 1 from the first day. Spec 674-683 lists children among the people
      // who get deep state and memory, and a child is not background.
      tier: 1,
      personality: childPersonality(input.personality, input.partnerPersonality, () =>
        input.stream.next(),
      ),
      // Starts high and is the player's to keep. See `closenessYear`.
      relationship: clampStat(input.stream.range(78, 92)) as StatValue,
      arrivedWhenPlayerWas: input.age,
      arrivedBy: by,
      ...(input.partnerId !== undefined && by === 'birth'
        ? { otherParentId: asNpcId(input.partnerId) }
        : {}),
    };
  };

  /* ---- a pregnancy comes due ---------------------------------------------- */
  if (parenting.pregnancy && isDue(parenting.pregnancy, input.age)) {
    const baby = arrive(input.worldYear, 'birth');
    members = [...members, baby];
    lines.push({
      kind: 'relationship',
      text: `${baby.firstName} was born. Everything else got smaller for a while.`,
    });
    parenting = { ...parenting, pregnancy: undefined, lastBirthAtAge: input.age };
  }

  /* ---- an adoption is placed ---------------------------------------------- */
  const application = parenting.adoption;
  if (
    application &&
    application.placedAtAge === undefined &&
    application.withdrawnAtAge === undefined
  ) {
    const waiting = input.age - application.appliedAtAge;
    if (input.stream.chance(placementChance(waiting))) {
      const arrivalAge = ageOnArrival(input.stream.next());
      const child = arrive(input.worldYear - arrivalAge, 'adoption');
      members = [...members, child];
      lines.push({
        kind: 'relationship',
        text:
          arrivalAge === 0
            ? `The adoption went through. ${child.firstName} came home at three weeks old.`
            : `The adoption went through. ${child.firstName} is ${arrivalAge}, and moved in with one bag.`,
      });
      parenting = { ...parenting, adoption: { ...application, placedAtAge: input.age } };
    } else if (waiting === 1) {
      // One line, once, so the player knows it is still happening. Any more
      // than that is a progress bar in prose.
      lines.push({ kind: 'passive', text: 'Another year on the adoption list. Nothing yet.' });
    }
  }

  /* ---- everybody gets a year older ---------------------------------------- */
  //
  // Only ONE milestone line a year across the whole family. A household with
  // three children could otherwise produce three of these every September, and
  // reading 0206's output found exactly that failure mode with drift lines.
  let milestoneWritten = false;
  members = members.map((member) => {
    if (member.role !== 'child' || !member.alive) return member;
    const childAge = input.worldYear - member.birthYear;

    if (!milestoneWritten) {
      const line = milestoneFor(childAge, member.firstName, input.stream.next());
      // The birth line above already covered age zero this year.
      if (line && childAge > 0) {
        lines.push({ kind: 'relationship', text: line });
        milestoneWritten = true;
      }
    }

    return {
      ...member,
      relationship: closenessYear(
        member.relationship,
        parentYearFor(parenting, member.id, input.age),
        childAge,
      ),
    };
  });

  /* ---- one of them asks for something ------------------------------------- */
  //
  // Spec 61: "Children should instead ask for activities. If the player
  // approves, the child joins." The answer happens on the child's own page —
  // this is the asking.
  const household: Household = { ...input.family, members };
  const openAsk = parenting.ask?.age === input.age ? parenting.ask : undefined;
  if (!openAsk) {
    // Only children who have something LEFT to ask for. A child who asks for
    // the dog they already have reads as the game forgetting.
    const remaining = (child: FamilyMember) =>
      asksFor(input.worldYear - child.birthYear).filter(
        (option) => !alreadyAsked(parenting, child.id).includes(option.id),
      );
    const canAsk = livingChildren(household).filter((child) => remaining(child).length > 0);
    if (canAsk.length > 0 && input.stream.chance(ASK_CHANCE)) {
      const child = input.stream.pick([...canAsk]);
      const ask = input.stream.pick([...remaining(child)]);
      parenting = {
        ...parenting,
        ask: { childId: child.id, askId: ask.id, age: input.age },
        askedBefore: {
          ...(parenting.askedBefore ?? {}),
          [child.id]: [...alreadyAsked(parenting, child.id), ask.id],
        },
      };
      // Phrased off `wants` so both shapes read: "wants to play basketball"
      // and "wants a dog, and promises to walk it".
      lines.push({
        kind: 'relationship',
        text: `${child.firstName} wants ${ask.wants}.`,
      });
    }
  }

  return { family: household, parenting, lines };
}
