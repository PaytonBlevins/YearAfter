import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { recapOf } from '../screens/entertainmentView';
import { graduationOutcome } from './GraduationNotice';
import { OutcomeCard, type Outcome } from './OutcomeCard';

/**
 * Ticket 0809 — what the year did in sports, acting, music, modeling, awards and a racing team.
 *
 * The engines already write these as lines in the Life feed, and a feed is the right place to
 * read them over a life. This is the short version for the moment the year turns, so a season
 * that ended in a title (or a release that did nothing) is not something the player has to scroll
 * to find. It appears only when one of those fields wrote a line, never twice for one turn, and
 * waits behind a pending question, an answer, a breakdown and a graduation.
 */
export function recapOutcome(before: GameState, after: GameState): Outcome | undefined {
  const groups = recapOf(before, after);
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

export function YearRecapNotice() {
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
    // A graduation is read first, and it is the one overlay a turn can already have.
    if (graduationOutcome(before, state)) return;
    const recap = recapOutcome(before, state);
    if (recap) setNotice(recap);
  }, [state]);
  if (!state || !state.player.alive || decision || outcome || detail || !notice) return null;
  return <OutcomeCard outcome={notice} onDismiss={() => setNotice(undefined)} />;
}
