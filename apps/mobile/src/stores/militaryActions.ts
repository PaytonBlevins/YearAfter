/**
 * Ticket 0906 — what the military, FBI and CIA screens do, as plain functions.
 *
 * The same shape as `entertainmentActions.ts`: every verb is a pure function from a state to a state
 * and the card that answers it, the store holds one `commit`, and a refusal comes back as a
 * sentence the player can read, never a code. The engines own the rules; nothing here decides
 * anything except which words go on the card.
 */

import type { AgencyId, ServiceTrack } from '@yearafter/content';
import {
  AGENCY_ERROR_LABELS,
  COMMISSION_ERROR_LABELS,
  ENLIST_ERROR_LABELS,
  applyForCommission,
  applyToAgency,
  applyToEnlist,
  leaveIntelCareer,
  retireFromService,
  endServiceTerm,
  workHarder,
  type GameState,
  type ServiceBranch,
} from '@yearafter/simulation';
import type { Outcome } from '../components/OutcomeCard';
import { RETIRE_ERROR_LABELS } from '../screens/militaryView';
import { newEntries, type Attempt, type Refused } from './fameActions';

/** Everything a player can do from the military, FBI and CIA screens, as one value. */
export type MilitaryAction =
  | {
      readonly type: 'enlist';
      readonly branch: string;
      readonly track: ServiceTrack;
      readonly specialty: string;
    }
  | { readonly type: 'commission' }
  | { readonly type: 'retire' }
  | { readonly type: 'endTerm' }
  | { readonly type: 'work' }
  | { readonly type: 'applyAgency'; readonly agency: AgencyId }
  | { readonly type: 'leaveAgency' };

const refuse = (body: string, title = 'Not now'): Refused => ({
  ok: false,
  outcome: { title, body, tone: 'bad' },
});

const wrote = (state: GameState, next: GameState, fallback: string): string =>
  newEntries(state, next)
    .map((entry) => entry.text)
    .join(' ') || fallback;

function done(state: GameState, next: GameState, outcome: Outcome | undefined): Attempt {
  return {
    ok: true,
    state: next,
    entries: newEntries(state, next),
    ...(outcome ? { outcome } : {}),
  };
}

export function applyMilitary(state: GameState, action: MilitaryAction): Attempt {
  switch (action.type) {
    case 'enlist': {
      const result = applyToEnlist(
        state,
        action.branch as ServiceBranch,
        action.specialty,
        action.track,
      );
      if (!result.ok) return refuse(ENLIST_ERROR_LABELS[result.error]);
      return done(state, result.value.state, {
        title: action.track === 'officer' ? 'Officer training begins' : 'You enlisted',
        body: result.value.entry.text,
        tone: 'good',
      });
    }
    case 'commission': {
      const result = applyForCommission(state);
      if (!result.ok) return refuse(COMMISSION_ERROR_LABELS[result.error]);
      return done(state, result.value.state, {
        title: result.value.picked ? 'The board picked you' : 'The board passed',
        body: result.value.entry.text,
        tone: result.value.picked ? 'good' : 'neutral',
      });
    }
    case 'endTerm':
    case 'retire': {
      const result = action.type === 'endTerm' ? endServiceTerm(state) : retireFromService(state);
      if (!result.ok) return refuse(RETIRE_ERROR_LABELS[result.error]);
      // No card here: the discharge card is read from the change itself, by `YearRecapNotice`, so it
      // is the same card whether the service ended by this button or by an answer at the end of a term.
      return done(state, result.value.state, undefined);
    }
    case 'work': {
      const result = workHarder(state);
      if (!result.ok) return refuse('You have no work to put more into.');
      // The third press of a year answers in words and changes nothing, as it does for a job.
      if (result.value.spent) {
        return {
          ok: true,
          state,
          entries: [],
          outcome: {
            title: 'Nothing more to give',
            body: 'You have already put your back into this year. More hours now would just be hours.',
            tone: 'neutral',
          },
        };
      }
      const after = result.value.state;
      const serving = after.military.service;
      const agent = after.intel.career;
      const standing = serving ?? agent;
      return done(state, after, {
        title: 'A real shift',
        body: result.value.entry?.text ?? '',
        tone: 'neutral',
        ...(standing
          ? {
              meter: {
                label: serving ? 'In the service' : 'At the agency',
                value: standing.performance,
              },
            }
          : {}),
      });
    }
    case 'applyAgency': {
      const result = applyToAgency(state, action.agency);
      if (!result.ok) return refuse(AGENCY_ERROR_LABELS[result.error]);
      const verdict = result.value.result;
      return done(state, result.value.state, {
        title:
          verdict === 'hired'
            ? 'You are in'
            : verdict === 'denied'
              ? 'Not cleared'
              : 'Not this time',
        body: wrote(state, result.value.state, result.value.entry.text),
        tone: verdict === 'hired' ? 'good' : verdict === 'denied' ? 'bad' : 'neutral',
      });
    }
    case 'leaveAgency': {
      const result = leaveIntelCareer(state);
      if (!result.ok) return refuse("You don't work for an agency.");
      const next = result.value.state;
      const retired = next.intel.past[next.intel.past.length - 1]?.how === 'retired';
      return done(state, next, {
        title: retired ? 'You retired' : 'You left the agency',
        body: result.value.entry.text,
        tone: retired ? 'good' : 'neutral',
      });
    }
  }
}
