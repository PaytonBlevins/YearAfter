/**
 * Ticket 0211 — one year of a body, as a pure function.
 *
 * Knows nothing about GameState, the same rule every domain package follows. It
 * takes what happened to a person this year and a block of random draws, and
 * says what their health is now, what is wrong with them, and whether they are
 * still here.
 *
 * VITALITY AND DEFICIT, which is the second version of this file.
 *
 * The first one kept a single number and moved it: age took a little, illness
 * took a lot, recovery gave some back. Measured over 150 played lives that
 * produced a median death at SIXTY-FOUR with 7% dying before forty, and health
 * at forty reading p10 37 / median 73 / p90 100 — a spread of sixty-three points
 * at one age. The cause was that one number was being asked to be two things:
 * `NATURAL_RECOVERY` at 2.2 a year swamped an age curve costing 0.45, so nobody
 * aged at all and everything that moved health was a condition ceiling, which is
 * a step rather than a slope.
 *
 * So the two are separated:
 *
 *   VITALITY is the age-driven part. It climbs to `PEAK_AGE`, then falls, and
 *   nothing gives it back. This is the spine of the whole model.
 *
 *   DEFICIT is what illness and injury took and time returns. It heals toward
 *   zero at `recovery` a year, and it is the reason a bad winter at thirty is a
 *   dip rather than a debt.
 *
 * Health is what is left: `min(ceiling, vitality) - deficit`. The player sees
 * that one number, as they always have.
 *
 * The draws are passed in rather than taken, in a FIXED ORDER, so the phase that
 * calls this spends the Health stream identically every time and a life replays
 * from its seed.
 */

import { ageingLoss } from './aging';
import { CONDITIONS, ceilingWith, findCondition, type HeldCondition } from './conditions';
import {
  ILLNESS_COST,
  INJURY_COST,
  INJURY_PERMANENT,
  deathChance,
  illnessChance,
  injuryChance,
  lingerChance,
  severityOpenness,
} from './health';

export type YearEvent =
  | { readonly kind: 'ill'; readonly cost: number; readonly conditionId?: string }
  | { readonly kind: 'hurt'; readonly cost: number; readonly conditionId?: string }
  | { readonly kind: 'cleared'; readonly conditionId: string }
  | { readonly kind: 'died'; readonly cause: string };

export interface HealthYearInput {
  readonly age: number;
  /** The age-driven part, carried year to year. See the note above. */
  readonly vitality: number;
  /** What illness and injury are still owed back. */
  readonly deficit: number;
  readonly stress: number;
  readonly conditions: readonly HeldCondition[];
  readonly athlete: boolean;
  readonly hazardous: boolean;
  /** Points of deficit healed this year. */
  readonly recovery: number;
  /**
   * Draws, spent in this order and only when needed:
   *  0 ill?   1 illness cost   2 lingers?   3 which condition
   *  4 hurt?  5 injury cost    6 permanent? 7 which condition
   *  8+n each held condition's clear roll, in order
   *  then death?
   */
  readonly draw: (index: number) => number;
}

export interface HealthYearResult {
  readonly health: number;
  readonly vitality: number;
  readonly deficit: number;
  readonly conditions: readonly HeldCondition[];
  readonly alive: boolean;
  readonly events: readonly YearEvent[];
}

const between = ([low, high]: readonly [number, number], unit: number) =>
  Math.round(low + unit * (high - low));

/**
 * Pick a condition of the right origin, stably from one draw.
 *
 * The first version filtered permanent INJURIES to `severity !== 'minor'`, so
 * `cond.spine` was the only permanent injury the game could produce and three
 * catalog entries — a back, a knee, hearing — were unreachable in 150 lives.
 * Content nobody can reach is content that does not exist (CORE_RULES 13.7),
 * and a permanently ruined knee is exactly what a permanent injury usually is.
 *
 * It also drew UNIFORMLY, which meant a twenty-eight-year-old could pick up a
 * grave condition from an ordinary bad winter — measured, 5% of characters were
 * dead before forty. Severity is now weighted against age (`severityOpenness`):
 * something minor can happen to anybody, something grave is nearly closed off
 * before forty-five and fully open by sixty-eight. Spec 559.
 */
function conditionFrom(from: 'illness' | 'injury', age: number, unit: number): string {
  const open = severityOpenness(age);
  const weight = (condition: (typeof CONDITIONS)[number]) => {
    if (condition.severity === 'minor') return 1;
    if (condition.severity === 'serious') return 0.35 + 0.65 * open;
    return 0.04 + 0.96 * open;
  };

  const pool = CONDITIONS.filter((condition) => condition.from === from);
  const list = pool.length > 0 ? pool : CONDITIONS;
  const total = list.reduce((sum, condition) => sum + weight(condition), 0);

  let running = unit * total;
  for (const condition of list) {
    running -= weight(condition);
    if (running <= 0) return condition.id;
  }
  return (list[list.length - 1] as (typeof CONDITIONS)[number]).id;
}

export function runHealthYear(input: HealthYearInput): HealthYearResult {
  const events: YearEvent[] = [];
  let conditions = [...input.conditions];

  // Ageing first, because it is the only thing that happens to everybody and
  // everything below reads the health it leaves behind.
  const vitality = Math.max(0, Math.min(100, input.vitality - ageingLoss(input.age)));
  let deficit = Math.max(0, input.deficit - input.recovery);
  const soFar = () => Math.max(0, Math.min(ceilingWith(conditions), vitality) - deficit);

  /* -- ill? --------------------------------------------------------------- */
  if (input.draw(0) < illnessChance({ age: input.age, health: soFar(), stress: input.stress })) {
    const cost = between(ILLNESS_COST, input.draw(1));
    deficit += cost;
    const lingers = input.draw(2) < lingerChance(input.age);
    const conditionId = lingers ? conditionFrom('illness', input.age, input.draw(3)) : undefined;
    if (conditionId && !conditions.some((row) => row.conditionId === conditionId)) {
      conditions = [...conditions, { conditionId, since: input.age, treated: false }];
      events.push({ kind: 'ill', cost, conditionId });
    } else {
      events.push({ kind: 'ill', cost });
    }
  }

  /* -- hurt? -------------------------------------------------------------- */
  if (input.draw(4) < injuryChance({ athlete: input.athlete, hazardous: input.hazardous })) {
    const cost = between(INJURY_COST, input.draw(5));
    deficit += cost;
    const permanent = input.draw(6) < INJURY_PERMANENT;
    const conditionId = permanent ? conditionFrom('injury', input.age, input.draw(7)) : undefined;
    if (conditionId && !conditions.some((row) => row.conditionId === conditionId)) {
      conditions = [...conditions, { conditionId, since: input.age, treated: false }];
      events.push({ kind: 'hurt', cost, conditionId });
    } else {
      events.push({ kind: 'hurt', cost });
    }
  }

  /* -- anything clear up? ------------------------------------------------- */
  //
  // Treatment is YEARLY rather than a one-off purchase, which is why `treated`
  // is a flag on the held condition rather than an action with an immediate
  // result. A player who sees a doctor once and stops is not being treated.
  let slot = 8;
  conditions = conditions.filter((row) => {
    const kind = findCondition(row.conditionId);
    if (!kind) return false;
    const chance = kind.resolves + (row.treated ? kind.treatable : 0);
    const roll = input.draw(slot);
    slot += 1;
    if (roll >= chance) return true;
    events.push({ kind: 'cleared', conditionId: row.conditionId });
    return false;
  });

  // The ceiling is applied AFTER the year rather than as a cap on each step, so
  // a character whose worst condition clears is immediately allowed to climb
  // back rather than staying pinned until the following January.
  const health = Math.max(0, Math.round(Math.min(ceilingWith(conditions), vitality) - deficit));

  /* -- still here? -------------------------------------------------------- */
  const risk = deathChance({ age: input.age, health, conditions });
  if (input.draw(slot) < risk) {
    events.push({ kind: 'died', cause: causeOf(health, conditions, input.age) });
    return { health, vitality, deficit, conditions, alive: false, events };
  }

  return { health, vitality, deficit, conditions, alive: true, events };
}

/**
 * What it says on the certificate.
 *
 * The worst thing wrong with them, or age, or — for the healthy character spec
 * 559 says this should almost never happen to — nothing anybody saw coming.
 * 0212 builds the death screen; this is the fact it will render.
 */
export function causeOf(health: number, conditions: readonly HeldCondition[], age: number): string {
  const worst = [...conditions].sort((a, b) => {
    const left = findCondition(a.conditionId);
    const right = findCondition(b.conditionId);
    return (right?.hazard ?? 0) - (left?.hazard ?? 0);
  })[0];
  if (worst) return findCondition(worst.conditionId)?.label ?? 'Their health';
  if (age >= 78) return 'Old age';
  if (health < 40) return 'Their health, which had not been right for a while';
  return 'Nothing anybody saw coming';
}
