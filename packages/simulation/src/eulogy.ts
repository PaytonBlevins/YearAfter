/**
 * Ticket 0212 — what a life adds up to.
 *
 * Spec 818–827 lists exactly what the death screen shows, and the list is worth
 * quoting because two of its instructions are prohibitions:
 *
 *   "Show name, age, cause of death, occupation/notable identity, concise life
 *   summary, family survived by, and 3–5 major highlights maximum. Do not
 *   prominently display net worth or a generic prestige score."
 *
 * So this assembles seven things and deliberately computes no eighth. There is
 * no score. There is no ranking. A life is not graded here, and the reason is
 * in the spec's own framing: death should "conclude the life story without
 * forcing estate-administration chores", and a number out of a hundred at the
 * end turns eighty years of play into a high-score attempt.
 *
 * WHERE THE HIGHLIGHTS COME FROM
 *
 * `character.records`, which Ticket 0212 also made real — it had been declared
 * in Sprint Zero for this exact purpose and written by nothing for eleven
 * tickets (CORE_RULES 13.36). Not from the timeline, and not by matching words
 * in it: a highlight is picked on a record's CATEGORY, so 0211b rewriting a
 * hundred and eighty sentences could not have broken this, and the next rewrite
 * will not either.
 *
 * RECORDS ARE HISTORY. HIGHLIGHTS ARE A SELECTION.
 *
 * The two are not the same list and that distinction is the most important
 * decision in this file. Losing a parent is a real part of a life's structured
 * history and belongs in `records`. It is not a highlight of what somebody DID.
 *
 * Measured, which is how this was found: a player who only presses Advance
 * finishes with a median of three records — a graduation and two funerals. A
 * screen that printed the raw list would summarise every quiet life as an
 * obituary of other people. So highlights rank by what kind of thing happened,
 * losses last, and the cap is the spec's five.
 */

import type { LifeRecord, LifeRecordCategory } from '@yearafter/character';
import { findJob } from '@yearafter/careers';
import { describeCity } from '@yearafter/content';

import {
  children,
  livingChildren,
  livingParents,
  siblings,
  type FamilyMember,
} from '@yearafter/relationships';
import { partnerOf } from '@yearafter/social';
import { occupationFor } from './phases/education';
import type { GameState } from './game-state';

/** Spec 1284: "3–5 major highlights maximum". */
export const MAX_HIGHLIGHTS = 5;

/**
 * What a highlight is worth, by kind.
 *
 * Things the character DID come first, in roughly the order a person would
 * mention them. Losses come last — not because they matter less, but because a
 * highlights reel is about a life rather than about the people who left it, and
 * a passive character's raw record list is two funerals and a graduation.
 */
const PRIORITY: Readonly<Record<LifeRecordCategory, number>> = {
  career: 8,
  education: 7,
  championship: 7,
  business: 6,
  creator: 6,
  political: 6,
  military: 6,
  award: 6,
  property: 4,
  collection: 3,
  criminal: 3,
  health: 2,
  family: 5,
};

/** A loss is family-category, but it is not a thing you did. */
const isLoss = (record: LifeRecord): boolean => record.label.startsWith('Lost ');

export interface Survivor {
  readonly id: string;
  readonly name: string;
  /** 'your wife', 'your son', 'your sister' — how the screen names them. */
  readonly relation: string;
  readonly age: number;
}

export interface Eulogy {
  readonly name: string;
  readonly age: number;
  readonly cause: string;
  /** What they were, in the header's own words. Never a score. */
  readonly identity: string;
  /** Two or three sentences. Concrete, per writing rule 10. */
  readonly summary: string;
  readonly survivors: readonly Survivor[];
  readonly highlights: readonly LifeRecord[];
  readonly bornYear: number;
  readonly diedYear: number;
}

/**
 * Pick the five.
 *
 * Sorted by priority, then by age, so a reel reads forwards through the life
 * rather than by importance — a list that opens with a promotion at fifty and
 * then mentions leaving school reads like a CV, not a life.
 */
export function highlightsOf(records: readonly LifeRecord[]): readonly LifeRecord[] {
  const ranked = [...records].sort((left, right) => {
    const leftScore = (PRIORITY[left.category] ?? 0) - (isLoss(left) ? 6 : 0);
    const rightScore = (PRIORITY[right.category] ?? 0) - (isLoss(right) ? 6 : 0);
    if (leftScore !== rightScore) return rightScore - leftScore;
    return left.age - right.age;
  });
  return ranked.slice(0, MAX_HIGHLIGHTS).sort((left, right) => left.age - right.age);
}

const CHILD_WORD = (member: FamilyMember): string => (member.sex === 'male' ? 'son' : 'daughter');
const SIBLING_WORD = (member: FamilyMember): string =>
  member.sex === 'male' ? 'brother' : 'sister';

/**
 * Who is left.
 *
 * Ordered the way a notice is written: partner, then children, then parents,
 * then siblings. Everybody here is alive AS OF the year the character died,
 * which is a sentence that was not possible to write before this ticket — until
 * 0212 nothing in the game had ever killed an NPC, and "survived by" would have
 * listed a hundred-and-five-year-old mother (CORE_RULES 13.36).
 */
export function survivorsOf(state: GameState): readonly Survivor[] {
  const year = state.world.year;
  const survivors: Survivor[] = [];

  const partner = partnerOf(state.circle.people);
  if (partner && partner.alive && partner.endedAtAge === undefined) {
    survivors.push({
      id: partner.id,
      name: partner.firstName,
      /*
        Their sex, not a slash. "Mei — your husband or wife · 67" was what the
        first version printed, and a notice that cannot commit to which one
        somebody was is a notice nobody would write. The circle knows.
      */
      relation:
        partner.romance?.stage === 'married'
          ? partner.sex === 'male'
            ? 'your husband'
            : 'your wife'
          : 'your partner',
      age: year - partner.birthYear,
    });
  }

  for (const child of livingChildren(state.family)) {
    survivors.push({
      id: child.id,
      name: child.firstName,
      relation: `your ${CHILD_WORD(child)}`,
      age: year - child.birthYear,
    });
  }
  for (const parent of livingParents(state.family)) {
    survivors.push({
      id: parent.id,
      name: parent.firstName,
      relation: parent.role === 'mother' ? 'your mother' : 'your father',
      age: year - parent.birthYear,
    });
  }
  for (const sibling of siblings(state.family).filter((member) => member.alive)) {
    survivors.push({
      id: sibling.id,
      name: sibling.firstName,
      relation: `your ${SIBLING_WORD(sibling)}`,
      age: year - sibling.birthYear,
    });
  }
  return survivors;
}

/**
 * What they were.
 *
 * THROUGH `occupationFor`, and that is the whole point of this function.
 *
 * The first version had its own fallback chain — held job, last job, degree,
 * birthplace — and reading the built app caught it in one screenshot: the
 * header said **"75 · Retired"** and the death screen under it said **"From
 * Atlanta, GA"**, about the same man, at the same moment. That is the identical
 * defect 0210 found between the header and the Career screen ("26 · Unemployed"
 * above "Sales associate · 7 years in"), fixed there by routing both through
 * ONE function, and then re-created here by a new screen quietly writing a
 * second derivation. CORE_RULES 13.23: two derivations of the same fact
 * disagree eventually, and "eventually" was the same afternoon.
 *
 * So the header's answer is the answer. What this adds is only what a death
 * screen needs and a header does not: a career that ENDED still names itself,
 * because "Retired" says nothing about a life and "Head chef, retired" says
 * most of it.
 */
function identityOf(state: GameState): string {
  const held = state.employment.job ? findJob(state.employment.job.jobId) : undefined;
  const age = state.health.diedAtAge ?? state.player.age;
  const label = occupationFor(state.education, age, held?.title);
  if (held) return label;
  const last = state.employment.history[state.employment.history.length - 1];
  const previous = last ? findJob(last.jobId) : undefined;
  if (previous) return `${previous.title}, retired`;
  // Nothing to name. A character who never worked gets the header's own word
  // rather than a second opinion — unless that word is the placeholder every
  // school leaver shares, in which case where they were from is more true
  // about them than "Unemployed" is.
  return label === 'Unemployed' ? `From ${describeCity(state.player.birthLocation.cityId)}` : label;
}

/**
 * The summary. Two or three sentences, and every one of them a fact.
 *
 * Writing rule 10 is the whole difficulty here. "A quiet life, well lived" is
 * the single easiest sentence to write on this screen and the exact register
 * 0211b spent a ticket removing: it characterises instead of reporting, and it
 * reads the same for every character who ever reaches it, which makes it
 * decoration (CORE_RULES 13.29). So the summary is assembled from counts the
 * save can prove — years worked, people raised, where they lived — and says
 * nothing at all when it has nothing to say.
 */
function summaryOf(state: GameState, age: number): string {
  const parts: string[] = [];
  const born = describeCity(state.player.birthLocation.cityId);
  parts.push(`Born in ${born} in ${state.player.birthYear}.`);

  const jobs = state.employment.history.length + (state.employment.job ? 1 : 0);
  const worked = state.player.records.filter((record) => record.category === 'career');
  if (jobs > 0) {
    const first = worked.find((record) => record.label.startsWith('First job'));
    const startedAt = first?.age;
    parts.push(
      jobs === 1
        ? `Held one job${startedAt !== undefined ? `, from ${startedAt}` : ''}.`
        : `Worked ${jobs} jobs${startedAt !== undefined ? `, starting at ${startedAt}` : ''}.`,
    );
  }

  const kids = children(state.family).length;
  if (kids > 0) parts.push(kids === 1 ? 'Raised one child.' : `Raised ${kids} children.`);

  const partner = partnerOf(state.circle.people);
  const marriages = state.player.records.filter((record) =>
    record.label.startsWith('Married'),
  ).length;
  if (marriages === 1 && partner) parts.push(`Married ${partner.firstName}.`);
  else if (marriages > 1) parts.push(`Married ${marriages} times.`);

  /*
    The fallback, for a life with no job, no children and no marriage — which is
    a real and common ending, not an edge case. The first version read "Knew 30
    people well enough to be remembered by them", which is writing rule 10 in
    the one place on the screen where it is hardest to resist: it characterises
    the life instead of reporting it, and it read the same for every quiet
    character who ever reached it, which makes it decoration (13.29).
  */
  const known = state.circle.people.length;
  if (parts.length < 2 && known > 0) parts.push(`Knew ${known} people over the years.`);
  if (parts.length < 2) parts.push(`Lived ${age} years.`);
  return parts.join(' ');
}

export function eulogyFor(state: GameState): Eulogy {
  const age = state.health.diedAtAge ?? state.player.age;
  return {
    name: `${state.player.firstName} ${state.player.lastName}`,
    age,
    cause: state.health.causeOfDeath ?? 'Their health',
    identity: identityOf(state),
    summary: summaryOf(state, age),
    survivors: survivorsOf(state),
    highlights: highlightsOf(state.player.records),
    bornYear: state.player.birthYear,
    diedYear: state.world.year,
  };
}

/**
 * What happens to the body.
 *
 * Spec 818–827: *"End-of-life options may include burial, cremation, donation
 * to science, and culturally appropriate alternatives."*
 *
 * It changes nothing. There is no stat, no cost, no inheritance effect and no
 * consequence for the heir, and that is deliberate rather than unfinished — the
 * same spec sentence that asks for this also says death should "conclude the
 * life story without forcing estate-administration chores", and a burial that
 * moved a number would be the first chore on a screen that exists to end them.
 *
 * It is here because the player should get to decide one last thing, and
 * because it is recorded: the choice is written into the final record, so a
 * dynasty five generations on can say what was done with each of them. That is
 * the whole feature, and it is enough.
 *
 * The fourth option is not a fifth hardcoded rite. "Culturally appropriate
 * alternatives" is a real instruction and this build has forty naming cultures;
 * writing four of them and stopping would be worse than leaving the door open,
 * so the list is a catalog a later ticket can grow per culture.
 */
export interface Rite {
  readonly id: string;
  readonly label: string;
  /** One line, in the player's words, about what they are choosing. */
  readonly blurb: string;
}

export const RITES: readonly Rite[] = [
  { id: 'burial', label: 'Burial', blurb: 'A plot, a stone, somewhere people can go.' },
  { id: 'cremation', label: 'Cremation', blurb: 'Ashes, and somewhere they get scattered.' },
  {
    id: 'science',
    label: 'Donation to science',
    blurb: 'A medical school gets the body. Somebody learns on you.',
  },
  {
    id: 'family',
    label: 'Whatever the family does',
    blurb: 'However it has always been done. Nobody has to decide.',
  },
];

export const findRite = (id: string): Rite | undefined => RITES.find((rite) => rite.id === id);

/** Whether anybody is eligible to be continued as. Ticket 0212's other half. */
export const heirsOf = (state: GameState): readonly FamilyMember[] =>
  livingChildren(state.family);
