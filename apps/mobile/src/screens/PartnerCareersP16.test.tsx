import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asNpcId, asSaveId, clampStat } from '@yearafter/core';
import { findJob, startPartnerCareer, type PartnerChange } from '@yearafter/careers';
import { createNewGame, partnerIncomeOf, type GameState } from '@yearafter/simulation';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import type { Acquaintance } from '@yearafter/social';
import { GameProvider, useGame } from '../stores/gameStore';
import { PersonScreen } from './PersonScreen';
import { rowTitled, rowsOf, textsOf } from '../test/harness';
vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { personId: 'ui-partner' }, pop: vi.fn(), push: vi.fn() }),
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
async function mount(
  change: PartnerChange = 'raise',
  status: 'working' | 'notWorking' | 'retired' = 'working',
  stage: 'seeing' | 'married' = 'married',
  settled = true,
) {
  const s = createNewGame({ seed: 'p16-ui', startYear: 2000 });
  const person: Acquaintance = {
    id: asNpcId('ui-partner'),
    firstName: 'Robin',
    lastName: 'Lee',
    sex: 'female',
    birthYear: 2000,
    alive: true,
    tier: 1,
    personality: s.player.personality,
    relationship: clampStat(90),
    kind: 'peer',
    context: 'app',
    metAtAge: 29,
    lastContactAge: 30,
    memories: [],
    inRoom: true,
    romance: { stage, since: 29 },
  };
  const c = startPartnerCareer({
    id: 'ui-partner',
    seed: s.rng.getSeed(),
    worldYear: 2030,
    age: 30,
    youngChild: false,
    playerPay: 60000,
  });
  // Real model, with status/change presentation exercised separately from annual random outcomes.
  const career = {
    ...c,
    change,
    last: status === 'notWorking' ? { status, gross: 0, net: 0, tax: 0 } : { ...c.last, status },
  };
  const state: GameState = {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    player: { ...s.player, age: 30 },
    circle: { ...s.circle, people: [person] },
    partnerCareers: settled ? { 'ui-partner': career } : {},
  };
  const repo = new MemorySaveRepository(),
    id = asSaveId('p16-ui');
  const saved = await repo.create(toSave(state, { id }));
  if (!saved.ok) throw Error(String(saved.error));
  await act(async () => {
    rendered = create(
      <GameProvider repository={repo}>
        <Probe />
        <PersonScreen />
      </GameProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { repo, id, state, career };
}
describe('P16 existing Person work row through the actual store', () => {
  it.each(['raise', 'cut', 'moved', 'promoted', 'returned', 'retired'] as const)(
    'shows the saved catalog job, annual gross and factual %s without changing pay',
    async (change) => {
      const { state, career, repo, id } = await mount(change);
      const r = rendered!;
      const row = rowTitled(r, findJob(career.jobId)!.title);
      expect(row.props.value).toBe(`$${career.last.gross.toLocaleString('en-US')} a year`);
      expect(row.props.subtitle).toContain(partnerIncomeOf(state).changeText);
      expect(row.props.affordance).toBe('none');
      const old = game!.state!.rng.snapshot(),
        model = JSON.stringify(game!.state!.partnerCareers);
      await act(async () => {
        r.update(
          <GameProvider repository={repo}>
            <Probe />
            <PersonScreen />
          </GameProvider>,
        );
      });
      expect(game!.state!.rng.snapshot()).toEqual(old);
      expect(JSON.stringify(game!.state!.partnerCareers)).toBe(model);
      const save = await repo.load(id);
      if (!save.ok) throw Error(String(save.error));
      expect(save.value.partnerCareers).toEqual(state.partnerCareers);
      expect(textsOf(r).join(' ')).not.toMatch(/Apply for|Manage their job/);
    },
  );
  it('shows an out-of-work spell without an invented salary', async () => {
    const { career } = await mount('stopped', 'notWorking');
    const row = rowTitled(rendered!, findJob(career.jobId)!.title);
    expect(row.props.value).toBeUndefined();
    expect(row.props.subtitle).toContain('Not working right now');
  });
  it('does not present a date as a household earner', async () => {
    const { career } = await mount('raise', 'working', 'seeing');
    expect(rowsOf(rendered!).some((r) => r.props.title === findJob(career.jobId)!.title)).toBe(
      false,
    );
  });
  it('explains first settlement, then shows the engine result and autosaves it', async () => {
    const { repo, id } = await mount('started', 'working', 'married', false);
    expect(rowTitled(rendered!, 'Work').props.subtitle).toBe(
      'Household pay starts with the next year.',
    );
    await act(async () => {
      game!.advance();
      await Promise.resolve();
    });
    const c = game!.state!.partnerCareers['ui-partner']!;
    expect(c).toBeDefined();
    expect(rowTitled(rendered!, findJob(c.jobId)!.title).props.subtitle).toContain(
      partnerIncomeOf(game!.state!).changeText,
    );
    const save = await repo.load(id);
    if (!save.ok) throw Error(String(save.error));
    expect(save.value.partnerCareers).toEqual(game!.state!.partnerCareers);
  });
});
