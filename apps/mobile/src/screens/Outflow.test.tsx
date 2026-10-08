import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { dollars } from '@yearafter/core';
import { findBusinessType } from '@yearafter/content';
import {
  CARD_PRODUCTS,
  EMPTY_LEDGER,
  newBusiness,
  post,
  type OwnedHome,
  type OwnedVehicle,
} from '@yearafter/finance';
import { createNewGame, type GameState } from '@yearafter/simulation';
import { ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { FinancesScreen } from './FinancesScreen';
import { OutflowScreen } from './OutflowScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
const base = (): GameState => {
  const state = createNewGame({ seed: 'outflow-sources' });
  return { ...state, player: { ...state.player, age: 25 } };
};
async function screen(state: GameState, dashboard = false) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
  await act(() => {
    rendered = create(dashboard ? <FinancesScreen /> : <OutflowScreen />);
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
const home: OwnedHome = {
  id: 'home:outflow',
  kindId: 'home:test',
  beds: 3,
  baths: 2,
  builtYear: 2000,
  condition: 'good',
  regionKey: 'us:ohio',
  regionName: 'Ohio',
  purchasePrice: dollars(100_000),
  value: dollars(100_000),
  boughtYear: 2025,
  expenseRate: 0.02,
  behindYears: 0,
};
const vehicle: OwnedVehicle = {
  id: 'vehicle:outflow',
  trimId: 'trim:test',
  modelYear: 2025,
  boughtYear: 2025,
  purchasePrice: dollars(20_000),
  value: dollars(20_000),
  condition: 90,
  history: 'full',
  accident: false,
  behindYears: 0,
};
const spending = (): GameState => {
  const state = base();
  let finance = post(EMPTY_LEDGER, state.world.year, 25, {
    category: 'salary',
    amount: dollars(100_000),
    source: 'test income',
  }).ledger;
  for (const [category, amount, source] of [
    ['living', 12_000, 'private living transaction'],
    ['tax', 6_000, 'private tax transaction'],
    ['spending', 6_000, 'private one-off transaction'],
    ['property', 20_000, 'private car purchase'],
    ['investment', 10_000, 'private share purchase'],
  ] as const)
    finance = post(finance, state.world.year, 25, {
      category,
      amount: dollars(-amount),
      source,
    }).ledger;
  finance = post(finance, state.world.year - 1, 24, {
    category: 'living',
    amount: dollars(-1_200),
    source: 'private old-year transaction',
  }).ledger;
  return { ...state, finance, player: { ...state.player, cash: finance.balance } };
};

describe('A10 — linked cost sources without an expense ledger', () => {
  it.each([false, true])(
    'opens the sources view from the dashboard, with recorded spending=%s',
    async (recorded) => {
      const rows = await screen(recorded ? spending() : base(), true);
      const row = rows.find((candidate) => candidate.props.title === 'Monthly outflow');
      expect(row?.props.onPress).toBeTypeOf('function');
      await act(() => row?.props.onPress());
      expect(push).toHaveBeenCalledWith({ screen: 'outflow', title: 'Monthly outflow' });
    },
  );
  it('matches the dashboard total, excludes transfers and previous-year spending, and explains averaging', async () => {
    const state = spending();
    const rows = await screen(state);
    expect(rows.find((row) => row.props.title === 'Monthly average')?.props.value).toBe('$2,000');
    expect(rows.find((row) => row.props.title === 'Monthly average')?.props.subtitle).toContain(
      String(state.world.year),
    );
    expect(text()).toContain('not a bill for next month');
    expect(text()).toContain("investment or property transfers aren't included");
    expect(text()).not.toContain('private');
    for (const row of rows.filter((row) => row.props.title !== 'Monthly average'))
      expect(row.props.value).toBeUndefined();
    await act(() => rendered?.unmount());
    rendered = undefined;
    const dashboard = await screen(state, true);
    expect(dashboard.find((row) => row.props.title === 'Monthly outflow')?.props.value).toBe(
      '$2,000',
    );
  });
  it('shows zero honestly and opens the P2 lifestyle choice without exposing a ledger', async () => {
    const rows = await screen({ ...base(), finance: EMPTY_LEDGER });
    expect(rows.find((row) => row.props.title === 'Monthly average')?.props.value).toBe(
      'Nothing going out',
    );
    const living = rows.find((row) => row.props.title === 'Living costs');
    expect(living?.props.onPress).toBeTypeOf('function');
    await act(() => living?.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'lifestyle', title: 'Lifestyle' });
    const tax = rows.find((row) => row.props.title === 'Income tax');
    expect(tax?.props.onPress).toBeUndefined();
    expect(tax?.props.value).toBeUndefined();
    expect(rows.filter((row) => row.props.onPress)).toHaveLength(1);
  });
  it.each(['Borrowing', 'Children', 'Homes', 'Vehicles', 'Businesses'] as const)(
    'opens the existing %s screen without category amounts',
    async (title) => {
      let state = base();
      let target = '';
      if (title === 'Borrowing') {
        const product = CARD_PRODUCTS[0];
        if (!product) throw new Error('Missing card');
        state = {
          ...state,
          cards: [
            { productId: product.id, limit: dollars(2_000), balance: dollars(500), status: 'open' },
          ],
        };
        target = 'debt';
      } else if (title === 'Children') {
        const member = state.family.members[0];
        if (!member) throw new Error('Missing family');
        state = { ...state, family: { ...state.family, members: [{ ...member, role: 'child' }] } };
        target = 'family';
      } else if (title === 'Homes') {
        state = { ...state, homes: [home] };
        target = 'homes';
      } else if (title === 'Vehicles') {
        state = { ...state, vehicles: [vehicle] };
        target = 'vehicles';
      } else {
        const type = findBusinessType('biz.cleaning');
        if (!type) throw new Error('Missing business');
        state = {
          ...state,
          businesses: [newBusiness(type, 'biz:outflow', 'Wren’s Place', state.world.year, 1)],
        };
        target = 'businesses';
      }
      const rows = await screen(state);
      const row = rows.find((candidate) => candidate.props.title === title);
      expect(row).toBeDefined();
      expect(row?.props.value).toBeUndefined();
      await act(() => row?.props.onPress());
      expect(push).toHaveBeenCalledWith({
        screen: target,
        title: title === 'Borrowing' ? 'Debt' : title === 'Children' ? 'Family' : title,
      });
      expect(text()).toContain("aren't a complete list of transactions");
    },
  );
  it.each(['college', 'postgrad', 'vocational'] as const)(
    'opens the enrolled %s program for its own tuition details',
    async (stage) => {
      const state = base();
      const rows = await screen({ ...state, education: { ...state.education, stage } });
      await act(() => rows.find((row) => row.props.title === 'Your program')?.props.onPress());
      expect(push).toHaveBeenCalledWith({ screen: 'program', title: 'Your program' });
    },
  );
});
