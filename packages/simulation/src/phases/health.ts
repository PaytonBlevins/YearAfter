/**
 * Ticket 0211 — the health phase.
 *
 * The seventh phase module, and the first one that can END a life.
 *
 * WHERE IT RUNS, and why it is not obvious. The order is education → social →
 * family → employment → events → stress → HEALTH, and every step of that is
 * load-bearing:
 *
 *  - after EMPLOYMENT, because whether the year was spent on a building site is
 *    an input to the injury roll (spec 541–543);
 *  - after EVENTS, because an event can knock health about and the year's
 *    mortality should be judged on where the character actually ended up;
 *  - after STRESS, because chronic stress raises the chance of falling ill, and
 *    stress is only finished being computed once it has summarised the year;
 *  - LAST, because if the character dies the year still has to be a complete
 *    year. Killing them in the middle would leave a half-written twelve months
 *    in the feed, and the whole `advanceYear` contract (spec 1060–1066) is
 *    calculate → validate → commit.
 *
 * WHAT IT WRITES. Lines, in the same shape every other phase uses. Death is a
 * `milestone`; illness and injury are `passive`. There is no decision card here
 * — the player does not get asked whether to have a heart attack — and the one
 * lever they have is the Doctor, which acts between years like Work Harder.
 */

import type { TimelineKind } from '@yearafter/character';
import {
  CHECKUP_RECOVERY,
  findCondition,
  runHealthYear,
  type HeldCondition,
  type YearEvent,
} from '@yearafter/health';
import type { RandomStream } from '../rng/rng';

/**
 * How much health comes back on its own in an ordinary year.
 *
 * Small, and it is what makes an acute illness a dip rather than a debt: lose
 * nine points to a bad winter at thirty and it is back inside three years,
 * unless something else happens first. Without this the model would be a
 * ratchet, and a ratchet reaches zero.
 */
export const NATURAL_RECOVERY = 3.4;

/** Tracks in which a year of work can genuinely hurt you. Spec 541–543. */
export const HAZARDOUS_TRACKS: readonly string[] = ['trade', 'labour', 'food', 'transport', 'care'];

export interface HealthPhaseInput {
  readonly age: number;
  /** Where the age curve has this body. Seeded from generated health at birth. */
  readonly vitality: number;
  readonly deficit: number;
  readonly stress: number;
  readonly conditions: readonly HeldCondition[];
  readonly stream: RandomStream;
  /** In a sport or physical activity this year. */
  readonly athlete: boolean;
  /** The career track worked this year, if any. */
  readonly track?: string;
  /** Whether the player saw a doctor between years. */
  readonly checkedUp: boolean;
}

export interface HealthPhaseOutput {
  readonly health: number;
  readonly vitality: number;
  readonly deficit: number;
  readonly conditions: readonly HeldCondition[];
  readonly alive: boolean;
  readonly cause?: string;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
}

export function runHealth(input: HealthPhaseInput): HealthPhaseOutput {
  /*
    A FIXED-LENGTH block of draws, taken up front.

    `runHealthYear` reads them by index and only spends what it needs, which
    means a year where nothing happens must still leave the stream in the same
    place as one where everything did — otherwise falling ill would shift every
    roll in every later year, and two lives from the same seed would diverge on
    whether somebody caught a cold. Same reasoning as 0210c's rule about a dead
    button not drawing (CORE_RULES 13.30), one system over.
  */
  const draws: number[] = [];
  for (let i = 0; i < 24; i += 1) draws.push(input.stream.next());

  const recovery =
    NATURAL_RECOVERY +
    (input.checkedUp
      ? CHECKUP_RECOVERY[0] + draws[23]! * (CHECKUP_RECOVERY[1] - CHECKUP_RECOVERY[0])
      : 0);

  const result = runHealthYear({
    age: input.age,
    vitality: input.vitality,
    deficit: input.deficit,
    stress: input.stress,
    conditions: input.conditions,
    athlete: input.athlete,
    hazardous: input.track !== undefined && HAZARDOUS_TRACKS.includes(input.track),
    recovery,
    draw: (index) => draws[Math.min(draws.length - 1, index)] ?? 0.5,
  });

  const died = result.events.find((event) => event.kind === 'died');

  return {
    health: result.health,
    vitality: result.vitality,
    deficit: result.deficit,
    conditions: result.conditions,
    alive: result.alive,
    ...(died && died.kind === 'died' ? { cause: died.cause } : {}),
    lines: capped(result.events.flatMap((event) => lineFor(event, input.age))),
  };
}

/**
 * At most ONE line about your body in one year.
 *
 * The whole-year line budget is seven (asserted in `advance.test.ts` and
 * `guardians.test.ts`), and six other phases are already writing into it. An
 * unbounded health phase pushed a busy year to EIGHT — a character who fell ill,
 * got hurt and had something clear up read three consecutive lines about their
 * health, which crowds out the life the feed is supposed to be about. Two was
 * still too many: the budget was already full at seven before this phase
 * existed, so health is the writer that takes one line or none.
 *
 * The model still applies everything that happened. This is about what is worth
 * READING, which is a different question — the same reason `runSocial` writes
 * one drift line a year however many people drifted.
 *
 * Death is never dropped: it is the last thing that will ever be written about
 * this character, and it goes first.
 */
export const HEALTH_LINES_PER_YEAR = 1;

function capped(
  lines: readonly { readonly kind: TimelineKind; readonly text: string }[],
): readonly { readonly kind: TimelineKind; readonly text: string }[] {
  if (lines.length <= HEALTH_LINES_PER_YEAR) return lines;
  const deaths = lines.filter((line) => line.kind === 'milestone');
  const rest = lines.filter((line) => line.kind !== 'milestone');
  return [...deaths, ...rest].slice(0, HEALTH_LINES_PER_YEAR);
}

/**
 * One event, in words.
 *
 * CORE_RULES 13.17: repeatable copy needs more lines than repeats and a stable
 * index — and 13.22: the base has to hold still for the LIFE while age does the
 * rotating, or a character catches the same cold at forty, forty-one and
 * forty-two. So the index is the AGE, and nothing else.
 */
function lineFor(
  event: YearEvent,
  age: number,
): readonly { readonly kind: TimelineKind; readonly text: string }[] {
  const pick = (lines: readonly string[]) => lines[age % lines.length] as string;

  switch (event.kind) {
    case 'ill': {
      const kind = event.conditionId ? findCondition(event.conditionId) : undefined;
      if (kind) {
        return [
          {
            kind: 'passive' as TimelineKind,
            text: `${pick(ILL_LINES)} It did not entirely go — ${kind.label.toLowerCase()}.`,
          },
        ];
      }
      return [{ kind: 'passive' as TimelineKind, text: pick(ILL_LINES) }];
    }
    case 'hurt': {
      const kind = event.conditionId ? findCondition(event.conditionId) : undefined;
      if (kind) {
        return [
          {
            kind: 'passive' as TimelineKind,
            text: `${pick(HURT_LINES)} ${kind.label} — that one is staying.`,
          },
        ];
      }
      return [{ kind: 'passive' as TimelineKind, text: pick(HURT_LINES) }];
    }
    case 'cleared': {
      const kind = findCondition(event.conditionId);
      if (!kind) return [];
      // Rotated like every other repeatable line. The first version had ONE
      // sentence, and the whole-feed invariant caught it inside a single run:
      // "Trouble with your chest — gone, finally" at nineteen and again at
      // twenty, because a condition can be picked up, cleared, picked up and
      // cleared again. CORE_RULES 13.17.
      return [
        {
          kind: 'passive' as TimelineKind,
          text: pick(CLEARED_LINES).replace('{what}', kind.label.toLowerCase()),
        },
      ];
    }
    case 'died':
      return [{ kind: 'milestone' as TimelineKind, text: `You died. ${event.cause}.` }];
  }
}

/**
 * Eight lines each, for something that happens perhaps fifteen times in a life.
 *
 * 0209's rule with the numbers checked: a character who falls ill often should
 * not read the same sentence twice in a decade, and the age index means they
 * cannot read it twice in eight years even if they fall ill every one of them.
 */
const ILL_LINES: readonly string[] = [
  'Spent most of a month flat out and getting nothing done.',
  'Whatever it was went round everybody, and you got it worst.',
  'Got properly ill for the first time in ages. It took a while.',
  'A bad few weeks. You went back before you should have.',
  'Something knocked you sideways and would not shift.',
  'Ended up at a doctor for something you had been ignoring.',
  'Ill enough to cancel things you had been looking forward to.',
  'The kind of ill where people keep asking if you are alright.',
];

const CLEARED_LINES: readonly string[] = [
  'Whatever they did about {what} seems to have worked.',
  '{what} — gone, finally. You had almost stopped noticing it.',
  'Got the all-clear on {what}. Nobody made a fuss about it.',
  "They signed you off. {what} is somebody else's problem now.",
  'Turns out {what} was not for life after all.',
  'One appointment, one shrug, and {what} was behind you.',
  'It went the way these things sometimes go: {what}, and then not.',
  'Stopped thinking about {what} at some point and never started again.',
];

const HURT_LINES: readonly string[] = [
  'Went over badly and heard something go.',
  'Got hurt doing something you have done a thousand times.',
  'One wrong movement and that was the rest of the season.',
  'An accident, quick and stupid and expensive.',
  'Came off worse than the thing you came off.',
  'Hurt yourself properly for the first time in your life.',
  'A bad fall. You knew right away it was not nothing.',
  'Something gave way that was never supposed to give way.',
];
