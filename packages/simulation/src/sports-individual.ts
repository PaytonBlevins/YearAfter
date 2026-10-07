/**
 * Ticket 0803 — the individual sports: golf, tennis, boxing and MMA.
 *
 * A team player is carried by a roster: the draft decides a tier, the contract pays it, and a
 * season is the same year again. Nobody on a tour or a fight card is carried. What a season earns
 * and where a player stands next year are the season's RESULTS, decided by skill:
 *
 *   golf, tennis  a tour card at the end of college; every season a result against the tier's field
 *                 (`tourMovement`) moves a player one rung up, none, or one down; a fringe player who
 *                 slips loses the card; prize money and a world rank (a band, never saved)
 *   boxing, MMA   no school team and no college: a martial art studied from ten (`startArt`), and when
 *                 a gym sees three seasons of it and the odds agree, an offer to turn pro; every
 *                 fight is a draw of form against an opponent at the tier (`fightWinChance`), the
 *                 record is saved, and net wins move a fighter up and net losses move them down
 *
 * THE ODDS ARE THE SAME TABLE FOR WHO GETS IN (0801 and 0802): the share who reach the pros comes
 * from `REACH_PROS`, one draw for the life. What happens next is not drawn. A team player's
 * `BECOME_STAR` fixes how far they will go; here nothing does, because results are what move a
 * player and a player who keeps winning keeps rising. So the star share is MEASURED rather than
 * set, the ticket document compares it with the table, and `FIELD_STRENGTH` in content is the dial.
 *
 * Every draw is a hash, so no RNG stream is touched. A life that never studies an art or plays tour
 * golf replays exactly as it did before this ticket.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type LifeRecord,
  type NewLifeRecord,
  type TimelineEntry,
} from '@yearafter/character';
import {
  ART_START_LEVEL,
  FINAL_LINE,
  FIGHT_LUCK,
  FIGHTS_PER_YEAR,
  GAMES_NOISE,
  GAMES_TEAM_TIER,
  HARD_WORK_SESSIONS,
  MARTIAL_ART_MIN_AGE,
  MAX_ARTS_AT_ONCE,
  MEDAL_PRIZE,
  MEDAL_SPONSORSHIP,
  MEDAL_WORDS,
  MIN_ART_SEASONS,
  MISSED_SEASON_PURSE,
  OLYMPIC_WINDOW,
  PRO_INJURY_CHANCE,
  PURSE_SPREAD,
  REACH_NATIONAL,
  REACH_PROS,
  TIER_REPUTATION,
  TITLE_PURSE_SHARE,
  TOUR_NOISE,
  TOUR_TITLE_CHANCE,
  TRAINING_CAP,
  TURN_PRO_MAX_AGE,
  TURN_PRO_MIN_AGE,
  between,
  categoryOf,
  draftChance,
  findMartialArt,
  findSport,
  fightCareerFor,
  fightWinChance,
  isGamesYear,
  isOut,
  isHardWorker,
  medalFor,
  naturalForm,
  olympicCareersFor,
  skillValue,
  stepTier,
  tierForPerformance,
  worldRankFor,
  type MartialArt,
  type Medal,
  type Sport,
  type SportTier,
} from '@yearafter/content';
import { err, ok, stablePick, type Result } from '@yearafter/core';
import { PRACTICE_SESSIONS, practiceGain } from '@yearafter/education';
import type { GameState } from './game-state';
import { affordsFee } from './pursuits';
import {
  COMBAT_MINOR_LINES,
  COMBAT_SERIOUS_LINES,
  OLYMPIC_MINOR_LINES,
  OLYMPIC_SERIOUS_LINES,
  TOUR_MINOR_LINES,
  TOUR_SERIOUS_LINES,
  healthAdjusted,
  injuryOf,
  money,
  nextForm,
  pick,
  positionIn,
  sportUnit,
  tierRank,
  tierWords,
} from './sports-core';
import type { ArtStudy, PastCareer, SportCareer, SportsOffer } from './sports-state';

/** The reserved event id a sports question is raised under. Restated here so this file does not import `sports.ts`. */
const OFFER_EVENT_ID = 'sports.offer';

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

export const artsOf = (state: GameState): readonly ArtStudy[] => state.sports.arts ?? [];

export interface ArtReading {
  readonly id: string;
  readonly name: string;
  readonly style: MartialArt['style'];
  readonly level: number;
  readonly seasons: number;
  /** Whether it counts towards a fight career yet: three seasons in. */
  readonly counts: boolean;
  readonly skills: readonly {
    readonly id: string;
    readonly name: string;
    readonly value: number;
  }[];
}

/**
 * What a student can read about the arts they study, and nothing about the ones they do not
 * (spec 9 and 343). Skills are derived from the level with a fixed lean, never saved.
 */
export function readArts(state: GameState): readonly ArtReading[] {
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  return artsOf(state).flatMap((study) => {
    const art = findMartialArt(study.artId);
    if (!art) return [];
    return [
      {
        id: art.id,
        name: art.name,
        style: art.style,
        level: study.level,
        seasons: study.seasons,
        counts: study.seasons >= MIN_ART_SEASONS,
        skills: art.skills.map((skill) => ({
          id: skill.id,
          name: skill.name,
          value: skillValue(study.level, sportUnit(seed, gen, 'art-skill', art.id, skill.id)),
        })),
      },
    ];
  });
}

/** What a student is working towards, for a screen: the fight career their arts are a base for, if any yet. */
export function fightRoadOf(
  state: GameState,
): { readonly sportId: string; readonly form: number } | undefined {
  return fightCareerFor(
    artsOf(state).map((row) => ({ artId: row.artId, level: row.level, seasons: row.seasons })),
  );
}

/** The record a fighter has, as "18–2". Nothing for anybody else. */
export function recordOf(career: SportCareer | undefined): string | undefined {
  if (!career || career.wins === undefined) return undefined;
  return `${career.wins}–${career.losses ?? 0}`;
}

/**
 * Whether playing is the living: a day job ends, job offers stop, and the header says so. A team
 * or tour player is always full time; a club fighter is not, because the purses are not a wage.
 */
export function isFullTime(career: SportCareer | undefined): boolean {
  if (career?.stage !== 'pro') return false;
  const sport = findSport(career.sportId);
  if (!sport) return false;
  return tierRank(career.tier ?? 'fringe') >= tierRank(sport.economy.fullTimeFrom);
}

/**
 * Where a tour player stands in the world, 1 and up. A band by tier, moved within it by the year:
 * derived from what is saved, so there is nothing new to keep and nothing that can disagree with
 * the tier. Only a tour has one.
 */
export function worldRankOf(state: GameState): number | undefined {
  const career = state.sports.career;
  const sport = career ? findSport(career.sportId) : undefined;
  if (career?.stage !== 'pro' || sport?.format !== 'tour') return undefined;
  return worldRankFor(
    career.tier ?? 'fringe',
    sportUnit(state.rng.getSeed(), state.world.generation, 'rank', state.player.age),
  );
}

/* -------------------------------------------------------------------------- */
/* Studying an art                                                             */
/* -------------------------------------------------------------------------- */

export type ArtError =
  | 'no-such-art'
  | 'too-young'
  | 'already-studying'
  | 'too-many'
  | 'not-studying'
  | 'no-sessions-left'
  | 'is-your-career';

export const ART_ERROR_LABELS: Readonly<Record<ArtError, string>> = {
  'no-such-art': 'There is no such art.',
  'too-young': `Nobody starts before ${MARTIAL_ART_MIN_AGE}.`,
  'already-studying': "You're already studying that.",
  'too-many': `There are only hours for ${MAX_ARTS_AT_ONCE} at a time.`,
  'not-studying': "You aren't studying that.",
  'no-sessions-left': 'You have trained as much as the year allows.',
  'is-your-career': 'It is already your job.',
};

export interface ArtOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

function outcomeOf(
  state: GameState,
  arts: readonly ArtStudy[],
  text: string,
  id: string,
): ArtOutcome {
  const age = state.player.age;
  const sequence = state.player.timeline.filter((row) => row.age === age).length;
  const entry = createTimelineEntry({
    age,
    year: state.world.year,
    kind: 'passive',
    text,
    id: `t:${state.world.year}:sports:${id}`,
    sequence,
  });
  return {
    entry,
    state: {
      ...state,
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      sports: { ...state.sports, arts },
    },
  };
}

/** Begin studying an art. From ten, two at a time, and not the one that is already your career. */
export function startArt(state: GameState, artId: string): Result<ArtOutcome, ArtError> {
  const art = findMartialArt(artId);
  if (!art) return err('no-such-art');
  if (state.player.age < MARTIAL_ART_MIN_AGE) return err('too-young');
  const arts = artsOf(state);
  if (arts.some((row) => row.artId === artId)) return err('already-studying');
  if (arts.length >= MAX_ARTS_AT_ONCE) return err('too-many');
  const career = state.sports.career;
  if (career?.stage === 'pro' && art.feeds.includes(career.sportId as never)) {
    return err('is-your-career');
  }
  const study: ArtStudy = {
    artId,
    startedAge: state.player.age,
    seasons: 0,
    hardSeasons: 0,
    level: ART_START_LEVEL,
    trainedAtAge: -1,
    trainedCount: 0,
  };
  return ok(outcomeOf(state, [...arts, study], art.startLine, `art:start:${artId}`));
}

/** Stop. The level goes with it: a skill is readable only while it is studied. */
export function stopArt(state: GameState, artId: string): Result<ArtOutcome, ArtError> {
  const art = findMartialArt(artId);
  if (!art) return err('no-such-art');
  const arts = artsOf(state);
  if (!arts.some((row) => row.artId === artId)) return err('not-studying');
  return ok(
    outcomeOf(
      state,
      arts.filter((row) => row.artId !== artId),
      art.stopLine,
      `art:stop:${artId}`,
    ),
  );
}

/** The highest level work alone can reach for this character: what they are like, and `TRAINING_CAP` more. */
export function trainingCeiling(state: GameState): number {
  return Math.min(
    100,
    naturalForm(
      state.player.stats.health,
      state.player.stats.discipline,
      state.player.talents.athletics,
    ) + TRAINING_CAP,
  );
}

/** A session: three a year per art, each worth a little less than the last. */
export function trainArt(state: GameState, artId: string): Result<ArtOutcome, ArtError> {
  const art = findMartialArt(artId);
  if (!art) return err('no-such-art');
  const arts = artsOf(state);
  const study = arts.find((row) => row.artId === artId);
  if (!study) return err('not-studying');
  const age = state.player.age;
  const done = study.trainedAtAge === age ? study.trainedCount : 0;
  if (done >= PRACTICE_SESSIONS) return err('no-sessions-left');
  const gain = practiceGain(state.player.stats, study.level, done);
  const next: ArtStudy = {
    ...study,
    level: Math.min(trainingCeiling(state), study.level + gain),
    trainedAtAge: age,
    trainedCount: done + 1,
  };
  return ok(
    outcomeOf(
      state,
      arts.map((row) => (row.artId === artId ? next : row)),
      `Put in a session of ${art.name}.`,
      `art:train:${artId}:${done + 1}`,
    ),
  );
}

export interface ArtsYearOutput {
  readonly arts: readonly ArtStudy[];
  readonly lines: readonly string[];
  /** Dues for an adult living on their own, whole dollars. A child's lessons, or an adult's still at home, are the household's and are not billed. */
  readonly cost: number;
  /** What the dues were for, for the ledger. */
  readonly costSource: string;
}

/** A year of every art studied: the level drifts to what the character is, sessions add to it. */
export function runArtsYear(
  before: GameState,
  age: number,
  year: number,
  standard: number,
  withFamily = false,
): ArtsYearOutput {
  const lines: string[] = [];
  const kept: ArtStudy[] = [];
  let cost = 0;
  const sources: string[] = [];
  const natural = naturalForm(
    before.player.stats.health,
    before.player.stats.discipline,
    before.player.talents.athletics,
  );
  for (const study of before.sports.arts ?? []) {
    const art = findMartialArt(study.artId);
    if (!art) continue;
    // An adult living on their own pays their own way, and the first thing to go in a tight year is
    // the gym. A child, or an adult still at home, is the household's to pay and is not billed.
    const pays = age >= 18 && !withFamily;
    if (pays && !affordsFee(standard, art.annualCost)) {
      lines.push(`Let ${art.name} go. The dues were the first thing to cut.`);
      continue;
    }
    if (pays) {
      cost += art.annualCost;
      sources.push(art.costSource);
    }
    const hard =
      study.trainedAtAge === before.player.age && study.trainedCount >= HARD_WORK_SESSIONS;
    const pull = natural > study.level ? 0.3 : 0.1;
    const ageing = Math.max(0, age - 40) * 1.2;
    const level = Math.max(
      0,
      Math.min(100, Math.round(study.level + (natural - study.level) * pull - ageing)),
    );
    const seasons = study.seasons + 1;
    if (seasons === MIN_ART_SEASONS) {
      lines.push(`Three years of ${art.name}. The people at the gym take you seriously now.`);
    }
    kept.push({ ...study, level, seasons, hardSeasons: study.hardSeasons + (hard ? 1 : 0) });
  }
  void year;
  return {
    arts: kept,
    lines,
    cost,
    costSource:
      sources.length === 0
        ? 'Martial arts dues'
        : sources.length === 1
          ? capitalise(sources[0] as string)
          : `${capitalise(sources.slice(0, -1).join(', '))} and ${sources[sources.length - 1]}`,
  };
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/* -------------------------------------------------------------------------- */
/* The road in                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A gym puts you on a card, if it is going to. The road for boxing and MMA: no team, no college, so
 * this is checked every year from eighteen while there is no career and no question open, against
 * a draw that was made once for the life. A player who studies harder does not roll again; the
 * threshold rises under the same draw, so the late bloomer is real and the lucky one is not.
 */
export function turnProOffer(
  before: GameState,
  age: number,
  arts: readonly ArtStudy[],
):
  { readonly career: SportCareer; readonly offer: SportsOffer; readonly line: string } | undefined {
  if (age < TURN_PRO_MIN_AGE || age > TURN_PRO_MAX_AGE) return undefined;
  const road = fightCareerFor(
    arts.map((row) => ({ artId: row.artId, level: row.level, seasons: row.seasons })),
  );
  if (!road) return undefined;
  const sport = findSport(road.sportId);
  if (!sport || sport.format !== 'combat') return undefined;
  // One chance per sport: declined, or already a career once, is an answer.
  if (before.sports.past.some((row) => row.sportId === sport.id)) return undefined;

  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  // The arts that were the base: boxing for boxing; the best striking and grappling art for MMA.
  const base = baseArts(arts, sport);
  const seasons = base.reduce((total, row) => total + row.seasons, 0);
  const hardSeasons = base.reduce((total, row) => total + row.hardSeasons, 0);
  const category = categoryOf(before.player.talents.athletics, isHardWorker(seasons, hardSeasons));
  if (sportUnit(seed, gen, 'fighter', sport.id) >= REACH_PROS[category]) return undefined;

  const team = stablePick(sport.proTeams, `sports:gym:${seed}:${gen}:${sport.id}`) ?? '';
  const career: SportCareer = {
    sportId: sport.id,
    // The amateur years: a record of seasons, and no more, as a school team's are.
    stage: 'school',
    startedAge: Math.min(...base.map((row) => row.startedAge)),
    seasons,
    hardSeasons,
    form: road.form,
    trainedAtAge: -1,
    trainedCount: 0,
    reputation: 0,
    titles: 0,
    team,
    wins: 0,
    losses: 0,
  };
  return {
    career,
    offer: { kind: 'turn-pro', sportId: sport.id, team, age, eventId: OFFER_EVENT_ID },
    line: `${team} want to put you on a card. Years of work, and somebody was watching.`,
  };
}

/**
 * A place in a national program (ticket 0804), the Olympic sports' road in. Checked each year while there is
 * no career and no question open, against one draw for the life per sport and the lower `REACH_NATIONAL`
 * table. Boxing and wrestling only come here after the gym's question has been settled (the caller checks
 * the pro offer first), so a boxer is asked about the pros before the Games.
 */
export function nationalTeamOffer(
  before: GameState,
  age: number,
  arts: readonly ArtStudy[],
):
  { readonly career: SportCareer; readonly offer: SportsOffer; readonly line: string } | undefined {
  const road = olympicCareersFor(
    arts.map((row) => ({ artId: row.artId, level: row.level, seasons: row.seasons })),
  );
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  for (const candidate of road) {
    const sport = findSport(candidate.sportId);
    if (!sport || sport.format !== 'olympic') continue;
    const window = OLYMPIC_WINDOW[sport.id as keyof typeof OLYMPIC_WINDOW];
    if (age < window[0] || age > window[1]) continue;
    if (before.sports.past.some((row) => row.sportId === sport.id)) continue;
    const base = baseArts(arts, sport);
    const seasons = base.reduce((total, row) => total + row.seasons, 0);
    const hardSeasons = base.reduce((total, row) => total + row.hardSeasons, 0);
    const category = categoryOf(
      before.player.talents.athletics,
      isHardWorker(seasons, hardSeasons),
    );
    if (sportUnit(seed, gen, 'national', sport.id) >= REACH_NATIONAL[category]) continue;
    const team = stablePick(sport.proTeams, `sports:center:${seed}:${gen}:${sport.id}`) ?? '';
    const career: SportCareer = {
      sportId: sport.id,
      // The years before the program: a record of seasons, like an amateur fighter's.
      stage: 'school',
      startedAge: Math.min(...base.map((row) => row.startedAge)),
      seasons,
      hardSeasons,
      form: candidate.form,
      trainedAtAge: -1,
      trainedCount: 0,
      reputation: 0,
      titles: 0,
      team,
    };
    return {
      career,
      offer: { kind: 'national-team', sportId: sport.id, team, age, eventId: OFFER_EVENT_ID },
      line: `The ${sport.league} has a place for you at ${team}. Years of work, and somebody was watching.`,
    };
  }
  return undefined;
}

/** The studies a fight career is built from: the one art for boxing, the best of each style for MMA. */
export function baseArts(arts: readonly ArtStudy[], sport: Sport): readonly ArtStudy[] {
  const ready = arts.filter((row) => row.seasons >= MIN_ART_SEASONS);
  // An Olympic sport is built from whatever feeds it: swimming from swimming, the boxing program from boxing (ticket 0804).
  if (sport.format === 'olympic') {
    return ready.filter((row) => findMartialArt(row.artId)?.feeds.includes(sport.id));
  }
  if (sport.id === 'boxing') return ready.filter((row) => row.artId === 'boxing');
  const best = (style: MartialArt['style']): ArtStudy | undefined =>
    ready
      .filter((row) => findMartialArt(row.artId)?.style === style)
      .sort((a, b) => b.level - a.level)[0];
  return [best('striking'), best('grappling')].filter((row): row is ArtStudy => row !== undefined);
}

/** The tour card, at the end of college, in place of a draft. The same table decides who gets one. */
export function tourCardOffer(
  before: GameState,
  career: SportCareer,
  sport: Sport,
  age: number,
):
  { readonly career: SportCareer; readonly offer: SportsOffer; readonly line: string } | undefined {
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const category = categoryOf(
    before.player.talents.athletics,
    isHardWorker(career.seasons, career.hardSeasons),
  );
  if (sportUnit(seed, gen, 'draft', sport.id) >= draftChance(category)) return undefined;
  return {
    // The school and college game lets practice carry anybody towards 100; a tour does not (TRAINING_CAP).
    career: { ...career, tier: 'fringe', form: Math.min(career.form, trainingCeiling(before)) },
    offer: { kind: 'tour-card', sportId: sport.id, age, eventId: OFFER_EVENT_ID },
    line: `Earned a ${sport.leagueShort} card. The ${sport.league} is open to you.`,
  };
}

/* -------------------------------------------------------------------------- */
/* A professional season                                                       */
/* -------------------------------------------------------------------------- */

export interface IndividualSeasonOutput {
  /** The career as the season leaves it; when it ended, as it was. */
  readonly career: SportCareer;
  readonly ended?: PastCareer['how'];
  readonly lines: readonly { readonly kind: 'passive' | 'milestone'; readonly text: string }[];
  readonly records: readonly NewLifeRecord[];
  readonly pay: number;
  /** The Olympic medal won this year, if any (ticket 0804). */
  readonly medal?: Medal;
  readonly mood: number;
  readonly health: number;
}

/**
 * When a player retires: a range by the best tier they have reached, picked once by a hash of the
 * life. Computed each season and not saved, so a player who rises extends their own career, and a
 * fringe player's is short.
 */
export function retirementAge(sport: Sport, best: SportTier, seed: string, gen: number): number {
  return between(sportUnit(seed, gen, 'retire', sport.id), sport.economy.retireAge[best]);
}

const ordinal = (n: number): string => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen
    ? 'th'
    : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${suffix}`;
};

/** A year of results, for a tour player or a fighter. The year's one entry point for both. */
export function runIndividualSeason(input: {
  readonly before: GameState;
  readonly career: SportCareer;
  readonly sport: Sport;
  readonly age: number;
  readonly year: number;
}): IndividualSeasonOutput {
  const { before, career, sport, age, year } = input;
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const lines: IndividualSeasonOutput['lines'][number][] = [];
  const records: NewLifeRecord[] = [];
  const combat = sport.format === 'combat';
  const olympic = sport.format === 'olympic';
  const tour = sport.format === 'tour';

  const tier = (career.tier ?? 'fringe') as SportTier;
  const proSeasons = (career.proSeasons ?? 0) + 1;
  const hard =
    career.trainedAtAge === before.player.age && career.trainedCount >= HARD_WORK_SESSIONS;

  const injury = injuryOf(
    seed,
    gen,
    year,
    healthAdjusted(PRO_INJURY_CHANCE * sport.economy.injuryFactor, before.player.stats.health),
  );
  const missed = injury === 'serious' || injury === 'ending';
  // A serious injury costs a rung one time in three, as it does a team player.
  const lostRung = injury === 'serious' && sportUnit(seed, gen, 'tierloss', year) < 0.3;

  let wins = career.wins ?? 0;
  let losses = career.losses ?? 0;
  let seasonWins = 0;
  let seasonLosses = 0;
  // How the year went, on the scale of the fields: form, and what luck did.
  let performance = career.form;

  if (!missed) {
    if (combat) {
      const fights = FIGHTS_PER_YEAR[sport.id as 'boxing' | 'mma'][tier];
      let expected = 0;
      for (let index = 0; index < fights; index += 1) {
        const chance = fightWinChance(
          career.form,
          tier,
          sportUnit(seed, gen, 'opponent', year, index),
        );
        expected += chance;
        if (sportUnit(seed, gen, 'fight', year, index) < chance) seasonWins += 1;
        else seasonLosses += 1;
      }
      wins += seasonWins;
      losses += seasonLosses;
      performance = career.form + FIGHT_LUCK * (seasonWins - expected);
    } else {
      performance = career.form + (sportUnit(seed, gen, 'result', year) - 0.5) * TOUR_NOISE;
    }
  }

  let next: SportTier = tier;
  let ended: PastCareer['how'] | undefined;
  if (!missed) {
    const target = tierForPerformance(performance);
    if (tierRank(target) > tierRank(tier)) next = stepTier(tier, 1);
    else if (tierRank(target) < tierRank(tier)) next = stepTier(tier, -1);
    // A first season is not judged: nobody loses a card or a gym in the year they arrive.
    if (tier === 'fringe' && isOut(performance) && proSeasons > 1) {
      ended = combat ? 'released' : olympic ? 'cut' : 'lost-card';
    }
  }
  // A serious injury costs a rung one time in three, as it does a team player.
  if (lostRung && ended === undefined) next = stepTier(next, -1);
  const best = (
    tierRank(next) > tierRank(career.best ?? tier) ? next : (career.best ?? tier)
  ) as SportTier;

  const title = !missed && tour && sportUnit(seed, gen, 'title', year) < TOUR_TITLE_CHANCE[tier];
  // A belt: moving up into the top two rungs of a fight card is a title fight won.
  const belt = combat && next !== tier && tierRank(next) > tierRank(tier) && tierRank(next) >= 3;

  // The Games (ticket 0804): every fourth year the national team goes, and a year's results become a placing.
  const gamesYear = olympic && isGamesYear(year);
  const onTeam = tierRank(next) >= tierRank(GAMES_TEAM_TIER) && ended === undefined;
  let medal: Medal | undefined;
  let finalist = false;
  if (gamesYear && !missed && onTeam) {
    const games = performance + (sportUnit(seed, gen, 'games', year) - 0.5) * GAMES_NOISE;
    medal = medalFor(games);
    finalist = medal === undefined && games >= FINAL_LINE;
  }
  const medalPay = medal ? MEDAL_PRIZE[medal] + MEDAL_SPONSORSHIP[medal] : 0;

  const spread =
    PURSE_SPREAD[0] + sportUnit(seed, gen, 'purse', year) * (PURSE_SPREAD[1] - PURSE_SPREAD[0]);
  const base = sport.economy.pay[tier];
  const pay =
    (missed
      ? Math.round(base * MISSED_SEASON_PURSE)
      : Math.round(base * spread + (title || belt ? base * TITLE_PURSE_SHARE : 0))) + medalPay;

  const reputation = Math.max(
    0,
    Math.min(
      100,
      (career.reputation ?? 0) +
        TIER_REPUTATION[tier] +
        (title || belt || medal ? 6 : 0) -
        (missed ? 3 : 0),
    ),
  );

  const form = nextForm(before, career, age, sport.economy.declineFrom);
  const updated: SportCareer = {
    ...career,
    tier: next,
    best,
    proSeasons,
    seasons: career.seasons + 1,
    hardSeasons: career.hardSeasons + (hard ? 1 : 0),
    form: missed ? Math.max(0, form - 8) : form,
    reputation,
    titles: career.titles + (title || belt || medal ? 1 : 0),
    ...(combat ? { wins, losses } : {}),
  };

  /* ---- the words ---------------------------------------------------------- */
  if (combat) {
    const label = positionIn(seed, gen, sport).toLowerCase();
    if (!missed && seasonWins + seasonLosses > 0) {
      lines.push({
        kind: belt ? 'milestone' : 'passive',
        text: belt
          ? `Won the ${sport.leagueShort} ${label} title. ${seasonWins}–${seasonLosses} on the year, ${wins}–${losses} as a pro.`
          : `Went ${seasonWins}–${seasonLosses} this year. ${wins}–${losses} as a pro.`,
      });
    }
    if (next !== tier && !belt) {
      lines.push({
        kind: tierRank(next) > tierRank(tier) ? 'milestone' : 'passive',
        text:
          tierRank(next) > tierRank(tier)
            ? `The matchmakers are giving you better opponents. You are ${tierWords(next)} on the card now.`
            : `Back down the card after a bad run. You are ${tierWords(next)} now.`,
      });
    }
  } else if (olympic) {
    if (medal) {
      lines.push({
        kind: 'milestone',
        text: `Won an Olympic ${MEDAL_WORDS[medal]} medal. ${money(MEDAL_PRIZE[medal] + MEDAL_SPONSORSHIP[medal])} in prizes and sponsors came with it.`,
      });
    } else if (finalist) {
      lines.push({
        kind: 'milestone',
        text: 'Made the final at the Games and finished out of the medals.',
      });
    } else if (gamesYear && missed && onTeam) {
      lines.push({ kind: 'milestone', text: 'An injury kept you out of the Games.' });
    } else if (gamesYear && !missed && !onTeam && ended === undefined) {
      lines.push({ kind: 'passive', text: "Didn't make the team for the Games." });
    } else if (gamesYear && !missed && onTeam) {
      lines.push({ kind: 'passive', text: 'Went to the Games and went out early.' });
    }
    if (next !== tier && tierRank(next) > tierRank(tier)) {
      lines.push({
        kind: 'milestone',
        text: `The program is moving you up. You are ${tierWords(next)} on the national team now.`,
      });
    } else if (next !== tier) {
      lines.push({
        kind: 'passive',
        text: `Slipping down the national ranking. You are ${tierWords(next)} now.`,
      });
    }
  } else {
    if (!missed) {
      const rank = worldRankFor(next, sportUnit(seed, gen, 'rank', age));
      lines.push({
        kind: 'passive',
        text: title
          ? `Won a ${sport.leagueShort} event. Ended the year ranked ${ordinal(rank)} in the world.`
          : `Ended the year ranked ${ordinal(rank)} in the world.`,
      });
    } else if (title) {
      // Unreachable by construction (a title needs a healthy season); kept so a change cannot lose one silently.
      lines.push({ kind: 'milestone', text: `Won a ${sport.leagueShort} event.` });
    }
    if (next !== tier && tierRank(next) > tierRank(tier)) {
      lines.push({
        kind: 'milestone',
        text: `Climbing the rankings. You are ${tierWords(next)} now.`,
      });
    } else if (next !== tier) {
      lines.push({
        kind: 'passive',
        text: `Slipping down the rankings. You are ${tierWords(next)} now.`,
      });
    }
  }
  if (medal) {
    records.push({
      category: 'championship',
      label: `Olympic ${MEDAL_WORDS[medal]} medal in ${sport.noun}, ${year}`,
      referenceId: sport.id,
    });
  }
  if (title || belt) {
    records.push({
      category: 'championship',
      label: belt ? `Won the ${sport.leagueShort} title` : `Won a ${sport.leagueShort} event`,
      referenceId: sport.id,
    });
  }

  let mood = (title || belt ? 4 : 0) + (medal ? 6 : 0);
  let health = 0;
  if (injury === 'minor') {
    lines.push({
      kind: 'passive',
      text: pick(
        combat ? COMBAT_MINOR_LINES : olympic ? OLYMPIC_MINOR_LINES : TOUR_MINOR_LINES,
        `sports:injury:m:${year}`,
      ),
    });
  } else if (injury === 'serious') {
    lines.push({
      kind: 'passive',
      text: pick(
        combat ? COMBAT_SERIOUS_LINES : olympic ? OLYMPIC_SERIOUS_LINES : TOUR_SERIOUS_LINES,
        `sports:injury:s:${year}`,
      ),
    });
    health -= 4;
    mood -= 3;
  } else if (injury === 'ending') {
    health -= 6;
    mood -= 6;
  }

  if (injury === 'ending') {
    lines.push({
      kind: 'milestone',
      text: `An injury ended your ${sport.noun} career at ${age}.`,
    });
    ended = 'injury';
  } else if (ended === 'lost-card') {
    lines.push({
      kind: 'milestone',
      text: `Lost your ${sport.leagueShort} card after a year outside the places that count.`,
    });
  } else if (ended === 'cut') {
    lines.push({
      kind: 'milestone',
      text: `The ${sport.leagueShort} cut you from the national program after a year outside the places that count.`,
    });
  } else if (ended === 'released') {
    lines.push({
      kind: 'milestone',
      text: `${career.team ?? 'The gym'} stopped booking you after the losses.`,
    });
  } else if (age >= retirementAge(sport, best, seed, gen)) {
    lines.push({
      kind: 'milestone',
      text: `Retired from ${sport.noun} at ${age}, after ${proSeasons} ${proSeasons === 1 ? 'season' : 'seasons'}${
        combat ? ` and a record of ${wins}–${losses}` : ''
      }${updated.titles > 0 ? `, with ${updated.titles} ${olympic ? (updated.titles === 1 ? 'medal' : 'medals') : updated.titles === 1 ? 'title' : 'titles'}` : ''}.`,
    });
    ended = 'retired';
  }

  return {
    career: updated,
    ...(ended ? { ended } : {}),
    ...(medal ? { medal } : {}),
    lines,
    records,
    pay,
    mood,
    health,
  };
}

/* -------------------------------------------------------------------------- */
/* Answering the two new questions                                             */
/* -------------------------------------------------------------------------- */

const addRecord = (
  records: readonly LifeRecord[],
  record: NewLifeRecord,
  age: number,
  year: number,
): readonly LifeRecord[] => appendRecord(records, stampRecord(record, age, year, records.length));

/** The studies that became a career end with it: their level is the career's `form` now. */
export function withoutBase(arts: readonly ArtStudy[], sport: Sport): readonly ArtStudy[] {
  const used = new Set(baseArts(arts, sport).map((row) => row.artId));
  return arts.filter((row) => !used.has(row.artId));
}

export { addRecord as addSportsRecord };
