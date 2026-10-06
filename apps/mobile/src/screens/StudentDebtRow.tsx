import { findLoanProduct, totalBorrowed } from '@yearafter/finance';
import { ListRow } from '../components';
import { useNavigation } from '../navigation/navigation';
import { useGame } from '../stores/gameStore';

/** Shown in Career's studying card, including when no tuition loan was needed. */
export function StudentDebtRow() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  const borrowed = Number(
    totalBorrowed(state.loans.filter((loan) => findLoanProduct(loan.productId)?.needsStudying)),
  );
  return (
    <ListRow
      title="Student loan"
      value={`$${Math.round(borrowed / 100).toLocaleString('en-US')}`}
      subtitle={
        borrowed > 0 ? 'Interest adds to it while you study' : 'Nothing borrowed for tuition'
      }
      onPress={() => push({ screen: 'debt', title: 'Debt' })}
      wrap
    />
  );
}
