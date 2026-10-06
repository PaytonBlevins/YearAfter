/**
 * Ticket 0704 — who a creator works with.
 *
 * Collaborations, groups, and a manager or an agent. The rules are in `finance/collaborations.ts`,
 * `groups.ts` and `representation.ts`; this is what the screens ask and what is written down.
 * Professional relationships stay in their own world (spec 1316), so nothing here touches the
 * Relationships screen: a friend who guests is a friend, and the collaboration is the channel's.
 */

import { appendToTimeline } from '@yearafter/character';
import { creatorLine } from '@yearafter/content';
import type { RepresentationKind } from '@yearafter/content';
import { dollars, err, ok, stablePick, type Result } from '@yearafter/core';
import {
  answerCollab,
  answerGroup,
  collabOffersFor,
  groupOfferFor,
  leaveGroupOf,
  post,
  whyNotRepresented,
  type Channel,
  type CollabOffer,
  type GroupOffer,
  type RepresentationRefusal,
} from '@yearafter/finance';
import { displayName, isFriend } from '@yearafter/social';
import { entryFor, money, wording } from './creators';
import type { GameState } from './game-state';

/** The people who count as friends, who guest for nothing. */
export const friendsOf = (
  state: GameState,
): readonly { readonly id: string; readonly name: string }[] =>
  state.circle.people
    .filter(isFriend)
    .map((person) => ({ id: person.id, name: displayName(person) }));

/** The text for a line with no channel in it. */
function plain(kind: Parameters<typeof creatorLine>[0], key: string): string {
  return creatorLine(kind, key, {}, (lines, k) => stablePick(lines, k) ?? lines[0] ?? '');
}

/* -------------------------------------------------------------------------- */
/* Collaborations                                                                */
/* -------------------------------------------------------------------------- */

export interface CollabRow {
  readonly offer: CollabOffer;
  readonly channel: Channel;
}

/** Every chance to work with somebody this year, across every channel. */
export function collabOffers(state: GameState): readonly CollabRow[] {
  const friends = friendsOf(state);
  return state.channels.flatMap((channel) =>
    collabOffersFor({
      seed: state.rng.getSeed(),
      year: state.world.year,
      channel,
      friends,
      agent: state.representation === 'agent',
    }).map((offer) => ({ offer, channel })),
  );
}

export type CollabRefusal =
  { readonly kind: 'notOffered' } | { readonly kind: 'notEnoughMoney'; readonly needed: number };

/** Appear with them or turn it down. Paying is a spending row now; the people come over now. */
export function answerCollabOffer(
  state: GameState,
  offerId: string,
  answer: 'accept' | 'decline',
): Result<GameState, CollabRefusal> {
  const found = collabOffers(state).find((row) => row.offer.id === offerId);
  if (found === undefined) return err({ kind: 'notOffered' });
  const { offer, channel } = found;
  const accept = answer === 'accept';
  if (accept && offer.fee > Math.floor(Number(state.player.cash) / 100)) {
    return err({ kind: 'notEnoughMoney', needed: offer.fee });
  }
  const changed = answerCollab({ channel, offer, accept });
  const kind = !accept
    ? 'collabPassed'
    : offer.partner.friend
      ? 'collabFriend'
      : offer.fee > 0
        ? 'collabPaid'
        : 'collabSwap';
  const text = wording(
    kind,
    changed,
    {
      partner: offer.partner.name,
      fee: money(offer.fee),
      gain: offer.gain.toLocaleString('en-US'),
    },
    `creator:${offerId}:${kind}`,
  );
  const spend = accept && offer.fee > 0;
  const books = spend
    ? post(state.finance, state.world.year, state.player.age, {
        category: 'spending',
        amount: dollars(-offer.fee),
        source: `Working with ${offer.partner.name}`,
      })
    : undefined;
  return ok({
    ...state,
    ...(books === undefined ? {} : { finance: books.ledger }),
    channels: state.channels.map((row) => (row.id === channel.id ? changed : row)),
    player: {
      ...state.player,
      ...(books === undefined ? {} : { cash: books.ledger.balance }),
      timeline: appendToTimeline(
        state.player.timeline,
        entryFor(state, text, `creator:collab:${offerId}`),
      ),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Groups                                                                        */
/* -------------------------------------------------------------------------- */

export interface GroupRow {
  readonly offer: GroupOffer;
  readonly channel: Channel;
}

/** Every group that wants a channel this year. */
export function groupOffers(state: GameState): readonly GroupRow[] {
  return state.channels.flatMap((channel) => {
    const offer = groupOfferFor({
      seed: state.rng.getSeed(),
      year: state.world.year,
      channel,
    });
    return offer === undefined ? [] : [{ offer, channel }];
  });
}

export type GroupRefusal = { readonly kind: 'notOffered' };

/** Sign with a group or turn it down. */
export function answerGroupOffer(
  state: GameState,
  offerId: string,
  answer: 'join' | 'decline',
): Result<GameState, GroupRefusal> {
  const found = groupOffers(state).find((row) => row.offer.id === offerId);
  if (found === undefined) return err({ kind: 'notOffered' });
  const { offer, channel } = found;
  const join = answer === 'join';
  const changed = answerGroup({ channel, offer, join, year: state.world.year });
  const kind = join ? 'groupJoined' : 'groupPassed';
  const text = wording(
    kind,
    changed,
    { group: offer.name, cut: `${Math.round(offer.cut * 100)}%` },
    `creator:${offerId}:${kind}`,
  );
  return ok({
    ...state,
    channels: state.channels.map((row) => (row.id === channel.id ? changed : row)),
    player: {
      ...state.player,
      timeline: appendToTimeline(
        state.player.timeline,
        entryFor(state, text, `creator:group:${offerId}`),
      ),
    },
  });
}

export type LeaveRefusal = { readonly kind: 'noSuchChannel' } | { readonly kind: 'notInGroup' };

/** Walk away from a group. The share is yours again and so is the pace. */
export function leaveGroup(state: GameState, channelId: string): Result<GameState, LeaveRefusal> {
  const channel = state.channels.find((row) => row.id === channelId);
  if (channel === undefined) return err({ kind: 'noSuchChannel' });
  if (channel.group === undefined) return err({ kind: 'notInGroup' });
  const text = wording(
    'groupLeft',
    channel,
    { group: channel.group.name },
    `creator:left:${channel.id}:${channel.group.id}`,
  );
  return ok({
    ...state,
    channels: state.channels.map((row) => (row.id === channelId ? leaveGroupOf(row) : row)),
    player: {
      ...state.player,
      timeline: appendToTimeline(
        state.player.timeline,
        entryFor(state, text, `creator:leave:${channel.id}`),
      ),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* A manager or an agent                                                         */
/* -------------------------------------------------------------------------- */

/** Why nobody will take them on, or undefined. */
export const whyNotHire = (state: GameState): RepresentationRefusal | undefined =>
  whyNotRepresented(state.channels, state.representation);

/** Take on a manager or an agent. One or the other, never both. */
export function hireRepresentation(
  state: GameState,
  kind: RepresentationKind,
): Result<GameState, RepresentationRefusal> {
  const refusal = whyNotHire(state);
  if (refusal !== undefined) return err(refusal);
  const line = kind === 'manager' ? 'managerHired' : 'agentHired';
  return ok({
    ...state,
    representation: kind,
    player: {
      ...state.player,
      timeline: appendToTimeline(
        state.player.timeline,
        entryFor(
          state,
          plain(line, `creator:rep:${state.world.year}:${kind}`),
          `creator:hire:${kind}`,
        ),
      ),
    },
  });
}

/** Let them go. Takes effect at once; what an agent already took of a deal stays taken. */
export function dropRepresentation(state: GameState): Result<GameState, RepresentationRefusal> {
  if (state.representation === undefined) return err({ kind: 'haveNone' });
  const { representation: _gone, ...rest } = state;
  return ok({
    ...rest,
    player: {
      ...state.player,
      timeline: appendToTimeline(
        state.player.timeline,
        entryFor(
          state,
          plain('repDropped', `creator:rep:${state.world.year}:drop`),
          'creator:drop',
        ),
      ),
    },
  } as GameState);
}
