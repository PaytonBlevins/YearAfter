/** P1: a saved quote cannot create equity or forgive a lender's balance. */
import { BUSINESS_LOAN_PRODUCTS, settleYear, yearlyPaymentFor } from '@yearafter/finance';
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown): value is number => Number.isSafeInteger(value);
const positive = (value: unknown): value is number => integer(value) && value > 0;
export function businessRescueOk(save: Record<string, unknown>): boolean {
  const review = save['businessRescue'];
  const pending = save['pending'];
  if (!Array.isArray(pending)) return false;
  const decisions = pending.filter((row) => object(row) && row['eventId'] === 'business.rescue');
  if (review === undefined) return decisions.length === 0;
  if (
    !object(review) ||
    !Array.isArray(review['cases']) ||
    review['cases'].length < 1 ||
    review['cases'].length > 4
  )
    return false;
  const world = save['world'];
  const player = save['player'];
  if (
    !object(world) ||
    review['year'] !== world['year'] ||
    !integer(review['year']) ||
    !object(player) ||
    player['alive'] !== true ||
    decisions.length !== 1
  )
    return false;
  const businesses = save['businesses'];
  const loans = save['loans'];
  if (!Array.isArray(businesses) || !Array.isArray(loans)) return false;
  const ids = new Set<string>();
  const choices: string[] = [];
  for (const row of review['cases']) {
    if (
      !object(row) ||
      typeof row['businessId'] !== 'string' ||
      ids.has(row['businessId']) ||
      !positive(row['amount']) ||
      !integer(row['loanPayment']) ||
      row['loanPayment'] < 0
    )
      return false;
    ids.add(row['businessId']);
    choices.push(`inject:${row['businessId']}`, `close:${row['businessId']}`);
    const business = businesses.find((held) => object(held) && held['id'] === row['businessId']);
    if (
      !object(business) ||
      !integer(business['cash']) ||
      !object(business['last']) ||
      business['last']['year'] !== review['year'] ||
      !integer(business['last']['costs']) ||
      business['last']['costs'] < 0
    )
      return false;
    const cash = business['cash'] / 100;
    const needed = settleYear(cash, 0, business['last']['costs']).needed;
    if (row['amount'] !== needed + Math.max(0, row['loanPayment'] - Math.max(0, cash)))
      return false;
    if (row['loanPayment'] === 0) {
      if (
        row['loanProductId'] !== undefined ||
        row['loanBalance'] !== undefined ||
        row['fundedLoan'] !== undefined
      )
        return false;
      continue;
    }
    const held = loans.find(
      (loan) =>
        object(loan) &&
        loan['businessId'] === row['businessId'] &&
        loan['productId'] === row['loanProductId'],
    );
    const product = BUSINESS_LOAN_PRODUCTS.find((type) => type.id === row['loanProductId']);
    if (
      !object(held) ||
      !product ||
      !positive(held['balance']) ||
      !positive(held['principal']) ||
      !integer(held['termLeft']) ||
      held['termLeft'] < 0 ||
      held['inArrears'] !== true ||
      held['balance'] !== row['loanBalance']
    )
      return false;
    const due = yearlyPaymentFor(product, held['balance'] / 100, held['termLeft']);
    if (due !== row['loanPayment'] || cash >= due) return false;
    const balance = Math.max(0, Math.round(held['balance'] / 100 - due)) * 100;
    const funded = row['fundedLoan'];
    if (balance === 0) {
      if (funded !== undefined) return false;
    } else if (
      !object(funded) ||
      funded['businessId'] !== held['businessId'] ||
      funded['productId'] !== held['productId'] ||
      funded['principal'] !== held['principal'] ||
      funded['balance'] !== balance ||
      funded['termLeft'] !== Math.max(0, held['termLeft'] - 1) ||
      funded['inArrears'] !== false
    )
      return false;
  }
  const decision = decisions[0];
  if (
    !object(decision) ||
    decision['year'] !== review['year'] ||
    decision['age'] !== player['age'] ||
    !Array.isArray(decision['choices'])
  )
    return false;
  const actual = decision['choices'].map((choice) => (object(choice) ? choice['id'] : undefined));
  return (
    actual.length === choices.length &&
    choices.every((id) => actual.filter((candidate) => candidate === id).length === 1)
  );
}
