/**
 * NPC model (Ticket 0202).
 *
 * PROTECTED CONTRACT (spec 1060–1066): shared world contract.
 *
 * Spec 674–683 defines three simulation tiers. Tier 1 people — parents,
 * siblings, spouse, children, major friends, business partners — get deep state
 * and memory. Tier 2 are connected but peripheral. Tier 3 are background world
 * population held in compressed form, and may be *promoted* to a higher tier
 * later without rewriting history. That promotion requirement is why every NPC
 * shares one shape rather than each tier having its own type: promoting a
 * background person must be a tier change, not a conversion.
 */

import type { NpcId, StatValue } from '@yearafter/core';
import type { Personality, Sex } from '@yearafter/character';

/**
 * 1 — deep state and memory. Story-critical.
 * 2 — moderate simulation. Connected but not central.
 * 3 — compressed background state.
 */
export type NpcTier = 1 | 2 | 3;

export interface Npc {
  readonly id: NpcId;
  readonly firstName: string;
  readonly lastName: string;
  readonly sex: Sex;
  /** In-world year of birth. Age is derived from the world year, never stored. */
  readonly birthYear: number;
  readonly alive: boolean;
  readonly tier: NpcTier;
  /**
   * Hidden, same six traits as the player. Spec 674–683 makes NPC behaviour
   * depend on personality, so NPCs need the same dispositions the player has —
   * an NPC parent's generosity is what decides whether they fund college.
   */
  readonly personality: Personality;
  /**
   * How this person and the player currently stand, 0–100.
   *
   * One number, not a relationship model. Spec 31 forbids stat creep, and
   * spec 786–795 says outcomes are explained by context rather than formulas.
   * Depth comes from NPC *memory* of specific events (spec 771–785, a later
   * ticket), not from more bars.
   */
  readonly relationship: StatValue;
}

export const npcFullName = (npc: Npc): string => `${npc.firstName} ${npc.lastName}`;

/** Age is always derived — storing it would mean updating every NPC every year. */
export const npcAge = (npc: Npc, worldYear: number): number => worldYear - npc.birthYear;
