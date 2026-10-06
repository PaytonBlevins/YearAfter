import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { dollars } from '@yearafter/core';
import { JOBS } from '@yearafter/content';
import { createNewGame, type GameState } from '@yearafter/simulation';
import { ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { DebtScreen } from './DebtScreen';
import { FinancesScreen } from './FinancesScreen';
import { CareerScreen } from './shells';
import { MagazineScreen } from './MagazineScreen';

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
  const state = createNewGame({ seed: 'news-debt' });
  return { ...state, player: { ...state.player, age: 25 } };
};
const studentLoan = {
  productId: 'loan.student',
  principal: dollars(12_000),
  balance: dollars(10_000),
  termLeft: 10,
  inArrears: false,
};
const mixed = (): GameState => ({
  ...base(),
  loans: [studentLoan],
  cards: [
    { productId: 'card:test', limit: dollars(5_000), balance: dollars(2_000), status: 'open' },
  ],
  homes: [
    {
      id: 'home:test',
      kindId: 'home:test',
      beds: 2,
      baths: 1,
      builtYear: 2000,
      condition: 'good',
      regionKey: 'us:ohio',
      regionName: 'Ohio',
      purchasePrice: dollars(200_000),
      boughtYear: 2025,
      value: dollars(200_000),
      expenseRate: 0.02,
      behindYears: 0,
      mortgage: {
        productId: 'mortgage:test',
        principal: dollars(60_000),
        balance: dollars(50_000),
        termLeft: 20,
      },
    },
  ],
  vehicles: [
    {
      id: 'car:test',
      trimId: 'trim:test',
      modelYear: 2024,
      boughtYear: 2025,
      purchasePrice: dollars(10_000),
      value: dollars(8_000),
      condition: 90,
      history: 'full',
      accident: false,
      behindYears: 0,
      loan: {
        productId: 'car-loan:test',
        principal: dollars(5_000),
        balance: dollars(3_000),
        termLeft: 3,
      },
    },
  ],
});
async function screen(Component: () => React.JSX.Element | null, state = base()) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
  await act(() => {
    rendered = create(<Component />);
  });
  if (!rendered) throw new Error('Screen did not render');
  return rendered.root.findAllByType(ListRow);
}

describe('A11 — debt is easy to find and uses current balances', () => {
  it('shows combined debt on Finances and opens the overview', async () => {
    const rows = await screen(FinancesScreen, mixed());
    const debt = rows.find((row) => row.props.title === 'Debt');
    expect(debt?.props.value).toBe('$65,000');
    await act(() => debt?.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'debt', title: 'Debt' });
  });
  it('includes all four debt categories once and links to their existing screens', async () => {
    const rows = await screen(DebtScreen, mixed());
    expect(rows.find((row) => row.props.title === 'Total debt')?.props.value).toBe('$65,000');
    for (const [title, value, route, routeTitle] of [
      ['Cards', '$2,000', 'cards', 'Cards'],
      ['Loans', '$10,000', 'loans', 'Loans'],
      ['Mortgages', '$50,000', 'homes', 'Homes'],
      ['Car loans', '$3,000', 'vehicles', 'Vehicles'],
    ]) {
      const row = rows.find((item) => item.props.title === title);
      expect(row?.props.value).toBe(value);
      await act(() => row?.props.onPress());
      expect(push).toHaveBeenCalledWith({ screen: route, title: routeTitle });
    }
    expect(rows.find((row) => row.props.title === 'Student Loan')?.props.value).toBe('$10,000');
  });
  it('shows an honest zero when nothing is owed', async () => {
    const rows = await screen(DebtScreen);
    expect(rows.find((row) => row.props.title === 'Total debt')?.props.value).toBe('$0');
    expect(rows.filter((row) => row.props.value === '$0')).toHaveLength(5);
  });
  it('keeps unknown loan products visible and marks arrears', async () => {
    const rows = await screen(DebtScreen, {
      ...base(),
      loans: [{ ...studentLoan, productId: 'loan:future', inArrears: true }],
    });
    const loan = rows.find((row) => row.props.title === 'Loan');
    expect(loan?.props.value).toBe('$10,000');
    expect(loan?.props.subtitle).toBe('Behind on payments');
  });
  it('keeps frozen-card debt and separates tuition from other loans on Career', async () => {
    const state = mixed();
    const frozen = {
      ...state,
      cards: state.cards.map((card) => ({ ...card, status: 'frozen' as const })),
    };
    const rows = await screen(DebtScreen, frozen);
    expect(rows.find((row) => row.props.title === 'Cards')?.props.value).toBe('$2,000');
    await act(() => rendered?.unmount());
    rendered = undefined;
    const careerRows = await screen(CareerScreen, {
      ...base(),
      education: { ...base().education, stage: 'college' },
      loans: [studentLoan, { ...studentLoan, productId: 'loan.personal', balance: dollars(3_000) }],
    });
    expect(careerRows.find((row) => row.props.title === 'Student loan')?.props.value).toBe(
      '$10,000',
    );
  });
  it('keeps student debt visible when a student also has a job', async () => {
    const state = base();
    const job = JOBS[0];
    if (!job) throw new Error('No job fixture');
    const rows = await screen(CareerScreen, {
      ...state,
      education: { ...state.education, stage: 'college' },
      loans: [studentLoan],
      employment: {
        ...state.employment,
        job: {
          jobId: job.id,
          since: 22,
          performance: state.player.stats.smarts,
          effort: 'steady',
          pushedThisYear: 0,
        },
      },
    });
    expect(rows.find((row) => row.props.title === 'Student loan')?.props.value).toBe('$10,000');
  });
  it.each([0, 10_000])('shows tuition debt of %i on Career while studying', async (amount) => {
    const state = base();
    const rows = await screen(CareerScreen, {
      ...state,
      education: { ...state.education, stage: 'college', collegeYear: 1 },
      loans: amount ? [studentLoan] : [],
    });
    const loan = rows.find((row) => row.props.title === 'Student loan');
    expect(loan?.props.value).toBe(amount ? '$10,000' : '$0');
    expect(loan?.props.subtitle).toBe(
      amount ? 'Interest adds to it while you study' : 'Nothing borrowed for tuition',
    );
    await act(() => loan?.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'debt', title: 'Debt' });
  });
});

describe('A6 — the newspaper explains what its stories know', () => {
  it('separates economic context and price records from company news and forecasts', async () => {
    await screen(MagazineScreen);
    const text = JSON.stringify(rendered?.toJSON());
    expect(text).toContain('not company news');
    expect(text).toContain('Averages can hide gains and losses');
    expect(text).toContain('not a sector');
    expect(text).toContain('price and history before buying or selling');
    expect(text).toContain('Nothing on this page is a forecast');
  });
});
