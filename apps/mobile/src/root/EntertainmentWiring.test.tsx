/**
 * Ticket 0809 — the doors: Activities opens the hub, Mind & Body opens the studies, and every new
 * screen is reachable from the shell.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { ActivitiesScreen, MindBodyScreen } from '../screens/shells';
import { ADULT } from '../test/entertainmentFixtures';
import { rowTitled, show } from '../test/harness';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function open(element: React.ReactElement) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state: ADULT });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
  rendered = await show(element);
  return rendered;
}

describe('the doors', () => {
  it('Activities opens Sports and Entertainment', async () => {
    const r = await open(<ActivitiesScreen />);
    const row = rowTitled(r, 'Sports and Entertainment');
    expect(row.props.disabled).toBeFalsy();
    await act(() => row.props.onPress());
    expect(push).toHaveBeenCalledWith({
      screen: 'entertainment',
      title: 'Sports and Entertainment',
    });
  });

  it.each([
    ['Martial Arts', 'studies'],
    ['Instruments', 'music'],
    ['Acting Lessons', 'acting'],
  ])('Mind & Body opens %s at the %s screen', async (title, screen) => {
    const r = await open(<MindBodyScreen />);
    const row = rowTitled(r, title);
    expect(row.props.disabled).toBeFalsy();
    await act(() => row.props.onPress());
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ screen }));
  });
});

describe('every new screen is wired into the shell', () => {
  // The shell cannot be imported under the test runner (it pulls in the whole native app), so this
  // reads the one table that maps a route to its screen. A route with no entry opens the world
  // root instead, which is exactly the bug it guards against.
  const shell = readFileSync(join(__dirname, 'Shell.tsx'), 'utf8');
  const table = shell.slice(
    shell.indexOf('const LEAF_SCREENS'),
    shell.indexOf('export function Shell'),
  );

  it.each([
    ['entertainment', 'EntertainmentScreen'],
    ['sports', 'SportsScreen'],
    ['studies', 'StudiesScreen'],
    ['acting', 'ActingScreen'],
    ['music', 'MusicScreen'],
    ['modeling', 'ModelingScreen'],
  ])('maps %s to %s', (key, screen) => {
    expect(table).toMatch(new RegExp(`\\b${key}: ${screen},`));
    expect(shell).toMatch(new RegExp(`import \\{[^}]*\\b${screen}\\b[^}]*\\} from '../screens/`));
  });

  it('has a key in the navigator for each of them', () => {
    const navigation = readFileSync(join(__dirname, '../navigation/navigation.tsx'), 'utf8');
    for (const key of ['entertainment', 'sports', 'studies', 'acting', 'music', 'modeling']) {
      expect(navigation).toMatch(new RegExp(`'${key}'`));
    }
  });

  it('puts the year recap under the graduation notice, so a milestone is read first', () => {
    expect(shell.indexOf('<YearRecapNotice />')).toBeGreaterThan(
      shell.indexOf('<GraduationNotice />'),
    );
    expect(shell).toMatch(/import \{ YearRecapNotice \} from '..\/components\/YearRecapNotice'/);
  });
});
