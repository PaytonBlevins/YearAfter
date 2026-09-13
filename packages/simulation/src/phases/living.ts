/**
 * Ticket 0303 — the living phase. The ninth, and the first that bills.
 *
 * WHY THIS IS A PHASE AND NOT A LINE IN `employment.ts`
 *
 * Because it has to run for people who have no job. That is the entire defect
 * this ticket exists to fix: 0210 computed the cost of living inside
 * `payBreakdown`, so the only way to be charged for existing was to be paid,
 * and a character who never worked lived sixty years holding the same hundred
 * dollars. Measured, across 120 lives: 6,357 adult years with no job, none of
 * them costed.
 *
 * WHERE IT RUNS
 *
 * After employment, because the standard of living follows income and this year
 * is the income it should follow. Before the health phase, because 0303 gives
 * treatment a price and a character has to be able to be too poor for it.
 *
 * It posts no money itself. Like every phase since 0301 it RETURNS
 * `transactions` and `advanceYear` commits the year in one go — which is what
 * puts the cost of living after the year's pay in the posting order, so a
 * household is charged out of money it has actually been given.
 */

import { dollars } from '@yearafter/core';
import type { NewTransaction } from '@yearafter/finance';
import {
  SUBSISTENCE,
  creep,
  livingCostFor,
  standardTargetFor,
  type HouseholdFinances,
  type Housing,
} from '@yearafter/finance';
import type { TimelineKind } from '@yearafter/character';
import { stablePick, stableUnit } from '@yearafter/core';

/**
 * The age below which nobody is charged for anything.
 *
 * A child is not a household. They are a line in somebody else's — which is
 * exactly what `CHILD_SHARE` is, so charging them too would be CORE_RULES 13.8,
 * two systems billing one account, with the account being an eight-year-old.
 */
export const CHARGED_FROM_AGE = 18;

export interface LivingPhaseInput {
  readonly household: HouseholdFinances;
  readonly age: number;
  /** The city's cost index, from the location catalog. */
  readonly locationIndex: number;
  readonly partnered: boolean;
  /** The ages of dependent children at home. A teenager costs more (0304). */
  readonly childAges: readonly number[];
  /** After-tax income this year, whole dollars. Zero is an ordinary answer. */
  readonly afterTaxIncome: number;
  /** What they are holding, whole dollars. The wealth half of the creep. */
  readonly wealth: number;
  /**
   * Ticket 0308b. Credit the household could actually draw on, whole dollars.
   *
   * PART OF WHAT IS AFFORDABLE, and leaving it out was the bug behind
   * CORE_RULES 13.53. Hardship was tested against income plus CASH alone, so a
   * character with $200,000 of unused credit limit and an empty current account
   * was declared unable to pay the rent — the standard collapsed to
   * subsistence, the charge was capped at what they had, and they got a
   * discount on their own life. Real people put the rent on a card. Doing that
   * here also means the card draw in `advanceYear` finally sees the real number
   * rather than one already reduced to fit.
   */
  readonly credit: number;
  /**
   * Ticket 0308b. The portfolio, whole dollars.
   *
   * ILLIQUID IS NOT DESTITUTE, and telling them apart is the whole of
   * CORE_RULES 13.53's fix. The hardship cliff below caps a household's charge
   * at what it can pay, which is right for somebody who has nothing and was a
   * $430,000 subsidy for somebody with two million in an index fund and an
   * empty current account. Counting the portfolio means the second one is
   * charged in full, cannot cover it in cash, and meets the card draw and the
   * shortfall row like anybody else — and the way out is to SELL, which is the
   * liquidity decision this system was supposed to have all along.
   *
   * The genuinely broke character has a zero here and 0303's cliff is
   * untouched for them. That matters: the cliff exists because the first
   * version of this phase left a jobless character carrying unpayable bills
   * for 5,789 of 5,789 adult years, and widening it back to everybody would
   * rebuild exactly that.
   */
  readonly portfolio: number;
  /** What the job paid before tax this year, whole dollars. Zero if none. */
  readonly earned: number;
  /** The job's title, for the year's money line. Absent if not working. */
  readonly jobTitle?: string;
  /** Ticket 0209's eviction, which finally does something. */
  readonly toldToLeave: boolean;
  /** False once both parents are gone: there is no family home to live in. */
  readonly hasLivingParent: boolean;
}

export interface LivingPhaseOutput {
  readonly household: HouseholdFinances;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
  readonly transactions: readonly NewTransaction[];
  /** Whole dollars charged this year. Zero before 18. */
  readonly cost: number;
  /**
   * Ticket 0308b. The household could not pay for the life it was living.
   *
   * REPORTED, because for two milestones it was not. 0303 built the hardship
   * cliff as a local variable: the standard collapsed to subsistence, the
   * charge was capped at what there was, and nothing outside this function
   * ever found out. That made running out of money a way to make life CHEAPER
   * and nothing else — see CORE_RULES 13.53.
   */
  readonly hardship: boolean;
  /** How much of the year's cost could not be met, in whole dollars. */
  readonly unmet: number;
}

/* -------------------------------------------------------------------------- */
/* Moving out                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * When a character stops living with their parents.
 *
 * Deliberately not a button, and deliberately not an age. Spec 1126–1136's
 * Low-Friction Realism Test asks whether a decision is interesting; "do you
 * want to move out" is not, because the answer is yes as soon as it is
 * affordable and the player has nothing to weigh. So it happens TO them, for
 * reasons a person would recognise:
 *
 *   - they were told to go (0209),
 *   - there is nobody left to live with,
 *   - they started a family of their own,
 *   - or they can afford it, which is the ordinary route.
 *
 * The affordability rule uses a full year of the cost they would then be
 * paying, not a month: a character who moves out on exactly enough money is a
 * character who is in a shortfall by March, and a game that walks people into
 * that on its own is being unfair rather than realistic.
 */
export const MOVE_OUT_AGE = 18;
export const MOVE_OUT_COVER = 1.12;
/** Years before somebody who had to move home tries again. */
export const SETTLE_AFTER_MOVING_BACK = 2;

export function movesOut(input: LivingPhaseInput, ownPlaceCost: number): boolean {
  if (input.age < MOVE_OUT_AGE) return false;
  if (input.toldToLeave) return true;
  if (!input.hasLivingParent) return true;
  if (input.partnered || input.childAges.length > 0) return true;
  const movedBack = input.household.movedBackAt;
  if (movedBack !== undefined && input.age < movedBack + SETTLE_AFTER_MOVING_BACK) return false;
  /*
    INCOME, NOT INCOME PLUS SAVINGS — and the difference is a bug this ticket
    found by reading played lives rather than by any test.

    The first version asked whether income plus savings covered a year, and the
    model FLAPPED: 86 of 154 housing changes across ninety lives happened one
    year after the last one, and one character moved house fifteen times. The
    loop is easy to see once you have seen it. They move out on savings; the
    standard creeps up to their income; the year goes short; hardship moves them
    home and resets the standard to subsistence; subsistence is affordable, so
    they move straight back out.

    Savings can pay for a move. They cannot pay for a life — that is what income
    is for, and income is sticky where a balance is not. Testing against it
    gives the model the hysteresis it was missing, and the margin on top is the
    same idea again: somebody who can only just cover a year is somebody who
    will be short the first time anything happens.
  */
  return input.afterTaxIncome >= ownPlaceCost * MOVE_OUT_COVER;
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Moving out gets a line. A bill does not.
 *
 * The ONE thing this phase says out loud, and only on the year it happens.
 * Spec 21 forbids month-by-month accounting to the player and 0211b's whole
 * complaint was lines that summarise a year instead of naming something in it —
 * "Living took most of it" every year for forty years is both.
 *
 * The feed is where a life is remembered; the ledger is where the money is. A
 * player who wants the number taps the Career screen.
 */
const LEFT_HOME = [
  'Moved into your own place. It was small and it was yours.',
  'Got your own place. The first night was very quiet.',
  'Moved out. Took two trips in a borrowed car.',
  'Signed for somewhere of your own and felt the weight of it.',
  'Moved into a place of your own. Nothing in it matched.',
];
const PUT_OUT = [
  'Found somewhere of your own, faster than you wanted to.',
  'Moved out in a hurry and took what fit in the car.',
  'Got a place of your own because there was nowhere else to be.',
  "Moved out. It wasn't the year you had planned for it.",
];

const MOVED_BACK = [
  'Moved back in with your parents. Nobody said much about it, which was worse.',
  'Gave up the place and moved back home. The room was exactly as you left it.',
  'Went back to your parents for a while. A while turned out to be a long time.',
  "Couldn't make the rent. Moved back into your old room.",
];

export function runLiving(input: LivingPhaseInput): LivingPhaseOutput {
  const lines: { kind: TimelineKind; text: string }[] = [];
  const transactions: NewTransaction[] = [];

  if (input.age < CHARGED_FROM_AGE) {
    return { household: input.household, lines, transactions, cost: 0, hardship: false, unmet: 0 };
  }

  /*
    The standard moves FIRST, then the year is charged at the new one.

    The other order would give a character a year of living at their old
    standard on their new salary, which reads as a raise arriving a year late
    and, more to the point, would mean the year somebody loses their job is the
    year they are charged least. The lag that makes unemployment hurt is in
    `CREEP_DOWN`, not in the ordering.
  */
  /*
    Ticket 0308b: THE STANDARD TRACKS WHAT YOU ARE WORTH, NOT YOUR CURRENT
    ACCOUNT.

    Same bug as the affordability test below, in a second place, and it is what
    was left of CORE_RULES 13.53 after that one was fixed: the gap between an
    all-in investor's lifetime living cost and a saver's fell from $430,000 to
    $189,000 and stopped there, because `standardTargetFor` was still reading
    cash alone. A character with two million in an index fund was drifting
    toward the standard of somebody with nothing — living cheaply not because
    they were poor but because their money was in the wrong account.

    A millionaire lives like a millionaire wherever they keep it.
  */
  let standard = creep(
    input.household.standard,
    standardTargetFor(input.afterTaxIncome, input.wealth + input.portfolio),
  );

  const asIfAlone = livingCostFor({
    standard,
    locationIndex: input.locationIndex,
    partnered: input.partnered,
    childAges: input.childAges,
    housing: 'ownPlace',
  });

  const wasAtHome = input.household.housing === 'withFamily';
  let housing: Housing =
    wasAtHome && movesOut(input, asIfAlone.total) ? 'ownPlace' : input.household.housing;
  const moved = wasAtHome && housing === 'ownPlace';

  let cost = livingCostFor({
    standard,
    locationIndex: input.locationIndex,
    partnered: input.partnered,
    childAges: input.childAges,
    housing,
  });

  /*
    HARDSHIP. A household that cannot pay CONTRACTS — it does not run up sixty
    years of unpayable bills.

    TICKET 0308b WIDENED WHAT "CANNOT PAY" MEANS. It used to be tested against
    income plus cash, which made this branch fire for anybody who had moved
    their money somewhere that was not a current account — and firing it was a
    REWARD, because the charge is capped at what there is. Measured over 80
    paired lives: a character who invested every spare dollar spent $2,111,197
    on living across a lifetime against $2,541,128 for one who invested
    nothing. Being broke saved them $430,000 (CORE_RULES 13.53).

    Credit now counts. A household with an unused card is not destitute, it is
    about to be in debt, and the card draw in `advanceYear` charges them for it
    at up to 29%.

    This branch is here because the first version of this phase did exactly
    that. Measured across 110 lives: a player who never took a job was in
    shortfall in 5,789 of 5,789 adult years, and a player who worked at it was
    short in 18% of theirs and never climbed out, because a standard of living
    that only creeps DOWN at 12% a year cannot fall fast enough to matter. The
    ledger was honest and the life it described was nonsense: nobody carries an
    unpaid rent bill for four decades and stays where they are.

    What people actually do is move. The standard drops to subsistence at once
    rather than creeping, they go back to family if there is family to go back
    to, and if there is still not enough they live on what they have — which is
    a real thing a real person does and costs exactly what they have got.

    It is deliberately a CLIFF rather than a slope, and it is the one place in
    this model where something happens fast. `CREEP_DOWN` is slow because a
    comfortable life is sticky; this is not that. This is the lease ending.
  */
  const affordable = Math.max(
    0,
    input.afterTaxIncome + input.wealth + input.credit + input.portfolio,
  );
  const inHardship = cost.total > affordable;
  let movedHome = false;
  let unmet = 0;
  if (inHardship) {
    standard = SUBSISTENCE;
    /*
      Not in the same year they moved out.

      Found by reading a played life: a character forced out at eighteen — by a
      parent, or by both parents dying — could hit hardship in the very same
      year and move straight back, which printed "Moved out in a hurry" and then
      silently undid it, and printed "Moved out" again the year after. Somebody
      who has just carried their things across town does not carry them back in
      December. The standard still contracts; only the address holds still.
    */
    if (housing === 'ownPlace' && !moved && input.hasLivingParent && !input.partnered) {
      housing = 'withFamily';
      movedHome = true;
    }
    cost = livingCostFor({
      standard,
      locationIndex: input.locationIndex,
      partnered: input.partnered,
      childAges: input.childAges,
      housing,
    });
    // Still short after all of that: they get by on what there is. A charge for
    // money that does not exist is not a charge, it is a number the ledger
    // would have to carry forever with nothing behind it.
    if (cost.total > affordable) {
      unmet = cost.total - affordable;
      cost = { ...cost, total: affordable };
    }
  }

  /*
    The year's money line, which used to be written by the employment phase.

    It moved here because it was always a sentence with two halves — "Made
    $43,297. Living took most of it and left $2,737" names a wage and then a
    household — and after 0303 the employment phase only knows the first half.

    The unemployed case is new copy rather than silence. A character with no
    income is now being charged for a roof, and a feed that said nothing at all
    about a year they went four thousand dollars backwards would be the game
    hiding the only thing that happened.
  */
  const left = input.afterTaxIncome - cost.total;
  if (input.jobTitle !== undefined) {
    lines.push({
      kind: 'career',
      text: payLine(input.jobTitle, input.earned, left, input.childAges.length > 0, input.age),
    });
  } else if (cost.total > 0 && input.age >= CHARGED_FROM_AGE) {
    lines.push({ kind: 'career', text: noIncomeLine(cost.total, input.wealth, input.age) });
  }

  if (moved) {
    // Stable draw, so the line does not change when an unrelated system spends
    // randomness (CORE_RULES 13.22 — the base holds still, age does the moving).
    const set = input.toldToLeave ? PUT_OUT : LEFT_HOME;
    lines.push({
      kind: 'relationship',
      text: stablePick(set, `left-home:${input.age}`) ?? set[0]!,
    });
  } else if (movedHome) {
    lines.push({
      kind: 'relationship',
      text: stablePick(MOVED_BACK, `moved-back:${input.age}`) ?? MOVED_BACK[0]!,
    });
  }

  if (cost.total > 0) {
    transactions.push({
      category: 'living',
      amount: dollars(-cost.total),
      source: sourceFor(input, housing),
    });
  }

  return {
    household: {
      standard,
      housing,
      /*
        `leftHomeAt` is HISTORY and is never unset. The first draft rebuilt the
        household object from scratch each year and dropped it the moment
        somebody moved back in, which quietly erased the age they left home —
        a field 0305 is going to want, and the kind of loss that would have
        shown up as a blank on a screen two tickets from now with nothing left
        to reconstruct it from.
      */
      ...(housing === 'ownPlace'
        ? { leftHomeAt: input.household.leftHomeAt ?? input.age }
        : input.household.leftHomeAt !== undefined
          ? { leftHomeAt: input.household.leftHomeAt }
          : {}),
      ...(movedHome
        ? { movedBackAt: input.age }
        : input.household.movedBackAt !== undefined
          ? { movedBackAt: input.household.movedBackAt }
          : {}),
    },
    lines,
    transactions,
    cost: cost.total,
    hardship: inHardship,
    unmet,
  };
}

/**
 * What the ledger row says this was.
 *
 * CORE_RULES 13.6 — every movement names its source — and the ledger is the one
 * place in the build that is allowed to be this specific, because spec 21 keeps
 * it on the backend for exactly this: correctness and QA.
 */
function sourceFor(input: LivingPhaseInput, housing: Housing): string {
  if (housing === 'withFamily') return 'Living costs, at home';
  const people = 1 + (input.partnered ? 1 : 0) + input.childAges.length;
  return people > 1 ? `Living costs, ${people} in the household` : 'Living costs';
}

/* -------------------------------------------------------------------------- */
/* The year's money, in one sentence                                           */
/* -------------------------------------------------------------------------- */

/**
 * Repeatable copy needs more lines than repeats, and a stable index (13.17).
 *
 * These are read EVERY YEAR for sixty years, which makes them the most-repeated
 * copy in the game by a wide margin. So there are five shapes rather than one
 * with a number swapped in, and which shape fires depends on how the year
 * actually went: comfortable, tight, backwards, with a family, or with nothing
 * coming in at all.
 *
 * The base holds still for the life and age does the moving (CORE_RULES 13.22).
 */
function pick(lines: readonly string[], key: string, age: number): string {
  const base = Math.floor(stableUnit(key) * lines.length);
  return lines[(base + age) % lines.length] as string;
}

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

function payLine(
  jobTitle: string,
  earned: number,
  left: number,
  hasFamily: boolean,
  age: number,
): string {
  const job = jobTitle.toLowerCase();
  if (left < 0) {
    return pick(BEHIND_LINES, `pay:${jobTitle}:behind`, age)
      .replace(/\{earned\}/g, money(earned))
      .replace(/\{short\}/g, money(-left))
      .replace(/\{job\}/g, job);
  }
  /*
    Exactly nothing left is its own year, and it needs its own sentence.

    The tight set was written for "$300 left, which isn't much" and reads
    terribly at zero — "Broke about even, and $0 is what even looks like" —
    which is what the careers invariant test caught the first time this ran.
    Zero is common since 0303: a household in hardship spends what it has, to
    the dollar, so the year ends on precisely nothing rather than near it.
  */
  if (left === 0) {
    return pick(NOTHING_SPARE, `pay:${jobTitle}:zero`, age)
      .replace(/\{earned\}/g, money(earned))
      .replace(/\{job\}/g, job);
  }
  if (left < earned * 0.04) {
    return pick(TIGHT_LINES, `pay:${jobTitle}:tight`, age)
      .replace(/\{earned\}/g, money(earned))
      .replace(/\{saved\}/g, money(left))
      .replace(/\{job\}/g, job);
  }
  return pick(hasFamily ? FAMILY_LINES : FINE_LINES, `pay:${jobTitle}`, age)
    .replace(/\{earned\}/g, money(earned))
    .replace(/\{saved\}/g, money(left))
    .replace(/\{job\}/g, job);
}

const FINE_LINES: readonly string[] = [
  'Earned {earned} and had {saved} of it left at the end.',
  'Made {earned} this year and put {saved} away.',
  '{earned} for the year. {saved} still there in December.',
  'The job paid {earned}. You put {saved} aside without really trying.',
  'Made {earned}. Living took most of it and left {saved}.',
];

const FAMILY_LINES: readonly string[] = [
  'Earned {earned}. After everybody was fed and covered, {saved} was left.',
  '{earned} for the year, and {saved} of it survived the household.',
  'The job paid {earned}. {saved} of that was still yours by December.',
  'Made {earned}. The family took what it takes; {saved} stayed put.',
];

const TIGHT_LINES: readonly string[] = [
  "Earned {earned} and finished the year {saved} up, which isn't much.",
  '{earned} came in and almost exactly {earned} went out. {saved} left.',
  'A year of it for {earned}, and {saved} to show for it.',
  'Made {earned}. Broke about even, and {saved} is what even looks like.',
];

const NOTHING_SPARE: readonly string[] = [
  'Earned {earned} and every dollar of it was spoken for.',
  '{earned} came in and {earned} went out. Nothing spare at all.',
  'Made {earned}. The year took all of it.',
  'A year of {job} work for {earned}, and not a dollar of it left over.',
  'Earned {earned}. Nothing left by December, and nothing owed either.',
];

const BEHIND_LINES: readonly string[] = [
  'Earned {earned} and still went {short} backwards over the year.',
  "{earned} wasn't enough. The year ended {short} down.",
  'Worked all year for {earned} and finished {short} worse off.',
  "The {job} money didn't cover it. Down {short} by December.",
];

/**
 * A year with nothing coming in.
 *
 * Two sets, because running down savings and having nothing left are different
 * years and a player can tell. Before 0303 neither of them existed, because
 * neither of them cost anything.
 */
const BURNING_SAVINGS: readonly string[] = [
  'No work all year. {cost} went out and nothing came in.',
  'Nothing coming in. The year cost {cost} and savings covered it.',
  'A year without a job. {cost} out of the account, and the account noticed.',
  'No income at all. {cost} of living came out of what you had put by.',
];

const NOTHING_LEFT: readonly string[] = [
  'No work and nothing put by. {cost} of bills and no way to meet them.',
  'Nothing came in, {cost} went out, and there was nothing behind it.',
  'A year with no job and no cushion. {cost} owed and none of it paid.',
  "No income and no savings. The {cost} it costs to live simply didn't get paid.",
];

const noIncomeLine = (cost: number, wealth: number, age: number): string =>
  pick(wealth >= cost ? BURNING_SAVINGS : NOTHING_LEFT, 'no-income', age).replace(
    /\{cost\}/g,
    money(cost),
  );
