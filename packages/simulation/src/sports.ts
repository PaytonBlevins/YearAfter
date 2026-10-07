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
  COLLEGE_INJURY_CHANCE,
  HARD_WORK_SESSIONS,
  PRO_INJURY_CHANCE,
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
import { err, ok, stablePick, type Result } from '@yearafter/core';
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
import { POST_JOBS } from '@yearafter/content';
import { postOffer, postOccupation, postTitle, runPostYear } from './sports-post';
import type {
  CareerTier,
  PastCareer,
  PostJob,
  SportCareer,
  SportsOffer,
  SportsState,
} from './sports-state';
import {
  addSportsRecord,
  isFullTime,
  nationalTeamOffer,
  runArtsYear,
  runIndividualSeason,
  trainingCeiling,
  tourCardOffer,
  turnProOffer,
  withoutBase,
} from './sports-individual';
import {
  COLLEGE_SERIOUS_LINES,
  MINOR_INJURY_LINES,
  SERIOUS_LINES,
  bestTierOf,
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

export { positionIn, sportUnit } from './sports-core';

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
    // A tour has no club to name: the circuit is the label (ticket 0803).
    if (sport?.format === 'tour' || sport?.format === 'olympic') return sport.league;
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
export function sportsOccupation(
  career: SportCareer | undefined,
  post?: PostJob,
): string | undefined {
  // A club fighter has a day job, and it is still what the header says (ticket 0803).
  if (isFullTime(career)) return findSport(career!.sportId)?.playerTitle;
  // A coach, or a national commentator, after the playing (ticket 0804).
  return postOccupation(post);
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
  const sport = findSport(career.sportId);
  // Work lifts an individual player only so far (ticket 0803); a team player's practice is as it was.
  const ceiling = sport && sport.format !== 'team' ? trainingCeiling(state) : 100;
  const next: SportCareer = {
    ...career,
    form: Math.min(Math.max(career.form, ceiling), career.form + gain),
    trainedAtAge: age,
    trainedCount: done + 1,
  };
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
  /** The household's standard of living, whole dollars: what an adult's gym dues are weighed against. */
  readonly standard?: number;
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
  /** Ticket 0803. An adult's martial-arts dues for the year, whole dollars, and what they were for. */
  readonly fees: number;
  readonly feeSource: string;
}

const NONE: SportsYearOutput = {
  sports: { past: [] },
  lines: [],
  records: [],
  pay: 0,
  fame: 0,
  mood: 0,
  health: 0,
  fees: 0,
  feeSource: '',
};

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
          ? { bestTier: ended.best ?? bestTierOf(ended) }
          : {}),
        ...(ended.wins !== undefined ? { wins: ended.wins, losses: ended.losses ?? 0 } : {}),
        how,
      };
      sports = { ...sports, past: [...sports.past, past] };
    }
    career = undefined;
  };

  /* ---- martial arts: every art studied has its year (ticket 0803) -------- */
  const artsYear = runArtsYear(
    before,
    age,
    year,
    input.standard ?? 0,
    before.household.housing === 'withFamily',
  );
  for (const text of artsYear.lines) lines.push({ kind: 'passive', text });
  if (artsYear.arts.length > 0) {
    sports = { ...sports, arts: artsYear.arts };
  } else {
    const { arts: _stopped, ...withoutArts } = sports;
    sports = withoutArts;
  }
  // An amateur fighter is a career waiting on an answer, not a school team to be walked away from.
  const amateurFormat = career?.stage === 'school' ? findSport(career.sportId)?.format : undefined;
  const amateur = amateurFormat === 'combat' || amateurFormat === 'olympic';

  /* ---- school: on the team, and what graduating from it brings ---------- */
  if (career === undefined || career.stage === 'school') {
    /*
      A player can be on more than one team (ticket 0802 made five sports real). The road follows the
      one they have been playing, and when they have not started one yet, the one they are best at.
    */
    const teams = amateur
      ? []
      : before.education.activities.flatMap((row) => {
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
    } else if (career?.stage === 'school' && !amateur) {
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
      // A tour has no draft: the same table decides who is let in (ticket 0803).
      const drafted =
        sport.format === 'tour'
          ? tourCardOffer(before, career, sport, age)
          : draftOffer(before, career, sport, age);
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
  } else if (career.stage === 'pro' && findSport(career.sportId)?.format !== 'team') {
    /* ---- a tour or a fight card: results decide the year (ticket 0803) -- */
    const sport = findSport(career.sportId);
    if (sport) {
      const season = runIndividualSeason({ before, career, sport, age, year });
      career = season.career;
      pay = season.pay;
      mood += season.mood;
      health += season.health;
      lines.push(...season.lines);
      records.push(...season.records);
      fame = sportsFameOf(career);
      if (season.ended) finish(season.ended, career);
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

  /* ---- a gym wants you (ticket 0803): boxing and MMA have no team to be cut from ---- */
  if (career === undefined && sports.offer === undefined) {
    const found = turnProOffer(before, age, artsYear.arts);
    if (found) {
      career = found.career;
      sports = { ...sports, offer: found.offer };
      lines.push({ kind: 'milestone', text: found.line });
    }
  }

  /* ---- a place in a national program (ticket 0804) ---- */
  if (career === undefined && sports.offer === undefined) {
    const found = nationalTeamOffer(before, age, artsYear.arts);
    if (found) {
      career = found.career;
      sports = { ...sports, offer: found.offer };
      lines.push({ kind: 'milestone', text: found.line });
    }
  }

  /* ---- after the playing: a coaching or commentary post (ticket 0804) ---- */
  if (sports.post && !sports.post.over) {
    const year = runPostYear(sports.post, age);
    if (year.post) sports = { ...sports, post: year.post };
    pay += year.pay;
    for (const text of year.lines) lines.push({ kind: 'milestone', text });
  } else if (career === undefined && sports.offer === undefined) {
    const found = postOffer({ ...before, sports }, age);
    if (found) {
      sports = { ...sports, offer: found.offer };
      lines.push({ kind: 'milestone', text: found.line });
    }
  }

  const playing = career;
  sports = { ...sports, ...(playing ? { career: playing } : {}) };
  if (!playing) {
    const { career: _gone, ...rest } = sports;
    sports = rest;
  }
  return {
    ...NONE,
    sports,
    lines,
    records,
    pay,
    fame,
    mood,
    health,
    fees: artsYear.cost,
    feeSource: artsYear.costSource,
  };
}

/* -------------------------------------------------------------------------- */
/* Pieces of the year                                                          */
/* -------------------------------------------------------------------------- */

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
  if (offer.kind === 'tour-card') {
    const sport = findSport(offer.sportId);
    return `The ${sport?.league ?? 'tour'} has a card for you. No salary and no team: prize money, and whatever the results earn.`;
  }
  if (offer.kind === 'turn-pro') {
    const sport = findSport(offer.sportId);
    return `${offer.team} will put you on a ${sport?.noun ?? 'fight'} card. The first purses are small, and the rest of your life stays where it is.`;
  }
  if (offer.kind === 'national-team') {
    const sport = findSport(offer.sportId);
    return `The ${sport?.league ?? 'national program'} has a place for you at ${offer.team}. A stipend, a coach, and a chance at the Games.`;
  }
  if (offer.kind === 'post-job') {
    const row = POST_JOBS[offer.level];
    const sport = findSport(offer.sportId);
    return `There is a job as a ${sport?.noun ?? 'sports'} ${row.words}: ${money(row.pay)} a year${row.fullTime ? ', and a full-time one' : ', beside whatever else you do'}.`;
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
  if (offer.kind === 'tour-card') {
    return [
      { id: ACCEPT, label: 'Take the card' },
      { id: DECLINE, label: 'Turn it down' },
    ];
  }
  if (offer.kind === 'turn-pro') {
    return [
      { id: ACCEPT, label: 'Turn pro' },
      { id: DECLINE, label: 'Stay an amateur' },
    ];
  }
  if (offer.kind === 'national-team') {
    return [
      { id: ACCEPT, label: 'Join the program' },
      { id: DECLINE, label: 'Not now' },
    ];
  }
  if (offer.kind === 'post-job') {
    return [
      { id: ACCEPT, label: 'Take the job' },
      { id: DECLINE, label: 'Not for me' },
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

/** The answer to a coaching or commentary job (ticket 0804). There is no career to settle: the post is what is kept. */
function answerPostOffer(
  state: GameState,
  offer: Extract<SportsOffer, { kind: 'post-job' }>,
  choiceId: string,
): Result<SportsOfferOutcome, SportsOfferError> {
  if (!offerChoices(offer).some((choice) => choice.id === choiceId)) return err('no-such-choice');
  const { offer: _spent, ...sportsRest } = state.sports;
  const pending = state.pending.filter((row) => row.eventId !== SPORTS_OFFER_EVENT_ID);
  const row = POST_JOBS[offer.level];
  const sport = findSport(offer.sportId);
  const post: PostJob = {
    sportId: offer.sportId,
    kind: offer.postKind,
    level: offer.level,
    since: offer.age,
    seasons: 0,
  };
  if (choiceId === DECLINE) {
    const written = withEntry(
      state,
      offer,
      `Turned down the ${sport?.noun ?? 'sports'} ${row.words} job.`,
      'passive',
      'post:no',
    );
    return ok({
      entry: written.entry,
      state: {
        ...state,
        player: written.player,
        sports: { ...sportsRest, post: { ...post, over: true } },
        pending,
      },
    });
  }
  // A coach's job is a living and ends a day job; a local commentator keeps theirs.
  const left = row.fullTime && state.employment.job !== undefined ? resign(state) : undefined;
  const base: GameState = left?.ok
    ? {
        ...left.value.state,
        player: {
          ...left.value.state.player,
          timeline: left.value.state.player.timeline.filter(
            (entry) => entry.id !== left.value.entry.id,
          ),
        },
      }
    : state;
  const written = withEntry(
    base,
    offer,
    `Took the job as a ${sport?.noun ?? 'sports'} ${row.words}.${left?.ok ? ' That was the end of the day job.' : ''}`,
    'milestone',
    'post:yes',
  );
  return ok({
    entry: written.entry,
    state: {
      ...base,
      player: {
        ...written.player,
        records: addRecord(
          written.player.records,
          {
            category: 'career',
            label: `Became a ${postTitle(post).toLowerCase()}`,
            referenceId: offer.sportId,
          },
          offer.age,
          state.world.year,
        ),
      },
      sports: { ...sportsRest, post },
      pending,
    },
  });
}

export function answerSportsOffer(
  state: GameState,
  choiceId: string,
): Result<SportsOfferOutcome, SportsOfferError> {
  const offer = state.sports.offer;
  const career = state.sports.career;
  if (offer?.kind === 'post-job') return answerPostOffer(state, offer, choiceId);
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

  /* ---- the tour card, or a gym's offer (ticket 0803) ----------------- */
  if (offer.kind === 'tour-card' || offer.kind === 'turn-pro' || offer.kind === 'national-team') {
    const proTour = offer.kind === 'tour-card';
    const program = offer.kind === 'national-team';
    if (choiceId === DECLINE) {
      const past: PastCareer = {
        sportId: career.sportId,
        startedAge: career.startedAge,
        endedAge: offer.age,
        seasons: career.seasons,
        titles: 0,
        reputation: career.reputation,
        reached: proTour ? 'college' : 'school',
        how: 'declined',
        ...(proTour || program ? {} : { wins: 0, losses: 0 }),
      };
      const { career: _c, ...without } = sportsRest;
      return settle(
        { ...without, past: [...sportsRest.past, past] },
        proTour
          ? `Turned down the ${sport?.leagueShort ?? 'tour'} card.`
          : program
            ? `Turned down a place in the ${sport?.leagueShort ?? 'national'} program.`
            : `Turned down ${offer.kind === 'turn-pro' ? offer.team : 'the gym'} and stayed an amateur.`,
        'milestone',
        proTour ? 'tour:no' : program ? 'nat:no' : 'pro:no',
      );
    }
    // A tour has no club: the college the player came from stops being their team the day they leave it.
    const { team: _college, ...careerNoTeam } = career;
    const signed: SportCareer = {
      ...(proTour ? careerNoTeam : career),
      stage: 'pro',
      tier: 'fringe',
      proSeasons: 0,
      ...(offer.kind === 'turn-pro' ? { team: offer.team, wins: 0, losses: 0 } : {}),
    };
    // Playing for a living ends the day job. A club fighter's purses are not a living, and the job stays.
    const living = isFullTime(signed);
    const left = living && state.employment.job !== undefined ? resign(state) : undefined;
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
    const arts = sport ? withoutBase(sportsRest.arts ?? [], sport) : (sportsRest.arts ?? []);
    const { arts: _used, ...restNoArts } = sportsRest;
    const text = proTour
      ? `Took the ${sport?.leagueShort ?? 'tour'} card.${left?.ok ? ' That was the end of the day job.' : ''}`
      : program
        ? `Joined the ${sport?.leagueShort ?? 'national'} program at ${offer.team}.`
        : `Signed with ${offer.kind === 'turn-pro' ? offer.team : 'the gym'}. The first fight is in the spring.${left?.ok ? ' That was the end of the day job.' : ''}`;
    const written = withEntry(
      base,
      offer,
      text,
      'milestone',
      proTour ? 'tour:yes' : program ? 'nat:yes' : 'pro:yes',
    );
    return ok({
      entry: written.entry,
      state: {
        ...base,
        player: {
          ...written.player,
          records: addSportsRecord(
            written.player.records,
            {
              category: 'career',
              label: proTour
                ? `Earned a ${sport?.leagueShort ?? 'tour'} card`
                : program
                  ? `Joined the ${sport?.leagueShort ?? 'national'} program`
                  : `Turned pro as a ${sport?.noun ?? 'fighter'} fighter`,
              ...(sport ? { referenceId: sport.id } : {}),
            },
            offer.age,
            state.world.year,
          ),
        },
        sports: { ...restNoArts, ...(arts.length > 0 ? { arts } : {}), career: signed },
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
