import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId } from '@yearafter/core';
import { findBusinessType } from '@yearafter/content';
import { newBusiness, AGENT_LEVELS, AGENT_LEVEL_LABELS } from '@yearafter/finance';
import { createNewGame } from '@yearafter/simulation';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { GameProvider, useGame } from '../stores/gameStore';
import { BusinessScreen } from './BusinessesScreen';
import { rowTitled, textsOf } from '../test/harness';
import { Pressable } from 'react-native';
vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { businessId: 'ui-agent' }, pop: vi.fn(), push: vi.fn() }),
}));
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  if (rendered)
    await act(async () => {
      rendered?.unmount();
      await Promise.resolve();
    });
  rendered = undefined;
  game = undefined;
});
async function mount(typeId = 'biz.realestate') {
  const s = createNewGame({ seed: 'p13-ui', startYear: 2000 });
  const state = {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    player: { ...s.player, age: 30 },
    businesses: [
      { ...newBusiness(findBusinessType(typeId)!, 'ui-agent', 'Team', 2000, 1), price: 140 },
    ],
  };
  const repo = new MemorySaveRepository();
  const id = asSaveId('p13-ui');
  const saved = await repo.create(toSave(state, { id }));
  if (!saved.ok) throw Error(String(saved.error));
  await act(async () => {
    rendered = create(
      <GameProvider repository={repo}>
        <Probe />
        <BusinessScreen />
      </GameProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { repo, id, state };
}
function renderer() {
  if (!rendered) throw Error('render');
  return rendered;
}
describe('P13 owned screen through actual store, commands and autosave', () => {
  it.each(AGENT_LEVELS)(
    'selects and persists %s with explained pay/client tradeoff and no bank reward',
    async (level) => {
      const { repo, id, state } = await mount();
      expect(rowTitled(renderer(), 'Agent team').props.value).toBe('Mid-level agents');
      const row = rowTitled(renderer(), AGENT_LEVEL_LABELS[level]);
      const percent = { low: 90, mid: 100, high: 115 }[level];
      expect(row.props.subtitle).toContain(
        `${percent}% of ordinary agent pay and ${percent}% of potential client demand`,
      );
      await act(async () => {
        row.props.onPress();
        await Promise.resolve();
      });
      expect(game?.state?.businesses[0]?.agentLevel).toBe(level);
      expect(game?.state?.player.cash).toBe(state.player.cash);
      expect(game?.state?.finance).toEqual(state.finance);
      const save = await repo.load(id);
      if (!save.ok) throw Error(String(save.error));
      expect(save.value.businesses[0]?.agentLevel).toBe(level);
      expect(rowTitled(renderer(), AGENT_LEVEL_LABELS[level]).props.value).toBe('Chosen');
      expect(rowTitled(renderer(), 'Yearly pay per agent').props.value).toBe(
        { low: '$48,555', mid: '$53,950', high: '$62,043' }[level],
      );
      expect(textsOf(renderer()).join(' ')).toContain(
        "higher-level agents aren't a promise of more profit",
      );
    },
  );
  it('uses market-rate explanation instead of stale brokerage price controls, with a spoken direct-command refusal', async () => {
    await mount();
    expect(rowTitled(renderer(), 'Price').props.value).toBe('Market rates');
    expect(textsOf(renderer()).join(' ')).toContain('This brokerage works at market rates');
    expect(
      renderer()
        .root.findAllByType(Pressable)
        .some((p) => String(p.props.accessibilityLabel).startsWith('Price at')),
    ).toBe(false);
    const before = JSON.stringify(game?.state);
    await act(async () => {
      game?.tuneBusiness('ui-agent', { kind: 'price', price: 70 });
      await Promise.resolve();
    });
    expect(game?.outcome?.body).toContain('Choose its agent team instead');
    expect(JSON.stringify(game?.state)).toBe(before);
  });
  it.each(['biz.cafe', 'biz.marketing'])(
    'preserves ordinary price controls and excludes an agent team for %s',
    async (typeId) => {
      await mount(typeId);
      expect(textsOf(renderer()).join(' ')).not.toContain('Agent team');
      const price = renderer()
        .root.findAllByType(Pressable)
        .find((p) => p.props.accessibilityLabel === 'Price at 110 percent');
      expect(price).toBeDefined();
      await act(async () => {
        price?.props.onPress();
        await Promise.resolve();
      });
      expect(game?.state?.businesses[0]?.price).toBe(110);
      await act(async () => {
        game?.chooseBusinessAgents('ui-agent', 'high');
        await Promise.resolve();
      });
      expect(game?.outcome?.body).toContain("doesn't have an agent team");
      expect(game?.state?.businesses[0]?.agentLevel).toBeUndefined();
    },
  );
  it('keeps payroll, manual staffing and automatic manager separate from agent ability', async () => {
    await mount();
    await act(async () => {
      rowTitled(renderer(), 'High-level agents').props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      game?.tuneBusiness('ui-agent', { kind: 'payroll', payroll: 'high' });
      await Promise.resolve();
    });
    expect(game?.state?.businesses[0]?.payroll).toBe('high');
    expect(game?.state?.businesses[0]?.agentLevel).toBe('high');
    await act(async () => {
      rowTitled(renderer(), 'Hire someone').props.onPress();
      await Promise.resolve();
    });
    expect(game?.state?.businesses[0]?.staff).toBe(2);
    expect(game?.state?.businesses[0]?.autoStaff).toBe(false);
    await act(async () => {
      rowTitled(renderer(), 'Let a manager handle staffing').props.onPress();
      await Promise.resolve();
    });
    expect(game?.state?.businesses[0]?.autoStaff).toBe(true);
    expect(game?.state?.businesses[0]?.agentLevel).toBe('high');
  });
});
