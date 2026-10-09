import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, dollars } from '@yearafter/core';
import { CITIES } from '@yearafter/content';
import { post } from '@yearafter/finance';
import {
  createNewGame,
  rentalListings,
  homeListings,
  commercialListings,
  mortgageOfferFor,
  buyHome,
  fillEmptyUnits,
  economicsOf,
  type GameState,
} from '@yearafter/simulation';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { GameProvider, useGame } from '../stores/gameStore';
import { HomesScreen } from './HomesScreen';
import { RentalScreen } from './RentalScreen';
import { ActionButton } from '../components';
import { rowTitled, textsOf } from '../test/harness';
let homeId = '';
vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { homeId }, push: vi.fn(), pop: vi.fn() }),
}));
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  await act(async () => rendered?.unmount());
  rendered = undefined;
  game = undefined;
  homeId = '';
});
function fixture(): GameState {
  const s = createNewGame({ seed: 'p14-ui', startYear: 2000 });
  const city = CITIES.find((c) => c.countryCode === 'US' && c.regionCode === 'OH')!;
  let ledger = post(s.finance, 2030, 30, {
    category: 'salary',
    amount: dollars(1000000),
    source: 'Earnings',
  }).ledger;
  ledger = post(ledger, 2030, 30, {
    category: 'gift',
    amount: dollars(100000000),
    source: 'Savings',
  }).ledger;
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: ledger,
    player: {
      ...s.player,
      age: 30,
      cash: ledger.balance,
      currentLocation: { ...s.player.currentLocation, cityId: city.id },
    },
  };
}
async function mount(state = fixture(), rental = false) {
  const repo = new MemorySaveRepository();
  const id = asSaveId('p14-ui');
  await repo.create(toSave(state, { id }));
  await act(async () => {
    rendered = create(
      <GameProvider repository={repo}>
        <Probe />
        {rental ? <RentalScreen /> : <HomesScreen />}
      </GameProvider>,
    );
  });
  return { repo, id, state };
}
function renderer() {
  if (!rendered) throw Error('renderer');
  return rendered;
}
const money = (n: number) =>
  `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
describe('P14 actual screen/store/purchase and autosave', () => {
  it.each(['cash', 'mortgage', 'mortgage-half'] as const)(
    'purchases %s from actual expanded rental listing and persists the right debt/deposit',
    async (how) => {
      const { repo, id, state } = await mount();
      const l = rentalListings(state)[0]!;
      const offer = mortgageOfferFor(state, l, how === 'mortgage-half' ? 'half' : 'usual');
      await act(async () => rowTitled(renderer(), l.name).props.onPress());
      const prefix =
        how === 'cash' ? 'Buy it outright' : how === 'mortgage' ? 'Mortgage it' : 'Put 50% down';
      const action = renderer()
        .root.findAllByType(ActionButton)
        .find((b) => String(b.props.label).startsWith(prefix));
      expect(action).toBeDefined();
      expect(textsOf(renderer()).join(' ')).not.toContain('Estimated operating profit');
      await act(async () => {
        action?.props.onPress();
        await Promise.resolve();
      });
      expect(game?.state?.homes[0]?.mortgage?.principal).toBe(
        how === 'cash' ? undefined : dollars(offer.principal),
      );
      expect(game?.state?.player.cash).toBe(
        dollars(Number(state.player.cash) / 100 - (how === 'cash' ? l.askingPrice : offer.down)),
      );
      const saved = await repo.load(id);
      if (!saved.ok) throw Error(String(saved.error));
      expect(saved.value.homes).toEqual(game?.state?.homes);
      expect(saved.value.player.cash).toBe(game?.state?.player.cash);
    },
  );
  it('excludes a half-deposit action from a primary-home purchase', async () => {
    const { state } = await mount();
    const l = homeListings(state)[0]!;
    await act(async () => rowTitled(renderer(), l.name).props.onPress());
    expect(
      renderer()
        .root.findAllByType(ActionButton)
        .some((b) => String(b.props.label).startsWith('Put 50%')),
    ).toBe(false);
  });
  it('shows a spoken refusal for malformed purchase financing', async () => {
    const { state } = await mount();
    const before = JSON.stringify(game?.state);
    await act(async () => {
      game?.buyAHome(rentalListings(state)[0]!.id, 'bad' as never);
      await Promise.resolve();
    });
    expect(game?.outcome?.body).toContain("That payment choice isn't available");
    expect(JSON.stringify(game?.state)).toBe(before);
  });
  it('separates signed commercial operating profit and debt cash flow in the actual rental screen', async () => {
    let s = fixture();
    const l = commercialListings(s)[0]!;
    const bought = buyHome(s, l.id, 'mortgage-half');
    if (!bought.ok) throw Error(bought.error);
    const filled = fillEmptyUnits(bought.value.state, l.id);
    if (!filled.ok) throw Error(filled.error);
    s = {
      ...filled.value.state,
      homes: filled.value.state.homes.map((h) => ({
        ...h,
        letting: {
          ...h.letting!,
          tenants: h.letting!.tenants.map((t) => (t ? { ...t, rent: 10000 } : null)),
        },
      })),
    };
    homeId = l.id;
    const n = economicsOf(s.homes[0]!);
    await mount(s, true);
    expect(rowTitled(renderer(), 'Estimated operating profit').props.value).toBe(
      `${money(n.operatingYear / 12)} a month`,
    );
    expect(rowTitled(renderer(), 'Estimated cash after mortgage').props.value).toBe(
      `${money(n.profitYear / 12)} a month`,
    );
    expect(textsOf(renderer()).join(' ')).toContain(
      'Signed commercial rents stay fixed until renewal',
    );
    expect(n.collectedYear).toBe(10000 * l.units);
  });
});
