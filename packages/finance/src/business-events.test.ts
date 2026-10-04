/**
 * Ticket 0604 acceptance tests — what happens to a business (finance side).
 *
 * Spec 413: "weighted randomness tuned for pacing, game optimization, and
 * player enjoyment. Constant disasters should not be normal." Spec 414:
 * "competition matters, but should not be a huge/dominant factor." Each test
 * below fails if one of those is quietly given up, which is the thing a tuning
 * pass is most likely to do.
 */

import { describe, expect, it } from 'vitest';
import { BUSINESS_TYPES, findBusinessType } from '@yearafter/content';
import {
  BUSINESS_EVENTS,
  EVENT_CHANCE,
  NO_MODIFIERS,
  RIVAL_BITE_MAX,
  RIVAL_BITE_MIN,
  RIVAL_YEARS,
  businessYear,
  canHappenTo,
  crowdingOf,
  drawEvent,
  eventLineFor,
  findBusinessEvent,
  modifiersFor,
  newBusiness,
  reachOf,
  reputationChangeOf,
  reputationShield,
  rivalAfter,
  rivalBiteFor,
  rivalIsLive,
  rivalTake,
  weightOf,
  type BusinessEvent,
  type EventContext,
  type OwnedBusiness,
  type Rival,
} from './index';

const NORMAL = { year: 2012, market: 'normal' as const, shock: 0, stat: 50, hands: 1 };

const mature = (
  typeId: string,
): { business: OwnedBusiness; type: (typeof BUSINESS_TYPES)[number] } => {
  const type = findBusinessType(typeId)!;
  return {
    type,
    business: { ...newBusiness(type, 'b:1', 'Test', 2000, 1), staff: type.staff, reputation: 50 },
  };
};

const CONTEXT: EventContext = { year: 2012, market: 'normal', age: 11, rival: undefined };
const RIVAL: Rival = { since: 2010, bite: 0.1 };

/** An even sweep of [0, 1), so a share is a count and not a sample. */
const sweep = (steps: number): number[] =>
  Array.from({ length: steps }, (_, i) => (i + 0.5) / steps);

const share = (
  type: (typeof BUSINESS_TYPES)[number],
  context: EventContext,
  tone: 'good' | 'bad',
): number => {
  let good = 0;
  let bad = 0;
  for (const event of BUSINESS_EVENTS) {
    const weight = weightOf(event, type, context);
    if (event.tone === 'good') good += weight;
    else bad += weight;
  }
  return (tone === 'good' ? good : bad) / (good + bad);
};

describe('how crowded a trade is', () => {
  it('is one for the cheapest trade, zero for the dearest, and never rises with the price of getting in', () => {
    const byStartup = [...BUSINESS_TYPES].sort((a, b) => a.startup - b.startup);
    expect(crowdingOf(byStartup[0]!)).toBe(1);
    expect(crowdingOf(byStartup[byStartup.length - 1]!)).toBeCloseTo(0, 6);
    for (let index = 1; index < byStartup.length; index += 1) {
      expect(crowdingOf(byStartup[index]!)).toBeLessThanOrEqual(crowdingOf(byStartup[index - 1]!));
    }
  });

  it('says a hundred people can clean houses and about two can build a resort', () => {
    expect(crowdingOf(findBusinessType('biz.cleaning')!)).toBeGreaterThan(0.9);
    expect(crowdingOf(findBusinessType('biz.cafe')!)).toBeGreaterThan(0.5);
    expect(crowdingOf(findBusinessType('biz.cafe')!)).toBeLessThan(0.8);
    expect(crowdingOf(findBusinessType('biz.trucking')!)).toBeLessThan(0.5);
    expect(crowdingOf(findBusinessType('biz.resort')!)).toBeLessThan(0.05);
  });
});

describe('a rival', () => {
  it('takes a little in a trade with few of them and a good deal in one with many, never past the ceiling', () => {
    for (const draw of sweep(20)) {
      for (const crowding of [0, 0.25, 0.5, 0.75, 1]) {
        const bite = rivalBiteFor(crowding, draw);
        expect(bite).toBeGreaterThanOrEqual(RIVAL_BITE_MIN);
        expect(bite).toBeLessThanOrEqual(RIVAL_BITE_MAX);
      }
    }
    expect(rivalBiteFor(1, 0.999)).toBeGreaterThan(rivalBiteFor(0.2, 0.999));
    expect(rivalBiteFor(0.6, 0.9)).toBeGreaterThan(rivalBiteFor(0.6, 0.1));
    // Nobody crowds the dearest trade out.
    expect(rivalBiteFor(0, 0.999)).toBe(RIVAL_BITE_MIN);
    // "Should not be a huge or dominant factor": a seventh of the custom at the very most.
    expect(RIVAL_BITE_MAX).toBeLessThanOrEqual(1 / 6);
  });

  it('is held off by a good name', () => {
    expect(reputationShield(0)).toBe(1);
    expect(reputationShield(100)).toBe(0.45);
    let last = 2;
    for (const reputation of [0, 20, 40, 60, 80, 100]) {
      expect(reputationShield(reputation)).toBeLessThanOrEqual(last);
      last = reputationShield(reputation);
    }
    // Under half the loss at the top, against most of it at the opening name.
    expect(reputationShield(80)).toBeLessThan(0.5);
    expect(reputationShield(35)).toBeGreaterThan(0.85);
  });

  it('takes nothing before it opens, a little less each year after, and nothing at the end', () => {
    expect(rivalTake(undefined, 2012, 50)).toBe(0);
    // The year it opens, nothing yet: customers drift over after.
    const opened: Rival = { since: 2012, bite: 0.12 };
    const shield = reputationShield(50);
    expect(rivalTake(opened, 2012, 50)).toBeCloseTo(0.12 * shield, 10);
    expect(rivalTake(opened, 2013, 50)).toBeCloseTo(0.12 * 0.75 * shield, 10);
    expect(rivalTake(opened, 2014, 50)).toBeCloseTo(0.12 * 0.5 * shield, 10);
    expect(rivalTake(opened, 2015, 50)).toBeCloseTo(0.12 * 0.25 * shield, 10);
    expect(rivalTake(opened, 2012 + RIVAL_YEARS, 50)).toBe(0);
    expect(rivalTake(opened, 2012 + RIVAL_YEARS + 5, 50)).toBe(0);
  });

  it('is live for four years, counting the year it opened', () => {
    const rival: Rival = { since: 2020, bite: 0.1 };
    expect(rivalIsLive(rival, 2020)).toBe(true);
    expect(rivalIsLive(rival, 2023)).toBe(true);
    expect(rivalIsLive(rival, 2024)).toBe(false);
    expect(rivalIsLive(undefined, 2020)).toBe(false);
  });

  it('takes custom the business would otherwise have had, to the percent', () => {
    const { business, type } = mature('biz.cafe');
    const base = businessYear(business, type, NORMAL);
    const rival: Rival = { since: NORMAL.year - 1, bite: 0.12 };
    const crowded = businessYear({ ...business, rival }, type, NORMAL);
    const took = rivalTake(rival, NORMAL.year, business.reputation);
    expect(took).toBeGreaterThan(0.05);
    expect(crowded.rivalTook).toBeCloseTo(took, 10);
    expect(crowded.demand / base.demand).toBeCloseTo(1 - took, 10);
    expect(base.rivalTook).toBe(0);
    // A name in town keeps more of it.
    const loved = businessYear({ ...business, reputation: 90, rival }, type, NORMAL);
    const lovedBase = businessYear({ ...business, reputation: 90 }, type, NORMAL);
    expect(1 - loved.demand / lovedBase.demand).toBeLessThan(1 - crowded.demand / base.demand);
  });

  it('never costs a business more than the ceiling of its custom, in any year of its life', () => {
    for (const type of BUSINESS_TYPES) {
      const { business } = mature(type.id);
      for (const since of [2008, 2009, 2010, 2011, 2012]) {
        const rival: Rival = { since, bite: RIVAL_BITE_MAX };
        const base = businessYear(business, type, NORMAL);
        const crowded = businessYear({ ...business, rival }, type, NORMAL);
        expect(1 - crowded.demand / base.demand, type.id).toBeLessThanOrEqual(
          RIVAL_BITE_MAX + 1e-9,
        );
      }
    }
  });
});

describe('the events', () => {
  it('are well formed: unique, in the owner’s voice, each doing something', () => {
    expect(new Set(BUSINESS_EVENTS.map((event) => event.id)).size).toBe(BUSINESS_EVENTS.length);
    for (const event of BUSINESS_EVENTS) {
      expect(event.line, event.id).toContain('{name}');
      // Spoken, not reported: the validator's rule, held here too where the text lives.
      expect(event.line, event.id).not.toMatch(
        /\b(is not|was not|did not|could not|would not|will not|does not)\b/,
      );
      expect(event.weight, event.id).toBeGreaterThan(0);
      const does =
        event.demand ??
        event.cogs ??
        event.overhead ??
        event.extra ??
        event.effect ??
        event.reputation;
      expect(does, event.id).toBeDefined();
      for (const range of [event.demand, event.cogs, event.overhead, event.extra]) {
        if (range) expect(range[0]).toBeLessThanOrEqual(range[1]);
      }
      // Good news does not cost and bad news does not pay.
      if (event.tone === 'good') {
        if (event.demand) expect(event.demand[0]).toBeGreaterThanOrEqual(1);
        if (event.cogs) expect(event.cogs[1]).toBeLessThanOrEqual(1);
        if (event.overhead) expect(event.overhead[1]).toBeLessThanOrEqual(1);
        if (event.extra) expect(event.extra[1]).toBeLessThanOrEqual(0);
        expect(event.reputation ?? 0).toBeGreaterThanOrEqual(0);
      } else {
        if (event.demand) expect(event.demand[1]).toBeLessThanOrEqual(1);
        if (event.cogs) expect(event.cogs[0]).toBeGreaterThanOrEqual(1);
        if (event.overhead) expect(event.overhead[0]).toBeGreaterThanOrEqual(1);
        if (event.extra) expect(event.extra[0]).toBeGreaterThanOrEqual(0);
        expect(event.reputation ?? 0).toBeLessThanOrEqual(0);
      }
    }
  });

  it('can be found again by id, and read with the name in it', () => {
    const event = findBusinessEvent('breakdown')!;
    expect(event.id).toBe('breakdown');
    expect(findBusinessEvent('nothing-like-this')).toBeUndefined();
    expect(eventLineFor(event, 'Sparkle Co')).toContain('Sparkle Co');
    expect(eventLineFor(event, 'Sparkle Co')).not.toContain('{name}');
  });

  it('only happens to a business it can happen to', () => {
    for (const type of BUSINESS_TYPES) {
      for (const pick of sweep(300)) {
        for (const rival of [undefined, RIVAL]) {
          const happened = drawEvent(type, { ...CONTEXT, rival }, { happens: 0, pick, size: 0.5 });
          expect(happened, type.id).toBeDefined();
          const event = happened!.event;
          if (event.needs === 'supplier')
            expect(type.supplier, `${type.id} ${event.id}`).toBe(true);
          if (event.needs === 'people')
            expect((type.staff * type.wage) / type.revenue).toBeGreaterThanOrEqual(0.25);
          if (event.needs === 'fittings')
            expect(type.assetShare, `${type.id} ${event.id}`).toBeGreaterThanOrEqual(0.3);
          // One rival at a time, and nobody to see off when there is none.
          if (event.effect === 'rivalOpens') expect(rival).toBeUndefined();
          if (event.effect === 'rivalCloses') expect(rival).toBeDefined();
        }
      }
    }
  });

  it('is a real difference between a trade with a supplier, with people and with fittings', () => {
    const cleaning = findBusinessType('biz.cleaning')!;
    const software = findBusinessType('biz.software')!;
    const hotel = findBusinessType('biz.hotel')!;
    const byId = (id: string): BusinessEvent => findBusinessEvent(id)!;
    expect(canHappenTo(byId('supplier-hike'), software, false)).toBe(false);
    expect(canHappenTo(byId('supplier-hike'), hotel, false)).toBe(true);
    expect(canHappenTo(byId('breakdown'), software, false)).toBe(false);
    expect(canHappenTo(byId('breakdown'), hotel, false)).toBe(true);
    expect(canHappenTo(byId('key-leaver'), cleaning, false)).toBe(true);
    // The people rule is a real line through the catalog: a service has people who can leave,
    // a shop that sells stock mostly does not.
    const withPeople = BUSINESS_TYPES.filter((type) =>
      canHappenTo(byId('key-leaver'), type, false),
    );
    expect(withPeople.length).toBeGreaterThan(10);
    expect(withPeople.length).toBeLessThan(BUSINESS_TYPES.length - 3);
    expect(canHappenTo(byId('key-leaver'), findBusinessType('biz.electronics')!, false)).toBe(
      false,
    );
    expect(canHappenTo(byId('dispute'), findBusinessType('biz.jewelry')!, false)).toBe(false);
    expect(canHappenTo(byId('slow-stretch'), software, false)).toBe(true);
  });

  it('leaves half the years quiet, which is what "constant disasters should not be normal" means', () => {
    expect(EVENT_CHANCE).toBeGreaterThanOrEqual(0.4);
    expect(EVENT_CHANCE).toBeLessThanOrEqual(0.6);
    for (const type of BUSINESS_TYPES) {
      let quiet = 0;
      for (const happens of sweep(200)) {
        if (!drawEvent(type, CONTEXT, { happens, pick: 0.5, size: 0.5 })) quiet += 1;
      }
      expect(quiet / 200, type.id).toBeCloseTo(1 - EVENT_CHANCE, 1);
    }
  });

  it('weighs good news as much as bad, in an ordinary year, for every kind of business', () => {
    for (const type of BUSINESS_TYPES) {
      const bad = share(type, CONTEXT, 'bad');
      expect(bad, type.id).toBeGreaterThan(0.3);
      expect(bad, type.id).toBeLessThan(0.62);
    }
  });

  it('is likelier to go wrong for a new business, which has nothing to fall back on', () => {
    for (const type of BUSINESS_TYPES) {
      const young = share(type, { ...CONTEXT, age: 0 }, 'bad');
      const old = share(type, { ...CONTEXT, age: 15 }, 'bad');
      expect(young, type.id).toBeGreaterThan(old);
    }
  });

  it('tilts the odds with the economy, and only the odds: a recession is a slow stretch more often', () => {
    const type = findBusinessType('biz.cafe')!;
    const weight = (id: string, market: EventContext['market']): number =>
      weightOf(findBusinessEvent(id)!, type, { ...CONTEXT, market });
    expect(weight('slow-stretch', 'severeRecession')).toBeGreaterThan(
      weight('slow-stretch', 'recession'),
    );
    expect(weight('slow-stretch', 'recession')).toBeGreaterThan(weight('slow-stretch', 'slowdown'));
    expect(weight('slow-stretch', 'slowdown')).toBeGreaterThan(weight('slow-stretch', 'normal'));
    expect(weight('big-order', 'growth')).toBeGreaterThan(weight('big-order', 'normal'));
    expect(weight('big-order', 'recession')).toBeLessThan(weight('big-order', 'normal'));
    // Fewer people open a shop in hard times, and more of them shut one.
    expect(weight('rival-opens', 'recession')).toBeLessThan(weight('rival-opens', 'normal'));
    expect(
      weightOf(findBusinessEvent('rival-closes')!, type, {
        ...CONTEXT,
        market: 'recession',
        rival: RIVAL,
      }),
    ).toBeGreaterThan(
      weightOf(findBusinessEvent('rival-closes')!, type, {
        ...CONTEXT,
        market: 'normal',
        rival: RIVAL,
      }),
    );
    // And a hard year is never a certainty: it is still mostly quiet.
    let quiet = 0;
    for (const happens of sweep(100)) {
      if (
        !drawEvent(
          type,
          { ...CONTEXT, market: 'severeRecession' },
          { happens, pick: 0.2, size: 0.5 },
        )
      )
        quiet += 1;
    }
    expect(quiet).toBeGreaterThanOrEqual(40);
  });

  it('opens a rival far more often in a crowded trade than in an expensive one', () => {
    const opens = findBusinessEvent('rival-opens')!;
    const cleaning = weightOf(opens, findBusinessType('biz.cleaning')!, CONTEXT);
    const hotel = weightOf(opens, findBusinessType('biz.hotel')!, CONTEXT);
    expect(cleaning).toBeGreaterThan(hotel * 2.5);
    expect(hotel).toBeGreaterThan(0);
  });

  it('draws the same thing from the same numbers, and a different thing from different ones', () => {
    const type = findBusinessType('biz.cafe')!;
    const draws = { happens: 0.1, pick: 0.37, size: 0.6 };
    expect(drawEvent(type, CONTEXT, draws)).toEqual(drawEvent(type, CONTEXT, draws));
    const ids = new Set(
      sweep(100).map((pick) => drawEvent(type, CONTEXT, { happens: 0, pick, size: 0.5 })?.event.id),
    );
    expect(ids.size).toBeGreaterThanOrEqual(8);
  });

  it('survives a draw of exactly one at every edge', () => {
    for (const type of BUSINESS_TYPES) {
      const edge = drawEvent(type, CONTEXT, { happens: 0, pick: 1, size: 1 });
      expect(edge, type.id).toBeDefined();
      expect(drawEvent(type, CONTEXT, { happens: 0, pick: 0, size: 0 }), type.id).toBeDefined();
    }
  });
});

describe('what an event does to a year', () => {
  it('is nothing at all when nothing happened', () => {
    expect(modifiersFor(undefined)).toEqual(NO_MODIFIERS);
    expect(reputationChangeOf(undefined)).toBe(0);
  });

  it('lands inside the range the event declares, at either end of how big it was', () => {
    for (const event of BUSINESS_EVENTS) {
      for (const size of [0, 0.5, 0.999]) {
        const mods = modifiersFor({ event, size });
        const within = (
          value: number,
          range: readonly [number, number] | undefined,
          none: number,
        ): void => {
          if (range) {
            expect(value, event.id).toBeGreaterThanOrEqual(range[0] - 1e-12);
            expect(value, event.id).toBeLessThanOrEqual(range[1] + 1e-12);
          } else {
            expect(value, event.id).toBe(none);
          }
        };
        within(mods.demand, event.demand, 1);
        within(mods.cogs, event.cogs, 1);
        within(mods.overhead, event.overhead, 1);
        within(mods.extra, event.extra, 0);
      }
    }
    expect(reputationChangeOf({ event: findBusinessEvent('bad-review')!, size: 0.5 })).toBe(-5);
    expect(reputationChangeOf({ event: findBusinessEvent('write-up')!, size: 0.5 })).toBe(5);
  });

  it('moves demand by exactly the multiplier it names', () => {
    const { business, type } = mature('biz.cafe');
    const base = businessYear(business, type, NORMAL);
    const slow = businessYear(business, type, {
      ...NORMAL,
      modifiers: { ...NO_MODIFIERS, demand: 0.9 },
    });
    expect(slow.demand / base.demand).toBeCloseTo(0.9, 10);
    expect(slow.profit).toBeLessThan(base.profit);
  });

  it('moves what the goods cost, and only that', () => {
    const { business, type } = mature('biz.cafe');
    const base = businessYear(business, type, NORMAL);
    const dearer = businessYear(business, type, {
      ...NORMAL,
      modifiers: { ...NO_MODIFIERS, cogs: 1.1 },
    });
    expect(dearer.cogs / base.cogs).toBeCloseTo(1.1, 2);
    expect(dearer.labor).toBe(base.labor);
    expect(dearer.overhead).toBe(base.overhead);
    expect(dearer.revenue).toBe(base.revenue);
  });

  it('moves the lease, and only that', () => {
    const { business, type } = mature('biz.cafe');
    const base = businessYear(business, type, NORMAL);
    const rent = businessYear(business, type, {
      ...NORMAL,
      modifiers: { ...NO_MODIFIERS, overhead: 1.2 },
    });
    expect(rent.overhead / base.overhead).toBeCloseTo(1.2, 2);
    expect(rent.cogs).toBe(base.cogs);
    expect(rent.revenue).toBe(base.revenue);
  });

  it('charges a one-off sized to the business, and pays one in', () => {
    const { business, type } = mature('biz.cafe');
    const base = businessYear(business, type, NORMAL);
    expect(base.extra).toBe(0);
    const broken = businessYear(business, type, {
      ...NORMAL,
      modifiers: { ...NO_MODIFIERS, extra: 0.04 },
    });
    expect(broken.extra).toBe(Math.round(0.04 * type.revenue * reachOf(1)));
    expect(broken.costs - base.costs).toBe(broken.extra);
    expect(base.profit - broken.profit).toBe(broken.extra);
    const windfall = businessYear(business, type, {
      ...NORMAL,
      modifiers: { ...NO_MODIFIERS, extra: -0.05 },
    });
    expect(windfall.extra).toBeLessThan(0);
    expect(windfall.profit).toBeGreaterThan(base.profit);
    // A second door has a bigger bill for the same breakdown.
    const two = { ...business, branches: [2010] };
    const twoBroken = businessYear(two, type, {
      ...NORMAL,
      modifiers: { ...NO_MODIFIERS, extra: 0.04 },
    });
    expect(twoBroken.extra).toBeGreaterThan(broken.extra);
  });

  it('says what the economy did, as a number a screen can show', () => {
    const { business, type } = mature('biz.restaurant');
    expect(businessYear(business, type, NORMAL).economy).toBe(1);
    const slump = businessYear(business, type, { ...NORMAL, market: 'recession' });
    expect(slump.economy).toBeLessThan(0.95);
    const boom = businessYear(business, type, { ...NORMAL, market: 'strongExpansion' });
    expect(boom.economy).toBeGreaterThan(1.03);
  });

  it('costs an owner a little over the years, not a lot: events are a risk, not a tax', () => {
    // The ratio of what a mature business earns with the year's events averaged in, against
    // without. The 0601 calibration of owner pay stays within a tenth either way.
    let total = 0;
    for (const type of BUSINESS_TYPES) {
      const { business } = mature(type.id);
      const base = businessYear(business, type, NORMAL).profit;
      let sum = 0;
      let count = 0;
      for (const happens of sweep(10)) {
        for (const pick of sweep(60)) {
          for (const size of [0.1, 0.5, 0.9]) {
            const happened = drawEvent(type, CONTEXT, {
              happens: happens * EVENT_CHANCE * 2,
              pick,
              size,
            });
            sum += businessYear(business, type, {
              ...NORMAL,
              modifiers: modifiersFor(happened),
            }).profit;
            count += 1;
          }
        }
      }
      const ratio = sum / count / base;
      expect(ratio, type.id).toBeGreaterThan(0.75);
      expect(ratio, type.id).toBeLessThan(1.1);
      total += ratio;
    }
    const mean = total / BUSINESS_TYPES.length;
    expect(mean).toBeGreaterThan(0.9);
    expect(mean).toBeLessThan(1.0);
  });
});

describe('the rival after a year', () => {
  const cleaning = findBusinessType('biz.cleaning')!;
  const hotel = findBusinessType('biz.hotel')!;
  const opens = (): { event: BusinessEvent; size: number } => ({
    event: findBusinessEvent('rival-opens')!,
    size: 0.5,
  });
  const closes = (): { event: BusinessEvent; size: number } => ({
    event: findBusinessEvent('rival-closes')!,
    size: 0.5,
  });

  it('opens on the year the event happened, bigger in a crowded trade', () => {
    const small = rivalAfter(undefined, opens(), cleaning, 2030, 0.7)!;
    const grand = rivalAfter(undefined, opens(), hotel, 2030, 0.7)!;
    expect(small.since).toBe(2030);
    expect(small.bite).toBeGreaterThan(grand.bite);
    expect(small.bite).toBeLessThanOrEqual(RIVAL_BITE_MAX);
    expect(grand.bite).toBeGreaterThanOrEqual(RIVAL_BITE_MIN);
  });

  it('goes when it closes, and when its four years are up, and otherwise carries on unchanged', () => {
    expect(rivalAfter(RIVAL, closes(), cleaning, 2012, 0.5)).toBeUndefined();
    const fresh: Rival = { since: 2012, bite: 0.1 };
    expect(rivalAfter(fresh, undefined, cleaning, 2012, 0.5)).toBe(fresh);
    expect(rivalAfter(fresh, undefined, cleaning, 2012 + RIVAL_YEARS - 2, 0.5)).toBe(fresh);
    expect(rivalAfter(fresh, undefined, cleaning, 2012 + RIVAL_YEARS - 1, 0.5)).toBeUndefined();
    expect(rivalAfter(undefined, undefined, cleaning, 2012, 0.5)).toBeUndefined();
    // Another event leaves a live rival alone.
    expect(
      rivalAfter(fresh, { event: findBusinessEvent('breakdown')!, size: 0.5 }, cleaning, 2013, 0.5),
    ).toBe(fresh);
  });
});
