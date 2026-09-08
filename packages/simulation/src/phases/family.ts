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
  PARENT_ACTS,
  actChance,
  costFor,
  findRequest,
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
import {
  livingChildren,
  livingParents,
  updateMember,
  type FamilyMember,
  type Household,
} from '@yearafter/relationships';
import { stableUnit, type RandomStream } from '../rng/rng';

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
  /**
   * Ticket 0209. The player's school standing, which is what their own parents
   * have to be cross about — the same field events already move.
   */
  readonly behaviour: number;
}

export interface FamilyPhaseOutput {
  readonly family: Household;
  readonly parenting: ParentingState;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
  /** Ticket 0209. School standing a parent's discipline moved, signed. */
  readonly behaviourDelta: number;
  /** Whole dollars a parent handed the player unprompted. */
  readonly gifted: number;
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

  /* ---- what YOUR parents do, unasked ------------------------------------- */
  //
  // Spec 61's asymmetry and spec 1197: everything removed from the player as a
  // parent stays available to NPC parents when the player is the child. None of
  // this is triggered by the player, which is the point — being a child is
  // largely being on the receiving end of other people's decisions.
  //
  // At most ONE a year, for the reason every other phase caps its lines: a
  // household with two parents and six acts could otherwise write six lines a
  // September, and reading 0206's output found exactly that failure.
  let behaviourDelta = 0;
  let gifted = 0;
  const guardians = livingParents(household);
  if (guardians.length > 0) {
    const candidates: { act: (typeof PARENT_ACTS)[number]; parent: FamilyMember }[] = [];
    for (const act of PARENT_ACTS) {
      if (input.age < act.minAge) continue;
      if (act.maxAge !== undefined && input.age > act.maxAge) continue;
      for (const parent of guardians) {
        if (input.stream.chance(actChance(act, parent, household, input.behaviour))) {
          candidates.push({ act, parent });
        }
      }
    }
    const chosen = candidates.length > 0 ? input.stream.pick(candidates) : undefined;
    if (chosen) {
      const who = chosen.parent.role === 'mother' ? 'Mom' : 'Dad';
      // The salt is the HOUSEHOLD, not the parent who happens to act. Keyed on
      // the parent, Mom at fifteen and Dad at sixteen drew different bases and
      // could land on the same line — and several of these lines name nobody,
      // so the {parent} substitution does not save it. Salting on the family
      // makes age the only thing that moves, which is the guarantee.
      const salt = guardians
        .map((member) => member.firstName)
        .sort()
        .join('|');
      const result = resolveParentAct(chosen.act.id, who, salt, input.age);
      lines.push({ kind: 'relationship', text: result.text });
      behaviourDelta += result.behaviour;
      gifted += result.gift;
      // Ticket 0210b. A parent who offers to cover college commits to a yearly
      // share of the household's income, exactly as the asked-for version does.
      if (result.offersCollege && !parenting.collegeSupport) {
        parenting = {
          ...parenting,
          collegeSupport: costFor(
            findRequest('help-with-college')!,
            { ...household, members },
            input.age,
          ),
        };
      }
      if (result.warmth !== 0) {
        members = updateMember({ ...household, members }, chosen.parent.id, (member) => ({
          ...member,
          relationship: clampStat(member.relationship + result.warmth) as StatValue,
        })).members as FamilyMember[];
      }
    }
  }

  return {
    family: { ...input.family, members },
    parenting,
    lines,
    behaviourDelta,
    gifted,
  };
}

/**
 * What one unprompted parental act actually does.
 *
 * Discipline moves SCHOOL STANDING through the same field events use, so being
 * grounded routes into the machinery that already exists (and can genuinely
 * land a character in an alternative school, spec 73) rather than a parallel
 * one. A gift is whole dollars into the player's own pocket, named, because
 * CORE_RULES 13.6 requires money to say where it came from.
 */
function resolveParentAct(
  id: (typeof PARENT_ACTS)[number]['id'],
  who: string,
  salt: string,
  age: number,
): { text: string; behaviour: number; gift: number; warmth: number; offersCollege?: boolean } {
  //
  // CORE_RULES 13.17, and this is the FIFTH time this exact bug has shipped —
  // 0206's drift lines, 0207d, 0208's milestones, 0209's ask replies, and now
  // here. Reading a played childhood found "Dad came home with something you
  // had not asked for" at four, five, six AND seven.
  //
  // The two halves of the fix are both required and neither is sufficient:
  //
  //  1. MORE LINES THAN REPEATS. `bought-you-something` can fire in any of
  //     fourteen years. Two lines and a coin flip repeats immediately; five
  //     lines and a rotation cannot repeat until the sixth firing.
  //  2. A STABLE BASE. A fresh draw each year cancels an age rotation exactly
  //     as often as it helps, which is how the first fix in 0209 failed. So the
  //     base holds still for the life — one value per parent and act — and AGE
  //     does all of the moving. Two consecutive years cannot collide.
  //
  const pick = (lines: readonly string[]) => {
    const base = Math.floor(stableUnit(`${salt}:${id}`) * lines.length);
    return (lines[(base + age) % lines.length] as string).replace(/\{parent\}/g, who);
  };

  switch (id) {
    case 'paid-for-college':
      // The GIFT is zero and the money is not here: what this does is set
      // `collegeSupport`, which the caller reads, because a commitment to pay
      // tuition every year is not a lump sum handed to a seventeen-year-old.
      return {
        text: pick([
          '{parent} sat you down and said they would cover college if you wanted to go.',
          '{parent} had been putting money aside for college since you were small.',
          '{parent} said the tuition was handled. You had not known there was anything set aside.',
          'There was a college fund. {parent} had never mentioned it and it was not large, but it was there.',
        ]),
        behaviour: 0,
        gift: 0,
        warmth: 6,
        offersCollege: true,
      };
    case 'bought-you-something':
      return {
        text: pick([
          '{parent} came home with something you had not asked for and had wanted for months.',
          '{parent} bought you something for no reason. It was $40 and it is still on your shelf.',
          '{parent} spent $40 on you on an ordinary Tuesday and would not say why.',
          'There was a bag on your bed. {parent} never mentioned it, then or after.',
          '{parent} saw it in a window and thought of you, and $40 later here it was.',
        ]),
        behaviour: 0,
        gift: 40,
        warmth: 3,
      };
    case 'paid-for-it-anyway':
      return {
        text: pick([
          'You never asked. {parent} paid for it anyway and never brought it up.',
          '{parent} quietly covered something you had given up on.',
          'The thing you had stopped talking about turned up paid for. {parent} shrugged.',
          '{parent} had already sorted it out by the time you worked up to asking.',
          'You found out from somebody else that {parent} had paid for it.',
        ]),
        behaviour: 0,
        gift: 0,
        warmth: 4,
      };
    case 'grounded-you':
      return {
        text: pick([
          // NOT "grounded for two weeks, served eleven days" — the event
          // catalog already has that line, and two systems telling the same
          // joke reads as the game repeating itself rather than as a callback.
          '{parent} grounded you until further notice and forgot to lift it for a month.',
          '{parent} took your phone for a month and did not budge.',
          '{parent} said no going out until the grades came back up, and meant every word.',
          'You were grounded for the whole of a weekend everybody else was out.',
          '{parent} stopped your allowance and did not say for how long.',
        ]),
        behaviour: 4,
        gift: 0,
        warmth: -4,
      };
    case 'sat-you-down':
      return {
        text: pick([
          '{parent} sat you down and said the disappointed thing, which was worse than shouting.',
          '{parent} asked what was going on with you. You did not have an answer ready.',
          '{parent} turned the TV off and asked you to talk to them. It took an hour.',
          'The school called {parent}. The conversation afterwards was very quiet.',
          '{parent} said they were not angry, and it turned out they were not, and that was worse.',
        ]),
        behaviour: 6,
        gift: 0,
        warmth: 1,
      };
    case 'could-not-afford-it':
      return {
        text: pick([
          '{parent} said no to something small, and you understood why, and it still stung.',
          'There was no money for it this year. Nobody said so out loud.',
          'You stopped asking for things for a while, without deciding to.',
          '{parent} said maybe next year in a voice that meant no.',
          'Everybody else went. {parent} could not make it work and did not pretend otherwise.',
        ]),
        behaviour: 0,
        gift: 0,
        warmth: -1,
      };
    case 'kicked-you-out':
      return {
        text: pick([
          '{parent} told you it was time to find your own place. You had a month.',
          '{parent} said you could not stay. You were out by the end of the season.',
          '{parent} had your things by the door before you understood it was happening.',
          'The row ended with {parent} telling you to go, and neither of you took it back.',
          '{parent} said they needed the room. That was the whole reason and it was enough.',
        ]),
        behaviour: 0,
        gift: 0,
        warmth: -22,
      };
  }
}
