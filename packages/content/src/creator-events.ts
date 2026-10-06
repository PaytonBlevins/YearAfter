/**
 * Ticket 0706 — things that happen to a creator, and to somebody who is known.
 *
 * Spec 725–770: events are data, weighted, passive ones belong on the timeline, and
 * "constant disasters should not be normal". Spec 1334: fame itself should not be a
 * recurring stress source. So this is a short list, about half of all years are quiet, the
 * good weighs as much as the bad, and the fame ones are mostly small pleasures with a few
 * mild annoyances.
 *
 * Everything here is data. `simulation/creator-events.ts` decides who is eligible, draws,
 * and applies the effects.
 *
 * Tokens in a line: {channel} the channel's name, {platform}, {audience} what its audience is
 * called ("followers"), {gain} and {loss} a number of people, {amount} and {cost} dollars with
 * the sign left out, {name} and {role} a famous person. American spelling, spoken-style contractions.
 */

export type CreatorEventKind = 'good' | 'bad' | 'fame';

/** Who the event is about: one of the character's channels, or the character. */
export type CreatorEventScope = 'channel' | 'person';

export interface CreatorEventDef {
  readonly id: string;
  readonly kind: CreatorEventKind;
  readonly scope: CreatorEventScope;
  /** Weight against the others that fit this year. */
  readonly weight: number;
  /** Platforms it can happen on; absent means any. */
  readonly platforms?: readonly string[];
  /** Categories it can happen in; absent means any. */
  readonly categories?: readonly string[];
  /** The channel needs at least this many people. */
  readonly minAudience?: number;
  /** The channel is past its platform's paying threshold. */
  readonly paid?: boolean;
  /** Only a channel run at this effort. */
  readonly effort?: 'light' | 'regular' | 'heavy';
  /** The character's fame has to be in this range, inclusive. */
  readonly fame?: readonly [number, number];
  /** Somebody famous is named in the line, and it needs one to be around. */
  readonly figure?: boolean;
  /** Share of the channel's audience gained (positive) or lost (negative), a range. */
  readonly audience?: readonly [number, number];
  /** Share of the year's channel income gained or lost, a range, with the least it moves in dollars. */
  readonly income?: readonly [number, number];
  readonly incomeFloor?: number;
  /** What the row on the books says, after the channel's name. */
  readonly incomeLabel?: string;
  /** A one-off cost, in times the platform's start-up cost, a range. Never under `costFloor` dollars. */
  readonly cost?: readonly [number, number];
  readonly costFloor?: number;
  readonly costLabel?: string;
  /** Points of fame, and of happiness. */
  readonly fameChange?: number;
  readonly mood?: number;
  readonly lines: readonly string[];
}

export const CREATOR_EVENTS: readonly CreatorEventDef[] = [
  /* ------------------------------ good news on a channel ------------------------------ */
  {
    id: 'shoutout',
    kind: 'good',
    scope: 'channel',
    weight: 1.0,
    platforms: ['video', 'stream', 'podcast', 'shortform', 'photo'],
    minAudience: 100,
    audience: [0.06, 0.15],
    lines: [
      'A bigger creator put {channel} on a list of channels to watch. About {gain} new {audience} came over.',
      'Somebody with a much bigger following told people about {channel}. It brought about {gain} {audience}.',
    ],
  },
  {
    id: 'famousMention',
    kind: 'good',
    scope: 'channel',
    weight: 0.7,
    minAudience: 300,
    figure: true,
    fameChange: 1,
    lines: [
      '{name}, {role}, mentioned {channel} in public. About {gain} {audience} followed it back to you.',
      '{name}, {role}, said something kind about {channel}. It brought about {gain} {audience}.',
    ],
  },
  {
    id: 'featured',
    kind: 'good',
    scope: 'channel',
    weight: 1,
    platforms: ['video', 'photo', 'shortform', 'subscription'],
    minAudience: 500,
    audience: [0.1, 0.25],
    lines: [
      '{platform} featured {channel} where new people look first. About {gain} {audience} found it.',
      '{channel} got a spot on the front page of {platform} for a few days. It brought about {gain} {audience}.',
    ],
  },
  {
    id: 'brandCall',
    kind: 'good',
    scope: 'channel',
    weight: 1.2,
    paid: true,
    income: [0.12, 0.3],
    incomeFloor: 300,
    incomeLabel: 'A brand job',
    lines: [
      'A brand called {channel} out of the blue with a small job. It paid {amount}.',
      'A company wanted a quick mention on {channel} and paid {amount} for it.',
    ],
  },
  {
    id: 'pressLink',
    kind: 'good',
    scope: 'channel',
    weight: 0.9,
    categories: ['education', 'tech', 'commentary', 'business', 'truecrime', 'sports'],
    minAudience: 200,
    audience: [0.05, 0.12],
    fameChange: 1,
    lines: [
      'A news site linked to {channel} in a story. About {gain} {audience} followed the link.',
      'A writer quoted {channel} in a piece that did well. It brought about {gain} {audience}.',
    ],
  },
  {
    id: 'fanClip',
    kind: 'good',
    scope: 'channel',
    weight: 0.7,
    minAudience: 200,
    audience: [0.03, 0.07],
    mood: 1,
    lines: [
      'A fan made a clip about {channel} and it got passed around. About {gain} {audience} came from it.',
      'Somebody who loves {channel} cut together their favorite parts, and a few thousand people saw it. About {gain} {audience} stayed.',
    ],
  },
  {
    id: 'tips',
    kind: 'good',
    scope: 'channel',
    weight: 0.8,
    platforms: ['stream', 'podcast', 'subscription'],
    paid: true,
    income: [0.08, 0.2],
    incomeFloor: 100,
    incomeLabel: 'Tips',
    lines: [
      'People who like {channel} chipped in unprompted. It came to {amount}.',
      'A run of tips came in for {channel} this year, {amount} in all.',
    ],
  },
  {
    id: 'firstFan',
    kind: 'good',
    scope: 'channel',
    weight: 0.35,
    mood: 2,
    lines: [
      "Somebody you don't know left a comment on {channel} saying they looked forward to the next one.",
      "A stranger wrote to say they'd been waiting for the next thing on {channel}. It was the first time that had happened.",
    ],
  },
  {
    id: 'hardYear',
    kind: 'good',
    scope: 'channel',
    weight: 0.6,
    minAudience: 50,
    mood: 3,
    lines: [
      'Somebody wrote to say {channel} got them through a hard year. You kept the message.',
      'A stranger told you {channel} was the best part of their week. It stayed with you.',
    ],
  },

  /* ------------------------------ bad news on a channel ------------------------------- */
  {
    id: 'algorithm',
    kind: 'bad',
    scope: 'channel',
    weight: 1.2,
    platforms: ['video', 'stream', 'shortform', 'photo'],
    minAudience: 500,
    audience: [-0.14, -0.06],
    lines: [
      '{platform} changed what it shows people and {channel} dropped out of it. About {loss} {audience} drifted off.',
      'A change in how {platform} picks what to show cost {channel} about {loss} {audience}.',
    ],
  },
  {
    id: 'gearFails',
    kind: 'bad',
    scope: 'channel',
    weight: 0.9,
    cost: [0.4, 2],
    costFloor: 100,
    costLabel: 'Replacement gear',
    lines: [
      'The gear you use for {channel} died mid-year. Replacing it cost {cost}.',
      'Something essential for {channel} broke and had to be replaced. It cost {cost}.',
    ],
  },
  {
    id: 'burnout',
    kind: 'bad',
    scope: 'channel',
    weight: 2.2,
    effort: 'heavy',
    minAudience: 50,
    audience: [-0.08, -0.04],
    mood: -4,
    lines: [
      'You pushed {channel} too hard for too long, and it showed. About {loss} {audience} left.',
      'Running {channel} flat out wore you down. The work got worse and about {loss} {audience} noticed.',
    ],
  },
  {
    id: 'claim',
    kind: 'bad',
    scope: 'channel',
    weight: 1.0,
    platforms: ['video', 'stream', 'podcast'],
    paid: true,
    income: [-0.2, -0.08],
    incomeFloor: 100,
    incomeLabel: 'Held back by a claim',
    cost: [0.3, 0.6],
    costFloor: 150,
    costLabel: 'Clearing a claim',
    lines: [
      'A copyright claim held back part of what {channel} earned while you sorted it out, and the paperwork cost {cost}.',
      'A claim on one of the episodes of {channel} froze some of its pay, and clearing it cost {cost}.',
    ],
  },
  {
    id: 'backlash',
    kind: 'bad',
    scope: 'channel',
    weight: 1.0,
    categories: ['comedy', 'commentary', 'truecrime', 'business', 'sports', 'lifestyle'],
    minAudience: 500,
    audience: [-0.12, -0.05],
    fameChange: -1,
    mood: -2,
    lines: [
      'Something on {channel} got taken the wrong way and people let you know. About {loss} {audience} left.',
      "A post on {channel} caused an argument you didn't want. About {loss} {audience} unfollowed.",
    ],
  },
  {
    id: 'payRules',
    kind: 'bad',
    scope: 'channel',
    weight: 1.1,
    paid: true,
    income: [-0.2, -0.1],
    incomeFloor: 100,
    incomeLabel: 'Lower platform pay',
    lines: [
      '{platform} changed what it pays and {channel} earned {amount} less than it would have.',
      "A change in {platform}'s payments took {amount} out of what {channel} made.",
    ],
  },
  {
    id: 'copycat',
    kind: 'bad',
    scope: 'channel',
    weight: 1.1,
    minAudience: 300,
    audience: [-0.06, -0.03],
    lines: [
      'Somebody started a copy of {channel} and took a few of its {audience}. About {loss} went.',
      'A near copy of {channel} appeared and pulled about {loss} {audience} away.',
    ],
  },

  /* ----------------------------- what being known is like ----------------------------- */
  {
    id: 'recognized',
    kind: 'fame',
    scope: 'person',
    weight: 1.4,
    fame: [8, 40],
    mood: 2,
    lines: [
      'Somebody in a shop knew who you were and told you they liked your work.',
      'A stranger on the street recognized you and said hello. It made your day.',
    ],
  },
  {
    id: 'photoAsk',
    kind: 'fame',
    scope: 'person',
    weight: 1,
    fame: [15, 60],
    mood: 1,
    fameChange: 1,
    lines: [
      'A stranger asked for a picture with you, and it ended up online.',
      'Someone asked to take a selfie with you at the grocery store.',
    ],
  },
  {
    id: 'fanMail',
    kind: 'fame',
    scope: 'person',
    weight: 0.9,
    fame: [20, 100],
    mood: 2,
    lines: [
      'A box of letters from people who follow you turned up this year. You read them all.',
      'The mail brought more fan letters than you expected. A few made you laugh out loud.',
    ],
  },
  {
    id: 'interview',
    kind: 'fame',
    scope: 'person',
    weight: 0.8,
    fame: [25, 100],
    mood: 1,
    fameChange: 2,
    lines: [
      'A magazine asked to interview you, and the piece went over well.',
      'You were interviewed for a profile that people shared more than you expected.',
    ],
  },
  {
    id: 'tabloid',
    kind: 'fame',
    scope: 'person',
    weight: 0.6,
    fame: [30, 100],
    mood: -2,
    fameChange: 1,
    lines: [
      'A gossip site made something up about you. It blew over, but it stung.',
      'A tabloid printed a rumor about you. Nobody who knows you believed it.',
    ],
  },
  {
    id: 'noPrivacy',
    kind: 'fame',
    scope: 'person',
    weight: 0.4,
    fame: [45, 100],
    mood: -1,
    lines: [
      "You couldn't finish a meal in public this year without being stopped.",
      'A quiet day out got interrupted three times by people who knew your name.',
    ],
  },
  {
    id: 'invited',
    kind: 'fame',
    scope: 'person',
    weight: 0.6,
    fame: [40, 100],
    mood: 3,
    fameChange: 1,
    lines: [
      'You were invited to an industry party, and met more interesting people than you could keep track of.',
      "You got a seat at a table you wouldn't have been asked to a few years ago.",
    ],
  },
];

const BY_ID = new Map(CREATOR_EVENTS.map((event) => [event.id, event]));
export const findCreatorEvent = (id: string): CreatorEventDef | undefined => BY_ID.get(id);
