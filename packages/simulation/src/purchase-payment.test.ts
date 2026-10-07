import { collabOffers, answerCollabOffer } from './network';
import { describe, expect, it } from 'vitest';
import { cents, dollars } from '@yearafter/core';
import { AUCTION_VENUES, BUSINESS_TYPES, INSTRUMENTS, PLATFORMS } from '@yearafter/content';
import {
  post,
  reconcile,
  startupCostFor,
  branchCostFor,
  maxBidFor,
  BUYERS_PREMIUM,
  type PurchasePayment,
} from '@yearafter/finance';
import { createNewGame } from './new-game';
import type { GameState } from './game-state';
import { buyValuable, openStores, storeStock } from './shopping';
import { buyHome, homeListings } from './homes';
import { buyVehicle, vehicleLots, inspectVehicle, sellVehicle } from './vehicles';
import { fitVehicleMod, modSlotsFor } from './vehicle-mods';
import { renovate, renovationOptionsFor } from './renovations';
import { openBusiness, buyBusiness, businessesForSale, expandBusiness } from './businesses';
import { attendAuction, bidOn, currentLots, STORAGE_PREMIUM } from './auctions';
import { invest, quoteInvestment } from './investments';
import { openChannel } from './creators';
import { placeInDeal, dealMarket } from './deals';
const payment: PurchasePayment = { kind: 'card', productId: 'card.starter' };
function adult(seed = 'purchase-payments'): GameState {
  const state = createNewGame({ seed });
  return {
    ...state,
    player: { ...state.player, age: 35, cash: cents(0) },
    cards: [
      { productId: 'card.private', limit: dollars(1_000_000), balance: cents(0), status: 'open' },
      { productId: 'card.starter', limit: dollars(1_000_000), balance: cents(0), status: 'open' },
    ],
  };
}
function expectPaid(before: GameState, after: GameState, price: number) {
  expect(after.cards[1]?.balance).toBe(dollars(price));
  expect(after.cards[0]?.balance).toBe(cents(0));
  expect(after.player.cash).toBe(before.player.cash);
  expect(after.finance.balance).toBe(after.player.cash);
  expect(after.finance.transactions.at(-1)?.amount).toBe(dollars(-price));
  expect(after.finance.transactions.some((row) => row.category === 'shortfall')).toBe(false);
  expect(reconcile(after.finance).ok).toBe(true);
  expect(before.cards[1]?.balance).toBe(cents(0));
}
function pieceIn(state: GameState) {
  const piece = openStores(state).flatMap((store) => storeStock(state, store.id))[0];
  if (!piece) throw new Error('No store fixture');
  return piece;
}
function cashIn(state: GameState, amount: number) {
  const finance = post(state.finance, state.world.year, state.player.age, {
    category: 'gift',
    amount: dollars(amount),
    source: 'Test savings',
  }).ledger;
  return { ...state, finance, player: { ...state.player, cash: finance.balance } };
}
describe('real purchases with a selected card', () => {
  it('buys the original quoted item without changing cash-derived stock, and refuses replay', () => {
    const state = adult();
    const piece = pieceIn(state);
    expect(buyValuable(state, piece.id)).toEqual({ ok: false, error: 'cannot-afford' });
    const result = buyValuable(state, piece.id, payment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectPaid(state, result.value.state, piece.price);
    expect(result.value.piece.itemId).toBe(piece.item.id);
    expect(result.value.piece.purchasePrice).toBe(dollars(piece.price));
    expect(result.value.entry.text).toContain('Starter Card');
    expect(buyValuable(result.value.state, piece.id, payment)).toEqual({
      ok: false,
      error: 'no-such-piece',
    });
  });
  it.each(['frozen', 'overLimit', 'missing', 'vanished', 'tooYoung'] as const)(
    'refuses %s and leaves the complete state untouched',
    (reason) => {
      let state = adult();
      const piece = pieceIn(state);
      if (reason === 'frozen')
        state = { ...state, cards: state.cards.map((card) => ({ ...card, status: 'frozen' })) };
      if (reason === 'overLimit')
        state = {
          ...state,
          cards: state.cards.map((card) => ({ ...card, limit: cents(piece.price * 100 - 1) })),
        };
      if (reason === 'missing') state = { ...state, cards: [] };
      if (reason === 'tooYoung') state = { ...state, player: { ...state.player, age: 10 } };
      const before = JSON.stringify(state);
      expect(buyValuable(state, reason === 'vanished' ? 'gone' : piece.id, payment).ok).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
    },
  );
  it('buys a home with a card without a mortgage and preserves ownership gates', () => {
    const state = adult();
    const listing = homeListings(state)[0];
    if (!listing) throw new Error('No home');
    const result = buyHome(state, listing.id, 'cash', payment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectPaid(state, result.value.state, listing.askingPrice);
    expect(result.value.home.mortgage).toBeUndefined();
    expect(buyHome(result.value.state, listing.id, 'cash', payment)).toEqual({
      ok: false,
      error: 'already-owned',
    });
    expect(buyHome(state, listing.id, 'mortgage', payment)).toEqual({
      ok: false,
      error: 'payment-finance-conflict',
    });
  });
  it('buys a vehicle, fits a mod and pays a mechanic with a card', () => {
    const state = adult();
    const listing = vehicleLots(state, 'used')
      .flatMap((lot) => lot.listings)
      .find((row) => row.inspectable);
    if (!listing) throw new Error('No car');
    const inspected = inspectVehicle(state, listing.id, payment);
    expect(inspected.ok).toBe(true);
    const result = buyVehicle(state, listing.id, 'cash', undefined, payment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state;
    expect(after.vehicles[0]?.loan).toBeUndefined();
    expect(after.cards[1]?.balance).toBe(result.value.vehicle.purchasePrice);
    const reset = { ...after, cards: state.cards };
    const option = modSlotsFor(reset, listing.id)
      .flatMap((slot) => slot.options)
      .find((row) => !row.refusal);
    if (!option) throw new Error('No mod');
    const fitted = fitVehicleMod(reset, listing.id, option.mod.id, payment);
    expect(fitted.ok).toBe(true);
    if (!fitted.ok) return;
    expect(fitted.value.state.cards[1]?.balance).toBe(dollars(option.price));
    expect(fitted.value.state.player.cash).toBe(cents(0));
    expect(reconcile(fitted.value.state.finance).ok).toBe(true);
  });
  it('applies trade-in proceeds before charging a card and keeps failed trade-ins atomic', () => {
    const state = adult();
    const listings = vehicleLots(state, 'used').flatMap((lot) => lot.listings);
    const first = listings[0];
    const next = listings.at(-1);
    if (!first || !next || first.id === next.id) throw new Error('No trade-in pair');
    const bought = buyVehicle(state, first.id, 'cash', undefined, payment);
    if (!bought.ok) throw new Error(bought.error);
    const before = { ...bought.value.state, cards: state.cards };
    const sold = sellVehicle(before, first.id, true);
    if (!sold.ok) throw new Error(sold.error);
    const second = buyVehicle(before, next.id, 'cash', first.id, payment);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const total = Number(second.value.vehicle.purchasePrice) / 100;
    const credit = Number(sold.value.state.player.cash - before.player.cash) / 100;
    expect(second.value.state.cards[1]?.balance).toBe(dollars(Math.max(0, total - credit)));
    expect(second.value.state.player.cash).toBe(dollars(Math.max(0, credit - total)));
    expect(reconcile(second.value.state.finance).ok).toBe(true);
    const snapshot = JSON.stringify(before);
    const limited = {
      ...before,
      cards: before.cards.map((card) => ({ ...card, limit: cents(0) })),
    };
    expect(buyVehicle(limited, next.id, 'cash', first.id, payment).ok).toBe(false);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
  it('rejects a stale price quote without charging or giving the item', () => {
    const state = adult();
    const piece = pieceIn(state);
    expect(
      buyValuable(state, piece.id, { ...payment, expectedTotal: dollars(piece.price - 1) }),
    ).toEqual({ ok: false, error: 'payment-price-changed' });
    expect(state.valuables).toHaveLength(0);
    expect(state.cards[1]?.balance).toBe(cents(0));
  });
  it('renovates a home with a card', () => {
    const state = adult();
    const listing = homeListings(state)[0];
    if (!listing) throw new Error('No home');
    const owned = buyHome(state, listing.id, 'cash', payment);
    if (!owned.ok) throw new Error(owned.error);
    const before = { ...owned.value.state, cards: state.cards };
    const option = renovationOptionsFor(before, listing.id).find((row) => !row.refusal);
    if (!option) throw new Error('No renovation');
    const result = renovate(before, listing.id, option.renovation.id, payment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.cards[1]?.balance).toBe(dollars(option.cost));
    expect(result.value.state.player.cash).toBe(cents(0));
    expect(reconcile(result.value.state.finance).ok).toBe(true);
  });
  it('opens and buys businesses with a card without a loan', () => {
    const state = cashIn(adult(), 2_000_000);
    const type = BUSINESS_TYPES.find((row) => row.id === 'biz.cleaning');
    if (!type) throw new Error('No business');
    const opened = openBusiness(state, type.id, undefined, payment);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expectPaid(state, opened.value.state, startupCostFor(type));
    expect(opened.value.state.loans).toEqual(state.loans);
    const listing = businessesForSale(state).find((row) => row.ask < 1_000_000);
    if (!listing) throw new Error('No business listing');
    const bought = buyBusiness(state, listing.id, undefined, payment);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expectPaid(state, bought.value.state, listing.ask);
    expect(bought.value.state.loans).toEqual(state.loans);
    const invalid = openBusiness(state, type.id, { productId: 'anything', amount: 500 }, payment);
    expect(invalid).toEqual({ ok: false, error: 'payment-finance-conflict' });
    const expansion = expandBusiness(
      opened.value.state,
      opened.value.business.id,
      undefined,
      payment,
    );
    expect(expansion.ok).toBe(false); // Existing maturation/profit gates must still hold.
  });
  it('expands an established profitable business with a selected card', () => {
    const state = cashIn(adult(), 2000000);
    const type = BUSINESS_TYPES.find((row) => row.id === 'biz.cleaning');
    if (!type) throw new Error('No business');
    const opened = openBusiness(state, type.id);
    if (!opened.ok) throw new Error(opened.error);
    const business = {
      ...opened.value.business,
      openedYear: state.world.year - 10,
      last: {
        year: state.world.year - 1,
        revenue: 20000,
        costs: 10000,
        profit: 10000,
        drawn: 1000,
        injected: 0,
        turnedAway: 0,
        idle: 0,
      },
    };
    const before = { ...opened.value.state, cards: state.cards, businesses: [business] };
    const result = expandBusiness(before, business.id, undefined, payment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectPaid(before, result.value.state, branchCostFor(type));
    expect(result.value.state.businesses[0]?.branches).toEqual([state.world.year]);
    expect(result.value.state.loans).toEqual(before.loans);
  });
  it('pays a collaboration fee on the selected card and declines without charging', () => {
    const platform = PLATFORMS.find((row) => row.id === 'video');
    if (!platform) throw new Error('No platform');
    let found = false;
    for (let i = 0; i < 50 && !found; i++) {
      const state = adult(`purchase-collab-${i}`);
      const category = platform.categories[0];
      if (!category) throw new Error('No category');
      const opened = openChannel(state, platform.id, category, payment);
      if (!opened.ok) throw new Error(JSON.stringify(opened.error));
      const channel = opened.value.channels[0];
      if (!channel) throw new Error('No channel');
      const before = {
        ...opened.value,
        cards: state.cards,
        channels: [{ ...channel, audience: 5000 }],
      };
      const row = collabOffers(before).find((row) => row.offer.fee > 0);
      if (!row) continue;
      found = true;
      const accepted = answerCollabOffer(before, row.offer.id, 'accept', payment);
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) return;
      expectPaid(before, accepted.value, row.offer.fee);
      const declined = answerCollabOffer(before, row.offer.id, 'decline', payment);
      expect(declined.ok).toBe(true);
      if (!declined.ok) return;
      expect(declined.value.cards).toEqual(before.cards);
      expect(declined.value.finance).toEqual(before.finance);
    }
    expect(found).toBe(true);
  });
  it('charges actual investment units, not the requested budget', () => {
    const state = adult();
    const bond = INSTRUMENTS.find((row) => row.kind === 'bond');
    if (!bond) throw new Error('No bond');
    const quote = quoteInvestment(state, bond.id, 5500);
    expect(quote.units).toBeGreaterThan(0);
    const result = invest(state, bond.id, 5500, payment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectPaid(state, result.value.state, quote.cash);
    expect(result.value.state.portfolio[0]?.units).toBe(quote.units);
  });
  it('pays channel startup with a card while keeping suitability gates', () => {
    const state = adult();
    const platform = PLATFORMS.find((row) => row.startCost > 0);
    if (!platform) throw new Error('No platform');
    const category = platform.categories[0];
    if (!category) throw new Error('No category');
    const result = openChannel(state, platform.id, category, payment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectPaid(state, result.value, platform.startCost);
    expect(openChannel(result.value, platform.id, category, payment).ok).toBe(false);
  });
  it('keeps private-deal offer and cheque limits while paying with a card', () => {
    const state = cashIn(adult(), 2_000_000);
    const offer = dealMarket(state)[0];
    if (!offer) throw new Error('No deal');
    const before = { ...state, cards: adult().cards };
    const result = placeInDeal(before, offer.id, offer.minTicket, payment);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectPaid(before, result.value, offer.minTicket);
    expect(result.value.deals[0]?.put).toBe(dollars(offer.minTicket));
    expect(placeInDeal(before, offer.id, offer.maxTicket + 1, payment).ok).toBe(false);
  });
  it('charges nothing when outbid and only actual premium-inclusive cost when winning', () => {
    let wins = 0;
    let losses = 0;
    for (let i = 0; i < 10; i += 1) {
      const state = adult(`purchase-auction-${i}`);
      const venue = AUCTION_VENUES.find((row) => row.type === 'general');
      if (!venue) throw new Error('No venue');
      const attend = attendAuction(state, venue.id);
      if (!attend.ok) throw new Error(attend.error);
      const lot = currentLots(attend.value, venue.id)[0];
      if (!lot) throw new Error('No lot');
      for (const tier of ['careful', 'determined'] as const) {
        const result = bidOn(attend.value, lot.id, tier, payment);
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        if (result.value.won) {
          wins++;
          const paid = result.value.paid;
          expect(result.value.state.cards[1]?.balance).toBe(dollars(paid));
          expect(paid).toBe(
            Math.round(
              result.value.hammer * (1 + (lot.kind === 'unit' ? STORAGE_PREMIUM : BUYERS_PREMIUM)),
            ),
          );
          expect(result.value.state.player.cash).toBe(cents(0));
          expect(bidOn(result.value.state, lot.id, tier, payment).ok).toBe(false);
        } else {
          losses++;
          expect(result.value.state.cards).toEqual(state.cards);
          expect(result.value.state.finance).toEqual(state.finance);
        }
        expect(reconcile(result.value.state.finance).ok).toBe(true);
        const ceiling = Math.ceil(maxBidFor(lot.estimate, tier) * (1 + BUYERS_PREMIUM));
        const short = {
          ...attend.value,
          cards: [
            {
              ...state.cards[1],
              productId: 'card.starter',
              limit: cents(ceiling * 100 - 1),
              balance: cents(0),
              status: 'open' as const,
            },
          ],
        };
        expect(bidOn(short, lot.id, tier, payment).ok).toBe(false);
      }
    }
    expect(wins).toBeGreaterThan(0);
    expect(losses).toBeGreaterThan(0);
  });
});
