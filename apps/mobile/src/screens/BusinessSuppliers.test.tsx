import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BUSINESS_TYPES, findBusinessType } from '@yearafter/content';
import { newBusiness, supplierPitch, SUPPLIER_GRADES, SUPPLIER_LABELS } from '@yearafter/finance';
import { createNewGame } from '@yearafter/simulation';
import { ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { BusinessScreen } from './BusinessesScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const tuneBusiness = vi.fn();
const searchBusinessSupplier = vi.fn();
const acceptBusinessSupplier = vi.fn();
const passBusinessSupplier = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function screen(typeId: string, grade: 'budget' | 'standard' | 'premium' = 'standard') {
  const type = findBusinessType(typeId);
  if (!type) throw new Error('No such business fixture');
  const state = createNewGame({ seed: 'supplier-copy' });
  const base = newBusiness(type, 'biz:supplier-test', 'Wren’s Place', state.world.year, 1);
  const pitch = { ...supplierPitch('ui', base.id, state.world.year, 1), grade };
  const business = { ...base, supplierSearch: { year: state.world.year, used: 1, pending: pitch } };
  vi.mocked(useGame, { partial: true }).mockReturnValue({
    state: { ...state, player: { ...state.player, age: 25 }, businesses: [business] },
    tuneBusiness,
    searchBusinessSupplier,
    acceptBusinessSupplier,
    passBusinessSupplier,
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
  it.each(SUPPLIER_GRADES)(
    'explains %s cost, quality and customers without promising profit',
    async (grade) => {
      const { rows } = await screen('biz.cleaning', grade);
      const offered = rows.find(
        (row) =>
          row.props.title !== 'Current supplier' &&
          String(row.props.subtitle).startsWith(SUPPLIER_LABELS[grade]),
      );
      expect(offered).toBeDefined();
      if (grade === 'budget') {
        expect(offered?.props.subtitle).toMatch(/cheaper.*lower quality/i);
        expect(offered?.props.subtitle).toMatch(/customers.*else/i);
      } else if (grade === 'standard')
        expect(offered?.props.subtitle).toMatch(/usual cost.*middle ground.*quality/i);
      else {
        expect(offered?.props.subtitle).toMatch(/better.*cost more/i);
        expect(offered?.props.subtitle).toMatch(/customers.*may not cover the cost/i);
      }
      expect(JSON.stringify(rendered?.toJSON())).toContain('also depends on your staff');
      expect(rows.some((row) => row.props.value === 'Choose')).toBe(false);
    },
  );
  it.each(SUPPLIER_GRADES)(
    'accepts the current %s pitch ID through the new command',
    async (grade) => {
      const { rows, business } = await screen('biz.cleaning', grade);
      await act(() =>
        rows.find((row) => row.props.title === 'Accept this supplier')?.props.onPress(),
      );
      expect(acceptBusinessSupplier).toHaveBeenCalledWith(
        business.id,
        business.supplierSearch.pending.id,
      );
      expect(tuneBusiness).not.toHaveBeenCalled();
      await act(() =>
        rows.find((row) => row.props.title === 'Pass on this pitch')?.props.onPress(),
      );
      expect(passBusinessSupplier).toHaveBeenCalledWith(
        business.id,
        business.supplierSearch.pending.id,
      );
      await act(() => rows.find((row) => row.props.title === 'Search again')?.props.onPress());
      expect(searchBusinessSupplier).toHaveBeenCalledWith(business.id);
    },
  );

  it('does not offer supplier choices for a business without suppliers', async () => {
    const type = BUSINESS_TYPES.find((candidate) => !candidate.supplier);
    if (!type) throw new Error('No supplier-free business fixture');
    const { rows } = await screen(type.id);
    expect(
      rows.some(
        (row) => row.props.title === 'Search again' || row.props.title === 'Accept this supplier',
      ),
    ).toBe(false);
    for (const title of Object.values(SUPPLIER_LABELS)) {
      expect(rows.some((row) => row.props.title === title)).toBe(false);
    }
  });
});
