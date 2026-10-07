import { Fragment, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { cents, formatMoney, type Money } from '@yearafter/core';
import {
  availableOn,
  findProduct,
  purchaseEligibility,
  type HeldCard,
  type PurchasePayment,
} from '@yearafter/finance';
import { ActionButton, Card, ListRow, RowDivider, SectionHeading } from './index';
import { colors, spacing, typography } from '../theme/theme';

export type { PurchasePayment } from '@yearafter/finance';

const money = (amount: Money) =>
  formatMoney(amount, { abbreviate: false, showCents: amount % 100 !== 0 });

/**
 * Reusable purchase selector. Commands revalidate the selection before committing.
 */
export function PurchasePaymentChoices({
  purchaseName,
  total,
  cash,
  cards,
  onPay,
  mode = 'purchase',
}: {
  readonly purchaseName: string;
  readonly total: Money;
  readonly cash: Money;
  readonly cards: readonly HeldCard[];
  readonly mode?: 'purchase' | 'bid';
  readonly onPay: (payment: PurchasePayment) => void;
}) {
  const [selected, setSelected] = useState<PurchasePayment>();
  const cashAllowed =
    total > 0 && purchaseEligibility(cash, cards, total, { kind: 'cash' }) === undefined;
  const chosenCard =
    selected?.kind === 'card'
      ? cards.find((card) => card.productId === selected.productId)
      : undefined;
  const chosenProduct = chosenCard ? findProduct(chosenCard.productId) : undefined;
  const canPay =
    selected?.kind === 'cash'
      ? cashAllowed
      : total > 0 &&
        chosenCard !== undefined &&
        chosenProduct !== undefined &&
        purchaseEligibility(cash, cards, total, selected ?? { kind: 'cash' }) === undefined;
  const method = selected?.kind === 'cash' ? 'cash' : chosenProduct?.name;
  return (
    <>
      <SectionHeading>{`Pay for ${purchaseName}`}</SectionHeading>
      <Card>
        <ListRow
          title={mode === 'bid' ? 'Maximum payment if you win' : 'Purchase total'}
          value={money(total)}
          affordance="none"
        />
        <RowDivider />
        <ListRow
          title="Use cash"
          subtitle={
            cashAllowed
              ? `${money(cash)} available`
              : `You have ${money(cash)} in cash. That's not enough for this purchase.`
          }
          value={selected?.kind === 'cash' ? 'Chosen' : undefined}
          affordance={cashAllowed ? 'action' : 'none'}
          disabled={!cashAllowed}
          onPress={cashAllowed ? () => setSelected({ kind: 'cash' }) : undefined}
          wrap
        />
        {cards.map((card) => {
          const product = findProduct(card.productId);
          const available = availableOn(card);
          const allowed =
            total > 0 &&
            product !== undefined &&
            purchaseEligibility(cash, cards, total, { kind: 'card', productId: card.productId }) ===
              undefined;
          const reason =
            product === undefined
              ? "This card isn't available."
              : card.status === 'frozen'
                ? 'This card is frozen. Catch up on payments before using it.'
                : available < total
                  ? `You need ${money(cents(total - available))} more available credit for this purchase.`
                  : 'The full purchase goes on this card. Interest may apply.';
          return (
            <Fragment key={card.productId}>
              <RowDivider />
              <ListRow
                title={product?.name ?? 'Unavailable card'}
                subtitle={reason}
                value={
                  selected?.kind === 'card' && selected.productId === card.productId
                    ? 'Chosen'
                    : undefined
                }
                meta={`${money(available)} available of ${money(card.limit)}${product ? ` · ${Math.round(product.apr * 1000) / 10}% APR` : ''}`}
                affordance={allowed ? 'action' : 'none'}
                disabled={!allowed}
                onPress={
                  allowed
                    ? () => setSelected({ kind: 'card', productId: card.productId })
                    : undefined
                }
                wrap
              />
            </Fragment>
          );
        })}
      </Card>
      {cards.length === 0 ? (
        <Text style={styles.note}>You don't have a credit card yet.</Text>
      ) : null}
      <Text style={styles.note}>
        Choose one way to pay the full amount. A card uses its available credit, not just its limit.
        Choosing a method doesn't buy anything; the payment button confirms your choice.
      </Text>
      {selected && method ? (
        <ActionButton
          label={`${mode === 'bid' ? 'Bid up to' : 'Pay'} ${money(total)} with ${method}`}
          disabled={!canPay}
          onPress={() => {
            if (canPay) onPay({ ...selected, expectedTotal: total });
          }}
        />
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({
  note: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
