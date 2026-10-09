/**
 * @yearafter/careers — ordinary employment (Ticket 0210).
 *
 * Spec 1670: apply, a simple interview abstraction, salary, Work Harder,
 * resign, firing, promotion. Spec 1461: data driven, reusable templates, one
 * engine.
 *
 * Pure with respect to game state; it never imports @yearafter/simulation, so
 * the balance tooling can run ten thousand careers in plain Node.
 */

export * from './jobs';
export * from './pay';
export * from './employment';
export * from './openings';
export * from './offers';
export * from './growth';
export * from './partner';
export * from './partner-career';

export * from './listing-exposure';
