/**
 * Ticket 0704 — a manager or an agent, never both (spec 256: editor and producer are gone).
 *
 * A manager looks after the whole business. They take 15% of everything a creator earns (the
 * market is 15–20% of gross), channels grow 20% faster with someone minding the work, and a
 * third of the week comes back. An agent only goes after deals: they take 10% of what they
 * land (the market is 10–20%), the deals pay a tenth more, brands call about a third more
 * often, and what strangers charge to collaborate drops by 30%. Neither is a free win: which is
 * better depends on how much of the money is deals.
 */

import { findPlatform, type RepresentationKind } from '@yearafter/content';
import type { Channel } from './creators';

export type Representation = RepresentationKind;

export const MANAGER_CUT = 0.15;
export const MANAGER_GROWTH = 1.2;
/** The share of a creator's week that is still theirs with a manager. */
export const MANAGER_HOURS = 0.7;
export const AGENT_CUT = 0.1;
export const AGENT_PAY = 1.1;
export const AGENT_OFFER_CHANCE = 1.3;
export const AGENT_FEE_DISCOUNT = 0.3;

export type RepresentationRefusal =
  | { readonly kind: 'nobodyWillTakeYouOn' }
  | { readonly kind: 'alreadyHaveOne' }
  | { readonly kind: 'haveNone' };

/** Representation wants somebody already paying their way on at least one channel. */
export function whyNotRepresented(
  channels: readonly Channel[],
  current: Representation | undefined,
): RepresentationRefusal | undefined {
  if (current !== undefined) return { kind: 'alreadyHaveOne' };
  const paying = channels.some((channel) => {
    const platform = findPlatform(channel.platformId);
    return platform !== undefined && channel.audience >= platform.paysAt;
  });
  return paying ? undefined : { kind: 'nobodyWillTakeYouOn' };
}

/** Where the channels are headed, times this. */
export const growthBoost = (rep: Representation | undefined): number =>
  rep === 'manager' ? MANAGER_GROWTH : 1;

/** The share of the week left to the creator. */
export const hoursFactor = (rep: Representation | undefined): number =>
  rep === 'manager' ? MANAGER_HOURS : 1;

/** What a manager keeps of a year's creator income, whole dollars. */
export const managerShare = (rep: Representation | undefined, income: number): number =>
  rep === 'manager' ? Math.round(income * MANAGER_CUT) : 0;

/** What an agent keeps of a deal, whole dollars. */
export const agentShare = (rep: Representation | undefined, pay: number): number =>
  rep === 'agent' ? Math.round(pay * AGENT_CUT) : 0;
