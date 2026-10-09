/** P13: team ability changes client flow and pay, independently of payroll quality. */
import type { OwnedBusiness } from './businesses';
export const AGENT_BUSINESS_IDS: readonly string[] = ['biz.realestate'];
export const AGENT_LEVELS = ['low', 'mid', 'high'] as const;
export type BusinessAgentLevel = (typeof AGENT_LEVELS)[number];
export const AGENT_LEVEL_LABELS = {
  low: 'Low-level agents',
  mid: 'Mid-level agents',
  high: 'High-level agents',
} as const;
/** Payton-approved P13: cost applies to rounded labor, flow before staff capacity. */
export const AGENT_LEVEL_EFFECTS = {
  low: { pay: 0.9, clients: 0.9 },
  mid: { pay: 1, clients: 1 },
  high: { pay: 1.15, clients: 1.15 },
} as const;
export const ORDINARY_BUSINESS_PRICE = 100;
/** Current agent businesses; future brokerage types join explicitly, not by name. */
export const hasBusinessAgents = (typeId: string): boolean => AGENT_BUSINESS_IDS.includes(typeId);
export const hasBusinessPriceControl = (typeId: string): boolean => typeId !== 'biz.realestate';
export const businessPrice = (business: Pick<OwnedBusiness, 'typeId' | 'price'>): number =>
  hasBusinessPriceControl(business.typeId) ? business.price : ORDINARY_BUSINESS_PRICE;
export const businessAgentLevel = (
  business: Pick<OwnedBusiness, 'typeId' | 'agentLevel'>,
): BusinessAgentLevel =>
  hasBusinessAgents(business.typeId) ? (business.agentLevel ?? 'mid') : 'mid';
export const businessAgentEffects = (business: Pick<OwnedBusiness, 'typeId' | 'agentLevel'>) =>
  AGENT_LEVEL_EFFECTS[businessAgentLevel(business)];
export function savedBusinessAgentOk(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const b = value as Record<string, unknown>;
  const level = b['agentLevel'];
  return (
    level === undefined ||
    (typeof b['typeId'] === 'string' &&
      hasBusinessAgents(b['typeId']) &&
      AGENT_LEVELS.some((l) => l === level))
  );
}
