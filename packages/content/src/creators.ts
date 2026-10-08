/**
 * Ticket 0701 — the platforms a character can make things for, and what they
 * make.
 *
 * Six platforms (spec 1361: long-form video, streaming, photo/lifestyle,
 * short-form, podcasting, subscription) and a set of categories each lists.
 * Logic depends on the ids and the numbers, never on the names (spec 1456).
 *
 * THE NUMBERS ARE DISTRIBUTION-SHAPED, NOT AVERAGES. Real creator outcomes are
 * a long tail: vidIQ (July 2026) puts 40.6% of channels past 1,000 subscribers,
 * 7.9% past 10,000, 1.3% past 100,000 and 0.13% past a million; the median
 * channel under 100 subscribers grows about 15% a year, one over a million
 * about 3%. `finance/creators.ts` draws a channel's luck once, at opening, and
 * these tables say how far a channel of this kind can go on it.
 */

import type { TalentKey } from '@yearafter/character';
import type { BusinessSkill } from './businesses';

export const PLATFORM_IDS = [
  'video',
  'stream',
  'photo',
  'shortform',
  'podcast',
  'subscription',
  'kick',
  'facebook',
  'twitter',
] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

/** How a platform pays. The rules for each are in `finance/creators.ts`. */
export type Monetization = 'ads' | 'live' | 'brands' | 'shortAds' | 'sponsors' | 'members';

export interface Platform {
  readonly id: PlatformId;
  readonly name: string;
  /** What the audience is called: "subscribers", "followers", "listeners", "members". */
  readonly audienceWord: string;
  /** One of them: "subscriber". */
  readonly audienceOne: string;
  readonly blurb: string;
  readonly monetization: Monetization;
  /** Youngest age to open one. */
  readonly minAge: number;
  /** Opening an account is free. Optional equipment is not a signup charge. */
  readonly startCost: number;
  /** Typical replacement equipment cost for damage events; never charged to create an account. */
  readonly equipmentCost: number;
  /** Audience at which the platform starts paying (its partner threshold). */
  readonly paysAt: number;
  /** How hard it is to be found here, against 1 for video. 1 for a platform with its own curve. */
  readonly discover: number;
  /**
   * Its own audience curve, [share of channels at least this big, the audience], for a platform
   * measured on its own. Absent: video's curve, scaled by `discover`.
   */
  readonly settle?: readonly (readonly [number, number])[];
  /**
   * How many channels are on its chart, for a platform that has one (spec 236–237: #1000 → #1).
   * Rank 1 is the biggest. Absent: no chart.
   */
  readonly chart?: number;
  /**
   * Ticket 0706. How much better a player's channel does than the average one on this platform,
   * as a lift in rank (see `liftedLuck`). 1 is none; absent is the default. The curves count every
   * channel there is, abandoned or not, so how steep the bottom of each is decides how much of a
   * lift a player needs to feel it.
   */
  readonly lift?: number;
  /** Share of an audience lost the year a sponsorship is taken: viewers notice. */
  readonly trustCost: number;
  /**
   * Ticket 0703. A clip can take off: the chance in a year at regular effort and quality 1, and how
   * many times its audience again the best one adds (the surge then fades like any audience above
   * where it is headed). Absent: nothing here goes viral.
   */
  readonly viral?: { readonly chance: number; readonly surge: number };
  /** The most it can reach, people: a soft ceiling growth fades toward. */
  readonly ceiling: number;
  /** Share of an audience lost in a year to people drifting away, at regular effort. */
  readonly churn: number;
  /** How much of this audience counts toward fame, against 1 for a video subscriber. */
  readonly reach: number;
  /** Categories that suit it, by id. */
  readonly categories: readonly string[];
}

export interface CreatorCategory {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** The two stats that help somebody making this. */
  readonly skills: readonly [BusinessSkill, BusinessSkill];
  /** A talent that gives a head start here, if one does. Boolean (spec 1070). */
  readonly talent?: TalentKey;
  /** What an audience here is worth to advertisers and sponsors, against 1. Money follows how much a viewer is worth to a buyer, not how many there are. */
  readonly pays: number;
  /** How crowded it is, against 1: more makers means less of the audience per maker. */
  readonly crowding: number;
  /** How far its fashions swing, 0 for none: a gaming craze, a cooking trend. */
  readonly swing: number;
  /** Names to call a channel of this kind. */
  readonly names: readonly string[];
}

export const CREATOR_CATEGORIES: readonly CreatorCategory[] = [
  {
    id: 'gaming',
    name: 'Gaming',
    blurb: 'Play-throughs, reviews and live matches.',
    skills: ['charisma', 'willpower'],
    crowding: 1.5,
    pays: 0.8,
    swing: 0.35,
    names: ['Pixel Drift', 'Level Up Lounge', 'The Respawn Room', 'Controller Club'],
  },
  {
    id: 'comedy',
    name: 'Comedy',
    blurb: 'Sketches, bits and being funny on camera.',
    skills: ['charisma', 'happiness'],
    talent: 'acting',
    crowding: 1.3,
    pays: 0.9,
    swing: 0.3,
    names: ['Bad Takes', 'The Bit Bucket', 'Wrong Order', 'Almost Funny'],
  },
  {
    id: 'education',
    name: 'Education',
    blurb: 'Explaining things so they finally make sense.',
    skills: ['smarts', 'discipline'],
    talent: 'academics',
    crowding: 0.8,
    pays: 1.4,
    swing: 0.1,
    names: ['Plain Answers', 'The Long Explanation', 'How It Works', 'Study Hall'],
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    blurb: 'Days, homes, routines and a life people want to look at.',
    skills: ['looks', 'charisma'],
    crowding: 1.4,
    pays: 1.0,
    swing: 0.2,
    names: ['Slow Mornings', 'A Good Day', 'Home Notes', 'Everyday Gold'],
  },
  {
    id: 'fitness',
    name: 'Fitness',
    blurb: 'Training, form and getting better in public.',
    skills: ['health', 'discipline'],
    talent: 'athletics',
    crowding: 1.1,
    pays: 1.1,
    swing: 0.2,
    names: ['Iron Habit', 'Daily Reps', 'The Long Run', 'Stronger Sundays'],
  },
  {
    id: 'cooking',
    name: 'Cooking',
    blurb: 'Recipes, kitchens and eating well on a budget.',
    skills: ['charisma', 'discipline'],
    crowding: 1,
    pays: 0.9,
    swing: 0.15,
    names: ['Weeknight Table', 'Salt and Heat', 'The Back Burner', 'One Pan Wonders'],
  },
  {
    id: 'tech',
    name: 'Tech',
    blurb: 'Gadgets, software and what is worth buying.',
    skills: ['smarts', 'charisma'],
    talent: 'inventive',
    crowding: 1.1,
    pays: 1.5,
    swing: 0.25,
    names: ['Circuit Notes', 'Gadget Ledger', 'The Cable Drawer', 'Bench Test'],
  },
  {
    id: 'music',
    name: 'Music',
    blurb: 'Covers, originals and the making of both.',
    skills: ['charisma', 'discipline'],
    talent: 'music',
    crowding: 1.3,
    pays: 0.7,
    swing: 0.2,
    names: ['Open Mic', 'Second Take', 'The Back Room Sessions', 'Loose Strings'],
  },
  {
    id: 'writing',
    name: 'Writing and stories',
    blurb: 'Essays, fiction, reading and the craft behind them.',
    skills: ['smarts', 'discipline'],
    talent: 'writing',
    crowding: 0.9,
    pays: 0.8,
    swing: 0.1,
    names: ['Margin Notes', 'The Slow Page', 'Chapter and Verse', 'Draft Nine'],
  },
  {
    id: 'fashion',
    name: 'Fashion and beauty',
    blurb: 'Looks, hauls, tutorials and taste.',
    skills: ['looks', 'charisma'],
    crowding: 1.5,
    pays: 1.1,
    swing: 0.3,
    names: ['Thread Count', 'The Fitting Room', 'Good Light', 'Second Hand Chic'],
  },
  {
    id: 'travel',
    name: 'Travel',
    blurb: 'Places, trips and what it costs to go.',
    skills: ['charisma', 'health'],
    crowding: 1.1,
    pays: 1.0,
    swing: 0.2,
    names: ['One Way Ticket', 'Gate Change', 'Off the Itinerary', 'Carry On'],
  },
  {
    id: 'commentary',
    name: 'News and commentary',
    blurb: 'What happened, what it means, and what you think.',
    skills: ['smarts', 'charisma'],
    crowding: 1.2,
    pays: 0.9,
    swing: 0.4,
    names: ['The Hot Take Desk', 'Context Please', 'Fine Print', 'Both Sides of It'],
  },
  {
    id: 'business',
    name: 'Business and money',
    blurb: 'Starting, saving, investing and getting ahead.',
    skills: ['smarts', 'willpower'],
    crowding: 1,
    pays: 1.8,
    swing: 0.2,
    names: ['Side Hustle Ledger', 'The Money Table', 'Net Worth Notes', 'First Ten Thousand'],
  },
  {
    id: 'sports',
    name: 'Sports',
    blurb: 'Games, takes, highlights and the people in them.',
    skills: ['charisma', 'health'],
    talent: 'athletics',
    crowding: 1.2,
    pays: 0.9,
    swing: 0.25,
    names: ['Full Time Talk', 'The Bench Report', 'Fourth Quarter', 'Home Field'],
  },
  {
    id: 'truecrime',
    name: 'True crime and mysteries',
    blurb: 'Cases, theories and things nobody has explained.',
    skills: ['smarts', 'charisma'],
    crowding: 1.3,
    pays: 1.0,
    swing: 0.3,
    names: ['Cold Open', 'The Long Case File', 'Unsolved Tuesdays', 'Missing Pieces'],
  },
];

// P3: approved player rank lifts; source curves and the top-quarter fade stay unchanged.
const BASE_PLATFORMS: readonly Platform[] = [
  {
    id: 'video',
    lift: 3,
    name: 'YouTube',
    audienceWord: 'subscribers',
    audienceOne: 'subscriber',
    blurb: 'Long videos on a channel. Ads pay once a channel is big enough.',
    monetization: 'ads',
    minAge: 14,
    startCost: 0,
    equipmentCost: 600,
    paysAt: 1_000,
    discover: 1,
    // About 4 million channels are tracked: the 1,000th of them has about 5.6 million subscribers.
    chart: 4_000_000,
    trustCost: 0.015,
    ceiling: 400_000_000,
    churn: 0.1,
    reach: 1,
    categories: [
      'gaming',
      'comedy',
      'education',
      'lifestyle',
      'fitness',
      'cooking',
      'tech',
      'music',
      'fashion',
      'travel',
      'commentary',
      'business',
      'sports',
      'truecrime',
    ],
  },
  {
    id: 'stream',
    lift: 5,
    name: 'Twitch',
    audienceWord: 'followers',
    audienceOne: 'follower',
    blurb: 'Live, on a channel of your own. Subscribers, tips and ads.',
    monetization: 'live',
    minAge: 14,
    startCost: 0,
    equipmentCost: 900,
    paysAt: 50,
    discover: 1,
    // Twitch: about 5% of 127,000 active streamers average more than 5 viewers (StreamsCharts, 2022);
    // an average viewer is about 0.6% of followers. By rank: #1,000 averages about 170 viewers, #100
    // about 3,000, the top ten tens of thousands.
    settle: [
      [1, 5],
      [0.2, 60],
      [0.05, 830],
      [0.0079, 28_000],
      [0.00079, 500_000],
      [0.000079, 5_000_000],
      [1 / 127_000, 15_000_000],
    ],
    chart: 127_000,
    trustCost: 0.015,
    ceiling: 60_000_000,
    churn: 0.14,
    reach: 0.8,
    categories: ['gaming', 'comedy', 'music', 'fitness', 'cooking', 'commentary', 'sports'],
  },
  {
    id: 'photo',
    lift: 3,
    name: 'Instagram',
    audienceWord: 'followers',
    audienceOne: 'follower',
    blurb: 'Pictures and short posts. Brands pay for what you show.',
    monetization: 'brands',
    minAge: 14,
    startCost: 0,
    equipmentCost: 300,
    paysAt: 1_000,
    discover: 1.1,
    trustCost: 0.015,
    viral: { chance: 0.04, surge: 1.5 },
    ceiling: 600_000_000,
    churn: 0.12,
    reach: 1,
    categories: ['lifestyle', 'fitness', 'cooking', 'fashion', 'travel', 'music', 'sports'],
  },
  {
    id: 'shortform',
    lift: 3,
    name: 'TikTok',
    audienceWord: 'followers',
    audienceOne: 'follower',
    blurb: 'Clips under a minute. Easy to be seen, hard to be paid.',
    monetization: 'shortAds',
    minAge: 14,
    startCost: 0,
    equipmentCost: 150,
    paysAt: 10_000,
    discover: 1.6,
    trustCost: 0.015,
    viral: { chance: 0.12, surge: 3 },
    ceiling: 800_000_000,
    churn: 0.2,
    reach: 0.7,
    categories: [
      'comedy',
      'education',
      'lifestyle',
      'fitness',
      'cooking',
      'tech',
      'music',
      'fashion',
      'travel',
      'commentary',
      'business',
      'sports',
    ],
  },
  {
    id: 'podcast',
    lift: 5,
    name: 'Amazon Music Podcasts',
    audienceWord: 'listeners',
    audienceOne: 'listener',
    blurb: 'A show people listen to. Sponsors pay by the listen.',
    monetization: 'sponsors',
    minAge: 16,
    startCost: 0,
    equipmentCost: 500,
    paysAt: 500,
    discover: 1,
    // Buzzsprout, July 2026, 112,701 active shows, downloads of an episode in its first seven days:
    // median 27, top 25% 97, top 10% 409, top 5% 1,010, top 1% 4,579. The 1,000th of 110,000 gets
    // about 5,000; the biggest shows several million.
    settle: [
      [1, 3],
      [0.5, 27],
      [0.25, 97],
      [0.1, 409],
      [0.05, 1_010],
      [0.01, 4_579],
      [0.001, 40_000],
      [0.0001, 400_000],
      [1 / 110_000, 2_500_000],
    ],
    chart: 110_000,
    trustCost: 0.005,
    ceiling: 30_000_000,
    churn: 0.07,
    reach: 1.3,
    categories: [
      'comedy',
      'education',
      'fitness',
      'tech',
      'music',
      'writing',
      'commentary',
      'business',
      'sports',
      'truecrime',
    ],
  },
  {
    id: 'subscription',
    lift: 2,
    name: 'Substack',
    audienceWord: 'readers',
    audienceOne: 'reader',
    blurb: 'A newsletter or a members-only page. A few of the free readers pay.',
    monetization: 'members',
    minAge: 16,
    startCost: 0,
    equipmentCost: 100,
    paysAt: 100,
    discover: 0.4,
    trustCost: 0.015,
    ceiling: 20_000_000,
    churn: 0.06,
    reach: 0.4,
    categories: ['education', 'writing', 'commentary', 'business', 'cooking', 'fitness', 'tech'],
  },
];

// These platforms reuse an existing simulation model; they are separate accounts with stable IDs.
const twitch = BASE_PLATFORMS.find((platform) => platform.id === 'stream');
const instagram = BASE_PLATFORMS.find((platform) => platform.id === 'photo');
export const PLATFORMS: readonly Platform[] = [
  ...BASE_PLATFORMS,
  ...(twitch ? [{ ...twitch, id: 'kick' as const, name: 'Kick' }] : []),
  ...(instagram
    ? [
        {
          ...instagram,
          id: 'facebook' as const,
          name: 'Facebook',
          blurb: 'Photos, videos and updates for your community.',
        },
        {
          ...instagram,
          id: 'twitter' as const,
          name: 'X (Twitter)',
          blurb: 'Short updates, threads and conversations.',
        },
      ]
    : []),
];

const PLATFORM_BY_ID = new Map(PLATFORMS.map((platform) => [platform.id as string, platform]));
const CATEGORY_BY_ID = new Map(CREATOR_CATEGORIES.map((category) => [category.id, category]));

export const findPlatform = (id: string): Platform | undefined => PLATFORM_BY_ID.get(id);
export const findCreatorCategory = (id: string): CreatorCategory | undefined =>
  CATEGORY_BY_ID.get(id);
