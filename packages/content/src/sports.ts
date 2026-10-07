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

export type SportId = 'basketball' | 'football' | 'baseball' | 'soccer' | 'hockey';

export type SportTier = 'fringe' | 'role' | 'starter' | 'star' | 'superstar';

export interface SportSkill {
  readonly id: string;
  readonly name: string;
}

/**
 * What differs between sports in the money and the years (ticket 0802). Everything
 * else about a career — the odds, the ladder, the tiers, fame, titles — is shared,
 * so a sport is a row and not a second implementation.
 */
export interface SportEconomy {
  /**
   * A year's pay at a tier, whole dollars. `fringe` is the real league minimum
   * (the figures are written beside each sport); the rest is a game ladder and
   * the top is deliberately not capped by a real salary cap (spec 949).
   */
  readonly pay: Readonly<Record<SportTier, number>>;
  /** How long a player lasts: the age they retire at, by the best tier they reach. A range, drawn per career. */
  readonly retireAge: Readonly<Record<SportTier, readonly [number, number]>>;
  /** Picks in the draft; the pick ranges below are written for 60 and scaled to this. */
  readonly draftSize: number;
  /** How many picks make up the first round: they get a four-year deal and the rest two. */
  readonly firstRound: number;
  /** The first pick's pay in a first season; later picks run down to a fifth of it, never below the minimum. */
  readonly rookieTop: number;
  /** Times the base chance of an injury, in college and the pros. Football breaks people more than golf-like sports. */
  readonly injuryFactor: number;
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
  /**
   * A label and nothing more (Payton, 6 October 2026): the position a player is
   * drawn into for the life, shown beside the header. It has no effect on the
   * odds, the pay or the skills.
   */
  readonly positions: readonly string[];
  /** What a person who plays it is called, for the header. */
  readonly playerTitle: string;
  readonly economy: SportEconomy;
}

/**
 * Colleges field every sport: one list of fictional programs serves all five.
 */
const COLLEGE_TEAMS: readonly string[] = [
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
];

/**
 * Basketball. The NBA's 2025-26 rookie minimum is $1,272,870 and the game's
 * fringe tier is $1.3 million; a rookie's top pick earns $12 million, which is
 * about the real third-year scale for a number-one pick.
 */
const BASKETBALL_ECONOMY: SportEconomy = {
  pay: {
    fringe: 1_300_000,
    role: 3_200_000,
    starter: 11_000_000,
    star: 32_000_000,
    superstar: 55_000_000,
  },
  retireAge: {
    fringe: [26, 29],
    role: [28, 32],
    starter: [30, 34],
    star: [32, 36],
    superstar: [33, 38],
  },
  draftSize: 60,
  firstRound: 30,
  rookieTop: 12_000_000,
  injuryFactor: 1,
};

/**
 * Football. The NFL's 2026 minimum is $885,000 for a rookie and $1.3 million
 * for a veteran of seven seasons; a number-one pick's contract runs about $12
 * million a year. Real careers are short (about three and a third years, and
 * the average retirement age is 27.6), so the game's run short too, and the
 * sport that breaks people most has the highest injury factor.
 */
const FOOTBALL_ECONOMY: SportEconomy = {
  pay: {
    fringe: 900_000,
    role: 2_000_000,
    starter: 6_500_000,
    star: 24_000_000,
    superstar: 55_000_000,
  },
  retireAge: {
    fringe: [24, 27],
    role: [26, 29],
    starter: [28, 31],
    star: [30, 34],
    superstar: [32, 37],
  },
  draftSize: 224,
  firstRound: 32,
  rookieTop: 12_000_000,
  injuryFactor: 1.6,
};

/**
 * Baseball. The MLB minimum for 2026 is $780,000, flat. Rookies are mostly
 * paid the minimum, so the top of a first year is small; careers run longest
 * of the five (four to five seasons after the minors in real life).
 */
const BASEBALL_ECONOMY: SportEconomy = {
  pay: {
    fringe: 780_000,
    role: 2_500_000,
    starter: 9_000_000,
    star: 30_000_000,
    superstar: 55_000_000,
  },
  retireAge: {
    fringe: [27, 30],
    role: [29, 33],
    starter: [31, 35],
    star: [33, 38],
    superstar: [35, 40],
  },
  draftSize: 600,
  firstRound: 30,
  rookieTop: 1_500_000,
  injuryFactor: 0.9,
};

/**
 * Soccer. MLS's 2026 senior minimum is $113,400 (a reserve is $88,025); the
 * game's league is a fictional American one, paying far less than basketball
 * at every tier and with the biggest spread between a star and a superstar.
 */
const SOCCER_ECONOMY: SportEconomy = {
  pay: {
    fringe: 115_000,
    role: 400_000,
    starter: 1_200_000,
    star: 5_000_000,
    superstar: 20_000_000,
  },
  retireAge: {
    fringe: [26, 29],
    role: [28, 32],
    starter: [30, 34],
    star: [32, 36],
    superstar: [34, 38],
  },
  draftSize: 90,
  firstRound: 30,
  rookieTop: 450_000,
  injuryFactor: 1,
};

/**
 * Hockey. The NHL's 2025-26 minimum is $775,000, rising to $850,000 in 2026-27,
 * and a rookie's deal is capped near $975,000; the top of the real scale is
 * around $15 million, far below basketball's.
 */
const HOCKEY_ECONOMY: SportEconomy = {
  pay: {
    fringe: 850_000,
    role: 2_000_000,
    starter: 5_500_000,
    star: 11_000_000,
    superstar: 15_000_000,
  },
  retireAge: {
    fringe: [25, 28],
    role: [27, 31],
    starter: [29, 34],
    star: [32, 36],
    superstar: [34, 38],
  },
  draftSize: 224,
  firstRound: 32,
  rookieTop: 950_000,
  injuryFactor: 1.2,
};

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
    positions: ['Point guard', 'Shooting guard', 'Small forward', 'Power forward', 'Center'],
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
    collegeTeams: COLLEGE_TEAMS,
    economy: BASKETBALL_ECONOMY,
  },
  {
    id: 'football',
    name: 'Football',
    activityId: 'act.football',
    noun: 'football',
    league: 'National Gridiron League',
    leagueShort: 'NGL',
    playerTitle: 'Professional football player',
    skills: [
      { id: 'speed', name: 'Speed' },
      { id: 'strength', name: 'Strength' },
      { id: 'hands', name: 'Hands' },
      { id: 'tackling', name: 'Tackling' },
      { id: 'playbook', name: 'Playbook' },
    ],
    positions: [
      'Quarterback',
      'Running back',
      'Wide receiver',
      'Tight end',
      'Offensive lineman',
      'Defensive lineman',
      'Linebacker',
      'Cornerback',
      'Safety',
      'Kicker',
    ],
    proTeams: [
      'Ashford Ironclads',
      'Blackwater Drovers',
      'Cinder Ridge Foxes',
      'Dunmore Stallions',
      'Eastmere Barons',
      'Fairhaven Wardens',
      'Glenrock Quarrymen',
      'Hollis Point Mavericks',
      'Ironwood Bruisers',
      'Jasper Flats Coyotes',
      'Kingsmere Vanguard',
      'Lowell Crossing Hounds',
      'Marrow Bay Corsairs',
      'Northfield Steelheads',
      'Orchard Hill Threshers',
      'Pike County Outlaws',
      'Quarry Lake Bulldogs',
      'Redfern Sentinels',
      'Stillwater Rovers',
      'Tallgrass Drifters',
      'Union Falls Generals',
      'Vale Harbor Pathfinders',
      'Whitcombe Stags',
      'Yarrow Mills Reapers',
      'Zephyr Heights Condors',
    ],
    collegeTeams: COLLEGE_TEAMS,
    economy: FOOTBALL_ECONOMY,
  },
  {
    id: 'baseball',
    name: 'Baseball',
    activityId: 'act.baseball',
    noun: 'baseball',
    league: 'Continental Baseball League',
    leagueShort: 'CBL',
    playerTitle: 'Professional baseball player',
    skills: [
      { id: 'hitting', name: 'Hitting' },
      { id: 'power', name: 'Power' },
      { id: 'fielding', name: 'Fielding' },
      { id: 'arm', name: 'Arm' },
      { id: 'eye', name: 'Plate discipline' },
    ],
    positions: [
      'Pitcher',
      'Pitcher',
      'Catcher',
      'First baseman',
      'Second baseman',
      'Shortstop',
      'Third baseman',
      'Outfielder',
      'Outfielder',
    ],
    proTeams: [
      'Alder Park Millers',
      'Bellmont Sluggers',
      'Cobalt Springs Herons',
      'Dover Falls Foxes',
      'Elmhurst Grays',
      'Fenwick Anchors',
      'Garnet City Miners',
      'Hartwell Pelicans',
      'Indigo Bay Skiffs',
      'Juniper Hollow Wranglers',
      'Kettle River Ravens',
      'Larkspur Lumberjacks',
      'Maple Ridge Timbermen',
      'Nutley Heights Owls',
      'Oakdale Clippers',
      'Pembroke Cranes',
      'Quillan Bay Skippers',
      'Rosewater Rebels',
      'Saltmarsh Plovers',
      'Tern Lake Admirals',
      'Umber Valley Ramblers',
      'Verdant Bay Kestrels',
      'Westerly Cormorants',
      'Yellow Pine Prospectors',
      'Zinnia Cove Blossoms',
    ],
    collegeTeams: COLLEGE_TEAMS,
    economy: BASEBALL_ECONOMY,
  },
  {
    id: 'soccer',
    name: 'Soccer',
    activityId: 'act.soccer',
    noun: 'soccer',
    league: 'American Soccer Alliance',
    leagueShort: 'ASA',
    playerTitle: 'Professional soccer player',
    skills: [
      { id: 'passing', name: 'Passing' },
      { id: 'shooting', name: 'Shooting' },
      { id: 'dribbling', name: 'Dribbling' },
      { id: 'defending', name: 'Defending' },
      { id: 'stamina', name: 'Stamina' },
    ],
    positions: ['Goalkeeper', 'Defender', 'Defender', 'Midfielder', 'Midfielder', 'Forward'],
    proTeams: [
      'Aldgate United',
      'Brookhaven Athletic',
      'Castlemere Rovers',
      'Dunmore City',
      'Eastbrook SC',
      'Fairmount Wanderers',
      'Glenhaven United',
      'Harlow Park FC',
      'Ironbridge Athletic',
      'Kingsford Town',
      'Lakeside Albion',
      'Marlow City',
      'Northgate Rangers',
      'Oakhaven FC',
      'Pemberly United',
      'Queensmere SC',
      'Ravenscar Athletic',
      'Stonehaven Rovers',
      'Thornbury City',
      'Upton Vale FC',
      'Westmoor United',
      'Yarrowby Town',
      'Ashcombe Albion',
      'Bridgewater SC',
    ],
    collegeTeams: COLLEGE_TEAMS,
    economy: SOCCER_ECONOMY,
  },
  {
    id: 'hockey',
    name: 'Hockey',
    activityId: 'act.hockey',
    noun: 'hockey',
    league: 'Frontier Hockey League',
    leagueShort: 'FHL',
    playerTitle: 'Professional hockey player',
    skills: [
      { id: 'skating', name: 'Skating' },
      { id: 'shot', name: 'Shot' },
      { id: 'stickhandling', name: 'Stickhandling' },
      { id: 'checking', name: 'Checking' },
      { id: 'vision', name: 'Vision' },
    ],
    positions: ['Center', 'Left wing', 'Right wing', 'Defenseman', 'Defenseman', 'Goaltender'],
    proTeams: [
      'Arctic Bend Wolverines',
      'Birchwood Blades',
      'Cold Harbor Frost',
      'Dagger Lake Pikes',
      'Edgewater Icebreakers',
      'Frostgate Huskies',
      'Glacier Point Pioneers',
      'Hollow Pine Lynx',
      'Ironhaven Forgers',
      'Jarrow Falls Harriers',
      'Keel Bay Narwhals',
      'Lakemont Loons',
      'Moose Run Antlers',
      'Northwind Auroras',
      'Orrin Sound Seals',
      'Pinewater Trappers',
      'Quarrel Lake Grizzlies',
      'Redpine Moose',
      'Stonewall Voyageurs',
      'Timber Rapids Beavers',
      'Upland Sound Kodiaks',
      'Vesper Lake Ptarmigan',
      'White Fir Glaciers',
      'Yarrow Bay Ice Hawks',
    ],
    collegeTeams: COLLEGE_TEAMS,
    economy: HOCKEY_ECONOMY,
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

/** The basketball ladder, kept under its old names for the places that predate 0802. */
export const TIER_PAY: Readonly<Record<SportTier, number>> = BASKETBALL_ECONOMY.pay;
export const RETIRE_AGE: Readonly<Record<SportTier, readonly [number, number]>> =
  BASKETBALL_ECONOMY.retireAge;

/**
 * A rookie contract by draft position: the top pick's pay for the first, running
 * down to a fifth of it by the end of the first round, and the minimum from the
 * second round on. Never below the league minimum.
 */
export const rookiePay = (pick: number, economy: SportEconomy = BASKETBALL_ECONOMY): number => {
  if (pick > economy.firstRound) return economy.pay.fringe;
  const span = Math.max(1, economy.firstRound - 1);
  const pay = Math.round(economy.rookieTop - ((pick - 1) / span) * economy.rookieTop * 0.8);
  return Math.max(economy.pay.fringe, pay);
};

/** Years on a first contract: four for a first-round pick, two for anyone later. */
export const rookieYears = (pick: number, firstRound: number): number =>
  pick <= firstRound ? 4 : 2;

/** The round a pick falls in, from 1. */
export const roundOf = (pick: number, firstRound: number): number =>
  Math.ceil(pick / Math.max(1, firstRound));

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

/** Where in a draft of 60 a player of a given peak goes. Higher tiers go earlier. */
const PICK_RANGE: Readonly<Record<SportTier, readonly [number, number]>> = {
  superstar: [1, 8],
  star: [1, 14],
  starter: [6, 30],
  role: [18, 50],
  fringe: [32, 60],
};

/** The ranges above are for a draft of 60; a longer one stretches them in proportion. */
export function draftPickFor(peak: SportTier, unit: number, draftSize = 60): number {
  const [low, high] = PICK_RANGE[peak];
  const scale = draftSize / 60;
  const from = Math.max(1, Math.round(low * scale));
  const to = Math.max(from, Math.min(draftSize, Math.round(high * scale)));
  return from + Math.floor(unit * (to - from + 1));
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
