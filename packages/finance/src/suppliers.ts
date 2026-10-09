/** P12: quoted terms persist; loyalty shields only a price hike's surcharge. */
import { mixedUnit } from '@yearafter/core';
import type { OwnedBusiness } from './businesses';
import { modifiersFor, type HappenedEvent, type YearModifiers } from './business-events';
/** Spec 393: a supplier is a choice of quality against cost, with quoted terms and hike protection after P12 acceptance. */
export type SupplierGrade = 'budget' | 'standard' | 'premium';

export const SUPPLIER_GRADES: readonly SupplierGrade[] = ['budget', 'standard', 'premium'];

export const SUPPLIER_LABELS: Readonly<Record<SupplierGrade, string>> = {
  budget: 'Budget',
  standard: 'Standard',
  premium: 'Premium',
};

export const SUPPLIER_EFFECTS: Readonly<
  Record<SupplierGrade, { readonly cost: number; readonly quality: number }>
> = {
  budget: { cost: 0.78, quality: 0.88 },
  standard: { cost: 1, quality: 1 },
  premium: { cost: 1.22, quality: 1.12 },
};

export const SUPPLIER_SEARCHES = 5;
export const SUPPLIER_LOYALTIES = ['low', 'medium', 'high'] as const;
export type SupplierLoyalty = (typeof SUPPLIER_LOYALTIES)[number];
export const SUPPLIER_PROTECTION = { low: 0, medium: 0.25, high: 0.5 } as const;
export interface SupplierPitch {
  readonly id: string;
  readonly name: string;
  readonly grade: SupplierGrade;
  readonly cost: number;
  readonly quality: number;
  readonly loyalty: SupplierLoyalty;
  readonly year: number;
}
export interface SupplierAgreement extends SupplierPitch {
  readonly acceptedYear: number;
}
export interface SupplierSearch {
  readonly year: number;
  readonly used: number;
  readonly pending?: SupplierPitch;
}
const NAMES = [
  'Alder Supply',
  'Northbank Goods',
  'Cedar Trading',
  'Harbour Wholesale',
  'Willow Supply',
  'Oakbridge Trading',
  'Meadow Goods',
  'Westfield Wholesale',
] as const;
export const supplierPitchId = (businessId: string, year: number, ordinal: number): string =>
  `supplier:${businessId}:${year}:${ordinal}`;
export function supplierPitch(
  seed: string,
  businessId: string,
  year: number,
  ordinal: number,
): SupplierPitch {
  const key = `p12-pitch:${seed}:${businessId}:${year}:${ordinal}`;
  const grade = SUPPLIER_GRADES[Math.floor(mixedUnit(`${key}:grade`) * 3)]!;
  const anchor = SUPPLIER_EFFECTS[grade];
  return {
    id: supplierPitchId(businessId, year, ordinal),
    year,
    name: NAMES[Math.floor(mixedUnit(`${key}:name`) * NAMES.length)]!,
    grade,
    cost: Math.round(anchor.cost * (0.97 + 0.06 * mixedUnit(`${key}:cost`)) * 100) / 100,
    quality: Math.round(anchor.quality * (0.98 + 0.04 * mixedUnit(`${key}:quality`)) * 100) / 100,
    loyalty: SUPPLIER_LOYALTIES[Math.floor(mixedUnit(`${key}:loyalty`) * 3)]!,
  };
}
export const supplierTerms = (business: OwnedBusiness) =>
  business.supplierAgreement ?? SUPPLIER_EFFECTS[business.supplier];
/** Read-only: stale pending offers expire without spending or drawing randomness. */
export function supplierSearchFor(business: OwnedBusiness, year: number): SupplierSearch {
  return business.supplierSearch?.year === year ? business.supplierSearch : { year, used: 0 };
}
export function supplierModifiers(
  business: OwnedBusiness,
  happened: HappenedEvent | undefined,
): YearModifiers {
  const modifiers = modifiersFor(happened);
  const agreement = business.supplierAgreement;
  if (!agreement || happened?.event.id !== 'supplier-hike') return modifiers;
  return {
    ...modifiers,
    cogs: 1 + (modifiers.cogs - 1) * (1 - SUPPLIER_PROTECTION[agreement.loyalty]),
  };
}
/** Strict new-record boundary; unknown legacy business types remain readable without new terms. */
export function savedSupplierRecordsOk(value: unknown, worldYear: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const b = value as Record<string, unknown>;
  if (!SUPPLIER_GRADES.includes(b['supplier'] as SupplierGrade)) return false;
  const record = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  const yearOk = (v: unknown) =>
    Number.isSafeInteger(v) && Number(v) >= Number(b['openedYear']) && Number(v) <= worldYear;
  const pitchOk = (v: unknown): boolean => {
    const p = record(v);
    if (
      !p ||
      typeof b['id'] !== 'string' ||
      typeof p['id'] !== 'string' ||
      typeof p['name'] !== 'string' ||
      !p['name'].trim() ||
      !yearOk(p['year']) ||
      !SUPPLIER_GRADES.includes(p['grade'] as SupplierGrade) ||
      !SUPPLIER_LOYALTIES.includes(p['loyalty'] as SupplierLoyalty)
    )
      return false;
    const bounds = {
      budget: [0.76, 0.8, 0.86, 0.9],
      standard: [0.97, 1.03, 0.98, 1.02],
      premium: [1.18, 1.26, 1.1, 1.14],
    }[p['grade'] as SupplierGrade]!;
    const quoted = (v: unknown, lo: number, hi: number) =>
      typeof v === 'number' &&
      Number.isFinite(v) &&
      v >= lo &&
      v <= hi &&
      Math.abs(v * 100 - Math.round(v * 100)) < 1e-8;
    return (
      quoted(p['cost'], bounds[0]!, bounds[1]!) &&
      quoted(p['quality'], bounds[2]!, bounds[3]!) &&
      Array.from({ length: SUPPLIER_SEARCHES }, (_, i) =>
        supplierPitchId(b['id'] as string, Number(p['year']), i + 1),
      ).includes(p['id'])
    );
  };
  const a = b['supplierAgreement'];
  const agreement = record(a);
  if (
    a !== undefined &&
    (!pitchOk(a) ||
      !agreement ||
      agreement['grade'] !== b['supplier'] ||
      agreement['acceptedYear'] !== agreement['year'])
  )
    return false;
  const s = b['supplierSearch'];
  if (s === undefined) return a === undefined;
  const search = record(s);
  if (
    !search ||
    !yearOk(search['year']) ||
    !Number.isInteger(search['used']) ||
    Number(search['used']) < 0 ||
    Number(search['used']) > SUPPLIER_SEARCHES
  )
    return false;
  const pending = record(search['pending']);
  if (
    search['pending'] !== undefined &&
    (!pitchOk(pending) ||
      !pending ||
      pending['year'] !== search['year'] ||
      pending['id'] !==
        supplierPitchId(b['id'] as string, Number(search['year']), Number(search['used'])) ||
      pending['id'] === agreement?.['id'])
  )
    return false;
  if (agreement && Number(agreement['year']) > Number(search['year'])) return false;
  if (agreement && agreement['year'] === search['year']) {
    const acceptedOrdinal = Array.from({ length: Number(search['used']) }, (_, i) =>
      supplierPitchId(b['id'] as string, Number(search['year']), i + 1),
    );
    if (!acceptedOrdinal.includes(agreement['id'] as string)) return false;
  }
  return true;
}
