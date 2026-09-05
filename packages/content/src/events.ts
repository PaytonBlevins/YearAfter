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
  /** School stage: 'preschool' | 'elementary' | 'middle' | 'high' | 'graduated' | 'droppedOut'. */
  readonly schoolStageAny?: readonly string[];
  /** Extracurriculars currently joined (Ticket 0204). */
  readonly activitiesAtLeast?: number;
  readonly activitiesAtMost?: number;
  /**
   * Whole dollars the character must actually have.
   *
   * Set automatically by the generator on anything that SPENDS: an event whose
   * prompt says "the coffee can under your bed has $150 in it" cannot fire at a
   * character holding $60, and the version that did floored the balance at zero
   * and told them they had spent $150. That is the unexplained-money bug
   * (CORE_RULES 13.6) arriving from the other direction.
   */
  readonly cashAtLeast?: number;
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
 * Money moving, and where it came from.
 *
 * A bare number was the original shape, and it produced exactly the bug the
 * product owner reported: cash arriving with no explanation anywhere in the
 * feed. Requiring a source makes a silent balance change unrepresentable rather
 * than merely discouraged, and the validator additionally checks that the
 * player-visible text names the amount — so the audit trail is in the prose,
 * where the player actually reads it.
 *
 * The source reads inside a sentence: "birthday money from {sibling}".
 */
export interface CashEffect {
  /** Whole dollars. Negative is money leaving. */
  readonly delta: number;
  /** Never empty. Supports the same tokens as event text. */
  readonly source: string;
}

/**
 * What an event does.
 *
 * Deliberately small. An event may nudge stats, move warmth with family, move
 * pocket money, move school standing and set story flags — nothing else.
 * Careers, education and the financial ledger own their own state and arrive on
 * their own tickets; an event reaches them through a flag, not by writing into
 * them from here.
 */
export interface EventEffects {
  readonly stats?: Partial<Record<VisibleStatKey, number>>;
  /** Warmth deltas by family role. `parents` hits both; `siblings` hits all. */
  readonly relationship?: Partial<
    Record<'mother' | 'father' | 'parents' | 'siblings' | 'family', number>
  >;
  /** Pocket money, always with a source. Until the ledger exists (Ticket 0301). */
  readonly cash?: CashEffect;
  /**
   * Standing with the school, 0–100 (Ticket 0204). Detention, suspension and
   * being caught cheating push it down; being noticed for the right reasons
   * pushes it up. Sustained low behaviour is what routes a character into an
   * alternative school (spec 73) — without events able to move it, that whole
   * branch of the spec is unreachable, which is exactly what testing found.
   */
  readonly behaviour?: number;
  /**
   * Stress, in points, added to this year's total (Ticket 0205).
   *
   * The content hook for spec 1986: commitments and events feed stress rather
   * than a visible time budget. Positive for a year that kept happening at the
   * character, NEGATIVE for the things that genuinely help — a long summer, a
   * grandparent's house, a holiday. Without the negative direction stress is a
   * ratchet, and a ratchet is the separate mental-health system spec 1030
   * forbids wearing a different name.
   */
  readonly stress?: number;
  /**
   * Warmth toward the person this event named (Ticket 0206), signed.
   *
   * Optional, and usually left out: warmth is derived from the happiness delta
   * when it is absent, because the copy has already said how it went. Author it
   * where the two genuinely differ — a year that made the character miserable
   * and brought them closer to somebody, which is most of what friendship is
   * at fourteen.
   */
  readonly bond?: number;
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
  /**
   * A screen this choice opens after it resolves, e.g. `"activities"`.
   *
   * This is how "See what they offer" leads to a real menu instead of the game
   * picking for you. The engine treats it as an opaque string and never acts on
   * it — the app maps it to a screen — so adding a destination stays content
   * work rather than engine work.
   */
  readonly opens?: string;
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
  /**
   * People this event's text talks about: `kid`, `kid2`, `adult`.
   *
   * Declared rather than inferred so the engine can bind them ONCE when a
   * decision is raised and use the same names in the prompt, the options and
   * the outcome. Without this, a prompt naming a girl at the water fountain and
   * an outcome naming somebody else are two independent draws — which is
   * exactly what shipped in 0203.
   *
   * Optional on passive events, which are a single line and cannot disagree
   * with themselves.
   */
  readonly personTokens?: readonly string[];
  /** Relative weight before rarity and modifiers. */
  readonly weight: number;
  readonly modifiers?: readonly EventModifier[];
  /**
   * Years before this may fire again. Absent means once per life, which is the
   * right default: most events are things that happen to you, not habits.
   */
  readonly cooldown?: number;
  /**
   * A decision with only two options, deliberately.
   *
   * The rule is three or more — "do it / don't" is not a decision. Some
   * situations genuinely have two answers (own up or stay silent), and those
   * say so here rather than being padded with a third option nobody would take.
   */
  readonly binaryOk?: boolean;
  /** Marks an event whose outcomes must touch Health, not only Happiness. */
  readonly physical?: boolean;
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
