/** P5 calibration: a conservative inclusion chance, not the old linear weight-share proxy. */
import { ALL_JOBS } from './jobs';
import {
  cannotApply,
  fitsStudy,
  listingWeight,
  LISTINGS,
  STUDY_LISTINGS,
  WORKING_AGE,
  type OpeningsContext,
} from './openings';

/**
 * A sufficient event for getting one of k slots: this job's key is at most t,
 * and fewer than k other keys are at most t. Their expected count is at most
 * t * otherWeight. Cantelli's inequality bounds the probability that their
 * count reaches k, using variance <= mean for independent Bernoulli draws.
 * Each threshold gives a lower bound; taking the largest is still a bound.
 * Fractions choose proof thresholds, not game balance or draw probabilities.
 */
function rankChanceFloor(
  weight: number,
  otherWeight: number,
  count: number,
  slots: number,
): number {
  if (weight <= 0 || slots <= 0) return 0;
  if (slots >= count || otherWeight <= 0) return 1;
  let floor = 0;
  for (const fraction of [0.25, 0.5, 0.75]) {
    const mean = slots * fraction;
    const gapSquared = (slots - mean) ** 2;
    const belowSlots = gapSquared / (mean + gapSquared);
    floor = Math.max(floor, Math.min(1, (mean * weight) / otherWeight) * belowSlots);
  }
  return floor;
}

/**
 * Lower bounds for independent uniform candidate draws. Ranking in the first
 * generalSlots of the whole eligible pool guarantees a place even after the
 * reserved matches are removed. Ranking in the matching quota guarantees a
 * reserved place. The larger of those two sufficient-event bounds is safe;
 * adding them would double-count overlap. No RNG is drawn and no state changes.
 */
export function listingChanceFloors(context: OpeningsContext): ReadonlyMap<string, number> {
  if (context.age < WORKING_AGE) return new Map();
  const pool = ALL_JOBS.filter((job) => cannotApply(job, context) === undefined).map((job) => ({
    job,
    weight: listingWeight(context, job),
    matching: fitsStudy(context, job),
  }));
  const total = pool.reduce((sum, row) => sum + row.weight, 0);
  const matching = pool.filter((row) => row.matching);
  const matchingTotal = matching.reduce((sum, row) => sum + row.weight, 0);
  const reserved = Math.min(STUDY_LISTINGS, matching.length);
  const generalSlots = LISTINGS - reserved;
  return new Map(
    pool.map(({ job, weight, matching: isMatch }): [string, number] => {
      if (pool.length <= LISTINGS) return [String(job.id), weight > 0 ? 1 : 0];
      const general = rankChanceFloor(weight, total - weight, pool.length, generalSlots);
      const study = isMatch
        ? rankChanceFloor(weight, matchingTotal - weight, matching.length, reserved)
        : 0;
      return [String(job.id), Math.max(general, study)];
    }),
  );
}
