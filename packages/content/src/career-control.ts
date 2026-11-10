/** November playtest balance. These are game-design choices, not medical limits. */
export const SPORT_DEVELOPMENT = {
  untalentedEfficiency: 0.85,
  annualGrowth: 0.12,
  ageLossPerYear: 0.15,
  maximumAgeLoss: 3,
  neglectLoss: 1,
  classDeclineFrom: 40,
  potentialAnchors: [
    [0, 20],
    [40, 50],
    [60, 65],
    [80, 95],
    [100, 100],
  ],
} as const;

/** One booking, not total annual off-field income. Whole dollars, including usage. */
export const FAME_BOOKING_CAP = {
  photoshoot: 2_000_000,
  commercial: 10_000_000,
  talkShow: 25_000,
  guestStar: 150_000,
} as const;
export const FAME_RECEPTION = {
  attributeWeight: 0.25,
  poorBelow: 25,
  weakBelow: 50,
  greatFrom: 75,
  poorChange: -3,
  weakChange: -1,
  greatBonus: 2,
  lostAudienceShare: 0.25,
  careerRecovery: 0.15,
} as const;
