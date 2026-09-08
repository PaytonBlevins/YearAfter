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
 *   0211  aging, health, mortality        -> health phase
 *   0301  financial ledger, monthly pass  -> finance phase
 * Do not grow this file with inline system logic — add a phase module.
 */

import { createTimelineEntry, type Character, type TimelineEntry } from '@yearafter/character';
import { asEventId, clampStat, dollars, type Money } from '@yearafter/core';
import type { GameState } from './game-state';
import { isInSchool } from '@yearafter/education';
import { occupationFor, runEducation } from './phases/education';
import { findJob } from '@yearafter/careers';
import { runEmployment } from './phases/employment';
import { runEvents } from './phases/events';
import { partnerOf } from '@yearafter/social';
import { runFamily } from './phases/family';
import { runSocial } from './phases/social';
import { runStress } from './phases/stress';
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
/**
 * Cash after the year's two movements, floored at zero.
 *
 * Separate function because the floor is a rule rather than an arithmetic
 * detail, and because a reader looking for "can this go negative" should find
 * one place that answers it.
 */
function earnedThisYear(cash: Money, gifted: number, saved: number): Money {
  const delta = gifted + saved;
  if (delta === 0) return cash;
  const next = Number(cash) + Math.round(delta * 100);
  return (next < 0 ? dollars(0) : (next as unknown as Money)) as Money;
}

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

  // Education first: an event that fires this year should be able to read the
  // grade the character is now in, and a report-card event that arrives before
  // the report card is nonsense.
  const education = runEducation(state, nextAge);

  // Then the class. Before events, so an event that fires this year can name
  // somebody who is actually in it — which is the whole of Ticket 0206.
  const social = runSocial({
    circle: state.circle,
    stream: state.rng.stream(RngDomains.Relationships),
    age: nextAge,
    worldYear: nextYear,
    nameCultureId: state.nameCultureId,
    firstName: state.player.firstName,
    charisma: education.player.stats.charisma,
    personality: education.player.personality,
    family: state.family,
    education: education.education,
    previousStage: state.education.stage,
    // Ticket 0210. The job the character walks into on the FIRST of January,
    // not the one the employment phase may promote them into later — the
    // colleague they met this year was met at the desk they were sitting at.
    ...(currentJobTitle(state) !== undefined ? { jobTitle: currentJobTitle(state) } : {}),
  });

  // Then the family. After social, because a pregnancy needs to know who the
  // player is with and social is where a relationship can end; before events,
  // so an event this year can name a child who already exists (Ticket 0208).
  const partner = partnerOf(social.circle.people);
  const familyStream = state.rng.stream(RngDomains.Family);
  const names = nameContext(
    state.nameCultureId,
    social.circle,
    state.family,
    state.player.firstName,
  );
  const family = runFamily({
    family: state.family,
    parenting: state.parenting,
    stream: familyStream,
    age: nextAge,
    worldYear: nextYear,
    personality: education.player.personality,
    ...(partner ? { partnerPersonality: partner.personality, partnerId: partner.id } : {}),
    playerLastName: state.player.lastName,
    behaviour: education.education.behaviour,
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
    education.lines.length + social.lines.length + family.lines.length + employment.lines.length,
  );

  // Stress last: it summarises the year rather than making things happen in it,
  // so it needs the workload education computed, the household events finished
  // moving, and the stress those events contributed.
  const stress = runStress({
    player: events.player,
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

  const entries: TimelineEntry[] = [
    ...education.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        id: `t:${nextYear}:school:${index}`,
        sequence: index,
      }),
    ),
    ...social.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        id: `t:${nextYear}:social:${index}`,
        sequence: education.lines.length + index,
      }),
    ),
    ...family.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        id: `t:${nextYear}:family:${index}`,
        sequence: education.lines.length + social.lines.length + index,
      }),
    ),
    ...employment.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        // NOT `:work:` — `workHarder` already writes `t:YEAR:work:N` when the
        // player presses the button, and the two collided into duplicate
        // timeline ids the moment somebody pushed in a year they were also
        // paid. CORE_RULES 13.12, and the same duplicate-key class the player
        // reported twice in 0207c, caught here by its own invariant test.
        id: `t:${nextYear}:pay:${index}`,
        sequence: education.lines.length + social.lines.length + family.lines.length + index,
      }),
    ),
    ...events.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        eventId: asEventId(line.eventId),
        sequence:
          education.lines.length +
          social.lines.length +
          family.lines.length +
          employment.lines.length +
          index,
      }),
    ),
    // Last in the year, because it is the line about the year as a whole.
    ...stress.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        id: `t:${nextYear}:stress:${index}`,
        sequence:
          education.lines.length +
          social.lines.length +
          family.lines.length +
          employment.lines.length +
          events.lines.length +
          index,
      }),
    ),
  ];

  // ---- validate ----------------------------------------------------------
  if (nextAge !== state.player.age + 1) {
    throw new Error('advanceYear: age advanced by an amount other than one year');
  }
  if (entries.length === 0 && events.decisions.length === 0) {
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
    cash: earnedThisYear(stress.player.cash, family.gifted, employment.saved),
    timeline: [...state.player.timeline, ...entries],
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
      pending: events.decisions,
    },
    newEntries: entries,
  };
}
