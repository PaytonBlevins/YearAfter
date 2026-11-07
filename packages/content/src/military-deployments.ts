/**
 * Ticket 0903 — deployments.
 *
 * A deployment is orders (a place, a number of months and how close it is to the fighting), a year away that pays
 * hostile fire pay and is partly free of tax, and a few incidents that a minigame will one day play. Each incident
 * comes out one of four ways. A clean one costs nothing. A close call costs some stress. Injury needs a mistake and
 * death needs a disaster, so nobody dies of a bare dice roll: the player has to have got it wrong first.
 *
 * Real: how often service members deploy and for how long (RAND's count of 2.77 million people and 5.4 million
 * deployments from September 2001 to 2015, about 1.95 each, 3.1 million troop-years so about seven months each; Pew's
 * 2011 survey, where 84% of post-9/11 veterans had deployed at least once and typical lengths ran from three months in
 * the Air Force to about a year in the Army), $225 a month of hostile fire pay and imminent danger pay, the combat zone
 * tax exclusion (unlimited for enlisted pay, capped for officers at the highest enlisted pay plus that $225), and the
 * casualty total of the post-9/11 operations (about 6,900 killed and 52,000 wounded over those 5.4 million
 * deployments, so about 0.13% of deployments ended in a death and about 1% in a wound). Not real: the yearly chance of
 * orders by branch, the split of places into rear, forward and front, what an incident costs, and every number that
 * turns a minigame result into an injury, a lasting condition, a stress or a medal. Payton asked for danger above the
 * real rates, so the dials below are set for a player who makes occasional mistakes (`REFERENCE_OUTCOMES`) to be hurt
 * about three times as often as the real force and to die about three times as often. The ticket doc names the dials.
 *
 * Nothing here is drawn or applied; `simulation/military-deployments.ts` does that. American spelling, spoken-style
 * contractions. Tokens in a line: %theater% %months% %short% %Branch%.
 */

import type { ServiceBranchId } from './military-branches';

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

/** A member must have finished this many years before orders can come: the training year is not a posting. */
export const DEPLOY_MIN_YEARS = 1;

export interface DeployTempoRow {
  /** The yearly chance of orders for somebody in a job of middling danger. A judgement, tuned against RAND's counts. */
  readonly orders: number;
  /** The usual length of a deployment in months, from Pew 2011 where it gave one. The Coast Guard's is a guess. */
  readonly months: number;
}

export const DEPLOY_TEMPO: Readonly<Record<ServiceBranchId, DeployTempoRow>> = {
  army: { orders: 0.2, months: 9 },
  navy: { orders: 0.17, months: 6 },
  'marine-corps': { orders: 0.2, months: 7 },
  'air-force': { orders: 0.11, months: 4 },
  'coast-guard': { orders: 0.05, months: 4 },
};

/** A job's danger tag (1 to 3) scales how often its members are sent. */
export const DANGER_TEMPO: readonly number[] = [0.8, 1, 1.2];

/** The chance a year brings orders. Zero for a branch the table doesn't know. */
export function ordersChance(branch: string, danger: number): number {
  const row = (DEPLOY_TEMPO as Readonly<Record<string, DeployTempoRow>>)[branch];
  if (!row) return 0;
  const scale = DANGER_TEMPO[Math.max(1, Math.min(3, Math.round(danger))) - 1] ?? 1;
  return Math.min(0.95, row.orders * scale);
}

/** The months of a deployment: the branch's usual, a month shorter on a low draw and a month longer on a high one. */
export function deploymentMonths(branch: string, unit: number): number {
  const base = (DEPLOY_TEMPO as Readonly<Record<string, DeployTempoRow>>)[branch]?.months ?? 6;
  if (unit < 0.25) return Math.max(2, base - 1);
  if (unit >= 0.75) return base + 1;
  return base;
}

/** How close a place is to the fighting. */
export type DeployTier = 'rear' | 'forward' | 'front';

export const DEPLOY_TIERS: readonly DeployTier[] = ['rear', 'forward', 'front'];

/** Where a job of each danger is sent: the share of its deployments that are rear, forward and front. A judgement. */
export const TIER_ODDS: readonly (readonly [number, number, number])[] = [
  [0.7, 0.3, 0],
  [0.3, 0.55, 0.15],
  [0.1, 0.5, 0.4],
];

export function deploymentTier(danger: number, unit: number): DeployTier {
  const row = TIER_ODDS[Math.max(1, Math.min(3, Math.round(danger))) - 1] ?? TIER_ODDS[1]!;
  if (unit < row[0]) return 'rear';
  if (unit < row[0] + row[1]) return 'forward';
  return 'front';
}

/** The incidents a deployment is made of: the exposure. A minigame plays one at a time. */
export const TIER_INCIDENTS: Readonly<Record<DeployTier, number>> = {
  rear: 1,
  forward: 2,
  front: 3,
};

/** Hostile fire pay and imminent danger pay, a month. Real (DoD, `365.military.com`; one or the other, not both). */
export const HOSTILE_PAY_MONTHLY = 225;

/** Where the pay is paid: a rear post is not a hostile fire area. */
export const HOSTILE_PAY_TIERS: readonly DeployTier[] = ['forward', 'front'];

/** Every place is made up. */
export const THEATERS: readonly string[] = [
  'the Harran Valley',
  'the Karesh coast',
  'Port Delmara',
  'the Orsk highlands',
  'Camp Veridian',
  'the Malvik desert',
  'the Tessaly border',
  'Fort Aldrin',
  'the Sorrel straits',
  'the Qamar basin',
];

/* -------------------------------------------------------------------------- */
/* Incidents                                                                   */
/* -------------------------------------------------------------------------- */

export type IncidentOutcome = 'clean' | 'close' | 'mistake' | 'disaster';

export const INCIDENT_OUTCOMES: readonly IncidentOutcome[] = [
  'clean',
  'close',
  'mistake',
  'disaster',
];

export const isIncidentOutcome = (value: unknown): value is IncidentOutcome =>
  typeof value === 'string' && (INCIDENT_OUTCOMES as readonly string[]).includes(value);

/** What the generic buttons say, until a minigame replaces them. */
export const OUTCOME_LABELS: Readonly<Record<IncidentOutcome, string>> = {
  clean: 'It went clean',
  close: 'It was a close call',
  mistake: 'You made a mistake',
  disaster: 'It went badly wrong',
};

/**
 * What a player who makes occasional mistakes does, per incident. Not a measurement of anyone: a reference the dials are
 * set against, so the doc and the tests can say "about three times real" without a minigame to measure.
 */
export const REFERENCE_OUTCOMES: Readonly<Record<IncidentOutcome, number>> = {
  clean: 0.88,
  close: 0.09,
  mistake: 0.025,
  disaster: 0.005,
};

/** The chance a mistake leaves the member hurt. A clean or close incident never does. */
export const INJURY_ON_MISTAKE = 0.25;

/** A disaster always hurts, and kills at this chance. Death needs a disaster. */
export const DEATH_ON_DISASTER = 0.25;

/** The points of stress an incident adds, before the member's resilience. */
export const INCIDENT_STRESS: Readonly<Record<IncidentOutcome, number>> = {
  clean: 0,
  close: 6,
  mistake: 10,
  disaster: 20,
};

/** What an incident does to happiness and to the service's opinion of the member. */
export const INCIDENT_MOOD: Readonly<Record<IncidentOutcome, number>> = {
  clean: 1,
  close: -1,
  mistake: -3,
  disaster: -8,
};

export const INCIDENT_REPUTATION: Readonly<Record<IncidentOutcome, number>> = {
  clean: 2,
  close: 1,
  mistake: -3,
  disaster: -6,
};

/** The chance an incident leaves lasting trauma, before the tier's scale. A disaster is the likeliest. */
export const TRAUMA_ON: Readonly<Record<IncidentOutcome, number>> = {
  clean: 0,
  close: 0.02,
  mistake: 0.08,
  disaster: 0.35,
};

/** Trauma is likelier the closer the place is to the fighting. */
export const TRAUMA_TIER_SCALE: Readonly<Record<DeployTier, number>> = {
  rear: 0.5,
  forward: 1,
  front: 1.5,
};

export const traumaChance = (outcome: IncidentOutcome, tier: DeployTier): number =>
  Math.min(0.95, TRAUMA_ON[outcome] * TRAUMA_TIER_SCALE[tier]);

/** A wound takes this much health, owed back over time (the health layer's deficit), and may leave something lasting. */
export const WOUND_COST: Readonly<Record<'minor' | 'serious', number>> = { minor: 14, serious: 30 };

/** The chance a wound leaves a lasting condition. */
export const WOUND_LASTING: Readonly<Record<'minor' | 'serious', number>> = {
  minor: 0.3,
  serious: 0.75,
};

/** The lasting conditions a wound can leave, by how bad it was. Ids are the health layer's. */
export const WOUND_CONDITIONS: Readonly<Record<'minor' | 'serious', readonly string[]>> = {
  minor: ['cond.shrapnel', 'cond.hearing', 'cond.knee', 'cond.back'],
  serious: ['cond.blast', 'cond.limb', 'cond.brain', 'cond.burns', 'cond.spine'],
};

/** The lasting condition of the mind. */
export const TRAUMA_CONDITION = 'cond.trauma';

/** What refusing orders costs: standing and performance, and a bad mood. The year's promotion and the next term as well. */
export const REFUSE_REPUTATION = -15;
export const REFUSE_PERFORMANCE = -10;
export const REFUSE_MOOD = -3;

/* -------------------------------------------------------------------------- */
/* Decorations                                                                 */
/* -------------------------------------------------------------------------- */

export type DecorationId =
  | 'service-medal'
  | 'commendation'
  | 'combat-badge'
  | 'bronze-star'
  | 'purple-heart'
  | 'medal-of-honor';

export interface DecorationRow {
  readonly id: DecorationId;
  readonly name: string;
  /** The line for the record, "Awarded the …". */
  readonly record: string;
}

export const DECORATIONS: readonly DecorationRow[] = [
  { id: 'service-medal', name: 'Deployment Service Medal', record: 'the Deployment Service Medal' },
  { id: 'commendation', name: 'Commendation Medal', record: 'a Commendation Medal' },
  { id: 'combat-badge', name: 'Combat Action Badge', record: 'the Combat Action Badge' },
  { id: 'bronze-star', name: 'Bronze Star', record: 'the Bronze Star' },
  { id: 'purple-heart', name: 'Purple Heart', record: 'the Purple Heart' },
  { id: 'medal-of-honor', name: 'Medal of Honor', record: 'the Medal of Honor' },
];

export const findDecoration = (id: string): DecorationRow | undefined =>
  DECORATIONS.find((row) => row.id === id);

export const isDecorationId = (value: unknown): value is DecorationId =>
  typeof value === 'string' && DECORATIONS.some((row) => row.id === value);

/** The chance of each award a completed deployment can earn, when its rule is met. Judgements. */
export const DECORATION_CHANCE: Readonly<Record<DecorationId, number>> = {
  'service-medal': 1,
  commendation: 0.4,
  'combat-badge': 0.6,
  'bronze-star': 0.2,
  'purple-heart': 1,
  'medal-of-honor': 0.02,
};

/** A member who dies is honored after: the chance of a posthumous Bronze Star, and of the Medal of Honor. */
export const POSTHUMOUS_BRONZE_STAR = 0.25;

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

export const ORDERS_PROMPTS: readonly string[] = [
  'Your unit has orders for %theater%. It is about %months% months. You can go, or you can refuse them.',
  'The first sergeant has the papers: %theater%, %months% months. You can take them or turn them down.',
  'Orders came down for %theater%, %months% months. Refusing is allowed, and it is remembered.',
];

export const ORDERS_TIER_LINES: Readonly<Record<DeployTier, readonly string[]>> = {
  rear: [
    'It is a support post well behind the line.',
    'Most of the work is logistics and watch duty.',
  ],
  forward: [
    'It is near the fighting, and the base gets hit now and then.',
    'The work is out among the people and the patrols.',
  ],
  front: [
    "It is where it's happening. Everybody going knows it.",
    'The unit will be on the front line, with little room to be wrong.',
  ],
};

export const ORDERS_ACCEPTED: readonly string[] = [
  'You signed for the orders: %theater%, about %months% months.',
  'You said you would go. Your gear was packed within the week.',
];

export const ORDERS_REFUSED: readonly string[] = [
  'You turned the orders down. It was noted, and the unit went without you.',
  'You refused to go to %theater%. Nobody said much, and nobody forgot.',
];

export const DEPLOYED_LINES: readonly string[] = [
  'You deployed to %theater% for about %months% months. The days there ran together.',
  'Most of a year went to %theater%, and the people you were with became the only ones who understood it.',
];

export const MISSION_PROMPTS: Readonly<Record<DeployTier, readonly string[]>> = {
  rear: [
    'Something goes wrong on the base in %theater%, and the people around you look to you.',
    'A routine job in %theater% turns tricky in the middle.',
  ],
  forward: [
    "Your patrol out of %theater% runs into trouble you didn't plan for.",
    'The convoy through %theater% is hit, and you have a few seconds to decide.',
  ],
  front: [
    'Contact. Your unit is pinned down in %theater% and the next minute matters.',
    'The position in %theater% is under fire, and it is on you to hold it.',
  ],
};

export const OUTCOME_LINES: Readonly<Record<IncidentOutcome, readonly string[]>> = {
  clean: [
    'It went the way it was supposed to. You put it out of your mind.',
    'Everyone came through it fine, and you did your part.',
  ],
  close: [
    'That one was closer than it should have been. Your hands shook after.',
    'You were lucky and you knew it, and so did the people beside you.',
  ],
  mistake: [
    'You got it wrong. People were hurt because of it and you have to live with it.',
    'A bad call under pressure. It could have gone worse, and it went bad enough.',
  ],
  disaster: [
    'It went as badly as a day like that can go.',
    'Everything you feared happened at once.',
  ],
};

export const WOUND_LINES: Readonly<Record<'minor' | 'serious', readonly string[]>> = {
  minor: [
    'You were hurt, and they sent you to the aid station and then back out.',
    'A piece of it caught you. It looked worse than it was, at first.',
  ],
  serious: [
    'You were badly hurt and flown out in the night. You woke up days later in a hospital.',
    'The wound took months to even start to close, and it never closed all the way.',
  ],
};

export const TRAUMA_LINES: readonly string[] = [
  "It doesn't stay over there. You come back, and it comes back with you.",
  'You sleep badly now, and sudden noises find you before you are ready.',
];

export const HOMECOMING_LINES: readonly string[] = [
  "You came home from %theater% to a country that hadn't much noticed you were gone.",
  'The plane landed and the families were behind a rope. It took weeks to feel like you were back.',
];

export const DEATH_LINES: Readonly<Record<'rear' | 'front', readonly string[]>> = {
  rear: [
    'You were killed in an accident on the deployment, a long way from home.',
    "You died on the base in %theater%. It wasn't a battle. It was the work.",
  ],
  front: [
    'You were killed in action in %theater%.',
    'You died holding the line in %theater%, and a flag came home in your place.',
  ],
};

export const DEATH_CAUSES: Readonly<Record<'rear' | 'front', string>> = {
  rear: 'Killed in an accident on deployment',
  front: 'Killed in action',
};

export const AWARD_LINES: readonly string[] = [
  'You were awarded %award%.',
  'They pinned %award% on you at a short ceremony.',
];
