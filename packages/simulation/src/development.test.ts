/**
 * Ticket 0411 acceptance tests — the population half.
 *
 * Roadmap finding 2, open since 0211: *"Smarts and Discipline never move after
 * eighteen. An adult character does not develop."* Measured on 200 played lives
 * before this ticket, and it was not a tendency, it was exact:
 *
 * | Discipline | age 18 | age 30 | age 45 |
 * |---|---|---|---|
 * | p10 / median / p90 | 50 / 65 / 83 | 50 / 65 / 83 | 50 / 65 / 83 |
 * | sd | 12.0 | 12.0 | 12.0 |
 *
 * The same three numbers at every age, because nothing in the build wrote that
 * stat after eighteen. Charisma, the one stat adult events do move, went the
 * other way and collapsed: **sd 9.7 at eighteen, 6.5 at thirty, 3.8 at
 * forty-five**, with p10 84 and p90 94 — everybody converging on the same
 * plateau, which is CORE_RULES 13.66 arriving from the ratchet side. And at
 * forty-five, every one of the seven commonest tracks produced a character with
 * charisma between 89 and 92: twenty years of doing a particular job made no
 * difference to who anybody was.
 *
 * These assert the shape that replaced it. They are deliberately about SPREAD
 * and DIVERGENCE rather than about any median, because a median moving is what
 * the old model already did and it is not development.
 */

import { describe, expect, it } from 'vitest';
import { findJob } from '@yearafter/careers';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const LIVES = 150;

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

interface Snap {
  readonly age: number;
  readonly smarts: number;
  readonly discipline: number;
  readonly charisma: number;
  readonly looks: number;
  readonly track: string;
}

const SAMPLE = [18, 30, 45] as const;

function playALife(seed: string): readonly Snap[] {
  let state: GameState = createNewGame({ seed });
  const out: Snap[] = [];
  let guard = 0;
  while (state.player.alive && (guard += 1) < 110) {
    state = answerEverything(advanceYear(state).state);
    const age = state.player.age;
    if (!SAMPLE.includes(age as (typeof SAMPLE)[number])) continue;
    const job = state.employment.job ? findJob(state.employment.job.jobId) : undefined;
    out.push({
      age,
      smarts: Number(state.player.stats.smarts),
      discipline: Number(state.player.stats.discipline),
      charisma: Number(state.player.stats.charisma),
      looks: Number(state.player.stats.looks),
      track: job ? String(job.track) : 'none',
    });
  }
  return out;
}

const LIVES_PLAYED = Array.from({ length: LIVES }, (_, i) => playALife(`dev-${i}`));
/**
 * The same life at two ages, for the lives that reached both.
 *
 * PAIRED, NOT TWO COHORTS, and the first version of this file was not — which
 * two of these four assertions then passed under sabotage, because comparing
 * everybody at eighteen with the survivors at forty-five measures who lived as
 * much as it measures who changed. A character's own change is the only thing
 * that isolates development from survivorship, and it is also the only thing the
 * claim is about. CORE_RULES 13.63 again, in this file, before it shipped.
 */
interface Changed {
  readonly at18: Snap;
  readonly at45: Snap;
}
const PAIRED: readonly Changed[] = LIVES_PLAYED.flatMap((life) => {
  const at18 = life.find((s) => s.age === 18);
  const at45 = life.find((s) => s.age === 45);
  return at18 && at45 ? [{ at18, at45 }] : [];
});
const changeIn = (stat: 'smarts' | 'discipline' | 'charisma') =>
  PAIRED.map((pair) => pair.at45[stat] - pair.at18[stat]);
const sd = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
};
const median = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

describe('0411 — an adult who develops', () => {
  it('moves Discipline at all after eighteen', () => {
    /*
      The floor assertion, and it fails on the old behaviour by construction:
      before this, the Discipline distribution at forty-five was byte-identical
      to the one at eighteen. Sabotage-verified.
    */
    expect(PAIRED.length, 'no lives reached both eighteen and forty-five').toBeGreaterThan(50);
    const moved = changeIn('discipline').filter((delta) => delta !== 0).length;
    expect(
      moved / PAIRED.length,
      'share of lives whose Discipline is not exactly where it was at eighteen',
    ).toBeGreaterThan(0.6);
  });

  it('widens the population rather than flattening it', () => {
    /*
      THE ASSERTION THAT MATTERS, because the failure mode here is not "nothing
      happens", it is 0408's: every delta runs through `curvedDelta`, so a model
      that pushed the same gain at everybody for forty working years would end
      with a population that agrees. Measured before this ticket, Charisma did
      exactly that — sd 9.7 → 3.8 — while Discipline did not move at all.

      Spread at forty-five against spread at eighteen, and it must not collapse.
    */
    for (const stat of ['discipline', 'charisma'] as const) {
      const young = sd(PAIRED.map((pair) => pair.at18[stat]));
      const older = sd(PAIRED.map((pair) => pair.at45[stat]));
      expect(older, `${stat}: the population converged between 18 and 45`).toBeGreaterThan(
        young * 0.7,
      );
      // And the changes themselves have to disagree with each other. A model
      // that moved everybody by the same amount would pass the line above and
      // still be the flat push 13.66 is about.
      expect(sd(changeIn(stat)), `${stat}: every life changed by the same amount`).toBeGreaterThan(
        1.5,
      );
    }
  });

  it('makes the job somebody did legible in who they became', () => {
    /*
      Before this ticket, the seven commonest tracks at forty-five all produced
      charisma between 89 and 92 and discipline between 64 and 73. A character
      who drove a truck for twenty years and one who wrote software for twenty
      years were the same person.

      Asserted on the two tracks the table disagrees about most — logistics wants
      steadiness 0.34 and head work 0.06; tech is the mirror — rather than on a
      spread across all twenty, so the claim stays readable when the catalog
      grows.
    */
    const steady = PAIRED.filter(
      (pair) => pair.at45.track === 'logistics' || pair.at45.track === 'trades',
    );
    const heads = PAIRED.filter(
      (pair) => pair.at45.track === 'tech' || pair.at45.track === 'office',
    );
    expect(steady.length, 'no steady-track lives at forty-five').toBeGreaterThan(5);
    expect(heads.length, 'no head-work lives at forty-five').toBeGreaterThan(5);

    /*
      THE CHANGE, NOT THE LEVEL. The level was already different before this
      ticket and for a different reason: `hireChance` reads discipline, so
      disciplined people were always likelier to end up in logistics. Comparing
      levels measures who gets hired where. Comparing how far each character
      MOVED from their own eighteen-year-old self measures what the job did.
    */
    const moved = (rows: readonly Changed[]) =>
      median(rows.map((pair) => pair.at45.discipline - pair.at18.discipline));
    expect(
      moved(steady),
      'twenty years on the road should build more steadiness than twenty at a desk',
    ).toBeGreaterThan(moved(heads));
  });

  it('lets a face age', () => {
    // 52 at eighteen, 52 at thirty, 52 at forty-five before this: a visible bar
    // that nothing in the build had ever written. CORE_RULES 13.36, fourth time.
    const aged = PAIRED.map((pair) => pair.at45.looks - pair.at18.looks);
    expect(median(aged), 'a face at forty-five is not the face at eighteen').toBeLessThan(0);
    // And not a collapse — `curvedDelta` tapers a loss towards zero, which is
    // what stops this being a ratchet to nothing.
    expect(median(PAIRED.map((pair) => pair.at45.looks))).toBeGreaterThan(25);
  });
});
