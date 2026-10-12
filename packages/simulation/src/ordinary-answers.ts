/**
 * Test helper: how a cohort harness answers the questions a life raises, so that an "ordinary life" measurement is of an
 * ordinary life.
 *
 * The cohort tests of the money model (median cash, net worth, partner pay) answer every question with its first
 * choice. Since the entertainment tickets (0801–0808) the first choice of a scholarship, a contract, a part, a record
 * deal or a modeling job is to take it, so a harness that says yes to everything puts every life that is offered one on
 * a team, a stage or a runway, with the pay that goes with it. That measures the entertainment world, which has its own
 * calibration (`sports-0801.test.ts` and the tickets after it), not the working life these tests are about. They decline
 * the offers instead. (CORE_RULES 13.170 in the numbering of the tickets that wrote it.)
 */

const ENTERTAINMENT_OFFERS = new Set([
  'sports.offer',
  'acting.offer',
  'music.offer',
  'modeling.offer',
]);

/** The choice an ordinary-life harness makes: the first, except that an entertainment offer is turned down. */
export function ordinaryChoice<T extends { readonly id: string }>(decision: {
  readonly eventId: string;
  readonly choices: readonly T[];
}): T | undefined {
  if (ENTERTAINMENT_OFFERS.has(decision.eventId)) {
    return decision.choices.find((choice) => choice.id === 'decline') ?? decision.choices[0];
  }
  return decision.choices[0];
}
