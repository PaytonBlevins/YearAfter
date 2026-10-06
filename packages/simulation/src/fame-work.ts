/**
 * Ticket 0707 — what being known gets you offered, and saying yes.
 *
 * Four things (`content/fame-work.ts`): a photoshoot, a commercial, a talk show, a guest-star
 * part. Each can be offered once a year to somebody sixteen or older whose fame has reached
 * its level. What is offered is derived from the seed, the generation, the year and the fame,
 * so nothing about an offer is saved. What is saved is what was said yes to (`celebrities.work`):
 * it stops the same thing being done twice in a year, and it carries the pay to the year's
 * settling, where it is income like any other creator income and is taxed with it (and a
 * manager takes their share, as they do of anything a creator earns).
 *
 * The pay is `times` the going rate for one post at the character's fame, never under the
 * floor. The going rate is `10 ^ ((fame + 18) / 20)`: $100 at fame 22 (a following of ten
 * thousand), $1,000 at about 40, $10,000 at about 60. A talk show and a guest part also bring
 * some of their audience to the biggest channel.
 *
 * Nothing here draws from the shared random stream.
 */

import { findFameWork, FAME_WORK, findPlatform, type FameWorkDef } from '@yearafter/content';
import { err, mixedUnit, ok, stablePick, type Result } from '@yearafter/core';
import { appendToTimeline } from '@yearafter/character';
import type { Channel } from '@yearafter/finance';
import type { FameWorkDone } from './celebrity-state';
import { entryFor, money } from './creators';
import type { GameState } from './game-state';

/** Younger than this, a person is not offered work: nobody's to sign for a child. */
export const WORK_FROM_AGE = 16;
/** The chance of an offer the year a person reaches the level, then a point for each point past. */
export const WORK_CHANCE_BASE = 0.35;
export const WORK_CHANCE_PER_POINT = 0.01;
export const WORK_CHANCE_MAX = 0.85;

/** What one post by somebody at this fame is worth, in dollars. */
export const postRate = (fame: number): number => 10 ** ((fame + 18) / 20);

export const workChance = (fame: number, fromFame: number): number =>
  Math.min(
    WORK_CHANCE_MAX,
    WORK_CHANCE_BASE + Math.max(0, fame - fromFame) * WORK_CHANCE_PER_POINT,
  );

/** Dollars, to the nearest ten, and never under what the thing pays at the very least. */
export const workPay = (def: FameWorkDef, fame: number): number =>
  Math.max(def.floor, Math.round((def.times * postRate(fame)) / 10) * 10);

export interface FameOffer {
  readonly def: FameWorkDef;
  readonly outlet: string;
  readonly pay: number;
  /** How the offer reads on the screen. */
  readonly text: string;
}

const fill = (line: string, outlet: string, pay: number): string =>
  line.replace('{outlet}', outlet).replace('{pay}', money(pay));

/** The year's work, a pure function of the state, in the order the catalog lists it. */
export function fameOffers(state: GameState): readonly FameOffer[] {
  if (!state.player.alive || state.player.age < WORK_FROM_AGE) return [];
  const year = state.world.year;
  const done = state.celebrities.work.year === year ? state.celebrities.work.done : [];
  const seed = state.rng.getSeed();
  const offers: FameOffer[] = [];
  for (const def of FAME_WORK) {
    if (state.fame < def.fromFame || done.some((entry) => entry.id === def.id)) continue;
    const key = `${seed}:${state.world.generation}:${year}:fame-work:${def.id}`;
    if (mixedUnit(`${key}:happens`) >= workChance(state.fame, def.fromFame)) continue;
    const outlet = stablePick(def.outlets, `${key}:outlet`) ?? def.outlets[0] ?? '';
    const pay = workPay(def, state.fame);
    const line = stablePick(def.offers, `${key}:offer`) ?? def.offers[0] ?? '';
    offers.push({ def, outlet, pay, text: fill(line, outlet, pay) });
  }
  return offers;
}

/** The biggest channel by audience, the one a talk show or a part points people at. */
export function biggestChannel(channels: readonly Channel[]): Channel | undefined {
  let best: Channel | undefined;
  for (const channel of channels) {
    if (
      best === undefined ||
      channel.audience > best.audience ||
      (channel.audience === best.audience && channel.id < best.id)
    ) {
      best = channel;
    }
  }
  return best;
}

export type FameWorkRefusal = { readonly kind: 'notOffered' };

/** Say yes. The audience comes now; the pay, the fame and the mood come when the year is settled. */
export function doFameWork(state: GameState, id: string): Result<GameState, FameWorkRefusal> {
  const offer = fameOffers(state).find((row) => row.def.id === id);
  if (offer === undefined) return err({ kind: 'notOffered' });
  const { def } = offer;
  const year = state.world.year;
  const key = `${state.rng.getSeed()}:${state.world.generation}:${year}:fame-work:${def.id}`;
  const target = def.audience === undefined ? undefined : biggestChannel(state.channels);
  let gain = 0;
  if (target !== undefined && def.audience !== undefined && target.audience > 0) {
    const share = def.audience[0] + (def.audience[1] - def.audience[0]) * mixedUnit(`${key}:size`);
    gain = Math.max(1, Math.round(share * target.audience));
  }
  const platform = target === undefined ? undefined : findPlatform(target.platformId);
  const line = stablePick(def.lines, `${key}:line`) ?? def.lines[0] ?? '';
  const text =
    fill(line, offer.outlet, offer.pay) +
    (gain > 0
      ? ` About ${gain.toLocaleString('en-US')} new ${platform?.audienceWord ?? 'followers'} came over to ${target!.name}.`
      : '');
  const entry: FameWorkDone = {
    id: def.id,
    outlet: offer.outlet,
    pay: offer.pay,
    fame: def.fame,
    mood: def.mood,
  };
  const before = state.celebrities.work.year === year ? state.celebrities.work.done : [];
  return ok({
    ...state,
    channels:
      target === undefined || gain === 0
        ? state.channels
        : state.channels.map((channel) =>
            channel.id === target.id
              ? {
                  ...channel,
                  audience: channel.audience + gain,
                  peak: Math.max(channel.peak, channel.audience + gain),
                }
              : channel,
          ),
    celebrities: { ...state.celebrities, work: { year, done: [...before, entry] } },
    player: {
      ...state.player,
      timeline: appendToTimeline(
        state.player.timeline,
        entryFor(state, text, `fame-work:${def.id}`),
      ),
    },
  });
}

/** What has been said yes to in the year that is ending, to settle with its income. */
export function workToSettle(state: GameState): readonly FameWorkDone[] {
  return state.celebrities.work.year === state.world.year ? state.celebrities.work.done : [];
}

export const knownWork = (id: string): FameWorkDef | undefined => findFameWork(id);
