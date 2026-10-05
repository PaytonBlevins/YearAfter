/**
 * @yearafter/finance — the ledger (Ticket 0301).
 *
 * Spec 21 is the shape of this whole package in two sentences: *"Keep the
 * detailed ledger on the backend for correctness and QA. Do not show
 * month-by-month accounting to the player."* So there is no screen here and
 * there is not going to be one. 0304 builds a dashboard that reads totals.
 *
 * Depends only on `@yearafter/core`, like every domain package, and knows
 * nothing about GameState.
 */

export * from './ledger';
export * from './living';
export * from './summary';
export * from './credit';
export * from './cards';
export * from './loans';
export * from './investments';
export * from './market';
export * from './portfolio';

/* The financial pages (Ticket 0308d). */
export * from './briefing';

/* Advisors (Ticket 0309). */
export * from './advisors';

/* Retirement (Ticket 0310). */
export * from './retirement';

/* Ticket 0501 — owning a home, and the mortgage that pays for it. */
export * from './property';
export * from './rental';
export * from './commercial';
export * from './vehicles';
export * from './renovations';
export * from './valuables';
export * from './auctions';
export * from './businesses';
export * from './business-events';
export * from './private-deals';
