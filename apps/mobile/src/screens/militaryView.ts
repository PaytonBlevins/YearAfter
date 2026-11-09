/**
 * Ticket 0906 — what the military, FBI, CIA and veteran screens say, as plain functions.
 *
 * The engines own every number. This file only chooses the words, and chooses what is not said:
 * how the work is going is a phrase and a bar, never a score, and a door's odds are never printed
 * (the same rule as 0809). Pay, years served and months of the GI Bill left are real figures,
 * because they are things the character has in hand. Everything is derived from the game state;
 * nothing is saved, so a reload shows exactly what it showed before.
 *
 * Where the engine already knows whether a verb would be refused, the view asks it (it runs the
 * verb on the state and throws the result away) instead of copying the rule, so a screen can never
 * offer what the engine would turn down, or turn down what it would allow.
 */

import {
  AGENCIES,
  AGENCY_CLEARANCE,
  AGENCY_PENSION_AGE,
  AGENCY_RETAIN_FLOOR,
  CLEARANCE_LABELS,
  DISCHARGE_LABELS,
  ENLIST_MIN_AGE,
  GI_BILL_DISCHARGES,
  GI_MONTHS_ENTITLED,
  GI_TUITION_CAP,
  PREFERENCE_MIN_YEARS,
  RETAIN_PERFORMANCE_FLOOR,
  RETIRE_ELIGIBLE_YEARS,
  SERVICE_BRANCHES,
  agencyTitle,
  findAgency,
  findDecoration,
  rankTitle,
  retiredPayFor,
  serviceReputationWord,
  specialtiesOf,
  specialtyBar,
  type AgencyId,
  type ServiceTrack,
} from '@yearafter/content';
import {
  AGENCY_ERROR_LABELS,
  COMMISSION_ERROR_LABELS,
  ENLIST_ERROR_LABELS,
  agencyOccupation,
  agencyPayOf,
  applyForCommission,
  applyToAgency,
  branchNameOf,
  branchShortOf,
  clearanceHeld,
  enlistmentBar,
  giBillPercent,
  giHousingFor,
  giMonthsLeft,
  giTuitionAid,
  intelligenceYears,
  militaryOccupation,
  pushesLeft,
  rankTitleOf,
  retireFromService,
  endServiceTerm,
  retiredPayOf,
  retiredPayStartAge,
  specialtyNameOf,
  veteranPreference,
  yearPayOf,
  type GameState,
  type PastAgency,
  type PastService,
  type ServiceRetireError,
} from '@yearafter/simulation';
import type { Outcome } from '../components/OutcomeCard';
import { money } from './fameView';
import type { Fact } from './entertainmentView';

const upper = (text: string): string => `${text[0]?.toUpperCase() ?? ''}${text.slice(1)}`;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** One tappable row: what it is, how it stands, and why it is shut when it is. */
export interface DoorRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** Why the row cannot be pressed, in words, when it cannot. */
  readonly closed?: string;
}

/* -------------------------------------------------------------------------- */
/* The Career page                                                              */
/* -------------------------------------------------------------------------- */

/** How a service that is over reads on a row: where it was and for how long. */
function pastLine(row: PastService): string {
  if (row.how === 'washed-out') return `Washed out of ${branchShortOf(row.branch)} training`;
  return `Left ${branchNameOf(row.branch)} after ${plural(row.years, 'year')}`;
}

/**
 * The three doors the Career page offers a grown person: the service, the FBI and the CIA. A child
 * gets none of them, and an agency below its minimum age is shut with the age that opens it. The
 * agencies are separate from the service on purpose: a degree opens them as well as a clearance.
 */
export function publicServiceRows(state: GameState): readonly DoorRow[] {
  const age = state.player.age;
  if (age < ENLIST_MIN_AGE) return [];
  const service = state.military.service;
  const lastService = state.military.past[state.military.past.length - 1];
  const military: DoorRow = {
    id: 'military',
    title: 'Military',
    subtitle: service
      ? (militaryOccupation(state.military) ?? '')
      : lastService
        ? pastLine(lastService)
        : 'Not in uniform',
  };
  const agencies = AGENCIES.map((agency): DoorRow => {
    const career = state.intel.career;
    const lastStint = [...state.intel.past].reverse().find((row) => row.agency === agency.id);
    const base = { id: agency.id, title: agency.short };
    if (career?.agency === agency.id) {
      return { ...base, subtitle: agencyOccupation(state.intel) ?? '' };
    }
    if (career) {
      return {
        ...base,
        subtitle: `You work for ${findAgency(career.agency)?.short ?? 'one'}`,
        closed: `You work for ${findAgency(career.agency)?.name ?? 'another agency'}.`,
      };
    }
    if (age < agency.minAge) {
      return {
        ...base,
        subtitle: `From age ${agency.minAge}`,
        closed: `From age ${agency.minAge}`,
      };
    }
    return {
      ...base,
      subtitle: lastStint
        ? `Left ${agency.name} after ${plural(lastStint.years, 'year')}`
        : `Not an ${agency.member}`,
    };
  });
  return [military, ...agencies];
}

/* -------------------------------------------------------------------------- */
/* The Military hub                                                             */
/* -------------------------------------------------------------------------- */

export function militaryHubRows(state: GameState): readonly DoorRow[] {
  const service = state.military.service;
  const past = state.military.past;
  const last = past[past.length - 1];
  return [
    {
      id: 'service',
      title: 'Service',
      subtitle: service ? (militaryOccupation(state.military) ?? '') : 'Not in uniform',
    },
    {
      id: 'veteran',
      title: 'Veteran',
      subtitle: last ? pastLine(last) : 'Nothing earned yet',
      ...(last === undefined
        ? { closed: service ? 'After you leave the service' : 'Once you have served' }
        : {}),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Service                                                                      */
/* -------------------------------------------------------------------------- */

/** How the work is going, in words. The retain floors are where the bottom phrase starts to matter. */
export function standingWords(performance: number): string {
  if (performance >= 80) return 'They would be lost without you';
  if (performance >= 62) return 'Doing the job, and doing it well';
  if (performance >= 45) return 'Getting by';
  if (performance >= 30) return 'It has been noticed, and not kindly';
  return 'One bad evaluation from being let go';
}

/** The service's refusal to let somebody retire, in words. The engine has codes and no sentences. */
export const RETIRE_ERROR_LABELS: Readonly<Record<ServiceRetireError, string>> = {
  'not-serving': "You're not in uniform.",
  'too-soon': 'Retiring opens at twenty years of service, and not during training.',
  deployed: "You're deployed. It will wait.",
};

export interface Going {
  readonly words: string;
  /** 0–100, for the bar. Never printed. */
  readonly meter: number;
  /** True under the floor the service lets people go below. */
  readonly low: boolean;
}

export interface ServiceView {
  readonly serving: boolean;
  readonly facts: readonly Fact[];
  readonly going?: Going;
  /** Decorations by name, oldest first. Empty until a deployment earns one. */
  readonly honours: readonly string[];
  /** Pushes left this year, for a serving member. */
  readonly pushesLeft: number;
  /** Only an enlisted member has a commission to apply for. */
  readonly commission?: { readonly closed?: string };
  readonly retire?: { readonly closed?: string };
  readonly endTerm?: { readonly closed?: string };
  /** For somebody out of uniform: why the recruiter's door is shut, if it is. */
  readonly enlist?: { readonly closed?: string };
}

/** What stands between this person and the recruiter's office as a whole, or nothing. */
function enlistClosed(state: GameState): string | undefined {
  if (state.military.appliedAge === state.player.age) {
    return ENLIST_ERROR_LABELS['already-applied'];
  }
  if (state.military.offer || state.pending.length > 0) return ENLIST_ERROR_LABELS['offer-pending'];
  const bars = SERVICE_BRANCHES.map((row) => enlistmentBar(state, state.player.age, row.id));
  if (bars.every((bar) => bar !== undefined)) return ENLIST_ERROR_LABELS[bars[0]!];
  return undefined;
}

export function serviceView(state: GameState): ServiceView {
  const career = state.military.service;
  const honours = (state.military.decorations ?? []).map(
    (row) => findDecoration(row.id)?.name ?? row.id,
  );
  if (!career) {
    return {
      serving: false,
      facts: [],
      honours,
      pushesLeft: 0,
      enlist: { ...(enlistClosed(state) === undefined ? {} : { closed: enlistClosed(state)! }) },
    };
  }

  const left = Math.max(0, 4 - career.years);
  const training = career.stage === 'training';
  const row = SERVICE_BRANCHES.find((branch) => branch.id === career.branch);
  const facts: Fact[] = [
    {
      title: 'Rank',
      value: rankTitleOf(career),
      subtitle: `${career.track === 'officer' ? 'Officer' : 'Enlisted'}, ${branchShortOf(career.branch)}`,
    },
    { title: 'Job', value: specialtyNameOf(career) },
    training
      ? {
          title: 'Posting',
          value: 'In training',
          subtitle: upper(
            career.track === 'officer' ? (row?.officerSchool ?? '') : (row?.training ?? ''),
          ),
        }
      : { title: 'Posting', value: career.post },
    {
      title: 'This term',
      value: left === 0 ? 'First term completed' : plural(left, 'year'),
      subtitle:
        left === 0 ? 'You can choose to leave from this screen' : 'Until End term is available',
    },
    { title: 'In uniform', value: plural(career.years, 'year') },
    { title: 'Pay', value: `${money(yearPayOf(career))} a year` },
    { title: 'Your name', value: serviceReputationWord(career.reputation) },
  ];
  const clearance = clearanceHeld(state.intel, state.player.age);
  if (clearance) facts.push({ title: 'Clearance', value: CLEARANCE_LABELS[clearance.level] });

  const commissionTrial = career.track === 'enlisted' ? applyForCommission(state) : undefined;
  const retireTrial = retireFromService(state);
  return {
    serving: true,
    facts,
    going: {
      words: standingWords(career.performance),
      meter: career.performance,
      low: career.performance < RETAIN_PERFORMANCE_FLOOR,
    },
    honours,
    pushesLeft: pushesLeft(state),
    ...(commissionTrial
      ? {
          commission: commissionTrial.ok
            ? {}
            : { closed: COMMISSION_ERROR_LABELS[commissionTrial.error] },
        }
      : {}),
    ...(career.years >= RETIRE_ELIGIBLE_YEARS
      ? { retire: retireTrial.ok ? {} : { closed: RETIRE_ERROR_LABELS[retireTrial.error] } }
      : {}),
    ...(career.years >= 4 && career.years < RETIRE_ELIGIBLE_YEARS
      ? {
          endTerm: endServiceTerm(state).ok
            ? {}
            : { closed: 'You must return from deployment first.' },
        }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* The recruiter                                                                */
/* -------------------------------------------------------------------------- */

export type RecruiterStep = 'branch' | 'track' | 'specialty';

export interface RecruiterChoice {
  readonly branch?: string;
  readonly track?: ServiceTrack;
}

export interface RecruiterView {
  readonly step: RecruiterStep;
  readonly prompt: string;
  readonly rows: readonly DoorRow[];
}

const DANGER_WORDS: Readonly<Record<number, string>> = {
  1: 'Mostly safe',
  2: 'Some risk',
  3: 'Often in harm’s way',
};

/**
 * The recruiter's three questions, in the order the engine's own offer asks them: the branch, then
 * (for somebody with a degree) the road, then the job. A row the person does not qualify for is
 * shown shut, with the reason, rather than left out: knowing why is the point of asking.
 */
export function recruiterView(state: GameState, chosen: RecruiterChoice = {}): RecruiterView {
  const age = state.player.age;
  const branch =
    chosen.branch === undefined
      ? undefined
      : SERVICE_BRANCHES.find((row) => row.id === chosen.branch);
  if (!branch) {
    return {
      step: 'branch',
      prompt: 'Which branch?',
      rows: SERVICE_BRANCHES.map((row) => {
        const bar = enlistmentBar(state, age, row.id);
        return {
          id: row.id,
          title: row.short,
          subtitle: `${upper(row.training)} first`,
          ...(bar === undefined ? {} : { closed: ENLIST_ERROR_LABELS[bar] }),
        };
      }),
    };
  }
  const canCommission = enlistmentBar(state, age, branch.id, 'officer') === undefined;
  if (chosen.track === undefined && canCommission) {
    return {
      step: 'track',
      prompt: 'Which road?',
      rows: [
        { id: 'enlisted', title: 'Enlist', subtitle: 'Start at the bottom and work up' },
        {
          id: 'officer',
          title: 'Apply for a commission',
          subtitle: `Officer training at ${branch.officerSchool}`,
        },
      ],
    };
  }
  return {
    step: 'specialty',
    prompt: 'What job do you want?',
    rows: specialtiesOf(branch.id).map((row) => ({
      id: row.id,
      title: row.name,
      subtitle: DANGER_WORDS[row.danger] ?? '',
      ...(specialtyBar(row, state.player.stats) === undefined
        ? {}
        : { closed: ENLIST_ERROR_LABELS['specialty-bar'] }),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Veteran                                                                      */
/* -------------------------------------------------------------------------- */

const HOW_ENDED: Readonly<Record<PastService['how'], string>> = {
  'washed-out': "You didn't finish training.",
  'not-retained': "The service didn't ask you to stay another term.",
  'passed-over': 'The promotion boards stopped choosing you.',
  term: 'You chose to leave when your term was up.',
  retired: 'You retired with the years in.',
  killed: 'You died in service.',
  medical: 'A medical board sent you home.',
  misconduct: 'You were court-martialed.',
};

/** How much of the GI Bill somebody has earned, in words. */
export function giShareWords(percent: number): string {
  if (percent >= 1) return 'All of it';
  if (percent >= 0.9) return 'Nearly all of it';
  if (percent >= 0.7) return 'Most of it';
  if (percent >= 0.6) return 'More than half';
  return 'Half of it';
}

export interface VeteranView {
  readonly pension: Fact;
  readonly giBill: readonly Fact[];
  readonly preference: Fact;
  readonly before: readonly Fact[];
}

export function veteranView(state: GameState): VeteranView {
  const military = state.military;
  const serving = military.service !== undefined;
  const pay = retiredPayOf(military);
  const start = retiredPayStartAge(military);
  const pension: Fact =
    pay > 0
      ? {
          title: 'Retired pay',
          value: `${money(pay)} a year`,
          subtitle:
            start !== undefined && state.player.age >= start
              ? `For life, since you were ${start}`
              : `For life, from ${start ?? ''}`,
        }
      : {
          title: 'Retired pay',
          value: 'None yet',
          subtitle: serving
            ? `Twenty years of service earns it`
            : `It takes ${RETIRE_ELIGIBLE_YEARS} years and a retirement`,
        };

  const percent = giBillPercent(military);
  const giBill: Fact[] =
    percent > 0
      ? [
          { title: 'GI Bill', value: giShareWords(percent) },
          {
            title: 'Left to use',
            value: `${giMonthsLeft(military)} of ${GI_MONTHS_ENTITLED} months`,
            subtitle: 'A year at college uses nine',
          },
          {
            title: 'Tuition',
            value: `Up to ${money(giTuitionAid(military, GI_TUITION_CAP))} a year`,
          },
          { title: 'Housing', value: `${money(giHousingFor(military))} a year while you study` },
        ]
      : [
          {
            title: 'GI Bill',
            value: 'Not yet',
            subtitle: serving
              ? 'It comes when you leave with an honorable discharge'
              : military.past.some((row) => !GI_BILL_DISCHARGES.includes(row.discharge))
                ? 'It takes an honorable discharge'
                : 'It takes an honorable discharge and some months of service',
          },
        ];

  const preference = veteranPreference(state);
  const held = military.past.some((row) => row.years >= PREFERENCE_MIN_YEARS);
  return {
    pension,
    giBill,
    preference: {
      title: 'Hiring preference',
      value: preference ? 'Yes' : 'No',
      subtitle: preference
        ? 'Public and safety jobs favor a veteran'
        : serving
          ? 'It comes when you leave'
          : held
            ? 'Not with that discharge'
            : `It takes ${PREFERENCE_MIN_YEARS} years of service`,
    },
    before: [...military.past].reverse().map((row) => ({
      title: `${branchShortOf(row.branch)}, ${rankTitle(row.branch, row.track, row.finalGrade)}`,
      value: plural(row.years, 'year'),
      subtitle: `${HOW_ENDED[row.how]} ${DISCHARGE_LABELS[row.discharge]} discharge.`,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* The discharge card                                                           */
/* -------------------------------------------------------------------------- */

const DISCHARGE_TITLES: Readonly<Record<PastService['how'], string>> = {
  'washed-out': 'You washed out',
  'not-retained': 'Your term ended',
  'passed-over': 'Passed over',
  term: 'You left the service',
  retired: 'You retired',
  killed: 'Killed in service',
  medical: 'A medical discharge',
  misconduct: 'Court-martialed',
};

/**
 * The card for a service that has just ended: how, the discharge, and what follows it (retired pay,
 * the GI Bill, a hiring preference). Read from the state on either side of one change, so it is the
 * same card whether the service ended by a button or at the turn of a year. Nothing when the
 * service did not end in this change, and nothing for a death (the end-of-life card has that).
 */
export function dischargeOutcome(before: GameState, after: GameState): Outcome | undefined {
  if (before.player.id !== after.player.id || !after.player.alive) return undefined;
  if (before.military.service === undefined || after.military.service !== undefined)
    return undefined;
  if (after.military.past.length <= before.military.past.length) return undefined;
  const row = after.military.past[after.military.past.length - 1]!;
  const lines: string[] = [];
  lines.push(
    row.years > 0
      ? `${HOW_ENDED[row.how]} You served ${plural(row.years, 'year')} in ${branchNameOf(row.branch)} and left as ${articled(rankTitle(row.branch, row.track, row.finalGrade))}.`
      : HOW_ENDED[row.how],
  );
  lines.push(`Your discharge: ${DISCHARGE_LABELS[row.discharge]}.`);
  const pay = retiredPayFor(row);
  lines.push(
    pay > 0
      ? `Retired pay of ${money(pay)} a year starts next year, for life.`
      : `No retired pay: it takes ${RETIRE_ELIGIBLE_YEARS} years and a retirement.`,
  );
  const percent = giBillPercent(after.military);
  lines.push(
    percent > 0
      ? `The GI Bill is yours: ${giShareWords(percent).toLowerCase()}, with ${plural(giMonthsLeft(after.military), 'month')} to use.`
      : 'No GI Bill: it takes an honorable discharge and some months of service.',
  );
  if (veteranPreference(after)) {
    lines.push('Hiring panels for public and safety work will favor a veteran.');
  }
  return {
    title: DISCHARGE_TITLES[row.how],
    art: 'service',
    body: lines.join(' '),
    tone:
      row.discharge === 'honorable' || row.discharge === 'medical'
        ? 'good'
        : row.discharge === 'general'
          ? 'neutral'
          : 'bad',
  };
}

const articled = (title: string): string =>
  `${/^[aeiou]/i.test(title) ? 'an' : 'a'} ${title.toLowerCase()}`;

/* -------------------------------------------------------------------------- */
/* An agency                                                                    */
/* -------------------------------------------------------------------------- */

/** The agency's own opinion of somebody, in words. */
export function agencyStandingWord(reputation: number): string {
  if (reputation >= 85) return 'Talked about in the building';
  if (reputation >= 70) return 'Trusted';
  if (reputation >= 55) return 'Solid';
  if (reputation >= 40) return 'Unremarkable';
  return 'On a short leash';
}

const AGENCY_HOW_ENDED: Readonly<Record<PastAgency['how'], string>> = {
  'washed-out': "You didn't finish the academy.",
  'let-go': 'They let you go.',
  'clearance-lost': 'You lost your clearance, and the job with it.',
  resigned: 'You resigned.',
  retired: 'You retired.',
  killed: 'You died on a mission.',
};

export type AgencyKind = 'in' | 'elsewhere' | 'door';

export interface AgencyView {
  readonly kind: AgencyKind;
  readonly name: string;
  readonly facts: readonly Fact[];
  readonly going?: Going;
  readonly pushesLeft: number;
  /** What leaving is called: a person with the years and the age retires. */
  readonly leaveLabel?: string;
  /** For the door: what it asks, in words, and why Apply is shut when it is. */
  readonly door?: {
    readonly asks: readonly Fact[];
    readonly help?: string;
    readonly closed?: string;
  };
  readonly before: readonly Fact[];
}

export function agencyView(state: GameState, agencyId: AgencyId): AgencyView {
  const agency = findAgency(agencyId)!;
  const age = state.player.age;
  const career = state.intel.career;
  const clearance = clearanceHeld(state.intel, age);
  const before: Fact[] = [...state.intel.past]
    .reverse()
    .filter((row) => row.agency === agencyId)
    .map((row) => ({
      title: agencyTitle(agencyId, row.finalGrade),
      value: plural(row.years, 'year'),
      subtitle: `${AGENCY_HOW_ENDED[row.how]}${row.pension > 0 ? ` Retired pay of ${money(row.pension)} a year.` : ''}`,
    }));
  const base = { name: agency.short, pushesLeft: 0, before };

  if (career?.agency === agencyId) {
    const training = career.stage === 'training';
    const facts: Fact[] = [
      { title: 'Title', value: agencyTitle(agencyId, career.grade) },
      training
        ? { title: 'Posting', value: 'In training', subtitle: upper(agency.training) }
        : { title: 'Posting', value: career.post },
      { title: 'At the agency', value: plural(career.years, 'year') },
      { title: 'Pay', value: `${money(agencyPayOf(career))} a year` },
      { title: 'Your name', value: agencyStandingWord(career.reputation) },
    ];
    if (clearance) facts.push({ title: 'Clearance', value: CLEARANCE_LABELS[clearance.level] });
    return {
      ...base,
      kind: 'in',
      facts,
      going: {
        words: standingWords(career.performance),
        meter: career.performance,
        low: career.performance < AGENCY_RETAIN_FLOOR,
      },
      pushesLeft: pushesLeft(state),
      leaveLabel:
        career.years >= RETIRE_ELIGIBLE_YEARS && age >= AGENCY_PENSION_AGE
          ? 'Retire from the agency'
          : 'Leave the agency',
    };
  }
  if (career) return { ...base, kind: 'elsewhere', facts: [] };

  const trial = applyToAgency(state, agencyId);
  const asks: Fact[] = [
    { title: 'Age', value: `${agency.minAge} to ${agency.maxAge}` },
    { title: 'Education', value: "A bachelor's degree" },
    ...(agency.experienceYears > 0
      ? [
          {
            title: 'Experience',
            value: plural(agency.experienceYears, 'year'),
            subtitle: 'Service in uniform counts',
          },
        ]
      : []),
    {
      title: 'Clearance',
      value: CLEARANCE_LABELS[AGENCY_CLEARANCE],
      subtitle: 'Checked after the offer',
    },
  ];
  // What the hiring odds really lift for: a clearance already held, and years in an intelligence job.
  const cleared = clearance !== undefined;
  const intelYears = intelligenceYears(state.military);
  const help = cleared
    ? intelYears > 0
      ? 'Your clearance and your years in intelligence count for you.'
      : 'Your clearance counts for you.'
    : intelYears > 0
      ? 'Your years in intelligence count for you.'
      : undefined;
  return {
    ...base,
    kind: 'door',
    facts: [],
    door: {
      asks,
      ...(help === undefined ? {} : { help }),
      ...(trial.ok ? {} : { closed: AGENCY_ERROR_LABELS[trial.error] }),
    },
  };
}
