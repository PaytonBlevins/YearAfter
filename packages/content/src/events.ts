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
export type EventCategory =
  | 'family'
  | 'school'
  | 'friendship'
  | 'random'
  | 'talent'
  /**
   * Work.
   *
   * Ticket 0402 reserved this for SYSTEMIC decisions only, and said so plainly:
   * "No authored event has this category and none may: the events catalog is
   * childhood-shaped and every decision in it stops at seventeen."
   *
   * That was a description of the catalog, not a rule about the category, and
   * 0409 is the ticket that made it false. Measured first: 26 of 374 events
   * could fire at forty and not one of them was about a job. Authored work
   * events now use this too — same domain, same word, one vocabulary.
   */
  | 'career'
  /** Ticket 0405 reserved this for the college offer; 0409 authors into it too. */
  | 'education'
  /**
   * Ticket 0409. The body.
   *
   * Roadmap finding 4: 0211 gave the game conditions and no authored event ever
   * fired because of one, so a character with something serious lived an event
   * library that had never heard of it.
   */
  | 'health'
  /**
   * Ticket 0409. Losing somebody.
   *
   * Roadmap finding 4b, and the same shape one system over: 0212's kin phase
   * writes its own death notices and no authored event fired because a parent
   * died. Grief, a funeral, a house to clear, a sibling you only see now — none
   * of it existed.
   */
  | 'loss';

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'family',
  'school',
  'friendship',
  'random',
  'talent',
  // Ticket 0409. Authored adult content lives in these three.
  'career',
  'health',
  'loss',
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
  /**
   * Ticket 0207. Whether the character must (true) or must not (false) be
   * seeing somebody for this to fire.
   *
   * Reading the built app found "Had dinner at Marcus's. Their parents asked
   * what you wanted to do with your life" written about a classmate the
   * character had never so much as flirted with — a romance event that
   * presupposes a relationship has no way to say so, so it fired at anybody.
   * The event system knew about the CAST from 0206 and nothing about whether
   * any of them were the player's partner.
   */
  readonly partnered?: boolean;
  /**
   * Ticket 0208. Whether the character must (true) or must not (false) have
   * children for this to fire.
   *
   * The same lesson as `partnered`, one ticket later: eleven parenting events
   * went in reading "Your kid spiked a fever at 2am", and without this every
   * one of them could fire at a thirty-year-old who has never had a child.
   */
  readonly hasChildren?: boolean;
  /**
   * Ticket 0409. Whether the character must (true) or must not (false) have a
   * job for this to fire.
   *
   * `partnered` and `hasChildren` are the precedent and the warning: both were
   * added AFTER events shipped that presupposed a relationship or a child and
   * fired at people who had neither. Work is the same shape and the biggest
   * catalog hole measured — 26 events could fire at forty and not one was about
   * a job.
   */
  readonly employed?: boolean;
  /** Any one of these career tracks, so a scene can be about the actual work. */
  readonly jobTrackAny?: readonly string[];
  /** Years in the CURRENT job, for an event about having been somewhere a while. */
  readonly jobYearsAtLeast?: number;
  readonly jobYearsAtMost?: number;
  /** Ticket 0409. Whether they are carrying any health condition at all. */
  readonly hasCondition?: boolean;
  /** Any one of these condition ids, for an event about a specific diagnosis. */
  readonly conditionAny?: readonly string[];
  /** Ticket 0409. Lost somebody close within this many years. */
  readonly bereavedWithin?: number;
  /**
   * Ticket 0412. Whether the character must (true) or must not (false) have a
   * friend for this to fire.
   *
   * `partnered`, `hasChildren`, `employed` and `hasCondition` are all the same
   * shape and all four were added AFTER events shipped that presupposed the
   * thing and fired at people who did not have it. This is the fifth, and the
   * gap is the largest of them: **of the six events in the `friendship`
   * category that can fire at forty, every single one is a `love.*` entry.**
   * The category's whole adult library is about romance, because the language
   * could say "is seeing somebody" and could not say "has a friend", and
   * CORE_RULES 13.67 is the rule that an event cannot be about a thing
   * eligibility cannot ask about.
   *
   * A friend means somebody at or above `FRIENDSHIP_THRESHOLD` who the
   * character is not involved with — a partner is a partner, and an event
   * reading "you and {kid} have been friends for years" firing about a wife is
   * the `partnered` bug in reverse.
   */
  readonly hasFriend?: boolean;
  /**
   * How many friends, for the difference between having one and having a crowd.
   *
   * Two events that both want `hasFriend: true` are not the same event: "you
   * were the one nobody called" needs somebody with exactly one, and "the group
   * chat picked a weekend" needs three. Measured across 90 lives, an adult
   * holds a median of three and about one year in ten holds none, so both ends
   * are real populations rather than corners.
   */
  readonly friendsAtLeast?: number;
  readonly friendsAtMost?: number;
  /**
   * Ticket 0412. How long the character has known their longest-standing
   * friend, in years.
   *
   * The one thing `hasFriend` cannot express and the thing most adult
   * friendship copy is actually about: *an old friend*. A friendship of twenty
   * years and one of eighteen months are different subjects, and before 0412
   * neither existed long enough for the question to be worth asking — nothing
   * held a friendship together outside a room, so at twenty-six the median
   * circle was entirely people met since school.
   */
  readonly friendshipYearsAtLeast?: number;
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
