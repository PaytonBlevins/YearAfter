import { describe, expect, it } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, cents, dollars } from '@yearafter/core';
import { post, reconcile } from '@yearafter/finance';
import { createNewGame } from '@yearafter/simulation';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { GameProvider } from '../stores/gameStore';
import { ActionButton } from '../components';
import { rowTitled } from '../test/harness';
import { CardsScreen } from './CardsScreen';

describe('paying a held card from the card screen', () => {
  it.each([
    [25000, 10025, 'Pay off — $100.25', 14975, 0],
    [5025, 10050, 'Pay what you can — $50.25', 0, 5025],
    [0, 10025, 'No cash available to pay', 0, 10025],
  ])(
    'uses available cash without losing cents (%s)',
    async (cash, balance, label, remaining, owed) => {
      const start = createNewGame({ seed: 'card-payoff' });
      const year = start.world.year;
      const finance = post(start.finance, year, 30, {
        category: 'gift',
        amount: cents(cash),
        source: 'Cash',
      }).ledger;
      const state = {
        ...start,
        finance,
        player: { ...start.player, age: 30, cash: finance.balance },
        cards: [
          {
            productId: 'card.starter',
            balance: cents(balance),
            limit: dollars(1200),
            status: 'open' as const,
          },
        ],
      };
      const repository = new MemorySaveRepository();
      const id = asSaveId('card-payoff');
      await repository.create(toSave(state, { id }));
      let rendered!: ReactTestRenderer;
      await act(async () => {
        rendered = create(
          <GameProvider repository={repository}>
            <CardsScreen />
          </GameProvider>,
        );
      });
      try {
        await act(() => rowTitled(rendered, 'Starter Card').props.onPress());
        const button = rendered.root
          .findAllByType(ActionButton)
          .find((node) => node.props.label === label);
        expect(button).toBeDefined();
        if (cash)
          await act(async () => {
            button!.props.onPress();
          });
        else expect(button!.props.disabled).toBe(true);
        const saved = await repository.load(id);
        if (!saved.ok) throw Error(String(saved.error));
        expect(saved.value.cards[0]?.balance).toBe(owed);
        expect(saved.value.player.cash).toBe(remaining);
        expect(reconcile(saved.value.finance).ok).toBe(true);
      } finally {
        await act(() => rendered.unmount());
      }
    },
  );
});
