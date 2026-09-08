/**
 * Ticket 0211 — the things that actually happen to a body.
 *
 * Two kinds, and the difference matters more than the list does.
 *
 * An ILLNESS is a year: you had it, it cost you something, it went. Most of what
 * happens to a person is this, and it belongs in the feed rather than on a
 * screen — spec 1165 removes routine health chores by name, and a menu of colds
 * to manage is exactly the chore it means.
 *
 * A CONDITION is a fact: it stays, it lowers what your health can climb back to,
 * and it raises the odds the year ends badly. That is the whole reason illness
 * exists in the model — one year in a handful leaves something behind, and a
 * life accumulates.
 *
 * INJURY frequency is spec 541–543, in its own order: athletes first and still
 * not often, blue-collar and hazardous work very rare, everyone else extremely
 * rare, and permanent injuries rarer than any of them. That ordering is asserted
 * in `health.test.ts` rather than trusted.
 */

/*
 * The hazards and ceilings below were softened once, against a played
 * population. The first pass gave blood pressure a hazard of 1.55 and a ceiling
 * of 68 — but most people over sixty have blood pressure somebody keeps
 * mentioning, and they mostly live to eighty. Pricing an ordinary chronic
 * condition like a serious one pulled the median age at death down to
 * sixty-eight with a p10 of fifty-seven, which is a population dying of things
 * people do not die of. CORE_RULES 13.25.
 */
export type Severity = 'minor' | 'serious' | 'grave';

export interface ConditionKind {
  readonly id: string;
  /** What the player sees on the Doctor screen. */
  readonly label: string;
  readonly severity: Severity;
  /** Ceiling this puts on health while it is held. */
  readonly ceiling: number;
  /** Multiplier on the year's death hazard. */
  readonly hazard: number;
  /**
   * Chance a year of treatment clears it. Zero means it never goes — a lost
   * finger does not grow back, and pretending otherwise makes the Doctor a
   * vending machine.
   */
  readonly treatable: number;
  /** Chance it clears on its own in a year, treated or not. */
  readonly resolves: number;
  readonly from: 'illness' | 'injury';
}

/**
 * The catalog.
 *
 * Deliberately SHORT. Spec 1972 puts illnesses, treatment and addiction in one
 * bullet with fertility and pregnancy — it is not asking for a medical
 * simulation, and a list of ninety diagnoses would be a chore generator. Twelve
 * conditions covering the shapes a life takes: something that lingers, something
 * that limits, something that will end you.
 *
 * Named in plain words for the same reason 0207d rewrote every prompt: a player
 * should not need a doctor to read their own character screen.
 */
export const CONDITIONS: readonly ConditionKind[] = [
  {
    id: 'cond.chest',
    label: 'Trouble with your chest',
    severity: 'minor',
    ceiling: 82,
    hazard: 1.15,
    treatable: 0.45,
    resolves: 0.18,
    from: 'illness',
  },
  {
    id: 'cond.back',
    label: 'Your back, permanently',
    severity: 'minor',
    ceiling: 80,
    hazard: 1.05,
    treatable: 0.3,
    resolves: 0.12,
    from: 'injury',
  },
  {
    id: 'cond.knee',
    label: 'A knee that never came back',
    severity: 'minor',
    ceiling: 78,
    hazard: 1.0,
    treatable: 0.22,
    resolves: 0.06,
    from: 'injury',
  },
  {
    id: 'cond.hearing',
    label: 'Hearing you will not get back',
    severity: 'minor',
    ceiling: 84,
    hazard: 1.0,
    treatable: 0,
    resolves: 0,
    from: 'injury',
  },
  {
    id: 'cond.stomach',
    label: 'Something wrong with your stomach',
    severity: 'minor',
    ceiling: 79,
    hazard: 1.12,
    treatable: 0.5,
    resolves: 0.22,
    from: 'illness',
  },
  {
    id: 'cond.blood',
    label: 'Blood pressure they keep mentioning',
    severity: 'serious',
    ceiling: 72,
    hazard: 1.28,
    treatable: 0.34,
    resolves: 0.05,
    from: 'illness',
  },
  {
    id: 'cond.sugar',
    label: 'Sugar you have to watch',
    severity: 'serious',
    ceiling: 70,
    hazard: 1.3,
    treatable: 0.28,
    resolves: 0.04,
    from: 'illness',
  },
  {
    id: 'cond.heart',
    label: 'Your heart, and they are not happy',
    severity: 'serious',
    ceiling: 60,
    hazard: 1.9,
    treatable: 0.26,
    resolves: 0.03,
    from: 'illness',
  },
  {
    id: 'cond.lungs',
    label: 'Lungs that are not what they were',
    severity: 'serious',
    ceiling: 62,
    hazard: 1.7,
    treatable: 0.24,
    resolves: 0.04,
    from: 'illness',
  },
  {
    id: 'cond.spine',
    label: 'A back injury that ended things',
    severity: 'serious',
    ceiling: 58,
    hazard: 1.2,
    treatable: 0.12,
    resolves: 0.02,
    from: 'injury',
  },
  {
    id: 'cond.growth',
    label: 'Something they found and are treating',
    severity: 'grave',
    ceiling: 44,
    hazard: 3.6,
    treatable: 0.31,
    resolves: 0.05,
    from: 'illness',
  },
  {
    id: 'cond.stroke',
    label: 'What the stroke left behind',
    severity: 'grave',
    ceiling: 42,
    hazard: 3.0,
    treatable: 0.14,
    resolves: 0.03,
    from: 'illness',
  },
];

export const findCondition = (id: string): ConditionKind | undefined =>
  CONDITIONS.find((condition) => condition.id === id);

/** A condition this character is living with. */
export interface HeldCondition {
  readonly conditionId: string;
  readonly since: number;
  /** Whether a doctor is currently on it. Treatment is yearly, not one-off. */
  readonly treated: boolean;
}

/**
 * The lowest ceiling any held condition imposes.
 *
 * Lowest rather than cumulative on purpose: two bad knees is not half a person.
 * The worst thing wrong with you is what decides how well you can be, and
 * stacking multipliers is how a character with four minor complaints ends up
 * sicker than one with a grave illness.
 */
export function ceilingWith(held: readonly HeldCondition[]): number {
  let ceiling = 100;
  for (const row of held) {
    const kind = findCondition(row.conditionId);
    if (kind) ceiling = Math.min(ceiling, kind.ceiling);
  }
  return ceiling;
}

/**
 * The combined multiplier on this year's death hazard.
 *
 * Cumulative here, unlike the ceiling, and the asymmetry is the point: several
 * things wrong with you IS more dangerous than one, even though it does not make
 * you feel proportionally worse. Capped, because a character collecting six
 * conditions should be in serious trouble rather than mathematically doomed.
 */
export const HAZARD_CAP = 9;

export function hazardWith(held: readonly HeldCondition[]): number {
  let hazard = 1;
  for (const row of held) {
    const kind = findCondition(row.conditionId);
    if (kind) hazard *= kind.hazard;
  }
  return Math.min(HAZARD_CAP, hazard);
}

export const SEVERITY_LABELS: Readonly<Record<Severity, string>> = {
  minor: 'Manageable',
  serious: 'Serious',
  grave: 'Grave',
};

/**
 * Ticket 0211 — what a body is carrying, saved.
 *
 * The health STAT is not in here. It stays on the character with the other six
 * visible stats, because the player has been reading that bar since 0106 and
 * moving it into a slice would make the header read from two places. This is
 * what the bar cannot say.
 */
export interface HealthState {
  readonly conditions: readonly HeldCondition[];
  /**
   * The age-driven part of health, carried year to year (see `year.ts`).
   *
   * Absent on a save written before 0211 and on a newborn: the migration and
   * `new-game` both seed it from the character's generated health, which is the
   * only honest starting value — it is where the body actually is.
   */
  readonly vitality?: number;
  /** What illness and injury are still owed back. Heals toward zero. */
  readonly deficit?: number;
  /** The age at which a doctor was last seen. One check-up a year (spec 531). */
  readonly checkedAtAge?: number;
  /** What ended it, once it has ended. 0212 renders this. */
  readonly causeOfDeath?: string;
  /** The age they died at, so a finished life still knows when. */
  readonly diedAtAge?: number;
}

export const EMPTY_HEALTH: HealthState = { conditions: [] };
