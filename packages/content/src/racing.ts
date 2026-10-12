/**
 * Ticket 0808 — the Racing Team business: a ladder of five series, what each costs to run, what it pays, and how a
 * season is decided.
 *
 * A racing team is the one business here whose year is a SEASON, not a till. The numbers below are the dials. The real
 * anchors are few, old and approximate, and are written beside the rows; everything else is game judgement and the
 * ticket document says so:
 *
 *   - an entry-level open-wheel season costs about $200,000 and a step up to Formula 3 or Indy Lights more than half a
 *     million (a 2013 industry report); a sports-car team runs about $1 million a season (2015); an IndyCar costs
 *     $3 million to $8 million a car (2016); a NASCAR Cup car about $20 million a season before the driver (a team
 *     owner, 2024). Formula 1's budget cap is in the hundreds of millions for two cars.
 *   - the Indy 500's prize fund has run about $13 million with the winner taking about $2 million, and a top-22
 *     team in IndyCar's Leader's Circle program has been paid $1 million for each full-time entry.
 *   - sponsorship is the largest single line in a team's revenue, several times what the prize money earns in a year
 *     with several wins.
 *
 * Every draw a season makes is a hash (`mixedUnit`), so no RNG stream is touched and a life that owns no team
 * replays exactly as it did before this ticket.
 */

/** The id of the catalog row. Restated here so the engine does not match on a name. */
export const RACING_TEAM_TYPE_ID = 'biz.racing';

export type SeriesRung = 1 | 2 | 3 | 4 | 5;

export const SERIES_RUNGS: readonly SeriesRung[] = [1, 2, 3, 4, 5];

export interface SeriesRow {
  readonly rung: SeriesRung;
  /** What the level is called in a sentence: "club racing". */
  readonly words: string;
  /** The championship, fictional. */
  readonly series: string;
  /** Cars on the grid, the denominator of a finishing place. */
  readonly field: number;
  /** How good the field is on the same 0–100 scale as a driver's skill. */
  readonly strength: number;
  /** A season's running cost: tires, parts, entry fees, travel, whole dollars. */
  readonly budget: number;
  /** The crew's year at medium pay. */
  readonly crew: number;
  /** The prize fund a team can win a share of. */
  readonly purse: number;
  /** What sponsors pay a middling team in a middling year. */
  readonly sponsor: number;
  /** A hired driver's year at a skill of 50. */
  readonly driverPay: number;
  /** What it costs to move up INTO this rung: the car, the hauler, the spares. The first rung costs nothing. */
  readonly upgrade: number;
}

export const SERIES: Readonly<Record<SeriesRung, SeriesRow>> = {
  1: {
    rung: 1,
    words: 'club racing',
    series: 'Coastline Club Racing',
    field: 24,
    strength: 40,
    budget: 38_000,
    crew: 14_000,
    purse: 18_000,
    sponsor: 70_000,
    driverPay: 14_000,
    upgrade: 0,
  },
  2: {
    rung: 2,
    words: 'junior formula',
    series: 'Atlas Junior Formula',
    field: 20,
    strength: 50,
    // The anchor: an entry-level open-wheel season, about $200,000.
    budget: 190_000,
    crew: 60_000,
    purse: 70_000,
    sponsor: 340_000,
    driverPay: 50_000,
    upgrade: 90_000,
  },
  3: {
    rung: 3,
    words: 'national sports-car racing',
    series: 'Continental GT Series',
    field: 18,
    strength: 60,
    // The anchor: a sports-car team, about $1 million a season.
    budget: 800_000,
    crew: 220_000,
    purse: 260_000,
    sponsor: 1_390_000,
    driverPay: 160_000,
    upgrade: 400_000,
  },
  4: {
    rung: 4,
    words: 'premier open-wheel racing',
    series: 'Meridian Premier Series',
    field: 26,
    strength: 70,
    // The anchor: an IndyCar, $3–8 million a car; the purse is on the scale of a premier series' fund.
    budget: 4_200_000,
    crew: 900_000,
    purse: 1_500_000,
    sponsor: 7_400_000,
    driverPay: 800_000,
    upgrade: 2_200_000,
  },
  5: {
    rung: 5,
    words: 'world championship racing',
    series: 'Global Grand Prix',
    field: 20,
    strength: 82,
    // The anchor: a NASCAR Cup car, about $20 million a season before the driver.
    budget: 21_000_000,
    crew: 3_800_000,
    purse: 7_000_000,
    sponsor: 39_000_000,
    driverPay: 4_500_000,
    upgrade: 12_000_000,
  },
};

export const seriesOf = (rung: SeriesRung): SeriesRow => SERIES[rung];

/* -------------------------------------------------------------------------- */
/* A season                                                                    */
/* -------------------------------------------------------------------------- */

/** What decides how fast a team is: the driver most, the car next, the crew least. They sum to one. */
export const TEAM_WEIGHTS = { driver: 0.5, car: 0.35, crew: 0.15 } as const;

/** How far apart the field is, and how much a season's luck moves a team, on the 0–100 scale. */
export const FIELD_SPREAD = 9;
export const SEASON_LUCK = 7;

/** A crew's skill at each payroll level, on the 0–100 scale: a cheap crew is slower in the pits. */
export const CREW_SKILL: Readonly<Record<'low' | 'medium' | 'high' | 'bigBucks', number>> = {
  low: 38,
  medium: 50,
  high: 60,
  bigBucks: 68,
};

/** Spending on the car's development: what it costs against what the car becomes. */
export type Development = 'lean' | 'steady' | 'heavy';

export const DEVELOPMENTS: readonly Development[] = ['lean', 'steady', 'heavy'];

export const DEVELOPMENT_COST: Readonly<Record<Development, number>> = {
  lean: 0.85,
  steady: 1,
  heavy: 1.25,
};

/** Where the car settles under each, before the rung's own level: points on the 0–100 scale. */
export const DEVELOPMENT_CAR: Readonly<Record<Development, number>> = {
  lean: -6,
  steady: 0,
  heavy: 9,
};

/**
 * A car drifts a third of the way to where its spending puts it each year. The car a team buys to move up a rung is a
 * little slower than the series' average: it is new to the level.
 */
export const CAR_DRIFT = 0.35;
export const NEW_RUNG_CAR_GAP = 6;

/** How the prize fund is shared: the share of the purse, by how high a team finished, and a bonus for the title. */
export const PURSE_CURVE = 2.2;
export const TITLE_PURSE_BONUS = 0.5;

/** Sponsors pay by results and by name: 0.5 for the bottom of the grid up to 1.4 for the title. */
export const SPONSOR_FLOOR = 0.5;
export const SPONSOR_SLOPE = 0.9;
export const SPONSOR_NAME = [0.8, 1.2] as const;
/** Merchandise, as a share of the sponsors' money. */
export const MERCH_SHARE = 0.04;
/** A sponsor's year is a negotiation: the money is within this much either side of the going rate. */
export const SPONSOR_DEAL_SPREAD = [0.85, 1.15] as const;

/** A crash or a blown engine in a season: how likely, and what it costs as a share of the running budget. */
export const INCIDENT_CHANCE = 0.16;
export const INCIDENT_COST = 0.12;
/** Insurance and the shop, as a share of the running budget, owed whatever the results. */
export const SHOP_SHARE = 0.05;

/** What the team's name does after a season: it moves this much of the way to where the standing puts it. */
export const TEAM_REPUTATION_PULL = 0.35;

/* -------------------------------------------------------------------------- */
/* Drivers                                                                     */
/* -------------------------------------------------------------------------- */

/** A driver improves young, holds, and gives it back; the team replaces one who retires. */
export const DRIVER_RISE_UNTIL = 25;
export const DRIVER_DECLINE_FROM = 34;
export const DRIVER_RETIRE_AGE = 41;
export const DRIVER_RISE = 2;
export const DRIVER_HOLD = 0.5;
export const DRIVER_DECLINE = 2;

/** How a hired driver is paid: the series' figure, scaled by skill. */
export const DRIVER_PAY_EXPONENT = 1.6;

export const driverPayFor = (rung: SeriesRung, skill: number): number =>
  Math.round(
    (SERIES[rung].driverPay * Math.pow(Math.max(5, skill) / 50, DRIVER_PAY_EXPONENT)) / 500,
  ) * 500;

/** Candidates in the driver market in a year. */
export const DRIVER_CANDIDATES = 3;
export const DRIVER_FIRST_NAMES: readonly string[] = [
  'Marco',
  'Dale',
  'Sofia',
  'Ethan',
  'Priya',
  'Lucas',
  'Hana',
  'Tobias',
  'Camila',
  'Rory',
  'Nikhil',
  'Elena',
  'Jonas',
  'Amara',
  'Cole',
  'Iris',
];
export const DRIVER_LAST_NAMES: readonly string[] = [
  'Vance',
  'Okafor',
  'Lindqvist',
  'Ramos',
  'Castellan',
  'Whitfield',
  'Tanaka',
  'Brennan',
  'Moreau',
  'Adeyemi',
  'Kowalski',
  'Hartley',
  'Delacroix',
  'Sandoval',
  'Fischer',
  'Pryce',
];

/* -------------------------------------------------------------------------- */
/* Lines                                                                       */
/* -------------------------------------------------------------------------- */

export const TEAM_INCIDENT_LINES: readonly string[] = [
  'A crash in the middle of the season cost {name} a car and three weeks.',
  "A blown engine, and a bill {name} hadn't budgeted.",
  'A big accident at the worst race of the year. {name} spent the winter rebuilding.',
];
