import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { emptyLetting, type OwnedHome, type Tenant } from '@yearafter/finance';
import { CONDITIONS } from '@yearafter/health';
import { openBusiness, runHomesYear, type GameState } from '@yearafter/simulation';
import { ADULT, withBookedCash } from '../test/entertainmentFixtures';
import { annualNoticeGroups, noticeGroupsBody } from './annualNoticeGroups';

const tenant: Tenant = {
  id: 'original',
  name: 'Jordan',
  since: ADULT.world.year,
  income: 120000,
  credit: 'good',
  work: 'steady',
  household: 1,
  evictions: 0,
};
const property: OwnedHome = {
  id: 'rental',
  kindId: 'home.duplex',
  beds: 4,
  baths: 2,
  builtYear: 1990,
  condition: 'good',
  regionKey: 'us:ohio',
  regionName: 'Ohio',
  purchasePrice: dollars(250000),
  value: dollars(250000),
  boughtYear: tenant.since,
  expenseRate: 0.024,
  behindYears: 0,
  letting: { ...emptyLetting(2), managed: true, tenants: [tenant, null] },
};
const next = (s: GameState): GameState => ({ ...s, world: { ...s.world, year: s.world.year + 1 } });

describe('yearly player notices', () => {
  it('reports departures even when an agent refills the unit, and lets the same tenant renew for two years', () => {
    const before = { ...ADULT, homes: [property] };
    const year = before.world.year + 1;
    let renewed = 0;
    let replaced = 0;
    for (let i = 0; i < 100; i++) {
      const seed = `tenant-notice-${i}`;
      const first = runHomesYear([property], year, seed).homes;
      const second = runHomesYear(first, year + 1, seed).homes;
      if (second[0]?.letting?.tenants[0]?.id === tenant.id) {
        renewed++;
        expect(second[0].letting.tenants[0]?.since).toBe(tenant.since);
        expect(annualNoticeGroups(before, { ...next(before), homes: first })).toEqual([]);
      }
      if (first[0]?.letting?.tenants[0] && first[0].letting.tenants[0].id !== tenant.id) {
        replaced++;
        const text = noticeGroupsBody(
          annualNoticeGroups(before, { ...next(before), homes: first }),
          true,
        );
        expect(text).toContain('Jordan stopped renting');
        expect(text).toContain('All units are occupied now');
      }
    }
    expect(renewed).toBeGreaterThan(10);
    expect(replaced).toBeGreaterThan(10);
  });

  it('notifies about a newly acquired illness and does not repeat it next year', () => {
    const illness = CONDITIONS.find((kind) => kind.from === 'illness')!;
    const after = {
      ...next(ADULT),
      health: {
        ...ADULT.health,
        conditions: [{ conditionId: illness.id, since: ADULT.player.age + 1, treated: false }],
      },
    };
    const notice = annualNoticeGroups(ADULT, after);
    expect(notice[0]?.field).toBe('Health update');
    expect(notice[0]?.lines[0]).toContain(illness.label);
    expect(notice[0]?.lines[0]).toContain('Doctor');
    expect(annualNoticeGroups(after, next(after))).toEqual([]);
  });

  it('reports actual profit or loss, demand, and rival impact for the year that just closed', () => {
    const opened = openBusiness(withBookedCash(ADULT, 5000000), 'biz.racing');
    if (!opened.ok) throw Error(opened.error);
    const state = opened.value.state;
    const [business] = state.businesses;
    const figures = {
      revenue: 55000,
      costs: 60000,
      profit: -5000,
      drawn: 0,
      injected: 0,
      turnedAway: 0.2,
      idle: 0,
    };
    const before = {
      ...state,
      businesses: [
        {
          ...business!,
          last: { ...figures, year: state.world.year, economy: 0.95, rivalTook: 0.1 },
        },
      ],
    };
    const after = {
      ...next(before),
      businesses: [
        {
          ...business!,
          last: { ...figures, year: state.world.year + 1, economy: 0.9, rivalTook: 0.2 },
        },
      ],
    };
    const text = noticeGroupsBody(annualNoticeGroups(before, after), true);
    expect(text).toContain('$55,000 revenue; $5,000 loss');
    expect(text).toContain('90% of normal, previously 95%');
    expect(text).toContain('20% of customer demand, previously 10%');
    expect(annualNoticeGroups(after, next(after))).toEqual([]);
  });
});
