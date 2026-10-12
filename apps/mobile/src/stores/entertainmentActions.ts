/**
 * Ticket 0809 — what the sports, acting, music, modeling and racing screens do, as plain functions.
 *
 * The same shape as `fameActions.ts`: every verb is a pure function from a state to a state and the
 * card that answers it, the store holds one `commit`, and a refusal comes back as a sentence the
 * player can read ("There are only hours for 2 at a time"), never a code. The engines own the
 * rules; nothing here decides anything except which words go on the card.
 */

import type { TimelineEntry } from '@yearafter/character';
import { findMartialArt, type ReleaseKind } from '@yearafter/content';
import type { SponsorAnswer } from '@yearafter/finance';
import {
  ACTING_ERROR_LABELS,
  APPLY_ERROR_LABELS,
  ART_ERROR_LABELS,
  FINANCE_ERROR_LABELS,
  MODELING_ERROR_LABELS,
  MODEL_APPLY_ERROR_LABELS,
  MUSIC_ERROR_LABELS,
  PLAN_ERROR_LABELS,
  TRAIN_ERROR_LABELS,
  answerModelBrand,
  answerMusicCollab,
  applyForCasting,
  applyToModelCall,
  developCharacter,
  driveOwnTeam,
  dropDownSeries,
  hireDriver,
  leaveAgency,
  leaveAgent,
  leavePost,
  moveUpSeries,
  planReleases,
  planTour,
  setDevelopment,
  shootPortfolio,
  signWithAgency,
  signWithAgent,
  startArt,
  startLessons,
  startMusicLessons,
  stopArt,
  stopDrivingOwnTeam,
  stopLessons,
  stopMusicLessons,
  submitDemo,
  trainArt,
  trainSport,
  type Financing,
  type GameState,
} from '@yearafter/simulation';
import type { TeamDevelopment } from '@yearafter/finance';
import type { Outcome } from '../components/OutcomeCard';
import { newEntries, refusalText, type Attempt, type Refused } from './fameActions';

/** Everything a player can do in these fields, as one value so the store has one action for them. */
export type EntertainmentAction =
  | { readonly type: 'train' }
  | { readonly type: 'art'; readonly artId: string; readonly do: 'start' | 'stop' | 'train' }
  | { readonly type: 'leavePost' }
  | { readonly type: 'apply'; readonly field: 'acting' | 'modeling'; readonly callId: string }
  | { readonly type: 'lessons'; readonly field: 'acting' | 'music'; readonly on: boolean }
  | { readonly type: 'develop' }
  | { readonly type: 'agent'; readonly field: 'acting' | 'modeling'; readonly on: boolean }
  | { readonly type: 'portfolio' }
  | { readonly type: 'release'; readonly kind: ReleaseKind; readonly count: number }
  | { readonly type: 'tour'; readonly on: boolean }
  | { readonly type: 'demo' }
  | { readonly type: 'collab'; readonly offerId: string; readonly accept: boolean }
  | { readonly type: 'brand'; readonly offerId: string; readonly answer: SponsorAnswer }
  | { readonly type: 'development'; readonly businessId: string; readonly level: TeamDevelopment }
  | { readonly type: 'hireDriver'; readonly businessId: string; readonly candidateId: string }
  | { readonly type: 'driveOwn'; readonly businessId: string; readonly on: boolean }
  | {
      readonly type: 'series';
      readonly businessId: string;
      readonly direction: 'up' | 'down';
      readonly finance?: Financing;
    };

/** The words for the racing team's own refusals. The engine has codes and no sentences. */
export const RACING_ERROR_LABELS: Readonly<Record<string, string>> = {
  'no-such-business': "You don't run that any more.",
  'not-a-racing-team': "That isn't a racing team.",
  'no-such-driver': 'That driver has gone somewhere else.',
  'not-a-driver': "You aren't driving for the team.",
  'top-rung': "There's nothing above this series.",
  'bottom-rung': "There's nothing below this series.",
  'too-soon': 'The team has to finish a season at this level before it can move up.',
  'cannot-afford': "You don't have the money for that.",
  'no-such-choice': "That isn't something the team can do.",
  'at-limit': "That isn't something the team can do.",
};

const refuse = (body: string, title = "That can't be done"): Refused => ({
  ok: false,
  outcome: { title, body, tone: 'bad' },
});

const wrote = (entries: readonly TimelineEntry[], fallback: string): string =>
  entries.map((entry) => entry.text).join(' ') || fallback;

/** A verb that returns `{ state, entry }`: the common case. */
function done(
  state: GameState,
  result: { readonly state: GameState; readonly entry: TimelineEntry },
  title: string,
  tone: Outcome['tone'] = 'good',
): Attempt {
  const entries = newEntries(state, result.state);
  return {
    ok: true,
    state: result.state,
    entries,
    outcome: { title, body: wrote(entries, result.entry.text), tone },
  };
}

/** A verb that returns only a state (planning). A setting the screen already shows has no card. */
function planned(state: GameState, next: GameState): Attempt {
  return { ok: true, state: next, entries: newEntries(state, next) };
}

const racingRefusal = (error: unknown): Refused => {
  const key = String(error);
  const words =
    RACING_ERROR_LABELS[key] ??
    (key in FINANCE_ERROR_LABELS
      ? FINANCE_ERROR_LABELS[key as keyof typeof FINANCE_ERROR_LABELS]
      : "That can't be done right now.");
  return refuse(words, key === 'cannot-afford' ? 'Not enough money' : "That can't be done");
};

function collabRefusal(error: { readonly kind: string; readonly needed?: number }): Refused {
  return refuse(
    refusalText(error),
    error.kind === 'notEnoughMoney' ? 'Not enough money' : "That can't be done",
  );
}

export function applyEntertainment(state: GameState, action: EntertainmentAction): Attempt {
  switch (action.type) {
    case 'train': {
      const result = trainSport(state);
      if (!result.ok) return refuse(TRAIN_ERROR_LABELS[result.error], 'Not now');
      return done(state, result.value, 'You put the work in');
    }
    case 'art': {
      const art = findMartialArt(action.artId);
      const result =
        action.do === 'start'
          ? startArt(state, action.artId)
          : action.do === 'stop'
            ? stopArt(state, action.artId)
            : trainArt(state, action.artId);
      if (!result.ok) return refuse(ART_ERROR_LABELS[result.error], 'Not now');
      return done(
        state,
        result.value,
        action.do === 'start'
          ? `You started ${art?.name ?? 'it'}`
          : action.do === 'stop'
            ? `You stopped ${art?.name ?? 'it'}`
            : 'You put the work in',
        action.do === 'stop' ? 'neutral' : 'good',
      );
    }
    case 'leavePost': {
      const result = leavePost(state);
      if (!result.ok) return refuse("You don't have that job.", 'Not now');
      return done(state, result.value, 'You left the job', 'neutral');
    }
    case 'apply': {
      const result =
        action.field === 'acting'
          ? applyForCasting(state, action.callId)
          : applyToModelCall(state, action.callId);
      if (!result.ok) {
        const labels = action.field === 'acting' ? APPLY_ERROR_LABELS : MODEL_APPLY_ERROR_LABELS;
        return refuse((labels as Record<string, string>)[result.error] ?? "That can't be done");
      }
      const landed = result.value.landed;
      return done(
        state,
        result.value,
        landed ? 'They want you' : "It didn't come through",
        landed ? 'good' : 'neutral',
      );
    }
    case 'lessons': {
      if (action.field === 'acting') {
        const result = action.on ? startLessons(state) : stopLessons(state);
        if (!result.ok) return refuse(ACTING_ERROR_LABELS[result.error], 'Not now');
        return done(
          state,
          result.value,
          action.on ? 'You started lessons' : 'You stopped lessons',
          action.on ? 'good' : 'neutral',
        );
      }
      const result = action.on ? startMusicLessons(state) : stopMusicLessons(state);
      if (!result.ok) return refuse(MUSIC_ERROR_LABELS[result.error], 'Not now');
      return done(
        state,
        result.value,
        action.on ? 'You started lessons' : 'You stopped lessons',
        action.on ? 'good' : 'neutral',
      );
    }
    case 'develop': {
      const result = developCharacter(state);
      if (!result.ok) return refuse(ACTING_ERROR_LABELS[result.error], 'Not now');
      return done(state, result.value, 'You worked on the character');
    }
    case 'agent': {
      if (action.field === 'acting') {
        const result = action.on ? signWithAgent(state) : leaveAgent(state);
        if (!result.ok) return refuse(ACTING_ERROR_LABELS[result.error], 'Not now');
        return done(
          state,
          result.value,
          action.on ? 'You have an agent' : 'You let your agent go',
          action.on ? 'good' : 'neutral',
        );
      }
      const result = action.on ? signWithAgency(state) : leaveAgency(state);
      if (!result.ok) return refuse(MODELING_ERROR_LABELS[result.error], 'Not now');
      return done(
        state,
        result.value,
        action.on ? 'You signed with an agency' : 'You left the agency',
        action.on ? 'good' : 'neutral',
      );
    }
    case 'portfolio': {
      const result = shootPortfolio(state);
      if (!result.ok) return refuse(MODELING_ERROR_LABELS[result.error], 'Not now');
      return done(state, result.value, 'You had new pictures taken');
    }
    case 'release': {
      const result = planReleases(state, action.kind, action.count);
      if (!result.ok) return refuse(PLAN_ERROR_LABELS[result.error], 'Not now');
      return planned(state, result.value);
    }
    case 'tour': {
      const result = planTour(state, action.on);
      if (!result.ok) return refuse(PLAN_ERROR_LABELS[result.error], 'Not now');
      return planned(state, result.value);
    }
    case 'demo': {
      const result = submitDemo(state);
      if (!result.ok) return refuse(MUSIC_ERROR_LABELS[result.error], 'Not now');
      const landed = result.value.landed;
      return done(
        state,
        result.value,
        landed ? 'A label called back' : 'No word back',
        landed ? 'good' : 'neutral',
      );
    }
    case 'collab': {
      const result = answerMusicCollab(state, action.offerId, action.accept);
      if (!result.ok) return collabRefusal(result.error);
      const entries = newEntries(state, result.value);
      return {
        ok: true,
        state: result.value,
        entries,
        outcome: {
          title: action.accept ? 'You made something together' : 'You passed',
          body: wrote(entries, 'Done.'),
          tone: action.accept ? 'good' : 'neutral',
        },
      };
    }
    case 'brand': {
      const result = answerModelBrand(state, action.offerId, action.answer);
      if (!result.ok) return refuse(refusalText(result.error));
      const next = result.value.state;
      const entries = newEntries(state, next);
      // The engine writes a line for every answer; what the brand did is whether money was agreed.
      const agreed = next.modeling.brandOwed > state.modeling.brandOwed;
      return {
        ok: true,
        state: next,
        entries,
        outcome: {
          title:
            action.answer === 'decline'
              ? 'You passed'
              : agreed
                ? 'The deal is on'
                : 'They walked away',
          body: wrote(entries, 'Done.'),
          tone: action.answer === 'decline' ? 'neutral' : agreed ? 'good' : 'bad',
        },
      };
    }
    case 'development': {
      const result = setDevelopment(state, action.businessId, action.level);
      if (!result.ok) return racingRefusal(result.error);
      return {
        ok: true,
        state: result.value.state,
        entries: newEntries(state, result.value.state),
      };
    }
    case 'hireDriver': {
      const result = hireDriver(state, action.businessId, action.candidateId);
      if (!result.ok) return racingRefusal(result.error);
      return done(state, result.value, 'You hired a driver');
    }
    case 'driveOwn': {
      const result = action.on
        ? driveOwnTeam(state, action.businessId)
        : stopDrivingOwnTeam(state, action.businessId);
      if (!result.ok) return racingRefusal(result.error);
      return done(
        state,
        result.value,
        action.on ? "You're driving for your team" : 'You handed the car over',
        action.on ? 'good' : 'neutral',
      );
    }
    case 'series': {
      const result =
        action.direction === 'up'
          ? moveUpSeries(state, action.businessId, action.finance)
          : dropDownSeries(state, action.businessId);
      if (!result.ok) return racingRefusal(result.error);
      return done(
        state,
        result.value,
        action.direction === 'up' ? 'The team moved up' : 'The team stepped down',
        action.direction === 'up' ? 'good' : 'neutral',
      );
    }
  }
}
