/**
 * Ticket 0413 — the binding half of a gate.
 *
 * 0412 gave eligibility `hasFriend` and `friendshipYearsAtLeast`, so an event
 * can now require a friend. `{kid}` would still have bound whichever peer the
 * draw landed on — and for a working adult the circle is mostly colleagues, so
 * a line reading "you and {kid} have been friends since school" would name
 * somebody met eleven months ago. That is 0207's `partnered` bug exactly, one
 * level down: the gate guarantees the situation and the token names the wrong
 * person in it.
 */

import { describe, expect, it } from 'vitest';
import { createPersonality } from '@yearafter/character';
import { createStats, createTalents } from '@yearafter/character';
import { bindPersonNames, type EventPerson } from './text';
import type { EventContext } from './context';

const person = (id: string, name: string, friend: boolean): EventPerson => ({
  id,
  name,
  sex: 'female',
  kind: 'peer',
  friend,
});

const contextWith = (people: readonly EventPerson[]): EventContext =>
  ({
    age: 34,
    year: 2034,
    firstName: 'Wren',
    lastName: 'Ash',
    sex: 'female',
    stats: createStats(),
    talents: createTalents(),
    personality: createPersonality(),
    family: { members: [] },
    nameCultureId: 'us-en',
    homeCity: 'Toledo, OH',
    flags: new Set<string>(),
    schoolStage: 'graduated',
    activityCount: 0,
    cash: 500,
    partnered: false,
    hasChildren: false,
    employed: true,
    jobYears: 3,
    conditions: [],
    friends: people.filter((p) => p.friend).length,
    friendshipYears: 12,
    alreadyThisYear: 0,
    people,
  }) as unknown as EventContext;

/** A source that always takes the first option, so the choice is the assertion. */
const first = { pick: <T>(values: readonly T[]): T => values[0] as T };

describe('0413 — a line about a friend names a friend', () => {
  it('binds a friend over an acquaintance, whatever the draw order', () => {
    /*
      The acquaintances come FIRST in the list on purpose: a binder that simply
      took the first free peer would pass by accident. `first` always takes
      index zero of whatever pool it is handed, so the only way a friend comes
      back is if the friends were filtered out before the pick.
    */
    const bound = bindPersonNames(
      ['kid'],
      contextWith([
        person('npc:desk', 'Colleague', false),
        person('npc:gym', 'Acquaintance', false),
        person('npc:old', 'Friend', true),
      ]),
      first,
    );
    expect(bound.kid?.name).toBe('Friend');
  });

  it('gives the second token the second friend rather than reusing the first', () => {
    const bound = bindPersonNames(
      ['kid', 'kid2'],
      contextWith([
        person('npc:desk', 'Colleague', false),
        person('npc:a', 'FriendOne', true),
        person('npc:b', 'FriendTwo', true),
      ]),
      first,
    );
    expect(bound.kid?.name).toBe('FriendOne');
    expect(bound.kid2?.name).toBe('FriendTwo');
  });

  it('still names somebody when the character has no friends at all', () => {
    // The fallback is not dead code — it is every event that is not gated on
    // having a friend, fired at somebody who has none. 0206's own note about
    // the invented-name path applies here for the same reason.
    const bound = bindPersonNames(
      ['kid'],
      contextWith([person('npc:desk', 'Colleague', false)]),
      first,
    );
    expect(bound.kid?.name).toBe('Colleague');
  });
});
