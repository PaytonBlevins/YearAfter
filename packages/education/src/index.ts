/**
 * @yearafter/education — schooling (Ticket 0204).
 *
 * Spec 75: intentionally lightweight, so players reach the adult world quickly.
 * Spec 74: no attendance, no sleep, no class-by-class management.
 *
 * Pure with respect to game state — it never imports @yearafter/simulation, so
 * the balance tooling can run ten thousand school careers in plain Node.
 */

export * from './school';
export * from './performance';
export * from './workload';
export * from './activities';
export * from './progression';
export * from './study';
