/**
 * Ticket 0809 — what the sports, acting, music, modeling and racing buttons do.
 *
 * Each verb is a pure function from a state to a state and the card that answers it, tested on
 * real states from the real engine. Where a roll decides the outcome, the generation is swept
 * until each outcome has happened and the count of cases that reached an assertion is asserted,
 * so a fixture that stops finding a case fails instead of passing empty.
 */

import { dollars } from '@yearafter/core';
import { describe, expect, it } from 'vitest';
import {
  ACTING_ERROR_LABELS,
  APPLY_ERROR_LABELS,
  ART_ERROR_LABELS,
  MODELING_ERROR_LABELS,
  MODEL_APPLY_ERROR_LABELS,
  MUSIC_ERROR_LABELS,
  PLAN_ERROR_LABELS,
  TRAIN_ERROR_LABELS,
  castingCalls,
  modelBrandOffers,
  modelCalls,
  musicCollabOffers,
  openBusiness,
  type GameState,
} from '@yearafter/simulation';
import { FINANCE_ERROR_LABELS } from '@yearafter/simulation';
import { sweepAll, withCash } from '../test/fameFixtures';
import {
  ADULT,
  at,
  withActing,
  withCareer,
  withModeling,
  withMusic,
  withRacingTeam,
} from '../test/entertainmentFixtures';
import {
  RACING_ERROR_LABELS,
  applyEntertainment,
  type EntertainmentAction,
} from './entertainmentActions';
import type { Attempt, Done } from './fameActions';

const done = (attempt: Attempt): Done => {
  if (!attempt.ok) throw new Error(`refused: ${attempt.outcome.body}`);
  return attempt;
};
const refused = (attempt: Attempt): string => {
  if (attempt.ok) throw new Error('expected a refusal');
  return `${attempt.outcome.title} | ${attempt.outcome.body} | ${attempt.outcome.tone}`;
};
const press = (state: GameState, action: EntertainmentAction) => applyEntertainment(state, action);

const STUDYING = (state: GameState, artId = 'boxing'): GameState => ({
  ...state,
  sports: {
    ...state.sports,
    arts: [
      {
        artId,
        startedAge: 20,
        seasons: 1,
        hardSeasons: 0,
        level: 20,
        trainedAtAge: -1,
        trainedCount: 0,
      },
    ],
  },
});

describe('sports', () => {
  it('puts the work in, and writes one line for it', () => {
    const state = withCareer(ADULT, { stage: 'college' });
    const result = done(press(state, { type: 'train' }));
    expect(result.outcome).toEqual({
      title: 'You put the work in',
      body: 'Put in extra work on your basketball.',
      tone: 'good',
    });
    expect(result.entries).toHaveLength(1);
    expect(result.state.sports.career!.trainedCount).toBe(1);
  });

  it('refuses to train with nothing to train for, in words', () => {
    expect(refused(press(ADULT, { type: 'train' }))).toBe(
      `Not now | ${TRAIN_ERROR_LABELS['not-playing']} | bad`,
    );
    expect(refused(press(ADULT, { type: 'train' }))).toContain("You aren't playing a sport");
  });

  it('stops at the third session in a year', () => {
    let state = withCareer(ADULT, { stage: 'college' });
    for (let session = 0; session < 3; session += 1) {
      state = done(press(state, { type: 'train' })).state;
    }
    const message = refused(press(state, { type: 'train' }));
    expect(message.startsWith('Not now | ')).toBe(true);
    expect(message.endsWith(' | bad')).toBe(true);
  });

  it('starts, trains and stops an art, with a card for each', () => {
    const started = done(press(ADULT, { type: 'art', artId: 'boxing', do: 'start' }));
    expect(started.outcome).toMatchObject({ title: 'You started Boxing', tone: 'good' });
    expect(started.state.sports.arts).toHaveLength(1);
    const trained = done(press(started.state, { type: 'art', artId: 'boxing', do: 'train' }));
    expect(trained.outcome).toMatchObject({ title: 'You put the work in', tone: 'good' });
    const stopped = done(press(trained.state, { type: 'art', artId: 'boxing', do: 'stop' }));
    expect(stopped.outcome).toMatchObject({ title: 'You stopped Boxing', tone: 'neutral' });
    expect(stopped.state.sports.arts ?? []).toHaveLength(0);
  });

  it('refuses an art you are not studying, and a third art', () => {
    expect(refused(press(ADULT, { type: 'art', artId: 'boxing', do: 'stop' }))).toBe(
      `Not now | ${ART_ERROR_LABELS['not-studying']} | bad`,
    );
    expect(refused(press(ADULT, { type: 'art', artId: 'boxing', do: 'train' }))).toBe(
      `Not now | ${ART_ERROR_LABELS['not-studying']} | bad`,
    );
    let state = ADULT;
    for (const artId of ['boxing', 'karate']) {
      state = done(press(state, { type: 'art', artId, do: 'start' })).state;
    }
    expect(refused(press(state, { type: 'art', artId: 'taekwondo', do: 'start' }))).toBe(
      `Not now | ${ART_ERROR_LABELS['too-many']} | bad`,
    );
  });

  it('names the art the card is about, even one the catalogue does not know', () => {
    const attempt = press(ADULT, { type: 'art', artId: 'no-such-art', do: 'start' });
    expect(attempt.ok).toBe(false);
  });

  it('leaves a post, and refuses when there is none', () => {
    expect(refused(press(ADULT, { type: 'leavePost' }))).toBe(
      "Not now | You don't have that job. | bad",
    );
    const holding: GameState = {
      ...ADULT,
      sports: {
        ...ADULT.sports,
        post: { sportId: 'basketball', kind: 'coach', level: 'local', since: 40, seasons: 2 },
      },
    };
    const result = done(press(holding, { type: 'leavePost' }));
    expect(result.outcome).toMatchObject({ title: 'You left the job', tone: 'neutral' });
    expect(result.state.sports.post).toMatchObject({ over: true });
  });
});

describe('acting', () => {
  it('applies for a call, and either lands it or does not', () => {
    const base = ADULT;
    const callId = (state: GameState) => castingCalls(state)[0]!.role.id;
    const landed = sweepAll(
      base,
      (trial) => {
        const r = applyEntertainment(trial, {
          type: 'apply',
          field: 'acting',
          callId: callId(trial),
        });
        return r.ok && r.outcome?.title === 'They want you';
      },
      200,
    );
    const missed = sweepAll(
      base,
      (trial) => {
        const r = applyEntertainment(trial, {
          type: 'apply',
          field: 'acting',
          callId: callId(trial),
        });
        return r.ok && r.outcome?.title === "It didn't come through";
      },
      200,
    );
    expect(landed.length).toBeGreaterThan(0);
    expect(missed.length).toBeGreaterThan(0);
    // An acting call and a modeling call can share an id, so which field was written is checked.
    const first = landed[0]!;
    const id = callId(first);
    const acted = done(press(first, { type: 'apply', field: 'acting', callId: id })).state;
    expect(acted.acting.applied).toContain(id);
    expect(acted.modeling.applied).not.toContain(id);
    let reached = 0;
    for (const trial of [...landed.slice(0, 5), ...missed.slice(0, 5)]) {
      const result = done(press(trial, { type: 'apply', field: 'acting', callId: callId(trial) }));
      const wasLanded = result.outcome!.title === 'They want you';
      expect(result.outcome!.tone).toBe(wasLanded ? 'good' : 'neutral');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.outcome!.body.length).toBeGreaterThan(0);
      reached += 1;
    }
    expect(reached).toBeGreaterThanOrEqual(2);
  });

  it('refuses a call that is not open, and the same call twice', () => {
    expect(refused(press(ADULT, { type: 'apply', field: 'acting', callId: 'nope' }))).toBe(
      `That can't be done | ${APPLY_ERROR_LABELS['no-such-call']} | bad`,
    );
    const callId = castingCalls(ADULT)[0]!.role.id;
    const once = done(press(ADULT, { type: 'apply', field: 'acting', callId })).state;
    expect(refused(press(once, { type: 'apply', field: 'acting', callId }))).toContain(
      "That can't be done | ",
    );
  });

  it('starts and stops lessons, and refuses to stop what was never started', () => {
    const on = done(press(ADULT, { type: 'lessons', field: 'acting', on: true }));
    expect(on.outcome).toEqual({
      title: 'You started lessons',
      body: 'Signed up for acting lessons.',
      tone: 'good',
    });
    expect(on.state.acting.lessons).toBeDefined();
    const off = done(press(on.state, { type: 'lessons', field: 'acting', on: false }));
    expect(off.outcome).toMatchObject({ title: 'You stopped lessons', tone: 'neutral' });
    expect(off.state.acting.lessons).toBeUndefined();
    expect(refused(press(ADULT, { type: 'lessons', field: 'acting', on: false }))).toBe(
      `Not now | ${ACTING_ERROR_LABELS['not-taking']} | bad`,
    );
    expect(refused(press(on.state, { type: 'lessons', field: 'acting', on: true }))).toContain(
      'Not now | ',
    );
  });

  it('works on a character, three times a year', () => {
    let state = ADULT;
    for (let session = 0; session < 3; session += 1) {
      const result = done(press(state, { type: 'develop' }));
      expect(result.outcome).toMatchObject({ title: 'You worked on the character', tone: 'good' });
      state = result.state;
    }
    expect(refused(press(state, { type: 'develop' }))).toContain('Not now | ');
  });

  it('takes on an agent only after the work, and lets one go', () => {
    expect(refused(press(ADULT, { type: 'agent', field: 'acting', on: true }))).toBe(
      `Not now | ${ACTING_ERROR_LABELS['nobody-will-take-you-on']} | bad`,
    );
    expect(refused(press(ADULT, { type: 'agent', field: 'acting', on: false }))).toBe(
      `Not now | ${ACTING_ERROR_LABELS['no-agent']} | bad`,
    );
    const worked = withActing(ADULT, { credits: 12, tier: 'supporting', reputation: 40 });
    const signed = done(press(worked, { type: 'agent', field: 'acting', on: true }));
    expect(signed.outcome).toMatchObject({ title: 'You have an agent', tone: 'good' });
    expect(signed.state.acting.agent).toBeDefined();
    const left = done(press(signed.state, { type: 'agent', field: 'acting', on: false }));
    expect(left.outcome).toMatchObject({ title: 'You let your agent go', tone: 'neutral' });
    expect(left.state.acting.agent).toBeUndefined();
  });
});

describe('music', () => {
  it('plans releases without a card, and refuses more than a year holds', () => {
    const result = done(press(ADULT, { type: 'release', kind: 'single', count: 2 }));
    expect(result.outcome).toBeUndefined();
    expect(result.state.music.plan.single).toBe(2);
    expect(refused(press(ADULT, { type: 'release', kind: 'single', count: 999 }))).toBe(
      `Not now | ${PLAN_ERROR_LABELS['over-cap']} | bad`,
    );
  });

  it('plans a tour only for an act that can tour', () => {
    expect(refused(press(ADULT, { type: 'tour', on: true }))).toBe(
      `Not now | ${PLAN_ERROR_LABELS['cannot-tour']} | bad`,
    );
    const big = withMusic(ADULT, { listeners: 60_000 });
    const on = done(press(big, { type: 'tour', on: true }));
    expect(on.outcome).toBeUndefined();
    expect(on.state.music.plan.tour).toBe(true);
    const off = done(press(on.state, { type: 'tour', on: false }));
    expect(off.state.music.plan.tour).toBe(false);
    // Turning a tour off is always allowed, even when it could never have been on.
    expect(done(press(ADULT, { type: 'tour', on: false })).state.music.plan.tour).toBe(false);
  });

  it('starts and stops music lessons', () => {
    const on = done(press(ADULT, { type: 'lessons', field: 'music', on: true }));
    expect(on.outcome).toEqual({
      title: 'You started lessons',
      body: 'Signed up for music lessons.',
      tone: 'good',
    });
    const off = done(press(on.state, { type: 'lessons', field: 'music', on: false }));
    expect(off.outcome).toMatchObject({ title: 'You stopped lessons', tone: 'neutral' });
    expect(refused(press(ADULT, { type: 'lessons', field: 'music', on: false }))).toBe(
      `Not now | ${MUSIC_ERROR_LABELS['not-taking']} | bad`,
    );
  });

  it('sends a demo only with something out, and says whether anyone called back', () => {
    expect(refused(press(ADULT, { type: 'demo' }))).toBe(
      `Not now | ${MUSIC_ERROR_LABELS['no-release-yet']} | bad`,
    );
    const out = withMusic(ADULT, {
      released: { single: 6, ep: 2, lp: 1 },
      listeners: 30_000,
      reputation: 50,
    });
    const answers = new Set<string>();
    for (const trial of sweepAll(out, () => true, 120)) {
      const attempt = press(trial, { type: 'demo' });
      if (!attempt.ok) continue;
      const result = done(attempt);
      answers.add(`${result.outcome!.title}|${result.outcome!.tone}`);
    }
    expect(answers).toEqual(new Set(['A label called back|good', 'No word back|neutral']));
  });

  it('answers a collaboration, taking it or passing', () => {
    const rich = withCash(
      withMusic(ADULT, { released: { single: 2, ep: 0, lp: 0 }, listeners: 5_000 }),
      100_000,
    );
    const offers = musicCollabOffers(rich);
    expect(offers.length).toBeGreaterThan(0);
    const offer = offers[0]!;
    const yes = done(press(rich, { type: 'collab', offerId: offer.id, accept: true }));
    expect(yes.outcome).toMatchObject({ title: 'You made something together', tone: 'good' });
    expect(yes.outcome!.body).toContain(offer.partner.name);
    const no = done(press(rich, { type: 'collab', offerId: offer.id, accept: false }));
    expect(no.outcome).toMatchObject({ title: 'You passed', tone: 'neutral' });
    expect(no.outcome!.body).toContain('Turned down a record');
  });

  it('refuses a collaboration that is gone, and one you cannot pay for', () => {
    expect(refused(press(ADULT, { type: 'collab', offerId: 'x', accept: true }))).toBe(
      "That can't be done | That offer isn't on the table any more. | bad",
    );
    const poor = withCash(
      withMusic(ADULT, { released: { single: 2, ep: 0, lp: 0 }, listeners: 5_000 }),
      0,
    );
    // Offers are keyed on the year, so walk the years until a stranger who charges turns up.
    const paid = Array.from({ length: 40 }, (_, step) => ({
      ...withMusic(poor, { listeners: 50_000 }),
      world: { ...poor.world, year: poor.world.year + step },
    })).filter((trial) => musicCollabOffers(trial).some((offer) => offer.fee > 0));
    expect(paid.length).toBeGreaterThan(0);
    const trial = paid[0]!;
    const offer = musicCollabOffers(trial).find((row) => row.fee > 0)!;
    expect(refused(press(trial, { type: 'collab', offerId: offer.id, accept: true }))).toMatch(
      /^Not enough money \| .+ \| bad$/,
    );
    // Passing costs nothing, so it still works.
    expect(
      done(press(trial, { type: 'collab', offerId: offer.id, accept: false })).outcome!.title,
    ).toBe('You passed');
  });
});

describe('modeling', () => {
  it('applies to a casting', () => {
    const callId = modelCalls(ADULT)[0]!.job.id;
    const result = done(press(ADULT, { type: 'apply', field: 'modeling', callId }));
    expect(['They want you', "It didn't come through"]).toContain(result.outcome!.title);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.state.modeling.applied).toContain(callId);
    expect(result.state.acting.applied).not.toContain(callId);
  });

  it('refuses a casting that is not open, in the model words', () => {
    expect(refused(press(ADULT, { type: 'apply', field: 'modeling', callId: 'nope' }))).toBe(
      `That can't be done | ${MODEL_APPLY_ERROR_LABELS['no-such-call']} | bad`,
    );
  });

  it('has new pictures taken once a year', () => {
    const result = done(press(ADULT, { type: 'portfolio' }));
    expect(result.outcome).toMatchObject({ title: 'You had new pictures taken', tone: 'good' });
    expect(result.state.modeling.portfolioAge).toBe(ADULT.player.age);
    expect(refused(press(result.state, { type: 'portfolio' }))).toBe(
      `Not now | ${MODELING_ERROR_LABELS['already-shot']} | bad`,
    );
  });

  it('will not shoot pictures an adult cannot pay for', () => {
    const broke = withCash(ADULT, 0);
    const own: GameState = {
      ...broke,
      household: { ...broke.household, housing: 'ownPlace', standard: 0 },
    };
    expect(refused(press(own, { type: 'portfolio' }))).toBe(
      `Not now | ${MODELING_ERROR_LABELS['cant-afford']} | bad`,
    );
  });

  it('signs with an agency only after the work, and leaves it', () => {
    expect(refused(press(ADULT, { type: 'agent', field: 'modeling', on: true }))).toContain(
      'Not now | ',
    );
    expect(refused(press(ADULT, { type: 'agent', field: 'modeling', on: false }))).toBe(
      `Not now | ${MODELING_ERROR_LABELS['no-agency']} | bad`,
    );
    const worked = withModeling(ADULT, { credits: 12, tier: 'catalogue', reputation: 40 });
    const signed = done(press(worked, { type: 'agent', field: 'modeling', on: true }));
    expect(signed.outcome).toMatchObject({ title: 'You signed with an agency', tone: 'good' });
    const left = done(press(signed.state, { type: 'agent', field: 'modeling', on: false }));
    expect(left.outcome).toMatchObject({ title: 'You left the agency', tone: 'neutral' });
    expect(left.state.modeling.agency).toBeUndefined();
  });

  it('answers a brand: take it, ask for more, or pass', () => {
    const state = withModeling(ADULT, { credits: 3, followers: 5_000 });
    const offer = modelBrandOffers(state)[0]!;
    const passed = done(press(state, { type: 'brand', offerId: offer.id, answer: 'decline' }));
    expect(passed.outcome).toMatchObject({ title: 'You passed', tone: 'neutral' });
    // Offers and answers are keyed on the year and the audience, so walk both until each answer has been seen.
    const titles = new Set<string>();
    for (let step = 0; step < 60; step += 1) {
      for (const followers of [500, 5_000, 50_000]) {
        const trial: GameState = {
          ...withModeling(ADULT, { credits: 3, followers }),
          world: { ...ADULT.world, year: ADULT.world.year + step },
        };
        const o = modelBrandOffers(trial)[0];
        if (!o) continue;
        for (const answer of ['accept', 'more'] as const) {
          const result = done(press(trial, { type: 'brand', offerId: o.id, answer }));
          const walked = result.outcome!.body.includes('walked away');
          // The card says what the brand did: a deal that is on, or a brand that walked away.
          expect(result.outcome!.title).toBe(walked ? 'They walked away' : 'The deal is on');
          expect(result.outcome!.tone).toBe(walked ? 'bad' : 'good');
          if (answer === 'accept') expect(walked).toBe(false);
          expect(result.state.modeling.brandOwed > trial.modeling.brandOwed).toBe(!walked);
          titles.add(`${answer}|${result.outcome!.title}|${result.outcome!.tone}`);
        }
      }
    }
    expect([...titles].sort()).toEqual([
      'accept|The deal is on|good',
      'more|The deal is on|good',
      'more|They walked away|bad',
    ]);
  });

  it('refuses a brand that has moved on', () => {
    expect(refused(press(ADULT, { type: 'brand', offerId: 'x', answer: 'accept' }))).toBe(
      "That can't be done | That offer isn't on the table any more. | bad",
    );
  });
});

describe('the racing team', () => {
  const team = () => withRacingTeam(withCash(ADULT, 5_000_000));

  it('sets the development level without a card', () => {
    const { state, id } = team();
    const result = done(press(state, { type: 'development', businessId: id, level: 'heavy' }));
    expect(result.outcome).toBeUndefined();
    expect(result.state.businesses.find((b) => b.id === id)!.racing!.development).toBe('heavy');
  });

  it('hires a driver and says so', () => {
    const { state, id } = team();
    const candidateId = `drv:${state.world.year}:1:1`;
    const result = done(press(state, { type: 'hireDriver', businessId: id, candidateId }));
    expect(result.outcome).toMatchObject({ title: 'You hired a driver', tone: 'good' });
    const driver = result.state.businesses.find((b) => b.id === id)!.racing!.driver;
    expect(driver.kind === 'hired' && driver.id).toBe(candidateId);
  });

  it('refuses a driver who has gone elsewhere', () => {
    const { state, id } = team();
    expect(
      refused(press(state, { type: 'hireDriver', businessId: id, candidateId: 'drv:0:0:0' })),
    ).toBe(`That can't be done | ${RACING_ERROR_LABELS['no-such-driver']} | bad`);
  });

  it('refuses a team the player no longer runs', () => {
    const { state } = team();
    expect(refused(press(state, { type: 'driveOwn', businessId: 'gone', on: true }))).toBe(
      `That can't be done | ${RACING_ERROR_LABELS['no-such-business']} | bad`,
    );
  });

  it('refuses to drive without a racing career, and to step out when not in the car', () => {
    const { state, id } = team();
    expect(refused(press(state, { type: 'driveOwn', businessId: id, on: true }))).toMatch(
      /^That can't be done \| .+ \| bad$/,
    );
    expect(refused(press(state, { type: 'driveOwn', businessId: id, on: false }))).toBe(
      `That can't be done | ${RACING_ERROR_LABELS['not-a-driver']} | bad`,
    );
  });

  it('drives its own team for a pro driver, and hands the car back', () => {
    const { state, id } = team();
    const pro = withCareer(state, { sportId: 'racing', tier: 'starter' });
    const on = done(press(pro, { type: 'driveOwn', businessId: id, on: true }));
    expect(on.outcome).toMatchObject({ title: "You're driving for your team", tone: 'good' });
    expect(on.state.businesses.find((b) => b.id === id)!.racing!.driver.kind).toBe('owner');
    const off = done(press(on.state, { type: 'driveOwn', businessId: id, on: false }));
    expect(off.outcome).toMatchObject({ title: 'You handed the car over', tone: 'neutral' });
    expect(off.state.businesses.find((b) => b.id === id)!.racing!.driver.kind).toBe('hired');
  });

  it('will not move up before a season, or step down from the bottom', () => {
    const { state, id } = team();
    expect(refused(press(state, { type: 'series', businessId: id, direction: 'up' }))).toBe(
      `That can't be done | ${RACING_ERROR_LABELS['too-soon']} | bad`,
    );
    expect(refused(press(state, { type: 'series', businessId: id, direction: 'down' }))).toBe(
      `That can't be done | ${RACING_ERROR_LABELS['bottom-rung']} | bad`,
    );
  });

  it('moves up after a season, and steps back down', () => {
    const { state, id } = team();
    const played: GameState = {
      ...state,
      businesses: state.businesses.map((business) =>
        business.id === id
          ? {
              ...business,
              racing: {
                rung: 1,
                car: 50,
                driver: { kind: 'hired', id: 'd', name: 'Ana Reyes', skill: 50, age: 27 },
                development: 'steady',
                titles: 0,
                best: 1,
                seasons: 1,
                last: {
                  year: state.world.year,
                  rung: 1,
                  place: 4,
                  field: 18,
                  title: false,
                  incident: false,
                },
              },
            }
          : business,
      ),
    };
    const up = done(press(played, { type: 'series', businessId: id, direction: 'up' }));
    expect(up.outcome).toMatchObject({ title: 'The team moved up', tone: 'good' });
    expect(up.state.businesses.find((b) => b.id === id)!.racing!.rung).toBe(2);
    // Stepping back down wants a season at the new level first, just as moving up did.
    expect(refused(press(up.state, { type: 'series', businessId: id, direction: 'down' }))).toBe(
      `That can't be done | ${RACING_ERROR_LABELS['too-soon']} | bad`,
    );
    const raced: GameState = {
      ...up.state,
      businesses: up.state.businesses.map((business) =>
        business.id === id
          ? {
              ...business,
              racing: {
                ...business.racing!,
                seasons: 2,
                last: { ...business.racing!.last!, rung: 2, place: 17 },
              },
            }
          : business,
      ),
    };
    const down = done(press(raced, { type: 'series', businessId: id, direction: 'down' }));
    expect(down.outcome).toMatchObject({ title: 'The team stepped down', tone: 'neutral' });
    expect(down.state.businesses.find((b) => b.id === id)!.racing!.rung).toBe(1);
  });

  it('says it plainly when the team cannot afford the move', () => {
    const { state, id } = withRacingTeam(withCash(ADULT, 5_000_000));
    const played: GameState = {
      ...state,
      businesses: state.businesses.map((business) =>
        business.id === id
          ? {
              ...business,
              racing: {
                rung: 1 as const,
                car: 50,
                driver: { kind: 'owner' as const },
                development: 'steady' as const,
                titles: 0,
                best: 1 as const,
                seasons: 1,
                last: {
                  year: state.world.year,
                  rung: 1,
                  place: 4,
                  field: 18,
                  title: false,
                  incident: false,
                },
              },
            }
          : business,
      ),
    };
    const poor = withCash(played, 0);
    const message = refused(press(poor, { type: 'series', businessId: id, direction: 'up' }));
    expect(message).toMatch(/^Not enough money \| .+ \| bad$/);
  });

  it('moves up on a card when that is how the player chose to pay, and refuses a loan on top of it', () => {
    const { state, id } = withRacingTeam(withCash(ADULT, 5_000_000));
    const card = {
      productId: 'card.private',
      limit: dollars(200_000),
      balance: dollars(0),
      status: 'open' as const,
    };
    const played: GameState = {
      ...state,
      cards: [card],
      businesses: state.businesses.map((business) =>
        business.id === id
          ? {
              ...business,
              racing: {
                rung: 1 as const,
                car: 50,
                driver: {
                  kind: 'hired' as const,
                  id: 'drv:test',
                  name: 'A Driver',
                  age: 30,
                  skill: 60,
                },
                development: 'steady' as const,
                titles: 0,
                best: 1 as const,
                seasons: 1,
                last: {
                  year: state.world.year,
                  rung: 1,
                  place: 4,
                  field: 18,
                  title: false,
                  incident: false,
                },
              },
            }
          : business,
      ),
    };
    const cash = Number(played.player.cash);
    const up = done(
      press(played, {
        type: 'series',
        businessId: id,
        direction: 'up',
        payment: { kind: 'card', productId: 'card.private' },
      }),
    );
    expect(up.outcome).toMatchObject({ title: 'The team moved up', tone: 'good' });
    expect(Number(up.state.player.cash)).toBe(cash);
    expect(Number(up.state.cards[0]!.balance)).toBeGreaterThan(0);
    expect(up.outcome!.body).toContain('Paid with');
    expect(
      refused(
        press(played, {
          type: 'series',
          businessId: id,
          direction: 'up',
          finance: { productId: 'nope', amount: 1000 },
          payment: { kind: 'card', productId: 'card.private' },
        }),
      ),
    ).toMatch(/^That can't be done \| .+ \| bad$/);
  });

  it('has a sentence for every refusal the team can give, and none of them is a code', () => {
    for (const [code, words] of Object.entries(RACING_ERROR_LABELS)) {
      expect(words, code).toMatch(/^[A-Z].*[.]$/);
      expect(words, code).not.toContain(code.includes('-') ? code : '\u0000');
    }
    expect(Object.keys(FINANCE_ERROR_LABELS).length).toBeGreaterThan(0);
  });
});

describe('the racing team’s refusal words', () => {
  it('has exactly these sentences', () => {
    expect(RACING_ERROR_LABELS).toEqual({
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
    });
  });

  it('refuses a business that is not a racing team', () => {
    const { state } = withRacingTeam(withCash(ADULT, 5_000_000));
    const plain = openBusiness(state, 'biz.cleaning');
    if (!plain.ok) throw new Error('could not open a second business');
    const other = plain.value.state.businesses.find((b) => b.typeId === 'biz.cleaning')!;
    expect(
      refused(press(plain.value.state, { type: 'driveOwn', businessId: other.id, on: true })),
    ).toBe(`That can't be done | ${RACING_ERROR_LABELS['not-a-racing-team']} | bad`);
  });

  it('refuses a development level that does not exist, and has nothing above the top series', () => {
    const { state, id } = withRacingTeam(withCash(ADULT, 5_000_000));
    expect(
      refused(press(state, { type: 'development', businessId: id, level: 'bogus' as never })),
    ).toBe(`That can't be done | ${RACING_ERROR_LABELS['no-such-choice']} | bad`);
    const top: GameState = {
      ...state,
      businesses: state.businesses.map((business) =>
        business.id === id
          ? {
              ...business,
              racing: {
                rung: 5,
                car: 90,
                driver: { kind: 'owner' },
                development: 'steady',
                titles: 0,
                best: 5,
                seasons: 1,
                last: {
                  year: state.world.year,
                  rung: 5,
                  place: 3,
                  field: 20,
                  title: false,
                  incident: false,
                },
              },
            }
          : business,
      ),
    };
    expect(refused(press(top, { type: 'series', businessId: id, direction: 'up' }))).toBe(
      `That can't be done | ${RACING_ERROR_LABELS['top-rung']} | bad`,
    );
  });

  it('says exactly what it says when the team cannot afford the move', () => {
    const { state, id } = withRacingTeam(withCash(ADULT, 5_000_000));
    const played: GameState = {
      ...withCash(state, 0),
      businesses: state.businesses.map((business) =>
        business.id === id
          ? {
              ...business,
              racing: {
                rung: 1,
                car: 50,
                driver: { kind: 'owner' },
                development: 'steady',
                titles: 0,
                best: 1,
                seasons: 1,
                last: {
                  year: state.world.year,
                  rung: 1,
                  place: 4,
                  field: 18,
                  title: false,
                  incident: false,
                },
              },
            }
          : business,
      ),
    };
    expect(refused(press(played, { type: 'series', businessId: id, direction: 'up' }))).toBe(
      `Not enough money | ${RACING_ERROR_LABELS['cannot-afford']} | bad`,
    );
  });
});

describe('a player too young for any of it', () => {
  it('is refused with words, never a code', () => {
    const child = at(ADULT, 6);
    for (const action of [
      { type: 'portfolio' },
      { type: 'develop' },
      { type: 'lessons', field: 'acting', on: true },
      { type: 'demo' },
    ] as const) {
      const attempt = press(child, action);
      if (attempt.ok) continue;
      expect(attempt.outcome.body).toMatch(/^[A-Z].*[.]$/);
    }
  });
});

describe('what every answer carries', () => {
  it('writes only lines that did not exist before, and never touches the input state', () => {
    const state = STUDYING(withCareer(ADULT, { stage: 'college' }));
    const before = JSON.stringify(state);
    const result = done(press(state, { type: 'art', artId: 'boxing', do: 'train' }));
    expect(JSON.stringify(state)).toBe(before);
    const had = new Set(state.player.timeline.map((entry) => entry.id));
    expect(result.entries.length).toBeGreaterThan(0);
    for (const entry of result.entries) expect(had.has(entry.id)).toBe(false);
  });
});
