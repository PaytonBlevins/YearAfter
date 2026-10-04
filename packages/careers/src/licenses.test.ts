/**
 * Ticket 0406 — the license gate.
 *
 * WHAT THIS EXISTS TO STOP COMING BACK. Before 0406, `requires: 'postgraduate'`
 * was the only door on Physician, and `meetsLevel` is an ORDERED comparison —
 * so a master's in fine arts cleared it exactly as well as a medical degree
 * did. The catalog had said "you legally cannot do this job without it" since
 * 0210b and had never been able to express the commonest version of that
 * sentence, which is not "enough schooling" but "this specific license".
 *
 * Two claims, and they pull in opposite directions on purpose:
 *
 *  - A license is a WALL that no amount of schooling climbs. This is the half
 *    that makes medical school mean something.
 *  - A license is a LADDER you are credited with having climbed. This is the
 *    half that makes trade school worth two years, on a trades ladder that
 *    requires no qualification whatsoever and never will.
 *
 * Both are asserted below against the real catalog rather than a fixture,
 * because the thing that would break them is a catalog edit.
 */

import { describe, expect, it } from 'vitest';
import { ALL_JOBS, findJob } from './jobs';
import { cannotApply, reachOf, type OpeningsContext } from './openings';
import { hireChance } from './employment';
import { applicantFor } from './index';
import { MAJORS } from '@yearafter/education';

const door = (over: Partial<OpeningsContext> = {}): OpeningsContext => ({
  age: 32,
  education: 'postgraduate',
  reached: {},
  experience: 10,
  standing: {},
  licenses: [],
  ...over,
});

describe('Ticket 0406 — a license is not a level', () => {
  it('shuts a licensed job to somebody who holds every degree and not the paper', () => {
    const physician = findJob('job.medicine.physician');
    expect(physician, 'the catalog no longer has a physician').toBeDefined();
    if (!physician) return;

    /*
      THE SABOTAGE CHECK IS THE FIRST ASSERTION, not a comment about one. This
      character holds `postgraduate`, which is everything `requires` can ask
      for, and has stood on the rung below — so if the license door were
      removed this line goes green and the test still passes on the second
      half. It is here to fail loudly if `job.license` ever stops being read.
    */
    const qualified = door({ reached: { medicine: 1 }, licenses: ['lic.md'] });
    expect(cannotApply(physician, qualified)).toBeUndefined();

    const unlicensed = door({ reached: { medicine: 1 } });
    expect(cannotApply(physician, unlicensed)).toBe('needs-license');

    // And the wrong license is no license. A dentist may not practise medicine.
    const wrongPaper = door({ reached: { medicine: 1 }, licenses: ['lic.dds'] });
    expect(cannotApply(physician, wrongPaper)).toBe('needs-license');
  });

  it('gives it zero odds as well as a shut door', () => {
    /*
      CORE_RULES 13.15 — a gate guards what it hands back as well as what it
      lets through. `cannotApply` is the first enforcement point and
      `hireChance` is the second, because a caller who skips the first must not
      be able to walk a character into a job they cannot legally hold.
    */
    const physician = findJob('job.medicine.physician');
    if (!physician) return;
    const base = {
      age: 32,
      smarts: 90,
      charisma: 90,
      discipline: 90,
      looks: 70,
      education: 'postgraduate' as const,
      opens: ['medicine'] as readonly string[],
      experience: 10,
    };
    const without = hireChance(
      physician,
      applicantFor(physician, { ...base, licenses: [] }, { medicine: 80 }, { medicine: 1 }),
    );
    const with_ = hireChance(
      physician,
      applicantFor(physician, { ...base, licenses: ['lic.md'] }, { medicine: 80 }, { medicine: 1 }),
    );
    expect(without).toBe(0);
    expect(with_).toBeGreaterThan(0);
  });

  it('credits a trade license with the apprenticeship it replaces', () => {
    /*
      The trades ladder is the one that needs no qualification at all — every
      rung of it is `requires: 'none'` and that is deliberate (spec 119, spec
      1405). So a trade license cannot prove itself by opening a door, because
      the door was never shut. What it buys is the YEARS: `reachOf` treats the
      holder as somebody who has already stood on rung 1, so they may apply
      straight to the journeyman job instead of serving the apprenticeship.
    */
    const journeyman = findJob('job.trades.electrician');
    expect(journeyman, 'the catalog no longer has an electrician').toBeDefined();
    if (!journeyman) return;
    expect(journeyman.rung, 'the electrician is no longer above the apprentice').toBeGreaterThan(1);

    const nobody = door({ education: 'highSchool', experience: 0 });
    const licensed = door({ education: 'highSchool', experience: 0, licenses: ['lic.electrical'] });

    expect(reachOf(nobody, 'trades')).toBe(-1);
    expect(reachOf(licensed, 'trades')).toBe(1);
    expect(cannotApply(journeyman, nobody)).toBe('out-of-reach');
    expect(cannotApply(journeyman, licensed)).toBeUndefined();

    // And only on its own track. A plumbing license is not a way into an office.
    expect(reachOf(door({ licenses: ['lic.plumbing'], experience: 0 }), 'office')).toBe(-1);
  });

  it('never credits a license with more than the experience already earned', () => {
    // A floor, not a replacement: fifteen years on the tools still reads as
    // fifteen years. The version that took the license INSTEAD of the record
    // demoted every licensed veteran to a school leaver.
    const veteran = door({
      reached: { trades: 3 },
      standing: { trades: 90 },
      licenses: ['lic.electrical'],
    });
    expect(reachOf(veteran, 'trades')).toBe(4);
  });

  it('keeps every licensed job inside a profession that can be trained for', () => {
    /*
      THE GUARD THAT MATTERS WHEN THE CATALOG GROWS. A job gated on a license
      that no program grants is unreachable by anybody, forever, and it is
      invisible in the worst way: the game believes the player could have had
      it. This is the license half of what `reachability.test.ts` asserts for
      the listings.

      Deliberately checks against the education package's own catalog rather
      than a list kept here, so adding a job with a typo'd license id fails
      this rather than silently orphaning the row.
    */
    const granted = new Set(
      MAJORS.map((program) => program.grants).filter((id): id is string => id !== undefined),
    );
    const orphans = ALL_JOBS.filter(
      (job) => job.license !== undefined && !granted.has(job.license),
    );
    expect(
      orphans.map((job) => `${job.title} (${job.license})`),
      'a job wants a license no program hands out',
    ).toEqual([]);
  });
});
