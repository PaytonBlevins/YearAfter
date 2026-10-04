/**
 * Ticket 0210b — university and graduate school.
 *
 * Review, after playing 0210: *"when you graduate from highschool, there is no
 * college or post graduate options. Those are Necessary!"* They were: spec 1820
 * lists "college/university, majors" among the required systems and 0204 shipped
 * without them, so every character in the game left education at eighteen and a
 * job that wanted a degree was gated on a door that did not exist.
 *
 * WHAT THE SPEC ALLOWS, AND WHAT IT FORBIDS
 *
 * Spec 1821: "Lightweight interaction: major + Study Harder is generally
 * enough." Spec 75: "School should be intentionally lightweight so players reach
 * the adult world quickly." So the whole of college is: choose a major, turn up,
 * press Study Harder, and either finish or do not.
 *
 * Spec 1822 and section 79 remove **test performance and school quality** from
 * admission by name. There is no SAT, no application essay, no college ranking
 * and no acceptance minigame. What decides admission is the record the player
 * already built — their grades — and what it costs.
 *
 * Spec 1823: "Full-time work during college is allowed; stress/performance
 * handles overcommitment." So nothing here blocks a job. The hidden capacity
 * model bills the character for trying to do both, and they read about it
 * afterwards.
 *
 * Spec 1824 and section 90 remove attendance, sleep, class-by-class management,
 * a workload-budget UI and leave-of-absence. None of those exist here.
 */

/* -------------------------------------------------------------------------- */
/* What a character has actually finished                                      */
/* -------------------------------------------------------------------------- */

/**
 * The credential a character holds, as a ladder.
 *
 * Ordered, so a job can name a floor and everything above it clears. Kept
 * separate from `stage` because "in school" and "has a degree" are different
 * questions and a single field answering both is the mistake that made
 * `graduated` mean two things.
 */
export type EducationLevel = 'none' | 'highSchool' | 'university' | 'postgraduate';

export const EDUCATION_ORDER: readonly EducationLevel[] = [
  'none',
  'highSchool',
  'university',
  'postgraduate',
];

export const EDUCATION_LABELS: Readonly<Record<EducationLevel, string>> = {
  none: 'No diploma',
  highSchool: 'High school',
  university: 'University degree',
  postgraduate: 'Graduate degree',
};

/** Ages at which each credential was earned. Absent means never. */
export interface Credentials {
  readonly highSchool?: number;
  readonly university?: number;
  readonly postgraduate?: number;
  /**
   * Licenses held, by id (Ticket 0406).
   *
   * DELIBERATELY NOT ON THE LADDER ABOVE. `EducationLevel` is ordered, and
   * ordering is exactly what a license does not have: a journeyman electrician
   * is not "more" or "less" educated than somebody with a bachelor's in fine
   * arts, they hold a different piece of paper that a different set of jobs
   * legally require. Folding trade school into the degree ladder would have
   * made it read as a lesser degree, which is both wrong and the thing the
   * ticket was written to stop.
   *
   * A plain array of ids rather than id -> age: nothing asks when a license was
   * earned, and a record invites a migration the first time something does.
   */
  readonly licenses?: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Licenses                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A piece of paper a program hands you that a job legally requires.
 *
 * ONE MECHANISM, TWO JOBS, which is the whole reason it is shaped this way.
 * `lic.md` is why a postgraduate degree in fine arts does not make you a
 * physician; `lic.electrical` is why trade school is worth two years when the
 * electrician ladder needs no degree at all. Before 0406 the first of those was
 * simply untrue — `requires: 'postgraduate'` was the only gate on Physician, so
 * any master's whatsoever qualified you to practise medicine.
 */
export interface License {
  readonly id: string;
  readonly name: string;
  /** What it says on the wall, for the row it renders in. */
  readonly short: string;
  /** Tracks this license is a way INTO, for `reachOf`. */
  readonly opens: readonly string[];
  /**
   * The rung it counts as having stood on, on those tracks.
   *
   * THIS IS THE HALF OF TRADE SCHOOL THAT MAKES IT WORTH TWO YEARS. The trades
   * ladder needs no qualification at all — Apprentice electrician at rung 1,
   * Electrician at rung 2 — so a license that only granted the hiring bonus
   * would have bought a slightly better chance at a job the character could
   * already have walked into. What it actually buys is the apprenticeship:
   * `reachOf` treats the holder as somebody who has already stood on rung 1, so
   * they may apply straight to the journeyman job. Somebody without it still
   * gets there, they just spend the years.
   */
  readonly reach: number;
}

export const LICENSES: readonly License[] = [
  // Granted by graduate programs.
  { id: 'lic.md', name: 'Medical license', short: 'MD' , opens: ['medicine'], reach: 1 },
  { id: 'lic.jd', name: 'Admission to the bar', short: 'JD' , opens: ['legal'], reach: 1 },
  { id: 'lic.dvm', name: 'Veterinary license', short: 'DVM' , opens: ['veterinary'], reach: 1 },
  { id: 'lic.dds', name: 'Dental license', short: 'DDS' , opens: ['dental'], reach: 1 },
  { id: 'lic.pharmd', name: 'Pharmacist license', short: 'PharmD' , opens: ['pharmacy'], reach: 1 },
  { id: 'lic.architect', name: 'Architect registration', short: 'RA' , opens: ['architecture'], reach: 1 },
  { id: 'lic.np', name: 'Nurse practitioner license', short: 'NP' , opens: ['care', 'medicine'], reach: 1 },
  { id: 'lic.cpa', name: 'Certified public accountant', short: 'CPA' , opens: ['finance'], reach: 1 },
  { id: 'lic.lcsw', name: 'Clinical social work license', short: 'LCSW' , opens: ['care', 'public'], reach: 1 },
  // Granted by vocational programs.
  { id: 'lic.electrical', name: 'Electrical license', short: 'Journeyman' , opens: ['trades'], reach: 1 },
  { id: 'lic.plumbing', name: 'Plumbing license', short: 'Journeyman' , opens: ['trades'], reach: 1 },
  { id: 'lic.hvac', name: 'HVAC certification', short: 'HVAC' , opens: ['trades'], reach: 1 },
  { id: 'lic.welding', name: 'Welding certification', short: 'Certified welder' , opens: ['trades'], reach: 1 },
  { id: 'lic.cdl', name: 'Commercial driving license', short: 'CDL' , opens: ['logistics'], reach: 1 },
  { id: 'lic.automotive', name: 'Automotive certification', short: 'ASE' , opens: ['trades'], reach: 1 },
  { id: 'lic.cosmetology', name: 'Cosmetology license', short: 'Licensed' , opens: ['creative', 'retail'], reach: 1 },
  { id: 'lic.hygiene', name: 'Dental hygiene license', short: 'RDH' , opens: ['dental'], reach: 1 },
  { id: 'lic.lpn', name: 'Practical nursing license', short: 'LPN' , opens: ['care'], reach: 1 },
  { id: 'lic.culinary', name: 'Culinary certification', short: 'Certified' , opens: ['food', 'hospitality'], reach: 1 },
  { id: 'lic.paralegal', name: 'Paralegal certification', short: 'Certified' , opens: ['legal'], reach: 1 },
  { id: 'lic.paramedic', name: 'Paramedic license', short: 'NRP' , opens: ['safety', 'care'], reach: 1 },
  { id: 'lic.pharmtech', name: 'Pharmacy technician certification', short: 'CPhT' , opens: ['pharmacy'], reach: 1 },
  { id: 'lic.network', name: 'Network certification', short: 'Certified' , opens: ['tech'], reach: 1 },
];

export const findLicense = (id: string): License | undefined =>
  LICENSES.find((license) => license.id === id);

export const holdsLicense = (credentials: Credentials | undefined, id: string): boolean =>
  credentials?.licenses?.includes(id) ?? false;

/**
 * The rung a character's licenses alone put them on, for one track.
 *
 * -1 when none of them speak to this track, which is the same "never worked it"
 * value `reachOf` already uses, so the caller takes a plain maximum.
 */
export function licenseReach(licenses: readonly string[], track: string): number {
  let best = -1;
  for (const id of licenses) {
    const license = findLicense(id);
    if (license && license.opens.includes(track) && license.reach > best) best = license.reach;
  }
  return best;
}

export const licensesOf = (credentials: Credentials | undefined): readonly License[] =>
  (credentials?.licenses ?? [])
    .map(findLicense)
    .filter((license): license is License => license !== undefined);

export function levelOf(credentials: Credentials | undefined): EducationLevel {
  if (!credentials) return 'none';
  if (credentials.postgraduate !== undefined) return 'postgraduate';
  if (credentials.university !== undefined) return 'university';
  if (credentials.highSchool !== undefined) return 'highSchool';
  return 'none';
}

export const meetsLevel = (held: EducationLevel, required: EducationLevel): boolean =>
  EDUCATION_ORDER.indexOf(held) >= EDUCATION_ORDER.indexOf(required);

/* -------------------------------------------------------------------------- */
/* Majors                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What you studied, and the only real decision college asks.
 *
 * Spec 1821 says "major + Study Harder is generally enough", and spec 365 gives
 * Biology as its example — so a major is a single choice made once that changes
 * which careers open up, not a curriculum to manage.
 *
 * A major maps to CAREER TRACKS rather than to individual jobs. Naming jobs here
 * would put the same knowledge in two catalogs and guarantee they drift; naming
 * tracks means adding a job to a track opens it to the right graduates for free.
 */
/**
 * Which tier of the system a program sits in (Ticket 0406).
 *
 * `vocational` is NOT a rung below `undergraduate`. It is a different road that
 * happens to be shorter and cheaper, and it ends in a license rather than a
 * degree. Treating it as a lesser bachelor's — which is the obvious way to
 * build it and the way that was rejected — would have put a plumber's
 * qualification on the same ladder as a doctorate and ranked it below a
 * two-year detour into fine arts.
 */
export type ProgramKind = 'vocational' | 'undergraduate' | 'graduate';

export const PROGRAM_KIND_LABELS: Readonly<Record<ProgramKind, string>> = {
  vocational: 'Trade & certificate',
  undergraduate: 'Undergraduate',
  graduate: 'Graduate & professional',
};

/**
 * The heading a program renders under.
 *
 * SPEC 1336 IS THE REASON THIS FIELD EXISTS: "Do not make inventories so large
 * that search/filtering is necessary. Use curated inventories, contextual
 * gating, and yearly refreshes instead." 0406 takes the catalogue from eight
 * rows to roughly fifty, which is exactly the size that tempts you into a
 * search box. Grouping plus `programsOpenTo` gating is what keeps it a curated
 * list of maybe a dozen rows the character could actually enrol in today.
 */
export type ProgramField =
  | 'health'
  | 'law-public'
  | 'business'
  | 'technical'
  | 'education'
  | 'creative'
  | 'trades'
  | 'service'
  | 'science';

export const FIELD_LABELS: Readonly<Record<ProgramField, string>> = {
  health: 'Health & medicine',
  science: 'Sciences',
  technical: 'Engineering & technology',
  business: 'Business & finance',
  'law-public': 'Law & public service',
  education: 'Education',
  creative: 'Creative & media',
  trades: 'Skilled trades',
  service: 'Service & hospitality',
};

/** The order sections appear in. Health first: it is the deepest tree here. */
export const FIELD_ORDER: readonly ProgramField[] = [
  'health',
  'science',
  'technical',
  'business',
  'law-public',
  'education',
  'creative',
  'trades',
  'service',
];

export interface Major {
  readonly id: string;
  readonly name: string;
  /** One line, for the row it renders in. Under 40 characters — 0210's lesson. */
  readonly blurb: string;
  /** Tracks this degree is genuinely FOR. Others still hire you, less readily. */
  readonly opens: readonly string[];
  /** Some subjects are harder to pass, and it should cost something to pick one. */
  readonly difficulty: number;
  /** Ticket 0406. Which tier, which heading, how long, what it costs. */
  readonly kind: ProgramKind;
  readonly field: ProgramField;
  /** Years to finish. Was a per-tier constant until 0406; medicine takes longer. */
  readonly years: number;
  /** Whole dollars a year. Was a per-tier constant until 0406. */
  readonly tuition: number;
  /** The license finishing this hands you, if any. */
  readonly grants?: string;
  /**
   * Undergraduate majors this program is really built on top of.
   *
   * SOFT, not a wall. Spec 119 keeps reinvention open and the codebase has
   * refused hard prerequisites everywhere else for the same reason, so a
   * fine-arts graduate may sit down and apply to medical school — they are just
   * markedly less likely to get in than the biology graduate beside them.
   * Undefined means no program feeds it in particular.
   */
  readonly follows?: readonly string[];
  /** Nobody enrols younger than this. */
  readonly minAge: number;
}

/*
  THE CATALOGUE. Fifty-odd rows where 0210b had eight, and the eight are still
  here with their original ids because they are in every save ever written.

  WHAT 0406 WAS ACTUALLY FIXING. 0403 grew the job catalogue to sixteen tracks
  and nobody came back to this list, so five of those tracks — medicine, legal,
  tech, finance and hospitality — had NO program pointing at them at all. The
  four richest ladders in the game (Physician, Partner, VP of engineering,
  Finance director) could only be entered as an off-major applicant eating the
  -0.2 relevance penalty. Worse, `requires: 'postgraduate'` was the only gate on
  Physician, so a master's in fine arts qualified you to practise medicine.

  `opens` NAMES TRACKS, NEVER JOBS — 0210b's rule and it still holds. Adding a
  job to a track opens it to the right graduates for free.
*/
export const MAJORS: readonly Major[] = [
  /* ---------------------------------------------------------------------- */
  /* Trade and certificate — one or two years, a license at the end          */
  /*                                                                        */
  /* Cheap and short on purpose. This is the road that competes with going   */
  /* straight to work at eighteen, not the one that competes with a degree,  */
  /* and it has to be worth the two years against a wage the character could */
  /* have been earning the whole time.                                      */
  /* ---------------------------------------------------------------------- */
  {
    id: 'voc.electrical',
    name: 'Electrical trade',
    blurb: 'Two years, and the license at the end.',
    opens: ['trades'],
    difficulty: 0.45,
    kind: 'vocational',
    field: 'trades',
    years: 2,
    tuition: 5_200,
    grants: 'lic.electrical',
    minAge: 17,
  },
  {
    id: 'voc.plumbing',
    name: 'Plumbing & pipefitting',
    blurb: 'Nobody ever stopped needing one.',
    opens: ['trades'],
    difficulty: 0.45,
    kind: 'vocational',
    field: 'trades',
    years: 2,
    tuition: 5_000,
    grants: 'lic.plumbing',
    minAge: 17,
  },
  {
    id: 'voc.hvac',
    name: 'HVAC & refrigeration',
    blurb: 'Hot roofs in July, and worth it.',
    opens: ['trades'],
    difficulty: 0.42,
    kind: 'vocational',
    field: 'trades',
    years: 2,
    tuition: 4_800,
    grants: 'lic.hvac',
    minAge: 17,
  },
  {
    id: 'voc.welding',
    name: 'Welding',
    blurb: 'A steady hand pays for itself.',
    opens: ['trades', 'logistics'],
    difficulty: 0.4,
    kind: 'vocational',
    field: 'trades',
    years: 1,
    tuition: 4_400,
    grants: 'lic.welding',
    minAge: 17,
  },
  {
    id: 'voc.automotive',
    name: 'Automotive technology',
    blurb: 'Everything is computers now. Still grease.',
    opens: ['trades'],
    difficulty: 0.4,
    kind: 'vocational',
    field: 'trades',
    years: 2,
    tuition: 4_600,
    grants: 'lic.automotive',
    minAge: 17,
  },
  {
    id: 'voc.cdl',
    name: 'Commercial driving',
    blurb: 'Six weeks, and the road after that.',
    opens: ['logistics'],
    difficulty: 0.3,
    kind: 'vocational',
    field: 'trades',
    years: 1,
    tuition: 3_600,
    grants: 'lic.cdl',
    minAge: 18,
  },
  {
    id: 'voc.culinary',
    name: 'Culinary arts',
    blurb: 'Knife skills, and the hours to match.',
    opens: ['food', 'hospitality'],
    difficulty: 0.38,
    kind: 'vocational',
    field: 'service',
    years: 2,
    tuition: 5_400,
    grants: 'lic.culinary',
    minAge: 17,
  },
  {
    id: 'voc.cosmetology',
    name: 'Cosmetology',
    blurb: 'A chair of your own, eventually.',
    opens: ['creative', 'retail'],
    difficulty: 0.35,
    kind: 'vocational',
    field: 'service',
    years: 1,
    tuition: 4_200,
    grants: 'lic.cosmetology',
    minAge: 17,
  },
  {
    id: 'voc.lpn',
    name: 'Practical nursing',
    blurb: 'On a ward within the year.',
    opens: ['care'],
    difficulty: 0.55,
    kind: 'vocational',
    field: 'health',
    years: 1,
    tuition: 6_200,
    grants: 'lic.lpn',
    minAge: 18,
  },
  {
    id: 'voc.hygiene',
    name: 'Dental hygiene',
    blurb: 'Good pay, and nobody is pleased to see you.',
    opens: ['dental'],
    difficulty: 0.5,
    kind: 'vocational',
    field: 'health',
    years: 2,
    tuition: 6_800,
    grants: 'lic.hygiene',
    minAge: 18,
  },
  {
    id: 'voc.paramedic',
    name: 'Emergency medical',
    blurb: 'The worst day of somebody else’s life.',
    opens: ['safety', 'care'],
    difficulty: 0.52,
    kind: 'vocational',
    field: 'health',
    years: 2,
    tuition: 5_600,
    grants: 'lic.paramedic',
    minAge: 18,
  },
  {
    id: 'voc.pharmtech',
    name: 'Pharmacy technician',
    blurb: 'Counting, checking, counting again.',
    opens: ['pharmacy', 'care'],
    difficulty: 0.42,
    kind: 'vocational',
    field: 'health',
    years: 1,
    tuition: 4_400,
    grants: 'lic.pharmtech',
    minAge: 18,
  },
  {
    id: 'voc.paralegal',
    name: 'Paralegal studies',
    blurb: 'The work behind the work.',
    opens: ['legal', 'office'],
    difficulty: 0.44,
    kind: 'vocational',
    field: 'law-public',
    years: 2,
    tuition: 5_800,
    grants: 'lic.paralegal',
    minAge: 18,
  },
  {
    id: 'voc.network',
    name: 'IT & networking',
    blurb: 'Certifications, and the lab at midnight.',
    opens: ['tech'],
    difficulty: 0.45,
    kind: 'vocational',
    field: 'technical',
    years: 1,
    tuition: 4_800,
    grants: 'lic.network',
    minAge: 17,
  },

  /* ---------------------------------------------------------------------- */
  /* Undergraduate — four years, the original eight plus the tracks 0403     */
  /* left with nothing pointing at them                                      */
  /* ---------------------------------------------------------------------- */
  {
    id: 'major.nursing',
    name: 'Nursing',
    blurb: 'Long hours, and always work at the end.',
    opens: ['care', 'medicine'],
    difficulty: 0.6,
    kind: 'undergraduate',
    field: 'health',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.biology',
    name: 'Biology',
    blurb: 'Spec 365 named this one. Here it is.',
    opens: ['medicine', 'veterinary', 'pharmacy'],
    difficulty: 0.68,
    kind: 'undergraduate',
    field: 'science',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.chemistry',
    name: 'Chemistry',
    blurb: 'Labs on Fridays for four years.',
    opens: ['pharmacy', 'medicine'],
    difficulty: 0.72,
    kind: 'undergraduate',
    field: 'science',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.kinesiology',
    name: 'Health sciences',
    blurb: 'Bodies, and what goes wrong with them.',
    opens: ['care', 'medicine'],
    difficulty: 0.55,
    kind: 'undergraduate',
    field: 'health',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.psychology',
    name: 'Psychology',
    blurb: 'Popular, and it goes more places than they say.',
    opens: ['care', 'education', 'public'],
    difficulty: 0.45,
    kind: 'undergraduate',
    field: 'science',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.compsci',
    name: 'Computer science',
    blurb: 'Hard for two years, then it clicks.',
    opens: ['tech'],
    difficulty: 0.72,
    kind: 'undergraduate',
    field: 'technical',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.engineering',
    name: 'Engineering',
    blurb: 'Hard, and the hardest to walk away from.',
    opens: ['tech', 'trades', 'office', 'logistics'],
    difficulty: 0.75,
    kind: 'undergraduate',
    field: 'technical',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.electricaleng',
    name: 'Electrical engineering',
    blurb: 'The one with the worst reputation, earned.',
    opens: ['tech', 'trades'],
    difficulty: 0.8,
    kind: 'undergraduate',
    field: 'technical',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.civileng',
    name: 'Civil engineering',
    blurb: 'Things that have to stay up.',
    opens: ['architecture', 'trades', 'office'],
    difficulty: 0.74,
    kind: 'undergraduate',
    field: 'technical',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.prearch',
    name: 'Architectural studies',
    blurb: 'Drawing, until it becomes buildings.',
    opens: ['architecture'],
    difficulty: 0.66,
    kind: 'undergraduate',
    field: 'technical',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.math',
    name: 'Mathematics',
    blurb: 'Opens more doors than it looks like.',
    opens: ['finance', 'tech', 'education'],
    difficulty: 0.78,
    kind: 'undergraduate',
    field: 'science',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.business',
    name: 'Business',
    blurb: 'Broad, and it goes almost anywhere.',
    opens: ['office', 'retail', 'sales', 'logistics'],
    difficulty: 0.4,
    kind: 'undergraduate',
    field: 'business',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.finance',
    name: 'Finance',
    blurb: 'Other people’s money, professionally.',
    opens: ['finance', 'office'],
    difficulty: 0.6,
    kind: 'undergraduate',
    field: 'business',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.accounting',
    name: 'Accounting',
    blurb: 'Dull, dependable, always hiring.',
    opens: ['finance', 'office'],
    difficulty: 0.55,
    kind: 'undergraduate',
    field: 'business',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.economics',
    name: 'Economics',
    blurb: 'Nobody agrees what it is for.',
    opens: ['finance', 'public', 'office'],
    difficulty: 0.62,
    kind: 'undergraduate',
    field: 'business',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.marketing',
    name: 'Marketing',
    blurb: 'Half art, half spreadsheet.',
    opens: ['sales', 'retail', 'creative'],
    difficulty: 0.42,
    kind: 'undergraduate',
    field: 'business',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.criminology',
    name: 'Criminal justice',
    blurb: 'A degree with a uniform at the end of it.',
    opens: ['safety', 'public', 'legal'],
    difficulty: 0.45,
    kind: 'undergraduate',
    field: 'law-public',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.polisci',
    name: 'Political science',
    blurb: 'Everybody here is going to law school.',
    opens: ['public', 'legal'],
    difficulty: 0.5,
    kind: 'undergraduate',
    field: 'law-public',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.publicadmin',
    name: 'Public administration',
    blurb: 'How a city actually runs.',
    opens: ['public', 'office'],
    difficulty: 0.45,
    kind: 'undergraduate',
    field: 'law-public',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.socialwork',
    name: 'Social work',
    blurb: 'The caseload is the job.',
    opens: ['care', 'public'],
    difficulty: 0.48,
    kind: 'undergraduate',
    field: 'law-public',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.education',
    name: 'Education',
    blurb: 'You will be in a classroom either way.',
    opens: ['education'],
    difficulty: 0.35,
    kind: 'undergraduate',
    field: 'education',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.arts',
    name: 'Fine arts',
    blurb: 'Everybody has an opinion about this one.',
    opens: ['creative'],
    difficulty: 0.3,
    kind: 'undergraduate',
    field: 'creative',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.communications',
    name: 'Communications',
    blurb: 'The one people are rude about.',
    opens: ['creative', 'sales', 'office'],
    difficulty: 0.34,
    kind: 'undergraduate',
    field: 'creative',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },
  {
    id: 'major.hospitality',
    name: 'Hospitality',
    blurb: 'Food, rooms, and other people.',
    opens: ['hospitality', 'food', 'retail'],
    difficulty: 0.3,
    kind: 'undergraduate',
    field: 'service',
    years: 4,
    tuition: 9_400,
    minAge: 18,
  },

  /* ---------------------------------------------------------------------- */
  /* Graduate and professional                                               */
  /*                                                                        */
  /* THE TIER 0210b DID NOT HAVE. Before this, `nextDegreeFor` returned the  */
  /* string 'postgrad', you studied your existing major two more years, and  */
  /* you held `postgraduate` — one door, generic, and the only thing         */
  /* standing between a fine-arts master's and a surgical ward. These are    */
  /* long and expensive because they are the ones that pay, and `grants`     */
  /* is what makes the difference real rather than cosmetic.                */
  /* ---------------------------------------------------------------------- */
  {
    id: 'grad.md',
    name: 'Medical school',
    blurb: 'Four years, then the hospital owns you.',
    opens: ['medicine'],
    difficulty: 0.92,
    kind: 'graduate',
    field: 'health',
    years: 4,
    tuition: 34_000,
    grants: 'lic.md',
    follows: ['major.biology', 'major.chemistry', 'major.kinesiology', 'major.nursing'],
    minAge: 21,
  },
  {
    id: 'grad.dvm',
    name: 'Veterinary school',
    blurb: 'Harder to get into than medicine.',
    opens: ['veterinary'],
    difficulty: 0.88,
    kind: 'graduate',
    field: 'health',
    years: 4,
    tuition: 30_000,
    grants: 'lic.dvm',
    follows: ['major.biology', 'major.chemistry', 'major.kinesiology'],
    minAge: 21,
  },
  {
    id: 'grad.dds',
    name: 'Dental school',
    blurb: 'Steady hands and somebody else’s mouth.',
    opens: ['dental'],
    difficulty: 0.86,
    kind: 'graduate',
    field: 'health',
    years: 4,
    tuition: 32_000,
    grants: 'lic.dds',
    follows: ['major.biology', 'major.chemistry'],
    minAge: 21,
  },
  {
    id: 'grad.pharmd',
    name: 'Pharmacy school',
    blurb: 'The last person who checks.',
    opens: ['pharmacy'],
    difficulty: 0.8,
    kind: 'graduate',
    field: 'health',
    years: 4,
    tuition: 27_000,
    grants: 'lic.pharmd',
    follows: ['major.chemistry', 'major.biology'],
    minAge: 21,
  },
  {
    id: 'grad.msn',
    name: 'Nurse practitioner',
    blurb: 'The ward, but it is your call now.',
    opens: ['care', 'medicine'],
    difficulty: 0.7,
    kind: 'graduate',
    field: 'health',
    years: 2,
    tuition: 19_000,
    grants: 'lic.np',
    follows: ['major.nursing', 'major.kinesiology'],
    minAge: 21,
  },
  {
    id: 'grad.mph',
    name: 'Public health',
    blurb: 'Whole populations, one spreadsheet.',
    opens: ['public', 'medicine'],
    difficulty: 0.6,
    kind: 'graduate',
    field: 'health',
    years: 2,
    tuition: 17_000,
    follows: ['major.biology', 'major.psychology', 'major.nursing', 'major.publicadmin'],
    minAge: 21,
  },
  {
    id: 'grad.jd',
    name: 'Law school',
    blurb: 'Three years, and the bar after that.',
    opens: ['legal'],
    difficulty: 0.82,
    kind: 'graduate',
    field: 'law-public',
    years: 3,
    tuition: 29_000,
    grants: 'lic.jd',
    follows: [
      'major.polisci',
      'major.criminology',
      'major.business',
      'major.communications',
      'major.economics',
    ],
    minAge: 21,
  },
  {
    id: 'grad.msw',
    name: 'Social work',
    blurb: 'The license that makes it clinical.',
    opens: ['care', 'public'],
    difficulty: 0.55,
    kind: 'graduate',
    field: 'law-public',
    years: 2,
    tuition: 15_000,
    grants: 'lic.lcsw',
    follows: ['major.socialwork', 'major.psychology'],
    minAge: 21,
  },
  {
    id: 'grad.mpa',
    name: 'Public administration',
    blurb: 'The people who run the building.',
    opens: ['public', 'office'],
    difficulty: 0.5,
    kind: 'graduate',
    field: 'law-public',
    years: 2,
    tuition: 15_000,
    follows: ['major.publicadmin', 'major.polisci', 'major.economics'],
    minAge: 21,
  },
  {
    id: 'grad.march',
    name: 'Architecture',
    blurb: 'Registration takes longer than the degree.',
    opens: ['architecture'],
    difficulty: 0.74,
    kind: 'graduate',
    field: 'technical',
    years: 3,
    tuition: 23_000,
    grants: 'lic.architect',
    follows: ['major.prearch', 'major.civileng'],
    minAge: 21,
  },
  {
    id: 'grad.mseng',
    name: 'Engineering master’s',
    blurb: 'The specialism that pays for itself.',
    opens: ['tech', 'trades'],
    difficulty: 0.78,
    kind: 'graduate',
    field: 'technical',
    years: 2,
    tuition: 21_000,
    follows: [
      'major.engineering',
      'major.electricaleng',
      'major.civileng',
      'major.compsci',
      'major.math',
    ],
    minAge: 21,
  },
  {
    id: 'grad.mba',
    name: 'MBA',
    blurb: 'Two years, and a different phone book.',
    opens: ['office', 'sales', 'finance', 'logistics'],
    difficulty: 0.55,
    kind: 'graduate',
    field: 'business',
    years: 2,
    tuition: 25_000,
    minAge: 21,
  },
  {
    id: 'grad.macc',
    name: 'Accounting & CPA',
    blurb: 'One year, then the exam nobody enjoys.',
    opens: ['finance'],
    difficulty: 0.65,
    kind: 'graduate',
    field: 'business',
    years: 1,
    tuition: 18_000,
    grants: 'lic.cpa',
    follows: ['major.accounting', 'major.finance', 'major.economics', 'major.math'],
    minAge: 21,
  },
  {
    id: 'grad.med',
    name: 'Master of education',
    blurb: 'What gets you the principal’s office.',
    opens: ['education'],
    difficulty: 0.45,
    kind: 'graduate',
    field: 'education',
    years: 2,
    tuition: 12_000,
    follows: ['major.education', 'major.psychology'],
    minAge: 21,
  },
  {
    id: 'grad.mfa',
    name: 'Fine arts MFA',
    blurb: 'Two years to find out if you meant it.',
    opens: ['creative'],
    difficulty: 0.5,
    kind: 'graduate',
    field: 'creative',
    years: 2,
    tuition: 14_000,
    follows: ['major.arts', 'major.communications'],
    minAge: 21,
  },
];

export const findMajor = (id: string): Major | undefined => MAJORS.find((major) => major.id === id);

/** Every program in one tier, in catalogue order. */
export const programsOfKind = (kind: ProgramKind): readonly Major[] =>
  MAJORS.filter((major) => major.kind === kind);

/**
 * What this character could enrol in today.
 *
 * SPEC 1336 LIVES HERE. Fifty rows is an inventory that wants a search box; the
 * spec forbids one and asks for "contextual gating" instead, so the screen never
 * asks the player to scroll past medical school at sixteen or past a bachelor's
 * they already hold. Gating is done ONCE, here, rather than in the screen —
 * CORE_RULES 13.15, a gate guards what it hands back as well as what it lets
 * through, and `cannotEnrol` is the second enforcement point.
 *
 * A DEGREE DOES NOT CLOSE THE TRADE SCHOOL DOOR. Somebody with a fine-arts
 * bachelor's who wants to be an electrician at thirty-one is a real person and
 * spec 119 keeps reinvention open, so vocational programs stay available at
 * every level above a diploma. What closes a row is holding its license already.
 */
export function programsOpenTo(
  credentials: Credentials | undefined,
  age: number,
): readonly Major[] {
  const held = levelOf(credentials);
  // No diploma, no program. The way back is finishing high school.
  if (held === 'none') return [];
  return MAJORS.filter((program) => {
    if (age < program.minAge) return false;
    if (program.grants && holdsLicense(credentials, program.grants)) return false;
    if (program.kind === 'vocational') return true;
    if (program.kind === 'undergraduate') return held === 'highSchool';
    return held === 'university' || held === 'postgraduate';
  });
}

export interface ProgramSection {
  readonly field: ProgramField;
  readonly label: string;
  readonly programs: readonly Major[];
}

/**
 * The same list, grouped into the headings the screen renders.
 *
 * Empty sections are dropped rather than rendered empty: a heading with nothing
 * under it tells the player a door exists and refuses to say where, which is
 * the 0403 lesson about naming things the game cannot hand over.
 */
export function programSections(programs: readonly Major[]): readonly ProgramSection[] {
  return FIELD_ORDER.map((field) => ({
    field,
    label: FIELD_LABELS[field],
    programs: programs.filter((program) => program.field === field),
  })).filter((section) => section.programs.length > 0);
}

/**
 * How much the undergraduate record behind an application is worth to it.
 *
 * Soft, for the reason `follows` gives. Measured as a wall first: making
 * medical school refuse anybody without a science bachelor's meant a character
 * who picked Business at eighteen could never become a doctor no matter what
 * they did afterwards, which is a dead end the spec's reinvention rule exists
 * to prevent. As a modifier it costs them a lot and forbids nothing.
 */
export const PREREQUISITE_BONUS = 0.12;
export const PREREQUISITE_PENALTY = -0.22;

export function prerequisiteFit(program: Major, heldMajorId: string | undefined): number {
  if (!program.follows || program.follows.length === 0) return 0;
  return program.follows.includes(heldMajorId ?? '') ? PREREQUISITE_BONUS : PREREQUISITE_PENALTY;
}

/* -------------------------------------------------------------------------- */
/* Getting in                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Nobody starts a degree before this.
 *
 * Ticket 0406 lowered the FLOOR to seventeen for trade school, which is real —
 * a welding certificate does not wait for your eighteenth birthday — but this
 * constant stays at eighteen because it is what `cannotEnrol` checks before it
 * knows which program is being applied to. The per-program `minAge` is the
 * tighter gate and it is checked second.
 */
export const COLLEGE_AGE = 17;
/** Years a bachelor's takes, when a program does not say otherwise. */
export const COLLEGE_YEARS = 4;
/** Years a graduate program takes on top, when a program does not say. */
export const POSTGRAD_YEARS = 2;

/**
 * What a year of it costs, in whole dollars.
 *
 * Real money, because 0210 gave the game money and 0209 already built a parent
 * who can help with college — a request that meant nothing until now. It is
 * charged per year rather than up front so working through it is a real
 * strategy (spec 1823) rather than a wall at the start.
 *
 * Not a loan. Spec says nothing about student debt and 0307 owns the loan
 * engine; until then a character pays what they can and the shortfall stops
 * them enrolling rather than putting them in the red.
 */
export const TUITION_PER_YEAR = 9_400;
export const POSTGRAD_TUITION_PER_YEAR = 13_200;

/**
 * Whether they get in.
 *
 * NO TEST PERFORMANCE AND NO SCHOOL QUALITY — spec 1822 and section 79 remove
 * both by name, so there is no exam to sit and no ranking to clear. What decides
 * it is the academic record the player has been building since they were six,
 * which is `performance`, and that is the whole point of Study Harder having
 * existed for twelve years by this moment.
 *
 * Generous at the bottom on purpose. Somewhere will take almost anybody, which
 * is true, and which keeps CORE_RULES 13.16 satisfied: a system nobody can get
 * into is not a system.
 */
export const ADMISSION_FLOOR = 0.35;
export const ADMISSION_CEILING = 0.97;

export function admissionChance(performance: number, academics: boolean): number {
  const record = (performance - 45) / 45; // roughly -1 .. 1 across the real range
  const chance = 0.62 + record * 0.3 + (academics ? 0.08 : 0);
  return Math.max(ADMISSION_FLOOR, Math.min(ADMISSION_CEILING, chance));
}

/** Graduate school looks at what you did as an undergraduate, and less kindly. */
export function postgradChance(performance: number, academics: boolean): number {
  const record = (performance - 58) / 42;
  const chance = 0.48 + record * 0.36 + (academics ? 0.1 : 0);
  return Math.max(0.12, Math.min(0.94, chance));
}

/* -------------------------------------------------------------------------- */
/* Getting through it                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Where performance heads while studying this major.
 *
 * The same drift model school uses, with the major's difficulty pulling the
 * target down. A hard subject is genuinely harder to do well in, which is the
 * cost of picking the one that opens the best jobs.
 */
export function collegeTarget(
  smarts: number,
  discipline: number,
  effortBonus: number,
  difficulty: number,
  academics: boolean,
): number {
  const aptitude = (smarts * 1.05 + discipline * 0.45 - 40) / 1;
  return aptitude + effortBonus + (academics ? 8 : 0) - difficulty * 26;
}

/**
 * Failing out.
 *
 * A real outcome, and the reason grades still matter after eighteen — but it
 * takes a sustained collapse rather than one bad year, the same shape as
 * leaving school early. Measured against the population, not against what the
 * word means: see CORE_RULES 13.25.
 */
export const FAILING_OUT = 55;
export const FAIL_OUT_CHANCE = 0.34;
