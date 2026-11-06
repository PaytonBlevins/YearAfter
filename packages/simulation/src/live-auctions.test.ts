import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { post, reconcile } from '@yearafter/finance';
import {
  attendAuction,
  bidLive,
  currentLots,
  liveBidQuote,
  passLiveBid,
  STORAGE_PREMIUM,
} from './auctions';
import { createNewGame } from './new-game';

function fixture() {
  for (let n = 0; n < 100; n++) {
    const fresh = createNewGame({ seed: `live-auction-${n}` });
    const { ledger } = post(fresh.finance, fresh.world.year, 30, {
      category: 'gift',
      amount: dollars(500_000),
      source: 'Test cash',
    });
    const adult = {
      ...fresh,
      player: { ...fresh.player, age: 30, cash: ledger.balance },
      finance: ledger,
    };
    const attended = attendAuction(adult, 'auction.storage');
    if (!attended.ok) throw Error(attended.error);
    const state = attended.value;
    const lot = currentLots(state, 'auction.storage').find((lot) => {
      const opening = liveBidQuote(state, lot.id)!.hammer;
      return lot.roomTop > opening + lot.estimate.low * 0.2;
    });
    if (lot) return { state, lot };
  }
  throw Error('No contested lot');
}

describe('live auctions', () => {
  it('counters more than once and charges exactly the final quoted bid with premium, once', () => {
    const { state, lot } = fixture();
    let current = state;
    let counters = 0;
    for (let n = 0; n < 32; n++) {
      const quote = liveBidQuote(current, lot.id)!;
      const pay = { kind: 'cash' as const, expectedTotal: dollars(quote.total) };
      const result = bidLive(current, lot.id, quote.token, pay);
      if (!result.ok) throw Error(result.error);
      current = result.value.state;
      if (result.value.kind === 'won') {
        expect(counters).toBeGreaterThanOrEqual(2);
        expect(quote.total).toBe(Math.round(quote.hammer * (1 + STORAGE_PREMIUM)));
        const newRows = current.finance.transactions.slice(state.finance.transactions.length);
        const purchases = newRows.filter((row) => row.category === 'property' && row.amount < 0);
        expect(purchases.map((row) => row.amount)).toEqual([dollars(-quote.total)]);
        // A unit's contents can then earn a separate salvage credit.
        expect(current.player.cash).toBe(
          state.player.cash + newRows.reduce((total, row) => total + row.amount, 0),
        );
        expect(reconcile(current.finance).ok).toBe(true);
        expect(liveBidQuote(current, lot.id)).toBeUndefined();
        expect(bidLive(current, lot.id, quote.token, pay)).toEqual({
          ok: false,
          error: 'already-bid',
        });
        return;
      }
      counters++;
      const next = liveBidQuote(current, lot.id)!;
      expect(next.counter).toBeGreaterThan(quote.hammer);
      expect(next.hammer).toBeGreaterThan(next.counter!);
      expect(current.finance).toBe(state.finance);
      expect(current.cards).toBe(state.cards);
      expect(bidLive(current, lot.id, quote.token, pay)).toEqual({ ok: false, error: 'stale-bid' });
    }
    throw Error('Never settled');
  });

  it('allows passing and never pays or grants the lot on a counter, pass, or unaffordable raise', () => {
    const { state, lot } = fixture();
    const quote = liveBidQuote(state, lot.id)!;
    const result = bidLive(state, lot.id, quote.token, { kind: 'cash' });
    if (!result.ok || result.value.kind !== 'counter') throw Error('No counter');
    const active = result.value.state;
    expect(attendAuction(active, 'auction.storage')).toEqual({ ok: false, error: 'bid-open' });
    const raised = liveBidQuote(active, lot.id)!;
    expect(
      bidLive({ ...active, player: { ...active.player, cash: dollars(0) } }, lot.id, raised.token, {
        kind: 'cash',
      }),
    ).toEqual({ ok: false, error: 'cannot-cover' });
    const passed = passLiveBid(active, lot.id);
    if (!passed.ok) throw Error(passed.error);
    expect(passed.value.finance).toBe(state.finance);
    expect(passed.value.valuables).toBe(state.valuables);
    expect(liveBidQuote(passed.value, lot.id)).toBeUndefined();
    expect(attendAuction(passed.value, 'auction.storage').ok).toBe(true);
  });

  it('revalidates the quoted total and can settle a live win entirely on a card', () => {
    const { state, lot } = fixture();
    let current = {
      ...state,
      cards: [
        {
          productId: 'card.starter',
          balance: dollars(0),
          limit: dollars(50_000),
          status: 'open' as const,
        },
      ],
    } as typeof state;
    for (let n = 0; n < 32; n++) {
      const quote = liveBidQuote(current, lot.id)!;
      const payment = {
        kind: 'card' as const,
        productId: 'card.starter',
        expectedTotal: dollars(quote.total),
      };
      expect(
        bidLive(current, lot.id, quote.token, {
          ...payment,
          expectedTotal: dollars(quote.total - 1),
        }).ok,
      ).toBe(false);
      const result = bidLive(current, lot.id, quote.token, payment);
      if (!result.ok) throw Error(result.error);
      current = result.value.state;
      if (result.value.kind === 'won') {
        expect(current.cards[0]?.balance).toBe(dollars(quote.total));
        expect(reconcile(current.finance).ok).toBe(true);
        return;
      }
      expect(current.cards[0]?.balance).toBe(0);
    }
    throw Error('Never settled');
  });

  it('keeps general-house lots fixed as the player’s means change', () => {
    const { state } = fixture();
    const result = attendAuction(state, 'auction.hartwell');
    if (!result.ok) throw Error(result.error);
    const before = currentLots(result.value, 'auction.hartwell');
    expect(before.length).toBeGreaterThan(0);
    expect(
      currentLots(
        { ...result.value, player: { ...result.value.player, cash: dollars(0) } },
        'auction.hartwell',
      ),
    ).toEqual(before);
  });
});
