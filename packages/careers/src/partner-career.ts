/** P16: autonomous catalog careers, keyed within a game. No global RNG draws. */
import { mixedUnit } from '@yearafter/core';
import { type EducationLevel, EDUCATION_ORDER } from '@yearafter/education';
import { ALL_JOBS, findJob, type Job } from './jobs';
import { afterTax } from './pay';
import {
  partnerYear,
  partnerWorkOf,
  retirementAgeOf,
  earningPowerOf,
  earningsCurve,
  type PartnerInput,
  type PartnerYear,
} from './partner';

export type PartnerStyle = 'steady' | 'ordinary' | 'mobile';
export type PartnerChange =
  | 'started'
  | 'unchanged'
  | 'raise'
  | 'cut'
  | 'moved'
  | 'promoted'
  | 'returned'
  | 'stopped'
  | 'retired';
export interface PartnerCareer {
  readonly jobId: string;
  /** Own full-time wage; frozen at retirement. */
  readonly salary: number;
  readonly style: PartnerStyle;
  readonly credential: EducationLevel;
  readonly license?: string;
  readonly jobSince: number;
  readonly year: number;
  /** Last settled household year. Screens never evolve this. */
  readonly last: PartnerYear;
  readonly change: PartnerChange;
}
export type PartnerCareers = Readonly<Record<string, PartnerCareer>>;
export interface PartnerCareerInput extends PartnerInput {
  readonly seed: string;
  readonly worldYear: number;
  /** Initial context only: actual gross salary/commission, never wealth. */
  readonly playerPay: number;
}
const normal = (key: string): number =>
  Math.sqrt(-2 * Math.log(Math.max(1e-9, mixedUnit(`${key}:a`)))) *
  Math.cos(2 * Math.PI * mixedUnit(`${key}:b`));
const closest = (target: number, jobs: readonly Job[]): Job => {
  const job = [...jobs].sort(
    (a, b) => Math.abs(Math.log(a.pay / target)) - Math.abs(Math.log(b.pay / target)),
  )[0];
  if (!job) throw new Error('No age-eligible partner job');
  return job;
};
function paid(input: PartnerInput, salary: number): PartnerYear {
  // Preserve the established participation, baby, spell and retirement rules.
  const status = partnerWorkOf(input);
  const gross =
    status === 'notWorking'
      ? 0
      : Math.round(salary * (status === 'retired' ? 0.4 : input.age < 22 ? 0.5 : 1));
  const net = afterTax(gross);
  return { status, gross, net, tax: gross - net };
}
export function startPartnerCareer(input: PartnerCareerInput): PartnerCareer {
  const key = `${input.seed}:${input.id}`;
  const pool = ALL_JOBS.filter((j) => j.minAge <= input.age);
  const background = pool[Math.floor(mixedUnit(`p16:${key}:background`) * pool.length)];
  if (!background) throw new Error('Partner career requires an adult');
  const context =
    input.age < retirementAgeOf(input.id) && input.playerPay > 0
      ? Math.max(20_000, Math.min(400_000, input.playerPay))
      : 0;
  const target =
    (context > 0
      ? Math.exp(0.05 * Math.log(background.pay) + 0.95 * Math.log(context))
      : background.pay) * Math.exp(0.2 * normal(`p16:${key}:initial`));
  const job = closest(target, pool);
  const salary = Math.round(job.pay * Math.exp(0.12 * normal(`p16:${key}:quote`)));
  const style = mixedUnit(`p16:${key}:type`);
  return {
    jobId: job.id,
    salary,
    style: style < 0.2 ? 'steady' : style < 0.8 ? 'ordinary' : 'mobile',
    credential: job.requires,
    ...(job.license ? { license: job.license } : {}),
    jobSince: input.worldYear,
    year: input.worldYear,
    last: paid(input, salary),
    change: 'started',
  };
}
export function advancePartnerCareer(
  input: PartnerCareerInput,
  career: PartnerCareer,
): PartnerCareer {
  if (input.worldYear <= career.year) return career;
  let current = career;
  // Catch up their own career only; the caller posts just the current year.
  for (let year = career.year + 1; year <= input.worldYear; year++) {
    const age = input.age - (input.worldYear - year);
    let job = findJob(current.jobId);
    if (!job) throw new Error('Unknown saved partner job');
    let salary = current.salary;
    let jobSince = current.jobSince;
    let change: PartnerChange = 'unchanged';
    const key = `${input.seed}:${input.id}`;
    if (current.style !== 'steady' && age < retirementAgeOf(input.id)) {
      salary = Math.round(salary * (current.style === 'ordinary' ? 1.01 : 1.015));
      const event = mixedUnit(`p16:${key}:event:${year}`);
      const moveChance = current.style === 'ordinary' ? 0.04 : 0.08;
      const qualified = (j: Job) =>
        j.minAge <= age &&
        EDUCATION_ORDER.indexOf(j.requires) <= EDUCATION_ORDER.indexOf(current.credential) &&
        (!j.license || j.license === current.license);
      if (event < moveChance) {
        const next = closest(
          salary * Math.exp(0.2 * normal(`p16:${key}:switch:${year}`)),
          ALL_JOBS.filter((j) => j.track === job!.track && j.rung === job!.rung && qualified(j)),
        );
        salary = Math.round(
          salary * (next.pay / job.pay) * Math.exp(0.08 * normal(`p16:${key}:offer:${year}`)),
        );
        job = next;
        jobSince = year;
        change = 'moved';
      } else if (event < moveChance + 0.03) {
        const next = ALL_JOBS.find(
          (j) => j.track === job!.track && j.rung === job!.rung + 1 && qualified(j),
        );
        if (next) {
          salary = Math.round(salary * (next.pay / job.pay));
          job = next;
          jobSince = year;
          change = 'promoted';
        }
      } else if (event < moveChance + 0.06) {
        salary = Math.round(salary * (0.85 + 0.09 * mixedUnit(`p16:${key}:cut:${year}`)));
      }
      salary = Math.max(20_000, Math.min(Math.round(job.pay * 1.9), salary));
      if (change === 'unchanged')
        change = salary > current.salary ? 'raise' : salary < current.salary ? 'cut' : 'unchanged';
    }
    const last = paid({ ...input, age }, salary);
    if (last.status !== current.last.status)
      change =
        last.status === 'retired' ? 'retired' : last.status === 'working' ? 'returned' : 'stopped';
    current = { ...current, jobId: job.id, salary, year, jobSince, last, change };
  }
  return current;
}

/** v50 has no job history. Preserve its exact current income, infer only a future job. */
export function legacyPartnerCareer(input: PartnerCareerInput): PartnerCareer {
  const last = partnerYear(input);
  const prospective = startPartnerCareer({ ...input, playerPay: 0 });
  // Legacy out-of-work wage potential must also be inferred without inventing pay.
  const salary = last.status === 'retired' ? Math.round(last.gross / 0.4) : legacySalary(input);
  const job = closest(
    salary,
    ALL_JOBS.filter((j) => j.minAge <= input.age),
  );
  const { license: _inferred, ...base } = prospective;
  return {
    ...base,
    jobId: job.id,
    salary,
    credential: job.requires,
    ...(job.license ? { license: job.license } : {}),
    last,
    change: 'unchanged',
  };
}
const legacySalary = (input: PartnerInput) =>
  Math.round((earningPowerOf(input.id) * earningsCurve(input.age)) / (input.age < 22 ? 0.5 : 1));

const CHANGE_TEXT: Readonly<Record<PartnerChange, string>> = {
  started: 'Their first year contributing to the household.',
  unchanged: 'Their pay stayed the same.',
  raise: 'A pay rise this year.',
  cut: 'Their pay was cut this year.',
  moved: 'They started a new job this year.',
  promoted: 'They were promoted this year.',
  returned: 'They returned to work this year.',
  stopped: 'They are out of work right now.',
  retired: 'They retired this year.',
};
export const partnerCareerText = (career: PartnerCareer): string => CHANGE_TEXT[career.change];
