/**
 * Ticket 0307 — what you owe, and what anybody would lend you.
 *
 * Spec 1857's five loan types, of which three can exist as of Ticket 0308. The
 * other two need something that is not built — collateral (v0.05) and a
 * business (v0.06) — and are named at the bottom rather than left out, so the
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
                <Fragment key={`${loan.productId}:${loan.businessId ?? ''}`}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    icon="money"
                    title={product.name}
                    subtitle={
                      loan.inArrears
                        ? "You're behind on payments"
                        : loan.businessId
                          ? `${state.businesses.find((row) => row.id === loan.businessId)?.name ?? 'A business you no longer run'} · ${money(yearly)} a year, ${loan.termLeft} years left`
                          : product.termYears > 0
                            ? `${money(yearly)} a year, ${loan.termLeft} years left`
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
                    choosingPay === `${loan.productId}:${loan.businessId ?? ''}` ? (
                      <>
                        <ActionButton
                          label={`Put in ${money(Math.round(payable / 4))}`}
                          onPress={() => {
                            payLoanOff(loan.productId, Math.round(payable / 4), loan.businessId);
                            setChoosingPay(undefined);
                          }}
                        />
                        <ActionButton
                          label={`Put in ${money(Math.round(payable / 2))}`}
                          onPress={() => {
                            payLoanOff(loan.productId, Math.round(payable / 2), loan.businessId);
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
                            payLoanOff(loan.productId, payable, loan.businessId);
                            setChoosingPay(undefined);
                          }}
                        />
                      </>
                    ) : (
                      <ListRow
                        title="Pay some off"
                        subtitle={`You have ${money(cash)} available for a payment`}
                        affordance="action"
                        compact
                        onPress={() => setChoosingPay(`${loan.productId}:${loan.businessId ?? ''}`)}
                      />
                    )
                  ) : (
                    <ListRow
                      title="Pay some off"
                      subtitle="You don't have any cash for an extra payment"
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

      {LOAN_TYPES_NOT_YET_BUILT.length > 0 ? (
        <>
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
        </>
      ) : null}

      <Text style={styles.note}>
        Business loans are offered when you open, expand or buy a business. The business pays them
        back from its own money.
      </Text>

      <Text style={styles.note}>
        Your scheduled payment comes out automatically each year. You can choose to pay extra.
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
      return "You can borrow once you're eighteen";
    case 'tooManyLoans':
      return 'You already have four active loans';
    case 'alreadyHeld':
      return 'You already have this loan';
    case 'standing':
      return `Requires ${CREDIT_LABELS[product.needs].toLowerCase()} credit`;
    case 'income':
      return `Requires at least ${money(product.needsIncome)} in yearly income`;
    case 'notStudying':
      return 'This loan is for education costs';
    case 'tooMuchOwed':
      return "Your existing debt is already at the lender's limit";
    case 'fullyDrawn':
      return "You've already borrowed the full amount available for your tuition";
    case 'noCollateral':
      return 'You need investments to use as security for this loan';
    default:
      return "You can't get this loan right now";
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
