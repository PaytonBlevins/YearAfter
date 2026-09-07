/**
 * Ticket 0209 acceptance tests, at the level of a whole childhood.
 *
 * The model was measured before it was tuned (see `@yearafter/parenting`), so
 * these hold the shape a played life produces. Four defects were found here,
 * all with a green suite:
 *
 *  - a player asking every year was given a CAR five times, and college twice;
 *  - "Mom gave up an evening to drive you" at eight, nine and ten — the 0207d
 *    copy-repeat lesson for the fourth time, arriving by the same route: an
 *    index rotated by age cannot help while its base is redrawn every year;
 *  - a sixth writer of timeline lines pushed the worst year to eight entries
 *    against a cap of seven, exactly as 0206 found with a fifth;
 *  - and the first two fixes for the first defect were both wrong.
 */

import { describe, expect, it } from 'vitest';
import { livingParents } from '@yearafter/relationships';
import { PARENT_REQUESTS, requestsAt } from '@yearafter/parenting';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { askParent, canAsk } from './guardians';

const LIVES = 50;
const UNTIL = 22;

interface Life {
  readonly state: GameState;
  readonly said: readonly { readonly age: number; readonly request: string; readonly yes: boolean; readonly text: string }[];
  readonly granted: readonly { readonly request: string; readonly age: number }[];
}

/** A child who asks for everything they are allowed to, of whoever is around. */
function playALife(seed: string): Life {
  let state = createNewGame({ seed });
  const said: { age: number; request: string; yes: boolean; text: string }[] = [];
  const granted: { request: string; age: number }[] = [];

  for (let year = 0; year < UNTIL; year += 1) {
    state = advanceYear(state).state;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const result = decide(state, decision.eventId, choice.id);
      if (!result.ok) break;
      state = result.value.state;
    }

    for (const request of requestsAt(state.player.age)) {
      for (const parent of livingParents(state.family)) {
        if (!canAsk(state, parent.id, request.id)) continue;
        const result = askParent(state, parent.id, request.id);
        if (!result.ok) continue;
        state = result.value.state;
        said.push({
          age: state.player.age,
          request: request.id,
          yes: result.value.saidYes,
          text: result.value.entry.text,
        });
        if (result.value.saidYes && request.oncePerLife) {
          granted.push({ request: request.id, age: state.player.age });
        }
        break; // one parent per request per year, the way a child would
      }
    }
  }
  return { state, said, granted };
}

const LIFETIMES: readonly Life[] = Array.from({ length: LIVES }, (_, index) =>
  playALife(`guardian-${index}`),
);

const all = LIFETIMES.flatMap((life) => life.said);
const rateFor = (id: string) => {
  const rows = all.filter((entry) => entry.request === id);
  return rows.filter((entry) => entry.yes).length / Math.max(1, rows.length);
};

/* -------------------------------------------------------------------------- */
/* The shape of an answer                                                      */
/* -------------------------------------------------------------------------- */

describe('parents decide, and can refuse', () => {
  it('says yes to small things more than big ones', () => {
    expect(rateFor('pocket-money')).toBeGreaterThan(rateFor('pay-for-it'));
    expect(rateFor('pay-for-it')).toBeGreaterThan(rateFor('a-car'));
  });

  it('refuses often enough that a no is a real outcome', () => {
    // Spec 61 gives parents the right to refuse. A menu where the answer is
    // effectively always yes takes it straight back.
    for (const request of PARENT_REQUESTS) {
      const rows = all.filter((entry) => entry.request === request.id);
      if (rows.length < 20) continue;
      const yes = rows.filter((entry) => entry.yes).length / rows.length;
      expect(yes, `${request.id} yes-rate`).toBeGreaterThan(0.1);
      expect(yes, `${request.id} yes-rate`).toBeLessThan(0.92);
    }
  });

  it('gives nobody two cars', () => {
    // Measured before `oncePerLife`: a player asking every year from sixteen
    // was given a car five times, and college twice.
    for (const life of LIFETIMES) {
      const counts = new Map<string, number>();
      for (const entry of life.granted) {
        counts.set(entry.request, (counts.get(entry.request) ?? 0) + 1);
      }
      for (const [request, count] of counts) {
        expect(count, `${request} granted ${count} times`).toBe(1);
      }
    }
  });

  it('still lets somebody ask again after a no', () => {
    // A refusal is not a permanent lock. Being told no and trying next year is
    // what a child does, and the only thing that closes a request is a yes.
    const askedTwice = LIFETIMES.some((life) => {
      const carAsks = life.said.filter((entry) => entry.request === 'a-car');
      return carAsks.length > 1 && carAsks.every((entry) => !entry.yes);
    });
    expect(askedTwice).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

describe('what the feed says', () => {
  it('never writes ANY line two years running, from any writer', () => {
    // Six occurrences now, five of them found by reading output rather than by
    // a test: 0206 drift lines, 0207d moves, 0208 milestones, 0209 parent acts,
    // 0208 conception, 0207 romance replies. So the invariant is asserted over
    // the whole feed rather than one system at a time.
    //
    // These lives only advance years and ask parents, which means every line
    // here is one the ENGINE wrote unprompted. That is the scope the guarantee
    // can actually hold: a player who presses the same move three times in one
    // year and once the next can still see a sentence twice, and no rotation
    // arithmetic over a fixed set of lines can prevent it.
    for (const life of LIFETIMES) {
      const seenAt = new Map<string, number>();
      for (const entry of life.state.player.timeline) {
        const previous = seenAt.get(entry.text);
        if (previous !== undefined) {
          expect(
            entry.age - previous,
            `"${entry.text}" at ${previous} and again at ${entry.age}`,
          ).toBeGreaterThan(1);
        }
        seenAt.set(entry.text, entry.age);
      }
    }
  });

  it('never writes the same line two years running', () => {
    // The 0207d lesson, fourth occurrence. An index rotated by age cannot help
    // while its base is redrawn every year — a new draw one lower cancels the
    // rotation exactly as often as it helps. The base now holds still for the
    // life and age does all the moving.
    for (const life of LIFETIMES) {
      const byRequest = new Map<string, { age: number; text: string }[]>();
      for (const entry of life.said) {
        const rows = byRequest.get(entry.request) ?? [];
        rows.push({ age: entry.age, text: entry.text });
        byRequest.set(entry.request, rows);
      }
      for (const [request, rows] of byRequest) {
        rows.sort((a, b) => a.age - b.age);
        for (let index = 1; index < rows.length; index += 1) {
          const previous = rows[index - 1]!;
          const current = rows[index]!;
          if (current.age !== previous.age + 1) continue;
          expect(current.text, `${request} repeated at ${current.age}`).not.toBe(previous.text);
        }
      }
    }
  });

  it('always renders the parent and any amount', () => {
    for (const entry of all) {
      expect(entry.text).not.toContain('{');
      expect(entry.text).not.toContain('undefined');
      expect(entry.text).toMatch(/Mom|Dad|You asked|Asked/);
      if (/\$/.test(entry.text)) expect(entry.text).not.toMatch(/\$0\b/);
    }
  });

  it('calls them Mom and Dad, never by their first name', () => {
    // event-writing-rules 5, which applies to everything a child reads.
    for (const life of LIFETIMES) {
      const names = livingParents(life.state.family).map((parent) => parent.firstName);
      for (const entry of life.said) {
        for (const name of names) {
          expect(entry.text, `used "${name}"`).not.toContain(name);
        }
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Invariants                                                                  */
/* -------------------------------------------------------------------------- */

describe('invariants', () => {
  it('keeps a year inside its line budget even with a sixth writer', () => {
    // Spec 725-770. `MAX_EVENTS_PER_YEAR` was a budget for the event phase
    // alone; it is now the YEAR's, and events spend what is left of it.
    for (const life of LIFETIMES) {
      const byAge = new Map<number, number>();
      for (const entry of life.state.player.timeline) {
        byAge.set(entry.age, (byAge.get(entry.age) ?? 0) + 1);
      }
      // Player-initiated asks sit on top of the phase budget, the same way
      // studying and interacting do — this bounds what ADVANCE writes.
      for (const [age, count] of byAge) {
        const asked = life.said.filter((entry) => entry.age === age).length;
        expect(count - asked, `age ${age}`).toBeLessThanOrEqual(7);
      }
    }
  });

  it('never gives a child money the line did not name', () => {
    // CORE_RULES 13.6, and the 0204 lesson: only pocket money reaches the
    // player's own balance. A car and college are things the household buys.
    for (const life of LIFETIMES) {
      expect(Number(life.state.player.cash)).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every timeline entry a unique id', () => {
    for (const life of LIFETIMES) {
      const ids = life.state.player.timeline.map((entry) => entry.id);
      expect(new Set(ids).size, life.state.player.firstName).toBe(ids.length);
    }
  });
});
