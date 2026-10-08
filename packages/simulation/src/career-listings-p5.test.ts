import { describe, expect, it } from 'vitest';
import { ALL_JOBS, fitsStudy, cannotApply } from '@yearafter/careers';
import { MAJORS, findLicense } from '@yearafter/education';
import {
  applyFor,
  createNewGame,
  openings,
  atTheDoor,
  chanceOf,
  withFirstJobOffer,
  OFFER_EVENT_ID,
  TAKE_IT,
  decide,
  type GameState,
} from './index';

function graduate(seed = 'p5-simulation'): GameState {
  const base = createNewGame({ seed });
  const major = MAJORS.find((m) => m.kind === 'undergraduate' && m.opens.includes('creative'));
  if (!major) throw new Error('Missing creative degree');
  return {
    ...base,
    player: { ...base.player, age: 30 },
    education: {
      ...base.education,
      stage: 'graduated',
      majorId: major.id,
      credentials: { highSchool: 18, university: 22 },
      finishedAtAge: 22,
    },
  };
}
describe('P5 real simulation listing context', () => {
  it('refuses an underage direct application without consuming RNG', () => {
    const base = createNewGame({ seed: 'p5-underage' });
    const state = { ...base, player: { ...base.player, age: 15 } };
    const before = state.rng.snapshot();
    const answer = applyFor(state, 'job.food.crew');
    expect(answer.ok).toBe(false);
    expect(answer.ok ? undefined : answer.error).toBe('too-young');
    expect(state.rng.snapshot()).toEqual(before);
  });
  it('passes the studied fields into the actual board', () => {
    const state = graduate();
    const major = MAJORS.find((m) => m.id === state.education.majorId);
    if (!major) throw new Error('Missing major');
    expect(atTheDoor(state).opens).toEqual(major.opens);
    const shown = openings(state);
    expect(shown).toHaveLength(12);
    expect(shown.filter((j) => major.opens.includes(j.track)).length).toBeGreaterThanOrEqual(2);
    for (const j of shown) expect(cannotApply(j, atTheDoor(state))).toBeUndefined();
  });
  it('uses held training even when the current major is unrelated', () => {
    const state = graduate();
    const trained = {
      ...state,
      education: {
        ...state.education,
        majorId: undefined,
        credentials: { highSchool: 18, licenses: ['lic.electrical'] },
      },
    };
    expect(atTheDoor(trained).licenses).toEqual(['lic.electrical']);
    expect(atTheDoor(trained).opens).toEqual([]);
    for (let year = 2030; year < 2060; year++) {
      const next = { ...trained, world: { ...trained.world, year } };
      const fields = findLicense('lic.electrical')?.opens;
      expect(fields).toBeDefined();
      expect(openings(next).filter((j) => fields?.includes(j.track)).length).toBeGreaterThanOrEqual(
        2,
      );
    }
  });
  it('renders the same board repeatedly without consuming RNG or mutating state', () => {
    const state = graduate();
    const before = state.rng.snapshot();
    const education = JSON.stringify(state.education);
    const board = openings(state).map((j) => String(j.id));
    for (let i = 0; i < 10; i++) expect(openings(state).map((j) => String(j.id))).toEqual(board);
    expect(state.rng.snapshot()).toEqual(before);
    expect(JSON.stringify(state.education)).toBe(education);
  });
  it('refreshes by year and decorrelates characters', () => {
    const state = graduate('p5-draw');
    const board = openings(state).map((j) => String(j.id));
    expect(
      openings({ ...state, world: { ...state.world, year: state.world.year + 1 } }).map((j) =>
        String(j.id),
      ),
    ).not.toEqual(board);
    const other = graduate('p5-other-draw');
    expect(openings(other).map((j) => String(j.id))).not.toEqual(board);
  });
  it('keeps curation from changing qualification gates or hiring odds', () => {
    const state = graduate();
    const without = { ...state, education: { ...state.education, majorId: undefined } };
    const unrelated = ALL_JOBS.find(
      (j) => !fitsStudy(atTheDoor(state), j) && cannotApply(j, atTheDoor(state)) === undefined,
    );
    if (!unrelated) throw new Error('Missing unrelated job');
    expect(chanceOf(state, unrelated)).toBe(chanceOf(without, unrelated));
    expect(atTheDoor(state).reached).toEqual(atTheDoor(without).reached);
    expect(atTheDoor(state).experience).toBe(atTheDoor(without).experience);
    const physician = ALL_JOBS.find((j) => String(j.id) === 'job.medicine.physician');
    if (!physician) throw new Error('Missing physician');
    expect(cannotApply(physician, atTheDoor(state))).toBeDefined();
    expect(chanceOf(state, physician)).toBe(0);
  });
  it('first-job offers and their actual hire come from this same board', () => {
    const state = graduate();
    const ready = { ...state, education: { ...state.education, finishedAtAge: 30 } };
    const going = openings(ready).map((j) => String(j.id));
    const offered = withFirstJobOffer(ready);
    expect(offered.offer).toBeDefined();
    expect(going).toContain(offered.offer?.jobId);
    const answer = decide(offered, OFFER_EVENT_ID, TAKE_IT);
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error(answer.error);
    expect(answer.value.state.employment.job?.jobId).toBe(offered.offer?.jobId);
    expect(going).toContain(answer.value.state.employment.job?.jobId);
  });
});
