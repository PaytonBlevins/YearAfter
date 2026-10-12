/**
 * Ticket 0805 — acting.
 *
 * Six rungs, not the spec's eleven (Payton's call): the spec's student films, small and large commercials,
 * background and small TV, bit film, supporting TV and film, lead TV and film, prestige and blockbuster roles
 * fold into the six below. What a role IS (lead, supporting or bit) is separate from how big the work is, so a
 * lead in a student film and a bit part in a blockbuster are both things this table can say.
 *
 * Anchors that are real: SAG-AFTRA's 2026–27 day-performer minimum ($1,283) and weekly minimum ($4,456), already
 * used by 0707, and the BLS figures for actors (about 67,500 jobs, a median wage of $29.05 an hour in 2025, part-time
 * work common, nearly a quarter self-employed). Everything above those floors is a game ladder: the fee ranges per
 * rung, the odds, the hit lines and the awards are judgements, and the ticket doc says which dials move them.
 *
 * Everything here is data or a pure function of it; `simulation/acting.ts` decides who is offered what.
 * American spelling, spoken-style contractions.
 */

export const ACTING_TIERS = [
  'local',
  'commercial',
  'working',
  'supporting',
  'lead',
  'star',
] as const;
export type ActingTier = (typeof ACTING_TIERS)[number];

export const BILLINGS = ['lead', 'supporting', 'bit'] as const;
export type Billing = (typeof BILLINGS)[number];

export const tierRank = (tier: ActingTier): number => ACTING_TIERS.indexOf(tier);
export const stepActingTier = (tier: ActingTier, by: number): ActingTier =>
  ACTING_TIERS[Math.max(0, Math.min(ACTING_TIERS.length - 1, tierRank(tier) + by))] as ActingTier;

/** SAG-AFTRA's day-performer and weekly minimums, 2026–27 (the same figures 0707 uses). */
export const SAG_DAY_RATE = 1_283;
export const SAG_WEEK_RATE = 4_456;

export interface ActingTierRow {
  readonly id: ActingTier;
  /** What this rung is called on a card. */
  readonly name: string;
  /** What the work is, in a few words. */
  readonly blurb: string;
  /** The youngest age that can be offered work at this rung. */
  readonly minAge: number;
  /** Paid and unpaid parts worked, at least. */
  readonly minCredits: number;
  /** The craft level at least (0–100). */
  readonly minCraft: number;
  /** Acting reputation at least (0–100). */
  readonly minReputation: number;
  /** The share of roles at this rung that are a lead, a supporting part and a bit part. Sums to 1. */
  readonly billing: Readonly<Record<Billing, number>>;
  /** What a LEAD at this rung pays for the work, whole dollars, low to high. */
  readonly fee: readonly [number, number];
  /** The kinds of work, in the words of "a ...". */
  readonly mediums: readonly string[];
  /** A role at this rung is a hit when the performance reaches this. */
  readonly hitLine: number;
  /** Chance per offer slot a year, before reputation and an agent. */
  readonly slots: readonly number[];
  /** Fame held while working at this rung. */
  readonly fame: number;
  /** Reputation a role adds at this rung, before its billing. */
  readonly reputation: number;
}

export const ACTING_TIER_ROWS: Readonly<Record<ActingTier, ActingTierRow>> = {
  local: {
    id: 'local',
    name: 'Student films and community stage',
    blurb: 'Student films, community stage and indie shorts: usually unpaid, always a credit.',
    minAge: 11,
    minCredits: 0,
    minCraft: 0,
    minReputation: 0,
    billing: { lead: 0.35, supporting: 0.4, bit: 0.25 },
    fee: [0, 600],
    mediums: ['a student film', 'a community stage production', 'an indie short'],
    hitLine: 58,
    slots: [0.45, 0.15],
    fame: 0,
    reputation: 1,
  },
  commercial: {
    id: 'commercial',
    name: 'Commercials and background work',
    blurb: 'Commercials, extra and background parts, the first jobs that pay a union day.',
    minAge: 16,
    minCredits: 0,
    minCraft: 35,
    minReputation: 0,
    billing: { lead: 0.3, supporting: 0.3, bit: 0.4 },
    fee: [SAG_DAY_RATE, 12_000],
    mediums: [
      'a regional commercial',
      'a national commercial',
      'a background part on a TV series',
      'an industrial video',
    ],
    hitLine: 62,
    slots: [0.55, 0.3, 0.1],
    fame: 3,
    reputation: 2,
  },
  working: {
    id: 'working',
    name: 'Bit parts and small TV',
    blurb:
      'Bit film parts, guest spots and small TV: a few days on a set and a name in the credits.',
    minAge: 18,
    minCredits: 3,
    minCraft: 45,
    minReputation: 0,
    billing: { lead: 0.05, supporting: 0.25, bit: 0.7 },
    fee: [SAG_DAY_RATE * 2, 21_000],
    mediums: ['a small TV role', 'a bit part in a film', 'a guest spot on a series'],
    hitLine: 66,
    slots: [0.7, 0.45, 0.2],
    fame: 8,
    reputation: 3,
  },
  supporting: {
    id: 'supporting',
    name: 'Supporting roles in TV and film',
    blurb: 'Supporting parts on series and features, weeks on a set at a time.',
    minAge: 20,
    minCredits: 10,
    minCraft: 58,
    minReputation: 10,
    billing: { lead: 0.1, supporting: 0.7, bit: 0.2 },
    fee: [20_000, 150_000],
    mediums: ['a TV series', 'a feature film', 'a streaming series'],
    hitLine: 70,
    slots: [0.8, 0.55, 0.3],
    fame: 20,
    reputation: 4,
  },
  lead: {
    id: 'lead',
    name: 'Leading roles',
    blurb: 'Leading parts in TV and film, and a face on the poster.',
    minAge: 22,
    minCredits: 25,
    minCraft: 72,
    minReputation: 30,
    billing: { lead: 0.75, supporting: 0.25, bit: 0 },
    fee: [150_000, 2_000_000],
    mediums: ['a network TV series', 'a feature film', 'a streaming drama', 'a limited series'],
    hitLine: 76,
    slots: [0.8, 0.5, 0.25],
    fame: 42,
    reputation: 5,
  },
  star: {
    id: 'star',
    name: 'Prestige and franchise films',
    blurb: 'Prestige pictures and franchise leads: a name that sells the film.',
    minAge: 25,
    minCredits: 50,
    minCraft: 84,
    minReputation: 55,
    billing: { lead: 0.7, supporting: 0.3, bit: 0 },
    fee: [2_000_000, 25_000_000],
    mediums: ['a prestige drama', 'a franchise film', 'a major studio picture'],
    hitLine: 84,
    slots: [0.7, 0.4, 0.15],
    fame: 70,
    reputation: 6,
  },
};

/** What a part is worth against a lead at the same rung. */
export const BILLING_FEE: Readonly<Record<Billing, number>> = {
  lead: 1,
  supporting: 0.55,
  bit: 0.25,
};

/** Days on set a part takes. A student or commercial job is a fraction of a film's. */
export const BILLING_DAYS: Readonly<Record<Billing, number>> = {
  lead: 110,
  supporting: 40,
  bit: 5,
};

/** The share of a rung's days that a small job takes. */
export const SMALL_WORK: Readonly<Record<ActingTier, number>> = {
  local: 0.25,
  commercial: 0.25,
  working: 1,
  supporting: 1,
  lead: 1,
  star: 1,
};

/** A year has this many days to give to sets. Booking past it is refused. */
export const YEAR_DAYS = 180;

export const BILLING_WORDS: Readonly<Record<Billing, string>> = {
  lead: 'the lead',
  supporting: 'a supporting part',
  bit: 'a bit part',
};

/** A noun for a billing, with its article: "a lead". */
export const BILLING_NOUN: Readonly<Record<Billing, string>> = {
  lead: 'a lead',
  supporting: 'a supporting part',
  bit: 'a bit part',
};

/** What a role is worth, whole dollars, from a draw in [0, 1) and the rung and billing it is at. */
export function roleFee(tier: ActingTier, billing: Billing, unit: number): number {
  const [low, high] = ACTING_TIER_ROWS[tier].fee;
  const base = low <= 0 ? high * unit : low * Math.pow(high / low, unit);
  const raw = base * BILLING_FEE[billing];
  // To the nearest hundred up to ten thousand, the nearest thousand to a million, then ten thousand.
  const step = raw < 10_000 ? 100 : raw < 1_000_000 ? 1_000 : 10_000;
  return Math.round(raw / step) * step;
}

/** The days a role takes on set, whole days, from a draw. */
export function roleDays(tier: ActingTier, billing: Billing, unit: number): number {
  return Math.max(1, Math.round(BILLING_DAYS[billing] * SMALL_WORK[tier] * (0.7 + unit * 0.6)));
}

/** The billing a draw lands on at a rung. */
export function billingFor(tier: ActingTier, unit: number): Billing {
  const row = ACTING_TIER_ROWS[tier].billing;
  let seen = 0;
  for (const billing of BILLINGS) {
    seen += row[billing];
    if (unit < seen) return billing;
  }
  return 'supporting';
}

/** Fictional titles; none is a real film or show. */
export const ROLE_TITLES: readonly string[] = [
  'The Last Bus Home',
  'Salt Flats',
  'Quiet Hours',
  'North of Nowhere',
  'The Understudy',
  'Paper Boats',
  'Low Tide',
  'Harbor Lights',
  'A Season of Rain',
  'Second Chances',
  'The Long Way Round',
  'Copper Creek',
  'Borrowed Time',
  'Midnight Shift',
  'The Quiet Neighbor',
  'Glass Houses',
  'Cold Harbor Nights',
  'Little Fires Out West',
  'Fifth Street',
  'The Weight of Water',
  'Lantern Hill',
  'What We Kept',
  'Open Country',
  'The Ferryman’s Daughter',
  'Dust and Daylight',
  'Back Roads',
  'The Winter Orchard',
  'Signal Lost',
  'Evening Edition',
  'Trouble in Tandem',
];

/* -------------------------------------------------------------------------- */
/* Craft                                                                       */
/* -------------------------------------------------------------------------- */

/** What an acting talent is worth to craft. A head start, not a guarantee (spec 1070). */
export const TALENT_CRAFT = 12;

/** How far work and lessons can take craft past what the character is. */
export const CRAFT_HEADROOM = 10;

/** Extra headroom a year of lessons gives, and what a credit adds, up to a cap. */
export const LESSONS_CRAFT = 4;
export const CREDIT_CRAFT = 0.3;
export const CREDIT_CRAFT_CAP = 6;

/** Acting lessons: yearly, from this age. Judgement; a working class runs $1,000 to $3,000 a year. */
export const LESSONS_MIN_AGE = 10;
export const LESSONS_COST = 1_800;
export const LESSONS_COST_SOURCE = 'acting lessons';

/** Character development: sessions a year, from this age. A session lifts craft a little, never past the ceiling. */
export const DEVELOPMENT_MIN_AGE = 12;
export const DEVELOPMENT_SESSIONS = 3;

/**
 * What the character is like as an actor, 0–100. Charisma, looks, smarts and discipline, and an acting talent.
 * Health and stress are not inputs (spec 280).
 */
export function naturalCraft(
  stats: {
    readonly charisma: number;
    readonly looks: number;
    readonly smarts: number;
    readonly discipline: number;
  },
  talent: boolean,
): number {
  const base =
    0.4 * stats.charisma + 0.2 * stats.looks + 0.15 * stats.smarts + 0.25 * stats.discipline;
  // A grown character's stats sit between 56 and 85 with half of them within 71–78 (measured, 0805). Spread
  // that over the whole scale, so what a person is like matters, and a median character comes out near 54.
  const spread = 50 + (base - 72) * 2.2;
  return Math.max(0, Math.min(100, Math.round(spread + (talent ? TALENT_CRAFT : 0))));
}

/* -------------------------------------------------------------------------- */
/* Getting the work                                                            */
/* -------------------------------------------------------------------------- */

/** An offer's tier: one below, at, or one above the standing. Without and with an agent. */
export const OFFER_TIER_WEIGHTS: Readonly<
  Record<'plain' | 'agent', readonly [number, number, number]>
> = {
  plain: [0.2, 0.7, 0.1],
  agent: [0.1, 0.5, 0.4],
};

/** Offers a year: how much a good name and a talent multiply the slots. */
export const TALENT_OFFER_CHANCE = 1.25;
export const REPUTATION_OFFER_RANGE: readonly [number, number] = [0.6, 1.2];

/** Years after the last time an actor was on a stage, in lessons or on a set that directors still remember them. */
export const SEEN_YEARS = 4;

/** Casting calls that are open, and how many a person can answer in a year. */
export const CASTING_CALLS = 6;
export const APPLICATIONS_PER_YEAR = 2;
export const AGENT_SUBMISSIONS = 2;

/** The odds of an application landing a part: one rung below, at, and above the standing. */
export const APPLY_BASE: Readonly<Record<'below' | 'at' | 'above', number>> = {
  below: 0.8,
  at: 0.55,
  above: 0.28,
};
export const APPLY_CRAFT_WEIGHT = 0.5;
export const APPLY_TALENT_BONUS = 0.08;
export const APPLY_AGENT_BONUS = 0.12;
export const APPLY_REPUTATION_WEIGHT = 0.2;
export const APPLY_BILLING: Readonly<Record<Billing, number>> = {
  lead: -0.12,
  supporting: 0,
  bit: 0.12,
};

/** An agent: a share of every fee, and what they do for the work. */
export const AGENT_MIN_CREDITS = 2;
export const AGENT_MIN_TIER: ActingTier = 'commercial';
export const AGENT_CUT = 0.1;
export const AGENT_SLOT_CHANCE = 0.5;
export const AGENT_OFFER_MULTIPLIER = 1.3;
export const AGENT_ASK_BONUS = 0.15;

/** Asking for more: the chance, and how much a win adds. Only a part that pays this much can be bargained over. */
export const NEGOTIABLE_FROM = 5_000;
export const ASK_BASE = 0.5;
export const ASK_REPUTATION_WEIGHT = 0.25;
export const ASK_GAIN: readonly [number, number] = [1.1, 1.25];

/* -------------------------------------------------------------------------- */
/* A year of work                                                              */
/* -------------------------------------------------------------------------- */

/** The spread a performance has around craft: ±15. */
export const PERFORMANCE_NOISE = 30;
/** A role flops when the performance is this far under the rung's hit line. */
export const FLOP_MARGIN = 25;
/** Hits at a rung that carry an actor to the next; a hit on a part one rung above carries them at once. */
export const HITS_TO_RISE: Readonly<Record<ActingTier, number>> = {
  local: 2,
  commercial: 2,
  working: 3,
  supporting: 3,
  lead: 5,
  star: 99,
};
/** Years with no work after which an actor slides down a rung. */
export const IDLE_FALL_YEARS = 3;

/** Reputation: a hit adds, a flop takes, a year with no work takes. */
export const HIT_REPUTATION = 3;
export const FLOP_REPUTATION = 3;
export const IDLE_REPUTATION = 2;
export const BILLING_REPUTATION: Readonly<Record<Billing, number>> = {
  lead: 1,
  supporting: 0.6,
  bit: 0.3,
};

/** After this age the phone rings a little less each year, never below a third. */
export const AGEING_FROM = 55;
export const AGEING_RATE = 0.02;
export const AGEING_FLOOR = 0.3;

/* -------------------------------------------------------------------------- */
/* Awards                                                                      */
/* -------------------------------------------------------------------------- */

/** Fictional ceremonies. No real award's name appears. */
export const AWARD_CEREMONY = 'the Marquee Awards';
export const AWARD_FROM: ActingTier = 'supporting';
export const AWARD_LINE = 84;
/** The chance per eligible role, by rung. */
export const AWARD_CHANCE: Readonly<Record<ActingTier, number>> = {
  local: 0,
  commercial: 0,
  working: 0,
  supporting: 0.08,
  lead: 0.12,
  star: 0.16,
};
export const AWARD_REPUTATION = 8;
export const AWARD_MOOD = 6;
export const AWARD_NAMES: Readonly<Record<Billing, string>> = {
  lead: 'Best Lead Performance',
  supporting: 'Best Supporting Performance',
  bit: 'Best Breakout Performance',
};

/* -------------------------------------------------------------------------- */
/* Fame                                                                        */
/* -------------------------------------------------------------------------- */

/** Fame an acting career holds an actor at while the work is coming, 0–100. */
export function actingFameOf(input: {
  readonly tier: ActingTier;
  readonly reputation: number;
  readonly awards: number;
  readonly idle: number;
}): number {
  if (input.idle >= IDLE_FALL_YEARS) return 0;
  const row = ACTING_TIER_ROWS[input.tier];
  if (row.fame === 0) return 0;
  const held = row.fame + Math.round(input.reputation / 10) + Math.min(12, input.awards * 3);
  return Math.min(100, input.idle > 0 ? Math.round(held / 2) : held);
}

/** A rung's rise, in words for the timeline. */
export const TIER_RISE_LINES: Readonly<Record<ActingTier, string>> = {
  local: 'Back to student films and the community stage.',
  commercial: 'Commercials and background work are coming in. It pays a union day.',
  working: 'Casting directors know your name now. The parts are small and they’re real.',
  supporting: 'Supporting roles in TV and film. You’re a working actor.',
  lead: 'They’re casting you as the lead.',
  star: 'Prestige and franchise offers. Your name sells the film.',
};

/** Words for an acting reputation. */
export function actingReputationWord(reputation: number): string {
  if (reputation >= 80) return 'Celebrated';
  if (reputation >= 60) return 'Respected';
  if (reputation >= 40) return 'Established';
  if (reputation >= 20) return 'Known to casting';
  if (reputation >= 5) return 'Getting noticed';
  return 'Unknown';
}
