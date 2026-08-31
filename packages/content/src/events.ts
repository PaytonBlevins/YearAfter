/**
 * Ticket 0203 — Event catalog schema.
 *
 * Spec 725–770: events are DATA DRIVEN. Everything an event knows about itself —
 * when it may fire, how likely it is, what it says, what it costs — is expressed
 * here as JSON, so the library can grow to thousands of entries without a line
 * of new logic. `@yearafter/events` is the engine that reads these; it must
 * never gain a `switch` on an event id.
 *
 * The pipeline spec 725–770 describes (designer concept → AI candidate → automated
 * validation → human review → approved database) ends at this file: everything
 * in `data/events-*.json` is approved content. `scripts/generate-events.py` is
 * the authoring source, `tools/content-validator` is the automated validation.
 */

import type { VisibleStatKey, TalentKey } from '@yearafter/character';
import type { WealthBand } from '@yearafter/relationships';
import eventsChildhood from '../data/events-childhood.json';

/** Spec 725–770 lists these five contexts for the childhood library. */
export type EventCategory = 'family' | 'school' | 'friendship' | 'random' | 'talent';

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'family',
  'school',
  'friendship',
  'random',
  'talent',
];

/**
 * Spec 725–770's four types.
 *
 * `passive` writes a line to the timeline and moves on. `decision` stops the
 * year and asks. `opportunity` is a decision the player could not have sought
 * out. `followUp` is never selected at random — it fires because an earlier
 * event scheduled it.
 */
export type EventType = 'passive' | 'decision' | 'opportunity' | 'followUp';

/** Spec 725–770 rarity hierarchy. Purely a weight multiplier; see RARITY_WEIGHT. */
export type EventRarity = 'common' | 'uncommon' | 'rare' | 'veryRare' | 'exceptional' | 'legendary';

export const RARITY_WEIGHT: Readonly<Record<EventRarity, number>> = {
  common: 1,
  uncommon: 0.35,
  rare: 0.1,
  veryRare: 0.025,
  exceptional: 0.005,
  legendary: 0.0008,
};

/**
 * Household shapes an event can require.
 *
 * These are conditions on the family from Ticket 0202, named rather than
 * expressed as arithmetic so the JSON stays readable: an event about being
 * driven to school by both parents should say `bothParents`, not
 * `{"parentCount": 2}`.
 */
export type FamilyRequirement =
  | 'mother'
  | 'father'
  | 'anyParent'
  | 'bothParents'
  | 'singleParent'
  | 'sibling'
  | 'siblings2'
  | 'olderSibling'
  | 'onlyChild';

/**
 * The predicate language.
 *
 * Every field is optional and every present field must hold — this is an AND.
 * `OR` is expressed by writing two events, which reads better in the catalog
 * than a nested boolean tree and keeps each variant's text specific to its case.
 *
 * The same shape drives both eligibility (may this fire at all?) and modifiers
 * (how much likelier is it here?), so there is one evaluator to test.
 */
export interface EventCondition {
  readonly ageMin?: number;
  readonly ageMax?: number;
  readonly sex?: 'male' | 'female';
  readonly requires?: readonly FamilyRequirement[];
  /** Any one of these talents. */
  readonly talentsAny?: readonly TalentKey[];
  /** None of these talents. */
  readonly talentsNone?: readonly TalentKey[];
  readonly wealthAny?: readonly WealthBand[];
  readonly statAtLeast?: Partial<Record<VisibleStatKey, number>>;
  readonly statAtMost?: Partial<Record<VisibleStatKey, number>>;
  /** Warmth with a named family role, 0–100. */
  readonly relationshipAtLeast?: Partial<Record<'mother' | 'father' | 'sibling', number>>;
  readonly relationshipAtMost?: Partial<Record<'mother' | 'father' | 'sibling', number>>;
  /** Story flags set by earlier events. */
  readonly flagsAll?: readonly string[];
  readonly flagsNone?: readonly string[];
}

/** A conditional weight multiplier (spec 725–770 "Modifiers"). */
export interface EventModifier {
  readonly when: EventCondition;
  /** Multiplies the base weight. 0 suppresses; >1 makes the event characteristic. */
  readonly multiply: number;
}

/**
 * What an event does.
 *
 * Deliberately small. An event may nudge stats, move warmth with family, move
 * pocket money and set story flags — nothing else. Careers, education and the
 * financial ledger own their own state and arrive on their own tickets; an event
 * reaches them through a flag, not by writing into them from here.
 */
export interface EventEffects {
  readonly stats?: Partial<Record<VisibleStatKey, number>>;
  /** Warmth deltas by family role. `parents` hits both; `siblings` hits all. */
  readonly relationship?: Partial<
    Record<'mother' | 'father' | 'parents' | 'siblings' | 'family', number>
  >;
  /** Whole dollars. Pocket money only until the ledger exists (Ticket 0301). */
  readonly cash?: number;
  readonly setFlags?: readonly string[];
  readonly clearFlags?: readonly string[];
}

/** One weighted result of a choice, for decisions that are genuinely uncertain. */
export interface ChoiceOutcome {
  readonly weight: number;
  /** The line written to the timeline. Supports the same tokens as event text. */
  readonly text: string;
  readonly effects?: EventEffects;
  readonly followUp?: EventFollowUp;
}

export interface EventChoice {
  readonly id: string;
  /** Button text. Short — it has to fit a phone. */
  readonly label: string;
  /** Certain result. Mutually exclusive with `outcomes`. */
  readonly text?: string;
  readonly effects?: EventEffects;
  /** Uncertain result: one of these is drawn by weight. */
  readonly outcomes?: readonly ChoiceOutcome[];
  readonly followUp?: EventFollowUp;
  /** Hidden condition; a choice the player cannot take is not offered. */
  readonly requires?: EventCondition;
}

/** Spec 725–770: "Events can have delayed consequences and multi-year chains." */
export interface EventFollowUp {
  readonly eventId: string;
  /** Years from now. 1 means next Advance. */
  readonly inYears: number;
  /** Probability it actually happens. Default 1. */
  readonly chance?: number;
}

export interface EventDefinition {
  readonly id: string;
  readonly category: EventCategory;
  readonly type: EventType;
  readonly rarity: EventRarity;
  readonly eligibility: EventCondition;
  /** Relative weight before rarity and modifiers. */
  readonly weight: number;
  readonly modifiers?: readonly EventModifier[];
  /**
   * Years before this may fire again. Absent means once per life, which is the
   * right default: most events are things that happen to you, not habits.
   */
  readonly cooldown?: number;
  /** Text variants (spec 725–770). One is drawn; all must fit the same conditions. */
  readonly text: readonly string[];
  readonly effects?: EventEffects;
  readonly choices?: readonly EventChoice[];
  readonly followUp?: EventFollowUp;
}

interface EventCatalogFile {
  readonly version: number;
  readonly entries: readonly EventDefinition[];
}

const childhood = eventsChildhood as unknown as EventCatalogFile;

/** Every approved childhood event (Ticket 0203). */
export const CHILDHOOD_EVENTS: readonly EventDefinition[] = childhood.entries;

export const EVENT_CATALOG_VERSION = childhood.version;

const EVENTS_BY_ID = new Map(CHILDHOOD_EVENTS.map((event) => [event.id, event]));

export const findEvent = (id: string): EventDefinition | undefined => EVENTS_BY_ID.get(id);

/** Events reachable by random selection. Follow-ups are fired, never drawn. */
export const SELECTABLE_EVENTS: readonly EventDefinition[] = CHILDHOOD_EVENTS.filter(
  (event) => event.type !== 'followUp',
);
