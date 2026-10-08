import { Text, StyleSheet } from 'react-native';
import { settleYear, runLoanYear, type HeldLoan, type OwnedBusiness } from '@yearafter/finance';
import { type BusinessView } from '@yearafter/simulation';
import { ActionButton, Card, ListRow, SectionHeading } from './index';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`;

/** A repeat of the recorded year, not a prediction of next year's hidden draw. */
export function businessWarning(business: OwnedBusiness, view: BusinessView, loan?: HeldLoan) {
  const last = business.last;
  const cash = Number(business.cash) / 100;
  const profit = last?.profit ?? 0;
  const rescue = last ? settleYear(cash, profit, last.costs).needed : 0;
  const loanPayment = loan
    ? runLoanYear([loan], Number.POSITIVE_INFINITY, false).charges.reduce(
        (sum, charge) => sum - Number(charge.amount) / 100,
        0,
      )
    : (view.loan?.yearly ?? 0);
  const loanGap = Math.max(0, loanPayment - Math.max(0, cash + profit));
  const show =
    (last?.profit ?? 0) < 0 ||
    (last?.injected ?? 0) > 0 ||
    (view.loan?.behind ?? false) ||
    loanGap > 0;
  return { show, rescue, loanGap, loanPayment, hasHistory: last !== undefined };
}

export function BusinessWarning({
  business,
  view,
  personalCash,
  loan,
  onSell,
  onClose,
}: {
  business: OwnedBusiness;
  view: BusinessView;
  personalCash: number;
  loan: HeldLoan | undefined;
  onSell: () => void;
  onClose: () => void;
}) {
  const warning = businessWarning(business, view, loan);
  if (!warning.show) return null;
  return (
    <>
      <SectionHeading>Business cash is under pressure</SectionHeading>
      <Card style={styles.card}>
        {business.last && business.last.profit < 0 ? (
          <ListRow
            title="Last year's loss"
            value={money(-business.last.profit)}
            subtitle="Another year like that would use up more of the business's cash."
            affordance="none"
            wrap
          />
        ) : null}
        {(business.last?.injected ?? 0) > 0 ? (
          <ListRow
            title="You already helped it through"
            value={money(business.last?.injected ?? 0)}
            subtitle="This came from your bank last year to keep the business going."
            affordance="none"
            wrap
          />
        ) : null}
        {warning.rescue > 0 ? (
          <Text style={styles.note}>
            Before loan payments, if last year's trading result repeats, keeping the doors open
            would need about {money(warning.rescue)} from you. That covers the loss and restores
            some working cash.
            {personalCash < warning.rescue
              ? ` You have ${money(Math.max(0, personalCash))} in your bank now, so you couldn't cover that amount.`
              : ` You have ${money(personalCash)} in your bank now.`}
          </Text>
        ) : business.last?.profit !== undefined && business.last.profit < 0 ? (
          <Text style={styles.note}>
            The business's {money(Number(business.cash) / 100)} in cash could cover another trading
            year like last year, before loan payments. It won't last forever if losses continue.
          </Text>
        ) : null}
        {view.loan?.behind ? (
          <Text style={styles.note}>
            The business is behind on its loan. The unpaid balance is growing.
          </Text>
        ) : null}
        {warning.loanGap > 0 && view.loan ? (
          <Text style={styles.note}>
            Its next yearly loan payment is about {money(warning.loanPayment)}.
            {warning.hasHistory
              ? " If last year's trading result repeats,"
              : ' Before any new trading income,'}{' '}
            the business would be about {money(warning.loanGap)} short of that payment. You’ll be
            asked whether to put money in or close the business if its own cash can't make the
            payment.
          </Text>
        ) : null}
        {warning.rescue > 0 && warning.loanGap > 0 ? (
          <Text style={styles.note}>
            The trading rescue and loan gap are separate checks, not a combined bill.
          </Text>
        ) : null}
        <Text style={styles.note}>
          These are estimates, not a forecast. Sales, costs and events can change. If the business
          can't cover a loss or its loan payment, you'll choose whether to put money in or close it.
          Nothing comes from your bank without that choice.
        </Text>
        <Text style={styles.note}>
          Review prices, supplies and staffing below before advancing the year. Changes can help,
          but don't guarantee a profit. You can also review selling or closing the business now. Any
          business loan is paid from the proceeds first; debt left over stays with you.
        </Text>
        <ActionButton label="Review selling" onPress={onSell} />
        <ActionButton label="Review closing" onPress={onClose} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm },
  note: { fontSize: typography.sizes.body, color: colors.inkMuted },
});
