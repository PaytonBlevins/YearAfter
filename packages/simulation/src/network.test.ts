/**
 * Ticket 0704 acceptance tests — who a creator works with (simulation side).
 */

import { describe, expect, it } from 'vitest';
import { CREATOR_LINES, GROUP_NAMES } from '@yearafter/content';
import { cents } from '@yearafter/core';
import {
  GROUP_CUTS,
  MANAGER_CUT,
  collabFee,
  collabGain,
  creatorHours,
  reconcile,
  sponsorOffersFor,
  type Channel,
} from '@yearafter/finance';
import { isFriend, displayName } from '@yearafter/social';
import { advanceYear } from './advance';
import {
  answerSponsorOffer,
  creatorWeek,
  openChannel,
  runCreatorsYear,
  sponsorOffers,
} from './creators';
import { continueAsChild, heirsIn } from './continue';
import { decide } from './decide';
import type { GameState } from './game-state';
import {
  answerCollabOffer,
  answerGroupOffer,
  collabOffers,
  dropRepresentation,
  friendsOf,
  groupOffers,
  hireRepresentation,
  leaveGroup,
  whyNotHire,
} from './network';
import { createNewGame } from './new-game';

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

function liveTo(seed: string, age: number): GameState {
  let state = createNewGame({ seed });
  let guard = 0;
  while (state.player.alive && state.player.age < age && (guard += 1) < 80) {
    state = answerEverything(
      advanceYear({
        ...state,
        channels: state.channels.map((channel) => ({
          ...channel,
          publishing: { year: state.world.year, count: 12, kind: 'gameplay', gained: 0 },
        })),
      }).state,
    );
  }
  return state;
}

const ADULT = liveTo('creators-adult', 25);

const withCash = (state: GameState, dollars: number): GameState => {
  const books = {
    ...state.finance,
    balance: cents(dollars * 100),
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:test-${dollars}`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: cents(dollars * 100 - Number(state.finance.balance)),
        source: 'A test windfall',
      },
    ],
  };
  return { ...state, finance: books, player: { ...state.player, cash: books.balance } };
};

/** A creator with one video channel of this size, with a lot of money. */
function creator(audience: number, over: Partial<Channel> = {}): GameState {
  const opened = openChannel(withCash(ADULT, 50_000), 'video', 'gaming');
  if (!opened.ok) throw new Error(`refused: ${opened.error.kind}`);
  const state = opened.value;
  return {
    ...state,
    channels: state.channels.map((channel) => ({
      ...channel,
      luck: 0.99999,
      audience,
      peak: audience,
      publishing: { year: state.world.year, count: 12, kind: 'gameplay', gained: 0 },
      ...over,
    })),
  };
}

/** The same creator, in the first year (after this one) that has an offer worth taking. */
function inAYearWith<T>(
  state: GameState,
  pick: (state: GameState) => T | undefined,
): { readonly state: GameState; readonly found: T } {
  for (let year = state.world.year; year < state.world.year + 400; year += 1) {
    const moved = { ...state, world: { ...state.world, year } };
    const found = pick(moved);
    if (found !== undefined) return { state: moved, found };
  }
  throw new Error('no such year');
}

const timelineEnd = (state: GameState): string => state.player.timeline.at(-1)!.text;

describe('who counts as a friend', () => {
  it('is the people in the circle who are friends now, by the name the game calls them', () => {
    const expected = ADULT.circle.people
      .filter(isFriend)
      .map((p) => ({ id: p.id, name: displayName(p) }));
    expect(expected.length).toBeGreaterThan(0);
    expect(friendsOf(ADULT)).toEqual(expected);
  });

  it('is not somebody you have lost touch with', () => {
    const first = friendsOf(ADULT)[0]!;
    const lost: GameState = {
      ...ADULT,
      circle: {
        ...ADULT.circle,
        people: ADULT.circle.people.map((p) =>
          p.id === first.id ? { ...p, endedAtAge: ADULT.player.age } : p,
        ),
      },
    };
    expect(friendsOf(lost).map((f) => f.id)).not.toContain(first.id);
    expect(friendsOf(lost)).toHaveLength(friendsOf(ADULT).length - 1);
  });
});

describe('collaborations, in the game', () => {
  const asked = (state: GameState) =>
    collabOffers(state).find((row) => row.offer.fee === 0 && !row.offer.partner.friend);

  it('has nothing for a channel with nobody, and something for one with a following', () => {
    expect(collabOffers(creator(0))).toEqual([]);
    expect(
      inAYearWith(creator(5_000), (s) => (collabOffers(s).length > 0 ? true : undefined)).found,
    ).toBe(true);
  });

  it('brings the people over for nothing from someone your size, and says so', () => {
    const { state, found } = inAYearWith(creator(5_000), asked);
    const result = answerCollabOffer(state, found.offer.id, 'accept');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value;
    expect(next.channels[0]!.audience).toBe(5_000 + found.offer.gain);
    expect(next.channels[0]!.collabs).toEqual({ [found.offer.partner.id]: 1 });
    expect(next.finance.transactions).toHaveLength(state.finance.transactions.length);
    expect(next.player.cash).toBe(state.player.cash);
    const text = timelineEnd(next);
    expect(text).toContain(found.offer.partner.name);
    expect(text).toContain(found.offer.gain.toLocaleString('en-US'));
    expect(text).not.toMatch(/[{}]/);
    expect(state.channels[0]!.audience).toBe(5_000);
  });

  it('writes a friend’s guest spot as a favour, not a swap', () => {
    const friends = friendsOf(ADULT);
    expect(friends.length).toBeGreaterThan(0);
    const { state, found } = inAYearWith(creator(5_000), (s) =>
      collabOffers(s).find((row) => row.offer.partner.friend),
    );
    expect(friends.map((f) => `f:${f.id}`)).toContain(found.offer.partner.id);
    const next = answerCollabOffer(state, found.offer.id, 'accept');
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.value.finance.transactions).toHaveLength(state.finance.transactions.length);
    const favour = CREATOR_LINES.collabFriend.map((line) =>
      line
        .replace('{partner}', found.offer.partner.name)
        .replace('{name}', found.channel.name)
        .replace('{gain}', found.offer.gain.toLocaleString('en-US'))
        .replace('{audience}', 'subscribers'),
    );
    expect(favour).toContain(timelineEnd(next.value));
  });

  it('charges a big name, in cash, as a spending row, and the books still reconcile', () => {
    const { state, found } = inAYearWith(creator(5_000), (s) =>
      collabOffers(s).find((row) => row.offer.fee > 0),
    );
    const fee = found.offer.fee;
    expect(fee).toBe(collabFee(5_000, found.offer.partner.audience, 0));
    const result = answerCollabOffer(state, found.offer.id, 'accept');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value;
    const row = next.finance.transactions.at(-1)!;
    expect(row.category).toBe('spending');
    expect(Number(row.amount)).toBe(-fee * 100);
    expect(row.source).toContain(found.offer.partner.name);
    expect(Number(next.player.cash)).toBe(Number(state.player.cash) - fee * 100);
    expect(next.player.cash).toBe(next.finance.balance);
    expect(reconcile(next.finance).ok).toBe(true);
    expect(next.channels[0]!.audience).toBe(5_000 + found.offer.gain);
    expect(timelineEnd(next)).toContain(`$${fee.toLocaleString('en-US')}`);
  });

  it('refuses to pay what you do not have, and changes nothing', () => {
    const { state, found } = inAYearWith(creator(5_000), (s) =>
      collabOffers(s).find((row) => row.offer.fee > 0),
    );
    const fee = found.offer.fee;
    const poor = withCash(state, fee - 1);
    expect(answerCollabOffer(poor, found.offer.id, 'accept')).toEqual({
      ok: false,
      error: { kind: 'notEnoughMoney', needed: fee },
    });
    // Exactly enough is enough.
    expect(answerCollabOffer(withCash(state, fee), found.offer.id, 'accept').ok).toBe(true);
    // Turning it down needs no money.
    expect(answerCollabOffer(poor, found.offer.id, 'decline').ok).toBe(true);
  });

  it('turning down a paid one costs nothing', () => {
    const { state, found } = inAYearWith(creator(5_000), (s) =>
      collabOffers(s).find((row) => row.offer.fee > 0),
    );
    const result = answerCollabOffer(state, found.offer.id, 'decline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.finance.transactions).toHaveLength(state.finance.transactions.length);
    expect(result.value.player.cash).toBe(state.player.cash);
    expect(result.value.channels[0]!.audience).toBe(5_000);
    const passed = CREATOR_LINES.collabPassed.map((line) =>
      line.replace('{partner}', found.offer.partner.name),
    );
    expect(passed).toContain(timelineEnd(result.value));
  });

  it('turning one down moves nobody, charges nobody, and does not come back', () => {
    const { state, found } = inAYearWith(creator(5_000), (s) => collabOffers(s)[0]);
    const result = answerCollabOffer(state, found.offer.id, 'decline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.channels[0]!.audience).toBe(5_000);
    expect(result.value.channels[0]!.collabs).toBeUndefined();
    expect(result.value.finance.transactions).toHaveLength(state.finance.transactions.length);
    expect(collabOffers(result.value).map((row) => row.offer.id)).not.toContain(found.offer.id);
    expect(timelineEnd(result.value)).toContain(found.offer.partner.name);
    expect(answerCollabOffer(result.value, found.offer.id, 'accept')).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
  });

  it('refuses an offer that was never made', () => {
    expect(answerCollabOffer(creator(5_000), 'co:nope', 'accept')).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
  });

  it('gives the second time with the same person half the first', () => {
    const { state, found } = inAYearWith(creator(5_000), asked);
    const first = answerCollabOffer(state, found.offer.id, 'accept');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const twice = inAYearWith(
      { ...first.value, world: { ...first.value.world, year: state.world.year + 1 } },
      (s) => collabOffers(s).find((row) => row.offer.partner.id === found.offer.partner.id),
    );
    expect(twice.found.offer.repeats).toBe(1);
    expect(twice.found.offer.gain).toBe(
      collabGain(twice.found.channel.audience, twice.found.offer.partner.audience, 1),
    );
    expect(twice.found.offer.gain).toBeLessThanOrEqual(
      collabGain(twice.found.channel.audience, twice.found.offer.partner.audience, 0) / 2 + 1,
    );
  });

  it('is cheaper with an agent', () => {
    const base = creator(5_000);
    const { state, found } = inAYearWith(base, (s) =>
      collabOffers(s).find((row) => row.offer.fee > 0),
    );
    const agented = collabOffers({ ...state, representation: 'agent' }).find(
      (row) => row.offer.id === found.offer.id,
    )!;
    expect(agented.offer.fee).toBeLessThan(found.offer.fee);
    expect(agented.offer.fee).toBe(collabFee(5_000, found.offer.partner.audience, 0.3));
  });
});

describe('groups, in the game', () => {
  const wanted = (state: GameState) => groupOffers(state)[0];

  it('wants nobody who is not already paying their way', () => {
    expect(groupOffers(creator(10))).toEqual([]);
  });

  it('wants a channel that is, sometimes', () => {
    const { found } = inAYearWith(creator(20_000), wanted);
    expect(GROUP_CUTS).toContain(found.offer.cut);
    expect(GROUP_NAMES.group).toContain(found.offer.name);
  });

  it('signing makes the group part of the channel, and says so', () => {
    const { state, found } = inAYearWith(creator(20_000), wanted);
    const result = answerGroupOffer(state, found.offer.id, 'join');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const channel = result.value.channels[0]!;
    expect(channel.group).toMatchObject({
      name: found.offer.name,
      cut: found.offer.cut,
      since: state.world.year,
    });
    const text = timelineEnd(result.value);
    expect(text).toContain(found.offer.name);
    expect(text).toContain(`${Math.round(found.offer.cut * 100)}%`);
    expect(groupOffers(result.value)).toEqual([]);
    expect(state.channels[0]!.group).toBeUndefined();
  });

  it('turning one down keeps the channel out of it, and the offer gone', () => {
    const { state, found } = inAYearWith(creator(20_000), wanted);
    const result = answerGroupOffer(state, found.offer.id, 'decline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.channels[0]!.group).toBeUndefined();
    expect(groupOffers(result.value)).toEqual([]);
    expect(timelineEnd(result.value)).toContain(found.offer.name);
  });

  it('refuses an offer that was never made', () => {
    expect(answerGroupOffer(creator(20_000), 'gp:nope', 'join')).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
  });

  it('leaving takes the share and the reach away and says so', () => {
    const { state, found } = inAYearWith(creator(20_000), wanted);
    const joined = answerGroupOffer(state, found.offer.id, 'join');
    if (!joined.ok) throw new Error('could not join');
    const channelId = joined.value.channels[0]!.id;
    const left = leaveGroup(joined.value, channelId);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.value.channels[0]!.group).toBeUndefined();
    expect(left.value.channels[0]!.audience).toBe(20_000);
    expect(timelineEnd(left.value)).toContain(found.offer.name);
    expect(leaveGroup(left.value, channelId)).toEqual({ ok: false, error: { kind: 'notInGroup' } });
    expect(leaveGroup(left.value, 'nope')).toEqual({ ok: false, error: { kind: 'noSuchChannel' } });
  });
});

describe('with two channels', () => {
  const two = (): GameState => {
    const base = creator(20_000);
    const second = openChannel(base, 'photo', 'lifestyle');
    if (!second.ok) throw new Error(`refused: ${second.error.kind}`);
    return {
      ...second.value,
      channels: second.value.channels.map((c) => ({
        ...c,
        luck: 0.99999,
        audience: 20_000,
        peak: 20_000,
      })),
    };
  };
  const untouched = (id: string): Channel => two().channels.find((c) => c.id === id)!;

  it('answers a collaboration for its own channel and leaves the other as it was', () => {
    const { state, found } = inAYearWith(two(), (s) => collabOffers(s)[0]);
    const next = answerCollabOffer(state, found.offer.id, 'accept');
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    for (const channel of next.value.channels) {
      if (channel.id === found.channel.id) {
        expect(channel.audience).toBe(20_000 + found.offer.gain);
      } else {
        expect(channel).toEqual(untouched(channel.id));
      }
    }
    expect(next.value.channels.map((c) => c.id)).toEqual(state.channels.map((c) => c.id));
  });

  it('signs and leaves a group for its own channel only', () => {
    const { state, found } = inAYearWith(two(), (s) => groupOffers(s)[0]);
    const signed = answerGroupOffer(state, found.offer.id, 'join');
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    const others = signed.value.channels.filter((c) => c.id !== found.channel.id);
    expect(others.length).toBe(1);
    expect(others[0]!.group).toBeUndefined();
    expect(signed.value.channels.find((c) => c.id === found.channel.id)!.group).toBeDefined();
    const left = leaveGroup(signed.value, found.channel.id);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.value.channels.map((c) => c.group)).toEqual([undefined, undefined]);
    // Leaving one channel's group keeps the other's.
    const both: GameState = {
      ...signed.value,
      channels: signed.value.channels.map((c) => ({
        ...c,
        group: c.group ?? { id: 'gp:x', kind: 'house', name: 'Hype House', cut: 0.1, since: 2040 },
      })),
    };
    const one = leaveGroup(both, found.channel.id);
    if (!one.ok) throw new Error('could not leave');
    expect(one.value.channels.filter((c) => c.group !== undefined)).toHaveLength(1);
    expect(one.value.channels.find((c) => c.id === found.channel.id)!.group).toBeUndefined();
  });
});

describe('a manager or an agent, in the game', () => {
  it('will not take on somebody with nothing coming in', () => {
    expect(whyNotHire(creator(10))).toEqual({ kind: 'nobodyWillTakeYouOn' });
    expect(hireRepresentation(creator(10), 'manager')).toEqual({
      ok: false,
      error: { kind: 'nobodyWillTakeYouOn' },
    });
    expect(whyNotHire(ADULT)).toEqual({ kind: 'nobodyWillTakeYouOn' });
  });

  it('takes on a manager or an agent, and not a second one', () => {
    const base = creator(20_000);
    expect(whyNotHire(base)).toBeUndefined();
    for (const kind of ['manager', 'agent'] as const) {
      const hired = hireRepresentation(base, kind);
      expect(hired.ok).toBe(true);
      if (!hired.ok) continue;
      expect(hired.value.representation).toBe(kind);
      expect(base.representation).toBeUndefined();
      const lines = kind === 'manager' ? CREATOR_LINES.managerHired : CREATOR_LINES.agentHired;
      expect(lines).toContain(timelineEnd(hired.value));
      for (const other of ['manager', 'agent'] as const) {
        expect(hireRepresentation(hired.value, other)).toEqual({
          ok: false,
          error: { kind: 'alreadyHaveOne' },
        });
      }
    }
  });

  it('lets them go, and nothing else changes', () => {
    const hired = hireRepresentation(creator(20_000), 'manager');
    if (!hired.ok) throw new Error('not hired');
    const dropped = dropRepresentation(hired.value);
    expect(dropped.ok).toBe(true);
    if (!dropped.ok) return;
    expect('representation' in dropped.value).toBe(false);
    expect(CREATOR_LINES.repDropped).toContain(timelineEnd(dropped.value));
    expect(dropped.value.channels).toEqual(hired.value.channels);
    expect(dropRepresentation(dropped.value)).toEqual({ ok: false, error: { kind: 'haveNone' } });
    expect(whyNotHire(dropped.value)).toBeUndefined();
  });

  it('is not passed on to an heir', () => {
    let found: { dead: GameState; heirId: string } | undefined;
    for (const seed of ['heir-a', 'heir-b', 'heir-c']) {
      let state = createNewGame({ seed });
      let guard = 0;
      while (state.player.alive && (guard += 1) < 90) {
        state = answerEverything(
          advanceYear({
            ...state,
            channels: state.channels.map((channel) => ({
              ...channel,
              publishing: { year: state.world.year, count: 12, kind: 'gameplay', gained: 0 },
            })),
          }).state,
        );
      }
      const heir = heirsIn(state.family)[0];
      if (!state.player.alive && heir) {
        found = {
          dead: { ...state, channels: creator(20_000).channels, representation: 'agent' },
          heirId: heir.id,
        };
        break;
      }
    }
    if (!found) throw new Error('nobody died with an heir');
    expect(found.dead.representation).toBe('agent');
    const next = continueAsChild(found.dead, found.heirId)!;
    expect(next.representation).toBeUndefined();
    expect(next.channels).toEqual([]);
  });
});

describe('what it does to a year', () => {
  const stats = { charisma: 50, willpower: 50 };
  const big: Channel = { ...creator(200_000).channels[0]! };
  const run = (channels: readonly Channel[], representation?: 'manager' | 'agent') =>
    runCreatorsYear({
      channels: channels.map((channel) => ({
        ...channel,
        publishing: { year: 2040, count: 12, kind: 'gameplay', gained: 0 },
      })),
      fame: 0,
      year: 2041,
      stats,
      talents: {},
      ...(representation === undefined ? {} : { representation }),
    });
  const member = (cut: number): Channel => ({
    ...big,
    group: { id: 'gp:2040:x', kind: 'group', name: 'The Loft', cut, since: 2040 },
  });

  it('pays a manager 15% of everything, as a row, and taxes only what is left', () => {
    const plain = run([big]);
    const managed = run([big], 'manager');
    const row = managed.transactions.find((t) => t.source === "Your manager's share")!;
    expect(row.category).toBe('creator');
    const cut = Math.round(managed.gross * MANAGER_CUT);
    expect(Number(row.amount)).toBe(-cut * 100);
    expect(managed.net).toBe(Math.max(0, managed.gross - cut));
    expect(plain.transactions.some((t) => t.source === "Your manager's share")).toBe(false);
  });

  it('grows a channel faster with a manager, and not with an agent', () => {
    const growing = { ...big, audience: 20_000, peak: 20_000 };
    const plain = run([growing]).channels[0]!.audience;
    expect(run([growing], 'manager').channels[0]!.audience).toBeGreaterThan(plain);
    expect(run([growing], 'agent').channels[0]!.audience).toBe(plain);
  });

  it('pays no manager when nothing came in', () => {
    const small = { ...big, luck: 0, audience: 0, peak: 0 };
    expect(
      run([small], 'manager').transactions.some((t) => t.source === "Your manager's share"),
    ).toBe(false);
  });

  it('does not charge an agent a share here: theirs comes out of each deal', () => {
    expect(run([big], 'agent').transactions).toEqual(run([big]).transactions);
  });

  it('pays a group its cut of that channel, named, and not another channel’s', () => {
    const other = { ...big, id: 'other', platformId: 'photo', categoryId: 'lifestyle' };
    const result = run([member(0.2), other]);
    const row = result.transactions.find((t) => t.source.includes("The Loft's share"))!;
    const channelIncome = result.transactions.find((t) => t.source === big.name)!;
    expect(row.source).toBe(`The Loft's share of ${big.name}`);
    expect(Number(row.amount)).toBe(-Math.round((Number(channelIncome.amount) / 100) * 0.2) * 100);
    expect(result.transactions.filter((t) => t.source.includes("'s share"))).toHaveLength(1);
  });

  it('adds a group’s share to a manager’s, so the net is lower than either alone', () => {
    const both = runCreatorsYear({
      channels: [member(0.3)],
      fame: 0,
      year: 2041,
      stats,
      talents: {},
      representation: 'manager',
    });
    expect(both.net).toBeLessThan(run([member(0.3)]).net);
    expect(both.net).toBeLessThan(run([big], 'manager').net);
  });

  it('grows a channel faster in a group than out of one', () => {
    expect(run([member(0.3)]).channels[0]!.audience).toBeGreaterThan(
      run([big]).channels[0]!.audience,
    );
  });

  it('an agent takes their tenth off a deal when you take it, and the pay is told in full', () => {
    const base = creator(200_000);
    const withAgent = hireRepresentation(base, 'agent');
    if (!withAgent.ok) throw new Error('not hired');
    const { state, found } = inAYearWith(withAgent.value, (s) => sponsorOffers(s)[0]);
    const pay = found.offer.pay;
    // The list a screen shows is the agent's list, with the agent's better pay.
    expect(sponsorOffers(state).map((row) => row.offer)).toEqual(
      state.channels.flatMap((channel) =>
        sponsorOffersFor({
          seed: state.rng.getSeed(),
          year: state.world.year,
          channel,
          agent: true,
        }),
      ),
    );
    const owedWith = answerSponsorOffer(state, found.offer.id, 'accept');
    expect(owedWith.ok).toBe(true);
    if (!owedWith.ok) return;
    expect(Number(owedWith.value.channels[0]!.owed)).toBe((pay - Math.round(pay * 0.1)) * 100);
    expect(timelineEnd(owedWith.value)).toContain(`$${pay.toLocaleString('en-US')}`);
  });
});

describe('the year, in the game (0704)', () => {
  const heavy = (state: GameState): GameState => ({
    ...state,
    channels: state.channels.map((c) => ({ ...c, effort: 'heavy' as const })),
  });
  const four = (): GameState => {
    let state = withCash(ADULT, 50_000);
    for (const [platform, category] of [
      ['video', 'gaming'],
      ['stream', 'gaming'],
      ['podcast', 'comedy'],
      ['photo', 'lifestyle'],
    ] as const) {
      const result = openChannel(state, platform, category);
      if (!result.ok) throw new Error(`refused: ${result.error.kind}`);
      state = result.value;
    }
    return heavy({
      ...state,
      channels: state.channels.map((c) => ({
        ...c,
        luck: 0.99999,
        audience: 50_000,
        peak: 50_000,
        publishing: { year: state.world.year, count: 12, kind: 'gameplay', gained: 0 },
      })),
    });
  };

  it('a manager gives back hours: four heavy channels are 36 a week, and 25.2 with one', () => {
    expect(creatorHours(four().channels)).toBe(36);
    expect(creatorHours(four().channels, 0.7)).toBeCloseTo(25.2, 10);
  });

  it('a manager gives back 30% of the week: 36 hours is 25.2 with one, and an agent changes nothing', () => {
    const base = four();
    expect(creatorWeek(base)).toBe(36);
    expect(creatorWeek({ ...base, representation: 'manager' })).toBeCloseTo(25.2, 10);
    expect(creatorWeek({ ...base, representation: 'agent' })).toBe(36);
    expect(creatorWeek({ ...base, channels: [] })).toBe(0);
  });

  it('a manager makes the same heavy life less stressful than none', () => {
    const base = four();
    const stress = (state: GameState) => advanceYear(state).state.player.stress.level;
    expect(stress({ ...base, representation: 'manager' })).toBeLessThan(stress(base));
  });

  it('puts the manager’s share in the books, in the year it was earned, and the books reconcile', () => {
    const managed = hireRepresentation(creator(200_000), 'manager');
    if (!managed.ok) throw new Error('not hired');
    const after = advanceYear(managed.value).state;
    const rows = after.finance.transactions.filter((t) => t.source === "Your manager's share");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.category).toBe('creator');
    expect(Number(rows[0]!.amount)).toBeLessThan(0);
    expect(rows[0]!.year).toBe(after.world.year);
    expect(reconcile(after.finance).ok).toBe(true);
    expect(after.representation).toBe('manager');
  });

  it('goes on for years: the group and the manager stay until you leave them', () => {
    const base = creator(20_000);
    const joined = inAYearWith(base, (s) => groupOffers(s)[0]);
    const sign = answerGroupOffer(joined.state, joined.found.offer.id, 'join');
    if (!sign.ok) throw new Error('not signed');
    const hired = hireRepresentation(sign.value, 'manager');
    if (!hired.ok) throw new Error('not hired');
    let state = hired.value;
    const start = state.world.year;
    for (let i = 0; i < 3; i += 1)
      state = answerEverything(
        advanceYear({
          ...state,
          channels: state.channels.map((channel) => ({
            ...channel,
            publishing: { year: state.world.year, count: 12, kind: 'gameplay', gained: 0 },
          })),
        }).state,
      );
    expect(state.world.year).toBe(start + 3);
    expect(state.channels[0]!.group?.name).toBe(joined.found.offer.name);
    expect(state.representation).toBe('manager');
    const shares = state.finance.transactions.filter((t) => t.source.includes('share'));
    expect(shares.length).toBeGreaterThanOrEqual(3);
  });
});
