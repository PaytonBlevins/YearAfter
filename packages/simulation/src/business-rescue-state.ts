import type { GameState } from './game-state';

/** Remove answered or externally sold cases without disturbing another decision. */
export function pruneBusinessRescue(state: GameState): GameState {
  if (!state.businessRescue) return state;
  const cases = state.businessRescue.cases.filter((row) =>
    state.businesses.some((business) => business.id === row.businessId),
  );
  if (cases.length > 0)
    return {
      ...state,
      businessRescue: { ...state.businessRescue, cases },
      pending: state.pending.map((decision) =>
        decision.eventId === 'business.rescue'
          ? {
              ...decision,
              choices: decision.choices.filter((choice) =>
                cases.some(
                  (row) =>
                    choice.id === `inject:${row.businessId}` ||
                    choice.id === `close:${row.businessId}`,
                ),
              ),
            }
          : decision,
      ),
    };
  const { businessRescue: _review, ...bare } = state;
  return {
    ...bare,
    pending: state.pending.filter((decision) => decision.eventId !== 'business.rescue'),
  };
}
