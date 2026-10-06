/**
 * Ticket 0705 — the celebrity world.
 *
 * Spec 697–705 and 839–848: a persistent cast of fictional public figures in
 * six fields who rise, peak, decline, retire and die, a rare chance meeting
 * with one of them, and a second menu once a real connection exists.
 *
 * Everything here is data. The roster itself is derived from the world's seed
 * in `simulation/celebrity-world.ts`, so none of it is saved: only what the
 * player did and who they now know is. Logic depends on the ids and numbers
 * here, never on a name.
 */

export const CELEBRITY_FIELDS = [
  'acting',
  'music',
  'athletics',
  'creator',
  'business',
  'politics',
] as const;
export type CelebrityFieldId = (typeof CELEBRITY_FIELDS)[number];

/** What a player's life has to contain for a field to be within reach (spec 697). */
export type FieldNetwork = 'channel' | 'business';

export interface CelebrityField {
  readonly id: CelebrityFieldId;
  /** How the engine and the lines refer to one: "an actor". */
  readonly role: string;
  /** Age they first break through, a range [lowest, highest]. */
  readonly debut: readonly [number, number];
  /** Years the climb to their peak takes. */
  readonly rise: readonly [number, number];
  /** Years they stay near the top. */
  readonly hold: readonly [number, number];
  /** Age they stop (a ballplayer at 36, a senator at 74). */
  readonly retire: readonly [number, number];
  /** Expected people per birth year: the size of the field. */
  readonly density: number;
  /** 0–1. How much more often a big city puts you in the same room as them. */
  readonly hubPull: number;
  /** 0–1. How much more often money does. */
  readonly wealthPull: number;
  /** The part of a player's life that is a professional network for this field (spec 697). */
  readonly network?: FieldNetwork;
}

/**
 * The fields.
 *
 * `density` is people per birth year, and the ranges set how long each is in
 * the public eye. Together they set how many are famous at once: about
 * density × (years visible), thinned by the fame floor. Measured in
 * `celebrity.test.ts` against the numbers the tests pin.
 */
export const CELEBRITY_FIELD_CATALOG: readonly CelebrityField[] = [
  {
    id: 'acting',
    role: 'an actor',
    debut: [17, 30],
    rise: [4, 12],
    hold: [6, 20],
    retire: [55, 80],
    density: 0.9,
    hubPull: 0.9,
    wealthPull: 0.4,
  },
  {
    id: 'music',
    role: 'a recording artist',
    debut: [16, 28],
    rise: [3, 10],
    hold: [4, 15],
    retire: [50, 75],
    density: 1.0,
    hubPull: 0.6,
    wealthPull: 0.3,
  },
  {
    id: 'athletics',
    role: 'a pro athlete',
    debut: [18, 24],
    rise: [3, 8],
    hold: [3, 9],
    retire: [33, 40],
    density: 0.9,
    hubPull: 0.3,
    wealthPull: 0.2,
  },
  {
    id: 'creator',
    role: 'a famous creator',
    debut: [16, 30],
    rise: [2, 8],
    hold: [3, 10],
    retire: [40, 65],
    density: 1.1,
    hubPull: 0.5,
    wealthPull: 0.1,
    network: 'channel',
  },
  {
    id: 'business',
    role: 'a well-known founder',
    debut: [28, 45],
    rise: [8, 15],
    hold: [10, 25],
    retire: [60, 80],
    density: 0.7,
    hubPull: 0.6,
    wealthPull: 1,
    network: 'business',
  },
  {
    id: 'politics',
    role: 'a public official',
    debut: [35, 50],
    rise: [8, 15],
    hold: [8, 20],
    retire: [60, 80],
    density: 0.6,
    hubPull: 0.8,
    wealthPull: 0.6,
  },
];

const FIELDS_BY_ID = new Map(CELEBRITY_FIELD_CATALOG.map((field) => [field.id, field]));
export const findCelebrityField = (id: string): CelebrityField | undefined =>
  FIELDS_BY_ID.get(id as CelebrityFieldId);

/* -------------------------------------------------------------------------- */
/* The six things you can do to a stranger who is famous (spec 704)            */
/* -------------------------------------------------------------------------- */

export const ENCOUNTER_ACTIONS = [
  'compliment',
  'flirt',
  'autograph',
  'picture',
  'insult',
  'ignore',
] as const;
export type EncounterActionId = (typeof ENCOUNTER_ACTIONS)[number];

export interface EncounterAction {
  readonly id: EncounterActionId;
  readonly label: string;
  readonly blurb: string;
  /** Chance it goes well on somebody with no fame to speak of, at average looks. */
  readonly base: number;
  /** Chance a good result leaves them wanting to stay in touch. */
  readonly connect: number;
}

export const ENCOUNTER_MENU: readonly EncounterAction[] = [
  {
    id: 'compliment',
    label: 'Compliment them',
    blurb: 'Say something nice.',
    base: 0.55,
    connect: 0.5,
  },
  {
    id: 'flirt',
    label: 'Flirt',
    blurb: 'Make it clear you are interested.',
    base: 0.18,
    connect: 0.55,
  },
  {
    id: 'autograph',
    label: 'Ask for an autograph',
    blurb: 'A signature to keep.',
    base: 0.8,
    connect: 0.1,
  },
  {
    id: 'picture',
    label: 'Ask for a picture',
    blurb: 'Get a photo together.',
    base: 0.7,
    connect: 0.2,
  },
  {
    id: 'insult',
    label: 'Insult them',
    blurb: 'Say what you think of them.',
    base: 0,
    connect: 0,
  },
  {
    id: 'ignore',
    label: 'Ignore them',
    blurb: "Act like you didn't notice.",
    base: 0,
    connect: 0,
  },
];

export const findEncounterAction = (id: string): EncounterAction | undefined =>
  ENCOUNTER_MENU.find((action) => action.id === id);

/* -------------------------------------------------------------------------- */
/* The second menu, once there is a real connection (spec 705)                 */
/* -------------------------------------------------------------------------- */

export const CONNECTION_ACTIONS = [
  'catchUp',
  'compliment',
  'getTogether',
  'flirt',
  'collaborate',
  'invite',
  'endorse',
] as const;
export type ConnectionActionId = (typeof CONNECTION_ACTIONS)[number];

export interface ConnectionAction {
  readonly id: ConnectionActionId;
  readonly label: string;
  readonly blurb: string;
  readonly kind: 'social' | 'romantic' | 'professional';
  /** Warmth needed before it is on the menu. */
  readonly minWarmth: number;
  /** Chance at the lowest warmth it is offered, and at 100. */
  readonly worst: number;
  readonly best: number;
  /** Warmth gained when it goes well, and lost when it does not. */
  readonly onGood: number;
  readonly onBad: number;
}

export const CONNECTION_MENU: readonly ConnectionAction[] = [
  {
    id: 'catchUp',
    label: 'Catch up',
    blurb: 'Call or text them.',
    kind: 'social',
    minWarmth: 0,
    worst: 0.6,
    best: 0.95,
    onGood: 5,
    onBad: -1,
  },
  {
    id: 'compliment',
    label: 'Compliment them',
    blurb: 'Tell them what you admire.',
    kind: 'social',
    minWarmth: 0,
    worst: 0.5,
    best: 0.9,
    onGood: 4,
    onBad: -2,
  },
  {
    id: 'getTogether',
    label: 'Get together',
    blurb: 'Meet up for a meal.',
    kind: 'social',
    minWarmth: 30,
    worst: 0.45,
    best: 0.9,
    onGood: 9,
    onBad: -2,
  },
  {
    id: 'flirt',
    label: 'Flirt',
    blurb: 'Let them know there is more to it.',
    kind: 'romantic',
    minWarmth: 40,
    worst: 0.15,
    best: 0.7,
    onGood: 8,
    onBad: -4,
  },
  {
    id: 'collaborate',
    label: 'Work on something together',
    blurb: 'A joint piece for your channel.',
    kind: 'professional',
    minWarmth: 35,
    worst: 0.3,
    best: 0.85,
    onGood: 3,
    onBad: -1,
  },
  {
    id: 'invite',
    label: 'Invite them on your show',
    blurb: 'A guest spot on your video, stream or podcast.',
    kind: 'professional',
    minWarmth: 35,
    worst: 0.25,
    best: 0.8,
    onGood: 3,
    onBad: -1,
  },
  {
    id: 'endorse',
    label: 'Ask them to back your business',
    blurb: 'A visit, a post, a mention.',
    kind: 'professional',
    minWarmth: 40,
    worst: 0.2,
    best: 0.75,
    onGood: 2,
    onBad: -2,
  },
];

export const findConnectionAction = (id: string): ConnectionAction | undefined =>
  CONNECTION_MENU.find((action) => action.id === id);

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

/** Where a meeting happened, which is also why it was this person. */
export type EncounterScene = 'chance' | 'hub' | 'elite' | 'channel' | 'business' | 'fame';

export type CelebrityLineKind =
  | `scene:${EncounterScene}`
  | 'complimentOk'
  | 'complimentFail'
  | 'flirtOk'
  | 'flirtFail'
  | 'autographOk'
  | 'autographFail'
  | 'pictureOk'
  | 'pictureFail'
  | 'insult'
  | 'insultFilmed'
  | 'ignore'
  | 'connected'
  | 'catchUpOk'
  | 'catchUpFail'
  | 'getTogetherOk'
  | 'getTogetherFail'
  | 'collaborateOk'
  | 'collaborateFail'
  | 'inviteOk'
  | 'inviteFail'
  | 'endorseOk'
  | 'endorseFail'
  | 'friends'
  | 'lostTouch'
  | 'died';

/** Tokens: {name}, {role}, {channel}, {gain}, {business}. American spelling, spoken contractions. */
export const CELEBRITY_LINES: Readonly<Record<CelebrityLineKind, readonly string[]>> = {
  'scene:chance': [
    'You are in line for coffee when you notice the person ahead of you is {name}, {role}.',
    'A car pulls up on your street and out steps {name}, {role}.',
    'You are waiting for a table and {name}, {role}, is waiting right next to you.',
  ],
  'scene:hub': [
    'You are walking downtown when a crowd gathers. It is {name}, {role}, signing things.',
    'In a city this big you stop being surprised, but you still look twice when {name}, {role}, walks past.',
  ],
  'scene:elite': [
    'At a dinner you are lucky to be at, {name}, {role}, is seated two chairs down.',
    'At a fundraiser, {name}, {role}, ends up next to you at the bar.',
  ],
  'scene:channel': [
    'At a creator meetup, {name}, {role}, is standing near the snacks.',
    'At an event for people who make things online, {name}, {role}, is working the room.',
  ],
  'scene:business': [
    'At a business mixer, {name}, {role}, is talking with everybody who will listen.',
    'At a conference, you end up in the same elevator as {name}, {role}.',
  ],
  'scene:fame': [
    'At a party full of people with a following, {name}, {role}, waves you over.',
    'At an industry event, {name}, {role}, spots you and nods.',
  ],
  complimentOk: [
    '{name} smiled and said you made their day.',
    '{name} laughed and thanked you. It felt good.',
    '{name} said that was kind and asked your name.',
  ],
  complimentFail: [
    '{name} gave you a polite nod and kept going.',
    'You said it, but {name} was already looking at their phone.',
  ],
  flirtOk: [
    '{name} grinned and held eye contact a second longer than you expected.',
    '{name} laughed, not unkindly, and said you were bold.',
  ],
  flirtFail: [
    '{name} laughed it off and changed the subject.',
    '{name} smiled, said thanks, and stepped away.',
  ],
  autographOk: [
    '{name} signed it and wrote your name on it.',
    '{name} signed it with a flourish and handed it back.',
  ],
  autographFail: [
    '{name} was in a hurry and said not today.',
    '{name} waved it off and was gone before you could ask twice.',
  ],
  pictureOk: [
    '{name} put an arm around you for the photo.',
    '{name} stopped and posed for a couple of shots.',
  ],
  pictureFail: [
    '{name} said no pictures right now.',
    "{name}'s team politely waved your phone away.",
  ],
  insult: [
    'You said something rude to {name}. They looked at you for a long second and walked off.',
    '{name} heard what you said and just shook their head.',
  ],
  insultFilmed: [
    'Somebody filmed you being rude to {name}. It made the rounds, and not kindly.',
    'You were rude to {name} and a stranger caught it on video. It was a bad week.',
  ],
  ignore: [
    'You looked away and let {name} go by.',
    'You kept your eyes on your own business and {name} walked on past.',
  ],
  connected: [
    '{name} took your number before leaving. You might hear from them.',
    '{name} said to stay in touch and gave you a way to reach them.',
  ],
  catchUpOk: [
    'You caught up with {name}. It was good to hear their voice.',
    '{name} called you back the same day and you talked for an hour.',
  ],
  catchUpFail: [
    'You tried {name} and got voicemail.',
    '{name} read your message and never wrote back.',
  ],
  getTogetherOk: [
    'You had dinner with {name}. The time flew by.',
    'You and {name} spent an afternoon together, no cameras, no one else.',
  ],
  getTogetherFail: [
    '{name} had to cancel at the last minute.',
    'You waited at the restaurant and {name} never showed.',
  ],
  collaborateOk: [
    'You and {name} made something together for {channel}. {gain} new people found it.',
    '{name} appeared on {channel}. About {gain} people came over and stayed.',
  ],
  collaborateFail: [
    '{name} was booked solid. It will have to wait.',
    '{name} liked the idea but their schedule had no room.',
  ],
  inviteOk: [
    '{name} came on {channel} as a guest. {gain} new people tuned in and stayed.',
    'You had {name} on {channel}, and about {gain} more people were listening afterward.',
  ],
  inviteFail: [
    '{name} said they would love to, but not this year.',
    '{name} turned down the guest spot politely.',
  ],
  endorseOk: [
    '{name} stopped by {business} and posted about it. Customers noticed.',
    '{name} gave {business} a mention that brought people in.',
  ],
  endorseFail: [
    '{name} was too busy to get to {business}.',
    "{name} said they couldn't put their name on {business} right now.",
  ],
  friends: [
    '{name} is a real friend now, not just somebody famous.',
    'You and {name} are friends. Nobody else needs to know who they are.',
  ],
  lostTouch: ['You and {name} lost touch.', 'You never kept up with {name}, and they moved on.'],
  died: [
    '{name}, {role}, died this year. The news was everywhere.',
    '{name}, {role}, passed away this year. It was all anyone talked about for a week.',
  ],
};

/** Fill the tokens in a line. */
export function celebrityLine(
  kind: CelebrityLineKind,
  key: string,
  tokens: Readonly<Record<string, string>>,
  pick: (lines: readonly string[], key: string) => string,
): string {
  const text = pick(CELEBRITY_LINES[kind], key);
  return text.replace(/\{(\w+)\}/g, (_, token: string) => tokens[token] ?? '');
}
