/**
 * Ticket 0708 — what the Social Media and Fame screens do, as plain functions.
 *
 * The store is the one place the UI touches the simulation, and it is a React context, which is
 * a poor place to test anything. So each verb is a pure function from a state to a state and
 * the card that answers it, and the store only holds the result. A refusal comes back as words
 * the player can read ("You don't have enough money for the gear"), never a code.
 */

import type { TimelineEntry } from '@yearafter/character';
import { findFameWork, type RepresentationKind } from '@yearafter/content';
import {
  PAYMENT_REFUSAL_LABELS,
  type Effort,
  type PaidTier,
  type PaymentRefusal,
  type SponsorAnswer,
} from '@yearafter/finance';
import {
  answerCollabOffer,
  answerEncounter,
  answerGroupOffer,
  answerSponsorOffer,
  closeChannel,
  doConnectionAction,
  doFameWork,
  dropRepresentation,
  hireRepresentation,
  leaveGroup,
  openChannel,
  postToChannel,
  setChannelEffort,
  setPaidTier,
  type GameState,
} from '@yearafter/simulation';
import type { Outcome } from '../components/OutcomeCard';

/** Every verb a creator has, as one value so the store has one action for them. */
export type CreatorAction =
  | { readonly type: 'post'; readonly channelId: string; readonly kind: string }
  | { readonly type: 'open'; readonly platformId: string; readonly categoryId: string }
  | { readonly type: 'effort'; readonly channelId: string; readonly effort: Effort }
  | { readonly type: 'tier'; readonly channelId: string; readonly tier: PaidTier }
  | { readonly type: 'close'; readonly channelId: string }
  | { readonly type: 'sponsor'; readonly offerId: string; readonly answer: SponsorAnswer }
  | { readonly type: 'collab'; readonly offerId: string; readonly answer: 'accept' | 'decline' }
  | { readonly type: 'group'; readonly offerId: string; readonly answer: 'join' | 'decline' }
  | { readonly type: 'leaveGroup'; readonly channelId: string }
  | { readonly type: 'hire'; readonly kind: RepresentationKind }
  | { readonly type: 'drop' };

/** What happened: the new state, the lines it wrote, and the card to show, if it earns one. */
export interface Done {
  readonly ok: true;
  readonly state: GameState;
  readonly entries: readonly TimelineEntry[];
  /** Absent for a setting that the screen already shows (an effort, a price). */
  readonly outcome?: Outcome;
}

/** Something stood in the way. `outcome` is the card that says so. */
export interface Refused {
  readonly ok: false;
  readonly outcome: Outcome;
}

export type Attempt = Done | Refused;

const refuse = (body: string, title = "That can't be done"): Refused => ({
  ok: false,
  outcome: { title, body, tone: 'bad' },
});

const dollarsText = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

/** The lines a change added to the feed: what is in `after` and was not in `before`. */
export function newEntries(before: GameState, after: GameState): readonly TimelineEntry[] {
  const had = new Set(before.player.timeline.map((entry) => entry.id));
  return after.player.timeline.filter((entry) => !had.has(entry.id));
}

const wrote = (entries: readonly TimelineEntry[], fallback: string): string =>
  entries.map((entry) => entry.text).join(' ') || fallback;

/** Every refusal the creator verbs can give, in words. Keyed by the engine's `kind`. */
export function refusalText(refusal: {
  readonly kind: string;
  readonly age?: number;
  readonly limit?: number;
  readonly needed?: number;
  readonly reason?: PaymentRefusal;
}): string {
  switch (refusal.kind) {
    case 'payment':
      return refusal.reason
        ? PAYMENT_REFUSAL_LABELS[refusal.reason]
        : 'Check how you are paying and try again.';
    case 'tooYoung':
      // A channel's refusal carries the age it needs; a flirt's does not, and means one of the two.
      return refusal.age === undefined
        ? 'One of you is too young for that.'
        : `You have to be ${refusal.age} to start one here.`;
    case 'unknownPlatform':
      return "That place isn't open to new channels.";
    case 'notSuitable':
      return "That kind of channel doesn't fit there.";
    case 'alreadyHaveOne':
      return 'You already have one of those.';
    case 'tooMany':
      return `You can only keep ${refusal.limit ?? 4} channels going at once.`;
    case 'notEnoughMoney':
      return `You need ${dollarsText(refusal.needed ?? 0)} for that, and you don't have it.`;
    case 'postingLimit':
      return "You've posted enough on this account this year. You can post again next year.";
    case 'noSuchPost':
      return "That kind of post doesn't fit this platform.";
    case 'noSuchChannel':
      return "That channel isn't there any more.";
    case 'notSubscription':
      return 'Only a paid newsletter has a price to set.';
    case 'notOffered':
      return "That offer isn't on the table any more.";
    case 'notInGroup':
      return "That channel isn't in a group.";
    case 'nobodyWillTakeYouOn':
      return 'Nobody will take you on until a channel of yours is paying its way.';
    case 'haveNone':
      return "You don't have anyone representing you.";
    case 'noEncounter':
      return "There's nobody here to talk to.";
    case 'noSuchAction':
      return "That isn't something you can do.";
    case 'tooFarApart':
      return "They're too far from your age for that.";
    case 'alreadyWithSomeone':
      return "You're already with someone.";
    case 'noSuchTie':
      return "You don't know them.";
    case 'notAround':
      return "They aren't around any more.";
    case 'notCloseEnough':
      return "You don't know them well enough for that yet.";
    case 'doneThisYear':
      return "You've already done that with them this year.";
    case 'friendsNow':
      return "They're a friend now. Ask them out from your friends list.";
    case 'notTheirField':
      return "That isn't something they do.";
    case 'noChannel':
      return "You'd need a channel with an audience for that.";
    case 'noShow':
      return "You'd need a video, stream or podcast with an audience to have them on.";
    case 'noBusiness':
      return "You'd need a business of your own for that.";
    case 'notBigEnough':
      return "They aren't well known enough for that to mean anything.";
    default:
      return "That can't be done right now.";
  }
}

const failed = (error: Parameters<typeof refusalText>[0]): Refused =>
  refuse(
    refusalText(error),
    error.kind === 'notEnoughMoney' ? 'Not enough money' : "That can't be done",
  );

export function applyCreatorAction(state: GameState, action: CreatorAction): Attempt {
  switch (action.type) {
    case 'post': {
      const result = postToChannel(state, action.channelId, action.kind);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      const gained =
        result.value.channels.find((row) => row.id === action.channelId)?.publishing?.gained ?? 0;
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: {
          title: 'Post published',
          body: wrote(entries, 'Your post is live.'),
          tone: gained > 0 ? 'good' : gained < 0 ? 'bad' : 'neutral',
        },
      };
    }
    case 'open': {
      const result = openChannel(state, action.platformId, action.categoryId);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: {
          title: 'Channel started',
          body: wrote(entries, 'You started a channel.'),
          tone: 'good',
        },
      };
    }
    case 'effort': {
      const result = setChannelEffort(state, action.channelId, action.effort);
      if (!result.ok) return failed(result.error);
      return { ok: true, state: result.value, entries: [] };
    }
    case 'tier': {
      const result = setPaidTier(state, action.channelId, action.tier);
      if (!result.ok) return failed(result.error);
      return { ok: true, state: result.value, entries: [] };
    }
    case 'close': {
      const result = closeChannel(state, action.channelId);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: { title: 'Channel closed', body: wrote(entries, 'You stopped.'), tone: 'neutral' },
      };
    }
    case 'sponsor': {
      const result = answerSponsorOffer(state, action.offerId, action.answer);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      const owed = (s: GameState): number =>
        s.channels.reduce((sum, channel) => sum + Number(channel.owed ?? 0), 0);
      const landed = owed(result.value) > owed(state);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: {
          title:
            action.answer === 'decline'
              ? 'You passed'
              : landed
                ? 'The deal is on'
                : 'They walked away',
          body: wrote(entries, 'Done.'),
          tone: action.answer === 'decline' ? 'neutral' : landed ? 'good' : 'bad',
        },
      };
    }
    case 'collab': {
      const result = answerCollabOffer(state, action.offerId, action.answer);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: {
          title: action.answer === 'accept' ? 'You worked together' : 'You passed',
          body: wrote(entries, 'Done.'),
          tone: action.answer === 'accept' ? 'good' : 'neutral',
        },
      };
    }
    case 'group': {
      const result = answerGroupOffer(state, action.offerId, action.answer);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: {
          title: action.answer === 'join' ? 'You signed' : 'You passed',
          body: wrote(entries, 'Done.'),
          tone: action.answer === 'join' ? 'good' : 'neutral',
        },
      };
    }
    case 'leaveGroup': {
      const result = leaveGroup(state, action.channelId);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: { title: 'You left', body: wrote(entries, 'You left.'), tone: 'neutral' },
      };
    }
    case 'hire': {
      const result = hireRepresentation(state, action.kind);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: {
          title: action.kind === 'manager' ? 'You have a manager' : 'You have an agent',
          body: wrote(entries, 'Done.'),
          tone: 'good',
        },
      };
    }
    case 'drop': {
      const result = dropRepresentation(state);
      if (!result.ok) return failed(result.error);
      const entries = newEntries(state, result.value);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: { title: 'You let them go', body: wrote(entries, 'Done.'), tone: 'neutral' },
      };
    }
  }
}

/** Say yes to a photoshoot, a commercial, a talk show or a part. */
export function applyFameWork(state: GameState, workId: string): Attempt {
  const result = doFameWork(state, workId);
  if (!result.ok) return failed(result.error);
  const entries = newEntries(state, result.value);
  const def = findFameWork(workId);
  const done = result.value.celebrities.work.done.find((row) => row.id === workId);
  return {
    ok: true,
    state: result.value,
    entries,
    outcome: {
      title: `${def?.label ?? 'Work'} done`,
      body: wrote(entries, 'Done.'),
      tone: 'good',
      ...(done === undefined ? {} : { value: dollarsText(done.pay) }),
    },
  };
}

/** Do something with somebody famous you know. */
export function applyConnection(
  state: GameState,
  tieId: string,
  actionId: string,
  targetId?: string,
): Attempt {
  const result = doConnectionAction(state, tieId, actionId, targetId);
  if (!result.ok) return failed(result.error);
  const { worked, becameFriend, gained, entries } = result.value;
  return {
    ok: true,
    state: result.value.state,
    entries,
    outcome: {
      title: becameFriend ? "You're friends now" : worked ? 'That went well' : "It didn't land",
      body: wrote(entries, 'Done.'),
      tone: worked ? 'good' : 'bad',
      ...(gained === undefined || gained <= 0
        ? {}
        : { value: `+${gained.toLocaleString('en-US')}` }),
    },
  };
}

/** The card's title for what you did to a famous stranger, and how it went. */
export function meetingTitle(actionId: string, worked: boolean, connected: boolean): string {
  if (actionId === 'ignore') return 'You let it go';
  if (actionId === 'insult') return 'You said it';
  if (connected) return 'You made a connection';
  return worked ? 'That went well' : "It didn't land";
}

/** What you do when you meet somebody famous. Insulting and ignoring always "work", so they are never green. */
export function applyMeeting(state: GameState, actionId: string): Attempt {
  const result = answerEncounter(state, actionId);
  if (!result.ok) return failed(result.error);
  const { worked, connected, entries } = result.value;
  const rude = actionId === 'ignore' || actionId === 'insult';
  return {
    ok: true,
    state: result.value.state,
    entries,
    outcome: {
      title: meetingTitle(actionId, worked, connected),
      body: wrote(entries, 'Done.'),
      tone: rude ? 'neutral' : worked ? 'good' : 'bad',
    },
  };
}
