/**
 * Ticket 0801 — the sports engine.
 *
 * Until now a school team was the end of the road: tryouts, seasons and a
 * standing that nobody could do anything with after eighteen. Measured on 240
 * passive lives, 22 had athletics talent and none of them could be recruited,
 * drafted, signed or paid. This is the missing ladder, and it is written once
 * for any sport — a sport is a row in `@yearafter/content`'s `SPORTS`, and
 * basketball is the first.
 *
 *   school team  →  a scholarship offer at graduation  →  college seasons
 *      →  the draft  →  a contract (Accept / Request More / Decline)
 *      →  pro seasons: a tier, pay, injuries, titles, reputation  →  retirement
 *
 * THE ODDS ARE A TABLE, NOT A FORMULA. `REACH_PROS` and `BECOME_STAR` in the
 * content package are the answer a player gave; the two draws here (recruited,
 * then drafted) are sized to multiply back to it. Every draw is a hash of the
 * seed, the generation and a name — `sportUnit` — and touches no RNG stream,
 * so a life that never plays a sport replays exactly as it did before this
 * ticket, and a life that does replays the same career every time.
 *
 * Skills (`skillsOf`) exist only while the character is playing (spec 9 and
 * 343): once a career ends, what is kept is `PastCareer`, which holds none.
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
  BASE_TITLE_CHANCE,
  BREAKOUT_YEARS,
  CAREER_ENDING_SHARE,
  COLLEGE_INJURY_CHANCE,
  HARD_WORK_SESSIONS,
  PRO_INJURY_CHANCE,
  SERIOUS_SHARE,
  SERIOUS_TIER_LOSS_CHANCE,
  TIER_FAME,
  TIER_REPUTATION,
  TIER_TITLE_BONUS,
  between,
  categoryOf,
  draftChance,
  draftPickFor,
  findSport,
  isHardWorker,
  naturalForm,
  peakTierFor,
  recruitChance,
  rookiePay,
  rookieYears,
  roundOf,
  skillValue,
  sportOfActivity,
  sportReputationWord,
  stepTier,
  type Sport,
} from '@yearafter/content';
import { err, mixedUnit, ok, stablePick, type Result } from '@yearafter/core';
import {
  PRACTICE_SESSIONS,
  findMajor,
  practiceGain,
  practisedThisYear,
  programsOpenTo,
  type EducationState,
} from '@yearafter/education';
import type { PendingDecision } from '@yearafter/events';
import type { GameState } from './game-state';
import { cannotEnrol } from './college';
import { resign } from './careers';
import type { CareerTier, PastCareer, SportCareer, SportsOffer, SportsState } from './sports-state';

/** The reserved event id a sports question is raised under. */
export const SPORTS_OFFER_EVENT_ID = 'sports.offer';

export const isSportsOfferDecision = (eventId: string): boolean =>
  eventId === SPORTS_OFFER_EVENT_ID;

export const ACCEPT = 'accept';
export const REQUEST_MORE = 'more';
export const DECLINE = 'decline';

/* -------------------------------------------------------------------------- */
/* Draws                                                                       */
/* -------------------------------------------------------------------------- */

/** A [0, 1) draw about one life, keyed on the seed and a name. No RNG stream is touched. */
export const sportUnit = (
  seed: string,
  generation: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`sport:${seed}:${generation}:${parts.join(':')}`);

/* -------------------------------------------------------------------------- */
/* Reading a career                                                            */
/* -------------------------------------------------------------------------- */

export const careerOf = (state: GameState): SportCareer | undefined => state.sports.career;

/** In college or the pros: the rungs that are a life of their own rather than a school team. */
export const isPlaying = (career: SportCareer | undefined): career is SportCareer =>
  career !== undefined && career.stage !== 'school';

/** Whole dollars a year the scholarship pays towards tuition, while there is one. */
export const sportsAidOf = (state: GameState): number => {
  const career = state.sports.career;
  return career?.stage === 'college' ? (career.aid ?? 0) : 0;
};

/** Spec 9 and 343: the sport's skills are readable only while playing it. */
export function skillsOf(
  state: GameState,
): readonly { readonly id: string; readonly name: string; readonly value: number }[] {
  const career = state.sports.career;
  if (!isPlaying(career)) return [];
  const sport = findSport(career.sportId);
  if (!sport) return [];
  const seed = state.rng.getSeed();
  return sport.skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    value: skillValue(career.form, sportUnit(seed, state.world.generation, 'skill', skill.id)),
  }));
}

/**
 * The position a life plays, a label only (0802): drawn from the sport's list by
 * a hash of the life, so it is the same every time, costs no save field, and
 * has no effect on the odds, the pay or the skills.
 */
export function positionIn(seed: string, generation: number, sport: Sport): string {
  const list = sport.positions;
  return list[Math.floor(sportUnit(seed, generation, 'position', sport.id) * list.length)] ?? '';
}

/** The position of whoever is playing now, or none. For a screen's header. */
export function positionOf(state: GameState): string | undefined {
  const career = state.sports.career;
  const sport = career ? findSport(career.sportId) : undefined;
  if (!career || !sport) return undefined;
  return positionIn(state.rng.getSeed(), state.world.generation, sport);
}

const withArticle = (word: string): string =>
  `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word.toLowerCase()}`;

/** What a career is called, for a screen: the rung and the words. */
export function careerLabel(career: SportCareer): string {
  const sport = findSport(career.sportId);
  const name = sport?.noun ?? 'sport';
  if (career.stage === 'pro') {
    return career.team ? `${career.team}, ${name}` : `Professional ${name}`;
  }
  if (career.stage === 'college')
    return career.team ? `${career.team}, ${name}` : `College ${name}`;
  return `School ${name}`;
}

export const reputationOf = (career: SportCareer): string => sportReputationWord(career.reputation);

/** The fame a pro career holds a character at while it lasts, 0–100. Nothing before the pros. */
export function sportsFameOf(career: SportCareer | undefined): number {
  if (career?.stage !== 'pro' || career.tier === undefined) return 0;
  return Math.min(100, TIER_FAME[career.tier] + Math.min(15, career.titles * 4));
}

/** The header, for somebody who plays for a living. */
export function sportsOccupation(career: SportCareer | undefined): string | undefined {
  if (career?.stage !== 'pro') return undefined;
  return findSport(career.sportId)?.playerTitle;
}

/* -------------------------------------------------------------------------- */
/* Training                                                                    */
/* -------------------------------------------------------------------------- */

export type TrainError = 'not-playing' | 'no-sessions-left';

export const TRAIN_ERROR_LABELS: Readonly<Record<TrainError, string>> = {
  'not-playing': "You aren't playing a sport at that level.",
  'no-sessions-left': 'You have trained as much as the year allows.',
};

/**
 * Put in a session. At school, practice is the activity's own button (0206b);
 * this is the same thing for college and the pros, with the same three a year.
 * It moves the hidden form and counts towards being a hard worker.
 */
export function trainSport(
  state: GameState,
): Result<{ readonly state: GameState; readonly entry: TimelineEntry }, TrainError> {
  const career = state.sports.career;
  if (!isPlaying(career)) return err('not-playing');
  const age = state.player.age;
  const done = career.trainedAtAge === age ? career.trainedCount : 0;
  if (done >= PRACTICE_SESSIONS) return err('no-sessions-left');
  const gain = practiceGain(state.player.stats, career.form, done);
  const next: SportCareer = {
    ...career,
    form: Math.min(100, career.form + gain),
    trainedAtAge: age,
    trainedCount: done + 1,
  };
  const sport = findSport(career.sportId);
  const sequence = state.player.timeline.filter((row) => row.age === age).length;
  const entry = createTimelineEntry({
    age,
    year: state.world.year,
    kind: 'passive',
    text: `Put in extra work on your ${sport?.noun ?? 'game'}.`,
    id: `t:${state.world.year}:sports:train:${done + 1}`,
    sequence,
  });
  return ok({
    state: {
      ...state,
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      sports: { ...state.sports, career: next },
    },
    entry,
  });
}

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

export interface SportsYearInput {
  /** The state at the start of the year, before any phase ran. */
  readonly before: GameState;
  /** The school year's result: the education state as the year leaves it. */
  readonly education: EducationState;
  /** The age and the year being reached. */
  readonly age: number;
  readonly year: number;
}

export interface SportsYearLine {
  readonly kind: 'passive' | 'milestone';
  readonly text: string;
}

export interface SportsYearOutput {
  readonly sports: SportsState;
  readonly lines: readonly SportsYearLine[];
  readonly records: readonly NewLifeRecord[];
  /** Gross pay for the year, whole dollars. The caller taxes and posts it. */
  readonly pay: number;
  /** The fame a pro career holds at; 0 when there is none. The caller takes the higher of this and the creator figure. */
  readonly fame: number;
  /** What a stat gets from the year: a title is a lift, a serious injury a blow. */
  readonly mood: number;
  readonly health: number;
}

const NONE: SportsYearOutput = {
  sports: { past: [] },
  lines: [],
  records: [],
  pay: 0,
  fame: 0,
  mood: 0,
  health: 0,
};

const money = (dollars: number): string => {
  if (dollars >= 1_000_000) {
    const millions = dollars / 1_000_000;
    return `$${millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10} million`;
  }
  return `$${Math.round(dollars).toLocaleString('en-US')}`;
};

/** CORE_RULES 13.22: the base holds still for the life, the key moves it. */
function pick(lines: readonly string[], key: string): string {
  return stablePick(lines, key) ?? lines[0] ?? '';
}

export function runSportsYear(input: SportsYearInput): SportsYearOutput {
  const { before, education, age, year } = input;
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const lines: SportsYearLine[] = [];
  const records: NewLifeRecord[] = [];
  let sports = before.sports;
  let career = sports.career;
  let pay = 0;
  let fame = 0;
  let mood = 0;
  let health = 0;

  const finish = (how: PastCareer['how'], ended: SportCareer): void => {
    // A school team that never went anywhere is a season in the feed, not a career.
    if (ended.stage !== 'school') {
      const past: PastCareer = {
        sportId: ended.sportId,
        startedAge: ended.startedAge,
        endedAge: age,
        seasons: ended.seasons,
        titles: ended.titles,
        reputation: ended.reputation,
        reached: ended.stage,
        ...(ended.stage === 'pro' && ended.tier !== undefined
          ? { bestTier: bestTierOf(ended) }
          : {}),
        how,
      };
      sports = { ...sports, past: [...sports.past, past] };
    }
    career = undefined;
  };

  /* ---- school: on the team, and what graduating from it brings ---------- */
  if (career === undefined || career.stage === 'school') {
    /*
      A player can be on more than one team (ticket 0802 made five sports real). The road follows the
      one they have been playing, and when they have not started one yet, the one they are best at.
    */
    const teams = before.education.activities.flatMap((row) => {
      const found = sportOfActivity(row.activityId);
      return found ? [{ row, found }] : [];
    });
    const held =
      career?.stage === 'school'
        ? teams.find((team) => team.found.id === career?.sportId)
        : undefined;
    const chosen =
      held ??
      teams.reduce<(typeof teams)[number] | undefined>(
        (best, team) => (best === undefined || team.row.standing > best.row.standing ? team : best),
        undefined,
      );
    const entry = chosen?.row;
    const sport = chosen?.found;
    if (entry && sport) {
      const sessions = practisedThisYear(entry, before.player.age);
      const base: SportCareer =
        career?.stage === 'school' && career.sportId === sport.id
          ? career
          : {
              sportId: sport.id,
              stage: 'school',
              startedAge: before.player.age,
              seasons: 0,
              hardSeasons: 0,
              form: entry.standing,
              trainedAtAge: -1,
              trainedCount: 0,
              reputation: 0,
              titles: 0,
            };
      career = {
        ...base,
        seasons: base.seasons + 1,
        hardSeasons: base.hardSeasons + (sessions >= HARD_WORK_SESSIONS ? 1 : 0),
        form: entry.standing,
      };
      const graduating = before.education.stage === 'high' && education.stage === 'graduated';
      if (graduating) {
        const offer = scholarshipFor(before, education, career, sport, age);
        if (offer) {
          sports = { ...sports, offer };
        } else {
          career = undefined;
        }
      }
    } else if (career?.stage === 'school') {
      // They stopped playing, or were cut. The seasons were real; no road came of them.
      career = undefined;
    }
  } else if (career.stage === 'college') {
    /* ---- college: seasons, injuries, and the draft when it ends -------- */
    const stillThere = education.stage === 'college' && before.education.stage === 'college';
    const sport = findSport(career.sportId);
    const injuredBy = injuryOf(
      seed,
      gen,
      year,
      COLLEGE_INJURY_CHANCE * (sport?.economy.injuryFactor ?? 1),
    );
    const hard =
      career.trainedAtAge === before.player.age && career.trainedCount >= HARD_WORK_SESSIONS;
    const form = nextForm(before, career, age);
    career = {
      ...career,
      seasons: career.seasons + 1,
      collegeSeasons: (career.collegeSeasons ?? 0) + 1,
      hardSeasons: career.hardSeasons + (hard ? 1 : 0),
      form: injuredBy === 'serious' || injuredBy === 'ending' ? Math.max(0, form - 6) : form,
      reputation: Math.min(100, career.reputation + (form >= 55 ? 1 : 0)),
    };
    if (injuredBy === 'minor') {
      lines.push({
        kind: 'passive',
        text: pick(MINOR_INJURY_LINES, `sports:injury:minor:${year}`),
      });
    } else if (injuredBy === 'serious' || injuredBy === 'ending') {
      lines.push({ kind: 'passive', text: pick(COLLEGE_SERIOUS_LINES, `sports:injury:c:${year}`) });
      health -= 3;
    }
    if (!stillThere && sport) {
      const drafted = draftOffer(before, career, sport, age);
      if (drafted) {
        career = drafted.career;
        sports = { ...sports, offer: drafted.offer };
        lines.push({ kind: 'milestone', text: drafted.line });
      } else {
        const how: PastCareer['how'] =
          education.stage === 'graduated' ? 'undrafted' : 'left-college';
        lines.push({
          kind: 'milestone',
          text:
            how === 'undrafted'
              ? pick(UNDRAFTED_LINES, `sports:undrafted:${year}`)
              : `Left college and the ${sport.noun} team with it.`,
        });
        finish(how, career);
      }
    }
  } else if (career.stage === 'pro' && career.contract && career.tier && career.peak) {
    /* ---- the pros: a season, then whatever it left ----------------------- */
    const sport = findSport(career.sportId);
    const proSeasons = (career.proSeasons ?? 0) + 1;
    const hard =
      career.trainedAtAge === before.player.age && career.trainedCount >= HARD_WORK_SESSIONS;
    let peak = career.peak;
    const injury = injuryOf(
      seed,
      gen,
      year,
      healthAdjusted(
        PRO_INJURY_CHANCE * (sport?.economy.injuryFactor ?? 1),
        before.player.stats.health,
      ),
    );
    if (injury === 'serious' && sportUnit(seed, gen, 'tierloss', year) < SERIOUS_TIER_LOSS_CHANCE) {
      peak = stepTier(peak, -1);
    }
    const tier = tierAt(peak, career.breakout ?? 1, proSeasons, career.endAge ?? 99, age);
    const missed = injury === 'serious' || injury === 'ending';
    const title =
      !missed && sportUnit(seed, gen, 'title', year) < BASE_TITLE_CHANCE + TIER_TITLE_BONUS[tier];
    const form = nextForm(before, career, age);
    const reputation = Math.max(
      0,
      Math.min(100, career.reputation + TIER_REPUTATION[tier] + (title ? 6 : 0) - (missed ? 3 : 0)),
    );
    const contract = career.contract;
    pay = contract.salary;
    career = {
      ...career,
      peak,
      tier,
      proSeasons,
      seasons: career.seasons + 1,
      hardSeasons: career.hardSeasons + (hard ? 1 : 0),
      form: missed ? Math.max(0, form - 8) : form,
      reputation,
      titles: career.titles + (title ? 1 : 0),
      contract: { ...contract, yearsLeft: contract.yearsLeft - 1 },
    };

    const was = before.sports.career?.tier;
    if (was !== undefined && tier !== was) {
      const up = tierRank(tier) > tierRank(was);
      lines.push({
        kind: up ? 'milestone' : 'passive',
        text: up
          ? `${pick(RISE_LINES, `sports:rise:${year}`)} You are ${tierWords(tier)} now.`
          : `Slipping down the roster. You are ${tierWords(tier)} now.`,
      });
    }
    if (title && sport) {
      lines.push({
        kind: 'milestone',
        text: `${career.team ?? 'Your team'} won the ${sport.leagueShort} title.`,
      });
      records.push({
        category: 'championship',
        label: `Won the ${sport.leagueShort} title`,
        referenceId: sport.id,
      });
      mood += 4;
    }
    if (injury === 'minor') {
      lines.push({ kind: 'passive', text: pick(MINOR_INJURY_LINES, `sports:injury:m:${year}`) });
    } else if (injury === 'serious') {
      lines.push({ kind: 'passive', text: pick(SERIOUS_LINES, `sports:injury:s:${year}`) });
      health -= 4;
      mood -= 3;
    } else if (injury === 'ending') {
      health -= 6;
      mood -= 6;
    }
    fame = sportsFameOf({ ...career });

    if (injury === 'ending') {
      lines.push({
        kind: 'milestone',
        text: `An injury ended your ${sport?.noun ?? 'playing'} career at ${age}.`,
      });
      finish('injury', career);
    } else if (age >= (career.endAge ?? 99)) {
      lines.push({
        kind: 'milestone',
        text: `Retired from ${sport?.noun ?? 'the game'} at ${age}, after ${proSeasons} ${proSeasons === 1 ? 'season' : 'seasons'}${career.titles > 0 ? ` and ${career.titles} ${career.titles === 1 ? 'title' : 'titles'}` : ''}.`,
      });
      finish('retired', career);
    } else if (contract.yearsLeft - 1 <= 0 && sport) {
      sports = { ...sports, offer: resignOffer(before, career, sport, age) };
    }
  }

  const playing = career;
  sports = { ...sports, ...(playing ? { career: playing } : {}) };
  if (!playing) {
    const { career: _gone, ...rest } = sports;
    sports = rest;
  }
  return { ...NONE, sports, lines, records, pay, fame, mood, health };
}

/* -------------------------------------------------------------------------- */
/* Pieces of the year                                                          */
/* -------------------------------------------------------------------------- */

const tierRank = (tier: CareerTier): number =>
  (['fringe', 'role', 'starter', 'star', 'superstar'] as const).indexOf(tier);

const tierWords = (tier: CareerTier): string =>
  ({
    fringe: 'on the edge of the roster',
    role: 'a role player',
    starter: 'a starter',
    star: 'a star',
    superstar: 'a superstar',
  })[tier];

function bestTierOf(career: SportCareer): CareerTier {
  // The peak is what the career reached, so long as it got there; a career cut short is what it was.
  if (!career.peak) return career.tier ?? 'fringe';
  return (career.proSeasons ?? 0) >= (career.breakout ?? 1)
    ? career.peak
    : (career.tier ?? 'fringe');
}

/** Where a pro career is by season. A rookie is a step below, the end of a career a step down again. */
export function tierAt(
  peak: CareerTier,
  breakout: number,
  proSeasons: number,
  endAge: number,
  age: number,
): CareerTier {
  const risen = proSeasons >= breakout ? peak : stepTier(peak, -1);
  return age >= endAge - 2 ? stepTier(risen, -1) : risen;
}

function healthAdjusted(chance: number, health: number): number {
  return Math.max(0.03, Math.min(0.4, chance + (50 - health) * 0.0015));
}

type Injury = 'none' | 'minor' | 'serious' | 'ending';

function injuryOf(seed: string, gen: number, year: number, chance: number): Injury {
  if (sportUnit(seed, gen, 'injury', year) >= chance) return 'none';
  const severity = sportUnit(seed, gen, 'severity', year);
  if (severity < CAREER_ENDING_SHARE) return 'ending';
  if (severity < CAREER_ENDING_SHARE + SERIOUS_SHARE) return 'serious';
  return 'minor';
}

/** How good they are next year: a pull towards what health and discipline allow, and the years catching up. */
function nextForm(before: GameState, career: SportCareer, age: number): number {
  const natural = naturalForm(
    before.player.stats.health,
    before.player.stats.discipline,
    before.player.talents.athletics,
  );
  const pull = natural > career.form ? 0.3 : 0.1;
  const ageing = career.stage === 'pro' ? Math.max(0, age - 30) * 1.2 : 0;
  return Math.max(
    0,
    Math.min(100, Math.round(career.form + (natural - career.form) * pull - ageing)),
  );
}

/** The question graduating from a school team asks, if it is asked at all. */
function scholarshipFor(
  before: GameState,
  education: EducationState,
  career: SportCareer,
  sport: Sport,
  age: number,
): SportsOffer | undefined {
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const category = categoryOf(
    before.player.talents.athletics,
    isHardWorker(career.seasons, career.hardSeasons),
  );
  if (sportUnit(seed, gen, 'recruit', sport.id) >= recruitChance(category)) return undefined;

  const open = programsOpenTo(education.credentials, age).filter(
    (major) => major.kind === 'undergraduate',
  );
  const easier = open.filter((major) => major.difficulty <= 0.7);
  const pool = easier.length > 0 ? easier : open;
  const major = stablePick(
    pool.map((row) => row.id),
    `sports:major:${seed}:${gen}`,
  );
  const found = major ? findMajor(major) : undefined;
  if (!found) return undefined;
  const team = stablePick(sport.collegeTeams, `sports:college:${seed}:${gen}`);
  if (!team) return undefined;
  const cover: 'full' | 'partial' = career.form >= 62 ? 'full' : 'partial';
  return {
    kind: 'scholarship',
    sportId: sport.id,
    team,
    aid: cover === 'full' ? found.tuition : Math.round(found.tuition / 2),
    cover,
    majorId: found.id,
    age,
    eventId: SPORTS_OFFER_EVENT_ID,
  };
}

/** The draft, when college has ended and the career is still in it. */
function draftOffer(
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

  const peak = peakTierFor(
    category,
    sportUnit(seed, gen, 'star', sport.id),
    sportUnit(seed, gen, 'rank', sport.id),
  );
  const { economy } = sport;
  const pick = draftPickFor(peak, sportUnit(seed, gen, 'pick', sport.id), economy.draftSize);
  const team =
    stablePick(sport.proTeams, `sports:pro:${seed}:${gen}:${pick}`) ?? sport.proTeams[0]!;
  const breakout = between(sportUnit(seed, gen, 'breakout', sport.id), BREAKOUT_YEARS[peak]);
  // Drawn from the age they are drafted at, which is when the career starts: a late bloomer is a late retirement too.
  const endAge = between(sportUnit(seed, gen, 'retire', sport.id), economy.retireAge[peak]);
  const deal = rookieDeal(sport, pick);
  return {
    career: { ...career, peak, breakout, endAge, pick, tier: stepTier(peak, -1) },
    offer: {
      kind: 'contract',
      sportId: sport.id,
      team,
      salary: deal.salary,
      years: deal.years,
      rookie: true,
      pick,
      asked: false,
      age,
      eventId: SPORTS_OFFER_EVENT_ID,
    },
    line: `${deal.words} by the ${team}, as ${withArticle(positionIn(seed, gen, sport))}.`,
  };
}

/** What a first contract is for a pick: the pay on that sport's scale, the years, and the words for the round. */
export function rookieDeal(
  sport: Sport,
  pick: number,
): { readonly salary: number; readonly years: number; readonly words: string } {
  const { economy } = sport;
  return {
    salary: rookiePay(pick, economy),
    years: rookieYears(pick, economy.firstRound),
    words: draftedWords(pick, economy.firstRound),
  };
}

const ROUND_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'];

const ordinal = (n: number): string => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen
    ? 'th'
    : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th');
  return `${n}${suffix}`;
};

/** "Drafted number 14", or the round when it was not the first. */
export function draftedWords(pick: number, firstRound: number): string {
  if (pick <= firstRound) return `Drafted number ${pick}`;
  const round = roundOf(pick, firstRound);
  return `Drafted in the ${ROUND_WORDS[round - 1] ?? ordinal(round)} round`;
}

/** A new deal when one runs out: what the tier is worth, with a spread, and a little more for a name. */
function resignOffer(
  before: GameState,
  career: SportCareer,
  sport: Sport,
  age: number,
): SportsOffer {
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const tier = career.tier ?? 'fringe';
  const spread = 0.88 + sportUnit(seed, gen, 'market', age) * 0.26;
  const name = career.reputation >= 50 ? 1.06 : 1;
  const salary = Math.round((sport.economy.pay[tier] * spread * name) / 10_000) * 10_000;
  return {
    kind: 'contract',
    sportId: sport.id,
    team: career.team ?? sport.proTeams[0]!,
    salary,
    years: between(sportUnit(seed, gen, 'term', age), [1, tierRank(tier) >= 3 ? 5 : 3]),
    rookie: false,
    asked: false,
    age,
    eventId: SPORTS_OFFER_EVENT_ID,
  };
}

/* -------------------------------------------------------------------------- */
/* Raising the question                                                        */
/* -------------------------------------------------------------------------- */

function offerPrompt(offer: SportsOffer): string {
  if (offer.kind === 'scholarship') {
    const sport = findSport(offer.sportId);
    const major = findMajor(offer.majorId);
    const cover = offer.cover === 'full' ? 'a full' : 'a partial';
    return `${offer.team} want you. ${cover[0]!.toUpperCase()}${cover.slice(1)} ${sport?.noun ?? 'sports'} scholarship — ${money(offer.aid)} a year towards ${major?.name.toLowerCase() ?? 'a degree'}.`;
  }
  const years = `${offer.years} ${offer.years === 1 ? 'year' : 'years'}`;
  if (offer.rookie) {
    return `The ${offer.team} will sign you: ${money(offer.salary)} a year for ${years}.${offer.asked ? ' You have already asked once.' : ''}`;
  }
  return `Your contract is up. The ${offer.team} are offering ${money(offer.salary)} a year for ${years}.${offer.asked ? ' You have already asked once.' : ''}`;
}

function offerChoices(offer: SportsOffer): PendingDecision['choices'] {
  if (offer.kind === 'scholarship') {
    return [
      { id: ACCEPT, label: 'Take the scholarship' },
      { id: DECLINE, label: 'Turn it down' },
    ];
  }
  return [
    { id: ACCEPT, label: 'Sign it' },
    ...(offer.asked ? [] : [{ id: REQUEST_MORE, label: 'Ask for more' }]),
    { id: DECLINE, label: offer.rookie ? 'Turn it down' : 'Test free agency' },
  ];
}

export function sportsOfferDecision(offer: SportsOffer, year: number): PendingDecision {
  return {
    eventId: SPORTS_OFFER_EVENT_ID,
    category: offer.kind === 'scholarship' ? 'education' : 'career',
    age: offer.age,
    year,
    prompt: offerPrompt(offer),
    choices: offerChoices(offer),
    names: {},
  };
}

/**
 * Put the sport's question on the table, if the year raised one.
 *
 * Called at the end of `advanceYear`, innermost of the systemic doors: the year
 * a scholarship is on offer IS the year someone leaves school, and it is the
 * question that matters. `hasSystemicOffer` reads `sports.offer`, so every
 * other door stays shut behind it.
 */
export function withSportsOffer(state: GameState, alive: boolean): GameState {
  const offer = state.sports.offer;
  if (!alive || !offer) return state;
  if (state.pending.some((row) => row.eventId === SPORTS_OFFER_EVENT_ID)) return state;
  return { ...state, pending: [...state.pending, sportsOfferDecision(offer, state.world.year)] };
}

/* -------------------------------------------------------------------------- */
/* Answering                                                                   */
/* -------------------------------------------------------------------------- */

export type SportsOfferError = 'no-offer' | 'no-such-choice';

export interface SportsOfferOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

function withEntry(
  state: GameState,
  offer: SportsOffer,
  text: string,
  kind: 'milestone' | 'passive',
  tag: string,
): { readonly player: GameState['player']; readonly entry: TimelineEntry } {
  const sequence = state.player.timeline.filter((row) => row.age === offer.age).length;
  const entry = createTimelineEntry({
    age: offer.age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:sports:${tag}`,
    sequence,
  });
  return {
    entry,
    player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
  };
}

const addRecord = (
  records: readonly LifeRecord[],
  record: NewLifeRecord,
  age: number,
  year: number,
): readonly LifeRecord[] => appendRecord(records, stampRecord(record, age, year, records.length));

export function answerSportsOffer(
  state: GameState,
  choiceId: string,
): Result<SportsOfferOutcome, SportsOfferError> {
  const offer = state.sports.offer;
  const career = state.sports.career;
  if (!offer || !career) return err('no-offer');
  const allowed = offerChoices(offer).some((choice) => choice.id === choiceId);
  if (!allowed) return err('no-such-choice');

  const sport = findSport(offer.sportId);
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const { offer: _spent, ...sportsRest } = state.sports;
  const pending = state.pending.filter((row) => row.eventId !== SPORTS_OFFER_EVENT_ID);
  const settle = (
    sports: SportsState,
    text: string,
    kind: 'milestone' | 'passive',
    tag: string,
  ): Result<SportsOfferOutcome, SportsOfferError> => {
    const written = withEntry(state, offer, text, kind, tag);
    return ok({
      state: { ...state, player: written.player, sports, pending },
      entry: written.entry,
    });
  };

  /* ---- a scholarship -------------------------------------------------- */
  if (offer.kind === 'scholarship') {
    const ended = (text: string, tag: string): Result<SportsOfferOutcome, SportsOfferError> => {
      const { career: _c, ...without } = sportsRest;
      return settle({ ...without }, text, 'passive', tag);
    };
    if (choiceId === DECLINE) {
      return ended(`Turned down the ${offer.team} scholarship.`, 'scholarship:no');
    }
    const major = findMajor(offer.majorId);
    if (!major) return ended('The scholarship fell through.', 'scholarship:gone');

    let aid = offer.aid;
    const taking: SportCareer = {
      ...career,
      stage: 'college',
      team: offer.team,
      aid,
      collegeSeasons: 0,
    };
    // A scholarship that cannot be taken up for want of the rest is not a scholarship: the program finds it.
    const probe: GameState = { ...state, sports: { ...sportsRest, career: taking } };
    if (cannotEnrol(probe, major) === 'cannot-afford') {
      aid = major.tuition;
    }
    const blocked = cannotEnrol(
      { ...state, sports: { ...sportsRest, career: { ...taking, aid } } },
      major,
    );
    if (blocked !== undefined)
      return ended("It couldn't be taken up that year.", 'scholarship:blocked');

    const text = `${offer.team} signed you on ${aid >= major.tuition ? 'a full' : 'a partial'} ${sport?.noun ?? 'sports'} scholarship. ${major.name}, and a place on the team.`;
    const written = withEntry(state, offer, text, 'milestone', 'scholarship:yes');
    return ok({
      entry: written.entry,
      state: {
        ...state,
        player: {
          ...written.player,
          records: addRecord(
            written.player.records,
            { category: 'education', label: `Signed a ${sport?.noun ?? 'sports'} scholarship` },
            offer.age,
            state.world.year,
          ),
        },
        education: {
          ...state.education,
          stage: 'college',
          majorId: major.id,
          collegeYear: 0,
          enrolledAtAge: offer.age,
          appliedToCollegeAtAge: offer.age,
          studiedCount: 0,
        },
        sports: { ...sportsRest, career: { ...taking, aid } },
        pending,
      },
    });
  }

  /* ---- a contract ----------------------------------------------------- */
  if (choiceId === REQUEST_MORE) {
    const chance = askChance(career, offer);
    const lucky = sportUnit(seed, gen, 'ask', offer.age, offer.salary) < chance;
    const raised: SportsOffer = {
      ...offer,
      asked: true,
      salary: lucky
        ? Math.round(
            (offer.salary * (1.1 + sportUnit(seed, gen, 'askgain', offer.age) * 0.12)) / 10_000,
          ) * 10_000
        : offer.salary,
    };
    const text = lucky
      ? `You asked for more and the ${offer.team} came up to ${money(raised.salary)}.`
      : `You asked for more. The ${offer.team} held at ${money(offer.salary)}.`;
    const written = withEntry(state, offer, text, 'passive', `ask:${offer.age}`);
    return ok({
      entry: written.entry,
      state: {
        ...state,
        player: written.player,
        sports: { ...sportsRest, offer: raised, career },
        pending: [...pending, sportsOfferDecision(raised, state.world.year)],
      },
    });
  }

  if (choiceId === DECLINE) {
    if (offer.rookie || (career.tier ?? 'fringe') === 'fringe') {
      const how: PastCareer['how'] = offer.rookie ? 'declined' : 'unsigned';
      const past: PastCareer = {
        sportId: career.sportId,
        startedAge: career.startedAge,
        endedAge: offer.age,
        seasons: career.seasons,
        titles: career.titles,
        reputation: career.reputation,
        reached: career.stage === 'pro' ? 'pro' : 'college',
        ...(career.stage === 'pro' ? { bestTier: bestTierOf(career) } : {}),
        how,
      };
      const { career: _c, ...without } = sportsRest;
      return settle(
        { ...without, past: [...sportsRest.past, past] },
        offer.rookie
          ? `Turned down the ${offer.team}. That was the last offer.`
          : 'Went looking for a new deal and nobody called.',
        'milestone',
        'contract:no',
      );
    }
    // Free agency: a rival at the going rate, for a player worth one.
    const spread = 0.92 + sportUnit(seed, gen, 'fa', offer.age) * 0.14;
    const team =
      stablePick(
        (sport?.proTeams ?? []).filter((row) => row !== career.team),
        `sports:fa:${seed}:${gen}:${offer.age}`,
      ) ?? offer.team;
    const salary = Math.round((offer.salary * spread) / 10_000) * 10_000;
    const years = offer.years;
    const moved: SportCareer = {
      ...career,
      team,
      contract: { salary, yearsLeft: years, rookie: false },
    };
    return settle(
      { ...sportsRest, career: moved },
      `Left the ${offer.team} and signed with the ${team}: ${money(salary)} a year for ${years} ${years === 1 ? 'year' : 'years'}.`,
      'milestone',
      'contract:fa',
    );
  }

  // Accept.
  const signed: SportCareer = {
    ...career,
    stage: 'pro',
    team: offer.team,
    proSeasons: career.stage === 'pro' ? (career.proSeasons ?? 0) : 0,
    contract: { salary: offer.salary, yearsLeft: offer.years, rookie: offer.rookie },
    ...(career.stage === 'college' ? { tier: career.tier ?? 'fringe' } : {}),
  };
  // A first contract is a full-time job: whatever else they were doing for a living ends (ticket 0801).
  const left = offer.rookie && state.employment.job !== undefined ? resign(state) : undefined;
  // One answer is one line in the feed (ticket 0301's budget), so the job's own "left" line is folded into this one.
  const base: GameState = left?.ok
    ? {
        ...left.value.state,
        player: {
          ...left.value.state.player,
          timeline: left.value.state.player.timeline.filter(
            (row) => row.id !== left.value.entry.id,
          ),
        },
      }
    : state;
  const years = `${offer.years} ${offer.years === 1 ? 'year' : 'years'}`;
  const text = offer.rookie
    ? `Signed with the ${offer.team}: ${money(offer.salary)} a year for ${years}.${left?.ok ? ' That was the end of the day job.' : ''}`
    : `Re-signed with the ${offer.team}: ${money(offer.salary)} a year for ${years}.`;
  const written = withEntry(
    base,
    offer,
    text,
    'milestone',
    `contract:${offer.rookie ? 'sign' : 'resign'}`,
  );
  return ok({
    entry: written.entry,
    state: {
      ...base,
      player: {
        ...written.player,
        records: offer.rookie
          ? addRecord(
              written.player.records,
              {
                category: 'career',
                label: `Drafted by the ${offer.team}`,
                ...(sport ? { referenceId: sport.id } : {}),
              },
              offer.age,
              state.world.year,
            )
          : written.player.records,
      },
      // Playing for a living is the occupation from the day it is signed.
      sports: { ...sportsRest, career: signed },
      pending,
    },
  });
}

/** The chance a team comes up when asked: a name helps, and so does being worth it. */
function askChance(career: SportCareer, offer: SportsOffer): number {
  const tier = career.tier ?? 'fringe';
  const base = [0.25, 0.3, 0.4, 0.5, 0.6][tierRank(tier)] ?? 0.25;
  const name = Math.min(0.15, career.reputation / 400);
  const rookie = offer.kind === 'contract' && offer.rookie ? -0.1 : 0;
  return Math.max(0.1, Math.min(0.8, base + name + rookie));
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

const MINOR_INJURY_LINES: readonly string[] = [
  'A sprained ankle cost you a few games.',
  'Missed two weeks with a bruised knee.',
  'Played through a sore shoulder, and it showed.',
];

const SERIOUS_LINES: readonly string[] = [
  'Tore something in your knee and missed the rest of the season.',
  'A broken foot ended your season in December.',
  'Surgery in the spring, and a long summer of rehab.',
];

const COLLEGE_SERIOUS_LINES: readonly string[] = [
  'An injury ended your season early.',
  'Missed most of the year with a bad knee.',
];

const UNDRAFTED_LINES: readonly string[] = [
  'The draft came and went without your name in it.',
  'Nobody called on draft night. The phone stayed quiet until morning.',
  'Went undrafted. The scouts liked the tape and not the rest.',
];

const RISE_LINES: readonly string[] = [
  'The coach started handing you the ball.',
  'Something clicked this season.',
  'You stopped being the young one on the bench.',
];
