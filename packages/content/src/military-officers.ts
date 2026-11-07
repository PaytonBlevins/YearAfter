/**
 * Ticket 0902 — officers.
 *
 * Six officer grades, O-1 to O-6 (second lieutenant to colonel; ensign to captain in the sea services), on the real
 * 2026 officer pay table (`military-pay.ts`). Two ways in: a bachelor's degree and a commission, or a serving enlisted
 * member with a degree whom a board picks. A year of officer training comes first and can end in a wash-out, which
 * sends an enlisted member back to the ranks.
 *
 * Real: the grade titles, the pay, and the shape of promotion, which is by time in commissioned service and a board
 * that picks most and not all (DoD's DOPMA guidance: 70–90% to O-4 at about 9–11 years, 60–80% to O-5 at about 15–17,
 * 40–60% to O-6 at about 21–23), with an officer twice passed over made to leave or retire. Not real: everything else,
 * meaning the yearly chances that produce those shares, the commissioning age limits (OCS commissions run to roughly 32–34),
 * the training wash-out (no figure was found; the 1949 Army OCS classes graduated about half, which is not a modern
 * number), the chance a board picks an enlisted applicant, and the rule that an officer who was passed over can stay to
 * 65 (the services force them out sooner). The ticket doc names the dials.
 *
 * American spelling, spoken-style contractions.
 */

import { scaledRise } from './military';
import { OFFICER_TOP_GRADE } from './military-pay';
import type { SpecialtySkill } from './military-branches';

export interface OfficerGradeRow {
  /** 1 to 6: O-1 to O-6. */
  readonly grade: number;
  /** Whole years of commissioned service at the least before a rise INTO this grade. */
  readonly minYears: number;
  /** The yearly chance of the rise once the years are in, for somebody performing at 60. */
  readonly rise: number;
}

export const OFFICER_GRADES: readonly OfficerGradeRow[] = [
  { grade: 1, minYears: 0, rise: 1 },
  { grade: 2, minYears: 2, rise: 1 },
  { grade: 3, minYears: 4, rise: 1 },
  { grade: 4, minYears: 10, rise: 0.35 },
  { grade: 5, minYears: 16, rise: 0.28 },
  { grade: 6, minYears: 22, rise: 0.03 },
];

export const findOfficerGrade = (grade: number): OfficerGradeRow =>
  OFFICER_GRADES[
    Math.max(1, Math.min(OFFICER_TOP_GRADE, Math.round(grade))) - 1
  ] as OfficerGradeRow;

/** The chance a year ends with a rise into the next officer grade, once the years are in. */
export const officerRiseChance = (toGrade: number, performance: number): number =>
  scaledRise(findOfficerGrade(toGrade).rise, performance);

/**
 * An officer who is still a lieutenant (O-3) this many years into commissioned service has been passed over for O-4 and
 * must leave (or retire, if twenty years are in). The shape of DOPMA's two-looks rule, one rule and not three.
 */
export const O3_PASS_OVER_YEARS = 13;

/** An officer candidate needs at least a bachelor's degree. */
export const COMMISSION_DEGREE = 'bachelor';

/** An enlisted member must have served this many years before a board will look. */
export const COMMISSION_BOARD_MIN_YEARS = 1;

/**
 * The chance a board picks an enlisted applicant: 30% at a performance of 60, a point of performance moving it a point, kept
 * between 5% and 60%. A judgement.
 */
export function commissionBoardChance(performance: number): number {
  return Math.max(0.05, Math.min(0.6, 0.3 + (performance - 60) * 0.01));
}

/**
 * The chance an officer candidate does not finish officer training: 8% at a middling fit, moving 0.3 points for each point of
 * fit, kept between 2% and 25%. A judgement; no modern figure was found.
 */
export function officerWashOutChance(fit: number): number {
  return Math.max(0.02, Math.min(0.25, 0.08 + (58 - fit) * 0.003));
}

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

export const TRACK_PROMPTS: readonly string[] = [
  'You have a degree, and the recruiter knows it. You could go in enlisted, or you could go in as an officer.',
  "With a degree you have a choice most people at the table don't: enlist, or apply for a commission.",
];

export const BRANCH_PROMPTS: readonly string[] = [
  'Which service do you want to sign with?',
  'The recruiters have a table for every branch. Whose do you walk up to?',
];

export const SPECIALTY_PROMPTS: readonly string[] = [
  'What do you want to do in %branch%? The jobs open to you are on the list.',
  'The classifier has a list for you. Which job in %branch% do you want?',
];

export const OFFICER_TRAINING_LINES: readonly string[] = [
  '%school% was %weeks% weeks of being told how to lead before anybody let you.',
  'You finished %school% and put on the bars of a %title%.',
  'You came out of %school% a %title%, with a long list of things to learn on the job.',
];

export const OFFICER_WASH_OUT_LINES: readonly string[] = [
  "You didn't make it through %school%. They sent you home with a thank-you and a form.",
  "%school% ended for you early. It wasn't the right fit, and they said so kindly.",
];

export const OFFICER_RETURN_LINES: readonly string[] = [
  "You didn't finish %school%, and they sent you back to the ranks as a %title%.",
  "%school% wasn't for you. You went back to your unit as a %title%, and nobody made a thing of it.",
];

export const COMMISSION_BOARD_PICKED: readonly string[] = [
  'The board picked you. You are going to %school%.',
  'The list came out and your name was on it: %school%, and then a commission.',
];

export const COMMISSION_BOARD_PASSED: readonly string[] = [
  'The board passed on you this year. You can apply again.',
  "The board met and didn't pick you. The letter was polite about it.",
];

export const OFFICER_YEAR_LINES: readonly string[] = [
  'A year as an officer. More paperwork than you pictured, and people watching how you handle it.',
  'Another year leading people. You got better at it, and so did they.',
  "A steady year in the unit. You learned which problems were yours and which weren't.",
  'The year went to briefings, training and the people who report to you.',
];

export const OFFICER_RISE_LINES: readonly string[] = [
  'Promoted to %title%. The new insignia felt heavier than the old.',
  'The promotion list had your name: %title%. A senior officer pinned it on.',
  'You pinned on %title%, with the people you lead standing in rows.',
];

export const PASSED_OVER_LINES: readonly string[] = [
  "The board passed you over for the next grade again, and the service doesn't keep officers who stall. You left as a %title%.",
  'Twice the promotion board looked and twice it chose others. You left the %short% as a %title%.',
];

export const AGE_RETIRE_LINES: readonly string[] = [
  'You reached the age when the service sends everyone home. You retired from %branch% as a %title%.',
  'That was the mandatory retirement age. You hung up the uniform, a %title%, and went home.',
];

/** A line for a year, by the kind of work the specialty is. */
export const SKILL_LINES: Readonly<Record<SpecialtySkill, readonly string[]>> = {
  combat: [
    'You spent the year on the range and in the field, and your feet learned the ground.',
    'A year of exercises, live fire and long marches. It was hard and you got good at it.',
    'Your unit trained until the movements stopped being a thought.',
  ],
  medical: [
    'A year in the aid station and the clinic. You learned how people look when they are hurt and how to stay calm.',
    'You spent the year treating sprains, fevers and fear, and getting better at all three.',
    'Another year of sick call and training exercises. People started asking for you by name.',
  ],
  mechanical: [
    'A year with a wrench in your hand and grease to the elbow. Things you fixed stayed fixed.',
    'You kept the machines running and learned to hear what was wrong before it broke.',
    'The year went to maintenance schedules and parts that were never in stock.',
  ],
  technical: [
    'A year of networks, radios and the odd emergency at three in the morning.',
    'You spent the year keeping the systems up and the people who use them out of trouble.',
    'Another year in the technical shop. Most of the job was fixing what other people broke.',
  ],
  security: [
    'A year on gate duty, patrols and the long hours between incidents.',
    'You spent the year keeping watch, and learning to tell a real problem from a loud one.',
    'Another year of shifts, reports and the quiet work of keeping a post safe.',
  ],
  logistics: [
    'A year of trucks, manifests and getting the right thing to the right place before anyone noticed.',
    'You kept supplies moving all year, and learned that nothing works without them.',
    'The year went to convoys, inventories and the people who need both.',
  ],
  maritime: [
    'A year on the water, and your balance changed with it.',
    'You spent the year on deck in all weather, and learned to read the sea.',
    "Another year of watches, lines and sunrises you wouldn't have picked.",
  ],
  aviation: [
    'A year on the flight line, with the roar of engines in your ears.',
    'You spent the year around aircraft, and learned what it takes to keep them in the air.',
    'Another year of preflights, repairs and watching things you worked on take off.',
  ],
  intelligence: [
    'A year in the intelligence section, reading what other people wrote and deciding what mattered.',
    "You spent the year with imagery, intercepts and reports, and learned to tell what's known from what's guessed.",
    "Another year in the section. Most of what you did, you can't describe.",
  ],
};
