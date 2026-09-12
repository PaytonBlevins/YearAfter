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
import { asEventId, clampStat } from '@yearafter/core';
import type { GameState } from './game-state';
import { isInSchool } from '@yearafter/education';
import { occupationFor, runEducation } from './phases/education';
import { findJob } from '@yearafter/careers';
import { runEmployment } from './phases/employment';
import { runEvents } from './phases/events';
import { partnerOf } from '@yearafter/social';
import { livingChildren, livingParents } from '@yearafter/relationships';
import { runFamily } from './phases/family';
import { postYear } from './money';
import { reconcile, reconcileByYear, yearsOutside } from '@yearafter/finance';
import { runKin } from './phases/kin';
import { runLiving } from './phases/living';
import { runSocial } from './phases/social';
import { runHealth } from './phases/health';
import { runStress } from './phases/stress';
import { costIndexOf, findActivity } from '@yearafter/content';
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

const currentJobTitle = (state: GameState): string | undefined =>
  state.employment.job ? findJob(state.employment.job.jobId)?.title : undefined;

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
  const education = runEducation(state, nextAge);

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
  });

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
  const living = runLiving({
    household: state.household,
    age: nextAge,
    locationIndex: costIndexOf(state.player.currentLocation.cityId),
    partnered: partnerOf(social.circle.people) !== undefined,
    children: livingChildren(family.family).length,
    // What the job left after tax. Zero for anybody not working, which is the
    // case this whole phase exists to make cost something.
    afterTaxIncome: employment.takeHome,
    wealth: Math.floor(Number(state.player.cash) / 100),
    earned: employment.earned,
    ...(currentJobTitle({ ...state, employment: employment.employment }) !== undefined
      ? { jobTitle: currentJobTitle({ ...state, employment: employment.employment })! }
      : {}),
    toldToLeave: family.toldToLeave,
    hasLivingParent: livingParents(family.family).length > 0,
  });

  const events = runEvents(
    {
      ...state,
      player: education.player,
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
    ...events.transactions,
    // Ticket 0303. A year of treatment, for anybody being treated.
    ...health.transactions,
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
  const money = postYear(state.finance, nextYear, nextAge, [
    ...reported.filter((entry) => entry.amount > 0),
    ...reported.filter((entry) => entry.amount < 0),
    ...living.transactions,
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

  // ---- commit ------------------------------------------------------------
  const player: Character = {
    ...stress.player,
    age: nextAge,
    // Ticket 0211. The health phase has the last word on both, and `alive` is
    // the one field in this file that can go from true to false.
    alive: health.alive,
    stats: { ...stress.player.stats, health: clampStat(health.health) },
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
    ].reduce<readonly LifeRecord[]>(
      (all, record, index) => appendRecord(all, stampRecord(record, nextAge, nextYear, index)),
      state.player.records,
    ),
  };

  return {
    state: {
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
    },
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
