/** Classes share one affordability budget, rather than each spending the same cash. */
import { LESSONS_COST, MUSIC_LESSONS_COST, findMartialArt } from '@yearafter/content';
import { SUBSISTENCE } from '@yearafter/finance';
import type { GameState } from './game-state';

export function canContinueClass(state: GameState, id: string, standard: number): boolean {
  let available = Math.max(
    Number(state.finance.balance) / 100,
    Math.max(0, standard - SUBSISTENCE),
  );
  const classes = [
    ...(state.sports.arts ?? []).map((study) => ({
      id: study.artId,
      fee: findMartialArt(study.artId)?.annualCost ?? 0,
    })),
    ...(state.acting.lessons ? [{ id: 'acting-lessons', fee: LESSONS_COST }] : []),
    ...(state.music.lessons ? [{ id: 'music-lessons', fee: MUSIC_LESSONS_COST }] : []),
  ];
  for (const study of classes) {
    const affordable = available >= study.fee;
    if (study.id === id) return affordable;
    if (affordable) available -= study.fee;
  }
  return false;
}
