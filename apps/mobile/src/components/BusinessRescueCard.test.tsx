import { afterEach, describe, expect, it } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { asSaveId, dollars } from '@yearafter/core';
import { findBusinessType } from '@yearafter/content';
import { newBusiness, post } from '@yearafter/finance';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { createNewGame, runBusinessesYear, withBusinessRescue } from '@yearafter/simulation';
import { GameProvider, useGame } from '../stores/gameStore';
import { textsOf } from '../test/harness';
import { BusinessRescueCard } from './BusinessRescueCard';
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
const saveId = asSaveId('ui-rescue');
function Review() {
  game = useGame();
  return game.state ? (
    <BusinessRescueCard state={game.state} onChoose={(id) => game?.answer('business.rescue', id)} />
  ) : null;
}
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  game = undefined;
});
async function mount(bank = 10_000_000) {
  const base = createNewGame({ seed: 'p1-ui', startYear: 2000 });
  const type = findBusinessType('biz.restaurant')!;
  const businesses = [0, 1].map((i) => ({
    ...newBusiness(type, `biz:${i}`, `Rescue Place ${i}`, 2030, 0.55),
    staff: type.staff * 2,
    cash: dollars(0),
    reputation: 5,
  }));
  const annual = runBusinessesYear({
    businesses,
    year: 2031,
    seed: 'insolvent',
    market: 'severeRecession',
    available: bank,
    holdsJob: false,
    stat: () => 10,
  });
  const finance = post(base.finance, 2031, 31, {
    category: 'gift',
    amount: dollars(bank),
    source: 'Savings',
  }).ledger;
  const state = withBusinessRescue(
    {
      ...base,
      world: { ...base.world, year: 2031 },
      player: { ...base.player, age: 31, cash: finance.balance },
      finance,
      businesses: annual.businesses,
    },
    annual.rescues,
  );
  const repository = new MemorySaveRepository();
  await repository.create(toSave(state, { id: saveId }));
  await act(async () => {
    rendered = create(
      <GameProvider repository={repository}>
        <Review />
      </GameProvider>,
    );
  });
  if (!rendered || !game?.state) throw new Error('Not loaded');
  return { renderer: rendered, repository, state };
}
const button = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAllByType(Pressable).find((node) => node.props.accessibilityLabel === label)!;
describe('P1 business review through the real store', () => {
  it('shows one review, exact costs, bank and lender explanation, then saves each separate answer', async () => {
    const { renderer, repository, state } = await mount();
    const amount = state.businessRescue!.cases[0]!.amount;
    const text = textsOf(renderer).join(' ');
    expect(text).toContain('Keep the doors open?');
    expect(text).toContain('You have $10,000,000 in your bank');
    expect(text).toContain('Nothing comes out until you say so');
    expect(text).toContain('Its lender gets paid first. Any unpaid debt stays yours.');
    expect(text).toContain('Rescue Place 0');
    expect(text).toContain('Rescue Place 1');
    const inject = button(renderer, `Put $${amount.toLocaleString('en-US')} into Rescue Place 0`);
    expect(inject.props.disabled).toBe(false);
    await act(() => inject.props.onPress());
    expect(game?.state?.businessRescue?.cases).toHaveLength(1);
    expect(game?.state?.pending).toHaveLength(1);
    expect(Number(game?.state?.finance.balance)).toBe(Number(state.finance.balance) - amount * 100);
    const saved = await repository.load(saveId);
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('Save not readable');
    expect(saved.value.businessRescue?.cases[0]?.businessId).toBe('biz:1');
    await act(() => button(renderer, 'Close Rescue Place 1').props.onPress());
    expect(game?.state?.businessRescue).toBeUndefined();
    expect(game?.state?.businesses.map((row) => row.id)).toEqual(['biz:0']);
    expect(game?.state?.pending).toHaveLength(0);
  });
  it('disables unaffordable injection, explains it plainly, and leaves closing available', async () => {
    const { renderer, state } = await mount(1);
    const amount = state.businessRescue!.cases[0]!.amount;
    const inject = button(renderer, `Put $${amount.toLocaleString('en-US')} into Rescue Place 0`);
    expect(inject.props.disabled).toBe(true);
    expect(inject.props.accessibilityState).toEqual({ disabled: true });
    expect(textsOf(renderer).join(' ')).toContain("You don't have enough in your bank for this.");
    expect(button(renderer, 'Close Rescue Place 0').props.disabled).not.toBe(true);
    await act(() => {
      game?.answer('business.rescue', 'inject:biz:0');
    });
    expect(game?.saveError).toBe(
      "You don't have enough in your bank to keep this business going. You can close it instead.",
    );
    expect(game?.state?.businessRescue?.cases).toHaveLength(2);
    await act(() => button(renderer, 'Close Rescue Place 0').props.onPress());
    expect(game?.state?.businessRescue?.cases).toHaveLength(1);
  });
});
