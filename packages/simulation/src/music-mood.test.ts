/**
 * Ticket 0806 — the one wire that cannot be watched from outside: a musician's year of news reaches the character's
 * spirits. A year's mood cannot be read off a finished life (a hit moves cash, a name and a dozen small things, and
 * the stats the year ends on are chaotic in all of them), so the music year is replaced here by itself with its mood
 * set, and everything else about it left exactly as it was. The same life, the same year, a mood of nothing and a
 * mood of six: the only difference there can be is the mood.
 */

import { describe, expect, it, vi } from 'vitest';

const forced = vi.hoisted(() => ({ mood: 0 }));

vi.mock('./music', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./music')>();
  return {
    ...actual,
    runMusicYear: (input: Parameters<typeof actual.runMusicYear>[0]) => ({
      ...actual.runMusicYear(input),
      mood: forced.mood,
    }),
  };
});

import { advanceYear } from './advance';
import { createNewGame } from './new-game';
import type { GameState } from './game-state';

const withHappiness = (seed: string, happiness: number): GameState => {
  const base = createNewGame({ seed });
  return { ...base, player: { ...base.player, stats: { ...base.player.stats, happiness } } };
};

describe('the mood of a musician’s year', () => {
  const happinessAfter = (mood: number, start: number): number => {
    forced.mood = mood;
    try {
      return advanceYear(withHappiness('mood-wire', start)).state.player.stats.happiness;
    } finally {
      forced.mood = 0;
    }
  };

  it('reaches the character’s spirits: up for good news when they are low, down for bad when they are high', () => {
    expect(happinessAfter(6, 20)).toBeGreaterThan(happinessAfter(0, 20));
    expect(happinessAfter(-6, 80)).toBeLessThan(happinessAfter(0, 80));
  });
});
