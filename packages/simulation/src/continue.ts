/**
 * Ticket 0212 — carrying on as your child.
 *
 * Spec 818–827: *"The player may continue as an eligible child/descendant or
 * start a new life."*
 *
 * THE DECISION THIS FILE IS BUILT ON
 *
 * The measurement that opened the ticket: the median child is **forty-three**
 * when the player dies. Three ways to handle that were put to the product
 * owner — take over the adult with a generated backstory, start again as their
 * newborn, or take over the adult with an honestly blank history. The answer
 * was four words: *"They should have a simulated life."*
 *
 * That is a correction, not a choice off the list, and it is the harder and
 * better one. A backstory assembled at the moment of takeover is the game
 * asserting forty-three years of facts it never simulated; the first time a
 * player notices an entire history appearing at once, none of it means
 * anything. So the child's years are simulated as they happen, in
 * `@yearafter/parenting`'s `runOffspringYear`, driven by the kin phase, from the
 * same seeded streams as everything else. This file does not invent a life. It
 * PROMOTES one.
 *
 * WHAT IS CARRIED AND WHAT IS NOT
 *
 *   carried   their name, sex, birth year, personality, where they were born,
 *             their schooling, their degree, their job and how far up it they
 *             got, their partner, their children and when each was born, and
 *             their own timeline.
 *   rebuilt   the household, from their side of it: the dead player becomes a
 *             dead parent, the partner becomes the other parent, and their
 *             children become the children.
 *   dropped   the previous character's friends, colleagues, conditions, stress,
 *             cooldowns and pending decisions. None of those are inherited by
 *             anybody, and carrying them would be the parent's life continuing
 *             under a new name.
 *
 * WHAT IS HONESTLY MADE UP, AND SAYS SO
 *
 * Two things. A child's VISIBLE STATS were never simulated — an NPC carries a
 * personality and nothing else, and putting six more bars on every family
 * member so a number nobody sees could be read once at takeover is not a trade
 * worth making. They are drawn here from the heir's own id, which means stable
 * across loads and not re-rolled by trying again. And their grandchildren's
 * NAMES are drawn here, though their existence and ages were simulated year by
 * year. A name is a label; the person is what had to be real.
 *
 * ESTATE
 *
 * Spec 818–827 says estate processing "automatically applies debts, wills,
 * trusts, and inheritance". There is no ledger until 0301 and no debt anywhere
 * in the build, so inheritance here is exactly what it can honestly be: the
 * cash that was left. CORE_RULES 13.21 — do not gate a system on a system that
 * has not shipped, and do not pretend to one either.
 */

import {
  createCharacter,
  createStats,
  type Character,
  type LifeRecord,
  type TimelineEntry,
} from '@yearafter/character';
import {
  asCharacterId,
  asNpcId,
  cents,
  clampStat,
  stableUnit,
  type StatValue,
  dollars,
} from '@yearafter/core';
import {
  EMPTY_LEDGER,
  OPEN_FROM_AGE,
  TRANSITION_REPUTATION,
  businessSaleOf,
  businessValueFor,
  cashFrom,
  post,
  saleOf,
  vehicleSaleOf,
  type Ledger,
} from '@yearafter/finance';
import { findBusinessType } from '@yearafter/content';
import { NOT_YET_ENROLLED, type EducationState } from '@yearafter/education';
import { EMPTY_HISTORY } from '@yearafter/events';
import { EMPTY_EMPLOYMENT } from '@yearafter/careers';
import { EMPTY_HEALTH } from '@yearafter/health';
import { type OffspringLife } from '@yearafter/parenting';
import { EMPTY_CIRCLE } from '@yearafter/social';
import type { FamilyMember, Household } from '@yearafter/relationships';
import { createGameState, type GameState } from './game-state';
import { RngDomains } from './rng/rng';
import { nameContext, uniqueFirstName } from './social-generator';

/**
 * The heir's books, opened with one entry.
 *
 * The previous generation's ledger is NOT carried across — it belongs to
 * whoever earned it, the same as their friends, their conditions and their
 * cooldowns. What crosses is the money, and it crosses as a transaction so that
 * the heir's own `reconcile` holds from the first year: a balance with no
 * transaction behind it is exactly the state migration 17 had to repair for
 * every save written before this ticket.
 */
function inheritedLedger(
  state: GameState,
  lastName: string,
  heirAge: number,
  sellBusinesses: boolean,
): Ledger {
  const estate = Number(state.player.cash);
  let books = EMPTY_LEDGER;
  if (estate > 0) {
    books = post(books, state.world.year, heirAge, {
      category: 'gift',
      amount: cents(estate),
      source: `What ${state.player.firstName} ${lastName} left`,
    }).ledger;
  }
  /*
    Ticket 0501. THE HOUSE IS SOLD AND WHAT IS LEFT COMES TO THE HEIR.

    Spec 818–827 asks for estate processing without chores, and a house is the
    thing most people actually leave. Sold rather than handed over: the heir
    lives somewhere else, the market sells it for what it is worth, the lender
    is repaid, and the rest is money — one line in their books with a source,
    which is what keeps their first `reconcile` true.
  */
  const equity = state.homes.reduce((sum, home) => sum + saleOf(home).proceeds, 0);
  if (equity > 0) {
    books = post(books, state.world.year, heirAge, {
      category: 'gift',
      amount: dollars(equity),
      source: `The sale of ${state.player.firstName}'s home`,
    }).ledger;
  }
  // Ticket 0504. And the cars, the same way: sold, the lender repaid, the rest to the heir.
  const cars = state.vehicles.reduce((sum, vehicle) => sum + Math.max(0, vehicleSaleOf(vehicle).proceeds), 0);
  if (cars > 0) {
    books = post(books, state.world.year, heirAge, {
      category: 'gift',
      amount: dollars(cars),
      source: `The sale of ${state.player.firstName}'s ${state.vehicles.length === 1 ? 'car' : 'cars'}`,
    }).ledger;
  }
  // Ticket 0601. And the businesses: sold at what a buyer would ordinarily pay,
  // the till with them. Ticket 0604: unless the heir is keeping them (see `keepsBusinesses`),
  // in which case nothing is sold and nothing is posted: a business is handed on, not paid out.
  // Ticket 0603: and a lender is paid out of the sale before the heir sees any of it,
  // as it is on any other sale. Without this a loan taken to buy a business would be
  // wiped by dying, and the heir would keep the business's whole value.
  const businesses = (sellBusinesses ? state.businesses : []).reduce((sum, business) => {
    const type = findBusinessType(business.typeId);
    if (!type) return sum;
    const owed = owedOn(state, business.id);
    return sum + Math.max(0, businessSaleOf(business, type, state.world.year, 0).proceeds - owed);
  }, 0);
  if (businesses > 0) {
    books = post(books, state.world.year, heirAge, {
      category: 'gift',
      amount: dollars(businesses),
      source: `The sale of ${state.player.firstName}'s ${state.businesses.length === 1 ? 'business' : 'businesses'}`,
    }).ledger;
  }
  return books;
}

/**
 * Ticket 0604. Whether an heir takes the businesses on or has them sold.
 *
 * Handed on by default, because spec 1200 wants "long-lived businesses" to be
 * something a family can have, and a business that is sold at a death is a
 * business that cannot be. Not for a child: a ten-year-old does not run a
 * trucking company, and the old rule (sold, the lender paid, the rest to the
 * heir) is the right one for them. Not if the player chose to sell.
 */
export const keepsBusinesses = (heirAge: number, choice: boolean | undefined): boolean =>
  choice !== false && heirAge >= OPEN_FROM_AGE;

/** What is owed on a business, from the loans written for it. Whole dollars. */
const owedOn = (state: GameState, businessId: string): number =>
  state.loans
    .filter((loan) => loan.businessId === businessId)
    .reduce((total, loan) => total + Number(loan.balance) / 100, 0);

/** Children of the player who are alive and could be carried on as. */
export const heirsIn = (family: Household): readonly FamilyMember[] =>
  family.members.filter((member) => member.role === 'child' && member.alive);

/**
 * Six stats for somebody who was never given any.
 *
 * Stable on the heir's own id, so trying the continuation, backing out and
 * trying again does not re-roll them — which would turn an inheritance into a
 * slot machine. Centred a little above the middle and narrow: this is a person
 * who has already lived forty years, and a heir generated at the bottom of the
 * distribution would be a punishment for the parent having had children.
 */
function statsFor(id: string): Record<string, StatValue> {
  const at = (key: string) => clampStat(Math.round(38 + stableUnit(`${id}:${key}`) * 44));
  return {
    happiness: at('happiness'),
    health: at('health'),
    smarts: at('smarts'),
    looks: at('looks'),
    charisma: at('charisma'),
    willpower: at('willpower'),
    discipline: at('discipline'),
  };
}

/**
 * Turn the reduced life into the two pieces the real simulation needs.
 *
 * Nothing is invented: the stage and the degree were decided in the year they
 * happened, and this only translates the small model's vocabulary into the
 * full one's.
 */
function educationFrom(life: OffspringLife): EducationState {
  const credentials = life.degree
    ? { highSchool: 18, university: 22 }
    : life.leftSchoolEarly
      ? {}
      : { highSchool: 18 };
  return {
    ...NOT_YET_ENROLLED,
    stage: life.leftSchoolEarly ? 'droppedOut' : 'graduated',
    credentials,
  };
}

/**
 * Their own feed, promoted to the player's.
 *
 * These lines were written in the year they happened, so the heir opens the
 * Life screen on a history rather than on an empty page. That was the entire
 * point of simulating them. Capped at `TIMELINE_CAP` by the model itself, so a
 * dynasty does not accumulate every ancestor's complete feed.
 */
function timelineFrom(life: OffspringLife): readonly TimelineEntry[] {
  return life.timeline.map((entry, index) => ({
    id: `t:${entry.year}:before:${index}`,
    age: entry.age,
    year: entry.year,
    kind: 'milestone' as const,
    text: entry.text,
    sequence: index,
  }));
}

/**
 * And their records, from the same source.
 *
 * Derived from the STRUCTURE of the reduced life — the degree field, the job
 * title, the partner's name, the list of birth years — never by matching words
 * in the lines above. That is the rule `LifeRecord` was declared with in Sprint
 * Zero and the reason 0211b could rewrite a hundred and eighty sentences
 * without breaking anything downstream.
 */
function recordsFrom(life: OffspringLife, birthYear: number): readonly LifeRecord[] {
  const records: LifeRecord[] = [];
  const at = (year: number) => ({ age: year - birthYear, year });
  if (!life.leftSchoolEarly) {
    records.push({
      id: `r:${birthYear + 18}:education:0`,
      category: 'education',
      label: 'Graduated high school',
      ...at(birthYear + 18),
    });
  }
  if (life.degree) {
    records.push({
      id: `r:${birthYear + 22}:education:1`,
      category: 'education',
      label: 'Graduated college',
      ...at(birthYear + 22),
    });
  }
  if (life.jobTitle) {
    records.push({
      id: `r:${birthYear + 23}:career:0`,
      category: 'career',
      label: `Worked as a ${life.jobTitle.toLowerCase()}`,
      ...at(birthYear + 23),
    });
  }
  life.childrenBorn.forEach((year, index) => {
    records.push({
      id: `r:${year}:family:${index}`,
      category: 'family',
      label: 'Had a child',
      ...at(year),
    });
  });
  return records;
}

/**
 * Become your child.
 *
 * Returns a complete `GameState` one generation on: same world year, same seed,
 * `generation + 1`. Returns `undefined` when the id is not a living child,
 * which the UI can only reach by a save changing underneath it.
 */
export interface ContinueOptions {
  /** Ticket 0604. False has the businesses sold instead of handed on. Anything else keeps them. */
  readonly keepBusinesses?: boolean;
}

export function continueAsChild(
  state: GameState,
  childId: string,
  options: ContinueOptions = {},
): GameState | undefined {
  const heir = heirsIn(state.family).find((member) => member.id === childId);
  if (!heir) return undefined;

  /*
    Ticket 0302. The estate is computed ONCE.

    0301 shipped this as two derivations of the same number: `cash` read
    `state.player.cash` and `inheritedLedger` read it again to build the opening
    transaction. They agreed, because both read the same input — which is
    exactly how CORE_RULES 13.23 defects look right up until somebody changes
    one of them. 0307 adds debts to net off and 0310 adds a pension to roll in;
    whichever of those lands first would have updated one and not the other, and
    the heir would have started life holding a balance their own books did not
    account for.

    So the ledger is built first and the balance comes out of it.
  */
  const life = (heir.life as OffspringLife | undefined) ?? {
    stage: 'working' as const,
    performance: 50,
    leftSchoolEarly: false,
    rung: 0,
    childrenBorn: [],
    timeline: [],
  };
  const age = state.world.year - heir.birthYear;
  const keeps = keepsBusinesses(age, options.keepBusinesses);
  const finance = inheritedLedger(state, heir.lastName, age, !keeps);
  /*
    Ticket 0604. A business that is kept is the SAME business: its till, its
    staff, its name in town, its doors, its rival and its lender all go with it.
    What changes is the hands on it (the heir's own stats and attention, from
    the next year) and what the town makes of a new owner, the same four points
    as when one is bought. The lender stays a lender: the loan keeps its
    `businessId`, so the business goes on paying it and the heir is not asked to.
  */
  const inherited = keeps
    ? state.businesses.map((business) => {
        const type = findBusinessType(business.typeId);
        return {
          ...business,
          reputation: Math.max(0, business.reputation - TRANSITION_REPUTATION),
          invested: dollars(type ? businessValueFor(business, type, state.world.year) : 0),
        };
      })
    : undefined;
  // Only the loans of businesses that were handed on. One whose business is already gone is a
  // personal debt now, and personal debts are dropped at a death as they always were (0508's).
  const inheritedLoans = inherited
    ? state.loans.filter((loan) => inherited.some((business) => business.id === loan.businessId))
    : undefined;

  const player: Character = {
    ...createCharacter({
      id: asCharacterId(`char:${heir.id}`),
      firstName: heir.firstName,
      lastName: heir.lastName,
      sex: heir.sex,
      age,
      birthYear: heir.birthYear,
      birthLocation: state.player.birthLocation,
      personality: heir.personality,
      stats: createStats(statsFor(heir.id)),
      /*
        The estate. Ticket 0301 gave it a ledger entry rather than a shape.

        Still all of it — there is no debt to net off and no will to divide it
        by until 0307 — but it is now an opening transaction in the heir's own
        books with a source that says where it came from, rather than a balance
        that simply appears. `inheritedLedger` below builds it.
      */
      cash: cashFrom(finance),
      occupation: life.jobTitle ?? 'Unemployed',
    }),
    timeline: timelineFrom(life),
    records: recordsFrom(life, heir.birthYear),
  };

  /*
    The household, from their side.

    The player who just died becomes a dead parent — which is the one detail
    that makes a dynasty feel like a dynasty rather than a new save with an old
    balance. Their partner, if there was one, becomes the other parent and is
    carried across alive, because the heir's other parent outliving the player
    is an ordinary thing to happen.
  */
  const deceased: FamilyMember = {
    id: asNpcId(`npc:forebear:${state.world.generation}`),
    role: state.player.sex === 'male' ? 'father' : 'mother',
    firstName: state.player.firstName,
    lastName: state.player.lastName,
    sex: state.player.sex,
    birthYear: state.player.birthYear,
    alive: false,
    diedWhenPlayerWas: age,
    tier: 1,
    personality: state.player.personality,
    relationship: heir.relationship,
  };

  const grandchildren: FamilyMember[] = life.childrenBorn.map((year, index) => ({
    id: asNpcId(`npc:${heir.id}:child:${index}`),
    role: 'child' as const,
    firstName: uniqueFirstName(
      state.rng.stream(RngDomains.Family),
      nameContext(state.nameCultureId, state.circle, state.family, heir.firstName),
      stableUnit(`${heir.id}:child:${index}:sex`) < 0.5 ? 'male' : 'female',
    ),
    lastName: heir.lastName,
    // Stable on the child's own id rather than drawn, for the same reason the
    // heir's stats are: backing out of the continuation and trying again must
    // not produce a different family.
    sex:
      stableUnit(`${heir.id}:child:${index}:sex`) < 0.5 ? ('male' as const) : ('female' as const),
    birthYear: year,
    alive: true,
    tier: 2,
    personality: heir.personality,
    relationship: clampStat(62),
    arrivedWhenPlayerWas: year - heir.birthYear,
    arrivedBy: 'birth' as const,
  }));

  const family: Household = {
    members: [deceased, ...grandchildren],
    finances: state.family.finances,
  };

  return createGameState(
    { year: state.world.year, generation: state.world.generation + 1 },
    player,
    state.rng,
    {
      family,
      nameCultureId: state.nameCultureId,
      finance,
      // Everything below starts empty ON PURPOSE. A cooldown belongs to the
      // person who used the event, a friend belongs to the person who made
      // them, and a body belongs to the person who lived in it.
      events: EMPTY_HISTORY,
      education: educationFrom(life),
      circle: EMPTY_CIRCLE,
      employment: EMPTY_EMPLOYMENT,
      health: { ...EMPTY_HEALTH, vitality: player.stats.health, deficit: 0 },
      /*
        Ticket 0506 — HEIRLOOMS ARE HANDED DOWN, NOT SOLD. A house and a car
        are sold and the money passes on; a watch, a ring or a painting is
        the thing somebody keeps. Spec 1281: "provenance can persist across
        generations". A non-cash gift, so no ledger row (spec 1848).
      */
      ...(inherited ? { businesses: inherited } : {}),
      ...(inheritedLoans && inheritedLoans.length > 0 ? { loans: inheritedLoans } : {}),
      valuables: state.valuables.map((owned) => ({
        ...owned,
        inheritedFrom: `${state.player.firstName} ${state.player.lastName}`,
      })),
      pending: [],
    },
  );
}
