/** P12: one free pitch per successful search, owned-business quota, no stream draws. */
import { findBusinessType } from '@yearafter/content';
import { err, ok, type Result } from '@yearafter/core';
import {
  supplierPitch,
  supplierSearchFor,
  SUPPLIER_SEARCHES,
  type OwnedBusiness,
} from '@yearafter/finance';
import type { GameState } from './game-state';
export type SupplierError =
  | 'not-alive'
  | 'too-young'
  | 'no-such-business'
  | 'no-suppliers'
  | 'rescue-pending'
  | 'no-searches'
  | 'stale-pitch';
export const SUPPLIER_ERROR_LABELS: Readonly<Record<SupplierError, string>> = {
  'not-alive': 'This life has ended.',
  'too-young': 'You can arrange suppliers from age 18.',
  'no-such-business': "You don't own that business any more.",
  'no-suppliers': "This business doesn't buy supplies from a supplier.",
  'rescue-pending': 'Decide whether your businesses can carry on first.',
  'no-searches': "You've used this business's five searches for the year. Try again next year.",
  'stale-pitch': "That pitch isn't available any more. Look at the current pitch or search again.",
};
function eligible(state: GameState, id: string): Result<OwnedBusiness, SupplierError> {
  if (!state.player.alive) return err('not-alive');
  if (state.player.age < 18) return err('too-young');
  const business = state.businesses.find((b) => b.id === id);
  if (!business) return err('no-such-business');
  if (!findBusinessType(business.typeId)?.supplier) return err('no-suppliers');
  if (state.businessRescue || state.pending.some((d) => d.eventId === 'business.rescue'))
    return err('rescue-pending');
  return ok(business);
}
function replace(state: GameState, business: OwnedBusiness): Result<GameState, SupplierError> {
  return ok({
    ...state,
    businesses: state.businesses.map((b) => (b.id === business.id ? business : b)),
  });
}
export function searchSupplier(state: GameState, id: string): Result<GameState, SupplierError> {
  const r = eligible(state, id);
  if (!r.ok) return r;
  const search = supplierSearchFor(r.value, state.world.year);
  if (search.used >= SUPPLIER_SEARCHES) return err('no-searches');
  const used = search.used + 1;
  const pending = supplierPitch(state.rng.getSeed(), id, state.world.year, used);
  return replace(state, { ...r.value, supplierSearch: { year: state.world.year, used, pending } });
}
export function acceptSupplier(
  state: GameState,
  id: string,
  pitchId: string,
): Result<GameState, SupplierError> {
  const r = eligible(state, id);
  if (!r.ok) return r;
  const search = supplierSearchFor(r.value, state.world.year);
  const pitch = search.pending;
  if (!pitch || pitch.id !== pitchId) return err('stale-pitch');
  return replace(state, {
    ...r.value,
    supplier: pitch.grade,
    supplierAgreement: { ...pitch, acceptedYear: state.world.year },
    supplierSearch: { year: search.year, used: search.used },
  });
}
export function passSupplier(
  state: GameState,
  id: string,
  pitchId: string,
): Result<GameState, SupplierError> {
  const r = eligible(state, id);
  if (!r.ok) return r;
  const search = supplierSearchFor(r.value, state.world.year);
  if (!search.pending || search.pending.id !== pitchId) return err('stale-pitch');
  return replace(state, { ...r.value, supplierSearch: { year: search.year, used: search.used } });
}
