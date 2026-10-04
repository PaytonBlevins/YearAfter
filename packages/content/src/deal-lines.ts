/**
 * Ticket 0605 — the words a private deal says on the timeline.
 *
 * ONE FILE, so the wording can be improved without touching the engine. The
 * engine decides WHAT happened (a `DealNote`); this decides how it reads. Each
 * note has several lines so a long life doesn't repeat itself (CORE_RULES
 * 13.17); one is picked by a stable key. Tokens: {name}, {put}, {back},
 * {gain}, {years}. Spoken-style contractions, American spelling.
 */

export type DealNote =
  | 'placed'
  | 'interest'
  | 'shaky'
  | 'repaid'
  | 'settledUp'
  | 'settledDown'
  | 'lost'
  | 'defaulted'
  | 'soldOn';

export const DEAL_LINES: Readonly<Record<DealNote, readonly string[]>> = {
  placed: [
    'You put {put} into {name}. It will be {years} years before you see it again.',
    'You wrote a cheque for {put} for {name}. The money is tied up for {years} years.',
  ],
  interest: ['{name} began paying you interest.', 'The first interest came in from {name}.'],
  shaky: ['Word is {name} is having a hard time.', 'You heard {name} is struggling to keep up.'],
  repaid: ['{name} paid you back in full: {back}.', 'You got your {put} back from {name}.'],
  settledUp: [
    '{name} paid out. {back} came back on {put}.',
    'It worked out: {name} returned {back} for the {put} you put in.',
  ],
  settledDown: [
    '{name} ended badly, but you got some back: {back} of the {put}.',
    'You recovered {back} of your {put} from {name}.',
  ],
  lost: ['{name} went under. The {put} is gone.', 'You lost all {put} you put into {name}.'],
  defaulted: [
    '{name} stopped paying. You got {back} back on {put}.',
    'The borrower behind {name} defaulted. Only {back} of the {put} came back.',
  ],
  soldOn: [
    'You sold your share of {name} to another investor for {back}.',
    'You got out of {name} early and took {back}.',
  ],
};

/** Fill the tokens in a line. */
export function dealLine(
  note: DealNote,
  key: string,
  tokens: Readonly<Record<string, string>>,
  pick: (lines: readonly string[], key: string) => string,
): string {
  const text = pick(DEAL_LINES[note], key);
  return text.replace(/\{(\w+)\}/g, (_, token: string) => tokens[token] ?? '');
}
