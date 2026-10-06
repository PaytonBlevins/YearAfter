/** Ticket 0701 — the creator catalog's talents are real talents. */

import { describe, expect, it } from 'vitest';
import { TALENT_KEYS } from '@yearafter/character';
import { CREATOR_CATEGORIES, CREATOR_LINES, creatorLine } from './index';

describe('the creator catalog', () => {
  it('names only talents that exist', () => {
    for (const category of CREATOR_CATEGORIES) {
      if (category.talent !== undefined) expect(TALENT_KEYS).toContain(category.talent);
    }
  });

  it('has at least two lines for every kind of note, with only known tokens', () => {
    for (const [kind, lines] of Object.entries(CREATOR_LINES)) {
      expect(lines.length, kind).toBeGreaterThanOrEqual(2);
      for (const line of lines) {
        for (const token of line.match(/\{(\w+)\}/g) ?? []) {
          expect([
            '{name}',
            '{platform}',
            '{audience}',
            '{mark}',
            '{place}',
            '{brand}',
            '{pay}',
            '{kind}',
            '{gained}',
            '{partner}',
            '{fee}',
            '{gain}',
            '{group}',
            '{cut}',
          ]).toContain(token);
        }
      }
    }
  });

  it('fills every token it is given', () => {
    const text = creatorLine(
      'milestone',
      'k',
      { name: 'Plain Answers', platform: 'Video', audience: 'subscribers', mark: '10,000' },
      (lines) => lines[0]!,
    );
    expect(text).toBe('Plain Answers passed 10,000 subscribers.');
    expect(text).not.toMatch(/[{}]/);
  });
});
