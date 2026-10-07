/**
 * Ticket 0804 — after the playing: coaching and commentary.
 *
 * The spec: post-career options include college, pro and overseas coaching and commentary, and a strong
 * prior career improves access. The rules here:
 *
 *   - Any retired athlete from any sport (0801–0804) can be offered one post in a life, built from the
 *     best career they had. The offer comes one to three years after the career ended, if a single draw
 *     for the life says so; the draw's threshold is `postChance`, which a better career raises.
 *   - The level of the job is the best the career opens: a fringe pro gets a college job at best, a
 *     starter a pro one, a champion a national commentator's chair. `postLevelsFor` in content.
 *   - A post pays from the first year, a little more every year, and ends at sixty-eight or when the
 *     person leaves. A coach's job is a living and ends a day job; a local commentator keeps theirs.
 *
 * Every draw is a hash, so no RNG stream is touched.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  POST_END_AGE,
  POST_JOBS,
  POST_OFFER_MAX_AGE,
  findSport,
  pastScore,
  postChance,
  postLevelsFor,
  postPay,
  type PastQuality,
  type PostLevel,
} from '@yearafter/content';
import { err, ok, type Result } from '@yearafter/core';
import type { GameState } from './game-state';
import { sportUnit } from './sports-core';
import type { PastCareer, PostJob, SportsOffer } from './sports-state';

const OFFER_EVENT_ID = 'sports.offer';

/** The post that is being held now, if one is. */
export const postOf = (state: GameState): PostJob | undefined =>
  state.sports.post && !state.sports.post.over ? state.sports.post : undefined;

export const isPostFullTime = (post: PostJob | undefined): boolean =>
  post !== undefined && !post.over && POST_JOBS[post.level].fullTime;

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** What a post is called: "College basketball coach", "Local boxing commentator". */
export function postTitle(post: Pick<PostJob, 'sportId' | 'level'>): string {
  const sport = findSport(post.sportId);
  const noun = sport?.noun ?? 'sports';
  const words = POST_JOBS[post.level].words;
  const [first, ...rest] = words.split(' ');
  // "college coach" becomes "College basketball coach"; "national analyst" becomes "National basketball analyst".
  return capitalise([first, noun, ...rest].join(' '));
}

/** The header, for somebody whose living is a post. Nothing for a part-time one. */
export function postOccupation(post: PostJob | undefined): string | undefined {
  return isPostFullTime(post) && post ? postTitle(post) : undefined;
}

/** A year's gross pay in a post, whole dollars. */
export const postPayOf = (post: PostJob): number => postPay(post.level, post.seasons);

const qualityOf = (past: PastCareer): PastQuality => ({
  reached: past.reached,
  ...(past.bestTier ? { bestTier: past.bestTier } : {}),
  titles: past.titles,
  seasons: past.seasons,
});

/** The career a post follows: the best the life has had, by `pastScore`. A school team that went nowhere is not one. */
export function bestPast(past: readonly PastCareer[]): PastCareer | undefined {
  let best: PastCareer | undefined;
  for (const row of past) {
    if (row.reached === 'school') continue;
    if (!best || pastScore(qualityOf(row)) > pastScore(qualityOf(best))) best = row;
  }
  return best;
}

/**
 * The offer of a post, if the year raises one. Raised once in a life: a life that turned one down, or
 * held one, is never asked again. The caller checks that there is no career and no question open.
 */
export function postOffer(
  before: GameState,
  age: number,
): { readonly offer: SportsOffer; readonly line: string } | undefined {
  if (before.sports.post !== undefined) return undefined;
  if (age > POST_OFFER_MAX_AGE) return undefined;
  const best = bestPast(before.sports.past);
  if (!best) return undefined;
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const delay = 1 + Math.floor(sportUnit(seed, gen, 'postdelay', best.sportId) * 3);
  if (age < best.endedAge + delay) return undefined;
  const quality = qualityOf(best);
  if (sportUnit(seed, gen, 'post', best.sportId) >= postChance(quality)) return undefined;
  const levels = postLevelsFor(quality);
  const level: PostLevel | undefined =
    levels.coach && levels.commentary
      ? sportUnit(seed, gen, 'postkind', best.sportId) < 0.65
        ? levels.coach
        : levels.commentary
      : (levels.coach ?? levels.commentary);
  if (!level) return undefined;
  const row = POST_JOBS[level];
  const sport = findSport(best.sportId);
  return {
    offer: {
      kind: 'post-job',
      sportId: best.sportId,
      postKind: row.kind,
      level,
      age,
      eventId: OFFER_EVENT_ID,
    },
    line: `Somebody remembered the ${sport?.noun ?? 'sports'} career. There is a ${row.words} job on the table.`,
  };
}

export interface PostYearOutput {
  readonly post: PostJob | undefined;
  readonly pay: number;
  readonly lines: readonly string[];
}

/** A year in a post: the pay, a year more seniority, and the end of it at sixty-eight. */
export function runPostYear(post: PostJob | undefined, age: number): PostYearOutput {
  if (!post || post.over) return { post, pay: 0, lines: [] };
  const pay = postPayOf(post);
  const next: PostJob = { ...post, seasons: post.seasons + 1 };
  if (age >= POST_END_AGE) {
    return {
      post: { ...next, over: true },
      pay,
      lines: [`Retired from the ${POST_JOBS[post.level].words} job at ${age}.`],
    };
  }
  return { post: next, pay, lines: [] };
}

export type PostError = 'no-post';

/** Leave the post. The question is not asked again in this life. */
export function leavePost(
  state: GameState,
): Result<{ readonly state: GameState; readonly entry: TimelineEntry }, PostError> {
  const post = postOf(state);
  if (!post) return err('no-post');
  const age = state.player.age;
  const sequence = state.player.timeline.filter((row) => row.age === age).length;
  const entry = createTimelineEntry({
    age,
    year: state.world.year,
    kind: 'milestone',
    text: `Left the job as a ${POST_JOBS[post.level].words}.`,
    id: `t:${state.world.year}:sports:post:left`,
    sequence,
  });
  return ok({
    entry,
    state: {
      ...state,
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      sports: { ...state.sports, post: { ...post, over: true } },
    },
  });
}
