/**
 * Ticket 0203 — the event phase.
 *
 * Spec 725–770 sets the pacing target directly: "A typical year can contain
 * several passive developments, roughly 0–3 meaningful decisions, and occasional
 * special opportunities. Busy characters should not be bombarded with popups."
 * That sentence is the specification for this file, and `PASSIVE_COUNT_WEIGHTS`
 * and `DECISION_COUNT_WEIGHTS` are where it is expressed as numbers.
 *
 * The order of operations in a year is fixed, because changing it changes every
 * seeded life:
 *   1. fire anything an earlier event scheduled for this age;
 *   2. draw passive developments;
 *   3. draw decisions and opportunities.
 */

import type {
  EventChoice,
  EventDefinition,
  EventCategory,
  EventEffects,
  EventFollowUp,
} from '@yearafter/content';
import { RARITY_WEIGHT, SELECTABLE_EVENTS, findEvent } from '@yearafter/content';
import { matchesCondition } from './conditions';
import type { EventContext } from './context';
import {
  clearDue,
  dueAt,
  isOffCooldown,
  recordFired,
  schedule,
  type EventHistory,
} from './history';
import { bindPersonNames, renderEventText, type NameBindings } from './text';

/**
 * The random surface the engine needs. `RandomStream` from @yearafter/simulation
 * satisfies this structurally — declaring it here rather than importing keeps the
 * dependency pointing one way (simulation depends on events, never the reverse).
 */
export interface EventRandom {
  chance(probability: number): boolean;
  pick<T>(values: readonly T[]): T;
  weightedChoice<T>(options: readonly { readonly value: T; readonly weight: number }[]): T;
}

/** Passive developments per year. Spec 725–770: "several", not a wall of text. */
export const PASSIVE_COUNT_WEIGHTS = [
  { value: 1, weight: 26 },
  { value: 2, weight: 44 },
  { value: 3, weight: 24 },
  { value: 4, weight: 6 },
];

/** Meaningful decisions per year. Spec 725–770 caps this at roughly three. */
export const DECISION_COUNT_WEIGHTS = [
  { value: 0, weight: 34 },
  { value: 1, weight: 42 },
  { value: 2, weight: 19 },
  { value: 3, weight: 5 },
];

/**
 * Age at which the game starts asking the player things.
 *
 * A two-year-old does not make decisions, and a popup asking one to choose is
 * the kind of detail that makes a life sim feel like a spreadsheet. Infancy is
 * passive on purpose.
 */
export const FIRST_DECISION_AGE = 5;

/**
 * How much a category is damped after it has already appeared this year.
 *
 * Without this, a character with a big family and no talents gets four family
 * events in a row and the year reads like one long anecdote. It is a weight
 * multiplier rather than a hard ban so a year genuinely dominated by one thread
 * is still possible.
 */
export const REPEAT_CATEGORY_DAMPING = 0.3;

export interface EventOutcome {
  readonly eventId: string;
  readonly category: EventCategory;
  /** 'passive' for background developments, 'decision'/'opportunity' otherwise. */
  readonly type: EventDefinition['type'];
  readonly text: string;
  readonly effects?: EventEffects;
}

export interface PendingChoice {
  readonly id: string;
  readonly label: string;
  /** Screen to open after this choice resolves. Opaque to the engine. */
  readonly opens?: string;
}

/** A decision waiting on the player. Held in game state until answered. */
export interface PendingDecision {
  readonly eventId: string;
  readonly category: EventCategory;
  readonly age: number;
  readonly year: number;
  readonly prompt: string;
  readonly choices: readonly PendingChoice[];
  /**
   * The people this decision is about, bound when it was raised.
   *
   * Stored on the decision rather than re-drawn, so the outcome names the same
   * person the prompt did — even when the answer arrives days later on another
   * device, after the RNG stream has moved on.
   */
  readonly names: NameBindings;
}

export interface EventPhaseResult {
  /** Applied immediately, in order. */
  readonly outcomes: readonly EventOutcome[];
  /** Asked of the player before the next Advance. */
  readonly decisions: readonly PendingDecision[];
  readonly history: EventHistory;
}

/* -------------------------------------------------------------------------- */

/** Base weight after rarity and every matching modifier. Zero means ineligible. */
export function weightFor(definition: EventDefinition, context: EventContext): number {
  let weight = definition.weight * RARITY_WEIGHT[definition.rarity];
  for (const modifier of definition.modifiers ?? []) {
    if (matchesCondition(modifier.when, context)) weight *= modifier.multiply;
  }
  return weight;
}

function isEligible(
  definition: EventDefinition,
  context: EventContext,
  history: EventHistory,
): boolean {
  if (!isOffCooldown(history, definition.id, definition.cooldown, context.age)) return false;
  return matchesCondition(definition.eligibility, context);
}

/**
 * Draw `count` distinct events of one type, damping categories as they are used.
 * Returns fewer than `count` when the eligible pool runs out, which is normal —
 * a three-year-old has far fewer things that can happen to them than a teenager.
 */
function drawEvents(
  pool: readonly EventDefinition[],
  count: number,
  context: EventContext,
  random: EventRandom,
  usedCategories: Map<EventCategory, number>,
  taken: Set<string>,
): EventDefinition[] {
  const drawn: EventDefinition[] = [];
  for (let i = 0; i < count; i += 1) {
    const options = pool
      .filter((definition) => !taken.has(definition.id))
      .map((definition) => ({
        value: definition,
        weight:
          weightFor(definition, context) *
          REPEAT_CATEGORY_DAMPING ** (usedCategories.get(definition.category) ?? 0),
      }))
      .filter((option) => option.weight > 0);

    if (options.length === 0) break;
    const chosen = random.weightedChoice(options);
    drawn.push(chosen);
    taken.add(chosen.id);
    usedCategories.set(chosen.category, (usedCategories.get(chosen.category) ?? 0) + 1);
  }
  return drawn;
}

function toPendingDecision(
  definition: EventDefinition,
  context: EventContext,
  random: EventRandom,
): PendingDecision | undefined {
  const offered = (definition.choices ?? []).filter(
    (choice) => !choice.requires || matchesCondition(choice.requires, context),
  );
  // A decision with one surviving choice is not a decision; skip it rather than
  // showing the player a dialog with a single button.
  if (offered.length < 2) return undefined;

  // Bind the people ONCE, here, before anything is rendered.
  const names = bindPersonNames(definition.personTokens ?? [], context, random);

  return {
    eventId: definition.id,
    category: definition.category,
    age: context.age,
    year: context.year,
    prompt: renderEventText(random.pick(definition.text), context, random, names),
    choices: offered.map((choice) => ({
      id: choice.id,
      label: renderEventText(choice.label, context, random, names),
      ...(choice.opens ? { opens: choice.opens } : {}),
    })),
    names,
  };
}

function applyFollowUp(
  history: EventHistory,
  followUp: EventFollowUp | undefined,
  sourceId: string,
  age: number,
  random: EventRandom,
): EventHistory {
  if (!followUp) return history;
  if (followUp.chance !== undefined && !random.chance(followUp.chance)) return history;
  if (!findEvent(followUp.eventId)) return history;
  return schedule(history, {
    eventId: followUp.eventId,
    atAge: age + Math.max(1, followUp.inYears),
    sourceId,
  });
}

/**
 * Run one year of events.
 *
 * Pure with respect to everything except `random`, which advances — a year
 * consumes randomness, and the save records the resulting stream state.
 */
export function runEventPhase(
  context: EventContext,
  random: EventRandom,
  history: EventHistory,
  catalog: readonly EventDefinition[] = SELECTABLE_EVENTS,
): EventPhaseResult {
  const outcomes: EventOutcome[] = [];
  const decisions: PendingDecision[] = [];
  const usedCategories = new Map<EventCategory, number>();
  const taken = new Set<string>();
  let nextHistory = history;

  // ---- 1. delayed consequences -------------------------------------------
  for (const entry of dueAt(history, context.age)) {
    const definition = findEvent(entry.eventId);
    if (!definition) continue;
    // A follow-up still has to make sense when it lands. If the world moved on,
    // it is dropped silently rather than firing something that reads as a
    // non-sequitur three years later.
    if (!matchesCondition(definition.eligibility, context)) continue;
    taken.add(definition.id);
    usedCategories.set(definition.category, (usedCategories.get(definition.category) ?? 0) + 1);

    if (definition.choices && definition.choices.length > 0) {
      const pending = toPendingDecision(definition, context, random);
      if (pending) {
        decisions.push(pending);
        nextHistory = recordFired(nextHistory, definition.id, context.age);
        continue;
      }
    }
    outcomes.push({
      eventId: definition.id,
      category: definition.category,
      type: definition.type,
      text: renderEventText(random.pick(definition.text), context, random),
      effects: definition.effects,
    });
    nextHistory = recordFired(nextHistory, definition.id, context.age);
    nextHistory = applyFollowUp(
      nextHistory,
      definition.followUp,
      definition.id,
      context.age,
      random,
    );
  }
  nextHistory = clearDue(nextHistory, context.age);

  // ---- 2. passive developments -------------------------------------------
  const passivePool = catalog.filter(
    (definition) => definition.type === 'passive' && isEligible(definition, context, nextHistory),
  );
  const passiveCount = random.weightedChoice(PASSIVE_COUNT_WEIGHTS);
  for (const definition of drawEvents(
    passivePool,
    passiveCount,
    context,
    random,
    usedCategories,
    taken,
  )) {
    outcomes.push({
      eventId: definition.id,
      category: definition.category,
      type: definition.type,
      text: renderEventText(random.pick(definition.text), context, random),
      effects: definition.effects,
    });
    nextHistory = recordFired(nextHistory, definition.id, context.age);
    nextHistory = applyFollowUp(
      nextHistory,
      definition.followUp,
      definition.id,
      context.age,
      random,
    );
  }

  // ---- 3. decisions and opportunities -------------------------------------
  if (context.age >= FIRST_DECISION_AGE) {
    const decisionPool = catalog.filter(
      (definition) =>
        (definition.type === 'decision' || definition.type === 'opportunity') &&
        isEligible(definition, context, nextHistory),
    );
    const wanted = random.weightedChoice(DECISION_COUNT_WEIGHTS) - decisions.length;
    if (wanted > 0) {
      for (const definition of drawEvents(
        decisionPool,
        wanted,
        context,
        random,
        usedCategories,
        taken,
      )) {
        const pending = toPendingDecision(definition, context, random);
        if (!pending) continue;
        decisions.push(pending);
        nextHistory = recordFired(nextHistory, definition.id, context.age);
      }
    }
  }

  return { outcomes, decisions, history: nextHistory };
}

/* -------------------------------------------------------------------------- */
/* Answering a decision                                                        */
/* -------------------------------------------------------------------------- */

export interface ResolvedChoice {
  readonly outcome: EventOutcome;
  readonly history: EventHistory;
  /** Screen the answered choice asked to open, if any. */
  readonly opens?: string;
}

/**
 * Resolve a player's answer.
 *
 * A choice may be certain (`text` + `effects`) or genuinely uncertain
 * (`outcomes`, drawn by weight). Uncertainty is what stops a decision from being
 * a lookup table the player memorises — spec 725–770: talents "unlock or improve
 * access to event pools but do not guarantee outcomes".
 */
export function resolveChoice(
  decision: PendingDecision,
  choiceId: string,
  context: EventContext,
  random: EventRandom,
  history: EventHistory,
  /** Overridable for tests; production always resolves against the catalog. */
  lookup: (id: string) => EventDefinition | undefined = findEvent,
): ResolvedChoice | undefined {
  const definition = lookup(decision.eventId);
  const choice: EventChoice | undefined = definition?.choices?.find(
    (candidate) => candidate.id === choiceId,
  );
  if (!definition || !choice) return undefined;

  let text = choice.text;
  let effects = choice.effects;
  let followUp = choice.followUp;

  if (choice.outcomes && choice.outcomes.length > 0) {
    const drawn = random.weightedChoice(
      choice.outcomes.map((outcome) => ({ value: outcome, weight: outcome.weight })),
    );
    text = drawn.text;
    effects = mergeEffects(choice.effects, drawn.effects);
    followUp = drawn.followUp ?? choice.followUp;
  }

  return {
    outcome: {
      eventId: definition.id,
      category: definition.category,
      type: definition.type,
      // The decision's own bindings, not a fresh draw: this is the whole point.
      text: renderEventText(text ?? choice.label, context, random, decision.names),
      effects,
    },
    history: applyFollowUp(history, followUp, definition.id, decision.age, random),
    ...(choice.opens ? { opens: choice.opens } : {}),
  };
}

/** A choice's own effects always apply; the drawn outcome's stack on top. */
function mergeEffects(
  base: EventEffects | undefined,
  extra: EventEffects | undefined,
): EventEffects | undefined {
  if (!base) return extra;
  if (!extra) return base;
  return {
    stats: sumRecords(base.stats, extra.stats),
    relationship: sumRecords(base.relationship, extra.relationship),
    // A choice's cash and its outcome's cash do not add — the outcome's wins,
    // because two sources cannot describe one movement.
    cash: extra.cash ?? base.cash,
    setFlags: [...(base.setFlags ?? []), ...(extra.setFlags ?? [])],
    clearFlags: [...(base.clearFlags ?? []), ...(extra.clearFlags ?? [])],
  };
}

function sumRecords<K extends string>(
  a: Partial<Record<K, number>> | undefined,
  b: Partial<Record<K, number>> | undefined,
): Partial<Record<K, number>> | undefined {
  if (!a) return b;
  if (!b) return a;
  const result: Partial<Record<K, number>> = { ...a };
  for (const [key, value] of Object.entries(b) as [K, number][]) {
    result[key] = (result[key] ?? 0) + value;
  }
  return result;
}
