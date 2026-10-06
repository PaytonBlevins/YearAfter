/**
 * Ticket 0708 — the doors: Activities opens Social Media, and every new screen is reachable.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { ActivitiesScreen } from '../screens/shells';
import { ADULT } from '../test/fameFixtures';
import { rowTitled, show } from '../test/harness';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

describe('the Social Media door', () => {
  it('is open, says what is behind it, and goes to the screen', async () => {
    vi.mocked(useGame, { partial: true }).mockReturnValue({ state: ADULT });
    vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
    rendered = await show(<ActivitiesScreen />);
    const row = rowTitled(rendered, 'Social Media');
    expect(row.props.disabled).toBe(false);
    expect(row.props.subtitle).toBe('Channels, deals, fame');
    await act(() => row.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'socialMedia', title: 'Social Media' });
  });
});

describe('every new screen is wired into the shell', () => {
  // The shell cannot be imported under the test runner (it pulls in the whole native app), so
  // this reads the one table that maps a route to its screen. A route with no entry there opens
  // the world root instead, which is exactly the bug it guards against.
  const shell = readFileSync(join(__dirname, 'Shell.tsx'), 'utf8');
  const table = shell.slice(
    shell.indexOf('const LEAF_SCREENS'),
    shell.indexOf('export function Shell'),
  );

  it.each([
    ['socialMedia', 'SocialMediaScreen'],
    ['channel', 'ChannelScreen'],
    ['newChannel', 'NewChannelScreen'],
    ['fame', 'FameScreen'],
    ['connection', 'ConnectionScreen'],
  ])('maps %s to %s', (key, screen) => {
    expect(table).toMatch(new RegExp(`\\b${key}: ${screen},`));
    expect(shell).toMatch(new RegExp(`import \\{[^}]*\\b${screen}\\b[^}]*\\} from '../screens/`));
  });

  it('puts the meeting card under the graduation notice, so a milestone is read first', () => {
    expect(shell.indexOf('<MeetingNotice />')).toBeGreaterThan(0);
    expect(shell.indexOf('<MeetingNotice />')).toBeLessThan(shell.indexOf('<GraduationNotice />'));
  });
});
