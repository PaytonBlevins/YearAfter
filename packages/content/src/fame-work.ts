/**
 * Ticket 0707 — what being known gets you offered.
 *
 * A photoshoot, a commercial, a talk show and a guest-star part: the things a person with a
 * name is asked to do, each once a year at most. Spec 1140 asks for soft eligibility bands
 * (fame among them) and spec 1372 for no artificial cap on how far a life can go, only on a
 * mechanic that prints money. So what is offered rises with fame, what it pays rises with it,
 * and nothing is offered twice a year.
 *
 * The pay is anchored to two published things. Influencer rates are per post by following
 * (Neal Schaffer's 2026 survey: nano $10–100, micro $100–1,000, macro $1,000–10,000, mega
 * $10,000–100,000+), and the game's fame is 20 × log10 of reach, so a fame of 22 is a following
 * of about ten thousand and a fame of 60 about a million. A day on set is SAG-AFTRA's 2026–27
 * day-performer minimum ($1,283) and a week is $4,456. The rest is a judgement (see the 0707
 * doc, findings 73–75).
 *
 * Everything here is data. `simulation/fame-work.ts` decides who is offered what, and applies
 * what they say yes to. Tokens in a line: {outlet} who is asking, {pay} dollars.
 * American spelling, spoken-style contractions.
 */

export type FameWorkId = 'photoshoot' | 'commercial' | 'talkShow' | 'guestStar';

export interface FameWorkDef {
  readonly id: FameWorkId;
  /** The button and the heading: "Photoshoot". */
  readonly label: string;
  /** One line on what it is, for the screen. */
  readonly blurb: string;
  /** The least fame at which it is ever offered. */
  readonly fromFame: number;
  /** Pay is this many times the going rate for one post at the character's fame, never under the floor. */
  readonly times: number;
  /** Dollars. Where the pay starts however little the character's name is worth. */
  readonly floor: number;
  /** Points of fame it adds when done. */
  readonly fame: number;
  /** Points of happiness it adds when done. */
  readonly mood: number;
  /** Share of the biggest channel's audience it brings, a range. Absent: none. */
  readonly audience?: readonly [number, number];
  /** Who is asking. Invented, so no real company is named. */
  readonly outlets: readonly string[];
  /** What the timeline says once it is done. */
  readonly lines: readonly string[];
  /** What the screen says when it is offered. {outlet} and {pay} are filled in. */
  readonly offers: readonly string[];
}

export const FAME_WORK: readonly FameWorkDef[] = [
  {
    id: 'photoshoot',
    label: 'Photoshoot',
    blurb: 'A day in front of a camera for somebody who wants your face on their pages.',
    fromFame: 6,
    times: 6,
    floor: 200,
    fame: 1,
    mood: 1,
    outlets: [
      'Harlow & Pike, a clothing label',
      'Juniper Row magazine',
      'a travel company called Far Meadow',
      'the lifestyle site Common Thread',
      'Brightwater Outfitters',
    ],
    lines: [
      'You spent a day shooting for {outlet}. It paid {pay}.',
      '{outlet} had you in front of the camera for a day. They paid {pay}.',
    ],
    offers: [
      '{outlet} wants you for a day of photos. It pays {pay}.',
      'A photographer for {outlet} asked if you were free for a shoot. It pays {pay}.',
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    blurb:
      'Your name and face on an advertisement. It pays more than a photo and asks more of you.',
    fromFame: 12,
    times: 12,
    floor: 800,
    fame: 1,
    mood: 0,
    outlets: [
      'Larkspur Coffee',
      'Northfield Mobile',
      'the grocery chain Bell & Basket',
      'Orchard Bank',
      'the car maker Ridgeway Motors',
    ],
    lines: [
      'You shot a commercial for {outlet}. It paid {pay}.',
      '{outlet} put you in an ad and paid {pay} for it.',
    ],
    offers: [
      '{outlet} wants you in a commercial. It pays {pay}.',
      'The agency for {outlet} called about a spot with you in it. It pays {pay}.',
    ],
  },
  {
    id: 'talkShow',
    label: 'Talk show',
    blurb: 'A seat on the couch. It pays little, and it puts you in front of a lot of new people.',
    fromFame: 20,
    times: 1,
    floor: 500,
    fame: 2,
    mood: 1,
    audience: [0.03, 0.08],
    outlets: [
      'The Late Hour',
      'Morning with Dana Reyes',
      'Couch Night',
      'The Weekend Table',
      'Open Mic with Lowell Park',
    ],
    lines: [
      'You sat down with {outlet}. They paid {pay}, and a lot of people saw it.',
      'You were a guest on {outlet} and held your own. It paid {pay}.',
    ],
    offers: [
      '{outlet} wants you as a guest. It pays {pay}.',
      'A producer from {outlet} asked you to come on. It pays {pay}.',
    ],
  },
  {
    id: 'guestStar',
    label: 'Guest-star part',
    blurb: "A part in somebody else's show, for a week. A name is what gets you in the room.",
    fromFame: 28,
    times: 4,
    floor: 1283,
    fame: 3,
    mood: 2,
    audience: [0.02, 0.06],
    outlets: [
      'a crime drama called Cold Harbor',
      'the comedy Second Floor',
      'a hospital show, Mercy Street',
      'the family series Maple Court',
      'a streaming thriller, The Long Night',
    ],
    lines: [
      'You played a part in {outlet}. It paid {pay}.',
      'You spent a week on the set of {outlet} as a guest. They paid {pay}.',
    ],
    offers: [
      'The casting director for {outlet} wants you for a guest part. It pays {pay}.',
      '{outlet} has a part that suits you for a week. It pays {pay}.',
    ],
  },
];

const BY_ID = new Map(FAME_WORK.map((work) => [work.id, work]));
export const findFameWork = (id: string): FameWorkDef | undefined => BY_ID.get(id as FameWorkId);
