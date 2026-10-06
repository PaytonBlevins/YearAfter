/**
 * Ticket 0801 — the sports engine's catalog and its odds.
 *
 * A sport is DATA here, not code: the engine in `@yearafter/simulation` reads
 * whichever sport a career names, so football or hockey (0802) is a new row in
 * `SPORTS` and not a second implementation. Basketball is the first row and
 * the one that proves the shape.
 *
 * Every number a player's life depends on is in this file and has a reason
 * written beside it, because 0801's honest-feedback finding was that these
 * odds make going pro COMMON compared with the real world, and a number that
 * is meant to be a dial has to be findable.
 */

/* -------------------------------------------------------------------------- */
/* Sports                                                                      */
/* -------------------------------------------------------------------------- */

export type SportId = 'basketball';

export interface SportSkill {
  readonly id: string;
  readonly name: string;
}

export interface Sport {
  readonly id: SportId;
  readonly name: string;
  /** The school team in `activities.json` that is this sport's first rung. */
  readonly activityId: string;
  /** Lower case, for sentences: "a basketball scholarship". */
  readonly noun: string;
  readonly league: string;
  readonly leagueShort: string;
  /** Fictional, as the game's brands are. A city and a nickname. */
  readonly proTeams: readonly string[];
  readonly collegeTeams: readonly string[];
  /**
   * Spec 9 and 343: a sport's skills are visible and trainable ONLY while the
   * character is in that sport. These are the names; the numbers are derived.
   */
  readonly skills: readonly SportSkill[];
  /** What a person who plays it is called, for the header. */
  readonly playerTitle: string;
}

export const SPORTS: readonly Sport[] = [
  {
    id: 'basketball',
    name: 'Basketball',
    activityId: 'act.basketball',
    noun: 'basketball',
    league: 'Premier Basketball Association',
    leagueShort: 'PBA',
    playerTitle: 'Professional basketball player',
    skills: [
      { id: 'shooting', name: 'Shooting' },
      { id: 'handling', name: 'Ball handling' },
      { id: 'defence', name: 'Defence' },
      { id: 'athleticism', name: 'Athleticism' },
      { id: 'court-sense', name: 'Court sense' },
    ],
    proTeams: [
      'Harbor City Gulls',
      'Ridgeline Rattlers',
      'Copper Valley Smelters',
      'Lakeshore Herons',
      'Brookfield Sparks',
      'Northgate Wolves',
      'Pinecrest Foresters',
      'Sunbelt Scorpions',
      'Iron Bay Tide',
      'Meridian Comets',
      'Stonebridge Lancers',
      'Redwater Pilots',
      'Westport Clippers',
      'Granite Falls Bears',
      'Silverton Express',
      'Delta Crossing Gators',
      'Highmark Eagles',
      'Cedar Point Jets',
      'Foxhollow Cardinals',
      'Bayfront Kings',
      'Prairie Line Bison',
      'Summit City Peaks',
      'Marlowe Hawks',
      'Oak Terrace Bulls',
    ],
    collegeTeams: [
      'Ridgemont State Bobcats',
      'Calloway University Pioneers',
      'Eastfield A&M Mustangs',
      'Lakeland College Falcons',
      'Westbrook University Owls',
      'Harlan State Cougars',
      'Pemberton Tech Engineers',
      'St. Aldric Monarchs',
      'Clearwater State Marlins',
      'Thornfield University Stags',
      'Brightwater College Otters',
      'Kestrel Valley Wildcats',
    ],
  },
];

const SPORTS_BY_ID = new Map(SPORTS.map((sport) => [sport.id, sport]));

export const findSport = (id: string): Sport | undefined => SPORTS_BY_ID.get(id as SportId);

/** The sport a school activity is the first rung of, if any. */
export const sportOfActivity = (activityId: string): Sport | undefined =>
  SPORTS.find((sport) => sport.activityId === activityId);

/* -------------------------------------------------------------------------- */
/* The odds                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Who a player is, for the odds. Two facts only — talent, which the character
 * is born with (spec 1070: Boolean, and a head start rather than a guarantee),
 * and whether they actually put the work in — and the four answers they make.
 */
export type SportCategory = 'talentAndWork' | 'talentOnly' | 'workOnly' | 'neither';

export const categoryOf = (talented: boolean, hardWorking: boolean): SportCategory =>
  talented ? (hardWorking ? 'talentAndWork' : 'talentOnly') : hardWorking ? 'workOnly' : 'neither';

/**
 * Of the players on a team, the share who REACH THE PROS — after college.
 *
 * Payton's numbers (6 October 2026): about 95% with natural talent and hard
 * work, 75% with talent and none, 60% for hard work with none, about 3% for
 * neither. They are the ANSWER, not an input to a formula: the two draws below
 * are sized so that the two stages together multiply back to exactly these.
 *
 * THESE ARE FAR ABOVE REAL LIFE (the NCAA puts a high-school basketball player
 * at about 0.04% to the pros). Spec 949 asks for strong play to beat real
 * life, and this is that dial turned a long way. See the v0.08 document's
 * finding on how common "going pro" is for a life that only presses Advance.
 */
export const REACH_PROS: Readonly<Record<SportCategory, number>> = {
  talentAndWork: 0.95,
  talentOnly: 0.75,
  workOnly: 0.6,
  neither: 0.03,
};

/**
 * Of those who reach the pros, the share who become STARS.
 *
 * 45%, 20% and 10% are Payton's. He did not give the fourth, so it is
 * 0.5% — a dial, flagged in the ticket document as the one number nobody chose.
 */
export const BECOME_STAR: Readonly<Record<SportCategory, number>> = {
  talentAndWork: 0.45,
  talentOnly: 0.2,
  workOnly: 0.1,
  neither: 0.005,
};

/**
 * The road is two filters, college and then the draft, and they have to
 * multiply to `REACH_PROS`. The split is a judgement: the draft is the harder
 * door, so it takes the larger share of the failing.
 *
 * recruited = reach ^ 0.4, drafted = reach ^ 0.6, and 0.4 + 0.6 = 1.
 */
export const RECRUIT_EXPONENT = 0.4;

export const recruitChance = (category: SportCategory): number =>
  Math.pow(REACH_PROS[category], RECRUIT_EXPONENT);

export const draftChance = (category: SportCategory): number =>
  Math.pow(REACH_PROS[category], 1 - RECRUIT_EXPONENT);

/**
 * Putting the work in: a season counts when the character used at least two of
 * the year's three practice sessions, and a career is a hard worker when half
 * its seasons count (and at least one does).
 */
export const HARD_WORK_SESSIONS = 2;

export const isHardWorker = (seasons: number, hardSeasons: number): boolean =>
  hardSeasons >= 1 && hardSeasons * 2 >= seasons;

/* -------------------------------------------------------------------------- */
/* Tiers, pay and fame                                                         */
/* -------------------------------------------------------------------------- */

export type SportTier = 'fringe' | 'role' | 'starter' | 'star' | 'superstar';

export const TIERS: readonly SportTier[] = ['fringe', 'role', 'starter', 'star', 'superstar'];

export const TIER_NAMES: Readonly<Record<SportTier, string>> = {
  fringe: 'a fringe player',
  role: 'a role player',
  starter: 'a starter',
  star: 'a star',
  superstar: 'a superstar',
};

export const tierIndex = (tier: SportTier): number => TIERS.indexOf(tier);

export const stepTier = (tier: SportTier, by: number): SportTier =>
  TIERS[Math.max(0, Math.min(TIERS.length - 1, tierIndex(tier) + by))] as SportTier;

/**
 * A year's pay at a tier, whole dollars. The floor is the real league minimum
 * (the NBA's rookie minimum is $1,272,870 for 2025-26); the rest is a game
 * ladder, and the top is deliberately not capped by a real salary cap (spec
 * 949: extreme success is intended and uncapped).
 */
export const TIER_PAY: Readonly<Record<SportTier, number>> = {
  fringe: 1_300_000,
  role: 3_200_000,
  starter: 11_000_000,
  star: 32_000_000,
  superstar: 55_000_000,
};

/** A rookie contract by draft position: $12m at the top, the minimum from the second round on. */
export const rookiePay = (pick: number): number => {
  if (pick > 30) return TIER_PAY.fringe;
  return Math.round(12_000_000 - ((pick - 1) / 29) * 9_600_000);
};

/** Fame a tier holds a player at, 0–100, while they play. */
export const TIER_FAME: Readonly<Record<SportTier, number>> = {
  fringe: 4,
  role: 10,
  starter: 24,
  star: 52,
  superstar: 84,
};

/** Reputation a season adds at a tier. Reputation is per career (spec 11) and is what coaching and commentary read later. */
export const TIER_REPUTATION: Readonly<Record<SportTier, number>> = {
  fringe: -1,
  role: 1,
  starter: 3,
  star: 5,
  superstar: 7,
};

/**
 * A team's chance of a title in a season is 1 in 30, and a better player moves
 * it a little. Individual excellence does not guarantee a championship (spec),
 * so even a superstar wins one season in about six.
 */
export const BASE_TITLE_CHANCE = 0.033;
export const TIER_TITLE_BONUS: Readonly<Record<SportTier, number>> = {
  fringe: 0,
  role: 0.005,
  starter: 0.02,
  star: 0.06,
  superstar: 0.12,
};

/** Injuries are meaningful and not constant (spec). Per season, at the pro level and in college. */
export const PRO_INJURY_CHANCE = 0.13;
export const COLLEGE_INJURY_CHANCE = 0.07;
/** Of injuries: the share that keeps a player out for the season, and the share that ends it. */
export const SERIOUS_SHARE = 0.25;
export const CAREER_ENDING_SHARE = 0.05;
/** A serious injury costs a tier for good about this often. */
export const SERIOUS_TIER_LOSS_CHANCE = 0.3;

/** How long a player lasts: the age they retire at, by the best tier they reach. A range, drawn per career. */
export const RETIRE_AGE: Readonly<Record<SportTier, readonly [number, number]>> = {
  fringe: [26, 29],
  role: [28, 32],
  starter: [30, 34],
  star: [32, 36],
  superstar: [33, 38],
};

/** The age a recruit is drafted, if they stay four years: and the years before a star breaks through. */
export const BREAKOUT_YEARS: Readonly<Record<SportTier, readonly [number, number]>> = {
  fringe: [1, 1],
  role: [1, 2],
  starter: [1, 3],
  star: [2, 4],
  superstar: [2, 4],
};

/* -------------------------------------------------------------------------- */
/* Choosing what a career peaks at                                             */
/* -------------------------------------------------------------------------- */

/**
 * Among pros who do NOT become stars: fringe, role player or starter. A third
 * of the league is on the edge of a roster, which is true.
 */
const NON_STAR_SPLIT: readonly [number, number] = [0.35, 0.75];

/** Of the stars, the share who become superstars. */
export const SUPERSTAR_SHARE = 0.25;

/**
 * The best tier a pro career will reach, decided once when the draft happens
 * from two units in [0, 1). A pure function, so it is testable without a life.
 */
export function peakTierFor(
  category: SportCategory,
  starUnit: number,
  rankUnit: number,
): SportTier {
  if (starUnit < BECOME_STAR[category]) {
    return rankUnit < SUPERSTAR_SHARE ? 'superstar' : 'star';
  }
  if (rankUnit < NON_STAR_SPLIT[0]) return 'fringe';
  if (rankUnit < NON_STAR_SPLIT[1]) return 'role';
  return 'starter';
}

/** Where in the draft a player of a given peak goes, 1–60. Higher tiers go earlier. */
const PICK_RANGE: Readonly<Record<SportTier, readonly [number, number]>> = {
  superstar: [1, 8],
  star: [1, 14],
  starter: [6, 30],
  role: [18, 50],
  fringe: [32, 60],
};

export function draftPickFor(peak: SportTier, unit: number): number {
  const [low, high] = PICK_RANGE[peak];
  return low + Math.floor(unit * (high - low + 1));
}

/** A whole number in [low, high] from a unit. */
export const between = (unit: number, [low, high]: readonly [number, number]): number =>
  low + Math.floor(unit * (high - low + 1));

/* -------------------------------------------------------------------------- */
/* What a player is like                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The level a player tends towards, 0–100: health and discipline, and talent
 * as a head start rather than a ceiling (spec 1070).
 */
export function naturalForm(health: number, discipline: number, talented: boolean): number {
  const base = 32 + (health - 50) * 0.45 + (discipline - 50) * 0.3;
  return Math.max(0, Math.min(100, Math.round(base + (talented ? 16 : 0))));
}

/** A skill's number, derived and never stored: the overall form with a fixed per-skill lean from a unit in [0, 1). */
export function skillValue(form: number, leanUnit: number): number {
  return Math.max(0, Math.min(100, Math.round(form + (leanUnit - 0.5) * 16)));
}

/** What reputation reads as, in words. */
export function sportReputationWord(reputation: number): string {
  if (reputation >= 80) return 'a legend';
  if (reputation >= 60) return 'well respected';
  if (reputation >= 35) return 'known';
  if (reputation >= 15) return 'a name in the league';
  return 'unknown';
}
