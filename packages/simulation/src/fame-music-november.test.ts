import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { newChannel } from '@yearafter/finance';
import { combinedFame } from './fame-sources';
import { createNewGame } from './new-game';
import { musicCollabGain, runMusicYear } from './music';
import { awardsInputOf, runAwardsYear } from './awards';
import { advanceYear } from './advance';
import type { GameState } from './game-state';

function artist(seed: string, active = true): GameState {
  const s = createNewGame({ seed });
  return {
    ...s,
    player: { ...s.player, age: 30, cash: dollars(2_000_000) },
    music: {
      ...s.music,
      craft: 95,
      catalogue: 30,
      listeners: 400_000,
      peak: 400_000,
      released: { single: 10, ep: 2, lp: 2 },
      reputation: 85,
      plan: { single: active ? 1 : 0, ep: 0, lp: 0, tour: false },
    },
  };
}
describe('November fame and music', () => {
  it('counts different audiences with diminishing returns, without counting history or sports awards twice', () => {
    expect(combinedFame(0, 12, 0, 0, 0, 31, 0)).toBe(6);
    expect(combinedFame(39, 12, 0, 0, 0, 31, 0)).toBe(39);
    expect(combinedFame(0, 0, 35, 42, 0, 0, 0)).toBe(6);
    expect(combinedFame(0, 60, 60, 0, 60, 100, 60)).toBe(15);
  });

  it('recognizes an independent channel alongside music in the actual annual turn', () => {
    const channel = newChannel({
      seed: 'different-crowds',
      id: 'online',
      platformId: 'video',
      categoryId: 'gaming',
      year: 2000,
    });
    const plain = artist('different-crowds');
    const music = advanceYear(plain).state.fame;
    const related = advanceYear({
      ...artist('different-crowds'),
      channels: [{ ...channel, categoryId: 'music', audience: 60_000 }],
    }).state.fame;
    const separate = advanceYear({
      ...artist('different-crowds'),
      channels: [{ ...channel, audience: 60_000 }],
    }).state.fame;
    expect(related).toBe(music);
    expect(separate).toBeGreaterThan(music);
  });

  it('lets national artists be nominated for eligible releases below 40 fame, but not for an idle year', () => {
    let nominations = 0;
    for (let n = 0; n < 100; n++) {
      const before = artist(`music-prize-${n}`);
      const year = before.world.year + 1;
      const out = runMusicYear({ before, year, age: 31, education: before.education });
      const nominated = (music: typeof out) =>
        runAwardsYear(
          awardsInputOf(before, year, {
            music,
            acting: { acting: before.acting, fame: 0 },
            modeling: { modeling: before.modeling, fame: 0 },
            sports: { sports: before.sports, fame: 0 },
          }),
        ).lines.some((line) => line.text.includes('You were up for'));
      if (out.fame < 40 && nominated(out)) {
        expect(out.awardEligible).toBe(true);
        expect(out.music.awards).toBe(before.music.awards);
        nominations++;
      }
      const idle = artist(`music-prize-${n}`, false);
      const quiet = runMusicYear({ before: idle, year, age: 31, education: idle.education });
      expect(nominated({ ...quiet, fame: 90 })).toBe(false);
    }
    expect(nominations).toBeGreaterThan(0);
  });
  it('lets a working, established national artist grow past the old ceiling in a seeded cohort', () => {
    const ends = Array.from({ length: 60 }, (_, n) => {
      let s = artist(`holdout-national-${n}`);
      for (let y = 0; y < 10; y++) {
        s = {
          ...s,
          music: { ...s.music, craft: 75, plan: { single: 2, ep: 0, lp: 1, tour: true } },
        };
        s = {
          ...s,
          music: runMusicYear({ before: s, age: 31 + y, year: 2031 + y, education: s.education })
            .music,
        };
      }
      return s.music.listeners;
    }).sort((a, b) => a - b);
    expect(ends[30]).toBeGreaterThan(450_000);
    expect(ends[30]).toBeLessThan(1_000_000);
    const idle = artist('quiet-national', false);
    expect(
      runMusicYear({ before: idle, age: 31, year: 2031, education: idle.education }).music
        .listeners,
    ).toBeLessThan(400_000);
  });

  it('gives music collaborations greater reach, with a repeat penalty and a listener cap', () => {
    const first = musicCollabGain(400_000, 700_000, 0);
    const third = musicCollabGain(400_000, 700_000, 2);
    expect(first).toBeGreaterThan(12_000);
    expect(first).toBeLessThan(28_000);
    expect(third).toBeCloseTo(first / 4, -1);
    expect(musicCollabGain(119_999_999, 700_000, 0)).toBe(1);
  });
});
