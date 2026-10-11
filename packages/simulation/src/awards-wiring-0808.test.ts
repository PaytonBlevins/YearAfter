/**
 * Ticket 0808 — the wires that carry the awards year into the character's life, watched from outside.
 *
 * What the awards layer decides (a Laurel, a sweep, a chart) is tested on its own. What this file checks is that
 * `advanceYear` USES the answer: the lines reach the feed under their own ids, the mood reaches the spirits, the
 * records go last and the fame joins the other fames. The awards year is replaced by itself with one thing forced,
 * the same life and the same year, so the only difference there can be is that thing.
 */

import { describe, expect, it, vi } from 'vitest';

const forced = vi.hoisted(() => ({
  mood: 0,
  fame: 0,
  lines: [] as { kind: 'passive' | 'milestone'; text: string }[],
  records: [] as { category: string; label: string }[],
}));

vi.mock('./awards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./awards')>();
  return {
    ...actual,
    runAwardsYear: (input: Parameters<typeof actual.runAwardsYear>[0]) => ({
      ...actual.runAwardsYear(input),
      mood: forced.mood,
      fame: forced.fame,
      lines: forced.lines,
      records: forced.records,
    }),
  };
});

import { advanceYear } from './advance';
import { decide } from './decide';
import { createNewGame } from './new-game';
import type { GameState } from './game-state';

function answerOthers(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending[0];
    const choice =
      open?.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : open?.choices[0];
    if (!open || !choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

const reset = (): void => {
  forced.mood = 0;
  forced.fame = 0;
  forced.lines = [];
  forced.records = [];
};

const withHappiness = (seed: string, happiness: number): GameState => {
  const base = createNewGame({ seed });
  return { ...base, player: { ...base.player, stats: { ...base.player.stats, happiness } } };
};

describe('the awards year, as the life receives it', () => {
  it('moves the spirits by its mood: up for good news when they are low, down for bad when they are high', () => {
    const after = (mood: number, start: number): number => {
      forced.mood = mood;
      try {
        return advanceYear(withHappiness('awards-mood', start)).state.player.stats.happiness;
      } finally {
        reset();
      }
    };
    expect(after(6, 20)).toBeGreaterThan(after(0, 20));
    expect(after(-6, 80)).toBeLessThan(after(0, 80));
    expect(after(9, 20)).toBeGreaterThan(after(3, 20));
  });

  it('writes its lines in the feed under the awards ids, in order, as the kind it said', () => {
    forced.lines = [
      { kind: 'milestone', text: 'A forced line about a prize.' },
      { kind: 'passive', text: 'Another forced line.' },
    ];
    try {
      const next = advanceYear(createNewGame({ seed: 'awards-lines' })).state;
      const year = next.world.year;
      const mine = next.player.timeline.filter((row) => row.id.startsWith(`t:${year}:awards:`));
      expect(mine.map((row) => [row.id, row.kind, row.text])).toEqual([
        [`t:${year}:awards:0`, 'milestone', 'A forced line about a prize.'],
        [`t:${year}:awards:1`, 'passive', 'Another forced line.'],
      ]);
    } finally {
      reset();
    }
  });

  it('holds the fame it names, and leaves the fame alone when it names none', () => {
    forced.fame = 57;
    try {
      expect(advanceYear(createNewGame({ seed: 'awards-fame' })).state.fame).toBe(57);
    } finally {
      reset();
    }
    expect(advanceYear(createNewGame({ seed: 'awards-fame' })).state.fame).toBe(0);
  });

  it('puts its records last in the year, stamped with the age and the year, and moves no other record', () => {
    const play = (inject: boolean, seed: string): GameState => {
      // A superstar driver wins titles, so other records arrive in the same years as the forced ones.
      const base = createNewGame({ seed });
      let state: GameState = {
        ...base,
        player: { ...base.player, age: 24, talents: { ...base.player.talents, athletics: true } },
        sports: {
          ...base.sports,
          career: {
            sportId: 'racing',
            stage: 'pro',
            startedAge: 9,
            seasons: 12,
            hardSeasons: 10,
            form: 98,
            trainedAtAge: -1,
            trainedCount: 0,
            reputation: 60,
            titles: 3,
            tier: 'superstar',
            best: 'superstar',
            peak: 'superstar',
            breakout: 1,
            proSeasons: 6,
            endAge: 60,
            team: 'Redline Motorsport',
          },
        },
      };
      for (let index = 0; index < 14 && state.player.alive; index += 1) {
        forced.records = inject ? [{ category: 'award', label: `A forced prize ${index}` }] : [];
        state = answerOthers(advanceYear(answerOthers(state)).state);
      }
      return state;
    };
    try {
      // A life in which the driver wins a few titles, so other records arrive in the same years as the forced ones.
      let seed = 'awards-records-0';
      for (let index = 0; index < 40; index += 1) {
        seed = `awards-records-${index}`;
        const titles = play(false, seed).player.records.filter(
          (row) => row.category === 'championship',
        );
        if (titles.length >= 3) break;
      }
      const plain = play(false, seed);
      const injected = play(true, seed);
      const mine = injected.player.records.filter((row) => row.label.startsWith('A forced prize'));
      expect(mine.length).toBeGreaterThan(8);
      for (const row of mine) {
        expect(row.category).toBe('award');
        expect(row.year).toBeGreaterThan(0);
        expect(row.id).toContain(`${row.year}`);
      }
      const others = injected.player.records.filter(
        (row) => !row.label.startsWith('A forced prize'),
      );
      // Nothing else is moved or lost, whatever the ids say (a forced record shifts the count that ids carry).
      expect(others.map((row) => row.label)).toEqual(plain.player.records.map((row) => row.label));
      // In every year the forced record comes after the titles the sports year made. (Other steps later in the year
      // add records of their own after all of these, so only the sports year’s are compared.)
      let crowded = 0;
      for (const row of mine) {
        const earlier = injected.player.records.filter(
          (other) => other.year === row.year && other.category === 'championship',
        );
        for (const other of earlier) {
          expect(injected.player.records.indexOf(other), `${row.year} ${other.label}`).toBeLessThan(
            injected.player.records.indexOf(row),
          );
        }
        if (earlier.length > 0) crowded += 1;
      }
      expect(crowded).toBeGreaterThan(2);
      // The driver’s own titles are in the plain run, so there is something for a forced record to push aside.
      expect(
        plain.player.records.filter((row) => row.category === 'championship').length,
      ).toBeGreaterThan(2);
    } finally {
      reset();
    }
  });
});
