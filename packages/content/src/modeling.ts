/**
 * Ticket 0807 — modeling.
 *
 * Six rungs, from a test shoot with a local photographer to being the face of a fashion house. A job is a booking:
 * a day rate, a number of days, and a usage fee on top for the right to run the pictures. Where it is the same
 * shape as acting (0805) it uses the same words, and where it isn't (a look has a shelf life) it says so.
 *
 * Anchors that are real: the BLS puts models at about 4,200 jobs, a median wage of $23.30 an hour ($48,470 a year, May
 * 2025), mostly part-time, almost all of them signed to an agency, with no formal education asked and a declining
 * outlook. New York's Fashion Workers Act caps what an agency can take at 20%. Everything else here is a game ladder:
 * the day rates and usage fees per rung, the odds, the hit lines, the age curve and the brand-deal pay are
 * judgements, and the ticket doc says which dials move them.
 *
 * Everything here is data or a pure function of it; `simulation/modeling.ts` decides who is offered what.
 * Every client is made up. American spelling, spoken-style contractions.
 */

export const MODEL_TIERS = [
  'test',
  'catalogue',
  'commercial',
  'editorial',
  'campaign',
  'face',
] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

/** How much of a job the model is: the face of it, a featured spot, or one of the group. */
export const MODEL_PLACEMENTS = ['face', 'featured', 'group'] as const;
export type ModelPlacement = (typeof MODEL_PLACEMENTS)[number];

export const modelTierRank = (tier: ModelTier): number => MODEL_TIERS.indexOf(tier);
export const stepModelTier = (tier: ModelTier, by: number): ModelTier =>
  MODEL_TIERS[Math.max(0, Math.min(MODEL_TIERS.length - 1, modelTierRank(tier) + by))] as ModelTier;

/** The BLS figures this ladder is read against (May 2025). */
export const MODEL_BLS_MEDIAN_HOURLY = 23.3;
export const MODEL_BLS_MEDIAN_YEAR = 48_470;

export interface ModelTierRow {
  readonly id: ModelTier;
  readonly name: string;
  readonly blurb: string;
  /** The youngest age that can be offered work at this rung. */
  readonly minAge: number;
  /** Jobs worked, at least. */
  readonly minCredits: number;
  /** The craft level at least (0–100). */
  readonly minCraft: number;
  /** Modeling reputation at least (0–100). */
  readonly minReputation: number;
  /** The share of jobs at this rung where the model is the face of it, a featured spot, or one of the group. Sums to 1. */
  readonly placement: Readonly<Record<ModelPlacement, number>>;
  /** The day rate when the model is the face of the job, whole dollars, low to high. */
  readonly rate: readonly [number, number];
  /** Days a booking takes, low to high, before the placement. */
  readonly days: readonly [number, number];
  /** The usage fee, as a share of the days' pay. */
  readonly usage: number;
  /** The kinds of work, in the words of "a ...". */
  readonly mediums: readonly string[];
  /** A job at this rung is a hit when the performance reaches this. */
  readonly hitLine: number;
  /** Chance per offer slot a year, before reputation, age and an agency. */
  readonly slots: readonly number[];
  /** Fame held while working at this rung. */
  readonly fame: number;
  /** Reputation a job adds at this rung, before its placement. */
  readonly reputation: number;
  /** People who follow the model after a job here, before the placement. */
  readonly followers: number;
}

export const MODEL_TIER_ROWS: Readonly<Record<ModelTier, ModelTierRow>> = {
  test: {
    id: 'test',
    name: 'Test shoots and local work',
    blurb:
      'Test shoots, hair shows and a local boutique’s lookbook: trade or a few dollars, and pictures.',
    minAge: 14,
    minCredits: 0,
    minCraft: 0,
    minReputation: 0,
    placement: { face: 0.3, featured: 0.4, group: 0.3 },
    rate: [0, 250],
    days: [1, 3],
    usage: 0,
    mediums: ['a test shoot', 'a boutique lookbook', 'a hair show'],
    hitLine: 42,
    slots: [0.5, 0.2],
    fame: 0,
    reputation: 1,
    followers: 40,
  },
  catalogue: {
    id: 'catalogue',
    name: 'Catalogue and e-commerce',
    blurb:
      'Catalogue and online store shoots: long days, steady work, a day rate that is a real one.',
    minAge: 16,
    minCredits: 0,
    minCraft: 28,
    minReputation: 0,
    placement: { face: 0.2, featured: 0.5, group: 0.3 },
    rate: [500, 1_500],
    days: [8, 30],
    usage: 0.1,
    mediums: ['a catalogue shoot', 'an online store shoot', 'a regional catalogue'],
    hitLine: 52,
    slots: [0.75, 0.55, 0.3],
    fame: 2,
    reputation: 2,
    followers: 300,
  },
  commercial: {
    id: 'commercial',
    name: 'Commercial and print',
    blurb:
      'Ads for banks, grocers and car dealers, in print and on screen: a bigger day rate and a usage fee.',
    minAge: 18,
    minCredits: 4,
    minCraft: 40,
    minReputation: 5,
    placement: { face: 0.3, featured: 0.4, group: 0.3 },
    rate: [1_200, 4_000],
    days: [4, 15],
    usage: 0.35,
    mediums: ['a regional ad campaign', 'a print campaign', 'a national commercial'],
    hitLine: 58,
    slots: [0.8, 0.6, 0.35],
    fame: 6,
    reputation: 3,
    followers: 1_500,
  },
  editorial: {
    id: 'editorial',
    name: 'Runway and editorial',
    blurb: 'Fashion week, magazine pages and the designers’ own shows: the work that makes a name.',
    minAge: 18,
    minCredits: 10,
    minCraft: 52,
    minReputation: 15,
    placement: { face: 0.2, featured: 0.5, group: 0.3 },
    rate: [1_500, 8_000],
    days: [3, 10],
    usage: 0.15,
    mediums: ['a magazine editorial', 'a runway show', 'a fashion week season'],
    hitLine: 64,
    slots: [0.8, 0.55, 0.3],
    fame: 15,
    reputation: 4,
    followers: 6_000,
  },
  campaign: {
    id: 'campaign',
    name: 'Campaigns for major brands',
    blurb:
      'Advertising campaigns for the big houses and beauty brands: a day rate in the thousands and a buyout.',
    minAge: 18,
    minCredits: 20,
    minCraft: 72,
    minReputation: 35,
    placement: { face: 0.5, featured: 0.4, group: 0.1 },
    rate: [6_000, 30_000],
    days: [3, 8],
    usage: 0.9,
    mediums: ['an advertising campaign', 'a seasonal campaign', 'a global ad campaign'],
    hitLine: 72,
    slots: [0.7, 0.45, 0.2],
    fame: 38,
    reputation: 5,
    followers: 40_000,
  },
  face: {
    id: 'face',
    name: 'The face of a house',
    blurb:
      'An exclusive contract with a fashion house or a fragrance: a name that sells the product.',
    minAge: 18,
    minCredits: 40,
    minCraft: 86,
    minReputation: 60,
    placement: { face: 0.75, featured: 0.25, group: 0 },
    rate: [30_000, 150_000],
    days: [4, 12],
    usage: 1.5,
    mediums: ['a house campaign', 'a fragrance campaign', 'a global beauty campaign'],
    hitLine: 82,
    slots: [0.6, 0.35, 0.1],
    fame: 65,
    reputation: 6,
    followers: 300_000,
  },
};

/** What a job is worth, against the face of it at the same rung. */
export const MODEL_PLACEMENT_FEE: Readonly<Record<ModelPlacement, number>> = {
  face: 1,
  featured: 0.55,
  group: 0.25,
};

/** Days a job takes, against the face of it. */
export const MODEL_PLACEMENT_DAYS: Readonly<Record<ModelPlacement, number>> = {
  face: 1,
  featured: 0.8,
  group: 0.6,
};

export const MODEL_PLACEMENT_FOLLOWERS: Readonly<Record<ModelPlacement, number>> = {
  face: 1,
  featured: 0.5,
  group: 0.15,
};

/** The words for a placement, in front of "a catalogue shoot". */
export const MODEL_PLACEMENT_PHRASE: Readonly<Record<ModelPlacement, string>> = {
  face: 'the face of',
  featured: 'a featured spot in',
  group: 'a group spot in',
};

/** A year has this many days to give to shoots and shows. Booking past it is refused. */
export const MODEL_YEAR_DAYS = 150;

/** Fictional clients, five to a rung. None is a real brand, magazine or house. */
export const MODEL_CLIENTS: Readonly<Record<ModelTier, readonly string[]>> = {
  test: [
    'Corner Studio',
    'Kestrel Photo',
    'Alder & Vine Boutique',
    'Second Street Salon',
    'Foxglove Portraits',
  ],
  catalogue: [
    'Calloway Outfitters',
    'Pinewood Home Goods',
    'Marlow & Pike',
    'Brightside Basics',
    'Tern Footwear',
  ],
  commercial: [
    'Summit Mutual',
    'Greenfield Grocers',
    'Harbor Wireless',
    'Larkspur Bank',
    'Oakmont Motors',
  ],
  editorial: [
    'Verity Magazine',
    'Atelier Noir',
    'The Weekend Review',
    'Maison Orlane',
    'Studio Vesper',
  ],
  campaign: [
    'Dorrance & Vale',
    'Aurelle Paris',
    'Larkin Denim',
    'Halcyon Beauty',
    'Meridian Watches',
  ],
  face: [
    'House of Everhart',
    'Sorrel & Crane',
    'Maison Cassiel',
    'Argent Noir Parfums',
    'Lysander Couture',
  ],
};

/** A day rate rounded the way a booker quotes one: to $25 under $1,000, $100 under $10,000, $500 under $100,000, then $5,000. */
export const modelRoundRate = (rate: number): number => {
  const step = rate < 1_000 ? 25 : rate < 10_000 ? 100 : rate < 100_000 ? 500 : 5_000;
  return Math.round(rate / step) * step;
};

/** A usage fee rounded to $100 under $10,000, $1,000 under $1,000,000, then $10,000. */
export const modelRoundFee = (fee: number): number => {
  const step = fee < 10_000 ? 100 : fee < 1_000_000 ? 1_000 : 10_000;
  return Math.round(fee / step) * step;
};

/** The day rate for a job, whole dollars, from a draw in [0, 1) and a multiplier for how well the name is known. A rung with a floor of nothing can be unpaid. */
export function modelDayRate(
  tier: ModelTier,
  placement: ModelPlacement,
  unit: number,
  name = 1,
): number {
  const [low, high] = MODEL_TIER_ROWS[tier].rate;
  const base = low === 0 ? high * unit : low * Math.pow(high / low, unit);
  return modelRoundRate(base * MODEL_PLACEMENT_FEE[placement] * name);
}

/** The days a job takes, whole days, from a draw. */
export function modelJobDays(tier: ModelTier, placement: ModelPlacement, unit: number): number {
  const [low, high] = MODEL_TIER_ROWS[tier].days;
  return Math.max(1, Math.round((low + (high - low) * unit) * MODEL_PLACEMENT_DAYS[placement]));
}

/** The usage fee for a day rate and a number of days at a rung, whole dollars. */
export const modelUsageFee = (tier: ModelTier, rate: number, days: number): number =>
  modelRoundFee(rate * days * MODEL_TIER_ROWS[tier].usage);

/** What a job pays in all, before an agency's share: the days at the day rate, and the usage. */
export const modelJobFee = (job: {
  readonly rate: number;
  readonly days: number;
  readonly usage: number;
}): number => job.rate * job.days + job.usage;

/** The placement a draw lands on at a rung. */
export function modelPlacementFor(tier: ModelTier, unit: number): ModelPlacement {
  const row = MODEL_TIER_ROWS[tier].placement;
  let seen = 0;
  for (const placement of MODEL_PLACEMENTS) {
    seen += row[placement];
    if (unit < seen) return placement;
  }
  return 'featured';
}

/* -------------------------------------------------------------------------- */
/* Craft                                                                       */
/* -------------------------------------------------------------------------- */

/** How far work can take craft past what the character is. */
export const MODEL_CRAFT_HEADROOM = 10;

/** What a job adds to craft, up to a cap: a model learns the camera by being in front of it. */
export const MODEL_CREDIT_CRAFT = 0.3;
export const MODEL_CREDIT_CRAFT_CAP = 6;

/**
 * What the character is like as a model, 0–100. Looks and charisma, then discipline and smarts. No talent is
 * involved: nothing in character creation says who can model (Payton's call). Health and stress are not inputs.
 */
export function naturalModelCraft(stats: {
  readonly charisma: number;
  readonly looks: number;
  readonly smarts: number;
  readonly discipline: number;
}): number {
  const base =
    0.5 * stats.looks + 0.3 * stats.charisma + 0.15 * stats.discipline + 0.05 * stats.smarts;
  // Measured at 40 lives (0807): looks sit lower than the other stats (median 57, p10 39, p90 70 for a grown character,
  // against charisma 78 and smarts 81), so the weighted number centres on 66.5 here and not the 72 acting's does. Spread
  // so a median character comes out near 50, a tenth under 30 and a tenth over 68.
  return Math.max(0, Math.min(100, Math.round(50 + (base - 66.5) * 2.4)));
}

/* -------------------------------------------------------------------------- */
/* Getting the work                                                            */
/* -------------------------------------------------------------------------- */

/** A portfolio: pictures to send around. From this age; an adult on their own pays for it. Judgement ($500–$2,500). */
export const MODEL_PORTFOLIO_MIN_AGE = 14;
export const MODEL_PORTFOLIO_COST = 900;
export const MODEL_PORTFOLIO_COST_SOURCE = 'portfolio photos';

/** Years after the last time a model was seen (a portfolio, a job) that bookers still remember them. */
export const MODEL_SEEN_YEARS = 3;

/** An offer's rung: one below, at, or one above the standing. Without and with an agency. */
export const MODEL_OFFER_TIER_WEIGHTS: Readonly<
  Record<'plain' | 'agency', readonly [number, number, number]>
> = {
  plain: [0.2, 0.7, 0.1],
  agency: [0.15, 0.55, 0.3],
};

/** Offers a year: how much a good name multiplies the slots. */
export const MODEL_REPUTATION_OFFER_RANGE: readonly [number, number] = [0.6, 1.2];

/** Open castings (go-sees), and how many a person can answer in a year. */
export const MODEL_CASTINGS = 6;
export const MODEL_APPLICATIONS_PER_YEAR = 3;
export const MODEL_AGENCY_SUBMISSIONS = 2;

/** The odds of an application landing a job: one rung below, at, and above the standing. */
export const MODEL_APPLY_BASE: Readonly<Record<'below' | 'at' | 'above', number>> = {
  below: 0.8,
  at: 0.55,
  above: 0.28,
};
export const MODEL_APPLY_CRAFT_WEIGHT = 0.5;
export const MODEL_APPLY_AGENCY_BONUS = 0.12;
export const MODEL_APPLY_REPUTATION_WEIGHT = 0.2;
export const MODEL_APPLY_PLACEMENT: Readonly<Record<ModelPlacement, number>> = {
  face: -0.12,
  featured: 0,
  group: 0.12,
};

/** An agency: 20% of everything, the most New York allows. It is a help and never the way in; it wants a couple of jobs behind you. */
export const MODEL_AGENCY_MIN_CREDITS = 2;
export const MODEL_AGENCY_CUT = 0.2;
export const MODEL_AGENCY_SLOT_CHANCE = 0.4;
export const MODEL_AGENCY_OFFER_MULTIPLIER = 1.2;
export const MODEL_AGENCY_ASK_BONUS = 0.15;

/** Asking for more: the chance, and how much a win adds. Only a booking that pays this much can be bargained over. */
export const MODEL_NEGOTIABLE_FROM = 2_000;
export const MODEL_ASK_BASE = 0.5;
export const MODEL_ASK_REPUTATION_WEIGHT = 0.25;
export const MODEL_ASK_GAIN: readonly [number, number] = [1.1, 1.25];

/* -------------------------------------------------------------------------- */
/* A year of work                                                              */
/* -------------------------------------------------------------------------- */

export const MODEL_PERFORMANCE_NOISE = 30;
export const MODEL_FLOP_MARGIN = 25;
/** Hits at a rung that carry a model to the next; a hit on a job a rung above carries them at once. */
export const MODEL_HITS_TO_RISE: Readonly<Record<ModelTier, number>> = {
  test: 2,
  catalogue: 2,
  commercial: 3,
  editorial: 3,
  campaign: 4,
  face: 99,
};
/** Years with no job after which a model slides down a rung. */
export const MODEL_IDLE_FALL_YEARS = 3;

export const MODEL_HIT_REPUTATION = 3;
export const MODEL_FLOP_REPUTATION = 3;
export const MODEL_IDLE_REPUTATION = 2;
export const MODEL_PLACEMENT_REPUTATION: Readonly<Record<ModelPlacement, number>> = {
  face: 1,
  featured: 0.6,
  group: 0.3,
};

/** Modeling is the living now when a year paid this much, lately. A judgement under the BLS median. */
export const MODEL_LIVING_WAGE = 30_000;

/* ---- the age window ------------------------------------------------------- */

/** The phone rings less each year after this age, never below a third of what it was. */
export const MODEL_AGE_PEAK_END = 26;
export const MODEL_AGE_RATE = 0.06;
export const MODEL_AGE_FLOOR = 0.3;
/** After this age nobody is offered a job a rung above where they are. */
export const MODEL_RISE_WINDOW_END = 30;

/** How much the work comes in at an age, 0.3–1. */
export const modelAgeScale = (age: number): number =>
  Math.max(MODEL_AGE_FLOOR, 1 - Math.max(0, age - MODEL_AGE_PEAK_END) * MODEL_AGE_RATE);

/* ---- followers -------------------------------------------------------------- */

/** A model's following lets go of this share of itself each year; every job brings new people. */
export const MODEL_FOLLOWER_CHURN = 0.08;
/** A hit brings this much more than a job that came and went. */
export const MODEL_HIT_FOLLOWERS = 1.25;
/** The share of the people a model's work brings who find a fashion or lifestyle channel the character runs. */
export const MODEL_CHANNEL_SHARE = 0.25;
export const MODEL_CHANNEL_CATEGORIES: readonly string[] = ['fashion', 'lifestyle'];

/** The pseudo-channel the 0702 sponsor rules read: a photo feed about fashion. */
export const MODEL_BRAND_PLATFORM = 'photo';
export const MODEL_BRAND_CATEGORY = 'fashion';

/* ---- the network ------------------------------------------------------------ */

/** Jobs worked before the people a model meets include actors and artists: a backstage is a network. */
export const MODEL_NETWORK_CREDITS = 6;

/* -------------------------------------------------------------------------- */
/* Awards                                                                      */
/* -------------------------------------------------------------------------- */

/** Fictional ceremony. No real award's name appears. */
export const MODEL_AWARD_CEREMONY = 'the Atelier Awards';
export const MODEL_AWARD_LINE = 82;
export const MODEL_AWARD_CHANCE: Readonly<Record<ModelTier, number>> = {
  test: 0,
  catalogue: 0,
  commercial: 0,
  editorial: 0.06,
  campaign: 0.1,
  face: 0.14,
};
export const MODEL_AWARD_REPUTATION = 8;
export const MODEL_AWARD_MOOD = 6;
export const MODEL_AWARD_NAMES: Readonly<Record<ModelPlacement, string>> = {
  face: 'Model of the Year',
  featured: 'Best Runway Presence',
  group: 'Breakout Model of the Year',
};

/* -------------------------------------------------------------------------- */
/* Fame                                                                        */
/* -------------------------------------------------------------------------- */

/** Fame a modeling career holds a model at while the work is coming, 0–100. */
export function modelFameOf(input: {
  readonly tier: ModelTier;
  readonly reputation: number;
  readonly awards: number;
  readonly idle: number;
}): number {
  if (input.idle >= MODEL_IDLE_FALL_YEARS) return 0;
  const row = MODEL_TIER_ROWS[input.tier];
  if (row.fame === 0) return 0;
  const held = row.fame + Math.round(input.reputation / 10) + Math.min(12, input.awards * 3);
  return input.idle > 0 ? Math.round(held / 2) : held;
}

/** A rung's rise, in words for the timeline. */
export const MODEL_RISE_LINES: Readonly<Record<ModelTier, string>> = {
  test: 'Back to test shoots and local work.',
  catalogue: 'Catalogue work is coming in. It pays a real day rate.',
  commercial: 'Commercial and print jobs. The bookers know your face.',
  editorial: 'Runway and editorial. Designers are asking for you by name.',
  campaign: 'Campaigns for the big brands. Your face is on a billboard.',
  face: 'A house wants you as its face. Your name sells the product.',
};

/** Words for a modeling reputation. */
export function modelReputationWord(reputation: number): string {
  if (reputation >= 80) return 'Iconic';
  if (reputation >= 60) return 'Respected';
  if (reputation >= 40) return 'Established';
  if (reputation >= 20) return 'Known to bookers';
  if (reputation >= 5) return 'Getting noticed';
  return 'Unknown';
}
