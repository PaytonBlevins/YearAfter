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
