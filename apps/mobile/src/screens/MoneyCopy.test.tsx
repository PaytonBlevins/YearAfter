import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { findBusinessType } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import {
  CARD_PRODUCTS,
  LOAN_PRODUCTS,
  CREDIT_LABELS,
  newBusiness,
  type RefusedBecause,
  type LoanRefusal,
} from '@yearafter/finance';
import { cardOffers, loanOffers, createNewGame, type GameState } from '@yearafter/simulation';
import { ActionButton, ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { CardsScreen } from './CardsScreen';
import { LoansScreen } from './LoansScreen';
import { BusinessScreen, BusinessesScreen } from './BusinessesScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
vi.mock('@yearafter/simulation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@yearafter/simulation')>();
  return { ...original, cardOffers: vi.fn(), loanOffers: vi.fn() };
});
let rendered: ReactTestRenderer | undefined;
const applyForCard = vi.fn();
const borrow = vi.fn();
const tuneBusiness = vi.fn();
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
const base = (): GameState => {
  const state = createNewGame({ seed: 'money-copy' });
  return { ...state, player: { ...state.player, age: 25 } };
};
async function screen(element: React.ReactElement, state = base()) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({
    state,
    applyForCard,
    borrow,
    tuneBusiness,
  });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    current: { screen: 'business', title: 'Business', businessId: state.businesses[0]?.id },
    pop: vi.fn(),
    push: vi.fn(),
  });
  await act(() => {
    rendered = create(element);
  });
  if (!rendered) throw new Error('Screen did not render');
  return rendered.root.findAllByType(ListRow);
}
const text = () => {
  if (!rendered) throw new Error('Screen did not render');
  return rendered.root
    .findAll((node) => typeof node.type === 'string' && String(node.type) === 'Text')
    .map((node) => node.children.filter((child) => typeof child === 'string').join(''))
    .join(' ');
};
const cardProduct = CARD_PRODUCTS[0];
const loanProduct = LOAN_PRODUCTS.find((product) => product.needsIncome > 0);
if (!cardProduct || !loanProduct) throw new Error('Missing product fixtures');
const cardCases: [RefusedBecause, string][] = [
  ['tooManyCards', 'You already have five credit cards'],
  ['alreadyHeld', 'You already have this card'],
  ['standing', "Your credit doesn't meet this card's requirements yet"],
  ['income', 'Your income is too low for this card'],
  ['tooMuchOwed', "You've reached the total credit limit lenders will offer you"],
  ['noDeposit', "You don't have enough cash for the deposit"],
];
const loanCases: [LoanRefusal, string][] = [
  ['tooYoung', "You can borrow once you're eighteen"],
  ['tooManyLoans', 'You already have four active loans'],
  ['alreadyHeld', 'You already have this loan'],
  ['standing', `Requires ${CREDIT_LABELS[loanProduct.needs].toLowerCase()} credit`],
  [
    'income',
    `Requires at least $${loanProduct.needsIncome.toLocaleString('en-US')} in yearly income`,
  ],
  ['notStudying', 'This loan is for education costs'],
  ['tooMuchOwed', "Your existing debt is already at the lender's limit"],
  ['fullyDrawn', "You've already borrowed the full amount available for your tuition"],
  ['noCollateral', 'You need investments to use as security for this loan'],
];

describe('A5 — spoken money and business copy', () => {
  it.each(cardCases)(
    'explains card refusal %s and preserves its disabled action',
    async (because, expected) => {
      vi.mocked(cardOffers).mockReturnValue([
        {
          product: cardProduct,
          decision: { approved: false, because, limit: dollars(0) },
        },
      ]);
      const rows = await screen(<CardsScreen />);
      const row = rows.find((candidate) => candidate.props.title === cardProduct.name);
      expect(row?.props.subtitle).toBe(expected);
      expect(row?.props.disabled).toBe(true);
      expect(row?.props.onPress).toBeUndefined();
      expect(applyForCard).not.toHaveBeenCalled();
    },
  );
  it.each(loanCases)(
    'explains loan refusal %s with the actual requirement',
    async (because, expected) => {
      vi.mocked(loanOffers).mockReturnValue([
        {
          product: loanProduct,
          decision: { approved: false, because, offered: dollars(0), yearlyPayment: dollars(0) },
        },
      ]);
      const rows = await screen(<LoansScreen />);
      const row = rows.find((candidate) => candidate.props.title === loanProduct.name);
      expect(row?.props.subtitle).toBe(expected);
      expect(row?.props.disabled).toBe(true);
      expect(row?.props.onPress).toBeUndefined();
      expect(borrow).not.toHaveBeenCalled();
    },
  );
  it('keeps a successful card application wired to its product', async () => {
    vi.mocked(cardOffers).mockReturnValue([
      {
        product: cardProduct,
        decision: { approved: true, limit: dollars(2_000) },
      },
    ]);
    const rows = await screen(<CardsScreen />);
    await act(() => rows.find((row) => row.props.title === cardProduct.name)?.props.onPress());
    expect(applyForCard).toHaveBeenCalledWith(cardProduct.id);
  });
  it('keeps loan amounts behind the existing choice and explains automatic repayment', async () => {
    vi.mocked(loanOffers).mockReturnValue([
      {
        product: loanProduct,
        decision: { approved: true, offered: dollars(4_000), yearlyPayment: dollars(500) },
      },
    ]);
    const rows = await screen(<LoansScreen />);
    expect(text()).toContain('scheduled payment comes out automatically each year');
    await act(() => rows.find((row) => row.props.title === loanProduct.name)?.props.onPress());
    expect(borrow).not.toHaveBeenCalled();
    if (!rendered) throw new Error('No screen');
    await act(() =>
      rendered?.root
        .findAllByType(ActionButton)
        .find((button) => button.props.label === 'Take $1,000')
        ?.props.onPress(),
    );
    expect(borrow).toHaveBeenCalledWith(loanProduct.id, 1_000);
  });
  it('explains the card age gate in plain language', async () => {
    const state = base();
    await screen(<CardsScreen />, { ...state, player: { ...state.player, age: 17 } });
    expect(text()).toContain("You can apply for a credit card once you're eighteen");
  });
  it('explains startup payment without implying cash is the only option', async () => {
    const state = base();
    await screen(<BusinessesScreen />, {
      ...state,
      player: { ...state.player, cash: dollars(1_000_000) },
    });
    expect(text()).toContain('using cash, a card, or any loan you choose');
    expect(text()).toContain('pays you from its profits');
  });
  it('explains prices and locations directly while retaining staffing controls', async () => {
    const type = findBusinessType('biz.cleaning');
    if (!type) throw new Error('Missing business fixture');
    const state = base();
    const business = newBusiness(type, 'biz:copy', 'Wren’s Place', state.world.year, 1);
    const rows = await screen(<BusinessScreen />, { ...state, businesses: [business] });
    expect(rows.find((row) => row.props.title === 'Business cash')).toBeDefined();
    expect(rows.find((row) => row.props.title === 'Open locations')).toBeDefined();
    expect(text()).toContain('Higher prices bring in more per sale, but fewer customers buy');
    expect(text()).toContain('its own lease and staff');
    const manager = rows.find((row) => row.props.title === 'Let a manager handle staffing');
    expect(manager).toBeDefined();
    await act(() => manager?.props.onPress());
    expect(tuneBusiness).toHaveBeenCalledWith(business.id, {
      kind: 'auto',
      on: !business.autoStaff,
    });
  });
});
