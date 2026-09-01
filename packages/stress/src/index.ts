/**
 * @yearafter/stress — the stress foundation (Ticket 0205).
 *
 * Spec 1660: backend stress from workload and relationships, with no manual
 * time-budget UI. Spec 1986: players may overcommit rather than being blocked,
 * and the game models the consequences.
 *
 * Pure with respect to game state — it never imports @yearafter/simulation.
 */

export * from './stress';
