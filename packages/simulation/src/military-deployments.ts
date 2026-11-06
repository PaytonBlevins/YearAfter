/**
 * Ticket 0903 — deployments.
 *
 * The orders, the year away, the incidents and what they leave behind. The table and the dials are in `@yearafter/content`'s
 * `military-deployments.ts`; this file draws from them and applies the result.
 *
 * A deployment waits for a minigame. Nothing in the game plays one yet, so `military.deploymentsOpen` is off in every
 * life and no orders are raised: a life played through the harness never deploys, and nothing stands in for the missing
 * result. When the minigame exists, whatever builds it calls `openDeployments`, and its answer to each incident goes in
 * through `decide` as one of the four outcomes, exactly as a button would.
 *
 * Every draw is a hash of the seed, the generation and a name, so no random stream is touched and a life that never
 * deploys replays as it did. A leaf with no imports from `military.ts`, which imports it.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  nudgeStats,
  stampRecord,
  type NewLifeRecord,
  type TimelineEntry,
} from '@yearafter/character';
import {
  DECORATION_CHANCE,
  AWARD_LINES,
  DANGER_TEMPO,
  DEATH_CAUSES,
  DEATH_LINES,
  DEATH_ON_DISASTER,
  DEPLOYED_LINES,
  DEPLOY_MIN_YEARS,
  HOMECOMING_LINES,
  HOSTILE_PAY_MONTHLY,
  HOSTILE_PAY_TIERS,
  INCIDENT_MOOD,
  INCIDENT_OUTCOMES,
  INCIDENT_REPUTATION,
  INCIDENT_STRESS,
  INJURY_ON_MISTAKE,
  MISSION_PROMPTS,
  OUTCOME_LABELS,
  OUTCOME_LINES,
  ORDERS_ACCEPTED,
  ORDERS_PROMPTS,
  ORDERS_REFUSED,
  ORDERS_TIER_LINES,
  POSTHUMOUS_BRONZE_STAR,
  REFUSE_MOOD,
  REFUSE_PERFORMANCE,
  REFUSE_REPUTATION,
  THEATERS,
  TIER_INCIDENTS,
  TRAUMA_CONDITION,
  TRAUMA_LINES,
  WOUND_CONDITIONS,
  WOUND_COST,
  WOUND_LASTING,
  WOUND_LINES,
  deploymentMonths,
  deploymentTier,
  findDecoration,
  findSpecialty,
  monthlyBasePay,
  ordersChance,
  traumaChance,
  type DecorationId,
  type IncidentOutcome,
} from '@yearafter/content';
import { clampStat, mixedUnit, ok, err, stablePick, type Result } from '@yearafter/core';
import type { PendingDecision } from '@yearafter/events';
import { ceilingWith, type HeldCondition } from '@yearafter/health';
import { applyImmediateStress } from '@yearafter/stress';
import type { GameState } from './game-state';
import type {
  Deployment,
  DeploymentOutcome,
  MilitaryOffer,
  MilitaryState,
  PastDeployment,
  PastService,
  ServiceCareer,
} from './military-state';

/** The reserved event id an incident is raised under: one question at a time, answered with an outcome. */
export const MILITARY_MISSION_EVENT_ID = 'military.mission';

export const isMilitaryMissionDecision = (eventId: string): boolean =>
  eventId === MILITARY_MISSION_EVENT_ID;

/** Going, and refusing, at the orders. */
export const ORDERS_GO = 'go';
export const ORDERS_REFUSE = 'refuse';

type OrdersOffer = Extract<MilitaryOffer, { kind: 'orders' }>;

const unit = (state: GameState, ...parts: readonly (string | number)[]): number =>
  mixedUnit(`service:${state.rng.getSeed()}:${state.world.generation}:deploy:${parts.join(':')}`);

const pick = (lines: readonly string[], key: string): string => stablePick(lines, key) ?? '';

const fillPlace = (line: string, theater: string, months?: number): string =>
  line
    .replaceAll('%theater%', theater)
    .replaceAll('%months%', months === undefined ? '' : String(months));

/** The saved flag a minigame turns on. Orders are never raised without it. */
export const openDeployments = (state: GameState): GameState => ({
  ...state,
  military: { ...state.military, deploymentsOpen: true },
});

export const closeDeployments = (state: GameState): GameState => {
  const { deploymentsOpen: _off, ...rest } = state.military;
  return { ...state, military: rest };
};

/** Whether orders are accepted or a deployment is under way: the member is not free to be anything else. */
export const isDeployed = (military: MilitaryState): boolean => military.deployment !== undefined;

/* -------------------------------------------------------------------------- */
/* Orders                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Orders for a year, or none. Only for a serving member who has finished the training year, in a life where deployments
 * are open, with nothing else standing. `before` is the state the year started in; `age` is the age being reached.
 */
export function ordersOfferFor(
  before: GameState,
  career: ServiceCareer,
  age: number,
): OrdersOffer | undefined {
  const military = before.military;
  if (military.deploymentsOpen !== true || military.deployment !== undefined) return undefined;
  if (career.stage !== 'serving' || career.years < DEPLOY_MIN_YEARS) return undefined;
  const danger = findSpecialty(career.specialty)?.danger ?? 2;
  if (unit(before, 'orders', age) >= ordersChance(career.branch, danger)) return undefined;
  const theater =
    THEATERS[Math.floor(unit(before, 'theater', age) * THEATERS.length)] ?? THEATERS[0]!;
  const tier = deploymentTier(danger, unit(before, 'tier', age));
  return {
    kind: 'orders',
    age,
    eventId: 'military.offer',
    theater,
    months: deploymentMonths(career.branch, unit(before, 'months', age)),
    tier,
    incidents: TIER_INCIDENTS[tier],
  };
}

export function ordersPrompt(offer: OrdersOffer): string {
  const ask = fillPlace(pick(ORDERS_PROMPTS, `${offer.age}:orders`), offer.theater, offer.months);
  return `${ask} ${pick(ORDERS_TIER_LINES[offer.tier], `${offer.age}:tier`)}`;
}

export const ORDERS_CHOICES: PendingDecision['choices'] = [
  { id: ORDERS_GO, label: 'Go' },
  { id: ORDERS_REFUSE, label: 'Refuse the orders' },
];

/* -------------------------------------------------------------------------- */
/* The year away                                                               */
/* -------------------------------------------------------------------------- */

export interface DeploymentYear {
  /** The deployment, now active. */
  readonly deployment: Deployment;
  /** Hostile fire pay added to the year's pay, whole dollars. */
  readonly extraPay: number;
  /** The part of the year's pay, hostile fire pay included, that the combat zone exclusion keeps from tax. */
  readonly taxFreePay: number;
  readonly line: string;
}

/**
 * The monthly cap on an officer's exclusion: the highest enlisted basic pay (the game's top enlisted rate at the longest
 * step, E-9 at twenty-six years), as the real exclusion caps it at the Sergeant Major of the Army's, which the table here
 * does not have.
 */
export const OFFICER_EXCLUSION_CAP = monthlyBasePay(9, 26, 'enlisted');

/** Orders accepted, now the year they were for: hostile fire pay if the place was one, and pay kept from tax. */
export function runDeploymentYear(
  career: ServiceCareer,
  deployment: Deployment,
  age: number,
): DeploymentYear {
  const hostile = HOSTILE_PAY_TIERS.includes(deployment.tier)
    ? HOSTILE_PAY_MONTHLY * deployment.months
    : 0;
  const monthly = monthlyBasePay(career.grade, career.years, career.track);
  const excluded = career.track === 'officer' ? Math.min(monthly, OFFICER_EXCLUSION_CAP) : monthly;
  return {
    deployment: { ...deployment, status: 'active' },
    extraPay: hostile,
    taxFreePay: Math.round(excluded * deployment.months + hostile),
    line: fillPlace(pick(DEPLOYED_LINES, `${age}:deployed`), deployment.theater, deployment.months),
  };
}

/* -------------------------------------------------------------------------- */
/* Writing it down                                                             */
/* -------------------------------------------------------------------------- */

function entryOf(
  state: GameState,
  text: string,
  kind: 'milestone' | 'passive',
  tag: string,
): TimelineEntry {
  const sequence = state.player.timeline.filter((row) => row.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:military:${tag}:${sequence}`,
    sequence,
  });
}

const addRecord = (state: GameState, record: NewLifeRecord): GameState['player']['records'] =>
  appendRecord(
    state.player.records,
    stampRecord(record, state.player.age, state.world.year, state.player.records.length),
  );

const dropQuestion = (state: GameState, eventId: string): GameState['pending'] =>
  state.pending.filter((row) => row.eventId !== eventId);

export interface DeploymentOutcomeResult {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

export type OrdersError = 'no-orders' | 'no-such-choice';

/** Answer the orders. Going starts the deployment, to run as the next year; refusing costs what it should. */
export function answerOrders(
  state: GameState,
  choiceId: string,
): Result<DeploymentOutcomeResult, OrdersError> {
  const offer = state.military.offer;
  if (!offer || offer.kind !== 'orders') return err('no-orders');
  if (!ORDERS_CHOICES.some((choice) => choice.id === choiceId)) return err('no-such-choice');
  const { offer: _spent, ...rest } = state.military;
  const career = state.military.service;
  const pending = dropQuestion(state, offer.eventId);

  if (choiceId === ORDERS_GO) {
    const deployment: Deployment = {
      status: 'ordered',
      theater: offer.theater,
      months: offer.months,
      tier: offer.tier,
      incidents: offer.incidents,
      results: [],
      orderedAge: state.player.age,
    };
    const entry = entryOf(
      state,
      fillPlace(pick(ORDERS_ACCEPTED, `${offer.age}:go`), offer.theater, offer.months),
      'milestone',
      'orders:go',
    );
    return ok({
      entry,
      state: {
        ...state,
        military: { ...rest, deployment },
        pending,
        player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      },
    });
  }

  const entry = entryOf(
    state,
    fillPlace(pick(ORDERS_REFUSED, `${offer.age}:refuse`), offer.theater, offer.months),
    'milestone',
    'orders:refuse',
  );
  const refused: ServiceCareer | undefined = career && {
    ...career,
    reputation: clampStat(career.reputation + REFUSE_REPUTATION),
    performance: clampStat(career.performance + REFUSE_PERFORMANCE),
    noRiseAtAge: state.player.age + 1,
    refusedTerm: true,
  };
  return ok({
    entry,
    state: {
      ...state,
      military: { ...rest, ...(refused ? { service: refused } : {}) },
      pending,
      player: {
        ...state.player,
        stats: nudgeStats(state.player.stats, { happiness: REFUSE_MOOD }),
        timeline: appendToTimeline(state.player.timeline, entry),
        records: addRecord(state, { category: 'military', label: 'Refused deployment orders' }),
      },
    },
  });
}

/* -------------------------------------------------------------------------- */
/* The incidents                                                               */
/* -------------------------------------------------------------------------- */

/** The question an incident asks: the generic outcomes, until a minigame replaces the buttons. */
export function missionDecision(state: GameState, deployment: Deployment): PendingDecision {
  const number = deployment.results.length + 1;
  const ask = fillPlace(
    pick(MISSION_PROMPTS[deployment.tier], `${deployment.orderedAge}:${number}:mission`),
    deployment.theater,
  );
  return {
    eventId: MILITARY_MISSION_EVENT_ID,
    category: 'career',
    age: state.player.age,
    year: state.world.year,
    prompt: `${ask} (${number} of ${deployment.incidents})`,
    choices: INCIDENT_OUTCOMES.map((id) => ({ id, label: OUTCOME_LABELS[id] })),
    names: {},
  };
}

/** Put the next incident on the table, when a deployment is under way and none is. */
export function withMissionDecision(state: GameState, alive: boolean): GameState {
  const deployment = state.military.deployment;
  if (!alive || !deployment || deployment.status !== 'active') return state;
  if (deployment.results.length >= deployment.incidents) return state;
  if (state.pending.some((row) => row.eventId === MILITARY_MISSION_EVENT_ID)) return state;
  return { ...state, pending: [...state.pending, missionDecision(state, deployment)] };
}

export type MissionError = 'no-mission' | 'no-such-choice';

const worstOf = (results: readonly DeploymentOutcome[]): DeploymentOutcome =>
  results.reduce<DeploymentOutcome>(
    (worst, next) =>
      INCIDENT_OUTCOMES.indexOf(next) > INCIDENT_OUTCOMES.indexOf(worst) ? next : worst,
    'clean',
  );

/** A condition added once: a member who already has it keeps the one they have. */
function withCondition(
  conditions: readonly HeldCondition[],
  conditionId: string,
  age: number,
): readonly HeldCondition[] {
  if (conditions.some((row) => row.conditionId === conditionId)) return conditions;
  return [...conditions, { conditionId, since: age, treated: false }];
}

function pickFrom(ids: readonly string[], draw: number): string {
  return ids[Math.min(ids.length - 1, Math.floor(draw * ids.length))]!;
}

/**
 * One incident's result goes in. A clean or close one costs nothing or some stress. A mistake may hurt; a disaster
 * always hurts and may kill. Death needs a disaster and injury needs a mistake or worse: there is no draw that harms a
 * member whose incident came out clean. The last result ends the deployment.
 */
export function answerMission(
  state: GameState,
  choiceId: string,
): Result<DeploymentOutcomeResult, MissionError> {
  const deployment = state.military.deployment;
  const career = state.military.service;
  if (!deployment || deployment.status !== 'active' || !career) return err('no-mission');
  if (!INCIDENT_OUTCOMES.some((outcome) => outcome === choiceId)) return err('no-such-choice');
  const outcome = choiceId as IncidentOutcome;
  const index = deployment.results.length;
  const age = state.player.age;
  const draw = (key: string): number => unit(state, 'incident', deployment.orderedAge, index, key);

  let player = state.player;
  let health = state.health;
  const parts: string[] = [
    pick(OUTCOME_LINES[outcome], `${deployment.orderedAge}:${index}:${outcome}`),
  ];

  /* ---- stress and standing ---- */
  player = {
    ...player,
    stats: nudgeStats(player.stats, { happiness: INCIDENT_MOOD[outcome] }),
    stress: {
      ...player.stress,
      level: applyImmediateStress(
        player.stress.level,
        INCIDENT_STRESS[outcome],
        player.stats,
        player.personality,
      ),
    },
  };
  const reputation = clampStat(career.reputation + INCIDENT_REPUTATION[outcome]);

  /* ---- hurt? A mistake may hurt; a disaster always does ---- */
  let wound: 'minor' | 'serious' | undefined;
  if (outcome === 'disaster') wound = 'serious';
  else if (outcome === 'mistake' && draw('hurt') < INJURY_ON_MISTAKE) wound = 'minor';
  let conditions = health.conditions;
  if (wound) {
    const cost = WOUND_COST[wound];
    parts.push(pick(WOUND_LINES[wound], `${deployment.orderedAge}:${index}:wound`));
    if (draw('lasting') < WOUND_LASTING[wound]) {
      conditions = withCondition(conditions, pickFrom(WOUND_CONDITIONS[wound], draw('which')), age);
    }
    health = { ...health, conditions, deficit: (health.deficit ?? 0) + cost };
    player = {
      ...player,
      stats: {
        ...player.stats,
        health: clampStat(Math.min(player.stats.health - cost, ceilingWith(conditions))),
      },
    };
  }

  /* ---- lasting trauma ---- */
  if (draw('trauma') < traumaChance(outcome, deployment.tier)) {
    const had = conditions.some((row) => row.conditionId === TRAUMA_CONDITION);
    conditions = withCondition(conditions, TRAUMA_CONDITION, age);
    if (!had) parts.push(pick(TRAUMA_LINES, `${deployment.orderedAge}:${index}:trauma`));
    health = { ...health, conditions };
    // The ceiling a condition sets holds the stat down from the moment it is held, as a wound's does.
    player = {
      ...player,
      stats: { ...player.stats, health: clampStat(Math.min(player.stats.health, ceilingWith(conditions))) },
    };
  }

  const results: readonly DeploymentOutcome[] = [...deployment.results, outcome];
  const wounded = deployment.wounded === true || wound !== undefined;

  /* ---- death: only after a disaster ---- */
  if (outcome === 'disaster' && draw('death') < DEATH_ON_DISASTER) {
    return ok(die(state, career, deployment, results, player, health, reputation, parts));
  }

  const finished = results.length >= deployment.incidents;
  const resolved = { ...deployment, results, wounded };

  if (!finished) {
    const entry = entryOf(
      state,
      parts.join(' '),
      wound ? 'milestone' : 'passive',
      `mission:${index}`,
    );
    const next: GameState = {
      ...state,
      player: { ...player, timeline: appendToTimeline(player.timeline, entry) },
      health,
      military: {
        ...state.military,
        service: { ...career, reputation },
        deployment: resolved,
      },
      pending: dropQuestion(state, MILITARY_MISSION_EVENT_ID),
    };
    return ok({ entry, state: withMissionDecision(next, true) });
  }
  return ok(finish(state, career, resolved, player, health, reputation, parts));
}

/* -------------------------------------------------------------------------- */
/* The end                                                                     */
/* -------------------------------------------------------------------------- */

/** What a completed deployment earns, as the awards its rules are met for and the draws allow. */
export function earnedAwards(
  state: GameState,
  deployment: Deployment,
  results: readonly DeploymentOutcome[],
): readonly DecorationId[] {
  const worst = worstOf(results);
  const harmed = worst === 'mistake' || worst === 'disaster';
  const forward = deployment.tier !== 'rear';
  const rules: readonly (readonly [DecorationId, boolean])[] = [
    ['service-medal', forward],
    ['purple-heart', deployment.wounded === true],
    ['commendation', !harmed],
    ['combat-badge', deployment.tier === 'front' && worst !== 'clean'],
    ['bronze-star', deployment.tier === 'front' && worst === 'close'],
  ];
  return rules
    .filter(
      ([id, met]) => met && unit(state, 'award', deployment.orderedAge, id) < DECORATION_CHANCE[id],
    )
    .map(([id]) => id);
}

const decorationRecords = (ids: readonly DecorationId[]): NewLifeRecord[] =>
  ids.map((id) => ({
    category: 'military' as const,
    label: `Awarded ${findDecoration(id)?.record ?? id}`,
  }));

const pastDeploymentOf = (
  deployment: Deployment,
  results: readonly DeploymentOutcome[],
  age: number,
): PastDeployment => ({
  age,
  theater: deployment.theater,
  months: deployment.months,
  tier: deployment.tier,
  worst: worstOf(results),
  wounded: deployment.wounded === true,
});

function finish(
  state: GameState,
  career: ServiceCareer,
  deployment: Deployment,
  player: GameState['player'],
  health: GameState['health'],
  reputation: number,
  parts: string[],
): DeploymentOutcomeResult {
  const age = state.player.age;
  const awards = earnedAwards(state, deployment, deployment.results);
  parts.push(
    fillPlace(pick(HOMECOMING_LINES, `${deployment.orderedAge}:home`), deployment.theater),
  );
  for (const id of awards) {
    parts.push(
      pick(AWARD_LINES, `${deployment.orderedAge}:award:${id}`).replace(
        '%award%',
        findDecoration(id)?.record ?? id,
      ),
    );
  }
  const entry = entryOf(state, parts.join(' '), 'milestone', 'mission:end');
  const { deployment: _over, ...rest } = state.military;
  let records = player.records;
  const stamp = (record: NewLifeRecord) => {
    records = appendRecord(records, stampRecord(record, age, state.world.year, records.length));
  };
  stamp({ category: 'military', label: `Deployed — ${deployment.theater}` });
  for (const record of decorationRecords(awards)) stamp(record);
  return {
    entry,
    state: {
      ...state,
      health,
      player: {
        ...player,
        records,
        timeline: appendToTimeline(player.timeline, entry),
      },
      military: {
        ...rest,
        service: { ...career, reputation },
        deployments: [
          ...(state.military.deployments ?? []),
          pastDeploymentOf(deployment, deployment.results, age),
        ],
        decorations: [...(state.military.decorations ?? []), ...awards.map((id) => ({ id, age }))],
      },
      pending: dropQuestion(state, MILITARY_MISSION_EVENT_ID),
    },
  };
}

function die(
  state: GameState,
  career: ServiceCareer,
  deployment: Deployment,
  results: readonly DeploymentOutcome[],
  player: GameState['player'],
  health: GameState['health'],
  reputation: number,
  parts: string[],
): DeploymentOutcomeResult {
  const age = state.player.age;
  const where = deployment.tier === 'rear' ? 'rear' : 'front';
  parts.push(
    fillPlace(pick(DEATH_LINES[where], `${deployment.orderedAge}:death`), deployment.theater),
  );
  const honored: DecorationId[] = [];
  if (deployment.tier !== 'rear') honored.push('purple-heart');
  if (unit(state, 'award', deployment.orderedAge, 'bronze-star:death') < POSTHUMOUS_BRONZE_STAR) {
    honored.push('bronze-star');
  }
  if (
    unit(state, 'award', deployment.orderedAge, 'medal-of-honor') <
    DECORATION_CHANCE['medal-of-honor']
  ) {
    honored.push('medal-of-honor');
  }
  for (const id of honored) {
    parts.push(
      pick(AWARD_LINES, `${deployment.orderedAge}:award:${id}`).replace(
        '%award%',
        findDecoration(id)?.record ?? id,
      ),
    );
  }
  const entry = entryOf(state, parts.join(' '), 'milestone', 'mission:death');
  let records = player.records;
  const stamp = (record: NewLifeRecord) => {
    records = appendRecord(records, stampRecord(record, age, state.world.year, records.length));
  };
  stamp({ category: 'military', label: `Killed in service — ${deployment.theater}` });
  for (const record of decorationRecords(honored)) stamp(record);
  const { service: _s, offer: _o, deployment: _d, ...rest } = state.military;
  const past: PastService = {
    branch: career.branch,
    enlistedAge: career.enlistedAge,
    endedAge: age,
    years: career.years,
    track: career.track,
    specialty: career.specialty,
    finalGrade: career.grade,
    reputation,
    how: 'killed',
    discharge: 'honorable',
  };
  return {
    entry,
    state: {
      ...state,
      health: {
        ...health,
        causeOfDeath: DEATH_CAUSES[where],
        diedAtAge: age,
      },
      player: {
        ...player,
        alive: false,
        records,
        timeline: appendToTimeline(player.timeline, entry),
      },
      military: {
        ...rest,
        past: [...state.military.past, past],
        deployments: [
          ...(state.military.deployments ?? []),
          pastDeploymentOf({ ...deployment, wounded: true }, results, age),
        ],
        decorations: [...(state.military.decorations ?? []), ...honored.map((id) => ({ id, age }))],
      },
      pending: [],
    },
  };
}

/** Exposed so a dial can be read beside the table it multiplies. */
export const DANGER_TEMPO_TABLE = DANGER_TEMPO;
