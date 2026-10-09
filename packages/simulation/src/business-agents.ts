import { err, ok, type Result } from '@yearafter/core';
import { findBusinessType } from '@yearafter/content';
import { hasBusinessAgents, AGENT_LEVELS, type BusinessAgentLevel } from '@yearafter/finance';
import type { GameState } from './game-state';
export type BusinessAgentError =
  'not-alive' | 'too-young' | 'no-such-business' | 'no-agents' | 'rescue-pending' | 'no-such-level';
export const BUSINESS_AGENT_ERROR_LABELS: Readonly<Record<BusinessAgentError, string>> = {
  'not-alive': 'This life has ended.',
  'too-young': 'You can hire an agent team from age 18.',
  'no-such-business': "You don't own that business any more.",
  'no-agents': "This business doesn't have an agent team.",
  'rescue-pending': 'Decide whether your businesses can carry on first.',
  'no-such-level': "That agent level isn't available.",
};
export function setBusinessAgentLevel(
  state: GameState,
  id: string,
  level: BusinessAgentLevel,
): Result<GameState, BusinessAgentError> {
  if (!state.player.alive) return err('not-alive');
  if (state.player.age < 18) return err('too-young');
  const business = state.businesses.find((b) => b.id === id);
  if (!business) return err('no-such-business');
  if (!findBusinessType(business.typeId) || !hasBusinessAgents(business.typeId))
    return err('no-agents');
  if (state.businessRescue || state.pending.some((d) => d.eventId === 'business.rescue'))
    return err('rescue-pending');
  if (!AGENT_LEVELS.some((l) => l === level)) return err('no-such-level');
  if (business.agentLevel === level) return ok(state);
  return ok({
    ...state,
    businesses: state.businesses.map((b) => (b.id === id ? { ...b, agentLevel: level } : b)),
  });
}
