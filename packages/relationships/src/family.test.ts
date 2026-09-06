import { describe, expect, it } from 'vitest';
import { asNpcId, dollars } from '@yearafter/core';
import { createPersonality } from '@yearafter/character';
import {
  EMPTY_HOUSEHOLD,
  children,
  livingChildren,
  WEALTH_BANDS,
  father,
  findMember,
  livingParents,
  mother,
  npcAge,
  npcFullName,
  orderedMembers,
  parents,
  siblings,
  updateMember,
  type FamilyMember,
  type FamilyRole,
  type Household,
} from './index';

const member = (id: string, role: FamilyRole, birthYear: number, alive = true): FamilyMember => ({
  id: asNpcId(id),
  role,
  firstName: id,
  lastName: 'Vaughn',
  sex: role === 'mother' ? 'female' : 'male',
  birthYear,
  alive,
  tier: 1,
  personality: createPersonality(),
  relationship: 70,
});

const household: Household = {
  members: [
    member('kid-b', 'sibling', 2004),
    member('mum', 'mother', 1974),
    member('kid-a', 'sibling', 1997),
    member('dad', 'father', 1971),
  ],
  finances: { band: 'comfortable', annualIncome: dollars(96_000) },
};

describe('household queries', () => {
  it('finds parents by role', () => {
    expect(mother(household)?.id).toBe('mum');
    expect(father(household)?.id).toBe('dad');
    expect(
      parents(household)
        .map((m) => m.id)
        .sort(),
    ).toEqual(['dad', 'mum']);
    expect(
      siblings(household)
        .map((m) => m.id)
        .sort(),
    ).toEqual(['kid-a', 'kid-b']);
  });

  it('handles a household with no members', () => {
    expect(mother(EMPTY_HOUSEHOLD)).toBeUndefined();
    expect(father(EMPTY_HOUSEHOLD)).toBeUndefined();
    expect(parents(EMPTY_HOUSEHOLD)).toEqual([]);
    expect(orderedMembers(EMPTY_HOUSEHOLD)).toEqual([]);
  });

  it('orders mother, father, then siblings oldest first', () => {
    expect(orderedMembers(household).map((m) => m.id)).toEqual(['mum', 'dad', 'kid-a', 'kid-b']);
  });

  it('looks members up by id', () => {
    expect(findMember(household, asNpcId('kid-a'))?.role).toBe('sibling');
    expect(findMember(household, asNpcId('nobody'))).toBeUndefined();
  });

  it('counts only living parents', () => {
    const bereaved = updateMember(household, asNpcId('dad'), (m) => ({ ...m, alive: false }));
    expect(livingParents(bereaved).map((m) => m.id)).toEqual(['mum']);
    // The source household is untouched.
    expect(livingParents(household).length).toBe(2);
  });

  it('leaves other members alone when updating one', () => {
    const updated = updateMember(household, asNpcId('mum'), (m) => ({ ...m, relationship: 12 }));
    expect(mother(updated)?.relationship).toBe(12);
    expect(father(updated)).toEqual(father(household));
  });
});

describe('npc helpers', () => {
  it('formats a full name', () => {
    expect(npcFullName(member('x', 'father', 1970))).toBe('x Vaughn');
  });

  it('derives age from the world year', () => {
    const dad = member('dad', 'father', 1971);
    expect(npcAge(dad, 2000)).toBe(29);
    expect(npcAge(dad, 2035)).toBe(64);
  });
});

describe('wealth bands', () => {
  it('lists the five bands poorest first', () => {
    expect([...WEALTH_BANDS]).toEqual([
      'struggling',
      'modest',
      'comfortable',
      'affluent',
      'wealthy',
    ]);
  });
});

/**
 * Ticket 0208 — a fourth role, and the query that could not survive one.
 *
 * `parents` was `members.filter(m => m.role !== 'sibling')`. A negative filter
 * over an enum is correct exactly until the enum grows, and then it is silently
 * wrong in the worst possible way: every child the player ever had would have
 * counted as one of the player's own parents — in `parents`, in
 * `livingParents`, and therefore in the `anyParent` event requirement that
 * decides whether a childhood event about Mom or Dad may fire at all.
 *
 * Nothing would have thrown. A forty-year-old with two kids and both parents
 * dead would simply have started getting events about their mother again.
 */
describe('children are not parents (Ticket 0208)', () => {
  const withKids: Household = {
    members: [
      member('mom', 'mother', 1960),
      member('dad', 'father', 1958),
      member('sis', 'sibling', 1988),
      member('kid1', 'child', 2015),
      member('kid2', 'child', 2018),
    ],
    finances: { band: 'modest', annualIncome: dollars(50_000) },
  };

  it('never counts a child as a parent', () => {
    expect(parents(withKids).map((m) => m.id)).toEqual([asNpcId('mom'), asNpcId('dad')]);
    expect(livingParents(withKids)).toHaveLength(2);
  });

  it('never counts a child as a sibling', () => {
    expect(siblings(withKids).map((m) => m.id)).toEqual([asNpcId('sis')]);
  });

  it('lists children oldest first', () => {
    expect(children(withKids).map((m) => m.id)).toEqual([asNpcId('kid1'), asNpcId('kid2')]);
  });

  it('leaves dead children out of livingChildren but keeps them on the roster', () => {
    const bereaved: Household = {
      ...withKids,
      members: withKids.members.map((m) =>
        m.id === asNpcId('kid1') ? { ...m, alive: false } : m,
      ),
    };
    expect(children(bereaved)).toHaveLength(2);
    expect(livingChildren(bereaved).map((m) => m.id)).toEqual([asNpcId('kid2')]);
  });

  it('puts children last on the Family screen, after parents and siblings', () => {
    const order = orderedMembers(withKids).map((m) => m.role);
    expect(order).toEqual(['mother', 'father', 'sibling', 'child', 'child']);
  });
});
