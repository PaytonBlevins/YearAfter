/**
 * Ticket 0701 — the words a channel says on the timeline.
 *
 * The engine decides WHAT happened (a `CreatorNote`); this decides how it
 * reads. Several lines each so a long career does not repeat itself (CORE_RULES
 * 13.17). Tokens: {name}, {platform}, {audience}, {mark}, {income}. American
 * spelling, spoken-style contractions.
 */

export type CreatorNote =
  | { readonly kind: 'opened' }
  | { readonly kind: 'monetized' }
  | { readonly kind: 'milestone'; readonly mark: number }
  | { readonly kind: 'slump' }
  | { readonly kind: 'closed' }
  /** Ticket 0702. A new best place on the platform's chart: 1,000, 100, 10 or 1. */
  | { readonly kind: 'chart'; readonly tier: number }
  /** Ticket 0703. A post took off. `gained` is how many people it brought, before the year's drift. */
  | { readonly kind: 'viral'; readonly gained: number };

/** Ticket 0704. Lines the player's choices about who they work with write. */
export type NetworkLineKind =
  | 'collabFriend'
  | 'collabSwap'
  | 'collabPaid'
  | 'collabPassed'
  | 'groupJoined'
  | 'groupPassed'
  | 'groupLeft'
  | 'managerHired'
  | 'agentHired'
  | 'repDropped';

export type CreatorNoteKind = CreatorNote['kind'];

/** Lines the player's own choices write, as well as the year's news. */
export type CreatorLineKind =
  | CreatorNoteKind
  | 'sponsorTaken'
  | 'sponsorRaised'
  | 'sponsorWalked'
  | 'sponsorPassed'
  | NetworkLineKind;

export const CREATOR_LINES: Readonly<Record<CreatorLineKind, readonly string[]>> = {
  opened: [
    'You started {name} on {platform}. Nobody was watching yet.',
    'You opened {name} on {platform}. Your account is ready for its first post.',
  ],
  monetized: [
    '{name} crossed the line where {platform} starts paying. The first real money is coming.',
    'You were approved to earn from {name}.',
  ],
  milestone: [
    '{name} passed {mark} {audience}.',
    'You hit {mark} {audience} on {name}.',
    '{mark} {audience} are following {name} now.',
  ],
  slump: [
    '{name} lost a lot of its {audience} this year.',
    "People drifted away from {name}. It's down on last year.",
  ],
  chart: [
    '{name} made it to {place} on the {platform} chart.',
    '{name} climbed to {place} on the {platform} chart.',
  ],
  viral: [
    'One of the posts on {name} took off. It brought in {gained} new {audience}.',
    'A clip from {name} got passed around everywhere: {gained} new {audience}.',
  ],
  sponsorTaken: [
    "You took {brand}'s offer on {name}: {pay} for {kind}.",
    'You agreed to {kind} for {brand} on {name}, for {pay}.',
  ],
  sponsorRaised: [
    '{brand} came up to {pay} for {kind} on {name}, and you took it.',
    'You asked {brand} for more and got it: {pay} for {kind} on {name}.',
  ],
  sponsorWalked: [
    "{brand} wouldn't pay more and went elsewhere.",
    'You pushed {brand} for more money. They walked.',
  ],
  sponsorPassed: ['You turned down {brand}.', "You said no to {brand}'s offer on {name}."],
  collabFriend: [
    '{partner} came on {name} as a favour, and it brought in {gain} new {audience}.',
    'You had your friend {partner} on {name}. {gain} new {audience} came with them.',
  ],
  collabSwap: [
    'You and {partner} traded appearances. {name} picked up {gain} new {audience}.',
    '{partner} was glad to swap guests with you: {gain} new {audience} for {name}.',
  ],
  collabPaid: [
    '{partner} wanted {fee} to appear on {name}. It brought {gain} new {audience}.',
    'You paid {partner} {fee} to work with {name}, and got {gain} new {audience}.',
  ],
  collabPassed: ['You let {partner} go. Not this time.', 'You said no to working with {partner}.'],
  groupJoined: [
    '{name} joined {group}. They take {cut} of what it earns, and it gets more eyes.',
    'You signed {name} to {group} for {cut} of its income.',
  ],
  groupPassed: ['You turned down {group}.', "You said no to {group}'s offer for {name}."],
  groupLeft: [
    '{name} left {group}. The share is yours again.',
    'You walked away from {group} with {name}.',
  ],
  managerHired: [
    'You took on a manager. They run the business side now, for a share of everything.',
    'A manager came on board to look after the business so you can just make things.',
  ],
  agentHired: [
    'You signed with an agent. They go after the deals and take a share of what they land.',
    'An agent now handles your sponsorships and brand work.',
  ],
  repDropped: [
    'You let go of the person who looked after the business side.',
    'You parted ways with your representation and took the business back.',
  ],
  closed: ['You shut down {name}.', 'You stopped making {name} and took it offline.'],
};

/** Fill the tokens in a line. */
export function creatorLine(
  note: CreatorLineKind,
  key: string,
  tokens: Readonly<Record<string, string>>,
  pick: (lines: readonly string[], key: string) => string,
): string {
  const text = pick(CREATOR_LINES[note], key);
  return text.replace(/\{(\w+)\}/g, (_, token: string) => tokens[token] ?? '');
}
