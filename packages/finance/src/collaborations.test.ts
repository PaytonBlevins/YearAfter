/**
 * Ticket 0704 acceptance tests — working with other creators (finance side).
 */

import { describe, expect, it } from 'vitest';
import { COLLAB_PARTNERS } from '@yearafter/content';
import { newChannel, type Channel } from './creators';
import {
  BIG_NAME,
  COLLAB_FEE_RATE,
  COLLAB_MAX_SHARE,
  COLLAB_POOL,
  FRIEND_AUDIENCE,
  MAX_COLLAB_OFFERS,
  MIN_COLLAB_AUDIENCE,
  MIN_COLLAB_FEE,
  MIN_COLLAB_GAIN,
  PARTNER_RATIO,
  REPEAT_FADE,
  answerCollab,
  collabFee,
  collabGain,
  collabOffersFor,
  reachShare,
  worthCollab,
} from './collaborations';

const make = (over: Partial<Channel> = {}): Channel => ({
  ...newChannel({
    seed: 'seed',
    id: 'ch:2040:video:gaming',
    platformId: 'video',
    categoryId: 'gaming',
    year: 2040,
  }),
  audience: 5_000,
  peak: 5_000,
  ...over,
});

const FRIENDS = [
  { id: 'p1', name: 'Dana Reyes' },
  { id: 'p2', name: 'Sam Okafor' },
];

/** Every offer this many seeds and years produce, to look at the spread rather than one draw. */
function manyOffers(over: Partial<Channel> = {}, friends = FRIENDS, agent = false, seeds = 60) {
  const channel = make(over);
  const all = [];
  for (let seed = 0; seed < seeds; seed += 1) {
    for (let year = 2040; year < 2046; year += 1) {
      all.push(
        ...collabOffersFor({ seed: `s${seed}`, year, channel, friends, agent }).map((offer) => ({
          offer,
          channel,
        })),
      );
    }
  }
  return all;
}

describe('how much of a collaboration a channel gets', () => {
  it('all of it up to ten thousand people, a third at a hundred thousand, a fifth at a million', () => {
    expect(reachShare(1)).toBe(1);
    expect(reachShare(10_000)).toBe(1);
    expect(reachShare(100_000)).toBeCloseTo(1 / 3, 10);
    expect(reachShare(1_000_000)).toBeCloseTo(1 / 5, 10);
  });

  it('pins a gain: a 20,000 partner brings 4% of them to a 5,000 channel', () => {
    expect(collabGain(5_000, 20_000, 0)).toBe(800);
  });

  it('is capped at 35% of the channel so a tiny channel cannot be doubled by one guest', () => {
    expect(collabGain(1_000, 1_000_000, 0)).toBe(
      Math.round(1_000 * COLLAB_MAX_SHARE * reachShare(1_000)),
    );
    expect(collabGain(1_000, 1_000_000, 0)).toBe(350);
  });

  it('halves each time with the same person: a repeat is a repeat', () => {
    const first = collabGain(5_000, 20_000, 0);
    expect(collabGain(5_000, 20_000, 1)).toBe(Math.round(first * REPEAT_FADE));
    expect(collabGain(5_000, 20_000, 2)).toBe(Math.round(first * REPEAT_FADE ** 2));
  });

  it('brings a big channel a smaller share of itself than a small one gets from the same partner', () => {
    expect(collabGain(200_000, 400_000, 0) / 200_000).toBeLessThan(
      collabGain(10_000, 400_000, 0) / 10_000,
    );
  });
});

describe('what a stranger charges', () => {
  it('nothing from someone your size, smaller, or up to one and a half times you', () => {
    expect(collabFee(10_000, 3_000, 0)).toBe(0);
    expect(collabFee(10_000, 10_000, 0)).toBe(0);
    expect(collabFee(10_000, 10_000 * BIG_NAME, 0)).toBe(0);
  });

  it('charges a cent of a dollar and a half a follower once they are bigger than that', () => {
    expect(collabFee(10_000, 100_000, 0)).toBe(Math.round(100_000 * COLLAB_FEE_RATE));
    expect(collabFee(10_000, 100_000, 0)).toBe(1_500);
  });

  it('never charges less than the minimum when it charges at all', () => {
    expect(MIN_COLLAB_FEE).toBe(25);
    expect(collabFee(100, 200, 0)).toBe(25);
  });

  it('comes down by the discount an agent bargains', () => {
    expect(collabFee(10_000, 100_000, 0.3)).toBe(1_050);
  });
});

describe('the offers on the table', () => {
  it('starts at a hundred people: 99 has nothing and 100 sometimes has an offer', () => {
    expect(MIN_COLLAB_AUDIENCE).toBe(100);
    const at = (audience: number) =>
      manyOffers({ audience, peak: audience }, [], false, 200).length;
    expect(at(99)).toBe(0);
    expect(at(100)).toBeGreaterThan(0);
  });

  it('has none for a channel with nobody to trade', () => {
    expect(
      collabOffersFor({
        seed: 'x',
        year: 2040,
        channel: make({ audience: MIN_COLLAB_AUDIENCE - 1 }),
        friends: FRIENDS,
      }),
    ).toEqual([]);
  });

  it('names an offer by the year, the channel and the slot', () => {
    for (const { offer } of manyOffers()) {
      expect(offer.id).toMatch(/^co:20(40|41|42|43|44|45):ch:2040:video:gaming:[01]$/);
    }
  });

  it('is the same on every ask, and never more than two in a year', () => {
    expect(MAX_COLLAB_OFFERS).toBe(2);
    const channel = make();
    for (let seed = 0; seed < 40; seed += 1) {
      const input = { seed: `s${seed}`, year: 2041, channel, friends: FRIENDS };
      const a = collabOffersFor(input);
      expect(collabOffersFor(input)).toEqual(a);
      expect(a.length).toBeLessThanOrEqual(2);
    }
  });

  it('comes about half the time per slot', () => {
    const slots = 60 * 6 * MAX_COLLAB_OFFERS;
    const rate = manyOffers().length / slots;
    expect(rate).toBeGreaterThan(0.3);
    expect(rate).toBeLessThan(0.6);
  });

  it('does not come back once answered, and skips only the answered one', () => {
    const channel = make();
    let found: ReturnType<typeof collabOffersFor> = [];
    for (let seed = 0; seed < 80 && found.length < 2; seed += 1) {
      found = collabOffersFor({ seed: `s${seed}`, year: 2041, channel, friends: [] });
      if (found.length === 2) {
        const first = found[0]!;
        const after = collabOffersFor({
          seed: `s${seed}`,
          year: 2041,
          channel: answerCollab({ channel, offer: first, accept: false }),
          friends: [],
        });
        expect(after.map((o) => o.id)).toEqual([found[1]!.id]);
      }
    }
    expect(found).toHaveLength(2);
  });

  it('brings friends over for nothing, with a following of their own', () => {
    const friendOffers = manyOffers().filter(({ offer }) => offer.partner.friend);
    expect(friendOffers.length).toBeGreaterThan(20);
    for (const { offer } of friendOffers) {
      expect(offer.fee).toBe(0);
      expect(offer.partner.id).toMatch(/^f:p[12]$/);
      expect(['Dana Reyes', 'Sam Okafor']).toContain(offer.partner.name);
      expect(offer.partner.audience).toBeGreaterThanOrEqual(100);
      expect(offer.partner.audience).toBeLessThanOrEqual(50_000);
    }
  });

  it('gives each friend their own following, from a hundred to fifty thousand, and they are free however big', () => {
    expect(FRIEND_AUDIENCE).toEqual([100, 50_000]);
    const crowd = Array.from({ length: 60 }, (_, i) => ({ id: `q${i}`, name: `Friend ${i}` }));
    const offers = manyOffers({}, crowd, false, 120).filter(({ offer }) => offer.partner.friend);
    const byFriend = new Map(offers.map(({ offer }) => [offer.partner.id, offer.partner.audience]));
    expect(byFriend.size).toBeGreaterThan(40);
    const sizes = [...byFriend.values()];
    expect(new Set(sizes).size).toBeGreaterThan(30);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(100);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(50_000);
    expect(Math.min(...sizes)).toBeLessThan(250);
    expect(Math.max(...sizes)).toBeGreaterThan(30_000);
    // Somebody much bigger than the channel, and still free.
    const big = offers.filter(({ offer }) => offer.partner.audience > 5_000 * 1.5);
    expect(big.length).toBeGreaterThan(10);
    for (const { offer } of big) expect(offer.fee).toBe(0);
  });

  it('brings a friend about a third of the time when there are friends, and never with none', () => {
    const all = manyOffers({}, FRIENDS, false, 300);
    const share = all.filter(({ offer }) => offer.partner.friend).length / all.length;
    expect(share).toBeGreaterThan(0.31);
    expect(share).toBeLessThan(0.39);
    expect(manyOffers({}, []).some(({ offer }) => offer.partner.friend)).toBe(false);
  });

  it('keeps a stranger inside a few names so the same people come round again', () => {
    const ids = new Set(
      manyOffers({}, [])
        .map(({ offer }) => offer.partner.id)
        .filter((id) => id.startsWith('p:')),
    );
    expect(COLLAB_POOL).toBe(6);
    expect(ids.size).toBe(6);
    const names = new Set(manyOffers({}, []).map(({ offer }) => offer.partner.name));
    for (const name of names) expect(COLLAB_PARTNERS).toContain(name);
  });

  /** What strangers look like across a lot of different channels of this size. */
  const strangersAcross = (audience: number): number[] => {
    const sizes: number[] = [];
    for (let i = 0; i < 80; i += 1) {
      const channel = make({ id: `ch:2040:video:gaming:${i}`, audience, peak: audience });
      for (let seed = 0; seed < 30; seed += 1) {
        for (const offer of collabOffersFor({
          seed: `s${seed}`,
          year: 2041,
          channel,
          friends: [],
        })) {
          sizes.push(offer.partner.audience);
        }
      }
    }
    return sizes;
  };

  it('sizes a stranger by the channel, from 0.3 to 5 times it, and both ends are reached', () => {
    expect(PARTNER_RATIO).toEqual([0.3, 5]);
    const sizes = strangersAcross(5_000);
    expect(sizes.length).toBeGreaterThan(500);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(1_500);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(25_000);
    expect(Math.min(...sizes)).toBeLessThan(1_800);
    expect(Math.max(...sizes)).toBeGreaterThan(22_000);
  });

  it('a stranger too small to bring anybody over is never offered, however small the channel', () => {
    const sizes = strangersAcross(100);
    expect(sizes.length).toBeGreaterThan(100);
    // Four percent of fewer than 113 people rounds to fewer than five.
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(113);
  });

  it('counts five new people as worth an offer and four as not', () => {
    expect(MIN_COLLAB_GAIN).toBe(5);
    expect(worthCollab(4)).toBe(false);
    expect(worthCollab(5)).toBe(true);
  });

  it('only offers what is worth the trouble', () => {
    for (const { offer } of manyOffers()) {
      expect(offer.gain).toBeGreaterThanOrEqual(MIN_COLLAB_GAIN);
    }
    // 120 followers: a partner a third your size brings almost nobody.
    const tiny = manyOffers({ audience: 120, peak: 120 }, []);
    for (const { offer } of tiny) expect(offer.gain).toBeGreaterThanOrEqual(MIN_COLLAB_GAIN);
  });

  it('charges only strangers bigger than one and a half times the channel', () => {
    const strangers = manyOffers({}, []);
    const charged = strangers.filter(({ offer }) => offer.fee > 0);
    const free = strangers.filter(({ offer }) => offer.fee === 0);
    expect(charged.length).toBeGreaterThan(10);
    expect(free.length).toBeGreaterThan(10);
    for (const { offer } of charged) {
      expect(offer.partner.audience).toBeGreaterThan(5_000 * BIG_NAME);
      expect(offer.fee).toBe(collabFee(5_000, offer.partner.audience, 0));
    }
    for (const { offer } of free)
      expect(offer.partner.audience).toBeLessThanOrEqual(5_000 * BIG_NAME);
  });

  it('takes 30% off what strangers charge with an agent', () => {
    const plain = manyOffers({}, [], false).filter(({ offer }) => offer.fee > 0);
    const agented = manyOffers({}, [], true).filter(({ offer }) => offer.fee > 0);
    expect(agented.length).toBe(plain.length);
    plain.forEach(({ offer }, index) => {
      expect(agented[index]!.offer.fee).toBe(collabFee(5_000, offer.partner.audience, 0.3));
      expect(agented[index]!.offer.fee).toBeLessThan(offer.fee);
    });
  });

  it('charges nothing at all inside a group: its own people are free', () => {
    const inGroup = make({
      group: { id: 'gp:2040:x', kind: 'group', name: 'The Loft', cut: 0.2, since: 2040 },
    });
    const offers = [];
    for (let seed = 0; seed < 60; seed += 1) {
      offers.push(
        ...collabOffersFor({ seed: `s${seed}`, year: 2041, channel: inGroup, friends: [] }),
      );
    }
    expect(offers.length).toBeGreaterThan(20);
    expect(offers.some((offer) => offer.fee > 0)).toBe(false);
    // The same draws outside the group would have charged somebody.
    expect(manyOffers({}, []).some(({ offer }) => offer.fee > 0)).toBe(true);
  });

  it('carries the repeat count of a partner already worked with', () => {
    const first = manyOffers({}, [])[0]!.offer;
    const worked = make({ collabs: { [first.partner.id]: 2 } });
    const again = collabOffersFor({
      seed: 's0',
      year: 2040,
      channel: worked,
      friends: [],
    }).find((offer) => offer.partner.id === first.partner.id);
    // Find any offer for that partner under the worked channel across the draws.
    let seen = again;
    for (let seed = 0; seen === undefined && seed < 60; seed += 1) {
      seen = collabOffersFor({ seed: `s${seed}`, year: 2040, channel: worked, friends: [] }).find(
        (offer) => offer.partner.id === first.partner.id,
      );
    }
    expect(seen).toBeDefined();
    expect(seen!.repeats).toBe(2);
    expect(seen!.gain).toBe(collabGain(5_000, seen!.partner.audience, 2));
  });
});

describe('answering a collaboration', () => {
  const offer = {
    id: 'co:2040:ch:2040:video:gaming:0',
    channelId: 'ch:2040:video:gaming',
    partner: { id: 'p:x:1', name: 'Mara Quill', friend: false, audience: 20_000 },
    fee: 0,
    gain: 800,
    repeats: 0,
  };

  it('brings the people over, lifts the peak, and remembers the partner', () => {
    const after = answerCollab({ channel: make(), offer, accept: true });
    expect(after.audience).toBe(5_800);
    expect(after.peak).toBe(5_800);
    expect(after.collabs).toEqual({ 'p:x:1': 1 });
    expect(after.answered).toEqual([offer.id]);
  });

  it('leaves a peak that is already higher alone', () => {
    const after = answerCollab({
      channel: make({ peak: 90_000 }),
      offer,
      accept: true,
    });
    expect(after.peak).toBe(90_000);
  });

  it('counts a repeat one up from where it was and keeps the others', () => {
    const after = answerCollab({
      channel: make({ collabs: { 'p:x:1': 1, 'p:other': 3 } }),
      offer: { ...offer, repeats: 1 },
      accept: true,
    });
    expect(after.collabs).toEqual({ 'p:x:1': 2, 'p:other': 3 });
  });

  it('changes nothing but the answered list when turned down', () => {
    const channel = make({ answered: ['old'] });
    const after = answerCollab({ channel, offer, accept: false });
    expect(after).toEqual({ ...channel, answered: ['old', offer.id] });
  });
});
