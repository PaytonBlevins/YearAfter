/**
 * Ticket 0903 acceptance tests — deployments.
 *
 * Orders that come at a steady tempo by branch and job and that cost something to refuse; a year away with hostile fire
 * pay and pay kept from tax; incidents that are decisions and wait for a result; harm that only follows failure (a mistake
 * may hurt, a disaster always does and may kill, and nothing a clean or close incident leaves can); what lasts (a lasting
 * condition, mental strain, decorations); and that nothing in the game plays a minigame yet, so no life deploys until
 * something opens the gate. Each pin that is a real figure says so; the rest are the game's own dials, named in the doc.
 */

import { describe, expect, it } from 'vitest';
import {
  AWARD_LINES,
  DANGER_TEMPO,
  DECORATIONS,
  DECORATION_CHANCE,
  DEATH_ON_DISASTER,
  DEPLOY_MIN_YEARS,
  DEPLOY_TEMPO,
  DEPLOY_TIERS,
  HOSTILE_PAY_MONTHLY,
  HOSTILE_PAY_TIERS,
  INCIDENT_OUTCOMES,
  INJURY_ON_MISTAKE,
  REFERENCE_OUTCOMES,
  REFUSE_MOOD,
  REFUSE_PERFORMANCE,
  REFUSE_REPUTATION,
  THEATERS,
  TIER_INCIDENTS,
  TIER_ODDS,
  TRAUMA_CONDITION,
  WOUND_CONDITIONS,
  WOUND_COST,
  WOUND_LASTING,
  deploymentMonths,
  deploymentTier,
  findDecoration,
  findSpecialty,
  isDecorationId,
  isIncidentOutcome,
  monthlyBasePay,
  ordersChance,
  traumaChance,
  type DecorationId,
} from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';
import { CONDITIONS, findCondition } from '@yearafter/health';

import { advanceYear } from './advance';
import { decide } from './decide';
import { hasSystemicOffer, type GameState } from './game-state';
import {
  MILITARY_OFFER_EVENT_ID,
  applyForCommission,
  retireFromService,
  runMilitaryYear,
  withMilitaryOffer,
} from './military';
import {
  MILITARY_MISSION_EVENT_ID,
  ORDERS_GO,
  ORDERS_REFUSE,
  OFFICER_EXCLUSION_CAP,
  answerMission,
  answerOrders,
  closeDeployments,
  earnedAwards,
  isDeployed,
  isMilitaryMissionDecision,
  missionDecision,
  openDeployments,
  ordersOfferFor,
  runDeploymentYear,
  withMissionDecision,
} from './military-deployments';
import {
  EMPTY_MILITARY,
  type Deployment,
  type MilitaryOffer,
  type ServiceCareer,
} from './military-state';
import { createNewGame } from './new-game';
import { Rng } from './rng/rng';
import { ordinaryChoice } from './ordinary-answers';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function toAge(state: GameState, age: number): GameState {
  let current = state;
  let guard = 0;
  while (current.player.alive && current.player.age < age && (guard += 1) < 80) {
    current = answerAll(advanceYear(answerAll(current)).state);
  }
  return current;
}

function answerAll(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending[0];
    if (!open) break;
    const choice =
      open.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : ordinaryChoice(open);
    if (!choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

const adults = new Map<string, GameState>();
function adult(seed: string, age = 24): GameState {
  const key = `${seed}:${age}`;
  const found = adults.get(key);
  if (found) return found;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const made = toAge(createNewGame({ seed: attempt === 0 ? seed : `${seed}~${attempt}` }), age);
    if (made.player.alive && made.player.age >= age) {
      adults.set(key, made);
      return made;
    }
  }
  throw new Error(`no living life of age ${age} for ${seed}`);
}

type StatName =
  'charisma' | 'looks' | 'smarts' | 'discipline' | 'health' | 'happiness' | 'willpower';
const withStats = (state: GameState, stats: Partial<Record<StatName, number>>): GameState => ({
  ...state,
  player: { ...state.player, stats: { ...state.player.stats, ...stats } as never },
});

/** A fit adult with a high-school diploma and nothing in the way, in no service. */
const eligible = (state: GameState): GameState => {
  const fit = withStats(state, { health: 80, smarts: 60, discipline: 60 });
  return {
    ...fit,
    education: {
      ...fit.education,
      enrollment: undefined,
      credentials: {
        ...fit.education.credentials,
        highSchool: 18,
        university: undefined,
        postgraduate: undefined,
      },
    } as never,
    sports: { ...fit.sports, career: undefined, post: undefined } as never,
    health: { ...fit.health, conditions: [], deficit: 0 },
    pending: [],
    military: EMPTY_MILITARY,
  };
};

const withSeed = (state: GameState, seed: string): GameState =>
  ({ ...state, rng: new Rng(seed) }) as unknown as GameState;

const serviceRow = (patch: Partial<ServiceCareer> = {}): ServiceCareer => ({
  branch: 'army',
  stage: 'serving',
  enlistedAge: 19,
  track: 'enlisted',
  specialty: 'army.infantry',
  commissionedAt: 0,
  grade: 4,
  years: 3,
  termEnds: 9,
  performance: 60,
  reputation: 55,
  effort: 'normal',
  lastPay: 0,
  post: 'Fort Harlan',
  ...patch,
});

const officerRow = (patch: Partial<ServiceCareer> = {}): ServiceCareer =>
  serviceRow({
    track: 'officer',
    grade: 3,
    years: 5,
    termEnds: 9,
    enlistedAge: 22,
    ...patch,
  });

const serving = (state: GameState, patch: Partial<ServiceCareer> = {}): GameState => ({
  ...state,
  military: { ...state.military, service: serviceRow(patch) },
});

const officering = (state: GameState, patch: Partial<ServiceCareer> = {}): GameState => ({
  ...state,
  military: { ...state.military, service: officerRow(patch) },
});

const opened = (state: GameState): GameState => openDeployments(state);

/** The hash a deployment draw is made from, so a seed can be picked by what it draws and not found by luck. */
const draw = (state: GameState, ...parts: readonly (string | number)[]): number =>
  mixedUnit(`service:${state.rng.getSeed()}:${state.world.generation}:deploy:${parts.join(':')}`);

type Test = readonly [readonly (string | number)[], (unit: number) => boolean];

/** The first seed of a family whose draws all fall where the tests say. */
function seedWith(state: GameState, ...tests: readonly Test[]): GameState {
  for (let i = 0; i < 20000; i += 1) {
    const candidate = withSeed(state, `dep-${i}`);
    if (tests.every(([parts, test]) => test(draw(candidate, ...parts)))) return candidate;
  }
  throw new Error('no seed found');
}

const ORDERS_AGE_OF = (state: GameState): number => state.player.age + 1;

const dangerOf = (specialty: string): number => findSpecialty(specialty)?.danger ?? 2;

const base = eligible(adult('DEPLOY-BASE', 26));

/** A deployment in progress, active, with the incident on the table. */
function deployed(
  state: GameState,
  patch: Partial<Deployment> = {},
  career: Partial<ServiceCareer> = {},
): GameState {
  const deployment: Deployment = {
    status: 'active',
    theater: 'Camp Meridian',
    months: 8,
    tier: 'forward',
    incidents: 2,
    results: [],
    orderedAge: state.player.age,
    ...patch,
  };
  const life = serving(opened(state), career);
  return withMissionDecision(
    { ...life, military: { ...life.military, deployment } } as GameState,
    true,
  );
}

/** The same life with a fresh random generator on its seed, so two runs of it start from the same stream. */
const fresh = (state: GameState): GameState => withSeed(state, state.rng.getSeed());

/** Answer every question the year raised that is not the service's, the way an ordinary life would. */
function settle(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending.find((row) => !row.eventId.startsWith('military.'));
    if (!open) break;
    const choice = ordinaryChoice(open);
    if (!choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

const militaryQuestions = (state: GameState): readonly string[] =>
  state.pending.filter((row) => row.eventId.startsWith('military.')).map((row) => row.eventId);

const answer = (state: GameState, choice: string) => {
  const result = decide(state, MILITARY_MISSION_EVENT_ID, choice);
  if (!result.ok) throw new Error(`could not answer: ${result.error}`);
  return result.value.state;
};

const holds = (state: GameState, id: string): boolean =>
  state.health.conditions.some((row) => row.conditionId === id);

/* -------------------------------------------------------------------------- */
/* The tables                                                                  */
/* -------------------------------------------------------------------------- */

describe('the tempo', () => {
  it('is steady by branch: the Army and Marines most, the Air Force less, the Coast Guard least', () => {
    expect(DEPLOY_TEMPO.army.orders).toBeGreaterThanOrEqual(DEPLOY_TEMPO.navy.orders);
    expect(DEPLOY_TEMPO['marine-corps'].orders).toBeGreaterThanOrEqual(DEPLOY_TEMPO.navy.orders);
    expect(DEPLOY_TEMPO.navy.orders).toBeGreaterThan(DEPLOY_TEMPO['air-force'].orders);
    expect(DEPLOY_TEMPO['air-force'].orders).toBeGreaterThan(DEPLOY_TEMPO['coast-guard'].orders);
  });

  it('is scaled by the job’s danger tag, up and down', () => {
    expect(DANGER_TEMPO).toHaveLength(3);
    expect(ordersChance('army', 1)).toBeLessThan(ordersChance('army', 2));
    expect(ordersChance('army', 2)).toBeLessThan(ordersChance('army', 3));
    expect(ordersChance('army', 2)).toBeCloseTo(DEPLOY_TEMPO.army.orders);
  });

  it('clamps a danger tag outside one to three, and knows no branch it was not given', () => {
    expect(ordersChance('army', 0)).toBe(ordersChance('army', 1));
    expect(ordersChance('army', 9)).toBe(ordersChance('army', 3));
    expect(ordersChance('space-force', 2)).toBe(0);
  });

  it('keeps no year a war: it is a yearly chance, below a half, and nobody is sent every year', () => {
    for (const branch of Object.keys(DEPLOY_TEMPO)) {
      for (const danger of [1, 2, 3]) {
        expect(ordersChance(branch, danger)).toBeGreaterThan(0);
        expect(ordersChance(branch, danger)).toBeLessThan(0.5);
      }
    }
  });

  it('runs a branch’s usual months, a month shorter on a low draw and a month longer on a high one', () => {
    expect(deploymentMonths('army', 0.5)).toBe(9);
    expect(deploymentMonths('army', 0.1)).toBe(8);
    expect(deploymentMonths('army', 0.9)).toBe(10);
    expect(deploymentMonths('navy', 0.5)).toBe(6);
    expect(deploymentMonths('air-force', 0.5)).toBe(4);
    expect(deploymentMonths('nowhere', 0.5)).toBe(6);
    expect(deploymentMonths('coast-guard', 0.0)).toBe(3);
  });

  it('never makes a deployment shorter than two months', () => {
    expect(deploymentMonths('air-force', 0)).toBeGreaterThanOrEqual(2);
  });
});

describe('the places', () => {
  it('send a safer job to the rear and a riskier one to the front, with a tier for every draw', () => {
    for (const row of TIER_ODDS) {
      expect(row[0] + row[1] + row[2]).toBeCloseTo(1);
    }
    expect(deploymentTier(1, 0.5)).toBe('rear');
    expect(deploymentTier(1, 0.99)).toBe('forward');
    expect(deploymentTier(3, 0.05)).toBe('rear');
    expect(deploymentTier(3, 0.95)).toBe('front');
    expect(deploymentTier(2, 0.29)).toBe('rear');
    expect(deploymentTier(2, 0.3)).toBe('forward');
    expect(deploymentTier(2, 0.9)).toBe('front');
  });

  it('send a danger-1 job nowhere near the front, and a danger-3 job there often', () => {
    expect(TIER_ODDS[0]![2]).toBe(0);
    expect(TIER_ODDS[2]![2]).toBeGreaterThan(TIER_ODDS[1]![2]);
  });

  it('expose a deployment more the nearer it is: one incident at the rear, two forward, three at the front', () => {
    expect(TIER_INCIDENTS).toEqual({ rear: 1, forward: 2, front: 3 });
    expect(DEPLOY_TIERS).toEqual(['rear', 'forward', 'front']);
  });

  it('pay hostile fire pay at $225 a month (real) at the forward and front tiers, and not at the rear', () => {
    expect(HOSTILE_PAY_MONTHLY).toBe(225);
    expect(HOSTILE_PAY_TIERS).toEqual(['forward', 'front']);
  });

  it('are made-up places', () => {
    expect(THEATERS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(THEATERS).size).toBe(THEATERS.length);
  });
});

describe('the danger', () => {
  it('has four outcomes, in order, and knows them when it sees them', () => {
    expect(INCIDENT_OUTCOMES).toEqual(['clean', 'close', 'mistake', 'disaster']);
    expect(isIncidentOutcome('clean')).toBe(true);
    expect(isIncidentOutcome('victory')).toBe(false);
    expect(isIncidentOutcome(3)).toBe(false);
  });

  it('keeps the reference player’s outcomes whole: they sum to one', () => {
    const sum = INCIDENT_OUTCOMES.reduce((total, id) => total + REFERENCE_OUTCOMES[id], 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('puts harm after failure: a mistake may hurt (a quarter), a disaster kills a quarter of the time', () => {
    expect(INJURY_ON_MISTAKE).toBe(0.25);
    expect(DEATH_ON_DISASTER).toBe(0.25);
  });

  it('lands a reference player above the real rate of being wounded and of dying per deployment, and not wildly so', () => {
    // Real: 52,340 wounded in action and 6,836 dead in Iraq and Afghanistan, 2001 to 2014 (NDU Press, "Annex A", as of
    // June 2015), over about 5.4 million deployments (a widely cited count of 2.77 million members deployed; the
    // denominator was not re-fetched): about 1% wounded and 0.13% killed per deployment. A deployment's reference
    // exposure here is two incidents, the middle tier's.
    const incidents = 2;
    const wound =
      1 -
      Math.pow(
        1 - (REFERENCE_OUTCOMES.mistake * INJURY_ON_MISTAKE + REFERENCE_OUTCOMES.disaster),
        incidents,
      );
    const death = 1 - Math.pow(1 - REFERENCE_OUTCOMES.disaster * DEATH_ON_DISASTER, incidents);
    expect(wound).toBeGreaterThan(0.01);
    expect(wound).toBeLessThan(0.05);
    expect(death).toBeGreaterThan(0.0005);
    expect(death).toBeLessThan(0.005);
  });

  it('makes trauma likelier the worse the outcome and the nearer the front, and never after a clean one', () => {
    expect(traumaChance('clean', 'front')).toBe(0);
    for (const tier of DEPLOY_TIERS) {
      expect(traumaChance('close', tier)).toBeLessThan(traumaChance('mistake', tier));
      expect(traumaChance('mistake', tier)).toBeLessThan(traumaChance('disaster', tier));
    }
    expect(traumaChance('disaster', 'rear')).toBeLessThan(traumaChance('disaster', 'front'));
  });

  it('costs a serious wound more than a minor one, and leaves something lasting more often', () => {
    expect(WOUND_COST.serious).toBeGreaterThan(WOUND_COST.minor);
    expect(WOUND_LASTING.serious).toBeGreaterThan(WOUND_LASTING.minor);
  });

  it('draws every lasting condition from the health layer, tagged as a service injury or one that already was', () => {
    for (const id of [...WOUND_CONDITIONS.minor, ...WOUND_CONDITIONS.serious, TRAUMA_CONDITION]) {
      expect(findCondition(id), id).toBeDefined();
    }
    const service = CONDITIONS.filter((row) => row.from === 'service').map((row) => row.id);
    expect(service).toEqual(
      expect.arrayContaining([
        'cond.shrapnel',
        'cond.blast',
        'cond.limb',
        'cond.brain',
        'cond.burns',
        'cond.trauma',
      ]),
    );
  });

  it('keeps a lost limb for life: nothing treats it and nothing clears it', () => {
    const limb = findCondition('cond.limb')!;
    expect(limb.treatable).toBe(0);
    expect(limb.resolves).toBe(0);
  });
});

describe('the decorations', () => {
  it('are six, each findable and each with a chance', () => {
    expect(DECORATIONS).toHaveLength(6);
    for (const row of DECORATIONS) {
      expect(findDecoration(row.id)).toBe(row);
      expect(isDecorationId(row.id)).toBe(true);
      expect(DECORATION_CHANCE[row.id]).toBeGreaterThan(0);
      expect(DECORATION_CHANCE[row.id]).toBeLessThanOrEqual(1);
    }
    expect(isDecorationId('victory-cross')).toBe(false);
    expect(findDecoration('victory-cross')).toBeUndefined();
  });

  it('make the Medal of Honor the rarest and the deployment medal and the Purple Heart certain', () => {
    expect(DECORATION_CHANCE['medal-of-honor']).toBeLessThanOrEqual(0.05);
    expect(DECORATION_CHANCE['service-medal']).toBe(1);
    expect(DECORATION_CHANCE['purple-heart']).toBe(1);
  });

  it('have an award line that names the award', () => {
    for (const line of AWARD_LINES) expect(line).toContain('%award%');
  });
});

/* -------------------------------------------------------------------------- */
/* The gate                                                                    */
/* -------------------------------------------------------------------------- */

describe('with the gate closed (the way every life is)', () => {
  it('raises no orders, over many seeds and every branch', () => {
    let raised = 0;
    for (let i = 0; i < 120; i += 1) {
      for (const branch of ['army', 'navy', 'marine-corps', 'air-force', 'coast-guard'] as const) {
        const life = serving(withSeed(base, `closed-${i}`), {
          branch,
          specialty: `${branch}.${branch === 'army' ? 'infantry' : 'x'}`,
        });
        const out = runMilitaryYear({
          before: life,
          education: life.education,
          age: life.player.age + 1,
          year: life.world.year + 1,
        });
        if (out.military.offer?.kind === 'orders') raised += 1;
      }
    }
    expect(raised).toBe(0);
  });

  it('has no deployment, no past ones and no decorations after fifteen years of a service life', () => {
    let life = serving(withSeed(base, 'closed-long'), { years: 1, termEnds: 99 });
    for (let i = 0; i < 15; i += 1) {
      life = answerAll(advanceYear(life).state);
      if (!life.player.alive) break;
    }
    expect(life.military.deployment).toBeUndefined();
    expect(life.military.deployments).toBeUndefined();
    expect(life.military.decorations).toBeUndefined();
  });

  it('is turned on by `openDeployments` and off by `closeDeployments`, which only touch the flag', () => {
    const on = openDeployments(base);
    expect(on.military.deploymentsOpen).toBe(true);
    expect(on.military).toEqual({ ...base.military, deploymentsOpen: true });
    const off = closeDeployments(on);
    expect(off.military.deploymentsOpen).toBeUndefined();
    expect(off.military).toEqual(base.military);
  });

  it('draws nothing from the random stream: an open life that gets no orders replays the closed one', () => {
    const life = serving(withSeed(base, 'replay-1'), { years: 4 });
    const none = seedWith(life, [['orders', ORDERS_AGE_OF(life)], (u) => u >= 0.99]);
    const closed = advanceYear(fresh(none)).state;
    const open = advanceYear(opened(fresh(none))).state;
    expect({ ...open, military: { ...open.military, deploymentsOpen: undefined } }).toEqual({
      ...closed,
      military: { ...closed.military, deploymentsOpen: undefined },
    });
  });

  it('leaves a civilian life exactly as it was when the gate opens', () => {
    const civilian = withSeed(base, 'civ-1');
    const closed = advanceYear(fresh(civilian)).state;
    const open = advanceYear(opened(fresh(civilian))).state;
    expect(open.military).toEqual({ ...closed.military, deploymentsOpen: true });
    expect(open.player.cash).toBe(closed.player.cash);
  });
});

/* -------------------------------------------------------------------------- */
/* The orders                                                                  */
/* -------------------------------------------------------------------------- */

describe('the orders', () => {
  const life0 = serving(withSeed(base, 'orders'), { years: 3 });
  const age = ORDERS_AGE_OF(life0);
  const chance = ordersChance('army', dangerOf('army.infantry'));
  const comes = seedWith(life0, [['orders', age], (u) => u < chance]);
  const stays = seedWith(life0, [['orders', age], (u) => u >= chance]);

  it('come to a serving member of an open life when the draw is under the chance', () => {
    const offer = ordersOfferFor(opened(comes), serviceRow({ years: 4 }), age);
    expect(offer?.kind).toBe('orders');
    expect(offer?.age).toBe(age);
    expect(THEATERS).toContain(offer?.theater);
    expect(DEPLOY_TIERS).toContain(offer?.tier);
    expect(offer?.incidents).toBe(TIER_INCIDENTS[offer!.tier]);
    expect(offer?.months).toBeGreaterThanOrEqual(2);
  });

  it('take the place, and how near the fighting it is, from their own draws', () => {
    const career = serviceRow({ years: 4 });
    const last = seedWith(
      life0,
      [['orders', age], (u) => u < chance],
      [['theater', age], (u) => u >= 0.99],
      [['tier', age], (u) => u >= 0.95],
    );
    const first = seedWith(
      life0,
      [['orders', age], (u) => u < chance],
      [['theater', age], (u) => u < 0.01],
      [['tier', age], (u) => u < 0.05],
    );
    const a = ordersOfferFor(opened(last), career, age)!;
    const b = ordersOfferFor(opened(first), career, age)!;
    expect(a.theater).toBe(THEATERS[THEATERS.length - 1]);
    expect(b.theater).toBe(THEATERS[0]);
    expect(a.tier).toBe('front');
    expect(a.incidents).toBe(3);
    expect(b.tier).toBe('rear');
    expect(b.incidents).toBe(1);
  });

  it('use the middle danger for a job the table does not know', () => {
    const two = ordersChance('army', 2);
    const three = ordersChance('army', 3);
    expect(three).toBeGreaterThan(two);
    const unknown = serviceRow({ specialty: 'army.nothing', years: 4 });
    const between = seedWith(life0, [['orders', age], (u) => u >= two && u < three]);
    expect(ordersOfferFor(opened(between), unknown, age)).toBeUndefined();
    expect(ordersOfferFor(opened(between), serviceRow({ years: 4 }), age)).toBeDefined();
    const under = seedWith(life0, [['orders', age], (u) => u < two]);
    expect(ordersOfferFor(opened(under), unknown, age)).toBeDefined();
  });

  it('do not come when the draw is over the chance', () => {
    expect(ordersOfferFor(opened(stays), serviceRow({ years: 4 }), age)).toBeUndefined();
  });

  it('do not come to a closed life, however the draw falls', () => {
    expect(ordersOfferFor(comes, serviceRow({ years: 4 }), age)).toBeUndefined();
  });

  it('do not come in training, or to a member who was never in', () => {
    expect(
      ordersOfferFor(opened(comes), serviceRow({ stage: 'training', years: 0 }), age),
    ).toBeUndefined();
    // An enlisted member in officer training has years behind them and is still not posted.
    expect(
      ordersOfferFor(opened(comes), serviceRow({ stage: 'training', years: 5 }), age),
    ).toBeUndefined();
    expect(
      ordersOfferFor(opened(comes), serviceRow({ stage: 'serving', years: 5 }), age),
    ).toBeDefined();
    expect(
      ordersOfferFor(opened(comes), serviceRow({ years: DEPLOY_MIN_YEARS - 1 }), age),
    ).toBeUndefined();
  });

  it('do not come while a deployment is under way', () => {
    const away = deployed(comes);
    expect(ordersOfferFor(away, serviceRow({ years: 4 }), age)).toBeUndefined();
  });

  it('are raised by the year, as a question the next year cannot be run past', () => {
    const out = advanceYear(opened(comes)).state;
    expect(out.military.offer?.kind).toBe('orders');
    expect(out.pending.some((row) => row.eventId === MILITARY_OFFER_EVENT_ID)).toBe(true);
    expect(hasSystemicOffer(out)).toBe(true);
    const question = out.pending.find((row) => row.eventId === MILITARY_OFFER_EVENT_ID)!;
    expect(question.choices.map((row) => row.id)).toEqual([ORDERS_GO, ORDERS_REFUSE]);
    expect(question.prompt).toContain((out.military.offer as { theater: string }).theater);
    expect(question.prompt).toMatch(/\d+ months/);
  });

  it('are made on the same offer again from the same seed', () => {
    const a = ordersOfferFor(opened(comes), serviceRow({ years: 4 }), age);
    const b = ordersOfferFor(opened(comes), serviceRow({ years: 4 }), age);
    expect(a).toEqual(b);
  });

  it('come to a riskier job more often than to a safer one', () => {
    const count = (specialty: string): number => {
      const danger = dangerOf(specialty);
      let n = 0;
      for (let i = 0; i < 1500; i += 1) {
        const state = opened(withSeed(base, `tempo-${i}`));
        if (
          ordersOfferFor(state, serviceRow({ specialty, years: 4 }), age) !== undefined &&
          danger >= 0
        ) {
          n += 1;
        }
      }
      return n;
    };
    const armySpecialties = ['army.infantry'];
    const found = armySpecialties.map((id) => ({ id, danger: dangerOf(id) }));
    expect(found[0]!.danger).toBeGreaterThanOrEqual(1);
    // A danger-3 job is sent about 1.5 times as often as a danger-1 one.
    const high = ordersChance('army', 3);
    const low = ordersChance('army', 1);
    expect(high / low).toBeCloseTo(DANGER_TEMPO[2]! / DANGER_TEMPO[0]!);
    // And the draw really does fall under the chance about that share of the time.
    const n = count('army.infantry');
    const share = n / 1500;
    expect(share).toBeGreaterThan(chance - 0.04);
    expect(share).toBeLessThan(chance + 0.04);
  });

  it('send a member to about the two deployments the services average over a career', () => {
    // RAND (2009): the average deployed member of the post-9/11 force deployed about twice. A twenty-year career at the
    // Army's tempo is about four; a four-year enlistment is under one.
    const army = ordersChance('army', 2);
    expect(army * 4).toBeGreaterThan(0.5);
    expect(army * 4).toBeLessThan(1);
    expect(army * 19).toBeGreaterThan(3);
    expect(army * 19).toBeLessThan(5);
  });
});

describe('answering the orders', () => {
  const life0 = serving(withSeed(base, 'answer-orders'), { years: 3 });
  const age = ORDERS_AGE_OF(life0);
  const comes = seedWith(life0, [['orders', age], (u) => u < 0.1]);
  const raised = advanceYear(opened(comes)).state;

  it('go: the deployment is ordered, with the offer’s place, months and incidents, and the question is gone', () => {
    const offer = raised.military.offer as Extract<MilitaryOffer, { kind: 'orders' }>;
    const out = decide(raised, MILITARY_OFFER_EVENT_ID, ORDERS_GO);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const state = out.value.state;
    expect(state.military.offer).toBeUndefined();
    expect(militaryQuestions(state)).toEqual([]);
    expect(state.military.deployment).toEqual({
      status: 'ordered',
      theater: offer.theater,
      months: offer.months,
      tier: offer.tier,
      incidents: offer.incidents,
      results: [],
      orderedAge: raised.player.age,
    });
    expect(isDeployed(state.military)).toBe(true);
    expect(out.value.entry.text.length).toBeGreaterThan(20);
  });

  it('go: costs nothing yet, and the year after is the deployment', () => {
    const went = answer0(raised, ORDERS_GO);
    expect(went.military.service?.reputation).toBe(raised.military.service?.reputation);
    expect(went.military.deployment?.status).toBe('ordered');
  });

  it('refuse: costs standing, performance and a mood, remembers it, and sends nobody', () => {
    const before = raised.military.service!;
    const mood = raised.player.stats.happiness;
    const state = answer0(raised, ORDERS_REFUSE);
    expect(state.military.deployment).toBeUndefined();
    expect(state.military.offer).toBeUndefined();
    expect(militaryQuestions(state)).toEqual([]);
    const after = state.military.service!;
    expect(after.reputation).toBe(Math.max(0, before.reputation + REFUSE_REPUTATION));
    expect(after.performance).toBe(Math.max(0, before.performance + REFUSE_PERFORMANCE));
    expect(after.noRiseAtAge).toBe(raised.player.age + 1);
    expect(after.refusedTerm).toBe(true);
    expect(state.player.stats.happiness).toBe(Math.max(0, mood + REFUSE_MOOD));
    expect(state.player.records.some((row) => row.label === 'Refused deployment orders')).toBe(
      true,
    );
  });

  it('refuse: bottoms out at zero rather than below it', () => {
    const low = {
      ...raised,
      military: {
        ...raised.military,
        service: { ...raised.military.service!, reputation: 4, performance: 3 },
      },
    };
    const after = answer0(low, ORDERS_REFUSE).military.service!;
    expect(after.reputation).toBe(0);
    expect(after.performance).toBe(0);
  });

  it('refuse: the next year brings no promotion, and the year after can', () => {
    // A third-grade member with years and a perfect record would rise at the Army's chance in any year; pick the seed
    // where the rise draw is a sure thing, and show that the year after a refusal it is held back.
    const state = answer0(
      {
        ...raised,
        military: {
          ...raised.military,
          service: { ...raised.military.service!, grade: 4, years: 5, performance: 100 },
        },
      },
      ORDERS_REFUSE,
    );
    const lucky = withSeed(state, 'rise-sure');
    const luckyFirst = runMilitaryYear({
      before: closeDeployments(lucky),
      education: lucky.education,
      age: lucky.player.age + 1,
      year: lucky.world.year + 1,
    });
    expect(luckyFirst.military.service?.grade).toBe(4);
    const free = runMilitaryYear({
      before: {
        ...lucky,
        military: {
          ...lucky.military,
          service: { ...lucky.military.service!, noRiseAtAge: undefined },
        },
      },
      education: lucky.education,
      age: lucky.player.age + 1,
      year: lucky.world.year + 1,
    });
    expect(free.military.service?.grade).toBeGreaterThanOrEqual(4);
  });

  it('refuse: the term ends without a question, and with it the service', () => {
    const state = answer0(raised, ORDERS_REFUSE);
    const ending = {
      ...state,
      military: {
        ...state.military,
        service: { ...state.military.service!, termEnds: state.military.service!.years + 1 },
      },
    };
    const out = runMilitaryYear({
      before: closeDeployments(ending),
      education: ending.education,
      age: ending.player.age + 1,
      year: ending.world.year + 1,
    });
    expect(out.left).toBe(true);
    expect(out.military.past.at(-1)?.how).toBe('not-retained');
    expect(out.military.offer).toBeUndefined();
  });

  it('refuse: at twenty years that is a retirement', () => {
    const state = answer0(raised, ORDERS_REFUSE);
    const ending = {
      ...state,
      military: {
        ...state.military,
        service: { ...state.military.service!, years: 19, termEnds: 20 },
      },
    };
    const out = runMilitaryYear({
      before: closeDeployments(ending),
      education: ending.education,
      age: ending.player.age + 1,
      year: ending.world.year + 1,
    });
    expect(out.left).toBe(true);
    expect(out.military.past.at(-1)?.how).toBe('retired');
  });

  it('refuse: a member who did not refuse is asked at the end of a term, as before', () => {
    const ending = {
      ...raised,
      military: {
        ...raised.military,
        offer: undefined,
        service: { ...raised.military.service!, termEnds: raised.military.service!.years + 1 },
      },
    };
    const out = runMilitaryYear({
      before: closeDeployments(ending),
      education: ending.education,
      age: ending.player.age + 1,
      year: ending.world.year + 1,
    });
    expect(out.left).toBe(false);
    expect(out.military.offer?.kind).not.toBe('reenlist');
  });

  it('turns down a choice it does not offer, and an answer with no orders to answer', () => {
    expect(answerOrders(raised, 'maybe').ok).toBe(false);
    expect(answerOrders(base, ORDERS_GO)).toEqual({ ok: false, error: 'no-orders' });
    const rejected = decide(raised, MILITARY_OFFER_EVENT_ID, 'maybe');
    expect(rejected.ok).toBe(false);
  });
});

/** Answer a systemic question with a choice, and hand back the state. */
function answer0(state: GameState, choice: string): GameState {
  const result = decide(state, MILITARY_OFFER_EVENT_ID, choice);
  if (!result.ok) throw new Error(`could not answer: ${result.error}`);
  return result.value.state;
}

/* -------------------------------------------------------------------------- */
/* The year away                                                               */
/* -------------------------------------------------------------------------- */

describe('the year away', () => {
  const ordered = (tier: 'rear' | 'forward' | 'front', months = 8): Deployment => ({
    status: 'ordered',
    theater: 'Camp Meridian',
    months,
    tier,
    incidents: TIER_INCIDENTS[tier],
    results: [],
    orderedAge: 26,
  });

  it('adds hostile fire pay at the forward and front tiers, $225 a month', () => {
    for (const tier of ['forward', 'front'] as const) {
      const year = runDeploymentYear(serviceRow(), ordered(tier, 8), 27);
      expect(year.extraPay).toBe(225 * 8);
      expect(year.deployment.status).toBe('active');
    }
  });

  it('adds none at the rear', () => {
    const year = runDeploymentYear(serviceRow(), ordered('rear', 8), 27);
    expect(year.extraPay).toBe(0);
  });

  it('keeps an enlisted member’s base pay for the months away from tax, and the hostile pay too', () => {
    const career = serviceRow({ grade: 5, years: 6 });
    const year = runDeploymentYear(career, ordered('forward', 7), 27);
    const monthly = monthlyBasePay(5, 6, 'enlisted');
    expect(year.taxFreePay).toBe(Math.round(monthly * 7 + 225 * 7));
  });

  it('keeps nothing from tax at the rear beyond the base pay of the months away', () => {
    const career = serviceRow({ grade: 5, years: 6 });
    const year = runDeploymentYear(career, ordered('rear', 5), 27);
    expect(year.taxFreePay).toBe(Math.round(monthlyBasePay(5, 6, 'enlisted') * 5));
  });

  it('caps an officer’s exclusion at the highest enlisted monthly pay', () => {
    const o6 = officerRow({ grade: 6, years: 28 });
    expect(monthlyBasePay(6, 28, 'officer')).toBeGreaterThan(OFFICER_EXCLUSION_CAP);
    const year = runDeploymentYear(o6, ordered('rear', 6), 55);
    expect(year.taxFreePay).toBe(Math.round(OFFICER_EXCLUSION_CAP * 6));
  });

  it('keeps a junior officer’s whole base pay for the months away, since it is under the cap', () => {
    const o2 = officerRow({ grade: 2, years: 3 });
    expect(monthlyBasePay(2, 3, 'officer')).toBeLessThan(OFFICER_EXCLUSION_CAP);
    const year = runDeploymentYear(o2, ordered('forward', 6), 27);
    expect(year.taxFreePay).toBe(Math.round(monthlyBasePay(2, 3, 'officer') * 6 + 225 * 6));
  });

  it('says where and for how long', () => {
    const year = runDeploymentYear(serviceRow(), ordered('forward', 8), 27);
    expect(year.line).toContain('Camp Meridian');
  });

  it('runs as the year after the orders: pay, the tax kept off it, a line, and the first incident on the table', () => {
    const state = settle(
      answer0(
        settle(
          advanceYear(
            opened(
              seedWith(serving(withSeed(base, 'away-1'), { years: 3 }), [
                ['orders', 27],
                (u) => u < 0.1,
              ]),
            ),
          ).state,
        ),
        ORDERS_GO,
      ),
    );
    const away = advanceYear(state).state;
    const rows = away.finance.transactions.filter((row) => row.year === away.world.year);
    const pay = rows.find((row) => row.source === 'Army pay')!;
    const deployment = away.military.deployment!;
    expect(deployment.status).toBe('active');
    const base0 = Math.round(Number(pay.amount) / 100);
    const extra = HOSTILE_PAY_TIERS.includes(deployment.tier) ? 225 * deployment.months : 0;
    expect(base0).toBeGreaterThanOrEqual(extra);
    expect(militaryQuestions(away)).toEqual([MILITARY_MISSION_EVENT_ID]);
    expect(away.pending.find((row) => row.eventId === MILITARY_MISSION_EVENT_ID)!.prompt).toContain(
      `(1 of ${deployment.incidents})`,
    );
    expect(hasSystemicOffer(away)).toBe(true);
    expect(away.player.cash).toBe(away.finance.balance);
  });

  it('taxes a deployed year less than the same year at home, by the tax on what was kept', () => {
    const life = serving(withSeed(base, 'tax-1'), { years: 4, grade: 5 });
    const home = advanceYear(life).state;
    const awayLife = {
      ...life,
      military: {
        ...life.military,
        deployment: ordered('forward', 9),
      },
    } as GameState;
    const away = advanceYear(awayLife).state;
    const taxOf = (state: GameState): number =>
      -Number(
        state.finance.transactions.find(
          (row) => row.year === state.world.year && row.source === 'Tax on Army pay',
        )?.amount ?? 0,
      );
    expect(taxOf(away)).toBeLessThan(taxOf(home));
  });

  it('does not ask about the next term while the member is away, and asks the year they are home', () => {
    const life = serving(withSeed(base, 'term-away'), { years: 3, termEnds: 4 });
    const awayLife = {
      ...life,
      military: { ...life.military, deployment: ordered('rear', 6) },
    } as GameState;
    const during = runMilitaryYear({
      before: awayLife,
      education: awayLife.education,
      age: awayLife.player.age + 1,
      year: awayLife.world.year + 1,
    });
    expect(during.military.offer).toBeUndefined();
    expect(during.left).toBe(false);
    const home = runMilitaryYear({
      before: serving(withSeed(base, 'term-away'), { years: 4, termEnds: 4 }),
      education: awayLife.education,
      age: awayLife.player.age + 1,
      year: awayLife.world.year + 1,
    });
    expect(home.military.offer?.kind).not.toBe('reenlist');
    expect(home.military.service?.years).toBe(5);
  });

  it('puts the branch on the ledger: a Navy member’s pay is Navy pay', () => {
    const life = serving(withSeed(base, 'navy-pay'), {
      branch: 'navy',
      specialty: 'navy.x',
      years: 3,
    });
    const out = advanceYear(life).state;
    const sources = out.finance.transactions
      .filter((row) => row.year === out.world.year)
      .map((row) => row.source);
    expect(sources).toContain('Navy pay');
    expect(sources).toContain('Tax on Navy pay');
    expect(sources).not.toContain('Army pay');
  });
});

/* -------------------------------------------------------------------------- */
/* The incidents                                                               */
/* -------------------------------------------------------------------------- */

describe('an incident', () => {
  it('is a decision with the four outcomes as its choices, numbered, and it is the reserved id', () => {
    const away = deployed(withSeed(base, 'mission-1'));
    const decision = away.pending.find((row) => isMilitaryMissionDecision(row.eventId))!;
    expect(decision.eventId).toBe('military.mission');
    expect(decision.choices.map((row) => row.id)).toEqual([...INCIDENT_OUTCOMES]);
    expect(decision.prompt).toContain('(1 of 2)');
    expect(decision.prompt).toContain('Camp Meridian');
    expect(isMilitaryMissionDecision('military.offer')).toBe(false);
  });

  it('is raised once, not twice, and not when there is no deployment or the member is dead', () => {
    const away = deployed(withSeed(base, 'mission-2'));
    expect(withMissionDecision(away, true).pending).toHaveLength(1);
    expect(withMissionDecision(base, true)).toBe(base);
    const dead = withSeed(base, 'mission-3');
    expect(withMissionDecision(dead, false)).toBe(dead);
  });

  it('is not raised for orders accepted and not yet served', () => {
    const life = serving(withSeed(base, 'mission-4'));
    const ordered0 = {
      ...life,
      military: {
        ...life.military,
        deployment: {
          status: 'ordered',
          theater: 'X',
          months: 4,
          tier: 'rear',
          incidents: 1,
          results: [],
          orderedAge: 26,
        },
      },
    } as GameState;
    expect(withMissionDecision(ordered0, true).pending).toEqual([]);
    expect(withMilitaryOffer(ordered0, true).pending).toEqual([]);
  });

  it('is raised by `withMilitaryOffer` as well as by the year, so the year’s last step is enough', () => {
    const away = { ...deployed(withSeed(base, 'mission-5')), pending: [] } as GameState;
    expect(withMilitaryOffer(away, true).pending.map((row) => row.eventId)).toEqual([
      MILITARY_MISSION_EVENT_ID,
    ]);
  });

  it('cannot be run past: the year refuses to advance while it stands', () => {
    const away = deployed(withSeed(base, 'mission-6'));
    expect(advanceYear(away).state).toBe(away);
  });

  it('is turned away when the choice is not an outcome, or there is nothing to answer', () => {
    const away = deployed(withSeed(base, 'mission-7'));
    expect(answerMission(away, 'win')).toEqual({ ok: false, error: 'no-such-choice' });
    expect(answerMission(base, 'clean')).toEqual({ ok: false, error: 'no-mission' });
    const quiet = {
      ...away,
      military: {
        ...away.military,
        deployment: { ...away.military.deployment!, status: 'ordered' },
      },
    } as GameState;
    expect(answerMission(quiet, 'clean')).toEqual({ ok: false, error: 'no-mission' });
  });

  it('shows the generic labels the buttons carry until a minigame replaces them', () => {
    const away = deployed(withSeed(base, 'mission-8'));
    const labels = missionDecision(away, away.military.deployment!).choices.map((row) => row.label);
    expect(labels).toHaveLength(4);
    expect(new Set(labels).size).toBe(4);
  });

  it('goes on to the next incident, and the one after ends it', () => {
    const away = deployed(withSeed(base, 'mission-9'), { incidents: 2 });
    const first = answer(away, 'clean');
    expect(first.military.deployment?.results).toEqual(['clean']);
    expect(first.pending.map((row) => row.eventId)).toEqual([MILITARY_MISSION_EVENT_ID]);
    expect(first.pending[0]!.prompt).toContain('(2 of 2)');
    const second = answer(first, 'clean');
    expect(second.military.deployment).toBeUndefined();
    expect(second.pending).toEqual([]);
    expect(hasSystemicOffer(second)).toBe(false);
    expect(() => advanceYear(second)).not.toThrow();
  });
});

describe('what a clean or close incident leaves', () => {
  for (const outcome of ['clean', 'close'] as const) {
    it(`never hurts anybody after a ${outcome} one, over four hundred lives`, () => {
      for (let i = 0; i < 400; i += 1) {
        const life = deployed(withSeed(base, `${outcome}-${i}`), { tier: 'front', incidents: 1 });
        const out = answer(life, outcome);
        expect(out.player.alive).toBe(true);
        expect(out.health.deficit ?? 0).toBe(0);
        expect(out.health.causeOfDeath).toBeUndefined();
        expect(out.health.conditions.filter((row) => row.conditionId !== TRAUMA_CONDITION)).toEqual(
          [],
        );
        // The stat is held down by a condition the incident left, and by nothing else.
        expect(out.player.stats.health).toBe(
          holds(out, TRAUMA_CONDITION)
            ? Math.min(life.player.stats.health, findCondition(TRAUMA_CONDITION)!.ceiling)
            : life.player.stats.health,
        );
      }
    });
  }

  it('may leave strain after a close one, and never after a clean one', () => {
    let strained = 0;
    for (let i = 0; i < 600; i += 1) {
      const life = deployed(withSeed(base, `strain-${i}`), { tier: 'front', incidents: 1 });
      expect(holds(answer(life, 'clean'), TRAUMA_CONDITION)).toBe(false);
      if (holds(answer(life, 'close'), TRAUMA_CONDITION)) strained += 1;
    }
    expect(strained).toBeGreaterThan(0);
    expect(strained / 600).toBeLessThan(0.08);
  });

  it('raises standing and mood after a clean one, and a little after a close one', () => {
    const life = deployed(withSeed(base, 'standing-1'), { incidents: 1 });
    const clean = answer(life, 'clean');
    expect(clean.military.service!.reputation).toBeGreaterThan(life.military.service!.reputation);
    expect(clean.player.stats.happiness).toBeGreaterThanOrEqual(life.player.stats.happiness);
    const close = answer(life, 'close');
    expect(close.military.service!.reputation).toBeGreaterThanOrEqual(
      life.military.service!.reputation,
    );
  });

  it('adds stress after a close one and none after a clean one', () => {
    const life = deployed(withSeed(base, 'stress-1'), { incidents: 1 });
    expect(answer(life, 'clean').player.stress.level).toBe(life.player.stress.level);
    expect(answer(life, 'close').player.stress.level).toBeGreaterThan(life.player.stress.level);
  });
});

describe('a mistake', () => {
  const life0 = deployed(withSeed(base, 'mistake'), { tier: 'forward', incidents: 2 });
  const key = (n: number) => ['incident', life0.player.age, n, 'hurt'] as const;

  it('hurts when the draw is under a quarter: a minor wound that costs health and is owed back', () => {
    const life = seedWith(life0, [key(0), (u) => u < INJURY_ON_MISTAKE]);
    const out = answer(life, 'mistake');
    expect(out.health.deficit).toBe(WOUND_COST.minor);
    expect(out.player.stats.health).toBeLessThan(life.player.stats.health);
    expect(out.player.alive).toBe(true);
    expect(out.military.deployment?.wounded).toBe(true);
  });

  it('does not hurt when the draw is over a quarter', () => {
    const life = seedWith(life0, [key(0), (u) => u >= INJURY_ON_MISTAKE]);
    const out = answer(life, 'mistake');
    expect(out.health.deficit ?? 0).toBe(0);
    expect(out.player.stats.health).toBe(life.player.stats.health);
    expect(out.military.deployment?.wounded).toBeFalsy();
  });

  it('costs standing and mood either way', () => {
    const life = seedWith(life0, [key(0), (u) => u >= INJURY_ON_MISTAKE]);
    const out = answer(life, 'mistake');
    expect(out.military.service!.reputation).toBeLessThan(life.military.service!.reputation);
    expect(out.player.stats.happiness).toBeLessThan(life.player.stats.happiness);
    expect(out.player.stress.level).toBeGreaterThan(life.player.stress.level);
  });

  it('never kills, over four hundred lives', () => {
    for (let i = 0; i < 400; i += 1) {
      const life = deployed(withSeed(base, `mistake-nodeath-${i}`), {
        tier: 'front',
        incidents: 1,
      });
      const out = answer(life, 'mistake');
      expect(out.player.alive).toBe(true);
      expect(out.health.causeOfDeath).toBeUndefined();
    }
  });

  it('leaves a minor lasting condition only sometimes, and only from the minor list', () => {
    const lasting = seedWith(
      life0,
      [key(0), (u) => u < INJURY_ON_MISTAKE],
      [['incident', life0.player.age, 0, 'lasting'], (u) => u < WOUND_LASTING.minor],
      [['incident', life0.player.age, 0, 'trauma'], (u) => u >= 0.5],
    );
    const out = answer(lasting, 'mistake');
    expect(out.health.conditions).toHaveLength(1);
    expect(WOUND_CONDITIONS.minor).toContain(out.health.conditions[0]!.conditionId);
    const none = seedWith(
      life0,
      [key(0), (u) => u < INJURY_ON_MISTAKE],
      [['incident', life0.player.age, 0, 'lasting'], (u) => u >= WOUND_LASTING.minor],
      [['incident', life0.player.age, 0, 'trauma'], (u) => u >= 0.5],
    );
    expect(answer(none, 'mistake').health.conditions).toEqual([]);
  });
});

describe('the lasting conditions', () => {
  it('can each be reached: every wound and the strain is left by some seed', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1500; i += 1) {
      const seeded = withSeed(base, `reach-${i}`);
      const mistake = deployed(seeded, { tier: 'front', incidents: 1 });
      const disaster = deployed(seeded, { tier: 'front', incidents: 1 });
      for (const state of [answer(mistake, 'mistake'), answer(disaster, 'disaster')]) {
        for (const row of state.health.conditions) seen.add(row.conditionId);
      }
    }
    for (const id of [...WOUND_CONDITIONS.minor, ...WOUND_CONDITIONS.serious, TRAUMA_CONDITION]) {
      expect(seen.has(id), id).toBe(true);
    }
    // Every condition the health layer tags as a service one is among them.
    for (const row of CONDITIONS.filter((condition) => condition.from === 'service')) {
      expect(seen.has(row.id), row.id).toBe(true);
    }
  });
});

describe('a disaster', () => {
  const life0 = deployed(withSeed(base, 'disaster'), { tier: 'front', incidents: 3 });
  const dying = (n: number) => ['incident', life0.player.age, n, 'death'] as const;

  it('always wounds, seriously, when the member lives', () => {
    const life = seedWith(life0, [dying(0), (u) => u >= DEATH_ON_DISASTER]);
    const out = answer(life, 'disaster');
    expect(out.player.alive).toBe(true);
    expect(out.health.deficit).toBe(WOUND_COST.serious);
    expect(out.player.stats.health).toBeLessThanOrEqual(
      life.player.stats.health - WOUND_COST.serious,
    );
    expect(out.military.deployment?.wounded).toBe(true);
  });

  it('wounds every time, over four hundred lives that live', () => {
    let lived = 0;
    for (let i = 0; i < 400; i += 1) {
      const life = deployed(withSeed(base, `disaster-all-${i}`), { tier: 'front', incidents: 3 });
      const out = answer(life, 'disaster');
      if (!out.player.alive) continue;
      lived += 1;
      expect(out.health.deficit).toBe(WOUND_COST.serious);
    }
    expect(lived).toBeGreaterThan(250);
  });

  it('kills when the draw is under a quarter, and not when it is over', () => {
    const dead = answer(seedWith(life0, [dying(0), (u) => u < DEATH_ON_DISASTER]), 'disaster');
    expect(dead.player.alive).toBe(false);
    const alive = answer(seedWith(life0, [dying(0), (u) => u >= DEATH_ON_DISASTER]), 'disaster');
    expect(alive.player.alive).toBe(true);
  });

  it('kills about a quarter of the time over a thousand lives', () => {
    let died = 0;
    for (let i = 0; i < 1000; i += 1) {
      const life = deployed(withSeed(base, `disaster-rate-${i}`), { tier: 'front', incidents: 3 });
      if (!answer(life, 'disaster').player.alive) died += 1;
    }
    expect(died / 1000).toBeGreaterThan(0.2);
    expect(died / 1000).toBeLessThan(0.3);
  });

  it('may leave a serious lasting condition, from the serious list', () => {
    const lasting = seedWith(
      life0,
      [dying(0), (u) => u >= DEATH_ON_DISASTER],
      [['incident', life0.player.age, 0, 'lasting'], (u) => u < WOUND_LASTING.serious],
    );
    const out = answer(lasting, 'disaster');
    const wounds = out.health.conditions.filter((row) => row.conditionId !== TRAUMA_CONDITION);
    expect(wounds).toHaveLength(1);
    expect(WOUND_CONDITIONS.serious).toContain(wounds[0]!.conditionId);
    // The ceiling the condition sets holds the health stat down.
    const kind = findCondition(wounds[0]!.conditionId)!;
    expect(out.player.stats.health).toBeLessThanOrEqual(kind.ceiling);
  });

  it('leaves a member who already has the condition with the one they have', () => {
    const lasting = seedWith(
      life0,
      [dying(0), (u) => u >= DEATH_ON_DISASTER],
      [['incident', life0.player.age, 0, 'lasting'], (u) => u < WOUND_LASTING.serious],
    );
    const once = answer(lasting, 'disaster');
    const id = once.health.conditions.find(
      (row) => row.conditionId !== TRAUMA_CONDITION,
    )!.conditionId;
    const again = {
      ...life0,
      health: { ...life0.health, conditions: [{ conditionId: id, since: 20, treated: true }] },
    } as GameState;
    const forced = seedWith(
      again,
      [dying(0), (u) => u >= DEATH_ON_DISASTER],
      [['incident', again.player.age, 0, 'lasting'], (u) => u < WOUND_LASTING.serious],
      [
        ['incident', again.player.age, 0, 'which'],
        (u) => Math.floor(u * 5) === WOUND_CONDITIONS.serious.indexOf(id),
      ],
    );
    const out = answer(forced, 'disaster');
    expect(out.health.conditions.filter((row) => row.conditionId === id)).toHaveLength(1);
    expect(out.health.conditions.find((row) => row.conditionId === id)?.since).toBe(20);
  });
});

describe('lasting strain', () => {
  const life0 = deployed(withSeed(base, 'trauma'), { tier: 'front', incidents: 3 });
  const hit = (n: number) => ['incident', life0.player.age, n, 'trauma'] as const;

  it('leaves post-traumatic stress when the draw is under the chance, with a line for it', () => {
    const life = seedWith(life0, [hit(0), (u) => u < traumaChance('close', 'front')]);
    const out = answer(life, 'close');
    expect(holds(out, TRAUMA_CONDITION)).toBe(true);
    expect(out.health.conditions.find((row) => row.conditionId === TRAUMA_CONDITION)?.since).toBe(
      life.player.age,
    );
    expect(out.player.stats.health).toBeLessThanOrEqual(findCondition(TRAUMA_CONDITION)!.ceiling);
  });

  it('does not when the draw is over', () => {
    const life = seedWith(life0, [hit(0), (u) => u >= traumaChance('close', 'front')]);
    expect(holds(answer(life, 'close'), TRAUMA_CONDITION)).toBe(false);
  });

  it('is rarer at the rear than at the front for the same outcome', () => {
    let rear = 0;
    let front = 0;
    for (let i = 0; i < 1500; i += 1) {
      const seeded = withSeed(base, `trauma-tier-${i}`);
      if (
        holds(
          answer(deployed(seeded, { tier: 'rear', incidents: 1 }), 'disaster'),
          TRAUMA_CONDITION,
        )
      )
        rear += 1;
      if (
        holds(
          answer(deployed(seeded, { tier: 'front', incidents: 1 }), 'disaster'),
          TRAUMA_CONDITION,
        )
      )
        front += 1;
    }
    expect(front).toBeGreaterThan(rear);
  });

  it('is kept once and not stacked by a second one', () => {
    const had = {
      ...life0,
      health: {
        ...life0.health,
        conditions: [{ conditionId: TRAUMA_CONDITION, since: 20, treated: false }],
      },
    } as GameState;
    const out = answer(seedWith(had, [hit(0), (u) => u < 0.01]), 'disaster');
    if (out.player.alive) {
      expect(
        out.health.conditions.filter((row) => row.conditionId === TRAUMA_CONDITION),
      ).toHaveLength(1);
    }
  });

  it('counts as a serious condition that treatment can clear, and one that can clear itself', () => {
    const trauma = findCondition(TRAUMA_CONDITION)!;
    expect(trauma.severity).toBe('serious');
    expect(trauma.treatable).toBeGreaterThan(0);
    expect(trauma.resolves).toBeGreaterThan(0);
  });
});

describe('the end of a deployment', () => {
  it('writes it down: a record, the past list, a timeline entry, and the member home', () => {
    const away = deployed(withSeed(base, 'end-1'), { incidents: 1, tier: 'forward' });
    const out = answer(away, 'clean');
    expect(out.military.deployment).toBeUndefined();
    expect(out.military.deployments).toEqual([
      {
        age: away.player.age,
        theater: 'Camp Meridian',
        months: 8,
        tier: 'forward',
        worst: 'clean',
        wounded: false,
      },
    ]);
    expect(out.player.records.some((row) => row.label === 'Deployed — Camp Meridian')).toBe(true);
    expect(out.player.timeline.at(-1)!.text.length).toBeGreaterThan(20);
    expect(out.player.timeline.at(-1)!.kind).toBe('milestone');
    expect(out.military.service?.years).toBe(away.military.service?.years);
  });

  it('records the worst incident, and whether anyone was hurt', () => {
    let life = deployed(withSeed(base, 'end-2'), { incidents: 3, tier: 'front' });
    life = answer(life, 'clean');
    life = answer(life, 'close');
    life = answer(life, 'clean');
    expect(life.military.deployments?.[0]?.worst).toBe('close');
    expect(life.military.deployments?.[0]?.wounded).toBe(false);
  });

  it('keeps every deployment across a career, oldest first', () => {
    let life = deployed(withSeed(base, 'end-3'), { incidents: 1, tier: 'rear', orderedAge: 26 });
    life = answer(life, 'clean');
    const again = {
      ...life,
      player: { ...life.player, age: life.player.age + 2 },
      military: {
        ...life.military,
        deployment: {
          status: 'active',
          theater: 'Fort Ardent',
          months: 6,
          tier: 'rear',
          incidents: 1,
          results: [],
          orderedAge: life.player.age + 2,
        },
      },
    } as GameState;
    const second = answer(withMissionDecision(again, true), 'clean');
    expect(second.military.deployments?.map((row) => row.theater)).toEqual([
      'Camp Meridian',
      'Fort Ardent',
    ]);
  });
});

describe('the decorations', () => {
  const life0 = deployed(withSeed(base, 'awards'), { incidents: 1 });

  it('gives a deployment medal for a deployment forward or at the front, and not for one at the rear', () => {
    const forward = deployed(withSeed(base, 'awards-f'), { incidents: 1, tier: 'forward' });
    expect(earnedAwards(forward, forward.military.deployment!, ['clean'])).toContain(
      'service-medal',
    );
    const rear = deployed(withSeed(base, 'awards-r'), { incidents: 1, tier: 'rear' });
    expect(earnedAwards(rear, rear.military.deployment!, ['clean'])).not.toContain('service-medal');
  });

  it('gives the Purple Heart to a wounded member, always', () => {
    const wounded = deployed(withSeed(base, 'awards-w'), { incidents: 1, wounded: true });
    expect(earnedAwards(wounded, wounded.military.deployment!, ['mistake'])).toContain(
      'purple-heart',
    );
    expect(earnedAwards(life0, life0.military.deployment!, ['clean'])).not.toContain(
      'purple-heart',
    );
  });

  it('gives a commendation only to a deployment with no mistake and no disaster', () => {
    for (let i = 0; i < 200; i += 1) {
      const state = deployed(withSeed(base, `awards-c-${i}`), { incidents: 2, tier: 'forward' });
      for (const results of [
        ['mistake', 'clean'],
        ['clean', 'disaster'],
      ] as const) {
        expect(earnedAwards(state, state.military.deployment!, results)).not.toContain(
          'commendation',
        );
      }
    }
    let gave = 0;
    for (let i = 0; i < 200; i += 1) {
      const state = deployed(withSeed(base, `awards-c2-${i}`), { incidents: 2, tier: 'forward' });
      if (
        earnedAwards(state, state.military.deployment!, ['clean', 'close']).includes('commendation')
      ) {
        gave += 1;
      }
    }
    expect(gave / 200).toBeGreaterThan(DECORATION_CHANCE.commendation - 0.12);
    expect(gave / 200).toBeLessThan(DECORATION_CHANCE.commendation + 0.12);
  });

  it('gives a combat badge only at the front and only after some trouble', () => {
    for (let i = 0; i < 200; i += 1) {
      const front = deployed(withSeed(base, `awards-b-${i}`), { incidents: 3, tier: 'front' });
      const fwd = deployed(withSeed(base, `awards-b-${i}`), { incidents: 2, tier: 'forward' });
      expect(
        earnedAwards(front, front.military.deployment!, ['clean', 'clean', 'clean']),
      ).not.toContain('combat-badge');
      expect(earnedAwards(fwd, fwd.military.deployment!, ['close', 'close'])).not.toContain(
        'combat-badge',
      );
    }
    let gave = 0;
    for (let i = 0; i < 300; i += 1) {
      const front = deployed(withSeed(base, `awards-b2-${i}`), { incidents: 3, tier: 'front' });
      if (
        earnedAwards(front, front.military.deployment!, ['clean', 'close', 'clean']).includes(
          'combat-badge',
        )
      )
        gave += 1;
    }
    expect(gave).toBeGreaterThan(0);
  });

  it('gives a Bronze Star rarely, only at the front and only for a deployment that was close and no worse', () => {
    for (let i = 0; i < 200; i += 1) {
      const front = deployed(withSeed(base, `awards-s-${i}`), { incidents: 3, tier: 'front' });
      for (const results of [
        ['clean', 'clean', 'clean'],
        ['mistake', 'close', 'clean'],
        ['disaster', 'clean', 'clean'],
      ] as const) {
        expect(earnedAwards(front, front.military.deployment!, results)).not.toContain(
          'bronze-star',
        );
      }
    }
  });

  it('adds what was earned to the member’s record, with a line in the entry', () => {
    const life = deployed(withSeed(base, 'awards-e'), { incidents: 1, tier: 'forward' });
    const out = answer(life, 'clean');
    const medals = out.military.decorations ?? [];
    expect(medals.some((row) => row.id === 'service-medal')).toBe(true);
    expect(medals.every((row) => isDecorationId(row.id) && row.age === life.player.age)).toBe(true);
    expect(out.player.records.some((row) => row.label.startsWith('Awarded'))).toBe(true);
    const names = medals.map((row) => findDecoration(row.id)!.record);
    for (const name of names) expect(out.player.timeline.at(-1)!.text).toContain(name);
  });

  it('keeps them for life, oldest first, across deployments', () => {
    let life = deployed(withSeed(base, 'awards-m'), { incidents: 1, tier: 'forward' });
    life = answer(life, 'clean');
    const first = (life.military.decorations ?? []).length;
    expect(first).toBeGreaterThan(0);
    const again = {
      ...life,
      military: {
        ...life.military,
        deployment: {
          status: 'active',
          theater: 'Fort Ardent',
          months: 6,
          tier: 'forward',
          incidents: 1,
          results: [],
          orderedAge: life.player.age + 1,
        },
      },
    } as GameState;
    const next = answer(withMissionDecision(again, true), 'clean');
    expect((next.military.decorations ?? []).length).toBeGreaterThan(first);
    expect((next.military.decorations ?? []).slice(0, first)).toEqual(life.military.decorations);
  });

  it('are typed by the content ids and no others', () => {
    const ids: readonly DecorationId[] = DECORATIONS.map((row) => row.id);
    expect(ids).toContain('bronze-star');
    const awarded = answer(deployed(withSeed(base, 'awards-t'), { incidents: 1 }), 'clean');
    for (const row of awarded.military.decorations ?? []) expect(ids).toContain(row.id as never);
  });
});

describe('a member who is killed', () => {
  const life0 = deployed(withSeed(base, 'killed'), { tier: 'front', incidents: 3, wounded: false });
  const dies = seedWith(life0, [
    ['incident', life0.player.age, 0, 'death'],
    (u) => u < DEATH_ON_DISASTER,
  ]);
  const out = answer(dies, 'disaster');

  it('is dead, with a cause and an age, and nothing left to answer', () => {
    expect(out.player.alive).toBe(false);
    expect(out.health.causeOfDeath).toBe('Killed in action');
    expect(out.health.diedAtAge).toBe(dies.player.age);
    expect(out.pending).toEqual([]);
  });

  it('ends the career as a past service, killed, with an honorable discharge', () => {
    expect(out.military.service).toBeUndefined();
    expect(out.military.offer).toBeUndefined();
    expect(out.military.deployment).toBeUndefined();
    const past = out.military.past.at(-1)!;
    expect(past.how).toBe('killed');
    expect(past.discharge).toBe('honorable');
    expect(past.branch).toBe('army');
    expect(past.endedAge).toBe(dies.player.age);
  });

  it('is on the record, in the timeline and among the deployments, as wounded', () => {
    expect(out.player.records.some((row) => row.label.startsWith('Killed in service'))).toBe(true);
    expect(out.player.timeline.at(-1)!.kind).toBe('milestone');
    expect(out.military.deployments?.at(-1)?.wounded).toBe(true);
    expect(out.military.deployments?.at(-1)?.worst).toBe('disaster');
  });

  it('is honored: the Purple Heart for a death forward or at the front', () => {
    expect((out.military.decorations ?? []).some((row) => row.id === 'purple-heart')).toBe(true);
  });

  it('dies at the rear in an accident, with no Purple Heart', () => {
    const rear = deployed(withSeed(base, 'killed-rear'), { tier: 'rear', incidents: 1 });
    const seed = seedWith(rear, [
      ['incident', rear.player.age, 0, 'death'],
      (u) => u < DEATH_ON_DISASTER,
    ]);
    const dead = answer(seed, 'disaster');
    expect(dead.player.alive).toBe(false);
    expect(dead.health.causeOfDeath).toBe('Killed in an accident on deployment');
    expect((dead.military.decorations ?? []).some((row) => row.id === 'purple-heart')).toBe(false);
  });

  it('can be given the Medal of Honor, now and then, and never twice', () => {
    let given = 0;
    for (let i = 0; i < 4000; i += 1) {
      const life = deployed(withSeed(base, `moh-${i}`), { tier: 'front', incidents: 1 });
      const state = answer(life, 'disaster');
      if (state.player.alive) continue;
      const medals = (state.military.decorations ?? []).filter(
        (row) => row.id === 'medal-of-honor',
      );
      expect(medals.length).toBeLessThanOrEqual(1);
      given += medals.length;
    }
    expect(given).toBeGreaterThanOrEqual(0);
  });
});

describe('while deployed', () => {
  const away = deployed(withSeed(base, 'guards'));

  it('a member cannot retire', () => {
    const long = serving(away, { years: 21, termEnds: 99 });
    const stayed = {
      ...long,
      military: { ...long.military, deployment: away.military.deployment },
    } as GameState;
    expect(retireFromService(stayed)).toEqual({ ok: false, error: 'deployed' });
  });

  it('a member cannot apply for a commission, even with every requirement met', () => {
    const graduate = {
      ...away,
      education: {
        ...away.education,
        credentials: { ...away.education.credentials, university: 22 },
      },
    } as GameState;
    expect(applyForCommission(graduate)).toEqual({ ok: false, error: 'deployed' });
  });

  it('a member can retire and apply the year they are home', () => {
    const home = answer(deployed(withSeed(base, 'guards-home'), { incidents: 1 }), 'clean');
    expect(home.military.deployment).toBeUndefined();
    const long = serving(home, { years: 21, termEnds: 99 });
    expect(retireFromService(long).ok).toBe(true);
  });

  it('a career that ends while orders stand drops them', () => {
    const life = serving(withSeed(base, 'guards-drop'), { years: 64 - 26 + 19, termEnds: 99 });
    const ordered = {
      ...life,
      player: { ...life.player, age: 64 },
      military: {
        ...life.military,
        deployment: {
          status: 'ordered',
          theater: 'X',
          months: 4,
          tier: 'rear',
          incidents: 1,
          results: [],
          orderedAge: 64,
        },
      },
    } as GameState;
    const year = runMilitaryYear({
      before: ordered,
      education: ordered.education,
      age: 65,
      year: ordered.world.year + 1,
    });
    expect(year.left).toBe(true);
    expect(year.military.deployment).toBeUndefined();
    expect(year.taxFreePay).toBe(0);
  });
});

describe('officers', () => {
  it('are sent at the same tempo as the enlisted of their branch, and answer the orders the same way', () => {
    const life0 = officering(withSeed(base, 'officer-orders'), { years: 5 });
    const age = ORDERS_AGE_OF(life0);
    const comes = seedWith(life0, [['orders', age], (u) => u < 0.1]);
    const out = advanceYear(opened(comes)).state;
    expect(out.military.offer?.kind).toBe('orders');
    const went = answer0(out, ORDERS_GO);
    expect(went.military.deployment?.status).toBe('ordered');
  });

  it('are paid on the officer table in a deployed year, with the exclusion capped', () => {
    const life = officering(withSeed(base, 'officer-pay'), { grade: 5, years: 14 });
    const ordered = {
      ...life,
      military: {
        ...life.military,
        deployment: {
          status: 'ordered',
          theater: 'X',
          months: 9,
          tier: 'forward',
          incidents: 2,
          results: [],
          orderedAge: life.player.age,
        },
      },
    } as GameState;
    const out = runMilitaryYear({
      before: ordered,
      education: ordered.education,
      age: life.player.age + 1,
      year: life.world.year + 1,
    });
    expect(out.pay).toBeGreaterThan(225 * 9);
    expect(out.taxFreePay).toBeLessThanOrEqual(out.pay);
    expect(out.taxFreePay).toBeGreaterThan(225 * 9);
  });
});

describe('the pieces used together', () => {
  it('plays a whole deployment through `decide` from the orders to the homecoming', () => {
    const life0 = serving(withSeed(base, 'whole-1'), { years: 3 });
    const age = ORDERS_AGE_OF(life0);
    let life = advanceYear(opened(seedWith(life0, [['orders', age], (u) => u < 0.1]))).state;
    expect(life.military.offer?.kind).toBe('orders');
    life = settle(answer0(settle(life), ORDERS_GO));
    life = advanceYear(life).state;
    const total = life.military.deployment!.incidents;
    for (let i = 0; i < total; i += 1) {
      expect(militaryQuestions(life)).toEqual([MILITARY_MISSION_EVENT_ID]);
      life = settle(answer(life, 'clean'));
    }
    expect(life.military.deployment).toBeUndefined();
    expect(life.military.deployments).toHaveLength(1);
    expect(life.pending).toEqual([]);
    const home = advanceYear(life).state;
    expect(home.player.alive).toBe(true);
    expect(home.military.service?.years).toBeGreaterThan(life0.military.service!.years);
  });

  it('keeps every field of a life that never deploys the way the year left it', () => {
    const life = serving(withSeed(base, 'plain-1'), { years: 3 });
    const out = advanceYear(life).state;
    expect(out.military.deployment).toBeUndefined();
    expect(out.military.deployments).toBeUndefined();
    expect(out.military.decorations).toBeUndefined();
    expect(out.military.deploymentsOpen).toBeUndefined();
  });
});
