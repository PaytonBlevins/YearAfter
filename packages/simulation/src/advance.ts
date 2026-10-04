/**
 * Ticket 0105 — Advance.
 *
 * PROTECTED CONTRACT (spec 1060–1066): time advancement.
 *
 * One player-facing turn is one year (spec 1108–1140). The loop is
 * calculate → validate → commit, in memory, atomically: nothing is written into
 * the returned state until the whole year has been computed, so a thrown error
 * leaves the previous state untouched rather than half-aged.
 *
 * SCOPE — the systems that hang off this loop arrive on their own tickets, and
 * each one plugs in as a phase module under `phases/`:
 *   0203  childhood event library         -> DONE, phases/events.ts
 *   0204  school progression              -> DONE, phases/education.ts
 *   0205  stress from hidden capacity     -> DONE, phases/stress.ts
 *   0206  friends, classmates, teachers   -> DONE, phases/social.ts
 *   0208  children                        -> DONE, phases/family.ts
 *   0210  employment                      -> DONE, phases/employment.ts
 *   0211  aging, health, mortality        -> DONE, phases/health.ts
 *   0301  financial ledger                -> DONE, money.ts + @yearafter/finance
 *   0303  living expenses                 -> DONE, phases/living.ts
 * Do not grow this file with inline system logic — add a phase module.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type Character,
  type LifeRecord,
  type TimelineEntry,
  type TimelineKind,
} from '@yearafter/character';
import { asEventId, clampStat, dollars } from '@yearafter/core';
import { nudgeStats } from '@yearafter/character';
import type { GameState } from './game-state';
import { isInSchool } from '@yearafter/education';
import { occupationFor, runEducation } from './phases/education';
import { findJob } from '@yearafter/careers';
import { runEmployment } from './phases/employment';
import { withAnyOffer } from './offers';
import { withCollegeOffer } from './college-offer';
import { withLifeOffer } from './life-offer';
import { runEvents } from './phases/events';
import { householdPartnerOf, partnerOf } from '@yearafter/social';
import { livingParents } from '@yearafter/relationships';
import { childrenAtHome } from '@yearafter/parenting';
import { runFamily } from './phases/family';
import { postYear } from './money';
import {
  drawFrom,
  drawableOn,
  findProduct,
  portfolioWorth,
  reconcile,
  reconcileByYear,
  runCardYear,
  runLoanYear,
  nextMarketState,
  advisorFee,
  benefitFor,
  contributeYear,
  drawYear,
  findAdvisor,
  growYear,
  serveYear,
  runHoldingYear,
  runPriceYear,
  yearsOutside,
  type NewTransaction,
  OWNER_SHARE,
} from '@yearafter/finance';
import { runKin } from './phases/kin';
import { runLiving } from './phases/living';
import { partnerIncomeFor } from './phases/partner';
import { runSocial } from './phases/social';
import { runHealth } from './phases/health';
import { runStress } from './phases/stress';
import { lifeShaping, strained } from './shaping';
import { runPursuitYear } from './pursuits';
import { withPursuitOffer } from './pursuit-offer';
import { foreclose, markMissed, runHomesYear, withHomeOffer } from './homes';
import { markVehiclesMissed, repossess, runVehiclesYear, withVehicleOffer } from './vehicles';
import { withRenovationOffer } from './renovations';
import { runValuablesYear } from './shopping';
import { averageStat, businessTaxOn, runBusinessesYear } from './businesses';
import { runDealsYear } from './deals';
import { foundOut } from './auctions';
import { residenceOf } from './rentals';
import { INSTRUMENTS, SECTORS, costIndexOf, findActivity } from '@yearafter/content';
import { nameContext, uniqueFirstName } from './social-generator';
import { RngDomains } from './rng/rng';

export interface AdvanceResult {
  readonly state: GameState;
  /** Entries produced by this year only — what the Life screen animates in. */
  readonly newEntries: readonly TimelineEntry[];
}

/**
 * Advance the simulation by one year.
 *
 * Pure with respect to `state`: the input is never mutated. The RNG registry is
 * shared by reference and does advance, which is intended — a turn consumes
 * randomness, and the save records the resulting stream state.
 */
/*
  `earnedThisYear` used to live here.

  It took the year's gifts and the year's savings, added them to cash, and
  floored the result at zero — and its own comment said the floor was "a rule
  rather than an arithmetic detail" and that a reader looking for "can this go
  negative" should find one place that answers it. That instinct was right and
  the scope was too small: there were five OTHER places that moved money, each
  with its own arithmetic and its own idea of the floor.

  Ticket 0301 made the ledger that one place. `post` applies the floor, records
  what could not be paid, and is the only function in the build that can change
  a balance.
*/

/**
 * What the ledger row for a card advance says.
 *
 * CORE_RULES 13.6 — every movement names its source — and "Put on the Everyday
 * Cash card" is a sentence a player recognises where "debt" is not. Two or more
 * cards say so by count rather than by list, because a row naming four products
 * is a paragraph in a column.
 */
function cardSource(onto: readonly string[]): string {
  const names = [...new Set(onto)].map((id) => findProduct(id)?.name ?? 'a card');
  if (names.length === 1) return `Put on the ${names[0]} card`;
  return `Put on ${names.length} cards`;
}

const currentJobTitle = (state: GameState): string | undefined =>
  state.employment.job ? findJob(state.employment.job.jobId)?.title : undefined;

/**
 * The benefit a retired character's pension is reckoned against.
 *
 * Once somebody stops working there is no current job to read a template from,
 * and a pension earned over thirty years must not vanish the day it starts
 * paying. So the most recent PENSIONABLE job in their history is what answers,
 * and a character who never held one gets nothing — which is correct, and is
 * why `serviceYears` is zero for them anyway.
 */
function pensionableBenefit(state: GameState) {
  for (const past of [...state.employment.history].reverse()) {
    const job = findJob(past.jobId);
    const benefit = job ? benefitFor(job.template) : undefined;
    if (benefit && benefit.pensionPerYear > 0) return benefit;
  }
  return undefined;
}

export function advanceYear(state: GameState): AdvanceResult {
  if (!state.player.alive) {
    return { state, newEntries: [] };
  }
  // A pending question blocks time. Advancing past an unanswered decision would
  // either discard it or answer it on the player's behalf, and both are worse
  // than refusing. The UI keeps the Advance control disabled while this holds.
  if (state.pending.length > 0) {
    return { state, newEntries: [] };
  }

  // ---- calculate ---------------------------------------------------------
  const nextAge = state.player.age + 1;
  const nextYear = state.world.year + 1;

  /*
    Ticket 0212. Kin FIRST, and it is the only phase that was ever prepended.
    Every other one was appended because it depended on what came before it;
    this one goes first because it is the only phase that changes WHO EXISTS.
    Run it last and somebody who died in January would still have been flirted
    with, named by an event and promoted alongside the player, and would then
    stop existing at the bottom of the same year.
  */
  /*
    The kin phase needs a name source for the partner a child brings home, and
    it has to come from the FAMILY's naming tradition rather than a global pool
    — a grandchild called Beatriz in a household of Nakamuras is the same defect
    0201 built `nameCultureId` to prevent. Drawn from the Family stream so it
    cannot shift the relationship draws that decide who dies.
  */
  const kinNames = state.rng.stream(RngDomains.Family);
  const kin = runKin({
    family: state.family,
    circle: state.circle,
    stream: state.rng.stream(RngDomains.Relationships),
    age: nextAge,
    worldYear: nextYear,
    nameFor: () =>
      uniqueFirstName(
        kinNames,
        nameContext(state.nameCultureId, state.circle, state.family, state.player.firstName),
        kinNames.chance(0.5) ? 'male' : 'female',
      ),
  });

  // Education next: an event that fires this year should be able to read the
  // grade the character is now in, and a report-card event that arrives before
  // the report card is nonsense.
  const schooled = runEducation(state, nextAge);

  /*
    Ticket 0416 — and then everything an adult is in, which the school year
    never plays. Folded into the education result rather than carried beside it
    because every reader downstream — the social phase's rooms and its "something
    you still do" door, the health phase's athletes, the stress phase's hours,
    the event context's activity count — already reads `education.education`,
    and has been reading an empty list for every adult since 0204. Reads LAST
    year's stress, because this year's has not been summarised yet.
  */
  const pursued = runPursuitYear({
    education: schooled.education,
    age: nextAge,
    stats: schooled.player.stats,
    talents: state.player.talents,
    standard: state.household.standard,
    strained: strained(state.player.stress.level),
    stream: state.rng.stream(RngDomains.Pursuits),
  });
  const education = {
    ...schooled,
    education: pursued.education,
    hours: schooled.hours + pursued.hours,
    lines: [
      ...schooled.lines,
      ...pursued.lines.map((text) => ({ kind: 'passive' as const, text })),
    ],
    transactions: [...schooled.transactions, ...pursued.transactions],
  };

  // Then the class. Before events, so an event that fires this year can name
  // somebody who is actually in it — which is the whole of Ticket 0206.
  const social = runSocial({
    circle: kin.circle,
    stream: state.rng.stream(RngDomains.Relationships),
    age: nextAge,
    worldYear: nextYear,
    nameCultureId: state.nameCultureId,
    firstName: state.player.firstName,
    charisma: education.player.stats.charisma,
    personality: education.player.personality,
    family: kin.family,
    education: education.education,
    previousStage: state.education.stage,
    // Ticket 0210. The job the character walks into on the FIRST of January,
    // not the one the employment phase may promote them into later — the
    // colleague they met this year was met at the desk they were sitting at.
    ...(currentJobTitle(state) !== undefined ? { jobTitle: currentJobTitle(state) } : {}),
    // Ticket 0211a. The crew belongs to the job, not to its title.
    ...(state.employment.job ? { jobId: state.employment.job.jobId } : {}),
  });

  // Then the family. After social, because a pregnancy needs to know who the
  // player is with and social is where a relationship can end; before events,
  // so an event this year can name a child who already exists (Ticket 0208).
  const partner = partnerOf(social.circle.people);
  const familyStream = state.rng.stream(RngDomains.Family);
  const names = nameContext(state.nameCultureId, social.circle, kin.family, state.player.firstName);
  const family = runFamily({
    family: kin.family,
    parenting: state.parenting,
    stream: familyStream,
    age: nextAge,
    worldYear: nextYear,
    personality: education.player.personality,
    ...(partner ? { partnerPersonality: partner.personality, partnerId: partner.id } : {}),
    playerLastName: state.player.lastName,
    behaviour: education.education.behaviour,
    // Ticket 0303. A parent can only put you out of a house you live in.
    livesWithParents: state.household.housing === 'withFamily',
    takenNames: names.taken,
    nameFor: (sex) => uniqueFirstName(familyStream, names, sex),
  });

  // Then work. After education, because leaving school is what makes somebody
  // available to work and the year they graduate they should be able to be
  // working; before events, so an event this year can fire at somebody with a
  // job; before stress, because the hours a job takes are part of the year
  // stress is about to summarise (Ticket 0210).
  const employment = runEmployment({
    employment: state.employment,
    stream: state.rng.stream(RngDomains.Careers),
    age: nextAge,
    worldYear: nextYear,
    family: family.family,
    discipline: education.player.stats.discipline,
    smarts: education.player.stats.smarts,
    charisma: education.player.stats.charisma,
  });

  /*
    Ticket 0411 — what the year's work did to them.

    Applied HERE rather than inside the phase, because a phase reports and
    `advanceYear` moves: the same contract `transactions` has had since 0301 and
    `phases/education.ts`'s own `statDeltas` has had since 0204. Through
    `nudgeStats`, so a working year travels the same 0203 curve every other stat
    change in the build does — full strength at 50, tapering to nothing at 100.
  */
  const worked: Character = {
    ...education.player,
    stats: nudgeStats(education.player.stats, employment.statDeltas),
  };

  /*
    Ticket 0303 — the living phase. Ninth, and placed here on purpose.

    AFTER employment, because the standard of living follows this year's income
    and the raise should be the one that just happened. BEFORE events, because
    an event that reads the player's cash should read it after the year's rent,
    not before — a character is not briefly rich in the window between being
    paid and paying for their life.

    The cost of being alive used to be computed inside `payBreakdown` and posted
    by the employment phase, which meant it could only ever be charged to
    somebody who was employed. Measured before this ticket: 6,357 adult years
    with no job, not one of them costed.
  */
  /*
    Ticket 0601. The economy's state for the year is drawn HERE, ahead of the
    homes and the businesses, because a business's custom follows it. It was
    drawn after the living phase and nothing between cared; the stream is its
    own domain, so the first draw is still the first draw and every life replays
    identically.
  */
  const marketRoll = state.rng.stream(RngDomains.Economy);
  const market = nextMarketState(state.market, marketRoll.next());
  /*
    Ticket 0501 — a year of every home they own. The market moves it, it gets a
    year older, and its upkeep and mortgage come due as COMMITTED outgoings,
    posted with the tax and the treatment rather than after the cards: a
    mortgage is paid before a credit card's minimum, the same order as rent.
  */
  const homesYear = runHomesYear(state.homes, nextYear, state.rng.getSeed());
  /*
    Ticket 0504 — a year of every car they own: wear, servicing and repairs,
    the loan payment. Committed outgoings like the mortgage, and the living
    phase fits the rest of the life around what they came to.
  */
  const vehiclesYear = runVehiclesYear(state.vehicles, nextYear, state.rng.getSeed());
  /*
    Ticket 0506 — what the collection is worth after the year. Ticket 0507 —
    and anything bought at a house that sold a fake is found out now.
  */
  const valuablesNext = runValuablesYear(state.valuables, nextYear, state.rng.getSeed());

  /*
    Ticket 0502 — what a partner brought home. After employment and before
    living, for the same reason the player's own pay is: the standard of living
    follows what the household actually has, and that is two incomes when
    there are two.
  */
  const childAgesAtHome = childrenAtHome(family.family, nextYear).map(
    (child) => nextYear - child.birthYear,
  );
  const partnered = partnerIncomeFor({
    people: social.circle.people,
    worldYear: nextYear,
    childAges: childAgesAtHome,
  });

  /*
    Ticket 0601 — a year of every business they own. After employment, because
    the tax on what a business pays its owner depends on what they were paid
    for working; BEFORE living, because the standard of living follows what the
    household actually has, and a business owner's household has the draw
    (CORE_RULES 13.90: when a new income reaches the household, every reader of
    income has to be told).
  */
  const businessesYear = runBusinessesYear({
    businesses: state.businesses,
    loans: state.loans,
    year: nextYear,
    seed: state.rng.getSeed(),
    market,
    available: Math.floor(Number(state.player.cash) / 100) + Math.floor(employment.takeHome * 0.5),
    holdsJob: employment.employment.job !== undefined,
    stat: (type) => averageStat(worked.stats as unknown as Record<string, number>, type),
  });
  const businessTax = businessTaxOn(employment.earned, businessesYear.drawn);
  // Ticket 0605. Interest, settlements and write-offs of private deals; the tax on what they earned.
  const dealsYear = runDealsYear({
    deals: state.deals,
    year: nextYear,
    market,
    otherIncome: employment.earned + businessesYear.drawn,
  });
  const businessNet = businessesYear.drawn - businessTax;

  const living = runLiving({
    household: state.household,
    age: nextAge,
    locationIndex: costIndexOf(state.player.currentLocation.cityId),
    /*
      Ticket 0502. Somebody they share a household with — not somebody they
      are only dating, who until this ticket cost half again as much as a
      household of one.
    */
    partnered: householdPartnerOf(social.circle.people) !== undefined,
    /*
      Ticket 0304. The AGES, not the count — a teenager costs more than a
      toddler, which is the one idea worth keeping out of `monthlyCostOf`.

      And `childrenAtHome`, not `livingChildren`. 0303 used the latter, which
      means "children who are alive" rather than "children you are supporting",
      and the difference showed up the moment 0304 printed the numbers a screen
      would render: a sixty-seven-year-old was being charged $1,117 a month for
      a thirty-eight-year-old son. A household's costs never fell after the
      children grew up, which is most of why a late career could not save.

      `childrenAtHome` is the function that has meant the right thing since
      0208 and draws the line at eighteen, the same place spec 61's kick-out
      does — so there is one definition of a dependent rather than two.
    */
    childAges: childAgesAtHome,
    // What the job left after tax. Zero for anybody not working, which is the
    // case this whole phase exists to make cost something. Ticket 0502: and
    // what the partner's did, because a household lives on both.
    afterTaxIncome: employment.takeHome + partnered.net + businessNet,
    wealth: Math.floor(Number(state.player.cash) / 100),
    /*
      Ticket 0308b. What the cards would actually lend, which is part of what a
      household can afford — see `credit` on the input. Frozen cards lend
      nothing, which `drawableOn` already knows.
    */
    credit: state.cards.reduce((sum, card) => sum + Math.floor(Number(drawableOn(card)) / 100), 0),
    // Ticket 0308b. What they hold in the market — see `portfolio` on the
    // input. Being illiquid is not the same as being destitute.
    portfolio: Math.floor(Number(portfolioWorth(state.prices, state.portfolio)) / 100),
    earned: employment.earned,
    ...(currentJobTitle({ ...state, employment: employment.employment }) !== undefined
      ? { jobTitle: currentJobTitle({ ...state, employment: employment.employment })! }
      : {}),
    toldToLeave: family.toldToLeave,
    hasLivingParent: livingParents(family.family).length > 0,
    // Ticket 0501. Somebody who owns a home lives in it; no one asks which.
    // Ticket 0503: a home, not a building they let or a house they rent out.
    ownsHome: residenceOf(state.homes) !== undefined,
    // And what it costs them this year, which the rest of the life fits around.
    // Only the one they live in: a rental's costs are the rental's, against its rent.
    housingCost: homesYear.residenceCost,
    // Ticket 0504. The cars, and whether there is one — owning one means the
    // living bill stops paying for getting about (`VEHICLE_SHARE`).
    vehicleCost: vehiclesYear.cost,
    ownsVehicle: state.vehicles.length > 0,
  });

  const events = runEvents(
    {
      ...state,
      player: worked,
      education: education.education,
      circle: social.circle,
      family: family.family,
      parenting: family.parenting,
      employment: employment.employment,
    },
    nextAge,
    nextYear,
    education.lines.length +
      social.lines.length +
      family.lines.length +
      employment.lines.length +
      living.lines.length,
  );

  // Stress last: it summarises the year rather than making things happen in it,
  // so it needs the workload education computed, the household events finished
  // moving, and the stress those events contributed.
  const stress = runStress({
    player: events.player,
    age: nextAge,
    family: events.family,
    education: { ...education.education, behaviour: clampStat(events.behaviour) },
    hours: education.hours,
    capacity: education.capacity,
    eventStress: events.stress,
    atSchool: isInSchool(education.education),
    // Spec 661: a job consumes hidden capacity, and nothing draws the player a
    // calendar. Working nights with three children is a way to have a bad year,
    // and they read about it afterwards rather than being warned.
    workDemand: employment.demand,
  });

  // Health LAST of all, and the order is argued in `phases/health.ts`: it needs
  // the year's job (for the injury roll), the year's events (which move health),
  // and the year's stress (which raises the illness roll) — and if it ends the
  // life, the year still has to be a complete year rather than a half-written
  // one. Ticket 0211.
  const health = runHealth({
    age: nextAge,
    // Seeded from the character's own generated health the first time, which is
    // the only honest starting value: it is where the body actually is. From
    // then on it is the age curve's to move (see `year.ts`).
    vitality: state.health.vitality ?? state.player.stats.health,
    deficit: state.health.deficit ?? 0,
    stress: stress.player.stress.level,
    conditions: state.health.conditions,
    stream: state.rng.stream(RngDomains.Health),
    // Spec 541-543 puts athletes first in the injury order. "Athlete" here is
    // literally "in a sport this year" — `education.activities` holds only what
    // they are still in, because leaving removes the row.
    athlete: education.education.activities.some(
      (entry) => findActivity(entry.activityId)?.kind === 'sport',
    ),
    ...(employment.employment.job
      ? { track: findJob(employment.employment.job.jobId)?.track }
      : {}),
    // One check-up a year, and it is spent by having been taken (spec 531). The
    // age recorded is the age they were WHEN they saw the doctor, which is the
    // year now ending.
    checkedUp: state.health.checkedAtAge === state.player.age,
  });

  /*
    Ticket 0212. This used to be one array literal whose `sequence` was a chain
    of cumulative additions — `education.lines.length + social.lines.length +
    family.lines.length + ...` — recopied and extended by hand in every writer.
    It was correct, and it was correct the way a tower of coins is upright: the
    eighth writer could not be added without editing seven other expressions,
    and getting one of them wrong would have mis-ordered a year silently.

    So the year is assembled in order now, with a counter. Same ids, same
    ordering, and adding a ninth writer is one line instead of eight.
  */
  let sequence = 0;
  const entries: TimelineEntry[] = [];
  const write = (
    lines: readonly {
      readonly kind: TimelineKind;
      readonly text: string;
      readonly eventId?: string;
    }[],
    id: (index: number) => string | undefined,
  ) => {
    lines.forEach((line, index) => {
      const entryId = id(index);
      entries.push(
        createTimelineEntry({
          age: nextAge,
          year: nextYear,
          kind: line.kind,
          text: line.text,
          ...(entryId !== undefined ? { id: entryId } : {}),
          ...(line.eventId !== undefined ? { eventId: asEventId(line.eventId) } : {}),
          sequence: sequence++,
        }),
      );
    });
  };

  // Kin first, because it is the year's largest news and because the phase that
  // produced it ran first. A death notice under a line about a promotion is the
  // wrong way round.
  write(kin.lines, (index) => `t:${nextYear}:kin:${index}`);
  write(education.lines, (index) => `t:${nextYear}:school:${index}`);
  write(social.lines, (index) => `t:${nextYear}:social:${index}`);
  write(family.lines, (index) => `t:${nextYear}:family:${index}`);
  // NOT `:work:` — `workHarder` already writes `t:YEAR:work:N` when the player
  // presses the button, and the two collided into duplicate timeline ids the
  // moment somebody pushed in a year they were also paid. CORE_RULES 13.12, and
  // the same duplicate-key class the player reported twice in 0207c, caught
  // here by its own invariant test.
  write(employment.lines, (index) => `t:${nextYear}:pay:${index}`);
  // Ticket 0303. Straight after employment, because the year's money line lives
  // here now and reads as the second half of the working year's news.
  write(living.lines, (index) => `t:${nextYear}:living:${index}`);
  write(
    homesYear.lines.map((text) => ({ kind: 'passive' as const, text })),
    (index) => `t:${nextYear}:homes:${index}`,
  );
  write(
    vehiclesYear.lines.map((text) => ({ kind: 'passive' as const, text })),
    (index) => `t:${nextYear}:cars:${index}`,
  );
  write(
    businessesYear.lines.map((text) => ({ kind: 'passive' as const, text })),
    (index) => `t:${nextYear}:biz:${index}`,
  );
  write(
    dealsYear.lines.map((text) => ({ kind: 'passive' as const, text })),
    (index) => `t:${nextYear}:deals:${index}`,
  );
  write(
    foundOut(state.valuables, valuablesNext).map((text) => ({ kind: 'passive' as const, text })),
    (index) => `t:${nextYear}:fakes:${index}`,
  );
  // Events carry their own id, assigned by the event engine.
  write(events.lines, () => undefined);
  write(health.lines, (index) => `t:${nextYear}:health:${index}`);
  // Last in the year, because it is the line about the year as a whole.
  write(stress.lines, (index) => `t:${nextYear}:stress:${index}`);

  /* ---- the year's money -------------------------------------------------
    //
    // Every phase REPORTED what it moved; this is the one place that moves it.
    //
    // Posting here rather than inside each phase is what makes the order of a
    // year's transactions deterministic, and — more importantly — what lets the
    // zero floor see the WHOLE year. Posted per phase, a character who was paid
    // in March and billed in April would be treated differently from one billed
    // first, purely by the order the phases happen to run in.
    //
    // Income before outgoings, for the same reason: a year's wages should be
    // available to pay that year's costs. Anything else would make the floor
    // bind on people who could in fact afford it.
  */
  const reported = [
    ...education.transactions,
    ...family.transactions,
    ...employment.transactions,
    // Ticket 0502. A partner's pay and the tax on it.
    ...partnered.transactions,
    ...events.transactions,
    // Ticket 0303. A year of treatment, for anybody being treated.
    ...health.transactions,
    // Ticket 0501. Upkeep and the mortgage on every home they own.
    ...homesYear.transactions,
    // Ticket 0504. Car payments, servicing and repairs, and a car scrapped.
    ...vehiclesYear.transactions,
    // Ticket 0601. What a business paid its owner, and the tax on it; money put in or got out.
    ...businessesYear.transactions,
    ...dealsYear.transactions,
    ...(businessTax > 0
      ? [
          {
            category: 'tax' as const,
            amount: dollars(-businessTax),
            source: 'Tax on business income',
          },
        ]
      : []),
  ];
  /*
    Ticket 0303. The cost of living is charged LAST, after every other outgoing,
    and the reason is a bug this ticket wrote and its own tests caught.

    The living phase was originally spread into `reported` at the front, which
    put rent ahead of tax among the negatives. A broke character therefore paid
    their landlord out of money the government was going to take, tax was
    floored to zero, and a measured life came out of forty years of work having
    paid $1.6 million of salary and NO TAX AT ALL. The books still balanced —
    every shortfall was recorded — which is precisely why it needed a test that
    looked at what the categories came to rather than whether they added up.

    Tax is not optional and rent is not paid first. Everything a household is
    actually committed to comes out before the discretionary cost of its own
    standard of living, and what cannot be covered becomes a `shortfall` row
    against the living cost, which is the honest place for it and the thing
    0307's loan engine will lend against.
  */
  /*
    Ticket 0306 — the cards, and WHERE the draw happens is the whole design.

    The obvious place is after posting: let the year fall short, see the
    `shortfall` rows, then advance the money. That produces a ledger that says a
    character both failed to pay for something and paid for it, in the same
    year, and leaves 0302's reconciliation reading two contradictory stories.

    So the draw happens FIRST, against the shortfall the year is ABOUT to have.
    Every phase has already reported what it moves, so the arithmetic is
    available before a single row is posted: what is owed, less what is held and
    what is coming in, is what the cards are asked for. The advance is then just
    another positive row, posted with the rest, and the ledger reads the way the
    year actually went — money in, card advance in, costs out.

    The card year runs after, on the balance the draw produced, so this year's
    spending is charged interest next year rather than the same afternoon.
  */
  /*
    Ticket 0308 — the market moves BEFORE the year is paid for, because the
    dividends it pays are cash the household can actually use.

    Ordering it after would produce a character who took a credit-card advance
    in March to cover rent and received a bond coupon in December that would
    have covered it, which is the kind of thing a ledger records faithfully and
    a player reads as the game being broken.

    What the market does NOT do is cover the shortfall itself. Holdings are
    never sold automatically — see `simulation/investments.ts`. A portfolio is
    not an overdraft, and the moment it becomes one, deciding how much to put
    in stops being a decision.
  */
  /*
    Ticket 0308c. EVERY instrument's price moves, not only the ones held — the
    market list shows all eighty-nine whether or not this character owns
    anything, and a price chart needs a past that exists regardless of who was
    holding at the time.

    Sector rolls first, then one per instrument in catalog order. The order
    matters: a life has to replay identically from its seed, and the stream is
    consumed positionally.
  */
  const prices = runPriceYear(
    state.prices,
    market,
    SECTORS.map(() => marketRoll.next()),
    INSTRUMENTS.map(() => marketRoll.next()),
  ).prices;
  // Then what the holdings themselves did: coupons, dividends, and any bond
  // that reached its date. Against prices that have ALREADY moved.
  const marketYear = runHoldingYear(prices, state.portfolio);
  /*
    Ticket 0308b. A matured bond's principal is an `investment` row, not
    `assetIncome` — it is the money coming back across the same line it went
    out on (spec 44-46), and calling it income would tell the dashboard a
    character earned $80,000 the year their bond came due. A coupon IS income
    and stays where it was.
  */
  const payouts: readonly NewTransaction[] = marketYear.income.map((row) => ({
    category: row.matured ? ('investment' as const) : ('assetIncome' as const),
    amount: row.amount,
    source: row.source,
  }));

  /* -------------------------------------------------------------------------- */
  /* Ticket 0310 — the retirement account                                        */
  /* -------------------------------------------------------------------------- */
  /*
    PAYING IN WHILE WORKING, DRAWING ONCE STOPPED, and growing either way.

    THE MATCH NEVER TOUCHES THE BANK, so it gets no ledger row. It is money the
    employer puts straight into the account, and posting it as income and then
    as an equal outflow would inflate the year's earnings by an amount that
    never existed in the character's hands — 0302's reconciliation would still
    balance and the dashboard would be lying.

    THE EMPLOYEE'S OWN CONTRIBUTION IS AN `investment` ROW, for exactly the
    reason 0308 made a share purchase one: the money genuinely leaves the
    account, so the row has to exist, but it is a TRANSFER rather than outflow
    (spec 44-46) and `summariseFinances` already knows to keep it out of the
    spending figure and add it back into net worth.

    Taken from cash rather than from pre-tax pay, which is the one simplification
    here. Real contributions reduce taxable income; modelling that would mean
    reaching into `payBreakdown` in `@yearafter/careers` to make the tax
    conditional on a finance-package concept, and the effect on a game played in
    whole years is a few per cent on the way in. Labelled rather than hidden.
  */
  const workedJob = employment.employment.job;
  const jobRow = workedJob ? findJob(workedJob.jobId) : undefined;
  const benefit = jobRow ? benefitFor(jobRow.template) : undefined;

  let retirement = state.retirement;
  const retirementRows: NewTransaction[] = [];

  if (retirement.retiredAtAge === undefined && benefit && employment.earned > 0) {
    const paid = contributeYear(retirement, benefit, employment.earned);
    retirement = serveYear(paid.state, benefit, employment.earned);
    if (paid.own > 0) {
      retirementRows.push({
        category: 'investment' as const,
        amount: dollars(-paid.own),
        source:
          paid.matched > 0
            ? `Retirement — you put in $${paid.own.toLocaleString('en-US')}, they added $${paid.matched.toLocaleString('en-US')}`
            : 'Retirement — paid in',
      });
    }
  }

  /*
    ONCE STOPPED, THE MONEY COMES BACK. A pension and the state's basic pension
    are `assetIncome` — they are earnings from something owned. The DRAW is an
    `investment` row, because it is the character's own money coming back across
    the same line it went out on, which is the rule 0308b set for a matured bond
    and for the same reason: calling it income would tell the dashboard a
    seventy-year-old earned $40,000 for existing.
  */
  const drawn = drawYear(retirement, nextAge, benefit ?? pensionableBenefit(state));
  retirement = drawn.after;
  if (drawn.pension > 0) {
    retirementRows.push({
      category: 'assetIncome' as const,
      amount: dollars(drawn.pension),
      source: 'Pension',
    });
  }
  if (drawn.state > 0) {
    retirementRows.push({
      category: 'assetIncome' as const,
      amount: dollars(drawn.state),
      source: 'State pension',
    });
  }
  if (drawn.drawn > 0) {
    retirementRows.push({
      category: 'investment' as const,
      amount: dollars(drawn.drawn),
      source: 'Retirement — drawn down',
    });
  }

  // And the account rides the same market everything else does, including the
  // crashes 0308d spent a ticket making recoverable.
  retirement = growYear(retirement, prices);

  /*
    Ticket 0309. THE ADVISOR'S FEE, and it is charged here so that it is charged
    AT ALL.

    An advisor whose fee is deducted somewhere the player never sees is free, and
    a free advisor is the "system nobody should ever decline" mirror of
    CORE_RULES 13.7 — measured, following one adds 31% to a stock-picking
    character's median and the fee is the entire thing standing against that.
    It goes in the ledger as an ordinary negative row with the advisor's name on
    it (13.6: any change to money names its source AND its amount), so it turns
    up in the year's summary beside everything else that was paid for.

    CHARGED ON THE PORTFOLIO, AFTER THE MARKET HAS MOVED, which is how a real
    fee works and also the only honest order: billing on the opening value would
    quietly charge for a year the money had not yet earned.

    `spending` rather than a new category, deliberately. An advisory fee is
    buying a service, which is what `spending` already means, and a fourteenth
    category that only one system writes would be a line on the dashboard for a
    thing most characters never have.
  */
  const advisor = state.advisorId ? findAdvisor(state.advisorId) : undefined;
  const advisorCharge: readonly NewTransaction[] = (() => {
    if (!advisor) return [];
    const held = Math.round(Number(portfolioWorth(prices, marketYear.holdings)) / 100);
    const fee = advisorFee(advisor, held);
    if (fee <= 0) return [];
    return [
      {
        category: 'spending' as const,
        amount: dollars(-fee),
        source: `${advisor.name} — yearly fee`,
      },
    ];
  })();

  const owing = reported
    .concat(living.transactions)
    // The fee is an ordinary bill: it counts toward what the year owes, so a
    // character who cannot cover it draws on a card like they would for rent.
    .concat(advisorCharge)
    // A retirement contribution is money leaving too, and a character who
    // cannot cover the year should not be quietly paying into a pension.
    .concat(retirementRows)
    .filter((entry) => entry.amount < 0)
    .reduce((sum, entry) => sum - Number(entry.amount), 0);
  const coming =
    Number(state.finance.balance) +
    reported
      .concat(payouts)
      .concat(retirementRows)
      .filter((entry) => entry.amount > 0)
      .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const wanted = Math.max(0, Math.round((owing - coming) / 100));
  const draw =
    wanted > 0 ? drawFrom(state.cards, wanted) : { cards: state.cards, drawn: 0, onto: [] };

  const advance: readonly NewTransaction[] =
    draw.drawn > 0
      ? [
          {
            category: 'debt' as const,
            amount: dollars(draw.drawn),
            source: cardSource(draw.onto),
          },
        ]
      : [];

  /*
    And then the year of holding them: the annual fee, a year's interest
    capitalised onto the balance, and the minimum payment taken out of whatever
    is left after everything else. Last in the queue on purpose — a card company
    is not paid before the rent (spec 32 makes the consequence of missing it a
    frozen card, not a court), and paying the minimum out of money the household
    needed would be the game choosing the lender over the character.
  */
  const leftForCards = Math.max(0, Math.round((coming + draw.drawn * 100 - owing) / 100));
  const cardYear = runCardYear(draw.cards, leftForCards);

  /*
    Ticket 0307. Loans are serviced AFTER cards, out of what is left again.

    The order between the two is a real decision and this is the honest way
    round: a card's minimum is small and its rate is punishing, so paying it
    first is what a person does and what costs them least. A loan that goes
    unpaid falls into arrears — the same consequence a card gets, for the same
    spec 32 reason: no court, no collections, the account simply goes bad.
  */
  const cardCost = cardYear.charges.reduce((sum, charge) => sum - Number(charge.amount), 0);
  const leftForLoans = Math.max(0, leftForCards - Math.round(cardCost / 100));
  /*
    Ticket 0603. A business pays its own loan (see `runBusinessesYear`), so the
    household's step skips those — but not one whose business is gone: a lender
    left with nothing to be paid out of is paid out of the person who signed.
  */
  const businessPays = new Set(businessesYear.serviced);
  const householdLoans = businessesYear.loans.filter(
    (loan) => !(loan.businessId !== undefined && businessPays.has(loan.businessId)),
  );
  const businessLoans = businessesYear.loans.filter(
    (loan) => loan.businessId !== undefined && businessPays.has(loan.businessId),
  );
  const loanYear = runLoanYear(householdLoans, leftForLoans, isInSchool(education.education));

  const money = postYear(state.finance, nextYear, nextAge, [
    ...reported.filter((entry) => entry.amount > 0),
    ...payouts,
    ...advance,
    ...reported.filter((entry) => entry.amount < 0),
    ...living.transactions,
    ...retirementRows.filter((entry) => Number(entry.amount) > 0),
    ...retirementRows.filter((entry) => Number(entry.amount) < 0),
    ...advisorCharge,
    ...cardYear.charges.map((charge) => ({
      category: 'debt' as const,
      amount: charge.amount,
      source: charge.source,
    })),
    ...loanYear.charges.map((charge) => ({
      category: 'debt' as const,
      amount: charge.amount,
      source: charge.source,
    })),
  ]);

  // ---- the year's line budget --------------------------------------------
  //
  // Spec 725-770: a busy character should not be bombarded. That was enforced
  // by every writer keeping itself small, which worked for exactly as long as
  // nobody added a seventh writer — Ticket 0211 added health, health took ONE
  // line, and a year that was already at the cap went to eight. A budget kept
  // per writer is not a budget; it is seven separate hopes.
  //
  // So the cap lives here, where the year is assembled and is the only place
  // that can see the whole of it. Milestones are never dropped: a graduation, a
  // wedding, a birth and a death are the things a life is remembered by, and a
  // feed that silently swallowed one to make room for a cold would be worse
  // than a long year.
  const budgeted = withinBudget(entries);

  // ---- validate ----------------------------------------------------------
  if (nextAge !== state.player.age + 1) {
    throw new Error('advanceYear: age advanced by an amount other than one year');
  }
  /*
    Ticket 0302, and spec 1678 makes it build-blocking: "opening cash + cash in
    − cash out = closing cash. Any mismatch fails validation."

    Checked HERE, in the same block as the age invariant, because this is the
    one function that commits a year and therefore the only place that can name
    the year a drift started in. A mismatch means a producer moved money without
    going through `post` — the single defect this design can suffer, and one
    that is invisible by every other route: the balance would simply be wrong,
    quietly, for the rest of the life.

    A throw rather than a repair. A ledger that silently corrects itself is a
    ledger that hides the bug that needed correcting, and spec 1043–1059 makes
    financial reconciliation absolute.
  */
  const books = reconcile(money.finance);
  if (!books.ok) {
    throw new Error(
      `advanceYear: the books do not balance in ${nextYear}. ` +
        `The balance says ${Number(books.balance) / 100} and the transactions add up to ` +
        `${Number(books.summed) / 100}, a difference of ${Number(books.difference) / 100}. ` +
        `Something moved money without going through post().`,
    );
  }
  /*
    Two things the sum above cannot see, both of which leave it perfectly
    balanced.

    A year that closed below zero: `post` floors at zero and writes the
    shortfall down, so no year should ever dip. A life that dipped and climbed
    back out ends on a correct balance and hides the year it was wrong in — the
    exact shape of the drift-then-clamp defect `ledger.test.ts` checks every
    year for, caught here in one place instead.

    A year outside the life: the ledger's own years cannot tell you one of them
    is wrong, because they are whatever the rows say. The span has to come from
    outside, and this is where it lives — a character born in 2000 who is
    twenty-six cannot have been paid in 1970 or in 2050. `post` takes the year
    as an argument, so the way this breaks is a producer passing the wrong
    variable, which type-checks.
  */
  const walk = reconcileByYear(money.finance);
  if (walk.firstBadYear !== undefined) {
    throw new Error(
      `advanceYear: the balance went below zero in ${walk.firstBadYear}. ` +
        `post() floors at zero and records a shortfall, so nothing should be able to. ` +
        `Something subtracted from the balance without going through it.`,
    );
  }
  const strays = yearsOutside(money.finance, state.player.birthYear, nextYear);
  if (strays.length > 0) {
    throw new Error(
      `advanceYear: the ledger records money moving in ${strays.join(', ')}, ` +
        `outside a life that runs ${state.player.birthYear}–${nextYear}. ` +
        `A transaction was stamped with the wrong year.`,
    );
  }
  if (budgeted.length === 0 && events.decisions.length === 0) {
    // The catalog guarantees passive events are available to every character at
    // every childhood age (scripts/generate-events.py enforces it). An empty
    // year means that guarantee has been broken, and a silent blank year in the
    // feed reads to the player as a broken button.
    throw new Error(`advanceYear: no events were available at age ${nextAge}`);
  }

  /*
    Ticket 0415 — what the rest of the year did to them.

    Work shaped the character in the middle of the year (0411). This is
    everything else a year can do to somebody — a small child, an illness they
    are learning to live with, a second year running on empty — and it reads the
    year as it ENDED: the stress the stress phase summarised it into, the
    conditions the health phase left them holding, the children still at home.
    Applied in the same `nudgeStats` as the face that aged, because both are the
    year's last word on who they are. The keys cannot collide: health reports
    looks and this reports willpower and discipline.
  */
  const shaped = lifeShaping({
    age: nextAge,
    worldYear: nextYear,
    family: events.family,
    conditions: health.conditions,
    stressBefore: state.player.stress.level,
    stressAfter: stress.player.stress.level,
    willpower: stress.player.stats.willpower,
    activities: education.education.activities,
  });

  // ---- commit ------------------------------------------------------------
  const player: Character = {
    ...stress.player,
    age: nextAge,
    // Ticket 0211. The health phase has the last word on both, and `alive` is
    // the one field in this file that can go from true to false.
    alive: health.alive,
    /*
      Ticket 0411. The health phase has the last word on how they look too, and
      it arrives here rather than earlier because `looksDrift` reads the health
      the year ENDED on — somebody who spent it ill aged faster than somebody
      who did not, which is the whole claim. Through `nudgeStats` so it travels
      0203's curve like everything else, and the raw `health` assignment stays
      raw because that one is a level the phase computed, not a nudge.
    */
    stats: {
      ...nudgeStats(stress.player.stats, { ...health.statDeltas, ...shaped }),
      health: clampStat(health.health),
    },
    // Ticket 0210 takes this over for anybody who is working. Computed AFTER
    // the employment phase, so the year a character is promoted the header says
    // what they were promoted to rather than what they were promoted from.
    occupation: occupationFor(
      education.education,
      nextAge,
      employment.employment.job ? findJob(employment.employment.job.jobId)?.title : undefined,
    ),
    // Ticket 0209: a parent buying you something unprompted is real money, and
    // the line that reported it named the amount (CORE_RULES 13.6).
    // Two things move money in an ordinary year, and both name themselves in
    // the feed (CORE_RULES 13.6): a parent handing you something unprompted
    // (0209), and what a year of work left after living (0210).
    //
    // The floor is the 13.13 rule: a year can end BEHIND — a small wage and
    // four children does not break even — but a character cannot hold less than
    // nothing. Until 0301's ledger and 0307's loan engine exist there is no
    // debt to fall into, so the shortfall stops at zero and the feed line still
    // says honestly how far behind the year went.
    // Ticket 0301: a MIRROR of `finance.balance`, never a computation. The
    // year's postings happened above; this is the number they came to.
    cash: money.cash,
    // Folded rather than spread, so the year's own lines are checked against
    // each other as well as against the life before them (0211a). Seven phases
    // write here and none of them can see what the others chose.
    timeline: budgeted.reduce(appendToTimeline, state.player.timeline),
    /*
      Ticket 0212. `records` finally gets written, eleven tickets after it was
      declared (CORE_RULES 13.36).

      Stamped HERE and nowhere else, for the same reason `appendToTimeline`
      exists: a producer that invents its own id is one of several producers
      inventing several id schemes. A phase says WHAT happened and what kind of
      thing it was; this is the only place that knows when, and the ordinal
      keeps two records of the same category in one year apart — twins, or a
      degree finished in the year a parent died.

      NOT budgeted. The line budget is about a feed a person reads in one
      screen; the records are structured history, five of which are shown at the
      end of eighty years. Capping them would mean losing a marriage to make
      room for a promotion, permanently, in the only place the game keeps it.
    */
    records: [
      ...kin.records,
      ...education.records,
      ...family.records,
      ...employment.records,
      ...health.records,
      ...businessesYear.records,
    ].reduce<readonly LifeRecord[]>(
      (all, record, index) => appendRecord(all, stampRecord(record, nextAge, nextYear, index)),
      state.player.records,
    ),
  };

  const next: GameState = {
    ...state,
    world: { ...state.world, year: nextYear },
    player,
    family: events.family,
    circle: events.circle,
    parenting: family.parenting,
    employment: employment.employment,
    // Ticket 0211. A pending decision is DISCARDED on the year somebody dies:
    // a question the character will never answer is not a question, and
    // `advanceYear` already refuses to run while one is open, so leaving it
    // would lock the app on a dead character forever.
    finance: money.finance,
    // Ticket 0306. Balances, interest and any freeze, carried forward.
    cards: cardYear.cards,
    // Ticket 0307. Loans amortise, fall into arrears, or clear and vanish.
    loans: [...loanYear.loans, ...businessLoans],
    /*
      Ticket 0501. A year that closed with anything unpaid is a year behind on
      the mortgage; `foreclose` below acts on the second one in a row.
    */
    homes: markMissed(
      homesYear.homes,
      money.finance.transactions.some(
        (entry) => entry.year === nextYear && entry.category === 'shortfall',
      ),
    ),
    // Ticket 0506. What the jewelry, watches and art are worth after the year.
    valuables: valuablesNext,
    // Ticket 0601. What each business sold and kept, and who it is run by now.
    businesses: businessesYear.businesses,
    // Ticket 0605. Private deals after the year.
    deals: dealsYear.deals,
    // Ticket 0504. The same short year puts a financed car behind.
    vehicles: markVehiclesMissed(
      vehiclesYear.vehicles,
      money.finance.transactions.some(
        (entry) => entry.year === nextYear && entry.category === 'shortfall',
      ),
    ),
    // Ticket 0308. What the holdings are worth after the year, and the market
    // they will face next year.
    portfolio: marketYear.holdings,
    market,
    prices,
    retirement,
    // Ticket 0303. The standard of living and whether they pay for a roof —
    // both carried forward, because a standard with no memory is a share of
    // income by another name.
    household: living.household,
    health: {
      ...state.health,
      conditions: health.conditions,
      vitality: health.vitality,
      deficit: health.deficit,
      ...(health.alive ? {} : { causeOfDeath: health.cause, diedAtAge: nextAge }),
    },
    events: events.history,
    // Events can move school standing (detention, suspension, being caught);
    // the education phase set the rest of it.
    education: {
      ...education.education,
      // Ticket 0209: a parent grounding you moves school standing through the
      // same field events use, rather than a parallel one.
      behaviour: clampStat(events.behaviour + family.behaviourDelta),
      // Stress takes its cut of school last, after everything else has had
      // its say about the year.
      performance: clampStat(stress.performance),
    },
    pending: health.alive ? events.decisions : [],
  };

  /*
    Ticket 0402 — the job that comes looking for you, raised LAST.

    After every phase, because it reads the year that just happened: the
    standing the employment phase moved, the performance it scored, and the job
    it may just have promoted somebody into. Raised before the state is handed
    back rather than inside `phases/employment.ts` because deciding WHICH job is
    on offer needs what the character is eligible for, and eligibility is a
    question about education and experience that the employment phase cannot
    see and should not be taught.

    It is also the first systemic decision in the build, so it is deliberately
    additive: `events.decisions` keeps whatever it drew and the offer joins it.
    Measured, that risks nothing — an adult year contains zero authored
    decisions, because every one in the catalog stops at seventeen.

    Ticket 0405 — the college question, raised FIRST of the two systemic
    doors. Both check `pending.length` before adding anything, so only one
    ever lands in a year; school ahead of career is the right order for the
    population that actually collides, because a career offer needs an
    existing job and the person this reaches has just left school without
    one yet.
  */
  /*
    Ticket 0410 — the private life, raised LAST of the three and measured into
    that position rather than argued into it. A wedding put off a year is still
    a wedding; a degree or a rung put off a year measurably is not.
    `withLifeOffer`'s docblock carries the numbers, including the two orderings
    that were tried and rejected.
  */
  return {
    /*
      Ticket 0416 — something to join, LAST of the four: a league sign-up should
      never be the reason a job, a place at college or a wedding went unasked.
    */
    /*
      Ticket 0501 — a home, FOURTH of the five, after a private life and before
      a league: buying somewhere is a bigger question than a Sunday team. The
      roof it is measured against is what the renting household pays for walls
      this year, which is what owning would replace. Foreclosure runs first, so
      a house the bank has just taken is not offered back in the same breath.
    */
    /*
      Ticket 0504 — a car, FIFTH of the six: after a home, before a league. A
      repossession runs first, beside the foreclosure, so a car the lender has
      just taken is not offered back in the same breath.
    */
    /*
      Ticket 0506 — a renovation, SIXTH of the seven: after a car, before a
      league. Only ever about the home they live in falling apart.
    */
    state: withPursuitOffer(
      withRenovationOffer(
        withVehicleOffer(
          withHomeOffer(
            withLifeOffer(
              withAnyOffer(
                withCollegeOffer(repossess(foreclose(next)), health.alive),
                health.alive,
              ),
              health.alive,
            ),
            health.alive,
            Math.round(living.withoutCar * (1 - OWNER_SHARE)),
          ),
          health.alive,
          living.cost,
        ),
        health.alive,
        living.cost,
      ),
      health.alive,
    ),
    newEntries: budgeted,
  };
}

/**
 * How many lines one year may put in the feed.
 *
 * Seven, which is what the two invariant tests have asserted since 0203 and
 * 0209 — this constant does not tighten anything, it moves the enforcement to
 * somewhere that can actually see the total.
 */
export const LINES_PER_YEAR = 7;

/**
 * Trim a year to its budget, keeping what a life is remembered by.
 *
 * Milestones first and in their original order, then everything else in the
 * order the phases wrote it, then the tail is dropped. Sequence numbers are
 * rewritten afterwards so the Life screen still renders the year in order —
 * leaving the original gaps would sort correctly and then read as though
 * something was missing, which it would be.
 */
function withinBudget(entries: readonly TimelineEntry[]): readonly TimelineEntry[] {
  if (entries.length <= LINES_PER_YEAR) return entries;
  const milestones = entries.filter((entry) => entry.kind === 'milestone');
  const rest = entries.filter((entry) => entry.kind !== 'milestone');
  const kept = [...milestones, ...rest].slice(0, LINES_PER_YEAR);
  return entries
    .filter((entry) => kept.includes(entry))
    .map((entry, index) => ({ ...entry, sequence: index }));
}
