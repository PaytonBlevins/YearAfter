/**
 * Ticket 0606 — which businesses take space in which kind of commercial building.
 *
 * Ids from `businesses.ts`. A tenant is a business of one of these trades, so a
 * shopping strip fills with cafes and salons and an office with lawyers, and a
 * building's tenants say what the street is like. NPC businesses only: the
 * character's own businesses do not rent from them here (0606b if wanted).
 */

export const COMMERCIAL_TRADES: Readonly<Record<string, readonly string[]>> = {
  'home.corner-shop': ['biz.cafe', 'biz.salon', 'biz.clothing', 'biz.specialty', 'biz.fitness'],
  'home.retail-strip': [
    'biz.cafe',
    'biz.restaurant',
    'biz.salon',
    'biz.clothing',
    'biz.electronics',
    'biz.fitness',
    'biz.specialty',
    'biz.jewelry',
  ],
  'home.warehouse': [
    'biz.trucking',
    'biz.furniture',
    'biz.electronicsmfg',
    'biz.apparelmfg',
    'biz.specialtymfg',
    'biz.plumbing',
  ],
  'home.office': [
    'biz.law',
    'biz.accounting',
    'biz.marketing',
    'biz.software',
    'biz.realestate',
    'biz.media',
  ],
};

/** Whether a kind of building is let to businesses. */
export const isCommercialKindId = (id: string): boolean => id in COMMERCIAL_TRADES;
