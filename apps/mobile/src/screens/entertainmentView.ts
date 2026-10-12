/**
 * Ticket 0809 — what the sports, acting, music, modeling and racing screens say, as plain functions.
 *
 * The engines own every number. This file only chooses the words, and chooses what is not said:
 * a skill's level is a bar, a reputation is a phrase, a sport's form is never printed (spec 9 and
 * 343), and hours of the week are never shown (spec 661). Everything here is derived from the
 * game state; nothing is saved, so a reload shows exactly what it showed before.
 */

import {
  ACTING_TIER_ROWS,
  BILLING_WORDS,
  CHART_TOP,
  DIY_COST,
  KIND_NAME,
  MODEL_PORTFOLIO_COST,
  MARTIAL_ART_MIN_AGE,
  MAX_ARTS_AT_ONCE,
  MUSIC_LESSONS_MIN_AGE,
  MODEL_TIER_ROWS,
  MUSIC_TIER_ROWS,
  RELEASE_CAPS,
  RELEASE_KINDS,
  YEAR_WEEKS,
  SERIES,
  STUDIES,
  actingFameOf,
  actingReputationWord,
  findSport,
  modelReputationWord,
  musicFameOf,
  musicReputationWord,
  type ReleaseKind,
} from '@yearafter/content';
import { PRACTICE_SESSIONS, gradeForAge, stageForGrade } from '@yearafter/education';
import {
  CEREMONY_NAMES,
  applicationsAllowed,
  artsOf,
  bestPast,
  careerLabel,
  chartName,
  chartOf,
  castingCalls,
  demoChance,
  fightRoadOf,
  isFullTime,
  isPlaying,
  jobFee,
  laurelName,
  modelApplicationsAllowed,
  modelBrandOffers,
  modelCalls,
  musicCollabOffers,
  musicOf,
  musicTierOf,
  paysOwnPortfolio,
  plannedTour,
  postOf,
  postPayOf,
  postTitle,
  racingViewOf,
  readArts,
  recordOf,
  reputationOf,
  skillsOf,
  sportsFameOf,
  tierWords,
  weeksUsed,
  winsAt,
  worldRankOf,
  type ChartEntry,
  type ChartField,
  type GameState,
} from '@yearafter/simulation';
import { money } from './fameView';

/** One line of a card: what it is, how it stands, and a quiet note. */
export interface Fact {
  readonly title: string;
  readonly value?: string;
  readonly subtitle?: string;
}

const upper = (text: string): string => `${text[0]?.toUpperCase() ?? ''}${text.slice(1)}`;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
export const percent = (chance: number): string => `${Math.round(chance * 100)}%`;
export const ordinal = (n: number): string => {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

/* -------------------------------------------------------------------------- */
/* The hub                                                                     */
/* -------------------------------------------------------------------------- */

export type FieldId = 'sports' | 'studies' | 'acting' | 'music' | 'modeling';

export interface HubRow {
  readonly id: FieldId;
  readonly title: string;
  readonly subtitle: string;
  readonly value?: string;
  /** Why the row is closed, when it is: the youngest age that opens it. */
  readonly closed?: string;
}

function firstAge(found: (age: number) => boolean): number {
  let age = 0;
  while (!found(age)) age += 1;
  return age;
}

/** The youngest age each field does anything for. The engines say no below these; the hub says why first. */
export const FIELD_AGES: Readonly<Record<FieldId, number>> = {
  // School teams start in middle school, so that is the first age a sport can be anything but empty.
  sports: firstAge((age) => stageForGrade(gradeForAge(age)) === 'middle'),
  studies: Math.min(...STUDIES.map((art) => art.minAge ?? MARTIAL_ART_MIN_AGE)),
  acting: ACTING_TIER_ROWS.local.minAge,
  music: MUSIC_LESSONS_MIN_AGE,
  modeling: MODEL_TIER_ROWS.test.minAge,
};

export const FIELD_TITLES: Readonly<Record<FieldId, string>> = {
  sports: 'Sports',
  studies: 'Martial Arts and Karting',
  acting: 'Acting',
  music: 'Music',
  modeling: 'Modeling',
};

export function hubRows(state: GameState): readonly HubRow[] {
  const age = state.player.age;
  const row = (id: FieldId, subtitle: string, value?: string): HubRow => ({
    id,
    title: FIELD_TITLES[id],
    subtitle,
    ...(value === undefined ? {} : { value }),
    ...(age < FIELD_AGES[id] ? { closed: `From age ${FIELD_AGES[id]}` } : {}),
  });
  const career = state.sports.career;
  const post = postOf(state);
  const studying = readArts(state);
  const acting = state.acting;
  const music = state.music;
  const modeling = state.modeling;
  return [
    row(
      'sports',
      career ? careerLabel(career) : post ? postTitle(post) : 'No team yet. Teams start at school.',
      career?.tier ? upper(tierWords(career.tier)) : career ? upper(career.stage) : undefined,
    ),
    row(
      'studies',
      studying.length > 0 ? studying.map((art) => art.name).join(' and ') : 'Nothing started',
      studying.length > 0 ? `${studying.length} of ${MAX_ARTS_AT_ONCE}` : undefined,
    ),
    row(
      'acting',
      acting.credits > 0 ? plural(acting.credits, 'credit') : 'No credits yet',
      acting.credits > 0 ? ACTING_TIER_ROWS[acting.tier].name : undefined,
    ),
    row(
      'music',
      totalMade(state) > 0 ? `${plural(totalMade(state), 'release')} out` : 'Nothing released',
      music.listeners > 0 ? MUSIC_TIER_ROWS[musicStanding(state)].name : undefined,
    ),
    row(
      'modeling',
      modeling.credits > 0 ? plural(modeling.credits, 'job') : 'No jobs yet',
      modeling.credits > 0 ? MODEL_TIER_ROWS[modeling.tier].name : undefined,
    ),
  ];
}

const totalMade = (state: GameState): number =>
  state.music.released.single + state.music.released.ep + state.music.released.lp;
const musicStanding = (state: GameState) => musicTierOf(state.music);

/* -------------------------------------------------------------------------- */
/* Awards and charts, folded into each field                                    */
/* -------------------------------------------------------------------------- */

export interface ChartView {
  readonly name: string;
  /** Where the player stands, when they are on it at all. */
  readonly rank?: number;
  /** The top of the chart, and the player's own row after it if they are further down. */
  readonly rows: readonly ChartEntry[];
}

export interface AwardsView {
  readonly ceremony: string;
  readonly wins: number;
  /** "Athlete of the Year" or "Driver of the Year" for sports; otherwise the ceremony's own word. */
  readonly prize?: string;
  readonly chart?: ChartView;
}

/** The fame a field holds the player at: the figure its chart ranks them by. */
export function fieldFame(state: GameState, field: ChartField): number {
  if (field === 'acting')
    return actingFameOf({
      tier: state.acting.tier,
      reputation: state.acting.reputation,
      awards: state.acting.awards,
      idle: state.acting.idle,
    });
  if (field === 'music')
    return musicFameOf({
      tier: musicStanding(state),
      reputation: state.music.reputation,
      awards: state.music.awards,
      idle: state.music.idle,
    });
  return sportsFameOf(state.sports.career);
}

export function chartView(state: GameState, field: ChartField): ChartView | undefined {
  const sportId =
    field === 'sports' && state.sports.career?.stage === 'pro'
      ? (state.sports.career.sportId as Parameters<typeof chartOf>[4])
      : undefined;
  if (field === 'sports' && sportId === undefined) return undefined;
  const rows = chartOf(
    state.rng.getSeed(),
    state.world.year,
    field,
    fieldFame(state, field),
    sportId,
  );
  const player = rows.find((entry) => entry.player);
  const top = rows.filter((entry) => entry.rank <= CHART_TOP);
  return {
    name: chartName(field, sportId),
    ...(player ? { rank: player.rank } : {}),
    rows: player && player.rank > CHART_TOP ? [...top, player] : top,
  };
}

export function awardsView(state: GameState, ceremony: keyof typeof CEREMONY_NAMES): AwardsView {
  const name = CEREMONY_NAMES[ceremony];
  const racing = state.sports.career?.sportId === 'racing';
  const chart = ceremony === 'modeling' ? undefined : chartView(state, ceremony);
  return {
    ceremony: name,
    wins: winsAt(state.player.records, name),
    ...(ceremony === 'sports' ? { prize: laurelName(racing) } : {}),
    ...(chart ? { chart } : {}),
  };
}

/** The awards line of a card: wins and chart place, only the parts that are true. */
export function awardFacts(view: AwardsView): readonly Fact[] {
  const facts: Fact[] = [];
  if (view.wins > 0)
    facts.push({
      title: upper(view.ceremony),
      value: plural(view.wins, 'win'),
      ...(view.prize ? { subtitle: view.prize } : {}),
    });
  if (view.chart?.rank !== undefined)
    facts.push({ title: upper(view.chart.name), value: `No. ${view.chart.rank}` });
  return facts;
}

/* -------------------------------------------------------------------------- */
/* Sports                                                                      */
/* -------------------------------------------------------------------------- */

const HOW_ENDED: Readonly<Record<string, string>> = {
  declined: 'Turned down the offer',
  'left-college': 'Left after college',
  undrafted: 'Went undrafted',
  retired: 'Retired',
  injury: 'Ended by an injury',
  unsigned: 'Never signed',
  'lost-card': 'Lost the tour card',
  released: 'Let go by the team',
  cut: 'Cut from the squad',
};

export interface SportsView {
  /** Whether there is anything at all to show: a career, a post, or a past. */
  readonly empty: boolean;
  readonly facts: readonly Fact[];
  readonly skills: readonly {
    readonly id: string;
    readonly name: string;
    readonly value: number;
  }[];
  /** Sessions left this year, when the player is at college or in the pros. */
  readonly sessionsLeft?: number;
  readonly post?: { readonly title: string; readonly pay: string };
  readonly past: readonly Fact[];
  readonly awards: AwardsView;
}

export function sportsView(state: GameState): SportsView {
  const career = state.sports.career;
  const post = postOf(state);
  const sport = career ? findSport(career.sportId) : undefined;
  const facts: Fact[] = [];
  if (career) {
    facts.push({ title: careerLabel(career) });
    if (career.stage === 'school') {
      facts.push({ title: 'Seasons', value: `${career.seasons}` });
    } else if (career.stage === 'college') {
      if (career.aid) facts.push({ title: 'Scholarship', value: `${money(career.aid)} a year` });
      facts.push({ title: 'Seasons', value: `${career.collegeSeasons ?? career.seasons}` });
    } else {
      if (career.tier) facts.push({ title: 'Standing', value: upper(tierWords(career.tier)) });
      if (career.contract)
        facts.push({
          title: 'Contract',
          value: `${money(career.contract.salary)} a year`,
          subtitle:
            career.contract.yearsLeft === 1
              ? 'Last year of it'
              : `${career.contract.yearsLeft} years left`,
        });
      const record = recordOf(career);
      if (record) facts.push({ title: 'Record', value: record });
      const rank = worldRankOf(state);
      if (rank !== undefined) facts.push({ title: 'World ranking', value: `No. ${rank}` });
      facts.push({ title: 'Seasons as a pro', value: `${career.proSeasons ?? 0}` });
    }
    facts.push({ title: 'Reputation', value: upper(reputationOf(career)) });
    if (career.titles > 0)
      facts.push({
        title: sport?.format === 'racing' ? 'Championships' : 'Titles',
        value: `${career.titles}`,
      });
    if (isFullTime(career) === false && career.stage === 'pro' && sport?.format === 'combat')
      facts.push({ title: 'Day job', subtitle: 'Fighting is something you do on the side.' });
  }
  const done =
    career && isPlaying(career) && career.trainedAtAge === state.player.age
      ? career.trainedCount
      : 0;
  return {
    empty: !career && !post && state.sports.past.length === 0,
    facts,
    skills: skillsOf(state),
    ...(career && isPlaying(career) ? { sessionsLeft: PRACTICE_SESSIONS - done } : {}),
    ...(post ? { post: { title: postTitle(post), pay: `${money(postPayOf(post))} a year` } } : {}),
    past: state.sports.past.map((row) => ({
      title: `${upper(findSport(row.sportId)?.noun ?? 'sport')}, ${row.startedAge} to ${row.endedAge}`,
      value: row.bestTier ? upper(tierWords(row.bestTier)) : upper(row.reached),
      subtitle: `${HOW_ENDED[row.how] ?? 'Ended'}${
        row.titles > 0 ? ` · ${plural(row.titles, 'title')}` : ''
      }`,
    })),
    awards: awardsView(state, 'sports'),
  };
}

/** The best past career, in a phrase, for the hub or a recap. */
export const bestPastWords = (state: GameState): string | undefined => {
  const best = bestPast(state.sports.past);
  return best
    ? `${findSport(best.sportId)?.noun ?? 'sport'}, ${best.startedAge} to ${best.endedAge}`
    : undefined;
};

/* -------------------------------------------------------------------------- */
/* Martial arts and karting                                                     */
/* -------------------------------------------------------------------------- */

export interface StudyRow {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly cost: string;
  readonly minAge: number;
  readonly studying: boolean;
  /** Counts towards a fight career yet (three seasons in). */
  readonly counts: boolean;
  readonly seasons: number;
  readonly skills: readonly {
    readonly id: string;
    readonly name: string;
    readonly value: number;
  }[];
  readonly sessionsLeft: number;
}

export interface StudiesView {
  readonly rows: readonly StudyRow[];
  readonly full: boolean;
  readonly road?: string;
}

export function studiesView(state: GameState): StudiesView {
  const reading = readArts(state);
  const age = state.player.age;
  const rows = STUDIES.map((art): StudyRow => {
    const mine = reading.find((row) => row.id === art.id);
    const study = artsOf(state).find((row) => row.artId === art.id);
    const trained = study && study.trainedAtAge === age ? study.trainedCount : 0;
    return {
      id: art.id,
      name: art.name,
      blurb: art.blurb,
      cost: `${money(art.annualCost)} a year once you pay for it`,
      minAge: art.minAge ?? MARTIAL_ART_MIN_AGE,
      studying: mine !== undefined,
      counts: mine?.counts ?? false,
      seasons: mine?.seasons ?? 0,
      skills: mine?.skills ?? [],
      sessionsLeft: study ? PRACTICE_SESSIONS - trained : 0,
    };
  });
  const road = fightRoadOf(state);
  return {
    rows,
    full: reading.length >= MAX_ARTS_AT_ONCE,
    ...(road
      ? { road: `On the road to ${findSport(road.sportId)?.name ?? 'a fight career'}` }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Acting                                                                      */
/* -------------------------------------------------------------------------- */

/** How a model is used on a job, as a few words for a row (the engine's own phrases are for sentences). */
export const PLACEMENT_WORDS = {
  face: 'The face of it',
  featured: 'Featured',
  group: 'In the group',
} as const;

const REACH_WORDS = {
  below: 'Below where you are',
  at: 'About where you are',
  above: 'A stretch',
} as const;

export interface CallRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fee: string;
  readonly chance: string;
  readonly reach: string;
  readonly applied: boolean;
}

export interface ActingView {
  readonly facts: readonly Fact[];
  readonly calls: readonly CallRow[];
  readonly applicationsLeft: number;
  readonly booked: readonly Fact[];
  readonly lessons: boolean;
  readonly agent: boolean;
  readonly sessionsLeft: number;
  readonly awards: AwardsView;
}

export function actingView(state: GameState): ActingView {
  const acting = state.acting;
  const age = state.player.age;
  const row = ACTING_TIER_ROWS[acting.tier];
  const used = acting.appliedAge === age ? acting.applied.length : 0;
  const calls = castingCalls(state).map((call): CallRow => {
    return {
      id: call.role.id,
      title: call.role.title,
      subtitle: `${call.role.medium} · ${BILLING_WORDS[call.role.billing]} · ${plural(call.role.days, 'day')}`,
      fee: money(call.role.fee),
      chance: percent(call.chance),
      reach: REACH_WORDS[call.reach],
      applied: call.applied,
    };
  });
  return {
    facts: [
      { title: 'Where you are', value: row.name, subtitle: row.blurb },
      { title: 'Reputation', value: upper(actingReputationWord(acting.reputation)) },
      { title: 'Credits', value: `${acting.credits}` },
      ...(acting.hits > 0 ? [{ title: 'Hits', value: `${acting.hits}` }] : []),
      ...(acting.agent ? [{ title: 'Agent', subtitle: 'Takes 10% of what you earn' }] : []),
    ],
    calls,
    applicationsLeft: Math.max(0, applicationsAllowed(acting) - used),
    booked: acting.booked.map((role) => ({
      title: role.title,
      value: money(role.fee),
      subtitle: `${role.medium} · ${BILLING_WORDS[role.billing]} · shoots in the year ahead`,
    })),
    lessons: acting.lessons !== undefined,
    agent: acting.agent !== undefined,
    sessionsLeft: 3 - (acting.devAtAge === age ? (acting.devCount ?? 0) : 0),
    awards: awardsView(state, 'acting'),
  };
}

/* -------------------------------------------------------------------------- */
/* Music                                                                       */
/* -------------------------------------------------------------------------- */

export interface ReleasePlanRow {
  readonly kind: ReleaseKind;
  readonly name: string;
  readonly planned: number;
  readonly cap: number;
  readonly cost: string;
  readonly out: number;
}

export interface CollabRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly fee: string;
}

export interface MusicView {
  readonly facts: readonly Fact[];
  readonly plan: readonly ReleasePlanRow[];
  readonly tour?: { readonly summary: string; readonly on: boolean; readonly weeks: string };
  readonly weeks: string;
  readonly deal?: Fact;
  readonly demo: { readonly chance: string };
  readonly collabs: readonly CollabRow[];
  readonly lessons: boolean;
  readonly awards: AwardsView;
}

export function musicView(state: GameState): MusicView {
  const music = musicOf(state);
  const tourPlan = plannedTour(state);
  const tier = MUSIC_TIER_ROWS[musicStanding(state)];
  return {
    facts: [
      { title: 'Where you are', value: tier.name, subtitle: `You play ${tier.venue}` },
      { title: 'Listeners', value: music.listeners.toLocaleString('en-US'), subtitle: 'A month' },
      { title: 'Reputation', value: upper(musicReputationWord(music.reputation)) },
      ...(music.tours > 0 ? [{ title: 'Tours', value: `${music.tours}` }] : []),
    ],
    plan: RELEASE_KINDS.map((kind) => ({
      kind,
      name: upper(KIND_NAME[kind]),
      planned: music.plan[kind],
      cap: RELEASE_CAPS[kind],
      cost: music.deal ? 'Your label pays' : `${money(DIY_COST[kind])} each`,
      out: music.released[kind],
    })),
    ...(tourPlan
      ? {
          tour: {
            summary: `${plural(tourPlan.shows, 'show')} · about ${money(tourPlan.door)} at the door, ${money(tourPlan.costs)} on the road`,
            on: music.plan.tour,
            weeks: plural(tourPlan.weeks, 'week'),
          },
        }
      : {}),
    weeks: `${weeksUsed(state)} of ${YEAR_WEEKS} weeks`,
    ...(music.deal
      ? {
          deal: {
            title: music.deal.label,
            value: music.deal.kind === 'major' ? 'Major label' : 'Independent label',
            subtitle: `${plural(music.deal.left, 'year')} left · ${Math.round(music.deal.royalty * 100)}% royalty`,
          },
        }
      : {}),
    demo: { chance: percent(demoChance(state)) },
    collabs: musicCollabOffers(state).map((offer) => ({
      id: offer.id,
      title: offer.partner.name,
      subtitle: offer.partner.friend
        ? 'A friend'
        : `${offer.partner.audience.toLocaleString('en-US')} listeners`,
      fee: offer.fee > 0 ? money(offer.fee) : 'Free',
    })),
    lessons: music.lessons !== undefined,
    awards: awardsView(state, 'music'),
  };
}

/* -------------------------------------------------------------------------- */
/* Modeling                                                                    */
/* -------------------------------------------------------------------------- */

export interface BrandRow {
  readonly id: string;
  readonly title: string;
  readonly pay: string;
}

export interface ModelingView {
  readonly facts: readonly Fact[];
  readonly calls: readonly CallRow[];
  readonly applicationsLeft: number;
  readonly booked: readonly Fact[];
  readonly brands: readonly BrandRow[];
  readonly portfolio: { readonly done: boolean; readonly cost?: string };
  readonly agency: boolean;
  readonly awards: AwardsView;
}

export function modelingView(state: GameState): ModelingView {
  const modeling = state.modeling;
  const age = state.player.age;
  const row = MODEL_TIER_ROWS[modeling.tier];
  const used = modeling.appliedAge === age ? modeling.applied.length : 0;
  const calls = modelCalls(state).map((call): CallRow => {
    return {
      id: call.job.id,
      title: call.job.client,
      subtitle: `${upper(call.job.medium)} · ${PLACEMENT_WORDS[call.job.placement]} · ${plural(call.job.days, 'day')}`,
      fee: money(jobFee(call.job)),
      chance: percent(call.chance),
      reach: REACH_WORDS[call.reach],
      applied: call.applied,
    };
  });
  const own = paysOwnPortfolio(state);
  return {
    facts: [
      { title: 'Where you are', value: row.name, subtitle: row.blurb },
      { title: 'Reputation', value: upper(modelReputationWord(modeling.reputation)) },
      { title: 'Jobs', value: `${modeling.credits}` },
      ...(modeling.followers > 0
        ? [{ title: 'Following', value: modeling.followers.toLocaleString('en-US') }]
        : []),
      ...(modeling.agency ? [{ title: 'Agency', subtitle: 'Takes 20% of what you earn' }] : []),
    ],
    calls,
    applicationsLeft: Math.max(0, modelApplicationsAllowed(modeling) - used),
    booked: modeling.booked.map((job) => ({
      title: job.client,
      value: money(jobFee(job)),
      subtitle: `${upper(job.medium)} · shoots in the year ahead`,
    })),
    brands: modelBrandOffers(state).map((offer) => ({
      id: offer.id,
      title: offer.brand,
      pay: money(offer.pay),
    })),
    portfolio: {
      done: modeling.portfolioAge === age,
      ...(own ? { cost: money(MODEL_PORTFOLIO_COST) } : {}),
    },
    agency: modeling.agency !== undefined,
    awards: awardsView(state, 'modeling'),
  };
}

/* -------------------------------------------------------------------------- */
/* The racing team                                                              */
/* -------------------------------------------------------------------------- */

export const DEVELOPMENT_WORDS = {
  lean: { label: 'Lean', blurb: 'Costs less. The car falls back a little.' },
  steady: { label: 'Steady', blurb: 'The usual spend for the series.' },
  heavy: { label: 'Heavy', blurb: 'Costs more. The car gets quicker.' },
} as const;

export interface RacingTeamView {
  readonly series: string;
  readonly words: string;
  readonly facts: readonly Fact[];
  readonly driver: Fact;
  readonly candidates: readonly {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
  }[];
  readonly canDriveYourself: boolean;
  readonly driving: boolean;
  /** There is a series below this one, and the team has run a season at this level. */
  readonly canStepDown: boolean;
  readonly development: keyof typeof DEVELOPMENT_WORDS;
  readonly next?: { readonly name: string; readonly cost: number; readonly ready: boolean };
  readonly last?: string;
}

export function racingTeamView(state: GameState, businessId: string): RacingTeamView | undefined {
  const view = racingViewOf(state, businessId);
  if (!view) return undefined;
  const { team, series } = view;
  const next =
    view.upgradeCost !== undefined ? SERIES[(team.rung + 1) as 1 | 2 | 3 | 4 | 5] : undefined;
  const last = team.last;
  return {
    series: series.series,
    words: series.words,
    facts: [
      { title: 'Series', value: series.series, subtitle: upper(series.words) },
      { title: 'Seasons run', value: `${team.seasons}` },
      { title: 'Championships', value: `${team.titles}` },
    ],
    driver:
      team.driver.kind === 'owner'
        ? { title: 'Driver', value: 'You', subtitle: 'You drive for your own team' }
        : {
            title: 'Driver',
            value: team.driver.name,
            subtitle: `Age ${team.driver.age} · ${driverWords(team.driver.skill)}`,
          },
    candidates: view.candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.name,
      subtitle: `Age ${candidate.age} · ${driverWords(candidate.skill)}`,
    })),
    canDriveYourself: view.canDriveYourself,
    driving: team.driver.kind === 'owner',
    canStepDown: team.rung > 1 && team.last?.rung === team.rung,
    development: team.development,
    ...(next && view.upgradeCost !== undefined
      ? { next: { name: next.series, cost: view.upgradeCost, ready: view.canMoveUp } }
      : {}),
    ...(last
      ? {
          last: last.title
            ? `${last.year}: won the ${SERIES[last.rung].series}`
            : `${last.year}: ${ordinal(last.place)} of ${last.field} in the ${SERIES[last.rung].series}`,
        }
      : {}),
  };
}

/** How good a driver is, in a phrase. The number is the engine's. */
export function driverWords(skill: number): string {
  if (skill >= 80) return 'one of the best around';
  if (skill >= 65) return 'quick';
  if (skill >= 45) return 'solid';
  if (skill >= 30) return 'still learning';
  return 'raw';
}

/* -------------------------------------------------------------------------- */
/* The year's recap                                                             */
/* -------------------------------------------------------------------------- */

export interface RecapGroup {
  readonly field: string;
  readonly lines: readonly string[];
}

const FIELD_LINES: readonly (readonly [RegExp, string])[] = [
  [/^t:\d+:sports:\d+$/, 'Sports'],
  [/^t:\d+:acting:\d+$/, 'Acting'],
  [/^t:\d+:music:\d+$/, 'Music'],
  [/^t:\d+:modeling:\d+$/, 'Modeling'],
  [/^t:\d+:awards:\d+$/, 'Awards'],
  [/^t:\d+:biz:\d+$/, 'Your racing team'],
];

/**
 * The lines the engines wrote for the year that has just turned, grouped by field. `before` and
 * `after` are the state on either side of one Advance; anything else (a load, a new life) gives
 * nothing. A business line counts only when it is about a racing team the player runs, because
 * the same ids carry every other business's year.
 */
export function recapOf(before: GameState, after: GameState): readonly RecapGroup[] {
  if (
    before.player.id !== after.player.id ||
    !after.player.alive ||
    after.world.year !== before.world.year + 1
  )
    return [];
  const racingNames = after.businesses
    .filter((business) => business.typeId === 'biz.racing')
    .map((business) => business.name);
  const had = new Set(before.player.timeline.map((entry) => entry.id));
  const groups = new Map<string, string[]>();
  for (const entry of after.player.timeline) {
    if (had.has(entry.id) || entry.year !== after.world.year) continue;
    const match = FIELD_LINES.find(([pattern]) => pattern.test(entry.id));
    if (!match) continue;
    if (match[1] === 'Your racing team' && !racingNames.some((name) => entry.text.includes(name)))
      continue;
    groups.set(match[1], [...(groups.get(match[1]) ?? []), entry.text]);
  }
  return FIELD_LINES.map(([, field]) => field)
    .filter((field, index, all) => all.indexOf(field) === index)
    .flatMap((field) => {
      const lines = groups.get(field);
      return lines && lines.length > 0 ? [{ field, lines }] : [];
    });
}
