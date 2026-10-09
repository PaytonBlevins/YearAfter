import { EDUCATION_ORDER } from '@yearafter/education';
import { ALL_JOBS, afterTax, findJob, type PartnerCareers } from '@yearafter/careers';
/** A malformed saved job must fail before an annual phase can use it. */
export function partnerCareersOk(value: unknown, worldYear: number): value is PartnerCareers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([id, raw]) => {
    if (!id || !raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const c = raw as Record<string, unknown>;
    const job = typeof c['jobId'] === 'string' ? findJob(c['jobId']) : undefined;
    const last = c['last'] as Record<string, unknown> | undefined;
    const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n);
    return (
      !!job &&
      integer(c['salary']) &&
      Number(c['salary']) > 0 &&
      ['steady', 'ordinary', 'mobile'].includes(String(c['style'])) &&
      EDUCATION_ORDER.includes(c['credential'] as never) &&
      EDUCATION_ORDER.indexOf(job.requires) <= EDUCATION_ORDER.indexOf(c['credential'] as never) &&
      (c['license'] === undefined || ALL_JOBS.some((j) => j.license === c['license'])) &&
      (!job.license || job.license === c['license']) &&
      integer(c['year']) &&
      Number(c['year']) <= worldYear &&
      integer(c['jobSince']) &&
      Number(c['jobSince']) <= Number(c['year']) &&
      [
        'started',
        'unchanged',
        'raise',
        'cut',
        'moved',
        'promoted',
        'returned',
        'stopped',
        'retired',
      ].includes(String(c['change'])) &&
      !!last &&
      typeof last === 'object' &&
      !Array.isArray(last) &&
      ['working', 'notWorking', 'retired'].includes(String(last['status'])) &&
      integer(last['gross']) &&
      Number(last['gross']) >= 0 &&
      integer(last['net']) &&
      integer(last['tax']) &&
      last['net'] === afterTax(Number(last['gross'])) &&
      last['tax'] === Number(last['gross']) - Number(last['net']) &&
      (last['status'] !== 'notWorking' || last['gross'] === 0)
    );
  });
}
