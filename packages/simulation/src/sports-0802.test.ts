/**
 * Ticket 0802 acceptance tests — football, baseball, soccer and hockey.
 *
 * The engine is 0801's and is not touched; a sport is a row of data. These tests pin the rows (the real
 * league minimums, the careers, the drafts), the position label (derived, never saved), and that the same
 * ladder and the same odds hold in every sport when played through the game.
 */

import { describe, expect, it } from 'vitest';
import {
  TEAM_SPORTS,
  TIERS,
  draftPickFor,
  findActivity,
  findSport,
  rookiePay,
  rookieYears,
  roundOf,
  sportOfActivity,
  type Sport,
} from '@yearafter/content';
import { advanceYear } from './advance';
import { decide } from './decide';
import { createNewGame } from './new-game';
import type { GameState } from './game-state';
import { tryOut } from './tryout';
import { practise } from './practice';
import {
  ACCEPT,
  SPORTS_OFFER_EVENT_ID,
  careerOf,
  isPlaying,
  positionIn,
  positionOf,
  draftedWords,
  rookieDeal,
  runSportsYear,
  trainSport,
} from './sports';

const OTHER_SPORTS = TEAM_SPORTS.filter((sport) => sport.id !== 'basketball');

describe('the rows', () => {
  it('has five sports, each with a real school team, five skills and a list of positions', () => {
    expect(TEAM_SPORTS.map((sport) => sport.id)).toEqual([
      'basketball',
      'football',
      'baseball',
      'soccer',
      'hockey',
    ]);
    for (const sport of TEAM_SPORTS) {
      expect(findActivity(sport.activityId)?.kind).toBe('sport');
      expect(sportOfActivity(sport.activityId)?.id).toBe(sport.id);
      expect(sport.skills).toHaveLength(5);
      expect(new Set(sport.skills.map((skill) => skill.id)).size).toBe(5);
      expect(sport.positions.length).toBeGreaterThanOrEqual(4);
      expect(sport.playerTitle).toBe(`Professional ${sport.noun} player`);
    }
  });

  it('has fictional, unique teams, in a league whose letters are not another sport’s', () => {
    const letters = new Set<string>();
    const names = new Set<string>();
    for (const sport of TEAM_SPORTS) {
      expect(sport.proTeams.length).toBeGreaterThanOrEqual(24);
      expect(new Set(sport.proTeams).size).toBe(sport.proTeams.length);
      expect(sport.collegeTeams.length).toBeGreaterThanOrEqual(12);
      letters.add(sport.leagueShort);
      for (const team of sport.proTeams) names.add(`${sport.id}:${team}`);
      // None of them is a league that exists.
      expect(['NFL', 'MLB', 'NHL', 'NBA', 'MLS', 'CFL', 'USL']).not.toContain(sport.leagueShort);
    }
    expect(letters.size).toBe(TEAM_SPORTS.length);
  });

  it('pays from the real league minimum at the bottom, in a ladder that only goes up', () => {
    // The fringe tier is the real floor: NFL $885,000 rookie, MLB $780,000, NHL $775,000
    // (rising to $850,000), MLS $113,400, NBA $1,272,870. Each is the floor or just above it.
    const floors: Readonly<Record<string, number>> = {
      football: 885_000,
      baseball: 780_000,
      hockey: 775_000,
      soccer: 113_400,
      basketball: 1_272_870,
    };
    for (const sport of TEAM_SPORTS) {
      const floor = floors[sport.id]!;
      expect(sport.economy.pay.fringe).toBeGreaterThanOrEqual(floor);
      expect(sport.economy.pay.fringe).toBeLessThan(floor * 1.15);
      for (let index = 1; index < TIERS.length; index += 1) {
        expect(sport.economy.pay[TIERS[index]!]).toBeGreaterThan(
          sport.economy.pay[TIERS[index - 1]!],
        );
      }
    }
  });

  it('makes the sports different where they really are: pay at the top, how long a career lasts, injuries', () => {
    const pay = (id: string) => findSport(id)!.economy.pay.superstar;
    expect(pay('soccer')).toBeLessThan(pay('basketball'));
    expect(pay('hockey')).toBeLessThan(pay('basketball'));
    expect(findSport('soccer')!.economy.pay.fringe).toBeLessThan(
      findSport('hockey')!.economy.pay.fringe / 5,
    );
    const retire = (id: string) => findSport(id)!.economy.retireAge.role;
    // Football is the short career and baseball the long one.
    expect(retire('football')[1]).toBeLessThan(retire('basketball')[1]);
    expect(retire('baseball')[0]).toBeGreaterThan(retire('basketball')[0]);
    const injury = (id: string) => findSport(id)!.economy.injuryFactor;
    for (const sport of TEAM_SPORTS) {
      expect(injury('football')).toBeGreaterThanOrEqual(injury(sport.id));
    }
    // A retirement range never runs backwards, and a better player lasts at least as long.
    for (const sport of TEAM_SPORTS) {
      for (let index = 0; index < TIERS.length; index += 1) {
        const [low, high] = sport.economy.retireAge[TIERS[index]!];
        expect(high).toBeGreaterThanOrEqual(low);
        if (index > 0) {
          expect(low).toBeGreaterThanOrEqual(sport.economy.retireAge[TIERS[index - 1]!][0]);
        }
      }
    }
  });
});

describe('the draft', () => {
  it('pays a rookie from the top of that sport’s scale, down to the league minimum, and never below it', () => {
    for (const sport of TEAM_SPORTS) {
      const { economy } = sport;
      expect(rookiePay(1, economy)).toBe(Math.max(economy.pay.fringe, economy.rookieTop));
      expect(rookiePay(economy.draftSize, economy)).toBe(economy.pay.fringe);
      let last = Number.POSITIVE_INFINITY;
      for (let pick = 1; pick <= economy.draftSize; pick += 1) {
        const pay = rookiePay(pick, economy);
        expect(pay).toBeGreaterThanOrEqual(economy.pay.fringe);
        expect(pay).toBeLessThanOrEqual(last);
        last = pay;
      }
    }
    // Basketball is exactly what 0801 shipped: $12 million at the top, the minimum from pick 31.
    expect(rookiePay(1)).toBe(12_000_000);
    expect(rookiePay(30)).toBe(2_400_000);
    expect(rookiePay(31)).toBe(1_300_000);
    // Hockey's rookie scale is capped by the real one (about $975,000).
    expect(rookiePay(1, findSport('hockey')!.economy)).toBeLessThanOrEqual(975_000);
  });

  it('stretches the pick ranges to the size of the draft, and never leaves it', () => {
    for (const sport of TEAM_SPORTS) {
      for (const tier of TIERS) {
        for (const unit of [0, 0.25, 0.5, 0.75, 0.999999]) {
          const pick = draftPickFor(tier, unit, sport.economy.draftSize);
          expect(pick).toBeGreaterThanOrEqual(1);
          expect(pick).toBeLessThanOrEqual(sport.economy.draftSize);
        }
      }
    }
    // Basketball's 60 picks are what they were.
    expect(draftPickFor('superstar', 0)).toBe(1);
    expect(draftPickFor('fringe', 0.999999)).toBe(60);
    // A better player goes earlier, in a draft of 224 as in one of 60.
    expect(draftPickFor('superstar', 0.5, 224)).toBeLessThan(draftPickFor('role', 0.5, 224));
    expect(draftPickFor('role', 0.5, 224)).toBeLessThan(draftPickFor('fringe', 0.5, 224));
  });

  it('counts rounds from the size of the first', () => {
    expect(roundOf(1, 32)).toBe(1);
    expect(roundOf(32, 32)).toBe(1);
    expect(roundOf(33, 32)).toBe(2);
    expect(roundOf(224, 32)).toBe(7);
    expect(roundOf(31, 30)).toBe(2);
  });
});

describe('a position, which is a label', () => {
  it('is the same for the same life, from the sport’s own list, and costs no save field', () => {
    for (const sport of TEAM_SPORTS) {
      const seen = new Set<string>();
      for (let index = 0; index < 400; index += 1) {
        const position = positionIn(`pos-${index}`, 0, sport);
        expect(sport.positions).toContain(position);
        expect(positionIn(`pos-${index}`, 0, sport)).toBe(position);
        seen.add(position);
      }
      // All of them turn up, so nobody is stuck as a quarterback.
      expect(seen.size).toBe(new Set(sport.positions).size);
    }
  });

  it('is read from the life, only while there is a sporting life, and moves nothing else', () => {
    const state = createNewGame({ seed: 'position-life' });
    expect(positionOf(state)).toBeUndefined();
    const sport = findSport('football')!;
    const career = {
      sportId: 'football',
      stage: 'college' as const,
      startedAge: 18,
      seasons: 1,
      hardSeasons: 1,
      form: 60,
      trainedAtAge: -1,
      trainedCount: 0,
      reputation: 0,
      titles: 0,
    };
    const playing: GameState = { ...state, sports: { ...state.sports, career } };
    expect(positionOf(playing)).toBe(
      positionIn(state.rng.getSeed(), state.world.generation, sport),
    );
    // No stream is drawn from.
    const before = state.rng.getSeed();
    positionOf(playing);
    expect(state.rng.getSeed()).toBe(before);
  });

  it('is named in the draft line, with the right article', () => {
    const lines: string[] = [];
    for (let index = 0; index < 40 && lines.length < 3; index += 1) {
      const life = ladder(findSport('baseball')!, `article-${index}`);
      if (!life) continue;
      const row = life.state.player.timeline.find((entry) => /Drafted/.test(entry.text));
      if (row) lines.push(row.text);
    }
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/Drafted (number \d+|in the \w+ round) by the .+, as (a|an) [a-z ]+\.$/);
      expect(line).not.toMatch(/ a (outfielder|elf)/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Playing each sport through the game                                         */
/* -------------------------------------------------------------------------- */

function answerOthers(state: GameState): GameState {
  let current = state;
  let guard = 0;
  while ((guard += 1) < 12) {
    const open = current.pending.find((row) => row.eventId !== SPORTS_OFFER_EVENT_ID);
    // Say no to every other team, so the life this test is about is on the team it is about.
    const choice =
      open?.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : open?.choices[0];
    if (!open || !choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

/** A life that is talented (or not) and tries out for the sport each year from twelve, working at it or not. */
function schoolLife(
  sport: Sport,
  seed: string,
  talented: boolean,
  work: boolean,
): { readonly state: GameState; readonly onTeam: boolean } {
  let state = createNewGame({ seed });
  state = {
    ...state,
    player: { ...state.player, talents: { ...state.player.talents, athletics: talented } },
  };
  let onTeam = false;
  while (state.player.alive && state.player.age < 18 && state.sports.offer === undefined) {
    state = answerOthers(advanceYear(state).state);
    if (state.sports.offer !== undefined) {
      onTeam = true;
      break;
    }
    if (state.player.age >= 12 && state.player.age <= 17) {
      const made = tryOut(state, sport.activityId);
      if (made.ok) state = made.value.state;
      if (work) {
        for (let session = 0; session < 3; session += 1) {
          const practised = practise(state, sport.activityId);
          if (practised.ok) state = practised.value.state;
        }
      }
      if (
        state.player.age === 17 &&
        state.education.activities.some((row) => row.activityId === sport.activityId)
      ) {
        onTeam = true;
      }
    }
  }
  return { state, onTeam };
}

/** Play to the first contract, accepting a scholarship and training; undefined when the life never gets there. */
function ladder(
  sport: Sport,
  seed: string,
): { readonly state: GameState; readonly scholarship: boolean } | undefined {
  const school = schoolLife(sport, seed, true, true);
  let state = school.state;
  if (state.sports.offer?.kind !== 'scholarship') return undefined;
  let guard = 0;
  while (state.player.alive && (guard += 1) < 14) {
    if (state.sports.offer) {
      const result = decide(state, SPORTS_OFFER_EVENT_ID, ACCEPT);
      if (!result.ok) throw new Error(`answer failed: ${result.error}`);
      state = result.value.state;
      if (state.sports.career?.stage === 'pro') return { state, scholarship: true };
    }
    state = answerOthers(state);
    if (isPlaying(state.sports.career)) {
      for (let session = 0; session < 3; session += 1) {
        const trained = trainSport(state);
        if (trained.ok) state = trained.value.state;
      }
    }
    state = advanceYear(state).state;
    if (state.sports.offer?.kind === 'contract') {
      const result = decide(state, SPORTS_OFFER_EVENT_ID, ACCEPT);
      if (!result.ok) throw new Error(`answer failed: ${result.error}`);
      return { state: result.value.state, scholarship: true };
    }
    if (state.sports.past.length > 0) return undefined;
  }
  return undefined;
}

describe.each(OTHER_SPORTS.map((sport) => [sport.name, sport] as const))(
  '%s, through the game',
  (_, sport) => {
    it('runs the whole ladder on its own teams, in its own league, at its own pay', () => {
      let found = 0;
      for (let index = 0; index < 60 && found < 2; index += 1) {
        const life = ladder(sport, `ladder-${sport.id}-${index}`);
        if (!life) continue;
        found += 1;
        const career = careerOf(life.state)!;
        expect(career.sportId).toBe(sport.id);
        expect(career.stage).toBe('pro');
        expect(sport.proTeams).toContain(career.team);
        const contract = career.contract!;
        expect(contract.salary).toBeGreaterThanOrEqual(sport.economy.pay.fringe);
        expect(contract.salary).toBeLessThanOrEqual(sport.economy.rookieTop);
        expect(career.pick).toBeGreaterThanOrEqual(1);
        expect(career.pick).toBeLessThanOrEqual(sport.economy.draftSize);
        expect(career.endAge).toBeGreaterThanOrEqual(sport.economy.retireAge.fringe[0]);
        expect(career.endAge).toBeLessThanOrEqual(sport.economy.retireAge.superstar[1]);
        // A year in the pros posts pay under this team's name and puts the sport in the header.
        const next = advanceYear(answerOthers(life.state)).state;
        expect(next.player.occupation).toBe(sport.playerTitle);
        const pay = next.finance.transactions.filter(
          (row) =>
            row.year === next.world.year &&
            row.category === 'salary' &&
            row.source.startsWith('Playing for'),
        );
        expect(pay).toHaveLength(1);
        expect(pay[0]!.source).toContain(career.team!);
      }
      expect(found).toBeGreaterThan(0);
    }, 300_000);

    it('holds the odds of a player who is talented and works: about 95% of those on the team reach the pros', () => {
      let onTeam = 0;
      let pros = 0;
      for (let index = 0; index < 45; index += 1) {
        const school = schoolLife(sport, `odds-${sport.id}-${index}`, true, true);
        if (!school.onTeam) continue;
        onTeam += 1;
        let state = school.state;
        if (state.sports.offer?.kind !== 'scholarship') continue;
        let guard = 0;
        while (state.player.alive && (guard += 1) < 14) {
          if (state.sports.offer?.kind === 'contract' || state.sports.past.length > 0) break;
          if (state.sports.offer) {
            const result = decide(state, SPORTS_OFFER_EVENT_ID, ACCEPT);
            if (!result.ok) break;
            state = result.value.state;
          }
          state = answerOthers(state);
          if (isPlaying(state.sports.career)) {
            for (let session = 0; session < 3; session += 1) {
              const trained = trainSport(state);
              if (trained.ok) state = trained.value.state;
            }
          }
          state = advanceYear(state).state;
        }
        if (state.sports.offer?.kind === 'contract') pros += 1;
      }
      expect(onTeam).toBeGreaterThan(15);
      // 95% asked for; a wide band because the sample is small.
      expect(pros / onTeam).toBeGreaterThan(0.78);
    }, 300_000);
  },
);

describe('injuries differ by sport', () => {
  /** The same pro, put through many different seasons with health held at 50, and the share that hurt. */
  function hurtShare(sport: Sport, seasons: number): number {
    let base: GameState | undefined;
    for (let index = 0; index < 80 && !base; index += 1) {
      base = ladder(findSport('basketball')!, `injury-base-${index}`)?.state;
    }
    if (!base) throw new Error('no pro life found');
    const career = careerOf(base)!;
    const steady: GameState = {
      ...base,
      player: { ...base.player, stats: { ...base.player.stats, health: 50 } },
    };
    let hurt = 0;
    for (let attempt = 0; attempt < seasons; attempt += 1) {
      const before: GameState = {
        ...steady,
        world: { ...steady.world, year: 5000 + attempt },
        sports: {
          ...steady.sports,
          career: {
            ...career,
            sportId: sport.id,
            tier: 'starter',
            peak: 'starter',
            breakout: 1,
            endAge: 99,
            contract: { salary: 5_000_000, yearsLeft: 5, rookie: false },
          },
        },
      };
      const year = runSportsYear({
        before,
        education: before.education,
        age: before.player.age + 1,
        year: 5001 + attempt,
      });
      if (
        year.lines.some((line) =>
          /sprained|bruised|sore|Tore|broken foot|Surgery|ended your/i.test(line.text),
        )
      ) {
        hurt += 1;
      }
    }
    return hurt / seasons;
  }

  it('breaks football players most, then hockey, and baseball players least', () => {
    const rate = (id: string) => hurtShare(findSport(id)!, 3000);
    const football = rate('football');
    const hockey = rate('hockey');
    const basketball = rate('basketball');
    const baseball = rate('baseball');
    expect(football).toBeGreaterThan(hockey);
    expect(hockey).toBeGreaterThan(basketball);
    expect(basketball).toBeGreaterThan(baseball);
    // 0.13 x 1.6 = about 21% for football against 13% for basketball, with health at 50.
    expect(football).toBeGreaterThan(0.17);
    expect(football).toBeLessThan(0.26);
    expect(basketball).toBeGreaterThan(0.1);
    expect(basketball).toBeLessThan(0.16);
  }, 120_000);
});

describe('renewal and the draft, in each sport’s own money and rounds', () => {
  it('has a draft that is a whole number of rounds', () => {
    for (const sport of TEAM_SPORTS) {
      expect(sport.economy.draftSize % sport.economy.firstRound).toBe(0);
    }
    expect(
      findSport('football')!.economy.draftSize / findSport('football')!.economy.firstRound,
    ).toBe(7);
  });

  it('offers a new deal when one runs out at that sport’s pay for the tier, never at another’s', () => {
    for (const sport of OTHER_SPORTS) {
      let base: GameState | undefined;
      for (let index = 0; index < 80 && !base; index += 1) {
        base = ladder(sport, `renew-${sport.id}-${index}`)?.state;
      }
      expect(base).toBeDefined();
      const career = careerOf(base!)!;
      for (const tier of ['role', 'star'] as const) {
        const before: GameState = {
          ...base!,
          sports: {
            ...base!.sports,
            career: {
              ...career,
              tier,
              peak: tier,
              breakout: 1,
              endAge: 99,
              contract: { salary: 1, yearsLeft: 1, rookie: false },
            },
          },
        };
        const year = runSportsYear({
          before,
          education: before.education,
          age: before.player.age + 1,
          year: before.world.year + 1,
        });
        const offer = year.sports.offer;
        expect(offer?.kind).toBe('contract');
        if (offer?.kind !== 'contract') continue;
        const pay = sport.economy.pay[tier];
        // The market runs from 88% to 114% of the tier's pay, and a name adds 6%.
        expect(offer.salary).toBeGreaterThanOrEqual(pay * 0.87);
        expect(offer.salary).toBeLessThanOrEqual(pay * 1.14 * 1.06 + 10_000);
      }
    }
  }, 120_000);
});

describe('more than one team', () => {
  /** A life with a real school entry to copy, then two teams on the books with the standings given. */
  function onTeams(
    first: readonly [string, number],
    second: readonly [string, number],
    existing?: string,
  ): ReturnType<typeof runSportsYear> {
    let entry: GameState['education']['activities'][number] | undefined;
    let state = createNewGame({ seed: 'two-teams' });
    for (let index = 0; index < 60 && !entry; index += 1) {
      state = createNewGame({ seed: `two-teams-${index}` });
      while (state.player.age < 13 && state.player.alive) {
        state = answerOthers(advanceYear(state).state);
      }
      const made = tryOut(state, 'act.basketball');
      if (made.ok) {
        state = made.value.state;
        entry = state.education.activities.find((row) => row.activityId === 'act.basketball');
      }
    }
    if (!entry) throw new Error('no entry to copy');
    const before: GameState = {
      ...state,
      education: {
        ...state.education,
        activities: [
          { ...entry, activityId: first[0], standing: first[1] },
          { ...entry, activityId: second[0], standing: second[1] },
        ],
      },
      sports: existing
        ? {
            ...state.sports,
            career: {
              sportId: existing,
              stage: 'school',
              startedAge: 14,
              seasons: 2,
              hardSeasons: 1,
              form: 50,
              trainedAtAge: -1,
              trainedCount: 0,
              reputation: 0,
              titles: 0,
            },
          }
        : state.sports,
    };
    return runSportsYear({
      before,
      education: before.education,
      age: before.player.age + 1,
      year: before.world.year + 1,
    });
  }

  it('follows the sport they are best at when they have not started one', () => {
    expect(onTeams(['act.football', 30], ['act.hockey', 70]).sports.career?.sportId).toBe('hockey');
    expect(onTeams(['act.football', 70], ['act.hockey', 30]).sports.career?.sportId).toBe(
      'football',
    );
  });

  it('stays with the sport they have been playing, even when another team has the better standing', () => {
    const year = onTeams(['act.football', 30], ['act.hockey', 90], 'football');
    expect(year.sports.career?.sportId).toBe('football');
    // And it was the same career, a season on: two seasons became three.
    expect(year.sports.career?.seasons).toBe(3);
  });
});

describe('what the draft says and does, in drafts of every size', () => {
  it('names the pick in the first round and the round after it', () => {
    expect(draftedWords(1, 32)).toBe('Drafted number 1');
    expect(draftedWords(32, 32)).toBe('Drafted number 32');
    expect(draftedWords(31, 30)).toBe('Drafted in the second round');
    expect(draftedWords(33, 32)).toBe('Drafted in the second round');
    expect(draftedWords(224, 32)).toBe('Drafted in the seventh round');
    // Baseball goes to twenty rounds: past seventh the rounds are numbers, with the right ending.
    expect(draftedWords(8 * 30 - 5, 30)).toBe('Drafted in the 8th round');
    expect(draftedWords(11 * 30, 30)).toBe('Drafted in the 11th round');
    expect(draftedWords(12 * 30, 30)).toBe('Drafted in the 12th round');
    expect(draftedWords(13 * 30, 30)).toBe('Drafted in the 13th round');
    expect(draftedWords(20 * 30, 30)).toBe('Drafted in the 20th round');
    expect(draftedWords(21 * 30, 30)).toBe('Drafted in the 21st round');
    expect(draftedWords(22 * 30, 30)).toBe('Drafted in the 22nd round');
    expect(draftedWords(23 * 30, 30)).toBe('Drafted in the 23rd round');
  });

  it('builds a first contract from the sport’s own first round, pay and words', () => {
    const football = findSport('football')!;
    for (const pick of [31, 32]) {
      expect(rookieDeal(football, pick).years).toBe(4);
      expect(rookieDeal(football, pick).words).toBe(`Drafted number ${pick}`);
    }
    expect(rookieDeal(football, 33).years).toBe(2);
    expect(rookieDeal(football, 33).words).toBe('Drafted in the second round');
    expect(rookieDeal(football, 1).salary).toBe(12_000_000);
    expect(rookieDeal(football, 224).salary).toBe(football.economy.pay.fringe);
    const basketball = findSport('basketball')!;
    expect(rookieDeal(basketball, 31).years).toBe(2);
    expect(rookieDeal(basketball, 30).years).toBe(4);
  });

  it('gives a first-round pick four years and anybody later two, wherever the first round ends', () => {
    expect(rookieYears(30, 30)).toBe(4);
    expect(rookieYears(31, 30)).toBe(2);
    expect(rookieYears(32, 32)).toBe(4);
    expect(rookieYears(33, 32)).toBe(2);
    expect(rookieYears(31, 32)).toBe(4);
  });

  it('stretches a draft of 224 or 600 well past sixty, and keeps basketball’s ranges at sixty', () => {
    expect(draftPickFor('superstar', 0.999999, 224)).toBeGreaterThan(8);
    expect(draftPickFor('fringe', 0, 224)).toBeGreaterThan(60);
    expect(draftPickFor('fringe', 0.999999, 600)).toBe(600);
    expect(draftPickFor('superstar', 0.999999)).toBe(8);
    expect(draftPickFor('fringe', 0)).toBe(32);
  });

  it('reaches picks beyond sixty in football and baseball, and keeps basketball inside sixty', () => {
    const maxPick = (id: string, lives: number): number => {
      let max = 0;
      const sport = findSport(id)!;
      for (let index = 0; index < lives; index += 1) {
        const found = ladder(sport, `picks-${id}-${index}`);
        const pick = found ? careerOf(found.state)?.pick : undefined;
        if (pick !== undefined) max = Math.max(max, pick);
      }
      return max;
    };
    expect(maxPick('football', 120)).toBeGreaterThan(60);
    expect(maxPick('basketball', 80)).toBeLessThanOrEqual(60);
  }, 200_000);

  it('stretches positions across sports independently: the same life is not a goalkeeper and a goaltender together', () => {
    const soccer = findSport('soccer')!;
    const hockey = findSport('hockey')!;
    let same = 0;
    const total = 300;
    for (let index = 0; index < total; index += 1) {
      const a = soccer.positions.indexOf(positionIn(`independent-${index}`, 0, soccer));
      const b = hockey.positions.indexOf(positionIn(`independent-${index}`, 0, hockey));
      // The lists are the same length, so a shared hash would put every life at the same place in both.
      if (
        Math.floor((a / soccer.positions.length) * 6) ===
        Math.floor((b / hockey.positions.length) * 6)
      )
        same += 1;
    }
    expect(soccer.positions.length).toBe(hockey.positions.length);
    expect(same / total).toBeLessThan(0.45);
  });
});

describe('college injuries differ by sport too', () => {
  /** Injury lines in the years of college, over the lives that got as far as a contract, per college season. */
  function collegeHurtShare(sport: Sport, lives: number): number {
    let hurt = 0;
    let seasons = 0;
    for (let index = 0; index < 400 && seasons < lives * 4; index += 1) {
      const found = ladder(sport, `college-hurt-${sport.id}-${index}`);
      if (!found) continue;
      const rows = found.state.player.timeline.filter((row) => row.age >= 19 && row.age <= 22);
      seasons += 4;
      hurt += rows.filter((row) =>
        /sprained|bruised|sore shoulder|ended your season early|bad knee/i.test(row.text),
      ).length;
    }
    return hurt / seasons;
  }

  it('hurts football players in college more often than baseball players', () => {
    const football = collegeHurtShare(findSport('football')!, 160);
    const baseball = collegeHurtShare(findSport('baseball')!, 160);
    // 7% x 1.6 against 7% x 0.9 a season.
    expect(football).toBeGreaterThan(baseball * 1.2);
  }, 300_000);
});
