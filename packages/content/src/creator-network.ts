/**
 * Ticket 0704 — who a creator works with: other creators, groups, and the
 * one person who looks after the business side.
 *
 * Fictional names. Logic depends on the ids and the numbers in
 * `finance/collaborations.ts`, `groups.ts` and `representation.ts`, never on a
 * name.
 */

/** The four kinds of group (spec 1909): a creator house, a gaming team, a video group, a podcast network. */
export const GROUP_KINDS = ['house', 'team', 'group', 'network'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

/** Which kind of group each platform has. Subscription has none: a newsletter is a one-person thing. */
export const GROUP_KIND_BY_PLATFORM: Readonly<Record<string, GroupKind>> = {
  video: 'group',
  stream: 'team',
  podcast: 'network',
  photo: 'house',
  shortform: 'house',
};

export const GROUP_KIND_LABELS: Readonly<Record<GroupKind, string>> = {
  house: 'a creator house',
  team: 'a gaming team',
  group: 'a video group',
  network: 'a podcast network',
};

export const GROUP_NAMES: Readonly<Record<GroupKind, readonly string[]>> = {
  house: [
    'Hillcrest House',
    'The Lantern Loft',
    'Palm Court Collective',
    'Northlight House',
    'The Sundial',
    'Juniper Row',
  ],
  team: [
    'Redline Gaming',
    'Ghost Protocol',
    'Nightfall Esports',
    'The Respawn Guild',
    'Vector Squad',
    'Ironclad Five',
  ],
  group: [
    'Frame Rate Collective',
    'The Cutting Room',
    'Wide Angle Crew',
    'Third Take Studios',
    'Longform Union',
    'Backlot Society',
  ],
  network: [
    'Open Mic Audio',
    'The Soundstage Network',
    'Latenight Audio',
    'Common Ground Podcasts',
    'Signal & Noise',
    'Fieldnotes Network',
  ],
};

/** People to work with. A pool, so the same few come round again and a repeat is a repeat. */
export const COLLAB_PARTNERS: readonly string[] = [
  'Jules Marlowe',
  'Dani Okafor',
  'Priya Nandakumar',
  'The Hargrove Twins',
  'Mateo Quintero',
  'Sasha Lindqvist',
  'Tobias Reyes',
  'Nina Castellanos',
  'Big Wren',
  'Callum Ashby',
  'Imani Brooks',
  'Kenji Watanabe',
  'Rosalind Pike',
  'Dev Malhotra',
  'Greta Svensson',
  'Omar Haddad',
  'Lucy Ferreira',
  'Ansel Pruitt',
  'Marisol Vega',
  'The Late Shift',
  'Ravi Chaudhry',
  'Poppy Underhill',
  'Declan Moore',
  'Yuki Tanabe',
];

export const REPRESENTATION_KINDS = ['manager', 'agent'] as const;
export type RepresentationKind = (typeof REPRESENTATION_KINDS)[number];

export const REPRESENTATION_LABELS: Readonly<Record<RepresentationKind, string>> = {
  manager: 'A manager',
  agent: 'An agent',
};

export const REPRESENTATION_BLURBS: Readonly<Record<RepresentationKind, string>> = {
  manager:
    'Runs the whole business so you can make things. Takes a share of everything you earn, and your channels grow faster.',
  agent:
    'Finds you better deals and bargains for you. Takes a share of the deals they land, and nothing else.',
};
