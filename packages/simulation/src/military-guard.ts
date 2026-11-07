/**
 * Ticket 0902 — a service life holds the whole year.
 *
 * 0901 stopped civilian job offers for somebody in uniform and found that four other fields still raised their own:
 * a sports contract, an acting part, a record deal and a modeling job. A taken one would have run beside service. Each
 * year's output from those fields goes through one of these on its way into the state, and somebody who is serving
 * comes out with no offer standing. Anybody else comes out exactly as they went in, the same object, so a life that
 * never serves replays as it did.
 *
 * Offers already standing when somebody enlists are `applyToEnlist`'s to refuse (it won't take a visit while another
 * field is asking).
 */

import type { GameState } from './game-state';

/** An object without one key, so a state's pending offer is taken off without writing `undefined` into it. */
function withoutKey<T extends object>(value: T, key: keyof T): T {
  const { [key]: _gone, ...rest } = value;
  return rest as unknown as T;
}

export function withoutSportsOffer<T extends { readonly sports: GameState['sports'] }>(
  year: T,
  serving: boolean,
): T {
  return serving ? { ...year, sports: withoutKey(year.sports, 'offer') } : year;
}

export function withoutActingOffers<T extends { readonly acting: GameState['acting'] }>(
  year: T,
  serving: boolean,
): T {
  return serving ? { ...year, acting: { ...year.acting, offers: [] } } : year;
}

export function withoutMusicOffer<T extends { readonly music: GameState['music'] }>(
  year: T,
  serving: boolean,
): T {
  return serving ? { ...year, music: withoutKey(year.music, 'offer') } : year;
}

export function withoutModelingOffers<T extends { readonly modeling: GameState['modeling'] }>(
  year: T,
  serving: boolean,
): T {
  return serving ? { ...year, modeling: { ...year.modeling, offers: [] } } : year;
}
