/**
 * Ticket 0702 — who offers a creator money to talk about them.
 *
 * Fictional brands, three to a category. Logic depends on the category id and
 * the numbers in `finance/creators.ts`, never on a name.
 */

export const SPONSOR_BRANDS: Readonly<Record<string, readonly string[]>> = {
  gaming: ['Voltline Peripherals', 'Quickdraw Energy', 'Nexa Cloud Play'],
  comedy: ['Sidecar Snacks', 'Loud Mattress Co.', 'Pocketlaugh Tickets'],
  education: ['Brightpath Courses', 'Notebook & Co.', 'Clearview Tutors'],
  lifestyle: ['Fernhill Home', 'Daybreak Coffee', 'Oakleaf Candles'],
  fitness: ['Ironroot Supplements', 'Stridewell Shoes', 'Pulse Band'],
  cooking: ['Cast & Cook Cookware', 'Harvest Box', 'Saltline Spices'],
  tech: ['Orbit Mobile', 'Lumen Displays', 'Tidewave Routers'],
  music: ['Reedmark Strings', 'Echo Studio Gear', 'Amplify Tickets'],
  writing: ['Inkwell Notebooks', 'Paperlight Reader', 'Marginalia Press'],
  fashion: ['Threadbare & Co.', 'Muse Cosmetics', 'Linen Lane'],
  travel: ['Tailwind Airlines', 'Roamstay Rentals', 'Packlight Luggage'],
  commentary: ['Civic Brief', 'Headline VPN', 'Quorum News Pass'],
  business: ['Ledgerly', 'Tallyfox Software', 'Northstar Brokerage'],
  sports: ['Fieldhouse Apparel', 'Courtside Seats', 'Bracket Fantasy'],
  truecrime: ['Deadbolt Home Security', 'Casefile Audio', 'Lantern Meal Kits'],
};

/** What the deal is called on each way of being paid. */
export const SPONSOR_KIND: Readonly<Record<string, string>> = {
  ads: 'three sponsored videos',
  live: 'three sponsored streams',
  brands: 'four sponsored posts',
  shortAds: 'five sponsored clips',
  sponsors: 'eight host-read ads',
  members: 'six sponsored issues',
};

/** What a trend is called, hottest first. */
export const TREND_WORDS = ['hot', 'warm', 'steady', 'cool', 'cold'] as const;
export type TrendWord = (typeof TREND_WORDS)[number];

export const TREND_LABELS: Readonly<Record<TrendWord, string>> = {
  hot: 'Hot right now',
  warm: 'Doing well',
  steady: 'Steady',
  cool: 'Cooling off',
  cold: 'Out of fashion',
};
