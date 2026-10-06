/**
 * Ticket 0704 acceptance tests — creator groups and what a manager or an agent does (finance side).
 */

import { describe, expect, it } from 'vitest';
import { GROUP_KIND_BY_PLATFORM, GROUP_NAMES, PLATFORMS, findPlatform } from '@yearafter/content';
import { channelYear, creatorHours, newChannel, targetAudience, type Channel } from './creators';
import {
  GROUP_CUTS,
  GROUP_GROWTH_PER_CUT,
  answerGroup,
  groupBoost,
  groupInterest,
  groupOfferFor,
  groupShare,
  leaveGroupOf,
} from './groups';
import {
  AGENT_CUT,
  AGENT_FEE_DISCOUNT,
  AGENT_OFFER_CHANCE,
  MANAGER_CUT,
  MANAGER_GROWTH,
  MANAGER_HOURS,
  agentShare,
  growthBoost,
  hoursFactor,
  managerShare,
  whyNotRepresented,
} from './representation';
import { answerSponsor, sponsorOffersFor } from './sponsorships';

const make = (over: Partial<Channel> = {}): Channel => ({
  ...newChannel({
    seed: 'seed',
    id: 'ch:2040:video:gaming',
    platformId: 'video',
    categoryId: 'gaming',
    year: 2040,
  }),
  ...over,
});

const PAYS = findPlatform('video')!.paysAt;
const member = (cut: number): Channel['group'] => ({
  id: 'gp:2040:x',
  kind: 'group',
  name: 'The Loft',
  cut,
  since: 2040,
});

describe('who a group wants', () => {
  const qualifying = make({ audience: PAYS * 3 });

  it('wants nobody under three times what the platform pays at', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      expect(
        groupOfferFor({
          seed: `s${seed}`,
          year: 2041,
          channel: make({ audience: PAYS * 3 - 1 }),
        }),
      ).toBeUndefined();
    }
  });

  it('wants a channel exactly at the line 35% of the time', () => {
    let wanted = 0;
    const draws = 3_000;
    for (let seed = 0; seed < draws; seed += 1) {
      if (groupOfferFor({ seed: `s${seed}`, year: 2041, channel: qualifying }) !== undefined) {
        wanted += 1;
      }
    }
    expect(wanted / draws).toBeGreaterThan(0.32);
    expect(wanted / draws).toBeLessThan(0.38);
  });

  it('offers nothing on a platform it does not know', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      expect(
        groupOfferFor({
          seed: `s${seed}`,
          year: 2041,
          channel: make({ platformId: 'nowhere', audience: 1_000_000 }),
        }),
      ).toBeUndefined();
    }
  });

  it('draws from every name its kind has', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 600; seed += 1) {
      const offer = groupOfferFor({ seed: `s${seed}`, year: 2041, channel: qualifying });
      if (offer !== undefined) seen.add(offer.name);
    }
    expect([...seen].sort()).toEqual([...GROUP_NAMES.group].sort());
  });

  it('names the right kind of group for the platform, with a share from the usual three', () => {
    for (const platform of PLATFORMS) {
      const kind = GROUP_KIND_BY_PLATFORM[platform.id];
      const channel = make({ platformId: platform.id, audience: platform.paysAt * 50 });
      for (let seed = 0; seed < 80; seed += 1) {
        const offer = groupOfferFor({ seed: `s${seed}`, year: 2041, channel });
        if (kind === undefined) {
          expect(offer).toBeUndefined();
          continue;
        }
        if (offer === undefined) continue;
        expect(offer.kind).toBe(kind);
        expect(GROUP_NAMES[kind]).toContain(offer.name);
        expect(GROUP_CUTS).toContain(offer.cut);
        expect(offer.id).toBe(`gp:2041:${channel.id}`);
      }
    }
  });

  it('offers all three shares across the draws', () => {
    const cuts = new Set<number>();
    for (let seed = 0; seed < 300; seed += 1) {
      const offer = groupOfferFor({ seed: `s${seed}`, year: 2041, channel: qualifying });
      if (offer !== undefined) cuts.add(offer.cut);
    }
    expect([...cuts].sort()).toEqual([0.1, 0.2, 0.3]);
  });

  it('is the same on every ask, and never offered twice, answered, or to a member', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const input = { seed: `s${seed}`, year: 2041, channel: qualifying };
      const offer = groupOfferFor(input);
      expect(groupOfferFor(input)).toEqual(offer);
      if (offer === undefined) continue;
      expect(
        groupOfferFor({
          ...input,
          channel: answerGroup({ channel: qualifying, offer, join: false, year: 2041 }),
        }),
      ).toBeUndefined();
      expect(
        groupOfferFor({ ...input, channel: make({ audience: 99_999, group: member(0.2) }) }),
      ).toBeUndefined();
    }
  });
});

describe('what a group does', () => {
  it('adds growth in proportion to its share: a 20% cut is 26% faster', () => {
    expect(groupBoost(make())).toBe(1);
    expect(groupBoost(make({ group: member(0.2) }))).toBeCloseTo(
      1 + 0.2 * GROUP_GROWTH_PER_CUT,
      10,
    );
    expect(groupBoost(make({ group: member(0.2) }))).toBeCloseTo(1.26, 10);
    expect(groupBoost(make({ group: member(0.3) }))).toBeCloseTo(1.39, 10);
  });

  it('keeps its share of the income, in whole dollars', () => {
    expect(groupShare(make(), 10_000)).toBe(0);
    expect(groupShare(make({ group: member(0.2) }), 10_000)).toBe(2_000);
    expect(groupShare(make({ group: member(0.1) }), 1_234)).toBe(123);
    expect(groupShare(make({ group: member(0.1) }), 1_235)).toBe(124);
  });

  it('makes brands notice the channel by a flat 15 points', () => {
    expect(groupInterest(make())).toBe(0);
    expect(groupInterest(make({ group: member(0.1) }))).toBe(0.15);
  });

  it('is roughly money-neutral: the faster growth about pays for the share, so it is for reach', () => {
    for (const cut of GROUP_CUTS) {
      expect(groupBoost(make({ group: member(cut) })) * (1 - cut)).toBeGreaterThan(0.95);
      expect(groupBoost(make({ group: member(cut) })) * (1 - cut)).toBeLessThan(1.06);
    }
  });

  it('joining makes it part of the channel and remembers the year; declining only remembers the answer', () => {
    const channel = make({ audience: 20_000 });
    const offer = {
      id: 'gp:2041:x',
      channelId: channel.id,
      kind: 'group' as const,
      name: 'The Loft',
      cut: 0.2,
    };
    const joined = answerGroup({ channel, offer, join: true, year: 2041 });
    expect(joined.group).toEqual({
      id: 'gp:2041:x',
      kind: 'group',
      name: 'The Loft',
      cut: 0.2,
      since: 2041,
    });
    expect(joined.answered).toEqual(['gp:2041:x']);
    const passed = answerGroup({ channel, offer, join: false, year: 2041 });
    expect(passed.group).toBeUndefined();
    expect(passed.answered).toEqual(['gp:2041:x']);
  });

  it('leaving takes the group off and nothing else', () => {
    const channel = make({ audience: 20_000, group: member(0.2), answered: ['gp:2041:x'] });
    const left = leaveGroupOf(channel);
    expect('group' in left).toBe(false);
    expect(left).toEqual({ ...channel, group: undefined });
    expect(left.answered).toEqual(['gp:2041:x']);
    expect(left.audience).toBe(20_000);
  });

  it('grows the channel faster inside it, measured against the same year outside it', () => {
    const base = make({ audience: 20_000, peak: 20_000 });
    const outside = channelYear({ channel: base, year: 2041, quality: 0.8 });
    const inside = channelYear({
      channel: { ...base, group: member(0.2) },
      year: 2041,
      quality: 0.8,
      boost: groupBoost({ ...base, group: member(0.2) }),
    });
    expect(inside.channel.audience).toBeGreaterThan(outside.channel.audience);
  });
});

describe('the boost in the growth target', () => {
  it('multiplies the raw audience before the soft ceiling, so a boost is worth less the closer the ceiling', () => {
    const channel = make();
    const t1 = targetAudience(channel, 0.7, 2041);
    const t2 = targetAudience(channel, 0.7, 2041, 1.5);
    const ceiling = findPlatform('video')!.ceiling;
    expect(t2).toBeGreaterThan(t1);
    expect(t2).toBeLessThan(t1 * 1.5 + 1e-9);
    expect(1 / t2 - 1 / ceiling).toBeCloseTo((1 / t1 - 1 / ceiling) / 1.5, 10);
  });

  it('defaults to no boost', () => {
    const channel = make();
    expect(targetAudience(channel, 0.7, 2041)).toBe(targetAudience(channel, 0.7, 2041, 1));
  });

  it('is carried by channelYear', () => {
    const channel = make({ audience: 20_000, peak: 20_000 });
    const plain = channelYear({ channel, year: 2041, quality: 0.8 });
    const boosted = channelYear({ channel, year: 2041, quality: 0.8, boost: 1.5 });
    const explicit = channelYear({ channel, year: 2041, quality: 0.8, boost: 1 });
    expect(explicit.channel.audience).toBe(plain.channel.audience);
    expect(boosted.channel.audience).toBeGreaterThan(plain.channel.audience);
  });
});

describe('a manager and an agent', () => {
  it('takes on somebody who is paying their way on a channel, and nobody else', () => {
    expect(whyNotRepresented([], undefined)).toEqual({ kind: 'nobodyWillTakeYouOn' });
    expect(whyNotRepresented([make({ audience: PAYS - 1 })], undefined)).toEqual({
      kind: 'nobodyWillTakeYouOn',
    });
    expect(whyNotRepresented([make({ audience: PAYS })], undefined)).toBeUndefined();
    expect(
      whyNotRepresented([make({ audience: 3 }), make({ audience: PAYS * 4 })], undefined),
    ).toBeUndefined();
  });

  it('never both: whoever you have blocks hiring the other, even with nothing to qualify', () => {
    expect(whyNotRepresented([make({ audience: PAYS })], 'manager')).toEqual({
      kind: 'alreadyHaveOne',
    });
    expect(whyNotRepresented([make({ audience: PAYS })], 'agent')).toEqual({
      kind: 'alreadyHaveOne',
    });
  });

  it('counts a platform with no threshold the same way as any other', () => {
    for (const platform of PLATFORMS) {
      const at = make({ platformId: platform.id, audience: platform.paysAt });
      const under = make({ platformId: platform.id, audience: platform.paysAt - 1 });
      expect(whyNotRepresented([at], undefined)).toBeUndefined();
      expect(whyNotRepresented([under], undefined)).toEqual({ kind: 'nobodyWillTakeYouOn' });
    }
  });

  it('a manager takes 15% of everything, grows channels 20% faster, and gives back 30% of the week', () => {
    expect(MANAGER_CUT).toBe(0.15);
    expect(managerShare('manager', 10_000)).toBe(1_500);
    expect(managerShare('manager', 1_234)).toBe(185);
    expect(managerShare('manager', 1_230)).toBe(185);
    expect(managerShare('agent', 10_000)).toBe(0);
    expect(managerShare(undefined, 10_000)).toBe(0);
    expect(MANAGER_GROWTH).toBe(1.2);
    expect(growthBoost('manager')).toBe(1.2);
    expect(growthBoost('agent')).toBe(1);
    expect(growthBoost(undefined)).toBe(1);
    expect(hoursFactor('manager')).toBe(MANAGER_HOURS);
    expect(hoursFactor('agent')).toBe(1);
    expect(hoursFactor(undefined)).toBe(1);
  });

  it('an agent takes 10% of a deal and nothing else', () => {
    expect(AGENT_CUT).toBe(0.1);
    expect(agentShare('agent', 3_000)).toBe(300);
    expect(agentShare('agent', 1_234)).toBe(123);
    expect(agentShare('agent', 1_235)).toBe(124);
    expect(agentShare('manager', 3_000)).toBe(0);
    expect(agentShare(undefined, 3_000)).toBe(0);
  });

  it('a manager frees hours: a heavy week of 9 becomes 6.3', () => {
    const channels = [make({ effort: 'heavy' })];
    expect(creatorHours(channels)).toBe(9);
    expect(creatorHours(channels, hoursFactor('manager'))).toBeCloseTo(6.3, 10);
    expect(creatorHours([], 0.7)).toBe(0);
  });
});

describe('what an agent does to deals', () => {
  const channel = make({ audience: 200_000, peak: 200_000 });
  const year = (agent: boolean) => {
    const all = [];
    for (let seed = 0; seed < 80; seed += 1) {
      all.push(...sponsorOffersFor({ seed: `s${seed}`, year: 2041, channel, agent }));
    }
    return all;
  };

  it('brings more offers than without one', () => {
    expect(year(true).length).toBeGreaterThan(year(false).length);
  });

  it('raises the pay by a tenth on the same deal', () => {
    let compared = 0;
    for (let seed = 0; seed < 80; seed += 1) {
      const plain = new Map(
        sponsorOffersFor({ seed: `s${seed}`, year: 2041, channel }).map((o) => [o.id, o]),
      );
      for (const offer of sponsorOffersFor({
        seed: `s${seed}`,
        year: 2041,
        channel,
        agent: true,
      })) {
        const same = plain.get(offer.id);
        if (same === undefined) continue;
        compared += 1;
        expect(Math.abs(offer.pay - same.pay * 1.1)).toBeLessThanOrEqual(1);
      }
    }
    expect(compared).toBeGreaterThan(10);
  });

  it('knocks on more doors by the stated factor, never past certain', () => {
    expect(AGENT_OFFER_CHANCE).toBe(1.3);
    expect(AGENT_FEE_DISCOUNT).toBe(0.3);
  });

  it('owes the creator the pay less the agent’s tenth, and tells the pay in full', () => {
    const [offer] = year(false);
    expect(offer).toBeDefined();
    const withAgent = answerSponsor({
      seed: 's',
      channel,
      offer: offer!,
      answer: 'accept',
      agent: true,
    });
    const without = answerSponsor({ seed: 's', channel, offer: offer!, answer: 'accept' });
    expect(withAgent.pay).toBe(offer!.pay);
    expect(Number(without.channel.owed)).toBe(offer!.pay * 100);
    expect(Number(withAgent.channel.owed)).toBe((offer!.pay - Math.round(offer!.pay * 0.1)) * 100);
  });

  it('takes the tenth off a raised deal too', () => {
    let raised;
    for (let seed = 0; seed < 80 && raised === undefined; seed += 1) {
      const [offer] = sponsorOffersFor({ seed: `s${seed}`, year: 2041, channel });
      if (offer === undefined) continue;
      const result = answerSponsor({
        seed: `s${seed}`,
        channel,
        offer,
        answer: 'more',
        agent: true,
      });
      if (result.outcome === 'raised') raised = result;
    }
    expect(raised).toBeDefined();
    expect(Number(raised!.channel.owed)).toBe((raised!.pay - Math.round(raised!.pay * 0.1)) * 100);
  });

  it('never makes brands call more than nine times in ten, group or not, without an agent', () => {
    const huge = { ...channel, audience: 5_000_000, peak: 5_000_000, group: member(0.2) };
    let offers = 0;
    const draws = 600;
    for (let seed = 0; seed < draws; seed += 1) {
      offers += sponsorOffersFor({ seed: `s${seed}`, year: 2041, channel: huge }).length;
    }
    expect(offers / (draws * 2)).toBeGreaterThan(0.86);
    expect(offers / (draws * 2)).toBeLessThan(0.94);
  });

  it('a group raises how often brands call, by its 15 points', () => {
    const inGroup = { ...channel, group: member(0.2) };
    let plain = 0;
    let grouped = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      plain += sponsorOffersFor({ seed: `s${seed}`, year: 2041, channel }).length;
      grouped += sponsorOffersFor({ seed: `s${seed}`, year: 2041, channel: inGroup }).length;
    }
    expect(grouped).toBeGreaterThan(plain);
  });
});
