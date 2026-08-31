/**
 * @yearafter/events — the event engine (Ticket 0203).
 *
 * The engine is generic; every event is data in @yearafter/content. There is no
 * `switch` on an event id here and there must never be one — that is the line
 * between a library that can grow to thousands of entries and one that cannot.
 */

export * from './context';
export * from './conditions';
export * from './effects';
export * from './history';
export * from './select';
export * from './text';
