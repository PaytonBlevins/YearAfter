/**
 * Ticket 0308 — the investment engine.
 *
 * WHAT THE POPULATION ACTUALLY HAS, measured before a line was written. Across
 * 100 careerist lives and 100 drifters, cash held by age:
 *
 *            careerist med        drifter med       ever over $50k
 *   age 20         $13,180             $8,616
 *   age 30         $42,833            $27,291        careerist 94/100
 *   age 50        $144,806            $75,698        drifter   74/100
 *   age 70        $195,870            $47,158
 *
 * The opposite of 0307's finding. There, cash at eighteen was $0 at every
 * percentile including the maximum, and the ticket existed to bridge a gap
 * nobody could cross. Here the money is already there and does NOTHING: a
 * careerist's balance climbs from $13,000 to $195,000 and sits in it for fifty
 * years. This ticket is about the lake, not about a bridge.
 *
 * THE DESIGN PROBLEM IS THE MIRROR OF CORE_RULES 13.50.
 *
 * That rule came out of 0307: waiting is free in this build, so no instrument
 * that BUYS time can ever be worth its interest. Investments are the same coin
 * the other way up — they REWARD waiting — and the risk is that they become a
 * ratchet rather than a decision. If returns are positive and certain, putting
 * every dollar in on the first available year is strictly dominant, nobody ever
 * has a reason to do anything else, and spec 1691's "Buy/Sell/Hold" collapses
 * into one button worth pressing once.
 *
 * Two things were supposed to stop that. ONE OF THEM TURNED OUT NOT TO EXIST,
 * and this paragraph is what it said before the measurement:
 *
 *   "LIQUIDITY IS THE REAL ONE. Nothing here auto-liquidates... a character
 *   with $200,000 in an index fund and $0 in the bank is about to start paying
 *   card interest to hold shares returning 7%."
 *
 * It is not true. Measured across 800 lives — five strategies, two player
 * types, 80 seeds each — two of which hold literally zero cash by construction:
 * shortfall years 0%, card-debt years 0%, for every strategy. Characters do
 * reach $0 (3% of adult years for a careerist, 8% for a drifter) and it costs
 * them NOTHING, because a year's income is posted before that year's costs are
 * paid. Being broke on the first of January is free.
 *
 * So the trap is a comment, not a mechanism. See CORE_RULES 13.52: it is the
 * same missing thing as 13.50 — nothing in this build ever needs cash by a
 * date, so neither buying time nor keeping it liquid can be worth paying for.
 *
 * WHICH LEAVES RISK, AND RISK ALONE, TO CARRY THE DECISION. It does carry it,
 * measured over $10,000 a year for a working life, 3,000 runs each:
 *
 *                        p10        median         p90            max
 *   Government Bonds  $455,849    $500,260    $546,700       $634,629
 *   Index Fund        $522,726  $1,534,813  $4,424,637    $23,654,885
 *   Growth Shares     $186,336  $1,044,826  $7,171,318   $146,015,094
 *   Crypto             $35,855    $276,779  $3,920,754   $829,585,860
 *
 * Nothing dominates. Bonds have the narrowest spread of any product and win the
 * floor outright at a fifteen-year horizon ($147,523 against the index fund's
 * $127,634), which is the honest use for them: a late starter, or somebody who
 * wants the money in a decade. The index fund takes the median. Growth trades
 * both floor and median for the tail. Crypto has the worst median of anything
 * here — barely better than a mattress — and the biggest tail by two orders of
 * magnitude, which is volatility drag doing exactly what it should.
 *
 * SPEC 44-46's ACCOUNTING, WHICH IS EASY TO GET SUBTLY WRONG.
 *
 * *"Investments are transfers from cash to assets"* and *"do not count
 * investments as outflow"*. That does NOT mean the ledger ignores them: buying
 * $10,000 of shares moves $10,000 of real cash, and 0302's reconciliation —
 * opening + in − out = closing — would break on the spot if the row were
 * missing. What it means is narrower and lives one layer up:
 *
 *   the row IS in the ledger, and it IS a cash movement;
 *   it is NOT in the dashboard's monthly-outflow figure;
 *   it does NOT reduce net worth, because the money still exists as an asset.
 *
 * Buying shares makes you no poorer. That is the whole of the rule.
 *
 * MARKET STATES ARE SPEC 1222's, AND THIS IS NOT THE ECONOMY TICKET.
 *
 * Spec 706-724 wants a backend economy — expansion through severe recession,
 * severe ones "exceptionally rare", effects "moderate rather than constantly
 * punitive" — influencing employment, property, business and investments. It
 * is unticketed. Building investments on a flat return would be building them
 * wrong, and building the whole economy here is a different ticket wearing this
 * one's name.
 *
 * So the market state lives here, drives only investments, and is shaped so
 * that the economy ticket DRIVES it rather than replaces it: `nextMarketState`
 * is pure and takes the roll, so a world economy can hand it one instead.
 */

import { cents, dollars, type Money } from '@yearafter/core';

/* -------------------------------------------------------------------------- */
/* What is not built yet                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Same device as `UNWRITTEN_CATEGORIES`, `NOT_YET_OWNED` and
 * `LOAN_TYPES_NOT_YET_BUILT`, and with a sharper eye on it than those had —
 * see CORE_RULES 13.51. 0307 built liabilities and left its own line sitting in
 * `NOT_YET_OWNED` saying they arrive in 0307, because a test that asserts the
 * CURRENT contents of a list goes green whether or not the list should have
 * shrunk. The assertions below name the ticket, so the miss is visible.
 */
export const INVESTMENTS_NOT_YET_BUILT = [
  { key: 'retirement', label: 'Retirement accounts', needs: 'an employer match', arrives: '0310' },
  { key: 'private', label: 'Private deals', needs: 'a business to invest in', arrives: 'v0.06' },
] as const;

/* -------------------------------------------------------------------------- */
/* The market                                                                  */
/* -------------------------------------------------------------------------- */

/** Spec 1222's six broad states, worst to best so comparisons read naturally. */
export const MARKET_STATES = [
  'severeRecession',
  'recession',
  'slowdown',
  'normal',
  'growth',
  'strongExpansion',
] as const;

export type MarketState = (typeof MARKET_STATES)[number];

/**
 * What each state does to a market-following asset, before the asset's own
 * character is applied. Normal is zero: these are DEVIATIONS from an ordinary
 * year, not the returns themselves.
 */
const MARKET_EFFECT: Readonly<Record<MarketState, number>> = {
  severeRecession: -0.42,
  recession: -0.22,
  slowdown: -0.08,
  normal: 0,
  growth: 0.07,
  strongExpansion: 0.16,
};

/**
 * How long a state tends to last. Spec 1222: severe recessions "exceptionally
 * rare" — it cannot be entered from anywhere except an ordinary recession, and
 * it never lasts two years, which is the only place in this table where a state
 * cannot follow itself.
 *
 * Written as weights rather than probabilities so a row can be edited without
 * re-normalising the rest of it by hand.
 */
const TRANSITIONS: Readonly<Record<MarketState, Readonly<Partial<Record<MarketState, number>>>>> = {
  severeRecession: { recession: 45, slowdown: 35, normal: 20 },
  recession: { severeRecession: 6, recession: 28, slowdown: 40, normal: 26 },
  slowdown: { recession: 16, slowdown: 30, normal: 42, growth: 12 },
  normal: { recession: 6, slowdown: 16, normal: 46, growth: 26, strongExpansion: 6 },
  growth: { slowdown: 14, normal: 32, growth: 38, strongExpansion: 16 },
  strongExpansion: { slowdown: 16, normal: 30, growth: 36, strongExpansion: 18 },
};

/**
 * Next year's market, from this year's and one roll in [0,1).
 *
 * Pure and roll-taking on purpose: when the economy ticket lands it owns the
 * state and calls this, or replaces the call with its own, and nothing in the
 * investment engine has to change. A market that drew its own randomness inside
 * itself would have to be torn out instead.
 */
export function nextMarketState(current: MarketState, roll: number): MarketState {
  const row = TRANSITIONS[current];
  const total = Object.values(row).reduce((sum, weight) => sum + (weight ?? 0), 0);
  let cursor = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const state of MARKET_STATES) {
    const weight = row[state] ?? 0;
    if (weight <= 0) continue;
    cursor -= weight;
    if (cursor < 0) return state;
  }
  return 'normal';
}

/** Where a life starts. Not the best state, not the worst, and not random. */
export const OPENING_MARKET: MarketState = 'normal';

export const MARKET_LABELS: Readonly<Record<MarketState, string>> = {
  severeRecession: 'a crash',
  recession: 'a recession',
  slowdown: 'a slowdown',
  normal: 'an ordinary year',
  growth: 'a good year',
  strongExpansion: 'a boom',
};

/* -------------------------------------------------------------------------- */
/* What you can buy                                                            */
/* -------------------------------------------------------------------------- */

/** Spec 1691's four, and no fifth. */
export type AssetClass = 'bonds' | 'funds' | 'stocks' | 'crypto';

export interface InvestmentProduct {
  readonly id: string;
  readonly name: string;
  readonly assetClass: AssetClass;
  /** What an ordinary year returns, before the market and before luck. */
  readonly drift: number;
  /** How hard this asset is pulled by the market state. Bonds barely feel it. */
  readonly beta: number;
  /** Its own year-to-year scatter, independent of everything else. */
  readonly spread: number;
  /**
   * Paid out as CASH each year rather than accruing into the value — which is
   * what makes bonds a different decision from a growth fund rather than a
   * worse one. This is also `assetIncome`'s first producer.
   */
  readonly yield: number;
  /** The least anybody will take. A broker does not open an account for $20. */
  readonly minimum: number;
  /**
   * Ticket 0308b. Years until the principal comes back, for bonds. Zero means
   * the holding has no term and can be sold at value whenever.
   */
  readonly termYears: number;
  /** One line, in the player's terms, about what they are actually buying. */
  readonly blurb: string;
  /**
   * What it is like to hold, said plainly enough to choose on.
   *
   * THIS IS THE SUBTITLE ON A ROW THAT ALSO CARRIES A VALUE, which means it has
   * about forty-eight characters before a 390pt screen truncates it. Five of
   * the seven written here were too long and a test caught them — the fifth
   * consecutive ticket in this build to nearly ship a clipped subtitle, and the
   * first one to find out before shipping rather than after. A test on the
   * length is cheaper than another screenshot.
   */
  readonly character: string;
}

/**
 * Ordered safest to wildest, because the screen is read top to bottom and that
 * ordering IS the information — the same lesson 0307's refusal column learned
 * the hard way (CORE_RULES 13.26 and 13.49). A test holds the order.
 */
export const INVESTMENT_PRODUCTS: readonly InvestmentProduct[] = [
  {
    id: 'inv.govbonds',
    termYears: 8,
    name: 'Government Bonds',
    assetClass: 'bonds',
    drift: 0.005,
    beta: 0.06,
    spread: 0.02,
    yield: 0.031,
    minimum: 500,
    blurb: 'Lends money to the government and gets paid to.',
    character: 'Pays every year. Barely moves, barely grows.',
  },
  {
    id: 'inv.corpbonds',
    termYears: 5,
    name: 'Corporate Bonds',
    assetClass: 'bonds',
    drift: 0.009,
    beta: 0.16,
    spread: 0.04,
    yield: 0.046,
    minimum: 1_000,
    blurb: 'Lends to companies instead, for a better rate and a little risk.',
    character: 'Pays more, and can dip in a bad year.',
  },
  {
    id: 'inv.indexfund',
    termYears: 0,
    name: 'Index Fund',
    assetClass: 'funds',
    drift: 0.058,
    beta: 1,
    spread: 0.11,
    yield: 0.015,
    minimum: 500,
    blurb: 'Owns a slice of everything, and charges almost nothing to do it.',
    character: 'Follows the market. Boring on purpose.',
  },
  {
    id: 'inv.managedfund',
    termYears: 0,
    name: 'Managed Fund',
    assetClass: 'funds',
    drift: 0.049,
    beta: 1.08,
    spread: 0.14,
    yield: 0.012,
    minimum: 2_500,
    blurb: 'Somebody picks the holdings, and takes a cut for picking them.',
    character: 'Costs more than the index fund, rarely beats it.',
  },
  {
    id: 'inv.bluechip',
    termYears: 0,
    name: 'Blue Chip Shares',
    assetClass: 'stocks',
    drift: 0.053,
    beta: 1.05,
    spread: 0.16,
    yield: 0.026,
    minimum: 2_000,
    blurb: 'Big, old, dull companies that pay a dividend.',
    character: 'Swings a bit, and pays you while you wait.',
  },
  {
    id: 'inv.growth',
    termYears: 0,
    name: 'Growth Shares',
    assetClass: 'stocks',
    drift: 0.067,
    beta: 1.45,
    spread: 0.29,
    yield: 0,
    minimum: 2_000,
    blurb: 'Younger companies that are worth more later or not at all.',
    character: 'Very good years. Bad ones take a third.',
  },
  {
    id: 'inv.crypto',
    termYears: 0,
    name: 'Crypto',
    assetClass: 'crypto',
    drift: 0.072,
    beta: 2.1,
    spread: 0.58,
    yield: 0,
    minimum: 100,
    blurb: 'No earnings, no dividend, and it moves like nothing else does.',
    character: 'Can double. Can lose almost all of it.',
  },
];

export const findInvestment = (id: string): InvestmentProduct | undefined =>
  INVESTMENT_PRODUCTS.find((product) => product.id === id);

export const CLASS_LABELS: Readonly<Record<AssetClass, string>> = {
  bonds: 'Bonds',
  funds: 'Funds',
  stocks: 'Stocks',
  crypto: 'Crypto',
};

/* -------------------------------------------------------------------------- */
/* What you hold                                                               */
/* -------------------------------------------------------------------------- */

export interface Holding {
  readonly productId: string;
  /**
   * What was put in, net of what has been taken out. NOT the value — the two
   * together are the only way a screen can say "up $4,200" rather than just
   * naming a number, and the gap between them is the only thing a player
   * actually wants to know about a holding.
   */
  readonly contributed: Money;
  readonly value: Money;
  /**
   * Ticket 0308b. Years until a bond returns its principal, for products that
   * have a term. Undefined for everything else.
   *
   * THE FIRST THING IN THIS BUILD WHERE TIME IS REAL. CORE_RULES 13.50 found
   * that waiting is free here — a character blocked out of college at eighteen
   * saves up and enrols at twenty-one at no cost, which is why no loan can ever
   * be worth its interest. A bond is the other side of that: money handed over
   * now against a date, and the date is the point. Selling before it arrives
   * costs you (`EARLY_EXIT`), because a buyer in the secondary market does not
   * pay face value for somebody else's hurry.
   */
  readonly maturesIn?: number;
}

export const holdingValue = (holdings: readonly Holding[]): Money =>
  cents(holdings.reduce((sum, holding) => sum + Number(holding.value), 0));

export const holdingContributed = (holdings: readonly Holding[]): Money =>
  cents(holdings.reduce((sum, holding) => sum + Number(holding.contributed), 0));

/** Up or down, in dollars, across everything held. */
export const portfolioGain = (holdings: readonly Holding[]): number =>
  (Number(holdingValue(holdings)) - Number(holdingContributed(holdings))) / 100;

/**
 * The minimum a portfolio has to be worth before anybody lends against it.
 * 0307's `wealthPrivate` loan type has been waiting for this since that ticket,
 * and it is the first thing in the build that gives somebody a credit standing
 * their INCOME would not have earned them — which is what finally makes the
 * underwriting gate of CORE_RULES 13.49 a real check rather than a label.
 */
/**
 * What it costs to get out of a bond before its date, as a share of value.
 *
 * Not a fee the game invents to punish you — it is the discount a secondary
 * buyer demands, and it is why "how long until I need this" is a question worth
 * asking before buying a ten-year bond. Deliberately big enough to notice and
 * small enough to take when a year has genuinely gone wrong.
 */
export const EARLY_EXIT = 0.12;

export const PLEDGEABLE_FROM = 75_000;

/** How much of a portfolio a private bank will actually lend against. */
export const PLEDGE_SHARE = 0.4;

export function pledgeableAgainst(holdings: readonly Holding[]): number {
  const value = Number(holdingValue(holdings)) / 100;
  if (value < PLEDGEABLE_FROM) return 0;
  // Crypto is not collateral. A private bank lending against something that can
  // halve inside a year is not a product, it is the bank's problem.
  const steady = holdings
    .filter((holding) => findInvestment(holding.productId)?.assetClass !== 'crypto')
    .reduce((sum, holding) => sum + Number(holding.value), 0);
  return Math.floor(((steady / 100) * PLEDGE_SHARE) / 100) * 100;
}

/* -------------------------------------------------------------------------- */
/* A year of owning                                                            */
/* -------------------------------------------------------------------------- */

export interface MarketIncome {
  readonly amount: Money;
  readonly source: string;
}

export interface MarketYear {
  readonly holdings: readonly Holding[];
  readonly state: MarketState;
  /** Dividends and coupons, paid in cash. The `assetIncome` category at last. */
  readonly income: readonly MarketIncome[];
  /** What the whole portfolio did, as a fraction. For the screen's one line. */
  readonly moved: number;
  /**
   * Ticket 0308b. Bonds that reached their date this year and paid back. The
   * cash is in `income`; this is the list for the feed to name.
   */
  readonly matured: readonly string[];
}

/**
 * One year of market movement.
 *
 * `rolls` are taken rather than drawn for the same reason `nextMarketState`
 * takes one: everything in this file has to replay identically from a seed, and
 * an engine that reaches for a generator cannot be tested by handing it the
 * year you want to see. One roll per holding, in order.
 */
export function runMarketYear(
  holdings: readonly Holding[],
  state: MarketState,
  rolls: readonly number[],
): MarketYear {
  const before = Number(holdingValue(holdings));
  const income: MarketIncome[] = [];
  const after: Holding[] = [];
  const matured: string[] = [];

  holdings.forEach((holding, index) => {
    const product = findInvestment(holding.productId);
    if (!product) {
      after.push(holding);
      return;
    }
    const value = Number(holding.value) / 100;

    /*
      A roll in [0,1) becomes a symmetric shock in roughly [-1.7, +1.7] via a
      cheap approximation of a normal draw — three-ish standard deviations would
      need a real inverse-normal and this is a life simulator, not a risk desk.
      What matters is that the tails exist and that the middle is likelier than
      the edges, which a flat roll does not give.
    */
    const roll = Math.max(0.0001, Math.min(0.9999, rolls[index] ?? 0.5));
    const shock = (roll - 0.5) * 2;
    const bell = Math.sign(shock) * shock * shock * 1.7;

    /*
      ONE YEAR CAN ONLY DO SO MUCH, in either direction.

      Not decoration, and not a fudge of the model's shape — a bound on what a
      single year compounds INTO the next one. Crypto in a boom with a good
      draw computes to +139% before this clamp, and a handful of those stacked
      across fifty years is how 0306's frozen card turned $200 into $1.28bn
      while every test stayed green. The lesson from that ticket was to bound
      the recurrence at birth rather than after somebody notices.

      The band is asymmetric because reality is: a year can take almost
      everything and cannot give back more than a couple of times over.
    */
    const raw = product.drift + MARKET_EFFECT[state] * product.beta + bell * product.spread;
    const growth = Math.max(-0.85, Math.min(1.2, raw));
    /*
      A holding can lose almost everything in a year and can never owe money.
      The floor is not decoration: crypto's spread puts a -1.4 draw inside
      reach, and a value going negative would put a negative asset on a net
      worth line and break 0302's reconciliation at the same time.
    */
    const grown = Math.max(value * 0.05, value * (1 + growth));

    if (product.yield > 0 && grown > 0) {
      const paid = Math.round(grown * product.yield);
      if (paid > 0) {
        income.push({ amount: dollars(paid), source: `${product.name} — paid out` });
      }
    }

    /*
      THE DATE ARRIVES. A bond a year closer, and if the clock has run out the
      principal comes back as cash and the holding is gone.

      Paid at VALUE rather than at what was put in, because the value is what
      the coupon and the market have already made of it — a bond redeemed for
      its original principal after eight years would quietly delete every
      return it earned.
    */
    if (holding.maturesIn !== undefined) {
      const left = holding.maturesIn - 1;
      if (left <= 0) {
        income.push({
          amount: dollars(Math.round(grown)),
          source: `${product.name} — matured`,
        });
        matured.push(holding.productId);
        return;
      }
      after.push({ ...holding, value: dollars(Math.round(grown)), maturesIn: left });
      return;
    }
    after.push({ ...holding, value: dollars(Math.round(grown)) });
  });

  const now = Number(holdingValue(after));
  return {
    holdings: after,
    state,
    income,
    moved: before > 0 ? (now - before) / before : 0,
    matured,
  };
}

/* -------------------------------------------------------------------------- */
/* Buying and selling                                                          */
/* -------------------------------------------------------------------------- */

export type InvestRefusal = 'noSuchProduct' | 'belowMinimum' | 'noCash' | 'tooManyHoldings';

/** Spec has no number; this one is the screen's. More rows than this is a list. */
export const MAX_HOLDINGS = 7;

export function canBuy(
  holdings: readonly Holding[],
  product: InvestmentProduct,
  amount: number,
  cash: number,
): InvestRefusal | undefined {
  const held = holdings.some((holding) => holding.productId === product.id);
  if (!held && holdings.length >= MAX_HOLDINGS) return 'tooManyHoldings';
  if (amount > cash) return 'noCash';
  // The minimum applies to OPENING a position, not to adding to one. A player
  // who already holds $8,000 of an index fund putting in another $200 is not
  // opening an account, and refusing them would be the rule misfiring on the
  // person it was written to protect.
  if (!held && amount < product.minimum) return 'belowMinimum';
  if (amount <= 0) return 'belowMinimum';
  return undefined;
}

/** Add to a position, or open one. Returns the whole new set of holdings. */
export function buyInto(
  holdings: readonly Holding[],
  productId: string,
  amount: number,
): readonly Holding[] {
  const term = findInvestment(productId)?.termYears ?? 0;
  const existing = holdings.find((holding) => holding.productId === productId);
  if (!existing) {
    return [
      ...holdings,
      {
        productId,
        contributed: dollars(amount),
        value: dollars(amount),
        ...(term > 0 ? { maturesIn: term } : {}),
      },
    ];
  }
  /*
    TOPPING UP A BOND RESETS ITS CLOCK TO THE FULL TERM, and that is a real
    cost rather than an oversight. Adding to a bond you already hold is buying
    a new one; the alternative — keeping the earlier date — would let a player
    hold a permanent eight-year bond that matures next year, which is a free
    lunch dressed as an accounting convenience.
  */
  return holdings.map((holding) =>
    holding.productId === productId
      ? {
          ...holding,
          contributed: cents(Number(holding.contributed) + amount * 100),
          value: cents(Number(holding.value) + amount * 100),
          ...(term > 0 ? { maturesIn: term } : {}),
        }
      : holding,
  );
}

export interface Sale {
  readonly holdings: readonly Holding[];
  /** Cash raised, in whole dollars, AFTER any early-exit discount. */
  readonly raised: number;
  /** The part of it that is gain rather than the money they put in. */
  readonly realized: number;
  /** Ticket 0308b. What getting out early cost, in whole dollars. */
  readonly penalty: number;
}

/**
 * Sell part or all of a holding.
 *
 * Contribution comes off PRO RATA with value, which is what keeps "up $4,200"
 * honest after a partial sale — taking the sale off the contribution first
 * would make a half-sold winner look like it had doubled again, and taking it
 * off value only would leave a holding claiming a gain it had already banked.
 */
export function sellFrom(holdings: readonly Holding[], productId: string, amount: number): Sale {
  const existing = holdings.find((holding) => holding.productId === productId);
  if (!existing) return { holdings, raised: 0, realized: 0, penalty: 0 };

  const value = Number(existing.value);
  const wanted = Math.min(Math.max(0, Math.round(amount) * 100), value);
  if (wanted <= 0) return { holdings, raised: 0, realized: 0, penalty: 0 };

  /*
    GETTING OUT OF A BOND BEFORE ITS DATE COSTS YOU.

    Not a fee the game invents to be annoying — it is the discount a secondary
    buyer demands for taking on somebody else's hurry. It is also the entire
    reason a term is a decision rather than a label: without it, a ten-year bond
    is an eight-year bond you can leave whenever, which is not a commitment.

    The position still LOSES the full amount sold; the player just receives less
    for it. Taking the penalty off the proceeds and out of the holding would be
    charging them twice.
  */
  const early = existing.maturesIn !== undefined && existing.maturesIn > 0;
  const penalty = early ? Math.round(wanted * EARLY_EXIT) : 0;

  const share = value > 0 ? wanted / value : 1;
  const contributed = Number(existing.contributed);
  const costOut = Math.round(contributed * share);
  const realized = Math.round((wanted - costOut) / 100);

  const left = value - wanted;
  const remaining: readonly Holding[] =
    left <= 0
      ? holdings.filter((holding) => holding.productId !== productId)
      : holdings.map((holding) =>
          holding.productId === productId
            ? {
                ...holding,
                value: cents(left),
                contributed: cents(Math.max(0, contributed - costOut)),
              }
            : holding,
        );

  return {
    holdings: remaining,
    raised: Math.round((wanted - penalty) / 100),
    realized: realized - Math.round(penalty / 100),
    penalty: Math.round(penalty / 100),
  };
}

/** A life starts owning nothing. */
export const EMPTY_PORTFOLIO: readonly Holding[] = [];
