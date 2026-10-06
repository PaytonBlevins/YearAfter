import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BUSINESS_TYPES, findBusinessType } from '@yearafter/content';
import { newBusiness, SUPPLIER_GRADES, SUPPLIER_LABELS } from '@yearafter/finance';
import { createNewGame } from '@yearafter/simulation';
import { ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { BusinessScreen } from './BusinessesScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const tuneBusiness = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function screen(typeId: string) {
  const type = findBusinessType(typeId);
  if (!type) throw new Error('No such business fixture');
  const state = createNewGame({ seed: 'supplier-copy' });
  const business = newBusiness(type, 'biz:supplier-test', 'Wren’s Place', state.world.year, 1);
  vi.mocked(useGame, { partial: true }).mockReturnValue({
    state: { ...state, player: { ...state.player, age: 25 }, businesses: [business] },
    tuneBusiness,
  });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    current: { screen: 'business', title: business.name, businessId: business.id },
    pop: vi.fn(),
  });
  await act(() => {
    rendered = create(<BusinessScreen />);
  });
  if (!rendered) throw new Error('Screen did not render');
  return { rows: rendered.root.findAllByType(ListRow), business };
}

describe('A2 — supplier choices explain the trade-off', () => {
  it('explains cost, quality and customers for every grade without promising profit', async () => {
    const { rows } = await screen('biz.cleaning');
    const budget = rows.find((row) => row.props.title === 'Budget');
    const standard = rows.find((row) => row.props.title === 'Standard');
    const premium = rows.find((row) => row.props.title === 'Premium');
    expect(budget?.props.subtitle).toMatch(/cheaper.*lower quality/i);
    expect(budget?.props.subtitle).toMatch(/customers.*else/i);
    expect(standard?.props.subtitle).toMatch(/usual cost.*middle ground.*quality/i);
    expect(premium?.props.subtitle).toMatch(/better.*cost more/i);
    expect(premium?.props.subtitle).toMatch(/customers.*may not cover the cost/i);
    expect(standard?.props.value).toBe('Chosen');
    expect(budget?.props.value).toBe('Choose');
    expect(premium?.props.value).toBe('Choose');
    expect(JSON.stringify(rendered?.toJSON())).toContain('also depends on your staff');
  });

  it.each(SUPPLIER_GRADES)('keeps %s wired to the existing supplier command', async (supplier) => {
    const { rows, business } = await screen('biz.cleaning');
    const row = rows.find((item) => item.props.title === SUPPLIER_LABELS[supplier]);
    expect(row).toBeDefined();
    await act(() => row?.props.onPress());
    expect(tuneBusiness).toHaveBeenCalledWith(business.id, { kind: 'supplier', supplier });
  });

  it('does not offer supplier choices for a business without suppliers', async () => {
    const type = BUSINESS_TYPES.find((candidate) => !candidate.supplier);
    if (!type) throw new Error('No supplier-free business fixture');
    const { rows } = await screen(type.id);
    for (const title of Object.values(SUPPLIER_LABELS)) {
      expect(rows.some((row) => row.props.title === title)).toBe(false);
    }
  });
});
