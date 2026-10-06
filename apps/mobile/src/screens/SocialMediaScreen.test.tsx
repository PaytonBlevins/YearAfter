/**
 * Ticket 0708 — Social Media, a channel, and starting one.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { PLATFORMS, findCreatorCategory } from '@yearafter/content';
import { createPersonality } from '@yearafter/character';
import { asNpcId, dollars } from '@yearafter/core';
import type { Acquaintance } from '@yearafter/social';
import { collabOffers, groupOffers, sponsorOffers, type GameState } from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import {
  ADULT,
  channelOf,
  withCash,
  withChannelThat,
  withCollab,
  withFame,
  withGroup,
  withSponsor,
} from '../test/fameFixtures';
import { buttonLabelled, buttonsOf, rowTitled, rowsOf, show, textsOf } from '../test/harness';
import { ChannelScreen, NewChannelScreen } from './ChannelScreens';
import { SocialMediaScreen } from './SocialMediaScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
const pop = vi.fn();
const creating = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function on(element: React.ReactElement, state: GameState, route: object = {}) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, creating });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    push,
    pop,
    current: route as never,
  });
  rendered = await show(element);
  return rendered;
}

const RICH = withCash(ADULT, 50_000);
const one = (): GameState => ({ ...RICH, channels: [channelOf('ch:one', 12_000)] });

describe('Social Media', () => {
  it('tells a child to wait', async () => {
    const child = { ...RICH, player: { ...RICH.player, age: 11 } };
    const r = await on(<SocialMediaScreen />, child);
    expect(textsOf(r)).toContain('Not yet');
    expect(rowsOf(r)).toHaveLength(0);
  });

  it('offers to start the first channel, and nothing else to do yet', async () => {
    const r = await on(<SocialMediaScreen />, RICH);
    expect(textsOf(r).join(' ')).toContain("You haven't started anything yet.");
    expect(rowTitled(r, 'Start a channel').props.disabled).toBe(false);
    expect(textsOf(r)).not.toContain('Who looks after you'.toUpperCase());
    await act(() => rowTitled(r, 'Start a channel').props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'newChannel', title: 'Start a channel' });
  });

  it('lists the channels with audience and opens one', async () => {
    const state = one();
    const r = await on(<SocialMediaScreen />, state);
    const row = rowsOf(r).find((candidate) => candidate.props.title === state.channels[0]!.name)!;
    expect(row.props.subtitle).toBe('Video · 12,000 subscribers');
    await act(() => row.props.onPress());
    expect(push).toHaveBeenCalledWith({
      screen: 'channel',
      title: state.channels[0]!.name,
      channelId: 'ch:one',
    });
  });

  it('shuts the door at four channels and says why', async () => {
    const four = {
      ...RICH,
      channels: [
        channelOf('ch:1', 10, 'video', 'comedy'),
        channelOf('ch:2', 10, 'photo', 'travel'),
        channelOf('ch:3', 10, 'stream', 'gaming'),
        channelOf('ch:4', 10, 'podcast', 'comedy'),
      ],
    };
    const r = await on(<SocialMediaScreen />, four);
    const row = rowTitled(r, 'Start a channel');
    expect(row.props.disabled).toBe(true);
    expect(row.props.subtitle).toBe("You're at the most you can keep going (4)");
  });

  it('shows the fame row only once there is some, with the exact figure', async () => {
    const quiet = await on(<SocialMediaScreen />, one());
    expect(rowsOf(quiet).some((row) => row.props.title === 'Fame')).toBe(false);
    const known = await on(<SocialMediaScreen />, withFame(one(), 12));
    const row = rowTitled(known, 'Fame');
    expect(row.props.value).toBe('12%');
    await act(() => row.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'fame', title: 'Fame' });
  });

  it('answers a sponsorship three ways', async () => {
    const state = withSponsor(RICH);
    const first = sponsorOffers(state)[0]!;
    const r = await on(<SocialMediaScreen />, state);
    expect(textsOf(r)).toContain(first.offer.brand);
    const labels = buttonsOf(r).map((b) => b.props.label);
    expect(labels.slice(0, 3)).toEqual(['Take it', 'Ask for more', 'Pass']);
    await act(() => buttonLabelled(r, 'Take it').props.onPress());
    await act(() => buttonLabelled(r, 'Ask for more').props.onPress());
    await act(() => buttonLabelled(r, 'Pass').props.onPress());
    expect(creating.mock.calls).toEqual([
      [{ type: 'sponsor', offerId: first.offer.id, answer: 'accept' }],
      [{ type: 'sponsor', offerId: first.offer.id, answer: 'more' }],
      [{ type: 'sponsor', offerId: first.offer.id, answer: 'decline' }],
    ]);
  });

  it('answers a collaboration, naming the price and the people it brings', async () => {
    const state = withCollab(RICH);
    const offer = collabOffers(state)[0]!.offer;
    const r = await on(<SocialMediaScreen />, state);
    expect(textsOf(r)).toContain(offer.partner.name);
    expect(textsOf(r).join(' ')).toContain(
      `About ${offer.gain.toLocaleString('en-US')} new people`,
    );
    const label = offer.fee > 0 ? `Pay $${offer.fee.toLocaleString('en-US')}` : 'Do it';
    await act(() => buttonLabelled(r, label).props.onPress());
    expect(creating).toHaveBeenCalledWith({ type: 'collab', offerId: offer.id, answer: 'accept' });
  });

  it('answers a group, naming what it keeps', async () => {
    const state = withGroup(RICH);
    const offer = groupOffers(state)[0]!.offer;
    const r = await on(<SocialMediaScreen />, state);
    expect(textsOf(r).join(' ')).toContain(
      `They keep ${Math.round(offer.cut * 100)}% of what it earns`,
    );
    await act(() => buttonLabelled(r, 'Join').props.onPress());
    expect(creating).toHaveBeenCalledWith({ type: 'group', offerId: offer.id, answer: 'join' });
  });

  it('says when nobody has asked', async () => {
    const state = withChannelThat(
      RICH,
      (id) => [channelOf(id, 20)],
      (trial) =>
        sponsorOffers(trial).length + collabOffers(trial).length + groupOffers(trial).length === 0,
    );
    const r = await on(<SocialMediaScreen />, state);
    expect(textsOf(r).join(' ')).toContain('Nobody has asked this year.');
  });

  it('hires a manager or an agent when a channel is paying, and not before', async () => {
    const paying = { ...RICH, channels: [channelOf('ch:pay', 250_000)] };
    const r = await on(<SocialMediaScreen />, paying);
    await act(() => rowTitled(r, 'A manager').props.onPress());
    await act(() => rowTitled(r, 'An agent').props.onPress());
    expect(creating.mock.calls).toEqual([
      [{ type: 'hire', kind: 'manager' }],
      [{ type: 'hire', kind: 'agent' }],
    ]);
    const broke = await on(<SocialMediaScreen />, { ...RICH, channels: [channelOf('ch:no', 5)] });
    expect(rowTitled(broke, 'A manager').props.disabled).toBe(true);
    expect(rowTitled(broke, 'An agent').props.disabled).toBe(true);
    expect(textsOf(broke)).toContain(
      'Nobody will take you on until a channel of yours is paying its way.',
    );
  });

  it('shows who looks after you and lets them go', async () => {
    const hired = {
      ...RICH,
      channels: [channelOf('ch:pay', 250_000)],
      representation: 'manager' as const,
    };
    const r = await on(<SocialMediaScreen />, hired);
    expect(
      rowsOf(r).some((row) => row.props.title === 'A manager' && row.props.affordance === 'none'),
    ).toBe(true);
    await act(() => rowTitled(r, 'Let them go').props.onPress());
    expect(creating).toHaveBeenCalledWith({ type: 'drop' });
  });
});

describe('one channel', () => {
  it('shows how it is going', async () => {
    const state = {
      ...RICH,
      channels: [channelOf('ch:one', 12_000, 'video', 'comedy', { peak: 30_000 })],
    };
    const r = await on(<ChannelScreen />, state, {
      screen: 'channel',
      title: 'x',
      channelId: 'ch:one',
    });
    expect(rowTitled(r, 'Video').props.value).toBe('12,000 subscribers');
    expect(rowTitled(r, 'Biggest it has been').props.value).toBe('30,000');
    expect(rowTitled(r, 'Earned so far').props.value).toBe('$0');
  });

  it('marks the current effort and changes it to the one pressed', async () => {
    const r = await on(<ChannelScreen />, one(), {
      screen: 'channel',
      title: 'x',
      channelId: 'ch:one',
    });
    expect(rowTitled(r, 'Regular').props.value).toBe('Now');
    expect(rowTitled(r, 'Regular').props.onPress).toBeUndefined();
    expect(rowTitled(r, 'Light').props.value).toBeUndefined();
    await act(() => rowTitled(r, 'Heavy').props.onPress());
    expect(creating).toHaveBeenCalledWith({ type: 'effort', channelId: 'ch:one', effort: 'heavy' });
  });

  it('has a price only on a newsletter', async () => {
    const plain = await on(<ChannelScreen />, one(), {
      screen: 'channel',
      title: 'x',
      channelId: 'ch:one',
    });
    expect(rowsOf(plain).some((row) => String(row.props.title).endsWith('a month'))).toBe(false);
    const letter = {
      ...RICH,
      channels: [
        channelOf('ch:n', 5_000, 'subscription', 'comedy', { tier: 'premium', paid: 120 }),
      ],
    };
    const r = await on(<ChannelScreen />, letter, {
      screen: 'channel',
      title: 'x',
      channelId: 'ch:n',
    });
    expect(rowTitled(r, 'Premium, $15 a month').props.value).toBe('Now');
    expect(rowTitled(r, 'Paying readers').props.value).toBe('120');
    await act(() => rowTitled(r, 'Low, $5 a month').props.onPress());
    expect(creating).toHaveBeenCalledWith({ type: 'tier', channelId: 'ch:n', tier: 'low' });
  });

  it('treats a newsletter with no price chosen as standard', async () => {
    const letter = { ...RICH, channels: [channelOf('ch:n', 5_000, 'subscription', 'comedy')] };
    const r = await on(<ChannelScreen />, letter, {
      screen: 'channel',
      title: 'x',
      channelId: 'ch:n',
    });
    expect(rowTitled(r, 'Standard, $8 a month').props.value).toBe('Now');
    expect(rowTitled(r, 'Low, $5 a month').props.value).toBeUndefined();
  });

  it('leaves a group', async () => {
    const grouped = {
      ...RICH,
      channels: [
        channelOf('ch:one', 12_000, 'video', 'comedy', {
          group: { id: 'g:1', kind: 'group', name: 'Backlot Society', cut: 0.2, since: 2050 },
        }),
      ],
    };
    const r = await on(<ChannelScreen />, grouped, {
      screen: 'channel',
      title: 'x',
      channelId: 'ch:one',
    });
    expect(rowTitled(r, 'Backlot Society').props.subtitle).toBe('They keep 20% of what it earns');
    await act(() => rowTitled(r, 'Leave').props.onPress());
    expect(creating).toHaveBeenCalledWith({ type: 'leaveGroup', channelId: 'ch:one' });
  });

  it('asks before closing, and closing goes back', async () => {
    const r = await on(<ChannelScreen />, one(), {
      screen: 'channel',
      title: 'x',
      channelId: 'ch:one',
    });
    await act(() => buttonLabelled(r, 'Close this channel').props.onPress());
    expect(creating).not.toHaveBeenCalled();
    expect(textsOf(r)).toContain(`Close ${one().channels[0]!.name}?`);
    await act(() => buttonLabelled(r, 'Cancel').props.onPress());
    expect(creating).not.toHaveBeenCalled();
    expect(buttonsOf(r).map((b) => b.props.label)).toContain('Close this channel');
    await act(() => buttonLabelled(r, 'Close this channel').props.onPress());
    await act(() => buttonLabelled(r, 'Close it').props.onPress());
    expect(creating).toHaveBeenCalledWith({ type: 'close', channelId: 'ch:one' });
    expect(pop).toHaveBeenCalledTimes(1);
  });

  it('says so when the channel is gone', async () => {
    const r = await on(<ChannelScreen />, RICH, {
      screen: 'channel',
      title: 'x',
      channelId: 'ch:gone',
    });
    expect(textsOf(r)).toContain('That channel is gone');
  });
});

describe('starting a channel', () => {
  it('lists every platform with what getting set up costs', async () => {
    const r = await on(<NewChannelScreen />, RICH, { screen: 'newChannel', title: 'x' });
    expect(rowsOf(r).map((row) => [row.props.title, row.props.value])).toEqual(
      PLATFORMS.map((p) => [p.name, `$${p.startCost.toLocaleString('en-US')}`]),
    );
    expect(PLATFORMS).toHaveLength(6);
    await act(() => rowTitled(r, 'Podcast').props.onPress());
    expect(push).toHaveBeenCalledWith({
      screen: 'newChannel',
      title: 'Podcast',
      platformId: 'podcast',
    });
  });

  it('shuts a platform a fourteen-year-old is too young for', async () => {
    const teen = { ...RICH, player: { ...RICH.player, age: 14 } };
    const r = await on(<NewChannelScreen />, teen, { screen: 'newChannel', title: 'x' });
    expect(rowTitled(r, 'Podcast').props.disabled).toBe(true);
    expect(rowTitled(r, 'Podcast').props.subtitle).toBe('You have to be 16');
    expect(rowTitled(r, 'Video').props.disabled).toBe(false);
  });

  it('lists what could be made, with the reason beside what cannot, and opens the one pressed', async () => {
    const video = PLATFORMS.find((p) => p.id === 'video')!;
    const state = { ...RICH, channels: [channelOf('ch:one', 12_000, 'video', 'comedy')] };
    const r = await on(<NewChannelScreen />, state, {
      screen: 'newChannel',
      title: 'x',
      platformId: 'video',
    });
    const rows = rowsOf(r);
    expect(rows).toHaveLength(video.categories.length);
    const have = rows.find((row) => row.props.title === 'Comedy')!;
    expect(have.props.disabled).toBe(true);
    expect(have.props.subtitle).toBe('You already have one of those.');
    const open = rows.filter((row) => !row.props.disabled);
    expect(open.length).toBe(video.categories.length - 1);
    await act(() => open[0]!.props.onPress());
    expect(creating).toHaveBeenCalledTimes(1);
    expect(creating.mock.calls[0]![0]).toMatchObject({ type: 'open', platformId: 'video' });
    // Back out of the category list and the platform list, to Social Media.
    expect(pop).toHaveBeenCalledTimes(2);
  });

  it('says when there is not the money', async () => {
    const r = await on(<NewChannelScreen />, withCash(ADULT, 10), {
      screen: 'newChannel',
      title: 'x',
      platformId: 'video',
    });
    for (const row of rowsOf(r)) {
      expect(row.props.disabled).toBe(true);
      expect(row.props.subtitle).toBe("You need $600 for that, and you don't have it.");
    }
  });
});

const friend: Acquaintance = {
  id: asNpcId('npc:fame-ui-friend'),
  firstName: 'Wren',
  lastName: 'Okafor',
  sex: 'female',
  birthYear: 2000,
  alive: true,
  tier: 3,
  personality: createPersonality(),
  relationship: 85,
  kind: 'peer',
  context: 'school',
  metAtAge: 6,
  lastContactAge: 25,
  memories: [],
  inRoom: false,
};
const big = (id: string) => [channelOf(id, 250_000)];
const circle = { people: [friend], contact: {} };

describe('how a collaboration reads', () => {
  it('says a friend does it for nothing, a stranger charges, and an equal swaps', async () => {
    const seen = new Map<string, string>();
    for (let i = 0; i < 1500 && seen.size < 3; i += 1) {
      const trial = {
        ...RICH,
        circle,
        channels: [channelOf(`ch:2050:video:k${i}`, i % 2 === 0 ? 250_000 : 4_000)],
      };
      for (const { offer } of collabOffers(trial)) {
        const kind = offer.partner.friend ? 'friend' : offer.fee > 0 ? 'charge' : 'swap';
        if (seen.has(kind)) continue;
        const r = await on(<SocialMediaScreen />, trial);
        const body = textsOf(r).find((text) =>
          text.includes(`About ${offer.gain.toLocaleString('en-US')} new people for`),
        )!;
        seen.set(kind, body);
        if (kind === 'friend') expect(body).toContain('A friend who will do it for nothing.');
        if (kind === 'charge') {
          expect(body).toContain(`They charge $${offer.fee.toLocaleString('en-US')}.`);
        }
        if (kind === 'swap') {
          expect(body).toContain('A swap: you appear on theirs and they appear on yours.');
        }
      }
    }
    expect([...seen.keys()].sort()).toEqual(['charge', 'friend', 'swap']);
  });
});

describe('on offer, more carefully', () => {
  it('does not say nobody has asked when only a group has', async () => {
    const state = withChannelThat(
      RICH,
      big,
      (trial) =>
        groupOffers(trial).length > 0 &&
        sponsorOffers(trial).length === 0 &&
        collabOffers(trial).length === 0,
    );
    const r = await on(<SocialMediaScreen />, state);
    expect(textsOf(r).join(' ')).not.toContain('Nobody has asked this year.');
    expect(buttonsOf(r).map((b) => b.props.label)).toEqual(['Join', 'Pass']);
  });

  it('leaves the hiring rows without a press when nobody will take you on', async () => {
    const r = await on(<SocialMediaScreen />, { ...RICH, channels: [channelOf('ch:no', 5)] });
    expect(rowTitled(r, 'A manager').props.onPress).toBeUndefined();
    expect(rowTitled(r, 'An agent').props.onPress).toBeUndefined();
  });

  it('shows the group a channel is in, or else where it stands on its chart', async () => {
    const podcast = channelOf('ch:pod', 50_000, 'podcast', 'comedy');
    const grouped = {
      ...podcast,
      id: 'ch:grp',
      name: 'Grouped One',
      group: {
        id: 'g:1',
        kind: 'network' as const,
        name: 'Backlot Society',
        cut: 0.2,
        since: 2050,
      },
    };
    const r = await on(<SocialMediaScreen />, { ...RICH, channels: [podcast, grouped] });
    const rows = rowsOf(r).filter((row) => row.props.meta !== undefined);
    expect(rows.map((row) => row.props.meta)).toEqual([
      '#88 on the Podcast chart',
      'In Backlot Society',
    ]);
  });
});

describe('one channel, more carefully', () => {
  const route = (id: string) => ({ screen: 'channel', title: 'x', channelId: id });

  it('shows what it has earned, in dollars', async () => {
    const state = {
      ...RICH,
      channels: [channelOf('ch:e', 12_000, 'video', 'comedy', { earned: dollars(2_500) })],
    };
    const r = await on(<ChannelScreen />, state, route('ch:e'));
    expect(rowTitled(r, 'Earned so far').props.value).toBe('$2,500');
  });

  it('shows paying readers only on a newsletter, even if another channel somehow has a count', async () => {
    const state = {
      ...RICH,
      channels: [channelOf('ch:v', 12_000, 'video', 'comedy', { paid: 50 })],
    };
    const r = await on(<ChannelScreen />, state, route('ch:v'));
    expect(rowsOf(r).some((row) => row.props.title === 'Paying readers')).toBe(false);
  });

  it('shows the chart only when it is on one, and what is in fashion only when it is not steady', async () => {
    const off = await on(<ChannelScreen />, one(), route('ch:one'));
    expect(rowsOf(off).some((row) => row.props.title === 'On the chart')).toBe(false);
    expect(rowsOf(off).some((row) => row.props.title === "What's in fashion")).toBe(false);
    const state = {
      ...RICH,
      world: { ...RICH.world, year: 2028 },
      channels: [channelOf('ch:pod', 50_000, 'podcast', 'comedy')],
    };
    const r = await on(<ChannelScreen />, state, route('ch:pod'));
    const chart = rowTitled(r, 'On the chart');
    expect(chart.props.value).toBe('#88 on the Podcast chart');
    expect(chart.props.subtitle).toBe('In the top 100');
    expect(rowTitled(r, "What's in fashion").props.subtitle).toBe('Comedy: doing well');
  });

  it('starts the category that was pressed', async () => {
    const video = PLATFORMS.find((p) => p.id === 'video')!;
    const r = await on(<NewChannelScreen />, RICH, {
      screen: 'newChannel',
      title: 'x',
      platformId: 'video',
    });
    const names = video.categories.map((id) => findCreatorCategory(id)!.name);
    const rows = rowsOf(r);
    expect(rows.map((row) => row.props.title)).toEqual(names);
    await act(() => rows[1]!.props.onPress());
    expect(creating).toHaveBeenCalledWith({
      type: 'open',
      platformId: 'video',
      categoryId: video.categories[1],
    });
  });

  it('says how much there is to spend', async () => {
    const r = await on(<NewChannelScreen />, withCash(ADULT, 1_234), {
      screen: 'newChannel',
      title: 'x',
    });
    expect(textsOf(r).join(' ')).toContain('You have $1,234.');
  });
});
