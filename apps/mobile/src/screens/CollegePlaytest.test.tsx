import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MAJORS, runCollegeYear } from '@yearafter/education';
import { JOBS } from '@yearafter/content';
import { asCharacterId, dollars } from '@yearafter/core';
import { createNewGame, type GameState } from '@yearafter/simulation';
import { ActionButton, ListRow } from '../components';
import { OutcomeCard } from '../components/OutcomeCard';
import { GraduationNotice, graduationOutcome } from '../components/GraduationNotice';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { ProgramScreen } from './ProgramScreen';
import { CareerScreen } from './shells';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn(),
  pop = vi.fn(),
  studyHarder = vi.fn(),
  leaveStudies = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
function enrolled(kind: 'undergraduate' | 'graduate' | 'vocational' = 'undergraduate'): GameState {
  const state = createNewGame({ seed: 'college-ui' });
  const program = MAJORS.find((row) => row.kind === kind);
  if (!program) throw new Error('No program fixture');
  return {
    ...state,
    player: { ...state.player, age: 25 },
    education: {
      ...state.education,
      stage: kind === 'graduate' ? 'postgrad' : kind === 'vocational' ? 'vocational' : 'college',
      majorId: program.id,
      collegeYear: program.years - 1,
      performance: 90,
      credentials: { highSchool: 18, ...(kind === 'graduate' ? { university: 22 } : {}) },
    },
  };
}
function completed(before: GameState, cash = 100_000): GameState {
  const age = before.player.age + 1;
  const result = runCollegeYear(before.education, {
    age,
    smarts: 100,
    discipline: 100,
    academics: true,
    cash,
    roll: 0.9,
  });
  return {
    ...before,
    world: { ...before.world, year: before.world.year + 1 },
    player: { ...before.player, age },
    education: result.state,
  };
}
async function render(
  Component: () => React.JSX.Element | null,
  state: GameState,
  overlay: Partial<ReturnType<typeof useGame>> = {},
) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({
    state,
    studyHarder,
    leaveStudies,
    ...overlay,
  });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push, pop });
  await act(() => {
    if (rendered) rendered.update(<Component />);
    else rendered = create(<Component />);
  });
  if (!rendered) throw new Error('Screen did not render');
  return rendered.root.findAllByType(ListRow);
}

describe('A8 — the enrolled program is visible and actionable', () => {
  it.each(['undergraduate', 'graduate', 'vocational'] as const)(
    'shows the actual %s length, fees and grades',
    async (kind) => {
      const state = enrolled(kind);
      const program = MAJORS.find((row) => row.id === state.education.majorId);
      if (!program) throw new Error('No program');
      const rows = await render(ProgramScreen, state);
      expect(rows.some((row) => row.props.title === program.name)).toBe(true);
      expect(rows.find((row) => row.props.title === 'Progress')?.props.value).toBe(
        `Year ${program.years} of ${program.years}`,
      );
      expect(rows.find((row) => row.props.title === 'Tuition each year')?.props.value).toBe(
        `$${program.tuition.toLocaleString('en-US')}`,
      );
      expect(rows.find((row) => row.props.title === 'Grades')?.props.value).toBe('A');
      await act(() => rows.find((row) => row.props.title === 'Study Harder')?.props.onPress());
      expect(studyHarder).toHaveBeenCalledOnce();
    },
  );
  it('caps family help at tuition and keeps the player share and debt visible', async () => {
    const state = enrolled();
    const program = MAJORS.find((row) => row.id === state.education.majorId);
    if (!program) throw new Error('No program');
    const rows = await render(ProgramScreen, {
      ...state,
      parenting: { ...state.parenting, collegeSupport: program.tuition + 5_000 },
      loans: [
        {
          productId: 'loan.student',
          principal: dollars(2_000),
          balance: dollars(2_000),
          termLeft: 10,
          inArrears: false,
        },
      ],
    });
    expect(rows.find((row) => row.props.title === 'Family help')?.props.value).toBe(
      `$${program.tuition.toLocaleString('en-US')}`,
    );
    expect(rows.find((row) => row.props.title === 'Your share each year')?.props.value).toBe('$0');
    expect(rows.find((row) => row.props.title === 'Student loan')?.props.value).toBe('$2,000');
  });
  it('requires a separate confirmation before leaving and allows staying', async () => {
    const rows = await render(ProgramScreen, enrolled());
    await act(() => rows.find((row) => row.props.title === 'Leave the program')?.props.onPress());
    expect(leaveStudies).not.toHaveBeenCalled();
    const stay = rendered?.root
      .findAllByType(ActionButton)
      .find((row) => row.props.label === 'Stay in the program');
    await act(() => stay?.props.onPress());
    expect(rendered?.root.findAllByType(ActionButton)).toHaveLength(0);
    await act(() => rows.find((row) => row.props.title === 'Leave the program')?.props.onPress());
    const leave = rendered?.root
      .findAllByType(ActionButton)
      .find((row) => row.props.label === 'Leave this program');
    await act(() => leave?.props.onPress());
    expect(leaveStudies).toHaveBeenCalledOnce();
    expect(pop).toHaveBeenCalledOnce();
  });
  it.each([false, true])('opens the program on Career, working=%s', async (working) => {
    const state = enrolled();
    const job = JOBS[0];
    if (!job) throw new Error('No job');
    const rows = await render(CareerScreen, {
      ...state,
      employment: {
        ...state.employment,
        ...(working
          ? {
              job: {
                jobId: job.id,
                since: 22,
                performance: 70,
                effort: 'steady' as const,
                pushedThisYear: 0,
              },
            }
          : {}),
      },
    });
    const row = rows.find(
      (item) =>
        item.props.title === MAJORS.find((program) => program.id === state.education.majorId)?.name,
    );
    expect(row).toBeDefined();
    await act(() => row?.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'program', title: 'Your program' });
    expect(rows.some((item) => item.props.title === 'Leave the program')).toBe(false);
  });
  it('handles a program that has ended without offering study or leave actions', async () => {
    const rows = await render(ProgramScreen, completed(enrolled()));
    expect(rows.some((row) => row.props.title === 'Study Harder')).toBe(false);
    expect(rows.some((row) => row.props.title === 'Leave the program')).toBe(false);
    await act(() =>
      rows.find((row) => row.props.title === 'See programs to study')?.props.onPress(),
    );
    expect(push).toHaveBeenCalledWith({ screen: 'college', title: 'Study something' });
  });
});

describe('A9 — earned graduation, not a misleading stage', () => {
  it.each(['undergraduate', 'graduate', 'vocational'] as const)(
    'celebrates an actual %s completion from the engine',
    (kind) => {
      const before = enrolled(kind),
        after = completed(before);
      const notice = graduationOutcome(before, after);
      expect(notice?.tone).toBe('good');
      expect(notice?.body).toContain(
        MAJORS.find((row) => row.id === before.education.majorId)?.name,
      );
      expect(notice?.body).toContain('No student loan left to repay');
      expect(notice?.body).toMatch(/requirements/);
    },
  );
  it('does not celebrate running out of tuition money despite stage graduated', () => {
    const before = enrolled();
    const after = completed(before, 0);
    expect(after.education.stage).toBe('graduated');
    expect(graduationOutcome(before, after)).toBeUndefined();
  });
  it('does not celebrate an actual failed-out engine result', () => {
    const state = enrolled();
    const before = { ...state, education: { ...state.education, performance: 0 } };
    const result = runCollegeYear(before.education, {
      age: 26,
      smarts: 0,
      discipline: 0,
      academics: false,
      cash: 100_000,
      roll: 0,
    });
    expect(result.ending).toBe('failed-out');
    const after = {
      ...before,
      world: { ...before.world, year: before.world.year + 1 },
      player: { ...before.player, age: 26 },
      education: result.state,
    };
    expect(graduationOutcome(before, after)).toBeUndefined();
  });
  it('does not celebrate failing out, unchanged qualifications, death or a different life', () => {
    const before = enrolled();
    const after = completed(before);
    expect(
      graduationOutcome(before, {
        ...after,
        education: { ...after.education, credentials: before.education.credentials },
      }),
    ).toBeUndefined();
    expect(
      graduationOutcome(before, { ...after, player: { ...after.player, alive: false } }),
    ).toBeUndefined();
    expect(
      graduationOutcome(before, {
        ...after,
        player: { ...after.player, id: asCharacterId('another-life') },
      }),
    ).toBeUndefined();
    expect(graduationOutcome(after, after)).toBeUndefined();
  });
  it('shows high-school completion and only tuition debt in the notice', () => {
    const state = enrolled();
    const before = {
      ...state,
      education: { ...state.education, stage: 'high' as const, credentials: {} },
    };
    const after = {
      ...completed(state),
      education: {
        ...state.education,
        stage: 'graduated' as const,
        credentials: { highSchool: state.player.age + 1 },
      },
      loans: [
        {
          productId: 'loan.student',
          principal: dollars(5_000),
          balance: dollars(4_000),
          termLeft: 10,
          inArrears: false,
        },
        {
          productId: 'loan.personal',
          principal: dollars(3_000),
          balance: dollars(3_000),
          termLeft: 3,
          inArrears: false,
        },
      ],
    };
    const notice = graduationOutcome(before, after);
    expect(notice?.body).toContain('high-school diploma');
    expect(notice?.body).toContain('$4,000');
    expect(notice?.body).not.toContain('$7,000');
  });
  it('waits behind another outcome, then dismisses without replaying on rerender', async () => {
    const before = enrolled(),
      after = completed(before);
    await render(GraduationNotice, before);
    expect(rendered?.root.findAllByType(OutcomeCard)).toHaveLength(0);
    await render(GraduationNotice, after, {
      outcome: { title: 'Another result', body: 'Already shown', tone: 'neutral' },
    });
    expect(rendered?.root.findAllByType(OutcomeCard)).toHaveLength(0);
    await render(GraduationNotice, after);
    const card = rendered?.root.findByType(OutcomeCard);
    expect(card).toBeDefined();
    await act(() => card?.props.onDismiss());
    await render(GraduationNotice, { ...after });
    expect(rendered?.root.findAllByType(OutcomeCard)).toHaveLength(0);
  });
  it('waits behind a decision and detail, then clears on a different life', async () => {
    const before = enrolled(),
      after = completed(before);
    await render(GraduationNotice, before);
    await render(GraduationNotice, after, {
      decision: {
        eventId: 'test',
        category: 'education',
        age: after.player.age,
        year: after.world.year,
        prompt: 'What happens next?',
        choices: [],
        names: {},
      },
    });
    expect(rendered?.root.findAllByType(OutcomeCard)).toHaveLength(0);
    await render(GraduationNotice, after, { detail: { title: 'Details', lines: [] } });
    expect(rendered?.root.findAllByType(OutcomeCard)).toHaveLength(0);
    await render(GraduationNotice, after);
    expect(rendered?.root.findAllByType(OutcomeCard)).toHaveLength(1);
    await render(GraduationNotice, createNewGame({ seed: 'different-life' }));
    expect(rendered?.root.findAllByType(OutcomeCard)).toHaveLength(0);
  });
  it('names a professional license alongside the degree it grants', () => {
    const state = enrolled('graduate');
    const program = MAJORS.find((row) => row.kind === 'graduate' && row.grants === 'lic.md');
    if (!program) throw new Error('No medical program');
    const before = {
      ...state,
      education: { ...state.education, majorId: program.id, collegeYear: program.years - 1 },
    };
    expect(graduationOutcome(before, completed(before))?.body).toContain('Medical license');
  });
  it('does not replay graduation when opening an already graduated save', async () => {
    await render(GraduationNotice, completed(enrolled()));
    expect(rendered?.root.findAllByType(OutcomeCard)).toHaveLength(0);
  });
});
