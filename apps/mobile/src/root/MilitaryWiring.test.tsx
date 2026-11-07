/**
 * Ticket 0906 — the doors: the Career page opens the military hub, the FBI and the CIA, and every new
 * screen is reachable from the shell and the store.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameState } from '@yearafter/simulation';
import { SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { CareerScreen } from '../screens/shells';
import {
  ADULT,
  agencyReady,
  at,
  eligible,
  inAgency,
  serving,
  veteran,
} from '../test/militaryFixtures';
import { rowTitled, rowsOf, show } from '../test/harness';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function open(state: GameState, tab: 'Special careers' | 'Work & study' = 'Special careers') {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
  rendered = await show(<CareerScreen />);
  if (tab === 'Special careers') {
    const button = rendered.root.findAll((node) => node.props.accessibilityLabel === tab)[0]!;
    await act(() => button.props.onPress());
  }
  return rendered;
}
const headings = (r: ReactTestRenderer) =>
  r.root.findAllByType(SectionHeading).map((node) => node.props.children as string);
const person = eligible(ADULT);

describe('the Career page', () => {
  it('has a Public service card in the Special careers tab, below the sports and entertainment rows, with the military, the FBI and the CIA', async () => {
    const r = await open(agencyReady());
    expect(headings(r)).toContain('Public service');
    const rows = rowsOf(r).map((row) => row.props.title as string);
    expect(rows.slice(-3)).toEqual(['Military', 'FBI', 'CIA']);
    expect(rows.indexOf('Military')).toBeGreaterThan(rows.indexOf('Acting'));
  });

  it('keeps it off the Work & study tab', async () => {
    const r = await open(agencyReady(), 'Work & study');
    expect(headings(r)).not.toContain('Public service');
    expect(() => rowTitled(r, 'Military')).toThrow();
  });

  it.each([
    ['Military', { screen: 'military', title: 'Military' }],
    ['FBI', { screen: 'fbi', title: 'FBI' }],
    ['CIA', { screen: 'cia', title: 'CIA' }],
  ])('opens %s', async (title, route) => {
    const r = await open(agencyReady());
    const row = rowTitled(r, title);
    expect(row.props.disabled).toBe(false);
    expect(row.props.affordance).toBe('navigate');
    await act(() => row.props.onPress());
    expect(push).toHaveBeenCalledWith(route);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('says where the person stands on each row', async () => {
    const r = await open(serving(agencyReady()));
    expect(rowTitled(r, 'Military').props.subtitle).toBe('Specialist, Army');
    expect(rowTitled(r, 'FBI').props.subtitle).toBe('Not an agent');
    expect(rowTitled(r, 'CIA').props.subtitle).toBe('Not an officer');
  });

  it('greys an agency the person is too young for, with the age, and does not open it', async () => {
    const r = await open(at(person, 22));
    const fbi = rowTitled(r, 'FBI');
    expect(fbi.props.disabled).toBe(true);
    expect(fbi.props.subtitle).toBe('From age 23');
    expect(fbi.props.onPress).toBeUndefined();
    expect(rowTitled(r, 'CIA').props.disabled).toBe(false);
  });

  it('greys the other agency for somebody who works for one, and names it', async () => {
    const r = await open(inAgency(agencyReady()));
    expect(rowTitled(r, 'FBI').props.subtitle).toBe('Special Agent, FBI');
    expect(rowTitled(r, 'FBI').props.disabled).toBe(false);
    expect(rowTitled(r, 'CIA').props.disabled).toBe(true);
    expect(rowTitled(r, 'CIA').props.subtitle).toBe('You work for the FBI.');
  });

  it('says a veteran has served', async () => {
    const r = await open(veteran(person));
    expect(rowTitled(r, 'Military').props.subtitle).toBe('Left the Army after 6 years');
  });

  it('shows a child no Public service card', async () => {
    const r = await open(at(person, 15));
    expect(headings(r)).not.toContain('Public service');
    expect(rowsOf(r).map((row) => row.props.title)).not.toContain('Military');
  });
});

describe('every new screen is wired into the shell, the navigator and the store', () => {
  const shell = readFileSync(join(__dirname, 'Shell.tsx'), 'utf8');
  const table = shell.slice(
    shell.indexOf('const LEAF_SCREENS'),
    shell.indexOf('export function Shell'),
  );

  it.each([
    ['military', 'MilitaryScreen'],
    ['service', 'ServiceScreen'],
    ['recruiter', 'RecruiterScreen'],
    ['veteran', 'VeteranScreen'],
    ['fbi', 'FbiScreen'],
    ['cia', 'CiaScreen'],
  ])('maps %s to %s', (key, screen) => {
    expect(table).toMatch(new RegExp(`\\b${key}: ${screen},`));
    expect(shell).toMatch(
      new RegExp(`import \\{[^}]*\\b${screen}\\b[^}]*\\} from '../screens/MilitaryScreens'`),
    );
  });

  it('has a key in the navigator for each of them', () => {
    const navigation = readFileSync(join(__dirname, '../navigation/navigation.tsx'), 'utf8');
    for (const key of ['military', 'service', 'recruiter', 'veteran', 'fbi', 'cia']) {
      expect(navigation).toMatch(new RegExp(`\\| '${key}'`));
    }
  });

  it('gives the store one action that runs the military verbs, and exposes it', () => {
    const store = readFileSync(join(__dirname, '../stores/gameStore.tsx'), 'utf8');
    expect(store).toContain('commit((current) => applyMilitary(current, action))');
    expect(store.match(/^\s+serve,$/gm)).toHaveLength(2);
    expect(store).toContain('readonly serve: (action: MilitaryAction) => void;');
  });
});
