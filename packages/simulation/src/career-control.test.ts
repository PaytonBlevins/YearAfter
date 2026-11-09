import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { findSport } from '@yearafter/content';
import { createNewGame } from './new-game';
import type { GameState } from './game-state';
import type { SportCareer } from './sports-state';
import type { ServiceCareer } from './military-state';
import {
  aptitudeCeiling,
  ceilingForAptitude,
  nextForm,
  sportAptitude,
  trainingEfficiency,
} from './sports-core';
import { leaveSport, runSportsYear } from './sports';
import { retirementAge, runArtsYear, startArt } from './sports-individual';
import {
  answerMilitaryOffer,
  endServiceTerm,
  retireFromService,
  runMilitaryYear,
  normalizeServiceDecision,
} from './military';
import { doFameWork, fameOffers, workToSettle } from './fame-work';
import { canContinueClass } from './class-budget';
import { combinedFame } from './fame-sources';

function adult(seed = 'career-control'): GameState {
  const state = createNewGame({ seed, talents: [] });
  return { ...state, player: { ...state.player, age: 30 }, pending: [] };
}
const career: SportCareer = {
  sportId: 'basketball',
  stage: 'pro',
  startedAge: 20,
  seasons: 10,
  hardSeasons: 5,
  form: 80,
  trainedAtAge: 30,
  trainedCount: 3,
  reputation: 40,
  titles: 1,
  tier: 'starter',
  peak: 'starter',
  endAge: 25,
  contract: { salary: 1000000, yearsLeft: 3, rookie: false },
};
function serving(years: number, termEnds = years + 1): GameState {
  const state = adult();
  const service: ServiceCareer = {
    branch: 'army',
    track: 'enlisted',
    specialty: 'army.infantry',
    stage: 'serving',
    enlistedAge: 18,
    commissionedAt: 0,
    grade: 7,
    years,
    termEnds,
    performance: 90,
    reputation: 70,
    effort: 'normal',
    lastPay: 70000,
    post: 'Fort Harlan',
  };
  return {
    ...state,
    player: { ...state.player, age: 18 + years },
    military: { past: [], service },
  };
}
const year = (state: GameState) =>
  runMilitaryYear({
    before: state,
    education: state.education,
    age: state.player.age + 1,
    year: state.world.year + 1,
  });

describe('November player career control', () => {
  it('keeps hidden aptitude stable across years and different for activities', () => {
    const state = adult();
    expect(sportAptitude(state, 'boxing')).toBe(
      sportAptitude({ ...state, world: { ...state.world, year: 2090 } }, 'boxing'),
    );
    expect(
      new Set(['boxing', 'swimming', 'karting'].map((id) => sportAptitude(state, id))).size,
    ).toBeGreaterThan(1);
    expect(ceilingForAptitude(35)).toBeLessThan(50);
    expect(ceilingForAptitude(60)).toBe(65);
    expect(ceilingForAptitude(80)).toBe(95);
    expect(trainingEfficiency(state)).toBe(0.85);
    const talented = {
      ...state,
      player: { ...state.player, talents: { ...state.player.talents, athletics: true } },
    };
    expect(aptitudeCeiling(talented, 'boxing')).toBe(100);
    expect(trainingEfficiency(talented)).toBe(1);
  });
  it('lets effort offset neglect and age reduces form gradually', () => {
    const state = adult();
    const worked = nextForm(state, career, 40);
    expect(worked).toBeGreaterThanOrEqual(77);
    expect(worked).toBeLessThan(80);
    expect(nextForm(state, { ...career, trainedCount: 0 }, 40)).toBeLessThan(worked);
  });
  it('does not impose early rank-based retirement on existing saves', () => {
    const sport = findSport('basketball')!;
    expect(retirementAge(sport, 'fringe', 'same', 1)).toBe(
      retirementAge(sport, 'superstar', 'same', 1),
    );
    let continued = 0;
    for (let n = 0; n < 30; n++) {
      const state = adult(`retirement-${n}`);
      const out = runSportsYear({
        before: { ...state, sports: { past: [], career } },
        education: state.education,
        age: 31,
        year: 2031,
      });
      expect(out.sports.past.some((row) => row.how === 'retired')).toBe(false);
      if (out.sports.career) continued++;
    }
    expect(continued).toBeGreaterThan(25);
  });
  it('offers manual exit and preserves independent classes', () => {
    const started = startArt(adult(), 'boxing');
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const state = { ...started.value.state, sports: { ...started.value.state.sports, career } };
    const out = leaveSport(state);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.state.sports.career).toBeUndefined();
    expect(out.value.state.sports.arts).toEqual(state.sports.arts);
    expect(out.value.state.sports.past.at(-1)?.how).toBe('retired');
  });
  it('keeps classes with available cash even at a low lifestyle, stops only unaffordable classes', () => {
    const started = startArt(adult(), 'boxing');
    if (!started.ok) throw Error('fixture');
    const rich = {
      ...started.value.state,
      finance: { ...started.value.state.finance, balance: dollars(100000) },
    };
    expect(runArtsYear(rich, 31, 2031, 0).arts).toHaveLength(1);
    expect(runArtsYear(started.value.state, 31, 2031, 0).arts).toHaveLength(0);
    expect(canContinueClass(rich, 'boxing', 0)).toBe(true);
  });
  it('has an end-term button after four years, without four-year popups', () => {
    expect(endServiceTerm(serving(3)).ok).toBe(false);
    expect(endServiceTerm(serving(4)).ok).toBe(true);
    for (const years of [3, 7, 11, 15])
      expect(year(serving(years)).military.offer?.kind).not.toBe('reenlist');
    expect(retireFromService(serving(19)).ok).toBe(false);
  });
  it('asks once at twenty, keeps retirement available, and forces retirement at65', () => {
    const state = serving(19, 20);
    const out = year(state);
    expect(out.military.offer?.kind).toBe('reenlist');
    const asked = { ...state, military: out.military, player: { ...state.player, age: 38 } };
    const continued = answerMilitaryOffer(asked, 'reenlist');
    expect(continued.ok).toBe(true);
    if (!continued.ok) return;
    expect(retireFromService(continued.value.state).ok).toBe(true);
    expect(year(continued.value.state).military.offer?.kind).not.toBe('reenlist');
    const old = serving(46, 100);
    expect(year(old).military.service).toBeUndefined();
    expect(year(old).military.past.at(-1)?.how).toBe('retired');
  });
  it('removes a saved routine term prompt', () => {
    const state = serving(4, 4);
    const offer = {
      kind: 'reenlist' as const,
      branch: 'army' as const,
      track: 'enlisted' as const,
      grade: 7,
      years: 4,
      age: 22,
      eventId: 'military.offer',
    };
    const cleaned = normalizeServiceDecision({ ...state, military: { ...state.military, offer } });
    expect(cleaned.military.offer).toBeUndefined();
  });
  it('applies positive and negative reception immediately and never settles it twice', () => {
    const changes: number[] = [];
    for (let n = 0; n < 80; n++) {
      const state = { ...adult(`reception-${n}`), fame: 50 };
      const offer = fameOffers(state)[0];
      if (!offer) continue;
      const out = doFameWork(state, offer.def.id);
      if (!out.ok) throw Error('offered');
      changes.push(out.value.fame - state.fame);
      expect(workToSettle(out.value)[0]?.fame).toBe(0);
      expect(doFameWork(out.value, offer.def.id).ok).toBe(false);
      expect(doFameWork(state, offer.def.id)).toEqual(out);
    }
    expect(changes.some((n) => n < 0)).toBe(true);
    expect(changes.some((n) => n > 0)).toBe(true);
    expect(combinedFame(47, 0, 60, 0, 0, 0, 0)).toBeLessThan(60);
  });
});
