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

export type SportId =
  | 'basketball'
  | 'football'
  | 'baseball'
  | 'soccer'
  | 'hockey'
  | 'golf'
  | 'tennis'
  | 'boxing'
  | 'mma'
  | 'track'
  | 'swimming'
  | 'gymnastics'
  | 'wrestling'
  | 'olympic-boxing'
  | 'racing';

/**
 * How a sport is played for a living (ticket 0803).
 *
 *   team    a roster: a draft, a contract, a club that pays you (0801, 0802)
 *   tour    a ranked circuit: a tour card, prize money, and a rank that moves with results (golf, tennis)
 *   combat  a record: fights decided by skill, purses, and a road that runs through a martial art (boxing, MMA)
 *   olympic a national program: a season of results, a Games every four years, medals (ticket 0804)
 *
 * The two individual formats share one rule: nobody is guaranteed a thing. What a player earns is
 * what the season's results earn it.
 */
export type SportFormat = 'team' | 'tour' | 'combat' | 'olympic' | 'racing';

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
  /**
   * The lowest tier at which playing is a full-time living: a day job ends there, and the
   * header reads "Professional ...". Below it the player keeps whatever else they do for a
   * living. Every team and tour player is full time; a club fighter is not.
   */
  readonly fullTimeFrom: SportTier;
  /**
   * The age a body starts to give back what training built (default 30). Golf holds its players
   * into their forties; tennis and combat sports do not.
   */
  readonly declineFrom?: number;
}

export interface Sport {
  readonly id: SportId;
  readonly format: SportFormat;
  readonly name: string;
  /**
   * The school team in `activities.json` that is this sport's first rung. Empty for a sport with no
   * school team: boxing and MMA start in a gym, through a martial art (`MARTIAL_ARTS`).
   */
  readonly activityId: string;
  /** Lower case, for sentences: "a basketball scholarship". */
  readonly noun: string;
  readonly league: string;
  readonly leagueShort: string;
  /** Fictional, as the game's brands are. A city and a nickname. */
  /**
   * A team sport's clubs; a fighter's gyms; empty for a tour, which has no club to play for.
   */
  readonly proTeams: readonly string[];
  /** Empty for a sport with no college road (boxing, MMA). */
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
  fullTimeFrom: 'fringe',
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
  fullTimeFrom: 'fringe',
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
  fullTimeFrom: 'fringe',
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
  fullTimeFrom: 'fringe',
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
  fullTimeFrom: 'fringe',
};

/**
 * Golf. A tour has no contract: pay is prize money, and these are a year's winnings at a tier. The PGA
 * Tour's 2025 average was about $2.3 million a player and its leader took in tens of millions, so a
 * starter sits near the average and a superstar is far above it. A fringe player is on the edge of
 * keeping a card, and the year's prize money is about what that costs to chase. Gross: the caddie,
 * the travel and the coach come out of it in life, and are not modelled here.
 */
const GOLF_ECONOMY: SportEconomy = {
  pay: {
    fringe: 450_000,
    role: 1_300_000,
    starter: 3_200_000,
    star: 9_000_000,
    superstar: 30_000_000,
  },
  retireAge: {
    fringe: [29, 34],
    role: [32, 38],
    starter: [35, 42],
    star: [38, 47],
    superstar: [40, 50],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 0.5,
  fullTimeFrom: 'fringe',
  declineFrom: 38,
};

/**
 * Tennis. The ATP's 2025 leader won $19.1 million in prize money and the player twentieth on the list
 * $2.2 million; the third took $6 million, and the fall-off below them is steep. Ranks 100 to 250 make
 * a living that does not cover a coach and travel, which is why a fringe player's year is small.
 */
const TENNIS_ECONOMY: SportEconomy = {
  pay: {
    fringe: 120_000,
    role: 450_000,
    starter: 1_600_000,
    star: 6_000_000,
    superstar: 19_000_000,
  },
  retireAge: {
    fringe: [24, 28],
    role: [26, 31],
    starter: [28, 33],
    star: [30, 35],
    superstar: [31, 37],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 1,
  fullTimeFrom: 'fringe',
  declineFrom: 29,
};

/**
 * Boxing. Most professional boxers earn under $50,000 a year, an opponent's first fights pay a thousand
 * dollars or less, and the top of the sport is a handful of purses in the tens of millions. So the
 * bottom two tiers are a second job and the top one is not a number in any other sport's range.
 */
const BOXING_ECONOMY: SportEconomy = {
  pay: {
    fringe: 20_000,
    role: 90_000,
    starter: 400_000,
    star: 3_000_000,
    superstar: 30_000_000,
  },
  retireAge: {
    fringe: [28, 33],
    role: [30, 35],
    starter: [31, 36],
    star: [33, 38],
    superstar: [34, 40],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 1.5,
  fullTimeFrom: 'role',
  declineFrom: 31,
};

/**
 * MMA. The largest promotion pays a newcomer $12,000 to show and $12,000 to win, mid-level fighters
 * $50,000 to low six figures a fight, and champions about a million a fight or more. A year is two to
 * three fights, so the tiers run from a regional card up to a champion's share of the gate.
 */
const MMA_ECONOMY: SportEconomy = {
  pay: {
    fringe: 30_000,
    role: 110_000,
    starter: 350_000,
    star: 1_600_000,
    superstar: 8_000_000,
  },
  retireAge: {
    fringe: [27, 32],
    role: [29, 34],
    starter: [30, 35],
    star: [31, 36],
    superstar: [32, 38],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 1.6,
  fullTimeFrom: 'role',
  declineFrom: 31,
};

/**
 * The Olympic sports (ticket 0804). The IOC pays athletes nothing. Team USA pays a medalist $37,500 for gold,
 * $22,500 for silver and $15,000 for bronze (Operation Gold, unchanged for Paris 2024); most Olympians hold
 * another job, and training costs tens of thousands a year. So a stipend runs from a grant at the bottom to a
 * champion's sponsorship at the top, and the full-time living starts at `star`. The ladders below are a game
 * ladder: grants and a day job for the bottom three tiers, sponsors above.
 */
const TRACK_ECONOMY: SportEconomy = {
  pay: { fringe: 8_000, role: 25_000, starter: 50_000, star: 120_000, superstar: 400_000 },
  retireAge: {
    fringe: [26, 30],
    role: [28, 32],
    starter: [29, 33],
    star: [31, 35],
    superstar: [32, 37],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 1.0,
  fullTimeFrom: 'star',
  declineFrom: 29,
};

const SWIMMING_ECONOMY: SportEconomy = {
  pay: { fringe: 7_000, role: 22_000, starter: 45_000, star: 110_000, superstar: 350_000 },
  retireAge: {
    fringe: [23, 27],
    role: [25, 29],
    starter: [26, 30],
    star: [28, 32],
    superstar: [29, 34],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 0.7,
  fullTimeFrom: 'star',
  declineFrom: 26,
};

const GYMNASTICS_ECONOMY: SportEconomy = {
  pay: { fringe: 6_000, role: 20_000, starter: 40_000, star: 100_000, superstar: 300_000 },
  retireAge: {
    fringe: [19, 22],
    role: [20, 24],
    starter: [21, 25],
    star: [23, 27],
    superstar: [24, 28],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 1.5,
  fullTimeFrom: 'star',
  declineFrom: 21,
};

const WRESTLING_ECONOMY: SportEconomy = {
  pay: { fringe: 5_000, role: 15_000, starter: 30_000, star: 80_000, superstar: 220_000 },
  retireAge: {
    fringe: [25, 29],
    role: [27, 31],
    starter: [28, 32],
    star: [29, 33],
    superstar: [30, 35],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 1.4,
  fullTimeFrom: 'star',
  declineFrom: 28,
};

const OLYMPIC_BOXING_ECONOMY: SportEconomy = {
  pay: { fringe: 6_000, role: 18_000, starter: 35_000, star: 90_000, superstar: 250_000 },
  retireAge: {
    fringe: [23, 27],
    role: [25, 29],
    starter: [26, 30],
    star: [28, 32],
    superstar: [29, 34],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 1.3,
  fullTimeFrom: 'star',
  declineFrom: 27,
};

/** The training centers a national program sends its athletes to. Fictional. */
const OLYMPIC_CENTERS: readonly string[] = [
  'Lakeview Training Center',
  'High Plains Training Center',
  'Pacific Crest Athletic Center',
  'Redstone Performance Center',
  'Northern Pines Training Center',
  'Coastal Sports Institute',
  'Summit Ridge Training Center',
  'Ironwood Athletic Institute',
  'Silver Lake Training Center',
  'Cedar Valley Performance Center',
  'Harborview Training Center',
  'Prairie Gate Athletic Center',
];

const FIGHT_GYMS: readonly string[] = [
  'Ironbridge Fight Club',
  'Southside Athletic Club',
  'Harbor Street Gym',
  'Copperline Boxing',
  'Redwater Fight House',
  'Northgate Academy',
  'Stonefield Gym',
  'Eastside Ring',
  'Cedar Hill Athletic',
  'Union Yard Gym',
  'Brightline Training Center',
  'Fairmount Fight Club',
];

/**
 * Motor racing (ticket 0808). The pay is game judgement, anchored loosely: the bottom of the ladder is a seat the driver
 * helps pay for and a little money from the team; a premier-series driver is paid in the hundreds of thousands to
 * low millions; the top of a world championship is paid in the tens of millions (the best-paid drivers in the
 * sport's biggest series are reported at fifty to seventy million a year). A driver lasts: the body gives back
 * late, and the best last longest.
 */
const RACING_ECONOMY: SportEconomy = {
  pay: {
    fringe: 40_000,
    role: 150_000,
    starter: 600_000,
    star: 4_000_000,
    superstar: 25_000_000,
  },
  retireAge: {
    fringe: [27, 33],
    role: [30, 37],
    starter: [33, 41],
    star: [36, 45],
    superstar: [38, 47],
  },
  draftSize: 0,
  firstRound: 0,
  rookieTop: 0,
  injuryFactor: 1.4,
  fullTimeFrom: 'role',
  declineFrom: 36,
};

/** The teams that put a driver in a car. Fictional. */
const RACING_TEAMS: readonly string[] = [
  'Redline Motorsport',
  'Harlow Racing',
  'Northstar Competition',
  'Ironside Autosport',
  'Kestrel Racing Team',
  'Blackwater Motorsports',
  'Summit Speed',
  'Cobalt Racing',
  'Lakeshore Competition',
  'Vanguard Autosport',
  'Pinecrest Racing',
  'Meridian Works Team',
];

export const SPORTS: readonly Sport[] = [
  {
    id: 'basketball',
    format: 'team',
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
    format: 'team',
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
    format: 'team',
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
    format: 'team',
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
    format: 'team',
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
  {
    id: 'golf',
    format: 'tour',
    name: 'Golf',
    activityId: 'act.golf',
    noun: 'golf',
    league: 'Continental Golf Tour',
    leagueShort: 'CGT',
    playerTitle: 'Professional golfer',
    skills: [
      { id: 'driving', name: 'Driving' },
      { id: 'approach', name: 'Approach play' },
      { id: 'short-game', name: 'Short game' },
      { id: 'putting', name: 'Putting' },
      { id: 'course-management', name: 'Course management' },
    ],
    positions: [
      'Long hitter',
      'Precision player',
      'Short-game specialist',
      'Streaky putter',
      'Grinder',
    ],
    proTeams: [],
    collegeTeams: COLLEGE_TEAMS,
    economy: GOLF_ECONOMY,
  },
  {
    id: 'tennis',
    format: 'tour',
    name: 'Tennis',
    activityId: 'act.tennis',
    noun: 'tennis',
    league: 'World Tennis Circuit',
    leagueShort: 'WTC',
    playerTitle: 'Professional tennis player',
    skills: [
      { id: 'serve', name: 'Serve' },
      { id: 'forehand', name: 'Forehand' },
      { id: 'backhand', name: 'Backhand' },
      { id: 'movement', name: 'Movement' },
      { id: 'mental-game', name: 'Mental game' },
    ],
    positions: [
      'Baseliner',
      'Serve-and-volleyer',
      'All-court player',
      'Counterpuncher',
      'Big server',
    ],
    proTeams: [],
    collegeTeams: COLLEGE_TEAMS,
    economy: TENNIS_ECONOMY,
  },
  {
    id: 'boxing',
    format: 'combat',
    name: 'Boxing',
    activityId: '',
    noun: 'boxing',
    league: 'Atlantic Boxing Federation',
    leagueShort: 'ABF',
    playerTitle: 'Professional boxer',
    skills: [
      { id: 'striking', name: 'Striking' },
      { id: 'defense', name: 'Defense' },
      { id: 'conditioning', name: 'Conditioning' },
      { id: 'power', name: 'Power' },
      { id: 'ring-iq', name: 'Ring IQ' },
    ],
    positions: [
      'Featherweight',
      'Lightweight',
      'Welterweight',
      'Middleweight',
      'Light heavyweight',
      'Heavyweight',
    ],
    proTeams: FIGHT_GYMS,
    collegeTeams: [],
    economy: BOXING_ECONOMY,
  },
  {
    id: 'mma',
    format: 'combat',
    name: 'MMA',
    activityId: '',
    noun: 'MMA',
    league: 'Ironcage Fighting League',
    leagueShort: 'IFL',
    playerTitle: 'Professional MMA fighter',
    skills: [
      { id: 'striking', name: 'Striking' },
      { id: 'wrestling', name: 'Wrestling' },
      { id: 'grappling', name: 'Grappling' },
      { id: 'conditioning', name: 'Conditioning' },
    ],
    positions: [
      'Flyweight',
      'Lightweight',
      'Welterweight',
      'Middleweight',
      'Light heavyweight',
      'Heavyweight',
    ],
    proTeams: FIGHT_GYMS,
    collegeTeams: [],
    economy: MMA_ECONOMY,
  },
  {
    id: 'track',
    format: 'olympic',
    name: 'Track and field',
    activityId: '',
    noun: 'track and field',
    league: 'National Track Federation',
    leagueShort: 'NTF',
    playerTitle: 'Olympic track athlete',
    skills: [
      { id: 'start', name: 'Start' },
      { id: 'speed', name: 'Speed' },
      { id: 'endurance', name: 'Endurance' },
      { id: 'technique', name: 'Technique' },
      { id: 'tactics', name: 'Race tactics' },
    ],
    positions: [
      'Sprinter',
      'Hurdler',
      'Middle-distance runner',
      'Distance runner',
      'Jumper',
      'Thrower',
    ],
    proTeams: OLYMPIC_CENTERS,
    collegeTeams: [],
    economy: TRACK_ECONOMY,
  },
  {
    id: 'swimming',
    format: 'olympic',
    name: 'Swimming',
    activityId: '',
    noun: 'swimming',
    league: 'National Aquatics Federation',
    leagueShort: 'NAF',
    playerTitle: 'Olympic swimmer',
    skills: [
      { id: 'starts', name: 'Starts and turns' },
      { id: 'stroke', name: 'Stroke' },
      { id: 'endurance', name: 'Endurance' },
      { id: 'speed', name: 'Speed' },
      { id: 'pacing', name: 'Pacing' },
    ],
    positions: [
      'Freestyler',
      'Backstroker',
      'Breaststroker',
      'Butterflyer',
      'Medley swimmer',
      'Distance swimmer',
    ],
    proTeams: OLYMPIC_CENTERS,
    collegeTeams: [],
    economy: SWIMMING_ECONOMY,
  },
  {
    id: 'gymnastics',
    format: 'olympic',
    name: 'Gymnastics',
    activityId: '',
    noun: 'gymnastics',
    league: 'National Gymnastics Federation',
    leagueShort: 'NGF',
    playerTitle: 'Olympic gymnast',
    skills: [
      { id: 'strength', name: 'Strength' },
      { id: 'balance', name: 'Balance' },
      { id: 'flexibility', name: 'Flexibility' },
      { id: 'air', name: 'Air awareness' },
      { id: 'nerve', name: 'Nerve' },
    ],
    positions: [
      'All-around gymnast',
      'Floor and vault specialist',
      'Bars and beam specialist',
      'Rings and pommel specialist',
    ],
    proTeams: OLYMPIC_CENTERS,
    collegeTeams: [],
    economy: GYMNASTICS_ECONOMY,
  },
  {
    id: 'wrestling',
    format: 'olympic',
    name: 'Wrestling',
    activityId: '',
    noun: 'wrestling',
    league: 'National Wrestling Federation',
    leagueShort: 'NWF',
    playerTitle: 'Olympic wrestler',
    skills: [
      { id: 'takedowns', name: 'Takedowns' },
      { id: 'control', name: 'Control' },
      { id: 'balance', name: 'Balance' },
      { id: 'conditioning', name: 'Conditioning' },
      { id: 'mat-sense', name: 'Mat sense' },
    ],
    positions: ['Freestyle wrestler', 'Greco-Roman wrestler'],
    proTeams: OLYMPIC_CENTERS,
    collegeTeams: [],
    economy: WRESTLING_ECONOMY,
  },
  {
    id: 'olympic-boxing',
    format: 'olympic',
    name: 'Amateur boxing',
    activityId: '',
    noun: 'amateur boxing',
    league: 'Amateur Boxing Union',
    leagueShort: 'ABU',
    playerTitle: 'Olympic boxer',
    skills: [
      { id: 'striking', name: 'Striking' },
      { id: 'defense', name: 'Defense' },
      { id: 'footwork', name: 'Footwork' },
      { id: 'conditioning', name: 'Conditioning' },
      { id: 'ring-iq', name: 'Ring IQ' },
    ],
    positions: ['Light boxer', 'Welter boxer', 'Middle boxer', 'Heavy boxer'],
    proTeams: OLYMPIC_CENTERS,
    collegeTeams: [],
    economy: OLYMPIC_BOXING_ECONOMY,
  },
  {
    id: 'racing',
    format: 'racing',
    name: 'Motor racing',
    activityId: '',
    noun: 'racing',
    league: 'Apex Racing Series',
    leagueShort: 'ARS',
    playerTitle: 'Professional driver',
    skills: [
      { id: 'racecraft', name: 'Racecraft' },
      { id: 'pace', name: 'Qualifying pace' },
      { id: 'tires', name: 'Tire management' },
      { id: 'consistency', name: 'Consistency' },
      { id: 'feedback', name: 'Feedback to engineers' },
    ],
    positions: ['Open-wheel driver', 'Stock car driver', 'Sports car driver', 'Touring car driver'],
    proTeams: RACING_TEAMS,
    collegeTeams: [],
    economy: RACING_ECONOMY,
  },
];

const SPORTS_BY_ID = new Map(SPORTS.map((sport) => [sport.id, sport]));

export const findSport = (id: string): Sport | undefined => SPORTS_BY_ID.get(id as SportId);

/** Every sport with a roster, a draft and a contract: the first five rows. */
export const TEAM_SPORTS: readonly Sport[] = SPORTS.filter((sport) => sport.format === 'team');

/** Golf and tennis: a school team, a scholarship, and a tour. */
export const TOUR_SPORTS: readonly Sport[] = SPORTS.filter((sport) => sport.format === 'tour');

/** Boxing and MMA: no school team; the road runs through a martial art. */
export const COMBAT_SPORTS: readonly Sport[] = SPORTS.filter((sport) => sport.format === 'combat');

/** Track and field, swimming, gymnastics, wrestling and amateur boxing: a national program and the Games (ticket 0804). */
export const OLYMPIC_SPORTS: readonly Sport[] = SPORTS.filter(
  (sport) => sport.format === 'olympic',
);

/** Motor racing (ticket 0808): karting from eight, a seat, a series. */
export const RACING_SPORTS: readonly Sport[] = SPORTS.filter((sport) => sport.format === 'racing');

/** The sport a school activity is the first rung of, if any. */
export const sportOfActivity = (activityId: string): Sport | undefined =>
  activityId === '' ? undefined : SPORTS.find((sport) => sport.activityId === activityId);

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

/* -------------------------------------------------------------------------- */
/* Martial arts (ticket 0803)                                                  */
/* -------------------------------------------------------------------------- */

/** Payton, 7 October 2026: a child can start from about ten. */
export const MARTIAL_ART_MIN_AGE = 10;

/** Hours are the limit in life; the game says two at a time. */
export const MAX_ARTS_AT_ONCE = 2;

/** A beginner is not nothing, and not good. */
export const ART_START_LEVEL = 20;

/**
 * The road to a fight career. Nobody is signed before eighteen (Payton), and a fighter who has not
 * turned pro by thirty is not going to; an art must have been studied for at least three seasons
 * before it counts as a base.
 */
export const TURN_PRO_MIN_AGE = 18;
export const TURN_PRO_MAX_AGE = 30;
export const MIN_ART_SEASONS = 3;

/** Striking and grappling feed MMA; `athletic` is an Olympic discipline that is not a martial art (ticket 0804). */
export type ArtStyle = 'striking' | 'grappling' | 'athletic' | 'driving';

export interface MartialArt {
  readonly id: string;
  readonly name: string;
  readonly style: ArtStyle;
  /** One line, for the Mind & Body row. */
  readonly blurb: string;
  /** What a year costs an adult, whole dollars. A child's lessons are paid by the household and not billed. */
  readonly annualCost: number;
  readonly costSource: string;
  /** The careers it counts towards: boxing for boxing, any of them for MMA. */
  readonly feeds: readonly SportId[];
  /** The youngest a child can start (ticket 0808). Default `MARTIAL_ART_MIN_AGE`; karting takes children of eight. */
  readonly minAge?: number;
  /** Four things it builds, for the screen. Spec 377: nothing here depends on who teaches it. */
  readonly skills: readonly SportSkill[];
  readonly startLine: string;
  readonly stopLine: string;
}

/**
 * Six arts (Payton, 7 October 2026). Wrestling here is the art, and the competitive career is an
 * Olympic discipline for 0804; Judo is not listed (spec 379).
 */
export const MARTIAL_ARTS: readonly MartialArt[] = [
  {
    id: 'boxing',
    name: 'Boxing',
    style: 'striking',
    blurb: 'A heavy bag, a jump rope and a coach who counts.',
    annualCost: 900,
    costSource: 'gym dues and hand wraps',
    feeds: ['boxing', 'mma', 'olympic-boxing'],
    skills: [
      { id: 'striking', name: 'Striking' },
      { id: 'defense', name: 'Defense' },
      { id: 'conditioning', name: 'Conditioning' },
      { id: 'power', name: 'Power' },
    ],
    startLine: 'Started boxing. The first month was mostly the jump rope.',
    stopLine: 'Stopped going to the boxing gym.',
  },
  {
    id: 'muay-thai',
    name: 'Muay Thai',
    style: 'striking',
    blurb: 'Elbows, knees and shins, and a lot of pad work.',
    annualCost: 1_300,
    costSource: 'Muay Thai gym dues and shin guards',
    feeds: ['mma'],
    skills: [
      { id: 'striking', name: 'Striking' },
      { id: 'clinch', name: 'Clinch' },
      { id: 'conditioning', name: 'Conditioning' },
      { id: 'power', name: 'Power' },
    ],
    startLine: 'Started Muay Thai. Your shins hurt for a week.',
    stopLine: 'Stopped going to Muay Thai.',
  },
  {
    id: 'bjj',
    name: 'Brazilian jiu-jitsu',
    style: 'grappling',
    blurb: 'Belts the hard way, one tap at a time.',
    annualCost: 1_500,
    costSource: 'jiu-jitsu academy dues and a gi',
    feeds: ['mma'],
    skills: [
      { id: 'grappling', name: 'Grappling' },
      { id: 'escapes', name: 'Escapes' },
      { id: 'submissions', name: 'Submissions' },
      { id: 'conditioning', name: 'Conditioning' },
    ],
    startLine: 'Started Brazilian jiu-jitsu. You tapped a lot.',
    stopLine: 'Stopped going to jiu-jitsu. The gi is still in the bag.',
  },
  {
    id: 'wrestling',
    name: 'Wrestling',
    style: 'grappling',
    blurb: 'Takedowns and a mat that smells like a mat.',
    annualCost: 500,
    costSource: 'a wrestling club and shoes',
    feeds: ['mma', 'wrestling'],
    skills: [
      { id: 'takedowns', name: 'Takedowns' },
      { id: 'control', name: 'Control' },
      { id: 'balance', name: 'Balance' },
      { id: 'conditioning', name: 'Conditioning' },
    ],
    startLine: 'Started wrestling. Everyone on the mat was stronger than they looked.',
    stopLine: 'Stopped wrestling.',
  },
  {
    id: 'karate',
    name: 'Karate',
    style: 'striking',
    blurb: 'Katas, sparring and a belt for every year.',
    annualCost: 1_100,
    costSource: 'dojo dues and a uniform',
    feeds: ['mma'],
    skills: [
      { id: 'striking', name: 'Striking' },
      { id: 'kata', name: 'Form' },
      { id: 'speed', name: 'Speed' },
      { id: 'conditioning', name: 'Conditioning' },
    ],
    startLine: 'Started karate. The first belt is white and it means nothing.',
    stopLine: 'Left the dojo.',
  },
  {
    id: 'taekwondo',
    name: 'Taekwondo',
    style: 'striking',
    blurb: 'Kicks, speed and a very clean uniform.',
    annualCost: 1_100,
    costSource: 'taekwondo school dues and sparring gear',
    feeds: ['mma'],
    skills: [
      { id: 'striking', name: 'Striking' },
      { id: 'kicks', name: 'Kicking' },
      { id: 'speed', name: 'Speed' },
      { id: 'conditioning', name: 'Conditioning' },
    ],
    startLine: 'Started taekwondo. Your kicks were slow, then they weren’t.',
    stopLine: 'Left the taekwondo school.',
  },
];

/**
 * The three Olympic disciplines that are not martial arts (ticket 0804). They are studied the same way: from
 * ten, two at a time, three sessions a year, a level that is readable only while it is studied, and three
 * seasons before it counts. Wrestling and boxing are already arts above, and feed the Olympic wrestling and
 * boxing programs too.
 */
export const OLYMPIC_DISCIPLINES: readonly MartialArt[] = [
  {
    id: 'track',
    name: 'Track and field',
    style: 'athletic',
    blurb: 'Early mornings, a stopwatch and a lot of laps.',
    annualCost: 400,
    costSource: 'track club dues and spikes',
    feeds: ['track'],
    skills: [
      { id: 'start', name: 'Start' },
      { id: 'speed', name: 'Speed' },
      { id: 'endurance', name: 'Endurance' },
      { id: 'technique', name: 'Technique' },
    ],
    startLine: 'Joined a track club. Your first race was a blur.',
    stopLine: 'Hung up the spikes.',
  },
  {
    id: 'swimming',
    name: 'Swimming',
    style: 'athletic',
    blurb: 'Black lines, chlorine and the 5 a.m. alarm.',
    annualCost: 1_200,
    costSource: 'swim club dues and suits',
    feeds: ['swimming'],
    skills: [
      { id: 'starts', name: 'Starts and turns' },
      { id: 'stroke', name: 'Stroke' },
      { id: 'endurance', name: 'Endurance' },
      { id: 'speed', name: 'Speed' },
    ],
    startLine: 'Joined a swim club. Your goggles never fit.',
    stopLine: 'Got out of the pool for good.',
  },
  {
    id: 'gymnastics',
    name: 'Gymnastics',
    style: 'athletic',
    blurb: 'Chalk, beams and a body that learns to fall.',
    annualCost: 2_400,
    costSource: 'gym club dues, leotards and travel to meets',
    feeds: ['gymnastics'],
    skills: [
      { id: 'strength', name: 'Strength' },
      { id: 'balance', name: 'Balance' },
      { id: 'flexibility', name: 'Flexibility' },
      { id: 'nerve', name: 'Nerve' },
    ],
    startLine: 'Started gymnastics. The beam is narrower than it looks.',
    stopLine: 'Left the gym for the last time.',
  },
];

/**
 * Karting (ticket 0808), the one thing studied for a racing career. It is studied the same way as an art (two at a
 * time, three sessions a year, three seasons before it counts) but a child can start at eight, which is how drivers
 * really begin. A new array and a combined lookup, not an edit to the old two (CORE_RULES 13.148).
 */
export const RACING_STUDIES: readonly MartialArt[] = [
  {
    id: 'karting',
    name: 'Karting',
    style: 'driving',
    blurb: 'A rented kart, a cold track and a lot of lap times.',
    annualCost: 6_000,
    costSource: 'kart rental, tires and track days',
    feeds: ['racing'],
    minAge: 8,
    skills: [
      { id: 'racecraft', name: 'Racecraft' },
      { id: 'pace', name: 'Pace' },
      { id: 'tires', name: 'Tire care' },
      { id: 'consistency', name: 'Consistency' },
    ],
    startLine: 'Started karting. You were last on the first day.',
    stopLine: 'Parked the kart for good.',
  },
];

/** Everything a student can study: the six arts, the three disciplines and karting. */
export const STUDIES: readonly MartialArt[] = [
  ...MARTIAL_ARTS,
  ...OLYMPIC_DISCIPLINES,
  ...RACING_STUDIES,
];

const ARTS_BY_ID = new Map(STUDIES.map((art) => [art.id, art]));

export const findMartialArt = (id: string): MartialArt | undefined => ARTS_BY_ID.get(id);

export interface ArtProgress {
  readonly artId: string;
  readonly level: number;
  readonly seasons: number;
}

/**
 * Which fight career a set of studied arts is a base for, and how good the fighter is at the start.
 *
 *   boxing  needs boxing, three seasons in, and starts at that level
 *   mma     needs a striking art AND a grappling art, three seasons each, and starts at their average
 *
 * When both are available the better start wins, and a tie goes to MMA, which is the harder road.
 * Pure, so it can be read by a screen that wants to say what a student is working towards.
 */
export function fightCareerFor(
  arts: readonly ArtProgress[],
): { readonly sportId: 'boxing' | 'mma'; readonly form: number } | undefined {
  const ready = arts.filter((row) => row.seasons >= MIN_ART_SEASONS);
  const best = (style: ArtStyle): number | undefined => {
    const levels = ready
      .filter((row) => findMartialArt(row.artId)?.style === style)
      .map((row) => row.level);
    return levels.length > 0 ? Math.max(...levels) : undefined;
  };
  const boxer = ready.find((row) => row.artId === 'boxing')?.level;
  const striker = best('striking');
  const grappler = best('grappling');
  const mma =
    striker !== undefined && grappler !== undefined
      ? Math.round((striker + grappler) / 2)
      : undefined;
  if (mma !== undefined && (boxer === undefined || mma >= boxer)) {
    return { sportId: 'mma', form: mma };
  }
  if (boxer !== undefined) return { sportId: 'boxing', form: boxer };
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Individual sports: a tour and a fight card (ticket 0803)                    */
/* -------------------------------------------------------------------------- */

/**
 * Nobody on a tour or a fight card is promoted by a table. A season's results move a player up or
 * down, and nothing caps how far: a player who keeps matching the field above them keeps rising.
 *
 * `FIELD_STRENGTH` is how good the people a player meets at a tier are, on the same 0–100 scale as
 * a player's form.
 */
export const FIELD_STRENGTH: Readonly<Record<SportTier, number>> = {
  fringe: 42,
  role: 53,
  starter: 64,
  star: 78,
  superstar: 92,
};

/**
 * How far work can take an individual player above what they are naturally like. The school model
 * lets three sessions a year carry anybody towards 100, which is right for a standing within a
 * squad and wrong for a place in the world: measured on the first build, every player who trained
 * was a superstar by twenty-five. Talent is worth more than work (16 points against this) and work
 * is worth more than nothing, which is the order of the odds table. Individual sports only; a team
 * player's practice is unchanged from 0801.
 */
export const TRAINING_CAP = 7;

/**
 * A season's PERFORMANCE is a player's form plus what luck did that year, on the same 0–100 scale
 * as the fields. A tour player's luck is a draw (`TOUR_NOISE` wide); a fighter's is how far their
 * actual fights ran ahead of or behind what their form said they should win (`FIGHT_LUCK` a win).
 * The rung a player is on moves one step a year towards the highest tier whose field they matched,
 * so a run of luck lifts a player a little and a run of the other kind drops them a little, and
 * what holds them in place is how good they are.
 */
export const TOUR_NOISE = 24;
export const FIGHT_LUCK = 10;

/** Below the fringe field by this much, a player loses a tour card or a gym's booking. */
export const OUT_MARGIN = 9;

/** The highest tier a season's performance matched, or `undefined` below the fringe (and under it by `OUT_MARGIN`: out). */
export function tierForPerformance(performance: number): SportTier {
  let found: SportTier = 'fringe';
  for (const tier of ['role', 'starter', 'star', 'superstar'] as const) {
    if (performance >= FIELD_STRENGTH[tier]) found = tier;
  }
  return found;
}

export const isOut = (performance: number): boolean =>
  performance < FIELD_STRENGTH.fringe - OUT_MARGIN;

/** The chance of winning a tour event in a season, by tier. Golf and tennis both. */
export const TOUR_TITLE_CHANCE: Readonly<Record<SportTier, number>> = {
  fringe: 0,
  role: 0.02,
  starter: 0.08,
  star: 0.22,
  superstar: 0.45,
};

/** Of a year's purse: the spread an ordinary year has either side of the tier's figure. */
export const PURSE_SPREAD: readonly [number, number] = [0.75, 1.25];

/** A tour title adds this share of the tier's year to the purse. */
export const TITLE_PURSE_SHARE = 0.25;

/** A season missed to a serious injury still pays this share of the year. */
export const MISSED_SEASON_PURSE = 0.25;

/** The world rank a tier sits in, for a tour sport. A band, not a point: the rank moves within it by year. */
export const WORLD_RANK_BAND: Readonly<Record<SportTier, readonly [number, number]>> = {
  superstar: [1, 3],
  star: [4, 15],
  starter: [16, 60],
  role: [61, 140],
  fringe: [141, 300],
};

/** Fights in a year, by sport and tier. A club fighter fights more; a champion fights less and is paid for it. */
export const FIGHTS_PER_YEAR: Readonly<
  Record<'boxing' | 'mma', Readonly<Record<SportTier, number>>>
> = {
  boxing: { fringe: 4, role: 3, starter: 3, star: 2, superstar: 2 },
  mma: { fringe: 2, role: 2, starter: 3, star: 3, superstar: 2 },
};

/** The spread of the people a fighter faces around the tier's strength, and how sharply form decides it. */
export const OPPONENT_SPREAD = 16;
export const FIGHT_SCALE = 9;

/**
 * The chance of winning a fight: form against an opponent at this tier, from a unit that decides how
 * good the opponent is. Decided by skill and nothing else: no number here is a player's choice and
 * there is no minigame (the ticket's brief).
 */
export function fightWinChance(form: number, tier: SportTier, opponentUnit: number): number {
  const opponent = FIELD_STRENGTH[tier] + (opponentUnit - 0.5) * OPPONENT_SPREAD;
  return 1 / (1 + Math.exp(-(form - opponent) / FIGHT_SCALE));
}

/** A world rank within a tier's band, from a unit. Higher tiers are lower numbers. */
export const worldRankFor = (tier: SportTier, unit: number): number =>
  between(unit, WORLD_RANK_BAND[tier]);

/* -------------------------------------------------------------------------- */
/* The Olympic sports (ticket 0804)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Five groups, not five simulators (spec 379): track and field, swimming, gymnastics, wrestling and
 * amateur boxing. No judo, and no winter events, weightlifting or rotating slot (Payton, 7 October 2026).
 * A life studies a discipline from ten; once three seasons are in and a draw says so, the national
 * program offers a place. From there a season is a tour's: results move a rung, and every fourth year
 * the Games decide who is a medalist.
 */

/** Ages a national program takes an athlete: gymnastics and swimming peak early, track and boxing do not. */
export const OLYMPIC_WINDOW: Readonly<
  Record<
    'track' | 'swimming' | 'gymnastics' | 'wrestling' | 'olympic-boxing',
    readonly [number, number]
  >
> = {
  track: [16, 30],
  swimming: [16, 26],
  gymnastics: [16, 22],
  wrestling: [18, 30],
  'olympic-boxing': [18, 30],
};

/**
 * Getting a place in a national program, by who the life is: a lower table than the pros', because a
 * place is only the start and the Games are the filter (Payton's 95/75/60/3 is the team-sport table).
 * One draw for the life per sport, a moving threshold, as everywhere in v0.08.
 */
export const REACH_NATIONAL: Readonly<Record<SportCategory, number>> = {
  talentAndWork: 0.5,
  talentOnly: 0.3,
  workOnly: 0.2,
  neither: 0.01,
};

/** The Games are every fourth year, summer ones only (no winter events in this build). */
export const GAMES_EVERY = 4;
export const isGamesYear = (year: number): boolean => year % GAMES_EVERY === 0;

/** At the Games a performance is form, a season's luck, and one more draw this wide. */
export const GAMES_NOISE = 16;

export type Medal = 'gold' | 'silver' | 'bronze';

/** The performance a medal takes. Above the highest field is gold, at the second highest silver. */
export const MEDAL_LINE: Readonly<Record<Medal, number>> = {
  gold: 98,
  silver: 92,
  bronze: 86,
};

/** A finalist is an Olympian who did not medal. */
export const FINAL_LINE = 62;

/** The lowest tier the national team picks for the Games. Below it the athlete is an alternate who watches. */
export const GAMES_TEAM_TIER: SportTier = 'role';

export const medalFor = (gamesPerformance: number): Medal | undefined => {
  if (gamesPerformance >= MEDAL_LINE.gold) return 'gold';
  if (gamesPerformance >= MEDAL_LINE.silver) return 'silver';
  if (gamesPerformance >= MEDAL_LINE.bronze) return 'bronze';
  return undefined;
};

/** Team USA's Operation Gold, unchanged for Paris 2024 (the US Olympic and Paralympic Committee). */
export const MEDAL_PRIZE: Readonly<Record<Medal, number>> = {
  gold: 37_500,
  silver: 22_500,
  bronze: 15_000,
};

/** What a medal does to a name: the sponsors. A judgement; the prize above is real and small. */
export const MEDAL_SPONSORSHIP: Readonly<Record<Medal, number>> = {
  gold: 250_000,
  silver: 100_000,
  bronze: 40_000,
};

export const MEDAL_WORDS: Readonly<Record<Medal, string>> = {
  gold: 'gold',
  silver: 'silver',
  bronze: 'bronze',
};

/**
 * Which Olympic sports a set of studied arts is a base for, best first. A sport needs one of the arts or
 * disciplines that feed it, three seasons in; the form is that art's level.
 */
export function olympicCareersFor(
  arts: readonly ArtProgress[],
): readonly { readonly sportId: SportId; readonly form: number }[] {
  const ready = arts.filter((row) => row.seasons >= MIN_ART_SEASONS);
  const found: { sportId: SportId; form: number }[] = [];
  for (const sport of OLYMPIC_SPORTS) {
    const levels = ready
      .filter((row) => findMartialArt(row.artId)?.feeds.includes(sport.id))
      .map((row) => row.level);
    if (levels.length > 0) found.push({ sportId: sport.id, form: Math.max(...levels) });
  }
  return found.sort((a, b) => b.form - a.form);
}

/* -------------------------------------------------------------------------- */
/* Motor racing (ticket 0808)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A seat is offered, not applied for. Karting is studied from eight; once three seasons are in and a draw says so, a
 * team puts the driver in a car. The ages are a window: a driver who has not been seen by thirty is not going to be.
 */
export const RACING_WINDOW: readonly [number, number] = [16, 30];

/**
 * Who gets a seat, one draw per life against these. LOWER than the table for a fight card or a tour: seats are
 * bought as much as won, and the road is the narrowest of the individual sports. This is game judgement; the
 * ticket document measures what it makes (the share who ever hold a seat, and how many reach the top two rungs).
 */
export const REACH_SEAT: Readonly<Record<SportCategory, number>> = {
  talentAndWork: 0.35,
  talentOnly: 0.18,
  workOnly: 0.12,
  neither: 0.005,
};

/** The chance of winning a championship in a season, by tier. A title needs a healthy season. */
export const RACING_TITLE_CHANCE: Readonly<Record<SportTier, number>> = {
  fringe: 0,
  role: 0.03,
  starter: 0.09,
  star: 0.22,
  superstar: 0.4,
};

/** Where a driver finishes the championship, by tier: a band, moved within by the year, one place for a title. */
export const RACING_PLACE_BAND: Readonly<Record<SportTier, readonly [number, number]>> = {
  superstar: [1, 3],
  star: [2, 6],
  starter: [4, 11],
  role: [7, 16],
  fringe: [11, 24],
};

/** A season's luck on the scale of the fields: a car breaks, a safety car falls right. A touch wider than a tour's. */
export const RACING_NOISE = 26;

/* -------------------------------------------------------------------------- */
/* After the playing: coaching and commentary (ticket 0804)                    */
/* -------------------------------------------------------------------------- */

/**
 * Spec: post-career options include college, pro and overseas coaching and commentary, and a strong
 * prior career improves access. Sources: the median coach or scout earns $47,320 (BLS, 2025) and
 * about 298,800 hold the job; the median broadcast announcer earns about $47,340 (BLS, May 2025), and
 * there is no wage series for sports commentary alone. The ladder above those two numbers is a game ladder.
 */
export type PostKind = 'coach' | 'commentary';
export type PostLevel = 'college' | 'overseas' | 'pro' | 'local' | 'national';

export interface PostJobRow {
  readonly kind: PostKind;
  readonly level: PostLevel;
  /** Gross, a year, at the start. */
  readonly pay: number;
  /** A living that ends a day job, or something done beside one. */
  readonly fullTime: boolean;
  /** For the offer: "a college {sport} coach". */
  readonly words: string;
}

export const POST_JOBS: Readonly<Record<PostLevel, PostJobRow>> = {
  college: { kind: 'coach', level: 'college', pay: 55_000, fullTime: true, words: 'college coach' },
  overseas: {
    kind: 'coach',
    level: 'overseas',
    pay: 95_000,
    fullTime: true,
    words: 'overseas coach',
  },
  pro: { kind: 'coach', level: 'pro', pay: 160_000, fullTime: true, words: 'pro coach' },
  local: {
    kind: 'commentary',
    level: 'local',
    pay: 48_000,
    fullTime: false,
    words: 'local commentator',
  },
  national: {
    kind: 'commentary',
    level: 'national',
    pay: 240_000,
    fullTime: true,
    words: 'national analyst',
  },
};

/** A post pays a little more every year in it, to this multiple of where it started. */
export const POST_RAISE = 0.03;
export const POST_RAISE_CAP = 1.6;
export const POST_END_AGE = 68;
/** Nobody is offered a post after this age: the offer is for the years just after the playing. */
export const POST_OFFER_MAX_AGE = 62;

export interface PastQuality {
  readonly reached: 'school' | 'college' | 'pro';
  readonly bestTier?: SportTier;
  readonly titles: number;
  readonly seasons: number;
}

/** How good a past career was, for choosing the one a post follows. */
export function pastScore(past: PastQuality): number {
  const tier = past.bestTier === undefined ? 0 : (tierIndex(past.bestTier) + 1) * 10;
  return (
    tier + past.titles * 2 + Math.min(10, past.seasons) / 10 + (past.reached === 'pro' ? 5 : 0)
  );
}

/** The best coaching job and the best commentary job a past career opens, if any. */
export function postLevelsFor(past: PastQuality): {
  readonly coach?: PostLevel;
  readonly commentary?: PostLevel;
} {
  const pro = past.reached === 'pro';
  const rank = past.bestTier === undefined ? -1 : tierIndex(past.bestTier);
  const college = past.reached !== 'school' && past.seasons >= 3;
  let coach: PostLevel | undefined;
  if (pro && (rank >= 2 || past.titles >= 3)) coach = 'pro';
  else if (pro && rank >= 1) coach = 'overseas';
  else if (college || pro) coach = 'college';
  let commentary: PostLevel | undefined;
  if (pro && (rank >= 3 || past.titles >= 3)) commentary = 'national';
  else if (pro || college) commentary = 'local';
  return {
    ...(coach ? { coach } : {}),
    ...(commentary ? { commentary } : {}),
  };
}

/**
 * The chance that a post is offered at all: one draw for the life, against this. A fringe pro gets one a
 * little more than one time in ten; a superstar nine times in ten. Titles and medals count.
 */
export function postChance(past: PastQuality): number {
  const rank = past.bestTier === undefined ? 0 : tierIndex(past.bestTier);
  const base = past.reached === 'pro' ? 0.12 + 0.14 * rank : 0.08;
  return Math.min(0.92, base + 0.03 * Math.min(8, past.titles));
}

/** The pay of a post after some years in it. */
export const postPay = (level: PostLevel, seasons: number): number =>
  Math.round(POST_JOBS[level].pay * Math.min(POST_RAISE_CAP, 1 + POST_RAISE * seasons));
