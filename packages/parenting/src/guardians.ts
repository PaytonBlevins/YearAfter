/**
 * Ticket 0209 — NPC parent autonomy: the player as the child.
 *
 * The exact mirror of the rest of this package, and spec 61 is explicit that the
 * asymmetry is deliberate. Everything it removed from the player-as-parent —
 * paying for activities, funding college, buying a vehicle, providing housing,
 * refusing assistance, discipline, kicking out — "remain possible for NPC
 * parents when the player is the child", and spec 1197 lists what decides them:
 * personality, finances, generosity, culture and circumstances.
 *
 * So the player's own parents are not a wallet with a relationship bar. They are
 * two people with opinions who may say no, and who do things nobody asked them
 * to. The player's only verb is ASKING; the answer is theirs.
 *
 * THE NUMBERS HERE WERE MEASURED BEFORE THEY WERE SET, which is CORE_RULES 13.7
 * and 13.21 and is the third attempt at learning it. Across 3,000 generated
 * families:
 *
 *   parent generosity   min 12, p25 33, median 53, p75 73, max 92
 *   starting warmth     p10 64, median 74, p90 83 — high and narrow at birth,
 *                       and only becomes a real input as a childhood drifts it
 *   household income    p10 $28k, median $95k, p90 $253k
 *   wealth bands        struggling 16%, modest 32%, comfortable 31%,
 *                       affluent 15%, wealthy 6%
 *   30% single-parent, and nobody starts with no living parent at all
 *
 * Generosity is the widest of those and therefore does the most work. Warmth is
 * a modifier rather than a gate, because at birth it barely varies.
 *
 * What the tuned model produces. Harness, stated so it can be re-run: 400
 * childhoods played to twenty-two, asking every request the age allows, once a
 * year, of the more generous living parent — the worst case for volume and
 * therefore the honest one.
 *
 *   ask                  overall   struggling -> wealthy
 *   pocket money           79%       81% -> 88%
 *   a ride                 83%       84% -> 92%
 *   pay for something      70%       66% -> 81%
 *   buy me a car           37%       27% -> 56%
 *   help with college      39%       28% -> 67%
 *   let me stay longer     72%       72% -> 92%
 *
 * The shape that matters: money moves the answer most where the most money is
 * involved. A car and college swing twenty-nine and thirty-nine points across
 * the bands. A ride and a place to stay cost nothing and CANNOT be moved by the
 * household's finances at all -- their spread is the generosity of the parents
 * wealthy families happen to have, which is a correlation in family generation
 * rather than anything this file does.
 *
 * Nothing ever closes: the floor is 4% and the ceiling 94%, so a struggling
 * family can still find college money and a wealthy one can still say no.
 */

import type { Personality } from '@yearafter/character';
import type { FamilyMember, Household } from '@yearafter/relationships';

/* -------------------------------------------------------------------------- */
/* What the player can ask for                                                 */
/* -------------------------------------------------------------------------- */

export type RequestId =
  'pocket-money' | 'pay-for-it' | 'a-lift' | 'a-car' | 'help-with-college' | 'stay-a-while';

export interface ParentRequest {
  readonly id: RequestId;
  readonly label: string;
  readonly blurb: string;
  readonly minAge: number;
  readonly maxAge?: number;
  /** Whole dollars the household would be out. Zero for things that cost time. */
  readonly cost: number;
  /**
   * Added per year of age above `minAge`.
   *
   * Reading a played childhood found a six-year-old and a sixteen-year-old both
   * handed exactly $25, and a school trip that cost $300 at eight and $300 at
   * seventeen. A number that never moves is decoration — the player reads it
   * once and stops reading it, which is CORE_RULES 13.6 losing by a different
   * route than usual. What a child asks for grows with the child.
   */
  readonly costPerYear?: number;
  /**
   * For the big ones: what they give is a share of the year, not a fixed sum.
   *
   * Measured, and this is CORE_RULES 13.16 in a third place. Priced flat at
   * $12,000, help with college came out at 4% for struggling AND modest
   * families — 48% of every family in the game — because $12,000 against the
   * p10 income of $28k pins the strain term at its cap and nothing else can
   * move it. A life fork that half the population has a 4% chance at is not a
   * fork.
   *
   * Parents give what they can. A struggling family finds two thousand and an
   * affluent one finds twenty, and in both cases the interesting question is
   * whether they WANT to — which is generosity, the widest input there is.
   */
  readonly costShare?: number;
  readonly costFloor?: number;
  readonly costCap?: number;
  /** Before who they are. Tuned against the measurements above. */
  readonly base: number;
  /**
   * Heavy requests are once a year per parent. Asking your mother for a car in
   * March and your father in April is a thing children do, and the model allows
   * it — asking the same parent twice is not.
   */
  readonly weight: 'light' | 'heavy';
  /**
   * Once you have it, you stop asking.
   *
   * Reading 70 childhoods found a player asking for a car every year from
   * sixteen and being given one five times, and the same for college. A refusal
   * can be asked again next year — that is a child, and it is true. Being given
   * the thing twice is the game forgetting.
   */
  readonly oncePerLife?: boolean;
}

export const PARENT_REQUESTS: readonly ParentRequest[] = [
  {
    id: 'pocket-money',
    label: 'Ask for some money',
    blurb: 'Not for anything in particular.',
    minAge: 6,
    maxAge: 17,
    // $6 at six, $39 at seventeen. Both small enough that the household's
    // finances still do not touch the answer, which is the shape measured and
    // wanted: whether your parents hand you a few dollars is about them.
    cost: 6,
    costPerYear: 3,
    base: 0.64,
    weight: 'light',
  },
  {
    id: 'a-lift',
    label: 'Ask for a ride',
    blurb: 'It means giving up their evening.',
    minAge: 8,
    maxAge: 17,
    cost: 0,
    base: 0.7,
    weight: 'light',
  },
  {
    id: 'pay-for-it',
    label: 'Ask them to pay for something',
    blurb: 'The trip, the kit, the thing you need.',
    minAge: 8,
    maxAge: 17,
    // $90 at eight and $360 at seventeen. The eight-year-old's is a school trip
    // and the seventeen-year-old's is a laptop, and the household should feel
    // the difference between them rather than being asked the same question for
    // a decade.
    cost: 90,
    costPerYear: 30,
    base: 0.58,
    weight: 'heavy',
  },
  {
    id: 'a-car',
    label: 'Ask them to buy you a car',
    blurb: 'Nothing fancy. Something that runs.',
    minAge: 16,
    maxAge: 20,
    cost: 4_000,
    costShare: 0.035,
    costFloor: 700,
    costCap: 9_000,
    base: 0.34,
    weight: 'heavy',
    oncePerLife: true,
  },
  {
    id: 'help-with-college',
    label: 'Ask them to help with college',
    blurb: 'It decides the next four years.',
    minAge: 17,
    maxAge: 24,
    cost: 12_000,
    // Seven per cent of a year, floored and capped. Fourteen was measured and
    // rejected: it is more than most families give and it flattened the whole
    // request into "no" for everybody but the wealthy.
    costShare: 0.07,
    costFloor: 800,
    costCap: 25_000,
    base: 0.48,
    weight: 'heavy',
    oncePerLife: true,
  },
  {
    id: 'stay-a-while',
    label: 'Ask to stay a while longer',
    blurb: "You are grown and you aren't ready.",
    minAge: 18,
    cost: 0,
    base: 0.55,
    weight: 'heavy',
  },
];

export const requestsAt = (age: number): readonly ParentRequest[] =>
  PARENT_REQUESTS.filter(
    (request) => age >= request.minAge && (request.maxAge === undefined || age <= request.maxAge),
  );

export const findRequest = (id: string): ParentRequest | undefined =>
  PARENT_REQUESTS.find((request) => request.id === id);

/* -------------------------------------------------------------------------- */
/* Whether they say yes                                                        */
/* -------------------------------------------------------------------------- */

/**
 * How much of the household's year this would cost.
 *
 * The reason a car is a different question in a struggling family and an
 * affluent one, without needing a wealth-band lookup table: $4,000 against the
 * p10 income of $28k is a seventh of the year, and against the p90 of $253k it
 * is a rounding error. That IS the difference, and expressing it as a ratio
 * means it keeps working when incomes change.
 */
export function strain(cost: number, household: Household): number {
  const income = Number(household.finances.annualIncome) / 100;
  if (cost <= 0) return 0;
  if (income <= 0) return 1;
  return cost / income;
}

/**
 * What this household would actually put in, in whole dollars.
 *
 * A flat price for a request with a `costShare` is the headline number, not
 * what changes hands. See `costShare` for the measurement that forced this.
 */
/**
 * The headline price of this request at this age. See `costPerYear`.
 *
 * Age defaults to `minAge` so a caller that has no age in hand — a test, a
 * balance sweep — gets the youngest version rather than a thrown error.
 */
export const costAt = (request: ParentRequest, age = request.minAge): number =>
  request.cost + (request.costPerYear ?? 0) * Math.max(0, age - request.minAge);

export function costFor(request: ParentRequest, household: Household, age?: number): number {
  if (request.costShare === undefined) return costAt(request, age);
  const income = Number(household.finances.annualIncome) / 100;
  const share = income * request.costShare;
  return Math.round(Math.min(request.costCap ?? share, Math.max(request.costFloor ?? 0, share)));
}

/**
 * How hard a FLAT cost weighs on the answer.
 *
 * Large because the ratios are small. Measured at 3.2, a $300 school trip came
 * out at 50% for a struggling family and 53% for a wealthy one — the most
 * common ask in the game, and the household's finances did not touch it. Three
 * hundred dollars against the p10 income of $28,000 is a real conversation and
 * against $253,000 it is not, and the model has to say so.
 */
export const STRAIN_WEIGHT = 18;
export const STRAIN_CAP = 0.62;

/**
 * The median household income the share-based requests are judged against.
 *
 * Measured across 3,000 families: p10 $28k, median $95k, p90 $253k.
 */
export const REFERENCE_INCOME = 95_000;

/**
 * How much a share-based request weighs, which is NOT the same question.
 *
 * A flat cost divided by income answers "can they afford it". A cost that is
 * already a share of income has answered that — so applying the same term twice
 * double-counts, and measuring caught it: help with college sat at 7-9% for
 * every band below wealthy, because a 14% share pinned the penalty at 0.45 and
 * nothing generosity could do reached it.
 *
 * What is left to model is that the SAME share hurts a poorer family more.
 * Fourteen per cent of $28,000 and of $253,000 are both fourteen per cent, and
 * only one of them still leaves the rent paid. So the weight scales with how
 * far below the reference income the household is.
 */
export const SHARE_WEIGHT = 1.2;

/**
 * Whether this parent says yes, as a probability.
 *
 * Three inputs, in the order spec 1197 lists them: who they are (generosity,
 * and a little of their temper), what they can afford (strain), and how the two
 * of you stand (warmth). Generosity does the most work because it is the widest
 * of the three — measured p25 33 against p75 73, where warmth at birth runs 69
 * to 79 and only spreads out as a childhood goes on.
 */
export function willThey(
  request: ParentRequest,
  parent: FamilyMember,
  household: Household,
  behaviour = 50,
  age?: number,
): number {
  const generosity = (parent.personality.generosity - 50) / 50; // -1 .. 1
  const warmth = (parent.relationship - 70) / 30; // roughly -1 .. 1
  // A short-tempered parent is a harder ask on the day, whatever they can afford.
  const temper = (parent.personality.temper - 50) / 50;
  // How you have been. Behaviour is the school-standing field events already
  // move, so a child who has been in trouble all year asks from further back.
  const standing = (behaviour - 50) / 50;

  const money = Math.min(STRAIN_CAP, moneyWeight(request, household, age));

  const chance =
    request.base + generosity * 0.3 + warmth * 0.16 + standing * 0.1 - temper * 0.08 - money;

  // Never certain in either direction. A parent who always says yes is a
  // vending machine, and one who never does is a wall the player learns to
  // stop pressing.
  return chance < 0.04 ? 0.04 : chance > 0.94 ? 0.94 : chance;
}

/**
 * What the money side of this request costs the answer.
 *
 * Two different questions depending on how the request is priced. See
 * `SHARE_WEIGHT` for why they cannot share a formula.
 */
export function moneyWeight(request: ParentRequest, household: Household, age?: number): number {
  if (request.costShare === undefined) {
    return strain(costAt(request, age), household) * STRAIN_WEIGHT;
  }
  const income = Number(household.finances.annualIncome) / 100;
  const bite = income > 0 ? REFERENCE_INCOME / income : 4;
  return request.costShare * Math.min(4, bite) * SHARE_WEIGHT;
}

/**
 * The odds in words, for the row the player reads before they ask.
 *
 * Deliberately vaguer than the friendship menu's, because a child does not have
 * a calibrated model of their own parents — they have a feeling about how this
 * usually goes.
 */
export function moodLabel(chance: number): string {
  if (chance >= 0.75) return 'Probably';
  if (chance >= 0.5) return 'Maybe';
  if (chance >= 0.28) return 'Unlikely';
  return 'Long shot';
}

/* -------------------------------------------------------------------------- */
/* What they do without being asked                                            */
/* -------------------------------------------------------------------------- */

/**
 * Spec 61's asymmetry, and the half that makes parents people rather than a
 * menu: they act on their own.
 *
 * All of these are things the player cannot trigger and does not get a say in,
 * which is the point — being a child is largely being on the receiving end of
 * other people's decisions.
 */
export type ParentActId =
  /**
   * Ticket 0210b. Offering to put you through college, unasked.
   *
   * Spec 1197: NPC parents "may independently pay for or deny activities, buy a
   * vehicle, provide housing, FUND COLLEGE, give or refuse money". Measured, it
   * had to exist: a player who simply pressed "apply to college" at eighteen
   * without knowing to ask their parents first got "You cannot cover the first
   * year" and NOTHING ELSE, every time, in 200 of 200 lives. A path whose only
   * entrance is a menu the player has not thought to open is not a path.
   */
  | 'paid-for-college'
  | 'bought-you-something'
  | 'paid-for-it-anyway'
  | 'grounded-you'
  | 'sat-you-down'
  | 'could-not-afford-it'
  | 'kicked-you-out';

export interface ParentAct {
  readonly id: ParentActId;
  readonly minAge: number;
  readonly maxAge?: number;
  /** Base chance in a year, before who they are. */
  readonly base: number;
  /** Needs the player to have been in trouble. */
  readonly needsTrouble?: boolean;
  /** Generous parents do this more; mean ones less. Signed. */
  readonly generosityPull: number;
}

/** Below this school standing, a parent has something to be cross about. */
export const IN_TROUBLE = 42;

export const PARENT_ACTS: readonly ParentAct[] = [
  // Narrow window on purpose: this is the conversation that happens the year
  // somebody finishes school, and it does not happen twice.
  { id: 'paid-for-college', minAge: 17, maxAge: 19, base: 0.34, generosityPull: 0.22 },
  { id: 'bought-you-something', minAge: 4, maxAge: 17, base: 0.12, generosityPull: 0.14 },
  { id: 'paid-for-it-anyway', minAge: 8, maxAge: 17, base: 0.08, generosityPull: 0.12 },
  {
    id: 'grounded-you',
    minAge: 8,
    maxAge: 17,
    base: 0.34,
    needsTrouble: true,
    generosityPull: -0.08,
  },
  {
    id: 'sat-you-down',
    minAge: 10,
    maxAge: 17,
    base: 0.26,
    needsTrouble: true,
    generosityPull: 0.06,
  },
  { id: 'could-not-afford-it', minAge: 6, maxAge: 17, base: 0.1, generosityPull: -0.04 },
  {
    // Spec 61 gives this to NPC parents explicitly. Adults only, and rare —
    // it is the single harshest thing that can happen to a player here.
    id: 'kicked-you-out',
    minAge: 18,
    // Measured at 0.06 and rejected: 7.3% a year compounds to roughly two
    // players in five being thrown out by twenty-four, for the harshest thing
    // in the game. It should be something that happens to somebody, not
    // something that happens to everybody eventually.
    base: 0.02,
    generosityPull: -0.18,
  },
];

export function actChance(
  act: ParentAct,
  parent: FamilyMember,
  household: Household,
  behaviour: number,
): number {
  if (act.needsTrouble && behaviour >= IN_TROUBLE) return 0;

  const generosity = (parent.personality.generosity - 50) / 50;
  const warmth = (parent.relationship - 70) / 30;
  let chance = act.base + generosity * act.generosityPull;

  // A parent who can barely pay the rent buys fewer surprises and has to say
  // "we cannot afford it" more often. Both directions from one fact.
  const band = household.finances.band;
  const tight = band === 'struggling' || band === 'modest';
  if (act.id === 'bought-you-something' || act.id === 'paid-for-it-anyway') {
    chance *= tight ? 0.55 : band === 'wealthy' ? 1.5 : 1;
  }
  if (act.id === 'could-not-afford-it') chance *= tight ? 2.2 : band === 'wealthy' ? 0.15 : 0.7;

  // Nobody throws out a child they are close to on a whim.
  if (act.id === 'kicked-you-out') chance *= Math.max(0, 1 - Math.max(0, warmth) * 1.4);

  return Math.max(0, Math.min(0.75, chance));
}

/* -------------------------------------------------------------------------- */
/* Who is asked                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The parent a child would actually go to.
 *
 * Not "the mother" and not a random pick: children learn quickly which parent
 * says yes to what, and going to the softer one is the oldest strategy there
 * is. The player still chooses on screen — this is the default the list is
 * ordered by, and the one a simulated life uses.
 */
export function likeliestYes(
  request: ParentRequest,
  living: readonly FamilyMember[],
  household: Household,
  behaviour = 50,
): FamilyMember | undefined {
  let best: FamilyMember | undefined;
  let bestChance = -1;
  for (const parent of living) {
    const chance = willThey(request, parent, household, behaviour);
    if (chance > bestChance) {
      bestChance = chance;
      best = parent;
    }
  }
  return best;
}

export type { Personality };
