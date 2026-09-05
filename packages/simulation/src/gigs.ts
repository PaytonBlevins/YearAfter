/**
 * Ticket 0206b — taking and leaving an odd job.
 *
 * Review: "I also want to be able to perform freelance jobs at appropriate
 * ages."
 *
 * Taking a gig is not an action that resolves — there is no roll and no
 * outcome. You take the job; the job pays at the end of the year, in the feed,
 * with the amount in the sentence. What is decided here is only whether you are
 * allowed to take it, which is almost entirely about how old you are.
 */

import { findGig } from '@yearafter/content';
import { err, ok, type Result } from '@yearafter/core';
import { gigUnavailable, type GigUnavailable } from '@yearafter/education';
import type { GameState } from './game-state';

export type GigError = 'no-such-gig' | GigUnavailable;

export function takeGig(state: GameState, gigId: string): Result<GameState, GigError> {
  const gig = findGig(gigId);
  if (!gig) return err('no-such-gig');

  const blocked = gigUnavailable(gig, {
    age: state.player.age,
    household: state.family,
    held: state.education.gigs,
  });
  if (blocked) return err(blocked);

  return ok({
    ...state,
    education: { ...state.education, gigs: [...state.education.gigs, gigId] },
  });
}

/**
 * Quit.
 *
 * No line and no penalty. Giving up a paper round is not an event in a life —
 * it is a Tuesday — and the feed is for things that happened.
 */
export function quitGig(state: GameState, gigId: string): GameState {
  if (!state.education.gigs.includes(gigId)) return state;
  return {
    ...state,
    education: { ...state.education, gigs: state.education.gigs.filter((id) => id !== gigId) },
  };
}
