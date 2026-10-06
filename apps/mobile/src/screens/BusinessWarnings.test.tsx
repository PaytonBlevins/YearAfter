import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { findBusinessType } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import {
  BUSINESS_LOAN_PRODUCTS,
  newBusiness,
  runLoanYear,
  type OwnedBusiness,
} from '@yearafter/finance';
import { createNewGame, offerFor, viewOf, type GameState } from '@yearafter/simulation';
import { ActionButton, ListRow } from '../components';
import { BusinessWarning, businessWarning } from '../components/BusinessWarning';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { BusinessScreen, BusinessesScreen } from './BusinessesScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const sell = vi.fn();
const close = vi.fn();
const pop = vi.fn();
const push = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
function fixture(profit = -10_000, cash = 2_000): GameState {
  const base = createNewGame({ seed: 'business-warning' });
  const type = findBusinessType('biz.cleaning');
  if (!type) throw new Error('Missing business type');
  const business: OwnedBusiness = {
    ...newBusiness(type, 'biz:warning', 'Wren Cleaning', base.world.year - 2, 1),
    cash: dollars(cash),
    last: {
      year: base.world.year,
      profit,
      revenue: 90_000,
      costs: 100_000,
      drawn: 0,
      injected: 0,
      turnedAway: 0,
      idle: 0,
    },
  };
  return {
    ...base,
    player: { ...base.player, age: 30, cash: dollars(20_000) },
    businesses: [business],
  };
}
function withLoan(state: GameState, behind = false, balance = 20_000): GameState {
  const product = BUSINESS_LOAN_PRODUCTS[0];
  if (!product) throw new Error('Missing business loan');
  return {
    ...state,
    loans: [
      {
        productId: product.id,
        businessId: 'biz:warning',
        principal: dollars(balance),
        balance: dollars(balance),
        termLeft: 4,
        inArrears: behind,
      },
    ],
  };
}
function warningFor(state: GameState) {
  const business = state.businesses[0];
  if (!business) throw new Error('Missing business');
  const view = viewOf(state, business);
  if (!view) throw new Error('Missing view');
  return businessWarning(
    business,
    view,
    state.loans.find((loan) => loan.businessId === business.id),
  );
}
async function mount(state: GameState, hub = false) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({
    state,
    tuneBusiness: vi.fn(),
    sellABusiness: sell,
    closeABusiness: close,
    expandABusiness: vi.fn(),
    closeALocation: vi.fn(),
  });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    current: { screen: 'business', title: 'Business', businessId: state.businesses[0]?.id },
    pop,
    push,
  });
  await act(() => {
    rendered = create(hub ? <BusinessesScreen /> : <BusinessScreen />);
  });
}
function text() {
  if (!rendered) throw new Error('Not rendered');
  return rendered.root
    .findAll((node) => typeof node.type === 'string' && String(node.type) === 'Text')
    .map((node) => node.children.filter((child) => typeof child === 'string').join(''))
    .join(' ');
}
async function press(label: string) {
  const button = rendered?.root
    .findAllByType(ActionButton)
    .find((node) => node.props.label === label);
  if (!button) throw new Error(`Missing button ${label}`);
  await act(() => button.props.onPress());
}

describe('A3 business failure warnings using real finance readers', () => {
  it('shows the settlement cost including restored working cash, not just the deficit', async () => {
    const state = fixture();
    // Costs 100k: reserve 25k, half reserve 12.5k plus an 8k hole.
    expect(warningFor(state).rescue).toBe(20_500);
    await mount(state);
    expect(text()).toContain('need about $20,500 from you');
    expect(text()).toContain("you couldn't cover that amount");
    expect(text()).toContain('before advancing the year');
    expect(text()).toContain("You can't decline that rescue yet");
  });
  it('does not call an affordable rescue unaffordable at the exact boundary', async () => {
    const state = fixture();
    await mount({ ...state, player: { ...state.player, cash: dollars(20_500) } });
    expect(text()).toContain('You have $20,500 in your bank now');
    expect(text()).not.toContain("couldn't cover");
  });
  it('shows a loss warning without a rescue cost when business cash covers it exactly', async () => {
    const state = fixture(-10_000, 10_000);
    expect(warningFor(state).rescue).toBe(0);
    await mount(state);
    expect(text()).toContain('could cover another trading year');
    expect(text()).not.toContain('need about');
    expect(text()).toContain('estimates, not a forecast');
  });
  it('warns of a loan gap despite positive trading profit using the real loan quote', async () => {
    const state = withLoan(fixture(1_000, 0));
    const business = state.businesses[0];
    if (!business) throw new Error('Missing business');
    const view = viewOf(state, business);
    if (!view?.loan) throw new Error('Missing loan view');
    const payment = runLoanYear(state.loans, Number.POSITIVE_INFINITY, false).charges.reduce(
      (sum, charge) => sum - Number(charge.amount) / 100,
      0,
    );
    expect(warningFor(state).loanGap).toBe(payment - 1_000);
    await mount(state);
    expect(text()).toContain(
      `next yearly loan payment is about $${payment.toLocaleString('en-US')}`,
    );
    expect(text()).toContain('short of that payment');
    expect(text()).not.toContain("Last year's loss");
  });
  it('warns about arrears even when the business can cover the next loan payment', async () => {
    const state = withLoan(fixture(50_000, 100_000), true);
    expect(warningFor(state).loanGap).toBe(0);
    await mount(state);
    expect(text()).toContain('The unpaid balance is growing');
  });
  it('does not warn when cash plus positive profit cover the loan exactly', () => {
    const state = withLoan(fixture(0, 0));
    const business = state.businesses[0];
    if (!business) throw new Error('Missing business');
    const view = viewOf(state, business);
    if (!view?.loan) throw new Error('Missing loan');
    const paid = {
      ...state,
      businesses: [{ ...business, cash: dollars(warningFor(state).loanPayment) }],
    };
    expect(warningFor(paid).show).toBe(false);
  });
  it('includes newly accrued interest even if cash covers the dashboard quote', () => {
    const state = withLoan(fixture(0, 0));
    const business = state.businesses[0];
    if (!business) throw new Error('Missing business');
    const view = viewOf(state, business);
    if (!view?.loan) throw new Error('Missing loan');
    const atQuote = { ...state, businesses: [{ ...business, cash: dollars(view.loan.yearly) }] };
    expect(warningFor(atQuote).show).toBe(true);
    expect(warningFor(atQuote).loanGap).toBeGreaterThan(0);
    expect(warningFor(atQuote).loanPayment).toBeGreaterThan(view.loan.yearly);
  });
  it('retains the previous rescue warning even if last trading profit is nonnegative', async () => {
    const state = fixture(1_000, 10_000);
    const business = state.businesses[0];
    if (!business?.last) throw new Error('Missing history');
    await mount({
      ...state,
      businesses: [{ ...business, last: { ...business.last, injected: 5_000 } }],
    });
    expect(text()).toContain('You already helped it through');
    expect(text()).toContain('$5,000');
  });
  it('shows a no-history loan gap without inventing last year results', async () => {
    const state = withLoan(fixture(0, 0));
    const business = state.businesses[0];
    if (!business) throw new Error('Missing business');
    const { last: _last, ...newlyOpened } = business;
    await mount({ ...state, businesses: [newlyOpened] });
    expect(text()).toContain('Before any new trading income');
    expect(text()).not.toContain("If last year's trading result repeats");
  });
  it.each([0, 1_000])('does not show a warning for a healthy profit of %s', async (profit) => {
    await mount(fixture(profit, 100_000));
    expect(
      rendered?.root.findAllByType(BusinessWarning)[0]?.findAllByType(ActionButton),
    ).toHaveLength(0);
    expect(text()).not.toContain('Business cash is under pressure');
  });
  it('puts the warning in the business hub and keeps navigation', async () => {
    const state = fixture();
    await mount(state, true);
    const row = rendered?.root
      .findAllByType(ListRow)
      .find((node) => node.props.title === 'Wren Cleaning');
    expect(row?.props.subtitle).toContain('Cash warning — open to review');
    await act(() => row?.props.onPress());
    expect(push).toHaveBeenCalledWith({
      screen: 'business',
      title: 'Wren Cleaning',
      businessId: 'biz:warning',
    });
  });
  it('opens selling for review and requires a separate confirmation', async () => {
    const state = withLoan(fixture());
    await mount(state);
    await press('Review selling');
    expect(sell).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(text()).toContain('before repaying any business loan');
    expect(text()).toContain('any debt left stays with you');
    const confirm = rendered?.root
      .findAllByType(ActionButton)
      .find((node) => String(node.props.label).startsWith('Sell for'));
    const business = state.businesses[0];
    if (!business) throw new Error('Missing business');
    const offer = offerFor(state, business.id);
    const view = viewOf(state, business);
    if (!offer || !view?.loan) throw new Error('Missing quote');
    expect(confirm?.props.label).toBe(
      `Sell for $${Math.max(0, offer.proceeds - view.loan.owed).toLocaleString('en-US')}`,
    );
    await act(() => confirm?.props.onPress());
    expect(sell).toHaveBeenCalledWith('biz:warning');
    expect(pop).toHaveBeenCalledOnce();
  });
  it('opens closure for review and requires a separate confirmation', async () => {
    await mount(fixture());
    await press('Review closing');
    expect(close).not.toHaveBeenCalled();
    expect(sell).not.toHaveBeenCalled();
    expect(text()).toContain('Any business loan is paid first');
    await press('Close it for good');
    expect(close).toHaveBeenCalledWith('biz:warning');
  });
});
