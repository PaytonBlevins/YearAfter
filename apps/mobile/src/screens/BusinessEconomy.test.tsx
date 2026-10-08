import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { findBusinessType } from '@yearafter/content';
import { newBusiness } from '@yearafter/finance';
import { createNewGame } from '@yearafter/simulation';
import { ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { BusinessScreen } from './BusinessesScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
async function screen(economy: number | undefined) {
  const type = findBusinessType('biz.restaurant');
  if (!type) throw new Error('Missing restaurant');
  const base = createNewGame({ seed: 'p4-screen' });
  const business = {
    ...newBusiness(type, 'p4-screen', 'Marlow', base.world.year - 10, 1),
    last: {
      year: base.world.year,
      revenue: 900_000,
      costs: 800_000,
      profit: 100_000,
      drawn: 100_000,
      injected: 0,
      turnedAway: 0,
      idle: 0,
      ...(economy === undefined ? {} : { economy }),
    },
  };
  vi.mocked(useGame, { partial: true }).mockReturnValue({
    state: { ...base, player: { ...base.player, age: 40 }, businesses: [business] },
    tuneBusiness: vi.fn(),
  });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    current: { screen: 'business', title: business.name, businessId: business.id },
    pop: vi.fn(),
  });
  await act(() => {
    rendered = create(<BusinessScreen />);
  });
  if (!rendered) throw new Error('No screen');
  return rendered.root.findAllByType(ListRow).find((row) => row.props.title === 'The economy');
}
describe('P4 economy context', () => {
  it.each([
    [0.985, 'Took about 2%'],
    [1.015, 'Brought you about 2%'],
    [0.922, 'Took about 8%'],
    [1.09, 'Brought you about 9%'],
  ] as const)(
    'shows the actual saved %s effect at the approved threshold',
    async (economy, text) => {
      const row = await screen(economy);
      expect(row).toBeDefined();
      expect(row?.props.subtitle).toContain(text);
      expect(row?.props.affordance).toBe('none');
    },
  );
  it.each([undefined, 1, 1.0149, 0.9851])(
    'keeps absent, neutral and sub-threshold %s context quiet',
    async (economy) => {
      expect(await screen(economy)).toBeUndefined();
    },
  );
});
