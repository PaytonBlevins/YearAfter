/**
 * Tickets 0901 and 0902 — basic pay.
 *
 * The 2026 basic pay tables for enlisted members (0901) and commissioned officers (0902), by grade and years of
 * service. Every branch is paid from the same two tables, the Coast Guard included, so pay does not depend on the
 * branch. Housing and food are provided and are not a row.
 *
 * Sources. The officer table (O-1 to O-6) is read from DFAS's own page, "Basic Pay – Officers Effective January 1,
 * 2026". The enlisted table is read from a third-party copy of the DFAS chart that cites DFAS and agrees with the game's
 * table in every cell; DFAS's enlisted page could not be fetched, so the enlisted table is checked against a second
 * reading and not against DFAS itself. Two things the officer table has that the game does not: the O-1E, O-2E and
 * O-3E rows, which pay an officer with more than four years of earlier enlisted service more (their rates were not
 * on the page read), and the warrant grades and the general officers (O-7 and up), which are not built.
 *
 * `null` in an enlisted row is a cell the table does not have (nobody is that grade that early); the first real
 * value stands in.
 */

export type ServiceTrack = 'enlisted' | 'officer';

/** The grades each ladder has: E-1 to E-9, and O-1 to O-6 (generals and admirals, and warrant officers, are not built). */
export const ENLISTED_TOP_GRADE = 9;
export const OFFICER_TOP_GRADE = 6;

/** The years-of-service steps of the DFAS table. A step applies from that many completed years. */
export const PAY_STEPS: readonly number[] = [0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26];

const PAY_TABLE_2026: Readonly<Record<number, readonly (number | null)[]>> = {
  1: Array.from({ length: 15 }, () => 2407.2),
  2: Array.from({ length: 15 }, () => 2697.9),
  3: [2836.8, 3015, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198],
  4: [
    3142.2, 3303, 3482.4, 3658.5, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4,
    3815.4, 3815.4, 3815.4,
  ],
  5: [
    3342.9, 3598.2, 3775.8, 3946.8, 4110, 4299.9, 4395.3, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7,
    4421.7, 4421.7, 4421.7,
  ],
  6: [
    3401.1, 3743.1, 3908.1, 4068.9, 4235.7, 4612.8, 4759.5, 5043.3, 5130.3, 5193.6, 5267.7, 5267.7,
    5267.7, 5267.7, 5267.7,
  ],
  7: [
    3932.1, 4291.5, 4456.2, 4673.1, 4843.8, 5135.7, 5300.4, 5591.7, 5835, 6000.9, 6177.3, 6245.7,
    6475.2, 6598.2, 7067.4,
  ],
  8: [
    null,
    null,
    null,
    null,
    null,
    5656.5,
    5907,
    6061.8,
    6247.2,
    6448.2,
    6811.2,
    6995.4,
    7308.3,
    7481.7,
    7908.9,
  ],
  9: [
    null,
    null,
    null,
    null,
    null,
    null,
    6910.2,
    7066.5,
    7263.6,
    7496.1,
    7730.7,
    8105.1,
    8423.1,
    8756.7,
    9267.9,
  ],
};

/** Officer basic pay, monthly, effective 1 January 2026, DFAS. Every cell is real. */
const OFFICER_PAY_TABLE_2026: Readonly<Record<number, readonly number[]>> = {
  1: [
    4150.2, 4320, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4, 5222.4,
    5222.4, 5222.4, 5222.4,
  ],
  2: [
    4782, 5446.2, 6272.4, 6484.5, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7, 6617.7,
    6617.7, 6617.7, 6617.7,
  ],
  3: [
    5534.1, 6273.9, 6770.4, 7382.7, 7737, 8125.5, 8375.7, 8788.2, 9004.2, 9004.2, 9004.2, 9004.2,
    9004.2, 9004.2, 9004.2,
  ],
  4: [
    6294.6, 7286.4, 7773.6, 7881, 8332.2, 8816.4, 9420, 9888.3, 10214.4, 10401.6, 10509.9, 10509.9,
    10509.9, 10509.9, 10509.9,
  ],
  5: [
    7295.4, 8218.2, 8787, 8894.1, 9249.6, 9461.4, 9928.5, 10271.7, 10715.1, 11391.3, 11713.8,
    12032.7, 12394.8, 12394.8, 12394.8,
  ],
  6: [
    8751.3, 9613.8, 10245, 10245, 10284.3, 10725, 10783.5, 10783.5, 11396.4, 12479.7, 13115.4,
    13751.1, 14112.9, 14479.2, 15188.7,
  ],
};

/** The monthly basic pay table is for 2026. Pay in the game is not adjusted for later years (the economy is constant-dollar). */
export const PAY_TABLE_YEAR = 2026;

const clampGrade = (grade: number, top: number): number =>
  Math.max(1, Math.min(top, Math.round(grade)));

/**
 * Monthly basic pay for a grade at a number of completed years of service, whole cents. `years` is total years of
 * service, not years in the grade or as an officer: an officer who was enlisted first is paid on all of it.
 */
export function monthlyBasePay(
  grade: number,
  years: number,
  track: ServiceTrack = 'enlisted',
): number {
  const rows = track === 'officer' ? OFFICER_PAY_TABLE_2026 : PAY_TABLE_2026;
  const row =
    rows[clampGrade(grade, track === 'officer' ? OFFICER_TOP_GRADE : ENLISTED_TOP_GRADE)]!;
  let step = 0;
  PAY_STEPS.forEach((from, index) => {
    if (years >= from) step = index;
  });
  // The top two enlisted grades have no cell before their first listed step: they are paid that first one.
  return (row[step] ?? row.find((value) => value !== null)) as number;
}

/** A year of basic pay, whole dollars. Housing and food are provided, so there is no allowance on top. */
export const annualBasePay = (
  grade: number,
  years: number,
  track: ServiceTrack = 'enlisted',
): number => Math.round(monthlyBasePay(grade, years, track) * 12);

/** The basic-training year of somebody who does not finish: about half a year of E-1 pay. */
export const washOutPay = (): number => Math.round(monthlyBasePay(1, 0) * 6);

/** The officer-training year of an officer candidate who does not finish: half a year of the O-1 rate. */
export const officerWashOutPay = (years: number): number =>
  Math.round(monthlyBasePay(1, years, 'officer') * 6);
