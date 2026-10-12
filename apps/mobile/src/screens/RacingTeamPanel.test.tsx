/**
 * Ticket 0809 — a racing team on the business screen: the same screen every business has, with
 * the customers-and-shop sections replaced by the team's own.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { findBusinessType } from '@yearafter/content';
import { newBusiness } from '@yearafter/finance';
import type { GameState } from '@yearafter/simulation';
import { SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { ADULT, withBookedCash, withRacingTeam } from '../test/entertainmentFixtures';
import { expectWellFormed } from '../test/wellFormed';
import { buttonLabelled, buttonsOf, rowTitled, rowsOf, show, textsOf } from '../test/harness';
import { BusinessScreen } from './BusinessesScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const entertain = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function team(state: GameState, businessId: string, check = true) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, entertain });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    current: { screen: 'business', title: 'Team', businessId },
    pop: vi.fn(),
  });
  rendered = await show(<BusinessScreen />);
  // The summary cards (revenue, profit, cash; worth, invested) are the business screen's own.
  if (check) expectWellFormed(rendered, ['Revenue', 'Worth to you']);
  return rendered;
}
const headings = (r: ReactTestRenderer) =>
  r.root.findAllByType(SectionHeading).map((node) => node.props.children as string);

const seasonPlayed = (state: GameState, id: string, rung: 1 | 2 = 1): GameState => ({
  ...state,
  businesses: state.businesses.map((business) =>
    business.id === id
      ? {
          ...business,
          racing: {
            rung,
            car: 50,
            driver: { kind: 'hired', id: 'd1', name: 'Ana Reyes', skill: 70, age: 27 },
            development: 'steady',
            titles: 0,
            best: rung,
            seasons: 1,
            last: {
              year: state.world.year,
              rung,
              place: 4,
              field: 18,
              title: false,
              incident: false,
            },
          },
        }
      : business,
  ),
});

describe('a racing team on the business screen', () => {
  it('shows the team, not customers and a shop', async () => {
    const { state, id } = withRacingTeam();
    const r = await team(state, id);
    expect(headings(r)).toEqual(expect.arrayContaining(['The team', 'Driver', 'The series']));
    expect(headings(r)).not.toContain('Customers');
    expect(headings(r)).not.toContain('Locations');
    expect(rowTitled(r, 'Series').props.value).toBe('Coastline Club Racing');
    expect(rowTitled(r, 'Seasons run').props.value).toBe('0');
    expect(rowTitled(r, 'Championships').props.value).toBe('0');
  });

  it('leaves an ordinary business exactly as it was', async () => {
    const state = withBookedCash(ADULT, 10_000);
    const type = findBusinessType('biz.cleaning')!;
    const business = newBusiness(type, 'biz:plain', 'Wren’s Place', state.world.year, 1);
    const r = await team({ ...state, businesses: [business] }, business.id, false);
    expect(headings(r)).toContain('Customers');
    expect(headings(r)).not.toContain('The team');
    expect(headings(r)).not.toContain('Developing the car');
  });

  it('hires one of the drivers looking for a seat', async () => {
    const { state, id } = withRacingTeam();
    const r = await team(state, id);
    await act(() => rowTitled(r, 'Hire a driver').props.onPress());
    const candidates = r.root
      .findAll(
        (node) =>
          typeof node.props.subtitle === 'string' && /^Age \d+ · /.test(node.props.subtitle),
      )
      .filter((node) => node.props.onPress !== undefined);
    expect(candidates.length).toBe(3);
    await act(() => candidates[0]!.props.onPress());
    expect(entertain).toHaveBeenCalledWith({
      type: 'hireDriver',
      businessId: id,
      candidateId: `drv:${state.world.year}:1:0`,
    });
  });

  it('describes drivers in words, never a skill number', async () => {
    const { state, id } = withRacingTeam();
    const r = await team(state, id);
    await act(() => rowTitled(r, 'Hire a driver').props.onPress());
    const everything = textsOf(r).join(' | ');
    expect(everything).toMatch(/Age \d+ · (raw|still learning|solid|quick|one of the best around)/);
    expect(everything).not.toMatch(/skill/i);
  });

  it('offers to drive only a team owner who is a pro driver', async () => {
    const { state, id } = withRacingTeam();
    const none = await team(state, id);
    expect(none.root.findAll((n) => n.props.title === 'Drive for your own team')).toHaveLength(0);
    const pro: GameState = {
      ...state,
      sports: {
        ...state.sports,
        career: {
          sportId: 'racing',
          stage: 'pro',
          startedAge: 14,
          seasons: 6,
          hardSeasons: 0,
          form: 70,
          trainedAtAge: -1,
          trainedCount: 0,
          reputation: 40,
          titles: 0,
          team: 'Atlas',
          tier: 'starter',
          proSeasons: 4,
          contract: { salary: 400_000, yearsLeft: 2, rookie: false },
        },
      },
    };
    const r = await team(pro, id);
    await act(() => rowTitled(r, 'Drive for your own team').props.onPress());
    expect(entertain).toHaveBeenCalledWith({ type: 'driveOwn', businessId: id, on: true });
  });

  it('hands the car back when the owner is driving', async () => {
    const { state, id } = withRacingTeam();
    const mine: GameState = {
      ...state,
      businesses: state.businesses.map((b) =>
        b.id === id
          ? {
              ...b,
              racing: {
                rung: 1,
                car: 50,
                driver: { kind: 'owner' },
                development: 'steady',
                titles: 0,
                best: 1,
                seasons: 0,
              },
            }
          : b,
      ),
    };
    const r = await team(mine, id);
    expect(rowTitled(r, 'Driver').props.value).toBe('You');
    expect(r.root.findAll((n) => n.props.title === 'Hire a driver')).toHaveLength(0);
    await act(() => rowTitled(r, 'Hand the car to a hired driver').props.onPress());
    expect(entertain).toHaveBeenCalledWith({ type: 'driveOwn', businessId: id, on: false });
  });

  it('marks the chosen development level and changes it on a press', async () => {
    const { state, id } = withRacingTeam();
    const r = await team(state, id);
    expect(rowTitled(r, 'Steady').props.value).toBe('Chosen');
    expect(rowTitled(r, 'Lean').props.value).toBe('Choose');
    expect(rowTitled(r, 'Heavy').props.value).toBe('Choose');
    await act(() => rowTitled(r, 'Heavy').props.onPress());
    expect(entertain).toHaveBeenCalledWith({
      type: 'development',
      businessId: id,
      level: 'heavy',
    });
  });

  it('will not move up until a season has been run, and says so', async () => {
    const { state, id } = withRacingTeam();
    const r = await team(state, id);
    const row = rowTitled(r, 'Move up to Atlas Junior Formula');
    expect(row.props.disabled).toBe(true);
    expect(row.props.onPress).toBeUndefined();
    expect(row.props.subtitle).toBe('Finish a season at this level first');
    expect(row.props.value).toBe('$90,000');
  });

  it('moves up after a season, paying outright when there is the money', async () => {
    const { state, id } = withRacingTeam();
    const played = withBookedCash(seasonPlayed(state, id), 1_000_000);
    const r = await team(played, id);
    const row = rowTitled(r, 'Move up to Atlas Junior Formula');
    expect(row.props.disabled).toBe(false);
    await act(() => row.props.onPress());
    await act(() => buttonLabelled(r, 'Move up — pay $90,000').props.onPress());
    expect(entertain).toHaveBeenCalledWith({ type: 'series', businessId: id, direction: 'up' });
  });

  it('offers a step down only after a season at the level above the bottom', async () => {
    const { state, id } = withRacingTeam();
    const bottom = await team(seasonPlayed(state, id, 1), id);
    expect(bottom.root.findAll((n) => n.props.title === 'Step down a series')).toHaveLength(0);
    const second = await team(seasonPlayed(state, id, 2), id);
    await act(() => rowTitled(second, 'Step down a series').props.onPress());
    await act(() => buttonLabelled(second, 'Step down').props.onPress());
    expect(entertain).toHaveBeenCalledWith({ type: 'series', businessId: id, direction: 'down' });
  });

  it('reports last season in words', async () => {
    const { state, id } = withRacingTeam();
    const r = await team(seasonPlayed(state, id), id);
    expect(rowTitled(r, 'Last season').props.subtitle).toBe(
      `${state.world.year}: 4th of 18 in the Coastline Club Racing`,
    );
  });
});

describe('the team panel is a well-formed screen', () => {
  it('uses real affordances and variants, and a hairline between rows', async () => {
    const { state, id } = withRacingTeam();
    const played = withBookedCash(seasonPlayed(state, id, 2), 1_000_000);
    const r = await team(played, id);
    await act(() => rowTitled(r, 'Step down a series').props.onPress());
    for (const row of rowsOf(r)) {
      expect([undefined, 'navigate', 'action', 'none'], String(row.props.title)).toContain(
        row.props.affordance,
      );
      if (row.props.onPress) expect(row.props.affordance).not.toBe('none');
    }
    expect(buttonLabelled(r, 'Step down').props.variant).toBe('danger');
    const development = ['Lean', 'Steady', 'Heavy'].map((title) => rowTitled(r, title));
    expect(development).toHaveLength(3);
    expect(development.every((row) => row.props.affordance === 'action')).toBe(true);
  });

  it('says what each development level means, and what the other rows say', async () => {
    const { state, id } = withRacingTeam();
    const r = await team(state, id);
    expect(rowTitled(r, 'Lean').props.subtitle).toBe('Costs less. The car falls back a little.');
    expect(rowTitled(r, 'Steady').props.subtitle).toBe('The usual spend for the series.');
    expect(rowTitled(r, 'Heavy').props.subtitle).toBe('Costs more. The car gets quicker.');
    expect(rowTitled(r, 'Hire a driver').props.subtitle).toBe(
      'Three are looking for a seat this year',
    );
    expect(buttonsOf(r).filter((b) => String(b.props.label).startsWith('Move up'))).toHaveLength(0);
  });

  it('keeps the payment panel shut until the move up is opened', async () => {
    const { state, id } = withRacingTeam();
    const played = withBookedCash(seasonPlayed(state, id), 1_000_000);
    const r = await team(played, id);
    const row = rowTitled(r, 'Move up to Atlas Junior Formula');
    expect(row.props.subtitle).toBe('A bigger car, a better field and a bigger purse');
    expect(row.props.affordance).toBe('action');
    expect(buttonsOf(r).some((b) => String(b.props.label).startsWith('Move up'))).toBe(false);
    await act(() => row.props.onPress());
    expect(buttonsOf(r).some((b) => String(b.props.label).startsWith('Move up'))).toBe(true);
    await act(() => row.props.onPress());
    expect(buttonsOf(r).some((b) => String(b.props.label).startsWith('Move up'))).toBe(false);
  });

  it('shows the top of the ladder and the step-down words', async () => {
    const { state, id } = withRacingTeam();
    const top: GameState = {
      ...state,
      businesses: state.businesses.map((b) =>
        b.id === id
          ? {
              ...b,
              racing: {
                rung: 5,
                car: 90,
                driver: { kind: 'owner' },
                development: 'steady',
                titles: 1,
                best: 5,
                seasons: 4,
                last: {
                  year: state.world.year,
                  rung: 5,
                  place: 2,
                  field: 20,
                  title: false,
                  incident: false,
                },
              },
            }
          : b,
      ),
    };
    const r = await team(top, id);
    const ladder = rowTitled(r, 'Top of the ladder');
    expect(ladder.props.subtitle).toBe('There is nothing above this series');
    expect(rowTitled(r, 'Step down a series').props.subtitle).toBe(
      'The car is sold for a fraction of what it cost',
    );
  });
});

describe('the words on the driver rows', () => {
  it('says what each driver row does', async () => {
    const { state, id } = withRacingTeam();
    const mine: GameState = {
      ...state,
      businesses: state.businesses.map((b) =>
        b.id === id
          ? {
              ...b,
              racing: {
                rung: 1,
                car: 50,
                driver: { kind: 'owner' },
                development: 'steady',
                titles: 0,
                best: 1,
                seasons: 0,
              },
            }
          : b,
      ),
    };
    const r = await team(mine, id);
    expect(rowTitled(r, 'Hand the car to a hired driver').props.subtitle).toBe(
      'You stop driving for the team',
    );
    expect(rowTitled(r, 'Hand the car to a hired driver').props.affordance).toBe('action');
  });

  it('says what driving your own team means', async () => {
    const { state, id } = withRacingTeam();
    const pro: GameState = {
      ...state,
      sports: {
        ...state.sports,
        career: {
          sportId: 'racing',
          stage: 'pro',
          startedAge: 14,
          seasons: 6,
          hardSeasons: 0,
          form: 70,
          trainedAtAge: -1,
          trainedCount: 0,
          reputation: 40,
          titles: 0,
          team: 'Atlas',
          tier: 'starter',
          proSeasons: 4,
          contract: { salary: 400_000, yearsLeft: 2, rookie: false },
        },
      },
    };
    const r = await team(pro, id);
    const row = rowTitled(r, 'Drive for your own team');
    expect(row.props.subtitle).toBe('You race the car yourself');
    expect(row.props.affordance).toBe('action');
    expect(rowTitled(r, 'Hire a driver').props.affordance).toBe('action');
  });
});
