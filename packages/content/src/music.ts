/**
 * Ticket 0806 — music.
 *
 * A musician's career is releases and the people who hear them (Payton's call). Each year the artist chooses what to
 * put out (singles, EPs and LPs, under the spec's yearly caps of 15, 3 and 2), what they sound like depends on their
 * craft, and the people who listen to them are the career's one number: monthly listeners. Everything else follows from it:
 * the rung (local act up to superstar), what a stream pays, what a tour draws, whether a label calls, and the fame.
 * Back catalogue is real here: it keeps people listening after the artist stops, which is why an old artist still
 * earns.
 *
 * Anchors that are real: a stream pays rights holders about $0.003–$0.005 (about $2.38 per thousand, 2025), and a
 * distributor takes about 15%. A label deal pays an advance and then the artist a royalty of about 15–25% of
 * what is earned, but only once the advance and the label's costs are paid back. Indie labels split more evenly.
 * The UK IPO's 2021 study found about 0.4% of musicians could live on streaming alone, at about a million monthly
 * streams, and 65–75% of top earners' streams came from back catalogue. BLS counts about 170,400 musicians and singers
 * (2025 median $47.80 an hour, 48% self-employed, work irregular). A touring act on a Tuesday night in a small
 * market nets almost nothing after the venue, agent, manager and crew (David Lowery's 2016 figures: $12 of a $20
 * ticket, less 35% to agent, manager and tax). Everything else here — the listener ladder, the sizes of venues,
 * the advances by rung, the odds — is a game ladder, and the ticket doc names the dials.
 *
 * American spelling, spoken-style contractions. Everything here is data or a pure function of it; the rules
 * of a year are in `simulation/music.ts`.
 */

export const MUSIC_TIERS = [
  'local',
  'club',
  'regional',
  'national',
  'headliner',
  'superstar',
] as const;
export type MusicTier = (typeof MUSIC_TIERS)[number];

export const RELEASE_KINDS = ['single', 'ep', 'lp'] as const;
export type ReleaseKind = (typeof RELEASE_KINDS)[number];

export interface MusicTierRow {
  readonly id: MusicTier;
  readonly name: string;
  /** The monthly listeners that put an artist at this rung. */
  readonly listeners: number;
  /** Where they play. */
  readonly venue: string;
  readonly capacity: number;
  /** The most shows a tour at this rung runs. */
  readonly shows: number;
  /** The face value of a ticket, whole dollars. */
  readonly ticket: number;
  /** The artist's share of the door after the venue, 0–1. */
  readonly doorShare: number;
  /** What a night costs on the road (crew, vans, rooms), whole dollars. */
  readonly nightCost: number;
  /** The share of an artist's listeners who buy a ticket on one tour. */
  readonly draw: number;
  /** Fame this rung holds an artist at while there is work. */
  readonly fame: number;
  /** The chance a year brings a label's call at this rung. */
  readonly labelChance: number;
  /** Of those, the share that is a major label rather than an indie. */
  readonly majorShare: number;
  /** The chance a year's best release wins at the awards from this rung. */
  readonly awardChance: number;
  /** What this rung adds to a name per hit, before the kind. */
  readonly reputation: number;
}

export const MUSIC_TIER_ROWS: Readonly<Record<MusicTier, MusicTierRow>> = {
  local: {
    id: 'local',
    name: 'Local act',
    listeners: 0,
    venue: 'bars and coffeehouses',
    capacity: 100,
    shows: 8,
    ticket: 10,
    doorShare: 0.5,
    nightCost: 250,
    draw: 0.3,
    fame: 0,
    labelChance: 0,
    majorShare: 0,
    awardChance: 0,
    reputation: 1,
  },
  club: {
    id: 'club',
    name: 'Club circuit',
    listeners: 2_000,
    venue: 'clubs',
    capacity: 300,
    shows: 20,
    ticket: 18,
    doorShare: 0.6,
    nightCost: 1_000,
    draw: 0.1,
    fame: 2,
    labelChance: 0.12,
    majorShare: 0,
    awardChance: 0,
    reputation: 2,
  },
  regional: {
    id: 'regional',
    name: 'Regional act',
    listeners: 25_000,
    venue: 'theaters',
    capacity: 1_200,
    shows: 24,
    ticket: 35,
    doorShare: 0.7,
    nightCost: 8_000,
    draw: 0.04,
    fame: 8,
    labelChance: 0.18,
    majorShare: 0.3,
    awardChance: 0,
    reputation: 3,
  },
  national: {
    id: 'national',
    name: 'National act',
    listeners: 300_000,
    venue: 'large theaters',
    capacity: 3_000,
    shows: 28,
    ticket: 55,
    doorShare: 0.8,
    nightCost: 45_000,
    draw: 0.015,
    fame: 22,
    labelChance: 0.22,
    majorShare: 0.55,
    awardChance: 0.1,
    reputation: 4,
  },
  headliner: {
    id: 'headliner',
    name: 'Arena headliner',
    listeners: 3_000_000,
    venue: 'arenas',
    capacity: 15_000,
    shows: 40,
    ticket: 80,
    doorShare: 0.85,
    nightCost: 250_000,
    draw: 0.01,
    fame: 48,
    labelChance: 0.25,
    majorShare: 0.8,
    awardChance: 0.16,
    reputation: 5,
  },
  superstar: {
    id: 'superstar',
    name: 'Superstar',
    listeners: 25_000_000,
    venue: 'stadiums',
    capacity: 50_000,
    shows: 60,
    ticket: 140,
    doorShare: 0.9,
    nightCost: 1_500_000,
    draw: 0.006,
    fame: 78,
    labelChance: 0.25,
    majorShare: 0.9,
    awardChance: 0.22,
    reputation: 6,
  },
};

export const tierRankOf = (tier: MusicTier): number => MUSIC_TIERS.indexOf(tier);

/** The rung a number of monthly listeners puts an artist at. */
export function tierFor(listeners: number): MusicTier {
  let found: MusicTier = 'local';
  for (const id of MUSIC_TIERS) {
    if (listeners >= MUSIC_TIER_ROWS[id].listeners) found = id;
  }
  return found;
}

export const stepMusicTier = (tier: MusicTier, delta: number): MusicTier =>
  MUSIC_TIERS[Math.max(0, Math.min(MUSIC_TIERS.length - 1, tierRankOf(tier) + delta))]!;

/* -------------------------------------------------------------------------- */
/* Releases                                                                    */
/* -------------------------------------------------------------------------- */

/** The most of each a year can hold (spec 979–1030, 1396): 2 LPs, 3 EPs and 15 singles. */
export const RELEASE_CAPS: Readonly<Record<ReleaseKind, number>> = { single: 15, ep: 3, lp: 2 };

/** Weeks of the year a release takes, and the year has 52 for releases and tours together. */
export const RELEASE_WEEKS: Readonly<Record<ReleaseKind, number>> = { single: 2, ep: 6, lp: 14 };
export const YEAR_WEEKS = 52;

/** What a self-release costs in recording and mastering, whole dollars. A label's costs are its own, and repaid. */
export const DIY_COST: Readonly<Record<ReleaseKind, number>> = {
  single: 300,
  ep: 2_500,
  lp: 9_000,
};

/** What a label spends to make and market a release, whole dollars; it is repaid out of the artist's royalties. */
export const LABEL_COST: Readonly<
  Record<'indie' | 'major', Readonly<Record<ReleaseKind, number>>>
> = {
  indie: { single: 3_000, ep: 10_000, lp: 40_000 },
  major: { single: 25_000, ep: 70_000, lp: 250_000 },
};

export const MUSIC_RELEASE_MIN_AGE = 12;

export const KIND_NOUN: Readonly<Record<ReleaseKind, string>> = {
  single: 'a single',
  ep: 'an EP',
  lp: 'an album',
};

/** How a kind of release is named when it is a lone word: "the single", "the EP", "the album". */
export const KIND_NAME: Readonly<Record<ReleaseKind, string>> = {
  single: 'single',
  ep: 'EP',
  lp: 'album',
};

/** How much discovery and growth a release brings, by kind. */
export const DISCOVER: Readonly<Record<ReleaseKind, number>> = { single: 120, ep: 350, lp: 900 };
export const GROW: Readonly<Record<ReleaseKind, number>> = { single: 0.04, ep: 0.08, lp: 0.15 };

/** Each release in a year after the first is heard by fewer people: a year's output shares one audience. */
export const SATURATION = 0.85;

/** The noise in how a release comes out, in points of quality. */
export const QUALITY_NOISE = 24;

/** What a release is judged by: below this nothing happens, at 65 it's a normal release, near 100 it travels. */
export const QUALITY_FLOOR = 35;
export const QUALITY_SPAN = 30;
export const QUALITY_MAX_FACTOR = 3;

/** What quality a release has to reach, at the artist's rung, to count as a hit. */
export const HIT_LINE: Readonly<Record<MusicTier, number>> = {
  local: 58,
  club: 62,
  regional: 68,
  national: 74,
  headliner: 80,
  superstar: 86,
};

/** A release that is a flop at the rung: this far under the hit line. */
export const MUSIC_FLOP_MARGIN = 25;

/** The chance a release goes viral, and how many times as many people it reaches when it does. */
export const VIRAL_BASE = 0.015;
export const VIRAL_PER_POINT = 0.0012;
export const VIRAL_FROM = 70;
export const VIRAL_MULTIPLIER = 8;

/** How much of the quality of the whole back catalogue it takes for listeners to stay: points of retention. */
export const RETAIN_BASE = 0.86;
export const RETAIN_CATALOGUE = 0.1;
export const CATALOGUE_FULL = 30;
/** What a release adds to the back catalogue, times its quality factor. */
export const CATALOGUE_WEIGHT: Readonly<Record<ReleaseKind, number>> = { single: 1, ep: 3, lp: 6 };

/**
 * How many people a body of work can hold, a game judgement: 10^(3.3 + 0.05 per point of quality over 50), so
 * ordinary work holds a few thousand, very good work a few hundred thousand, and only the best a few million. Luck
 * (a fixed draw for the life) multiplies it by anything from half to a couple of hundred, because the business
 * is winner-take-all: the same record is a hit for one artist and a footnote for another. A viral release
 * breaks the ceiling for the year. Nobody holds more than the cap (the biggest artists on Spotify have about 110
 * million monthly listeners).
 */
export const AUDIENCE_BASE_LOG = 3.3;
export const AUDIENCE_PER_POINT = 0.05;
export const LUCK_SPREAD = 2.6;
export const LUCK_SHIFT = -0.3;
export const VIRAL_CEILING = 5;
/** Above the ceiling, this share of the excess goes each year. */
export const OVERSHOOT_FALL = 0.25;
export const LISTENER_CAP = 120_000_000;

export function audienceCeiling(quality: number, luck: number, reachMultiplier = 1): number {
  const luckFactor = 10 ** (LUCK_SPREAD * luck ** 3 + LUCK_SHIFT);
  return Math.min(
    LISTENER_CAP,
    10 ** (AUDIENCE_BASE_LOG + AUDIENCE_PER_POINT * (quality - 50)) * luckFactor * reachMultiplier,
  );
}

/** An idle artist's listeners fall by this much more each year they put nothing out. */
export const IDLE_DECAY = 0.07;

/** Monthly listeners stream about this many times a year in all: three a month. */
export const STREAMS_PER_LISTENER = 36;
/** What a stream pays rights holders, whole dollars (about $4 per thousand, upper-middle of $3–$5). */
export const STREAM_PAYOUT = 0.004;
/** A distributor's cut of a self-release's royalties. */
export const DISTRIBUTOR_CUT = 0.15;

/** A label adds reach (more discovery, a little more growth) and, for a major, polish. */
export const LABEL_REACH: Readonly<
  Record<
    'indie' | 'major',
    { readonly discover: number; readonly grow: number; readonly polish: number }
  >
> = {
  indie: { discover: 1.6, grow: 1.15, polish: 3 },
  major: { discover: 3.2, grow: 1.4, polish: 6 },
};

/* -------------------------------------------------------------------------- */
/* Craft                                                                       */
/* -------------------------------------------------------------------------- */

export const MUSIC_TALENT_CRAFT = 12;
export const MUSIC_HEADROOM = 10;
export const MUSIC_LESSONS_CRAFT = 4;
export const MUSIC_LESSONS_COST = 2_000;
export const MUSIC_LESSONS_MIN_AGE = 7;
export const MUSIC_RELEASE_CRAFT = 0.1;
export const MUSIC_RELEASE_CRAFT_CAP = 6;
export const MUSIC_STAGE_CRAFT = 3;
export const MUSIC_LESSONS_SOURCE = 'music lessons';

/**
 * What a character is like as a musician: the four stats that make one (discipline, charisma, smarts, looks) against
 * what grown characters measure (about 56–85, so 72 is the middle, CORE_RULES 13.150), plus a talent's head start.
 */
export function musicCraft(
  stats: {
    readonly charisma: number;
    readonly discipline: number;
    readonly smarts: number;
    readonly looks: number;
  },
  talent: boolean,
): number {
  const weighted =
    0.3 * stats.discipline + 0.3 * stats.charisma + 0.25 * stats.smarts + 0.15 * stats.looks;
  return Math.max(
    0,
    Math.min(100, Math.round(50 + (weighted - 72) * 2.2 + (talent ? MUSIC_TALENT_CRAFT : 0))),
  );
}

/** The share of quality points that count as a factor on audience: 0 at the floor, 1 at a normal release. */
export const qualityFactor = (quality: number): number =>
  Math.max(0, Math.min(QUALITY_MAX_FACTOR, (quality - QUALITY_FLOOR) / QUALITY_SPAN));

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

export type LabelKind = 'indie' | 'major';

export interface LabelRow {
  readonly kind: LabelKind;
  readonly label: string;
  /** Years the deal runs. */
  readonly term: number;
  /** The artist's royalty on streams, once the advance and the label's costs are repaid, 0–1. */
  readonly royalty: number;
  /** Releases a label puts out each year whether or not the artist plans any. */
  readonly commit: Readonly<Record<ReleaseKind, number>>;
  /** The advance range, whole dollars, by the rung the artist is at when it is offered. */
  readonly advance: Readonly<Partial<Record<MusicTier, readonly [number, number]>>>;
}

export const LABEL_ROWS: Readonly<Record<LabelKind, LabelRow>> = {
  indie: {
    kind: 'indie',
    label: 'an independent label',
    term: 2,
    royalty: 0.4,
    commit: { single: 2, ep: 1, lp: 0 },
    advance: {
      club: [3_000, 15_000],
      regional: [10_000, 45_000],
      national: [30_000, 120_000],
      headliner: [80_000, 300_000],
      superstar: [150_000, 500_000],
    },
  },
  major: {
    kind: 'major',
    label: 'a major label',
    term: 3,
    royalty: 0.18,
    commit: { single: 3, ep: 0, lp: 1 },
    advance: {
      regional: [30_000, 120_000],
      national: [120_000, 600_000],
      headliner: [600_000, 2_000_000],
      superstar: [2_000_000, 8_000_000],
    },
  },
};

/** The names a label goes by. All fictional. */
export const LABEL_NAMES: Readonly<Record<LabelKind, readonly string[]>> = {
  indie: [
    'Porchlight Records',
    'Gravel & Honey',
    'Tin Roof Sounds',
    'Slow Orchard',
    'Paper Moon Recordings',
    'Cold Harbor Music',
  ],
  major: [
    'Meridian Music Group',
    'Crestline Records',
    'Northbridge Entertainment',
    'Halcyon Sound',
    'Ardent Row Records',
  ],
};

/** Asking for more: the chance a name and a representative help, and what a win is worth. */
export const MUSIC_ASK_BASE = 0.45;
export const MUSIC_ASK_REPUTATION_WEIGHT = 0.25;
export const MUSIC_ASK_REPRESENTED_BONUS = 0.1;
export const MUSIC_ASK_ADVANCE_GAIN: readonly [number, number] = [1.15, 1.4];
export const MUSIC_ASK_ROYALTY_GAIN = 0.03;
/** The most a royalty can be bargained up to, by kind of label. */
export const MUSIC_ROYALTY_CAP: Readonly<Record<'indie' | 'major', number>> = {
  indie: 0.5,
  major: 0.25,
};
/** Offers are only for artists whose work is good enough to be signed: craft or quality at or above this. */
export const LABEL_MIN_CRAFT = 45;

/** Demos: the odds (one a year, which the rules enforce). */
export const DEMO_BASE = 0.12;
export const DEMO_CRAFT_WEIGHT = 0.5;
export const DEMO_REPUTATION_WEIGHT = 0.2;
export const DEMO_CHANCE_RANGE: readonly [number, number] = [0.03, 0.6];

/* -------------------------------------------------------------------------- */
/* Reputation, awards, fame                                                    */
/* -------------------------------------------------------------------------- */

/** A year's music that pays this much, after everyone's share, is a living (BLS: median pay about $99,000 at $47.80 an hour full-time; most work part of the year). */
export const MUSIC_LIVING_WAGE = 30_000;

/** The share of the people who find the records that finds the Music channel too, when there is one. */
export const MUSIC_CHANNEL_SHARE = 0.25;

export const MUSIC_HIT_REPUTATION = 3;
export const MUSIC_FLOP_REPUTATION = 3;
export const MUSIC_IDLE_REPUTATION = 2;
export const MUSIC_IDLE_FALL_YEARS = 3;

/** The ceremony. Fictional. */
export const MUSIC_AWARD_CEREMONY = 'the Silverline Music Awards';
export const MUSIC_AWARD_LINE = 82;
export const MUSIC_AWARD_REPUTATION = 8;
export const MUSIC_AWARD_MOOD = 6;
export const MUSIC_AWARD_NAMES: Readonly<Record<ReleaseKind, string>> = {
  single: 'Song of the Year',
  ep: 'Best EP',
  lp: 'Album of the Year',
};

/** Fame an artist is held at while there is work; halved after a year with none, gone at three. */
export function musicFameOf(input: {
  readonly tier: MusicTier;
  readonly reputation: number;
  readonly awards: number;
  readonly idle: number;
}): number {
  if (input.idle >= MUSIC_IDLE_FALL_YEARS) return 0;
  const row = MUSIC_TIER_ROWS[input.tier];
  if (row.fame === 0) return 0;
  const held = row.fame + Math.round(input.reputation / 10) + Math.min(12, input.awards * 3);
  // The top rung at its best (78 + 10 + 12) is exactly 100, so nothing needs a cap.
  return input.idle > 0 ? Math.round(held / 2) : held;
}

export const musicReputationWord = (reputation: number): string => {
  if (reputation >= 80) return 'Legendary';
  if (reputation >= 60) return 'Respected';
  if (reputation >= 40) return 'Established';
  if (reputation >= 20) return 'Known on the scene';
  if (reputation >= 8) return 'Getting noticed';
  return 'Unknown';
};

/** The words for the rung an artist has just reached. */
export const MUSIC_RISE_LINES: Readonly<Record<MusicTier, string>> = {
  local: 'Back to bars, school stages and the garage.',
  club: 'The clubs know your name. People come on a Friday for you.',
  regional: 'You sell out theaters in your part of the country.',
  national: 'You’re a national act. People sing it back at you.',
  headliner: 'You headline arenas. Your name is on the poster by itself.',
  superstar: 'Stadiums. You’re one of the few people everybody has heard of.',
};

/* -------------------------------------------------------------------------- */
/* Tours                                                                       */
/* -------------------------------------------------------------------------- */

/** Shows a week, and the fewest shows a tour will run (anything smaller isn't a tour). */
export const SHOWS_PER_WEEK = 3;
export const MIN_SHOWS = 4;
/** How full the biggest rooms get before another night is booked. */
export const TOUR_FILL = 0.7;
/** A tour brings in fans: this share of the tickets sold becomes monthly listeners. */
export const TOUR_FANS = 0.1;
export const MIN_TOUR_LISTENERS = 300;
export const MUSIC_TOUR_MIN_AGE = 16;

export interface TourPlan {
  readonly tickets: number;
  readonly shows: number;
  readonly weeks: number;
  readonly door: number;
  readonly costs: number;
}

/** What a tour would do for an artist with this many listeners, at this rung. */
export function tourFor(tier: MusicTier, listeners: number, quality: number): TourPlan {
  const row = MUSIC_TIER_ROWS[tier];
  // A good record fills rooms and a poor one doesn't, a little either way.
  const factor = 0.75 + 0.5 * Math.max(0, Math.min(1, (quality - 40) / 50));
  const wanted = Math.round(listeners * row.draw * factor);
  const shows = Math.max(
    MIN_SHOWS,
    Math.min(row.shows, Math.ceil(wanted / (row.capacity * TOUR_FILL))),
  );
  const tickets = Math.min(wanted, shows * row.capacity);
  return {
    tickets,
    shows,
    // Four shows at three a week is two weeks, so the least a tour takes is two.
    weeks: Math.ceil(shows / SHOWS_PER_WEEK),
    door: Math.round(tickets * row.ticket * row.doorShare),
    costs: shows * row.nightCost,
  };
}

/* -------------------------------------------------------------------------- */
/* Titles                                                                      */
/* -------------------------------------------------------------------------- */

/** Fictional titles for releases; none is a real song or album. */
export const RELEASE_TITLES: readonly string[] = [
  'Low Tide Radio',
  'Seven Windows',
  'Salt Lines',
  'Parking Lot Hymns',
  'Quiet Machines',
  'The Long Way Round',
  'Borrowed Light',
  'Cedar and Static',
  'Half a Year in July',
  'Small Hours',
  'Paper Lanterns',
  'Mile Marker',
  'What the River Kept',
  'Glass Season',
  'Back Porch Weather',
  'Midnight Bus',
  'A Room With No Clocks',
  'Rust Belt Heart',
  'Slow Fire',
  'Open Road Hymn',
  'Fever Dream Motel',
  'Soft Landing',
  'Kitchen Light',
  'The Weight of Water',
  'Neon Orchard',
  'Wishing Well Blues',
  'Thirty Below',
  'Echo Park Sunday',
  'All the Doors Were Open',
  'Harvest Moon Alley',
  'Telephone Wire',
  'Good Ghosts',
  'Hold Fast',
  'Sundown Parade',
  'Cheap Wine and Cheaper Cigars',
  'Orbit',
  'Brick and Ivy',
  'When the Lights Come Up',
  'Dust Bowl Disco',
  'Summer Static',
];
