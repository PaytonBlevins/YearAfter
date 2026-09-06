/**
 * @yearafter/parenting — having and raising children (Ticket 0208).
 *
 * Spec 1666: pregnancy, birth, adoption, child aging.
 *
 * Pure with respect to game state; it never imports @yearafter/simulation, so
 * the balance tooling can run ten thousand families in plain Node.
 */

export * from './parenting';
export * from './adoption';
export * from './state';
