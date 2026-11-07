import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { recapOf } from '../screens/entertainmentView';
import { dischargeOutcome } from '../screens/militaryView';
import { graduationOutcome } from './GraduationNotice';
import { OutcomeCard, type Outcome } from './OutcomeCard';

/**
 * Ticket 0809 — what the year did in sports, acting, music, modeling, awards and a racing team.
 * Ticket 0906 adds a year in uniform, a year in an agency and what a veteran is paid, and a
 * discharge card for a service that has just ended, which is read first.
 *
 * The engines already write these as lines in the Life feed, and a feed is the right place to
 * read them over a life. This is the short version for the moment the year turns, so a season
 * that ended in a title (or a release that did nothing) is not something the player has to scroll
 * to find. It appears only when one of those fields wrote a line, never twice for one turn, and
 * waits behind a pending question, an answer, a breakdown and a graduation.
 */
export function recapOutcome(before: GameState, after: GameState): Outcome | undefined {
  // A service that ended has its own card, which says what the year's lines would say again.
  const discharged = dischargeOutcome(before, after) !== undefined;
  const groups = recapOf(before, after).filter(
    (group) => !(discharged && group.field === 'Your service'),
  );
  if (groups.length === 0) return undefined;
  return {
    title: groups.length === 1 ? groups[0]!.field : 'The year in your work',
    body: groups
      .map((group) =>
        groups.length === 1 ? group.lines.join(' ') : `${group.field}: ${group.lines.join(' ')}`,
      )
      .join('\n\n'),
    tone: 'neutral',
  };
}

/** The cards one change leaves to read, in the order they are read: a discharge, then the year. */
export function noticesOf(before: GameState, after: GameState): readonly Outcome[] {
  return [dischargeOutcome(before, after), recapOutcome(before, after)].filter(
    (card): card is Outcome => card !== undefined,
  );
}

export function YearRecapNotice() {
  const { state, decision, outcome, detail } = useGame();
  const previous = useRef<GameState | undefined>(state);
  const [notices, setNotices] = useState<readonly Outcome[]>([]);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (!state || !before || state.player.id !== before.player.id || !state.player.alive) {
      setNotices([]);
      return;
    }
    // A graduation is read first, and it is the one overlay a turn can already have.
    if (graduationOutcome(before, state)) return;
    const cards = noticesOf(before, state);
    if (cards.length > 0) setNotices(cards);
  }, [state]);
  const notice = notices[0];
  if (!state || !state.player.alive || decision || outcome || detail || !notice) return null;
  return <OutcomeCard outcome={notice} onDismiss={() => setNotices((rest) => rest.slice(1))} />;
}
