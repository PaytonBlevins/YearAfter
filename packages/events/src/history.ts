/**
 * Ticket 0203 — what the event engine remembers.
 *
 * Three things, all serialisable, all part of the save:
 *
 *  - `lastFired`: the age each event last occurred, which is what cooldowns and
 *    once-per-life events are checked against.
 *  - `scheduled`: delayed consequences (spec 725–770 "multi-year chains").
 *  - `flags`: story state. A flag is the only way an event tells a later event
 *    that something happened, which keeps chains inspectable in a save file
 *    instead of hidden in derived logic.
 *
 * Kept as plain arrays and records rather than Maps and Sets so the whole thing
 * round-trips through JSON with no conversion step to get wrong.
 */

export interface ScheduledEvent {
  readonly eventId: string;
  /** The age at which it becomes due. */
  readonly atAge: number;
  /** The event that scheduled it, for debugging a chain that misbehaves. */
  readonly sourceId: string;
}

export interface EventHistory {
  readonly lastFired: Readonly<Record<string, number>>;
  readonly scheduled: readonly ScheduledEvent[];
  readonly flags: readonly string[];
}

export const EMPTY_HISTORY: EventHistory = { lastFired: {}, scheduled: [], flags: [] };

export const createEventHistory = (): EventHistory => EMPTY_HISTORY;

/**
 * Has this event's cooldown elapsed?
 *
 * `cooldown` absent means once per life — the right default, because most events
 * are things that happen to you rather than habits. An event that should recur
 * says so explicitly.
 */
export function isOffCooldown(
  history: EventHistory,
  eventId: string,
  cooldown: number | undefined,
  age: number,
): boolean {
  const last = history.lastFired[eventId];
  if (last === undefined) return true;
  if (cooldown === undefined) return false;
  return age - last >= cooldown;
}

export function recordFired(history: EventHistory, eventId: string, age: number): EventHistory {
  return { ...history, lastFired: { ...history.lastFired, [eventId]: age } };
}

export function schedule(history: EventHistory, entry: ScheduledEvent): EventHistory {
  return { ...history, scheduled: [...history.scheduled, entry] };
}

export const dueAt = (history: EventHistory, age: number): readonly ScheduledEvent[] =>
  history.scheduled.filter((entry) => entry.atAge <= age);

/** Drop everything due at or before `age`, fired or not. Nothing lingers. */
export function clearDue(history: EventHistory, age: number): EventHistory {
  return { ...history, scheduled: history.scheduled.filter((entry) => entry.atAge > age) };
}

export function withFlags(
  history: EventHistory,
  set: readonly string[] = [],
  clear: readonly string[] = [],
): EventHistory {
  const flags = new Set(history.flags);
  for (const flag of set) flags.add(flag);
  for (const flag of clear) flags.delete(flag);
  return { ...history, flags: [...flags].sort() };
}
