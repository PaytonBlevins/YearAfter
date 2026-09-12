/**
 * Ticket 0307 — what you owe, and what anybody would lend you.
 *
 * Spec 1857's five loan types, of which two can exist today. The other three
 * need something that is not built — collateral (v0.05), a business (v0.06), a
 * portfolio (0308) — and are named at the bottom rather than left out, so the
 * screen is also the map of what is coming.
 *
 * THE AMOUNT IS THE DECISION, which is why borrowing opens a sheet rather than
 * a button. A character who needs $7,400 of tuition and is offered $37,600
 * should not be handed $37,600 by default; the offer is a ceiling and the
 * player picks. That is the one thing this screen does that the cards screen
 * does not, and it is the difference between an instalment loan and a card.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  CREDIT_LABELS,
  LOAN_TYPES_NOT_YET_BUILT,
  findLoanProduct,
  yearlyPaymentFor,
  type LoanProduct,
} from '@yearafter/finance';
import { loanOffers } from '@yearafter/simulation';
import { ActionButton, Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

export function LoansScreen() {
  const { state, borrow, payLoanOff } = useGame();
  const [choosing, setChoosing] = useState<string | undefined>(undefined);
  const [choosingPay, setChoosingPay] = useState<string | undefined>(undefined);
  if (!state) return null;

  const offers = loanOffers(state);
  const held = state.loans;
  const cash = Math.round(Number(state.player.cash) / 100);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {held.length > 0 ? (
        <>
          <SectionHeading>What you owe</SectionHeading>
          <Card>
            {held.map((loan, index) => {
              const product = findLoanProduct(loan.productId);
              if (!product) return null;
              const owed = Math.round(Number(loan.balance) / 100);
              const yearly = yearlyPaymentFor(product, owed, loan.termLeft);
              // Never more than is owed, never more than is held.
              const payable = Math.min(cash, owed);
              return (
                <Fragment key={loan.productId}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    icon="money"
                    title={product.name}
                    subtitle={
                      loan.inArrears
                        ? 'Behind on it'
                        : product.termYears > 0
                          ? `${money(yearly)} a year, ${loan.termLeft} to go`
                          : `${money(yearly)} a year while it runs`
                    }
                    value={money(owed)}
                    meta={`${Math.round(product.apr * 1000) / 10}% · ${product.lender}`}
                    affordance="none"
                    wrap
                  />
                  {/*
                    THE AMOUNT IS THE DECISION ON THE WAY OUT TOO.

                    This row first said "Pay some off / Out of what you have"
                    and then spent every cent the character had. Driving it for
                    real caught it: a nineteen-year-old with $3,900 who taps a
                    row labelled "some" ends the turn at $0 — which is exactly
                    the state this whole ticket measured as the reason student
                    loans have to exist. A button whose label says "some" and
                    whose behaviour says "all" is the same defect as a row that
                    offers what the sheet then refuses.

                    So paying gets the three amounts borrowing already has,
                    bounded by the smaller of the cash and the balance. The
                    decision is symmetric because it is the same decision.
                  */}
                  {payable > 0 ? (
                    choosingPay === loan.productId ? (
                      <>
                        <ActionButton
                          label={`Put in ${money(Math.round(payable / 4))}`}
                          onPress={() => {
                            payLoanOff(loan.productId, Math.round(payable / 4));
                            setChoosingPay(undefined);
                          }}
                        />
                        <ActionButton
                          label={`Put in ${money(Math.round(payable / 2))}`}
                          onPress={() => {
                            payLoanOff(loan.productId, Math.round(payable / 2));
                            setChoosingPay(undefined);
                          }}
                        />
                        <ActionButton
                          label={
                            payable >= owed
                              ? `Clear the whole ${money(owed)}`
                              : `Put in all ${money(payable)}`
                          }
                          onPress={() => {
                            payLoanOff(loan.productId, payable);
                            setChoosingPay(undefined);
                          }}
                        />
                      </>
                    ) : (
                      <ListRow
                        title="Pay some off"
                        subtitle={`You have ${money(cash)} to put at it`}
                        affordance="action"
                        compact
                        onPress={() => setChoosingPay(loan.productId)}
                      />
                    )
                  ) : (
                    <ListRow
                      title="Pay some off"
                      subtitle="Nothing spare to put at it"
                      affordance="none"
                      compact
                      disabled
                    />
                  )}
                </Fragment>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeading>{held.length > 0 ? 'Borrow more' : 'What you could borrow'}</SectionHeading>
      <Card>
        {offers.map(({ product, decision }, index) => {
          const ceiling = Math.round(Number(decision.offered) / 100);
          return (
            <Fragment key={product.id}>
              {index > 0 ? <RowDivider /> : null}
              <ListRow
                title={product.name}
                subtitle={decision.approved ? product.blurb : whyNot(decision.because, product)}
                value={decision.approved ? `up to ${money(ceiling)}` : 'No'}
                meta={`${product.lender} · ${Math.round(product.apr * 1000) / 10}%${
                  product.termYears > 0 ? ` · ${product.termYears} years` : ' · revolving'
                }`}
                affordance={decision.approved ? 'action' : 'none'}
                disabled={!decision.approved}
                onPress={
                  decision.approved
                    ? () => setChoosing(choosing === product.id ? undefined : product.id)
                    : undefined
                }
                wrap
              />
              {/*
                How much, rather than all of it. Three amounts instead of a
                slider: a slider is a fiddly control on a phone and the
                interesting choices are coarse — a bit, half, or the lot.
              */}
              {choosing === product.id && decision.approved ? (
                <>
                  <ActionButton
                    label={`Take ${money(Math.round(ceiling / 4))}`}
                    onPress={() => {
                      borrow(product.id, Math.round(ceiling / 4));
                      setChoosing(undefined);
                    }}
                  />
                  <ActionButton
                    label={`Take ${money(Math.round(ceiling / 2))}`}
                    onPress={() => {
                      borrow(product.id, Math.round(ceiling / 2));
                      setChoosing(undefined);
                    }}
                  />
                  <ActionButton
                    label={`Take the full ${money(ceiling)}`}
                    onPress={() => {
                      borrow(product.id, ceiling);
                      setChoosing(undefined);
                    }}
                  />
                </>
              ) : null}
            </Fragment>
          );
        })}
      </Card>

      <SectionHeading>Not built yet</SectionHeading>
      <Card>
        {LOAN_TYPES_NOT_YET_BUILT.map((row, index) => (
          <Fragment key={row.type}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              title={labelFor(row.type)}
              subtitle={`Needs ${row.needs}`}
              affordance="none"
              disabled
            />
          </Fragment>
        ))}
      </Card>

      <Text style={styles.note}>
        The yearly payment comes out with the rent. Paying more than that is up to you.
      </Text>
    </ScrollView>
  );
}

const labelFor = (type: string): string =>
  type === 'secured' ? 'Secured loans' : type === 'business' ? 'Business loans' : 'Private lending';

/**
 * THE REASON IS THE SAME ON EVERY ROW; THE BAR IS NOT.
 *
 * Read at nineteen, this column said "Your credit is not there yet" five times
 * running — the fourth screen in four tickets to print one sentence down a
 * column and call it information (CORE_RULES 13.26). Counting it across a
 * population made it worse rather than better: 84% of screens showing two or
 * more refusals showed the IDENTICAL reason on all of them, every time.
 *
 * Reordering the gates alone would not have fixed that. It would have printed
 * "You do not earn enough" five times instead. What is actually different from
 * row to row is the NUMBER — $18,000, then $38,000, then $45,000, then
 * $140,000 — and a player who can see the number can see the ladder and where
 * they are on it. So the refusal carries its own threshold, and the column
 * stops being a wall and starts being a route.
 */
function whyNot(because: string | undefined, product: LoanProduct): string {
  switch (because) {
    case 'tooYoung':
      return 'You are too young';
    case 'tooManyLoans':
      return 'You have four running already';
    case 'alreadyHeld':
      return 'You have this one';
    case 'standing':
      return `Wants ${CREDIT_LABELS[product.needs].toLowerCase()} credit`;
    case 'income':
      return `Wants ${money(product.needsIncome)} a year coming in`;
    case 'notStudying':
      return 'For students only';
    case 'tooMuchOwed':
      return 'You owe as much as they think you can carry';
    case 'fullyDrawn':
      return 'You have borrowed what the degree costs';
    default:
      return 'Not available to you';
  }
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  note: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
