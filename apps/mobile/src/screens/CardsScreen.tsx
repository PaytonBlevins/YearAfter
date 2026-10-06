/**
 * Ticket 0306 — the cards you hold, and the ones you could.
 *
 * Spec 28 lists what a card may show: product, issuer, limit, balance,
 * available credit, APR, minimum payment, rewards type, annual fee, status.
 * It also rules out, by name, an opened date and a payment-history timeline —
 * so there is no "since 2034", no list of past payments and no statement.
 *
 * TWO SECTIONS, AND THE SECOND ONE IS THE INTERESTING SCREEN. What you hold is
 * mostly numbers. What you could hold is a decision: eight products, each with
 * a rate, a fee and a limit, and a lender's answer attached to every one —
 * including the ones that say no, and why. A list that hid the refusals would
 * be hiding the whole shape of the ladder (0210b's job-offer lesson: the player
 * wants to see what they are not yet good enough for).
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  CREDIT_FROM_AGE,
  REWARD_LABELS,
  availableOn,
  findProduct,
  minimumOn,
} from '@yearafter/finance';
import { cardOffers } from '@yearafter/simulation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amountInCents: number): string =>
  `$${Math.round(amountInCents / 100).toLocaleString('en-US')}`;

export function CardsScreen() {
  const { state, applyForCard: apply } = useGame();
  if (!state) return null;

  const offers = cardOffers(state);
  const held = state.cards;

  /*
    A child gets ONE sentence, not eight refusals.

    Reading the built screen at age zero showed all eight products declined with
    the identical subtitle "Your credit is not there yet" — a column that says
    the same thing on every row is not information (CORE_RULES 13.26), and it is
    the third screen in three tickets to do it. The reason is the same for all
    eight and it has nothing to do with credit: they are eight years old.
  */
  if (state.player.age < CREDIT_FROM_AGE) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yet" body="You can apply for a credit card once you're eighteen." />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {held.length > 0 ? (
        <>
          <SectionHeading>What you hold</SectionHeading>
          <Card>
            {held.map((card, index) => {
              const product = findProduct(card.productId);
              if (!product) return null;
              const owed = Number(card.balance);
              return (
                <Fragment key={card.productId}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    icon="money"
                    title={product.name}
                    /*
                      Spec 28's fields, in the order a person asks about them:
                      what is on it, what is left, and what it costs. Never an
                      opened date, and never a payment history.
                    */
                    subtitle={
                      card.status === 'frozen'
                        ? 'Frozen until you catch up'
                        : `${money(Number(availableOn(card)))} left of ${money(Number(card.limit))}`
                    }
                    value={owed > 0 ? money(owed) : 'Clear'}
                    meta={`${Math.round(product.apr * 100)}% · ${REWARD_LABELS[product.rewards]}`}
                    affordance="none"
                    wrap
                  />
                  {owed > 0 ? (
                    <ListRow
                      title="Minimum this year"
                      value={money(Number(minimumOn(card)))}
                      affordance="none"
                      compact
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </Card>
        </>
      ) : null}

      <SectionHeading>{held.length > 0 ? 'Other cards' : 'Cards you could get'}</SectionHeading>
      <Card>
        {offers.map(({ product, decision }, index) => (
          <Fragment key={product.id}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              title={product.name}
              /*
                The blurb when they can have it, the reason when they cannot.
                A row that just greys out teaches a player nothing about what
                would change it — which is the same argument 0305 makes for
                showing what is helping and hurting a credit standing.
              */
              subtitle={decision.approved ? product.blurb : whyNot(decision.because)}
              value={
                decision.approved
                  ? money(Number(decision.limit))
                  : decision.because === 'alreadyHeld'
                    ? 'Held'
                    : 'No'
              }
              meta={`${product.issuer} · ${Math.round(product.apr * 100)}%${
                product.annualFee > 0 ? ` · $${product.annualFee} a year` : ' · no fee'
              }`}
              affordance={decision.approved ? 'action' : 'none'}
              disabled={!decision.approved}
              onPress={decision.approved ? () => apply(product.id) : undefined}
              wrap
            />
          </Fragment>
        ))}
      </Card>

      <Text style={styles.note}>
        A card covers what your money doesn’t, on its own. Paying it down is the part you choose.
      </Text>
    </ScrollView>
  );
}

function whyNot(because: string | undefined): string {
  switch (because) {
    case 'tooManyCards':
      return 'You already have five credit cards';
    case 'alreadyHeld':
      return 'You already have this card';
    case 'standing':
      return "Your credit doesn't meet this card's requirements yet";
    case 'income':
      return 'Your income is too low for this card';
    case 'tooMuchOwed':
      return "You've reached the total credit limit lenders will offer you";
    case 'noDeposit':
      return "You don't have enough cash for the deposit";
    default:
      return "You can't get this card right now";
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
