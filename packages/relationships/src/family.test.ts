import { describe, expect, it } from 'vitest';
import { asNpcId, dollars } from '@yearafter/core';
import { createPersonality } from '@yearafter/character';
import {
  EMPTY_HOUSEHOLD,
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
