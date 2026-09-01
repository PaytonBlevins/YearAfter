/**
 * Ticket 0206 — the social phase.
 *
 * Fourth phase module. It runs AFTER education and BEFORE events, and both
 * halves of that matter:
 *
 *  - after education, because whether the class turns over this year is a fact
 *    about school, and the phase needs to know the character changed buildings;
 *  - before events, because an event that fires this year should be able to
 *    name somebody who is actually in the class. That is the whole point of the
 *    ticket. Run the other way round, the first year at a new school would name
 *    five people the player had not met yet.
 */

import type { TimelineKind } from '@yearafter/character';
import { isInSchool, type EducationState } from '@yearafter/education';
import type { Household } from '@yearafter/relationships';
import { type SocialCircle } from '@yearafter/social';
import { runSocialYear } from '../social-generator';
import type { RandomStream } from '../rng/rng';

export interface SocialPhaseInput {
  readonly circle: SocialCircle;
  readonly stream: RandomStream;
  readonly age: number;
  readonly worldYear: number;
  readonly nameCultureId: string;
  readonly firstName: string;
  readonly charisma: number;
  readonly family: Household;
  readonly education: EducationState;
  /** The stage they were in last year, to spot a change of school. */
  readonly previousStage: EducationState['stage'];
}

export interface SocialPhaseOutput {
  readonly circle: SocialCircle;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
}

export function runSocial(input: SocialPhaseInput): SocialPhaseOutput {
  const atSchool = isInSchool(input.education);
  const result = runSocialYear(input.circle, input.stream, {
    age: input.age,
    worldYear: input.worldYear,
    nameCultureId: input.nameCultureId,
    firstName: input.firstName,
    charisma: input.charisma,
    family: input.family,
    atSchool,
    // Starting school counts as changing it: the class exists from that year on.
    changedSchool: atSchool && input.education.stage !== input.previousStage,
  });

  return {
    circle: result.circle,
    lines: result.lines.map((text) => ({ kind: 'relationship' as TimelineKind, text })),
  };
}
