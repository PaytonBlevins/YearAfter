import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  findLoanProduct,
  mortgagesOwed,
  totalBorrowed,
  totalOwed,
  vehicleLoansOwed,
} from '@yearafter/finance';
import { estateOf } from '@yearafter/simulation';
import { Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useNavigation } from '../navigation/navigation';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount / 100).toLocaleString('en-US')}`;

/** A11: gather existing balances; repayment stays on each debt's own screen. */
export function DebtScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  const loans = totalBorrowed(state.loans);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeading>What you owe</SectionHeading>
      <Card>
        <ListRow
          title="Total debt"
          value={money(Number(estateOf(state).liabilities))}
          subtitle="The debt counted in your net worth"
          affordance="none"
          wrap
        />
      </Card>
      <Text style={styles.note}>
        These are your balances now, including business borrowing. Future interest isn't included.
        Open a category to see its details and payment options.
      </Text>
      <Card>
        <ListRow
          title="Cards"
          value={money(Number(totalOwed(state.cards)))}
          onPress={() => push({ screen: 'cards', title: 'Cards' })}
        />
        <RowDivider />
        <ListRow
          title="Loans"
          value={money(Number(loans))}
          subtitle="Student, personal and business borrowing"
          onPress={() => push({ screen: 'loans', title: 'Loans' })}
          wrap
        />
        <RowDivider />
        <ListRow
          title="Mortgages"
          value={money(Number(mortgagesOwed(state.homes)))}
          onPress={() => push({ screen: 'homes', title: 'Homes' })}
        />
        <RowDivider />
        <ListRow
          title="Car loans"
          value={money(Number(vehicleLoansOwed(state.vehicles)))}
          onPress={() => push({ screen: 'vehicles', title: 'Vehicles' })}
        />
      </Card>
      {state.loans.length > 0 ? (
        <>
          <SectionHeading>Your loans</SectionHeading>
          <Card>
            {state.loans.map((loan, index) => {
              const product = findLoanProduct(loan.productId);
              const business = loan.businessId
                ? state.businesses.find((held) => held.id === loan.businessId)?.name
                : undefined;
              return (
                <Fragment key={`${loan.productId}:${loan.businessId ?? ''}`}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    title={product?.name ?? 'Loan'}
                    value={money(Number(loan.balance))}
                    subtitle={loan.inArrears ? 'Behind on payments' : business}
                    onPress={() => push({ screen: 'loans', title: 'Loans' })}
                    wrap
                  />
                </Fragment>
              );
            })}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.background },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
    marginVertical: spacing.md,
  },
});
