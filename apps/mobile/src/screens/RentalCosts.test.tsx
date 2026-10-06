import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { HOME_KINDS } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import { MORTGAGE_PRODUCTS, emptyLetting, type OwnedHome, type Tenant } from '@yearafter/finance';
import { createNewGame, economicsOf } from '@yearafter/simulation';
import { ActionButton, ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { RentalScreen } from './RentalScreen';
import { HomesScreen } from './HomesScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const letting = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
const kind = HOME_KINDS.find((candidate) => candidate.units === 2);
if (!kind) throw new Error('A two-unit property is needed');
const home = (over: Partial<OwnedHome> = {}): OwnedHome => ({
  id: 'home:rental-costs',
  kindId: kind.id,
  beds: 3,
  baths: 2,
  builtYear: 2000,
  condition: 'good',
  regionKey: 'us:ohio',
  regionName: 'Ohio',
  purchasePrice: dollars(100_000),
  boughtYear: 2025,
  value: dollars(100_000),
  expenseRate: 0.096,
  behindYears: 0,
  ...over,
});
const tenant: Tenant = {
  id: 'tenant:wren',
  name: 'Wren',
  since: 2025,
  income: 80_000,
  credit: 'good',
  work: 'steady',
  household: 1,
  evictions: 0,
};
const occupied = (over: Partial<OwnedHome> = {}) =>
  home({
    letting: { ...emptyLetting(2), tenants: [tenant, null] },
    ...over,
  });
const money = (n: number) =>
  `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
async function screen(property: OwnedHome, homes = false) {
  const state = createNewGame({ seed: 'rental-costs' });
  vi.mocked(useGame, { partial: true }).mockReturnValue({
    state: { ...state, player: { ...state.player, age: 25 }, homes: [property] },
    letting,
  });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    current: { screen: 'rental', title: 'Rental', homeId: property.id },
    push: vi.fn(),
  });
  await act(() => {
    rendered = create(homes ? <HomesScreen /> : <RentalScreen />);
  });
  return rendered!.root.findAllByType(ListRow);
}
const text = () =>
  rendered!.root
    .findAll((node) => typeof node.type === 'string' && String(node.type) === 'Text')
    .map((node) => node.children.filter((child) => typeof child === 'string').join(''))
    .join(' ');

describe('A7 — visible rental costs', () => {
  it('shows gross rent and whole-property monthly costs before renting out', async () => {
    const rows = await screen(home());
    expect(rows.find((row) => row.props.title === 'Gross rent at the going rate')).toBeDefined();
    const cost = rows.find((row) => row.props.title === 'Property tax and upkeep');
    expect(cost?.props.value).toBe('$800 a month');
    expect(cost?.props.meta).toBe('$9,600 a year for the whole property');
    expect(text()).toContain('assumes every unit pays for a full year');
  });
  it('subtracts property costs from the fully occupied preview', async () => {
    const property = home();
    const numbers = economicsOf(property);
    const rows = await screen(property);
    expect(
      rows.find((row) => row.props.title === 'Rent after costs if fully occupied')?.props.value,
    ).toBe(`${money(numbers.fullYear / 12 - 800)} a month`);
  });
  it('keeps the rent-out command available', async () => {
    await screen(home());
    await act(() =>
      rendered!.root
        .findAllByType(ActionButton)
        .find((button) => button.props.label === 'Rent it out')
        ?.props.onPress(),
    );
    expect(letting).toHaveBeenCalledWith({ type: 'rentOut', homeId: home().id });
  });
  it('labels rent per unit as gross while charging costs once for the property', async () => {
    const rows = await screen(occupied());
    expect(rows.find((row) => row.props.title === 'Gross rent per unit')?.props.subtitle).toContain(
      'before property costs',
    );
    expect(rows.find((row) => row.props.title === 'Let')?.props.value).toBe('1 of 2');
    expect(rows.find((row) => row.props.title === 'Property tax and upkeep')?.props.value).toBe(
      '$800 a month',
    );
    expect(text()).toContain('Costs are for the whole property, not each unit');
  });
  it('shows agent fees and the projection monthly at current occupancy', async () => {
    const property = occupied({
      letting: { ...emptyLetting(2), managed: true, tenants: [tenant, null] },
    });
    const numbers = economicsOf(property);
    expect(numbers.agentYear).toBeGreaterThan(0);
    const rows = await screen(property);
    expect(rows.find((row) => row.props.title === 'Letting agent')?.props.value).toBe(
      `${money(numbers.agentYear / 12)} a month`,
    );
    const projection = rows.find(
      (row) => row.props.title === 'Projected rent after property costs',
    );
    expect(projection?.props.value).toBe(`${money(numbers.profitYear / 12)} a month`);
    expect(projection?.props.meta).toBe(`${money(numbers.profitYear)} a year`);
    expect(projection?.props.subtitle).toContain('quoted rent and current occupancy');
    expect(text()).toContain('not rent already');
  });
  it('shows the mortgage on the same monthly basis as property costs', async () => {
    const property = occupied({
      mortgage: {
        productId: MORTGAGE_PRODUCTS[0]!.id,
        principal: dollars(50_000),
        balance: dollars(50_000),
        termLeft: 20,
      },
    });
    const numbers = economicsOf(property);
    expect(numbers.mortgageMonth).toBeGreaterThan(0);
    const rows = await screen(property);
    expect(rows.find((row) => row.props.title === 'Mortgage')?.props.value).toBe(
      `${money(numbers.mortgageMonth)} a month`,
    );
    expect(
      rows.find((row) => row.props.title === 'Projected rent after property costs')?.props.value,
    ).toBe(`${money(numbers.profitYear / 12)} a month`);
  });
  it('warns about a projected shortfall', async () => {
    const property = occupied({ expenseRate: 1 });
    const numbers = economicsOf(property);
    expect(numbers.profitYear).toBeLessThan(0);
    await screen(property);
    expect(text()).toContain(`${money(-numbers.profitYear / 12)} short a month`);
  });
  it('does not warn of a shortfall when projected rent covers costs', async () => {
    const property = occupied({ expenseRate: 0.001 });
    expect(economicsOf(property).profitYear).toBeGreaterThan(0);
    await screen(property);
    expect(text()).not.toContain('short a month');
  });
  it('preserves rent and management commands', async () => {
    const rows = await screen(occupied());
    for (const title of ['Raise the rent', 'Lower the rent', 'Hire a letting agent']) {
      await act(() => rows.find((row) => row.props.title === title)?.props.onPress());
    }
    expect(letting.mock.calls).toEqual([
      [{ type: 'rent', homeId: home().id, direction: 1 }],
      [{ type: 'rent', homeId: home().id, direction: -1 }],
      [{ type: 'agent', homeId: home().id, managed: true }],
    ]);
  });
  it('labels the owned-property rent summary as gross', async () => {
    await screen(occupied(), true);
    expect(text()).toContain('gross a month');
  });
});
