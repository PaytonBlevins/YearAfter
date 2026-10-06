import { useEffect, useRef, useState } from 'react';
import { findMajor, findLicense, isAtCollege } from '@yearafter/education';
import { TRACK_LABELS } from '@yearafter/careers';
import { findLoanProduct, totalBorrowed } from '@yearafter/finance';
import type { GameState } from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { OutcomeCard, type Outcome } from './OutcomeCard';

/** Compare saved qualifications, never parse timeline wording or the stage alone. */
export function graduationOutcome(before: GameState, after: GameState): Outcome | undefined {
  if (
    before.player.id !== after.player.id ||
    !after.player.alive ||
    after.world.year !== before.world.year + 1 ||
    after.player.age !== before.player.age + 1
  )
    return undefined;
  const had = before.education.credentials ?? {};
  const has = after.education.credentials ?? {};
  if (after.education.stage !== 'graduated') return undefined;
  const school =
    before.education.stage === 'high' &&
    had.highSchool === undefined &&
    has.highSchool === after.player.age;
  const program = before.education.majorId ? findMajor(before.education.majorId) : undefined;
  const degree =
    isAtCollege(before.education) &&
    ((has.university === after.player.age && has.university !== had.university) ||
      (has.postgraduate === after.player.age && has.postgraduate !== had.postgraduate) ||
      (program?.grants !== undefined &&
        has.licenses?.includes(program.grants) &&
        !had.licenses?.includes(program.grants)));
  if (!school && !degree) return undefined;
  const tracks =
    program?.opens
      .map((track) => Object.entries(TRACK_LABELS).find(([id]) => id === track)?.[1])
      .filter(Boolean) ?? [];
  const license = program?.grants ? findLicense(program.grants)?.name : undefined;
  const earned = license
    ? program?.kind === 'vocational'
      ? license
      : `your degree and ${license}`
    : 'your degree';
  const qualification = school
    ? 'You earned your high-school diploma.'
    : `You finished ${program?.name ?? 'your program'} and earned ${earned}.`;
  const opens = school
    ? 'You can apply for further study and jobs that need a diploma.'
    : tracks.length > 0
      ? `It can help you qualify for work in ${tracks.join(', ')}. Other job requirements still apply.`
      : 'You can look at jobs or further study. A job still depends on its other requirements.';
  const debt = Number(
    totalBorrowed(after.loans.filter((loan) => findLoanProduct(loan.productId)?.needsStudying)),
  );
  const loan =
    debt > 0
      ? `You still owe $${Math.round(debt / 100).toLocaleString('en-US')} on your student loan.`
      : 'No student loan left to repay.';
  return {
    title: school ? 'You graduated' : 'Program completed',
    body: `${qualification} ${opens} ${loan}`,
    tone: 'good',
  };
}

/** Keep this milestone behind pending decisions and other overlays, without replacing them. */
export function GraduationNotice() {
  const { state, decision, outcome, detail } = useGame();
  const previous = useRef<GameState | undefined>(state);
  const [notice, setNotice] = useState<Outcome | undefined>();
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (!state || !before || state.player.id !== before.player.id || !state.player.alive) {
      setNotice(undefined);
      return;
    }
    const earned = graduationOutcome(before, state);
    if (earned) setNotice(earned);
  }, [state]);
  if (!state || !state.player.alive || decision || outcome || detail || !notice) return null;
  return <OutcomeCard outcome={notice} onDismiss={() => setNotice(undefined)} />;
}
