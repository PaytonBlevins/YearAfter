/**
 * Ticket 0401 — the door.
 *
 * `reachOf` is one small function and it decides how much of the catalog a
 * player ever sees: measured before the ticket, a life saw 13 of 49 jobs and 20
 * of the 49 were never shown to a single character across 100 played lives.
 * These are the rules that number depends on, so they are asserted rather than
 * left to the measurement harness that found them — a harness gets deleted.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_JOBS,
  EARNED_REACH_STANDING,
  LISTINGS,
  TRANSFERABLE_AFTER,
  cannotApply,
  hireChance,
  applicantFor,
  openingsFor,
  reachOf,
  type OpeningsContext,
} from './index';

const door = (over: Partial<OpeningsContext> = {}): OpeningsContext => ({
  age: 30,
  education: 'highSchool',
  reached: {},
  experience: 0,
  standing: {},
  licenses: [],
  ...over,
});

const ladders = (() => {
  const byTrack = new Map<string, number>();
  for (const job of ALL_JOBS)
    byTrack.set(job.track, Math.max(byTrack.get(job.track) ?? 0, job.rung));
  return byTrack;
})();

/** A rung-1 job on a track with a real ladder, needing no credential. */
const firstStepUp = ALL_JOBS.find(
  (job) => job.rung === 1 && job.requires === 'none' && (ladders.get(job.track) ?? 0) >= 2,
);

describe('reachOf — what the door reads', () => {
  it('a stranger with no work behind them is still a stranger', () => {
    expect(reachOf(door({ experience: TRANSFERABLE_AFTER - 1 }), 'trades')).toBe(-1);
  });

  it('a long career anywhere is worth the front step everywhere', () => {
    expect(reachOf(door({ experience: TRANSFERABLE_AFTER }), 'trades')).toBe(0);
  });

  it('never counts transferable experience against a track already worked', () => {
    // Somebody on rung 2 of trades does not get demoted to 0 by the floor.
    const context = door({ experience: 30, reached: { trades: 2 } });
    expect(reachOf(context, 'trades')).toBe(2);
  });

  it('standing buys one more rung, and only on the track that earned it', () => {
    const context = door({
      reached: { trades: 1, food: 1 },
      standing: { trades: EARNED_REACH_STANDING, food: EARNED_REACH_STANDING - 1 },
    });
    expect(reachOf(context, 'trades')).toBe(2);
    expect(reachOf(context, 'food')).toBe(1);
  });

  it('standing on a track never worked buys nothing', () => {
    // Standing exists per track from the moment a job is held; a track with
    // standing and no rung is not a ladder somebody is on.
    const context = door({ standing: { trades: 99 } });
    expect(reachOf(context, 'trades')).toBe(-1);
  });
});

describe('the gate, after 0401', () => {
  it('opens the first step up on an untouched ladder to an experienced worker', () => {
    expect(firstStepUp).toBeDefined();
    if (!firstStepUp) return;
    expect(cannotApply(firstStepUp, door({ experience: 0 }))).toBe('out-of-reach');
    expect(cannotApply(firstStepUp, door({ experience: TRANSFERABLE_AFTER }))).toBeUndefined();
  });

  it('still refuses the top of a ladder to somebody who has never been on it', () => {
    const deep = ALL_JOBS.find((job) => job.rung >= 3 && job.requires === 'none');
    expect(deep).toBeDefined();
    if (!deep) return;
    expect(cannotApply(deep, door({ experience: 40 }))).toBe('out-of-reach');
  });

  it('does not let experience stand in for a credential', () => {
    const credentialed = ALL_JOBS.find((job) => job.requires !== 'none');
    expect(credentialed).toBeDefined();
    if (!credentialed) return;
    expect(cannotApply(credentialed, door({ experience: 40, education: 'none' }))).toBe(
      'needs-education',
    );
  });
});

describe('the odds are not moved by the door', () => {
  /*
    THE WHOLE SHAPE OF 0401 IS HERE. The gate loosened; the interview did not.
    If `reachOf` ever leaks into `applicantFor`, a career changer would both be
    allowed to apply AND be treated as though they had done the job below, and
    the ladder would stop meaning anything. This fails the moment that happens.
  */
  it('an experienced stranger may apply and is still the long shot', () => {
    expect(firstStepUp).toBeDefined();
    if (!firstStepUp) return;
    const base = {
      age: 40,
      smarts: 50,
      charisma: 50,
      discipline: 50,
      looks: 50,
      education: 'highSchool' as const,
      opens: [] as readonly string[],
      licenses: [] as readonly string[],
      experience: 20,
    };
    const stranger = hireChance(firstStepUp, applicantFor(firstStepUp, base, {}, {}));
    const insider = hireChance(
      firstStepUp,
      applicantFor(firstStepUp, base, {}, { [firstStepUp.track]: 0 }),
    );
    expect(stranger).toBeLessThan(insider);
  });
});

describe('the listings, after 0401', () => {
  it('weights a step-up by the same rung the gate let through', () => {
    /*
      A DERIVED GUARD, not a pinned number. The defect this replaces would have
      been silent: `cannotApply` reading the effective rung while the weighting
      read the raw one lets a job through the door and then scores it as a cold
      start — eligible, and still never listed, which is exactly the shape 0401
      was written to fix. So: every job the gate admits must be capable of
      appearing, and a step-up must beat a cold start on an equal draw.
    */
    const context = door({ experience: 20 });
    const eligible = ALL_JOBS.filter((job) => cannotApply(job, context) === undefined);
    const flat = openingsFor(context, () => 0.5);
    expect(flat.length).toBe(Math.min(LISTINGS, eligible.length));
    // On an equal draw the weight decides, so the list must not be all rung 0.
    expect(flat.some((job) => job.rung > 0)).toBe(true);
  });

  it('shows more of the catalog to an experienced worker than to a school leaver', () => {
    const seenBy = (context: OpeningsContext): number => {
      const shown = new Set<string>();
      for (let year = 2000; year < 2060; year += 1) {
        for (const job of openingsFor(context, (candidate) =>
          hash(`${year}:${String(candidate.id)}`),
        )) {
          shown.add(String(job.id));
        }
      }
      return shown.size;
    };
    expect(seenBy(door({ experience: 20 }))).toBeGreaterThan(seenBy(door({ experience: 0 })));
  });
});

/** A deterministic [0,1) so these tests do not depend on the simulation's rng. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_003) / 1_000_003;
}
