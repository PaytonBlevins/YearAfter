/**
 * Ticket 0308 — the portfolio, and the four things anybody can buy.
 *
 * Spec 1691's verbs are Buy, Sell and Hold. Two of them are buttons; HOLD IS
 * NOT, and that is deliberate rather than missing. A verb whose meaning is
 * "leave it alone" should not need pressing, and a screen that asked a player
 * to confirm inaction every year would be exactly the chore spec 1126-1136
 * removes.
 *
 * SPEC 205 PUTS RETURNS HERE: *"investment returns inside the investment
 * area"*. The dashboard gets one figure and no breakdown; this screen is where
 * a player is allowed to see what each holding did. The market line at the top
 * is the other half of that — spec 706-724 forbids an economy dashboard but
 * wants conditions "shown when relevant through timeline text and contextual
 * market effects", and one sentence on the screen the effect lands on is the
 * contextual version of that.
 *
 * WHAT EACH ROW HAS TO SAY is a number the player cannot get anywhere else: not
 * the value, which is on the dashboard, but the GAP between the value and what
 * they put in. A holding that says "$14,200" tells them nothing they can act
 * on. "$14,200, up $4,200" is the whole of what an investment screen is for.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  CLASS_LABELS,
  INVESTMENTS_NOT_YET_BUILT,
  MARKET_LABELS,
  findInvestment,
  holdingValue,
  portfolioGain,
} from '@yearafter/finance';
import { investmentOffers } from '@yearafter/simulation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

/*
  A TAG HAS TO MEAN SOMETHING TO EARN ITS PLACE.

  The first version put "pays out yearly" on anything with a non-zero yield,
  which put it on five of the seven products — including an index fund paying
  1.5% and a managed fund paying 1.2%. A label that appears on most of a list
  is not telling the reader which ones are different, and it was next to
  Corporate Bonds at 4.6% implying they were the same kind of thing.

  The threshold is where a yield stops being a rounding error on the price and
  starts being a reason to hold the thing: bonds and blue chips, not funds.
*/
const INCOME_FROM = 0.025;
const paysIncome = (yieldRate: number): boolean => yieldRate >= INCOME_FROM;

export function InvestmentsScreen() {
  const { state, buyInvestment, sellInvestment } = useGame();
  const [buying, setBuying] = useState<string | undefined>(undefined);
  const [selling, setSelling] = useState<string | undefined>(undefined);
  if (!state) return null;

  const held = state.portfolio;
  const cash = Math.round(Number(state.player.cash) / 100);
  const total = Math.round(Number(holdingValue(held)) / 100);
  const gain = portfolioGain(held);
  const offers = investmentOffers(state);

  /*
    NOTHING IN THE BANK GETS ONE SENTENCE, NOT SEVEN REFUSALS.

    Reading the built screen at thirty-four with $0 showed all seven products
    declined, each naming a minimum the character could not reach by any amount
    — "Takes $500 to open" under a balance of nothing. Every row was true and
    not one of them was the reason. It is the CardsScreen fix from 0306 in a
    new place: when the reason is the same for everything and has nothing to do
    with the products, say it once, above them.
  */
  const cheapest = Math.min(...offers.map(({ product }) => product.minimum));
  if (held.length === 0 && cash < cheapest) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState
          title="Nothing to invest yet"
          body={`This starts once there is money in the bank. The cheapest thing here opens at ${money(cheapest)}.`}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {held.length > 0 ? (
        <>
          <SectionHeading>What you hold</SectionHeading>
          <Card>
            {held.map((holding, index) => {
              const product = findInvestment(holding.productId);
              if (!product) return null;
              const value = Math.round(Number(holding.value) / 100);
              const put = Math.round(Number(holding.contributed) / 100);
              const up = value - put;
              return (
                <Fragment key={holding.productId}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    icon="money"
                    title={product.name}
                    /*
                      The GAP, not the value — the value is already the row's
                      number on the right, and a subtitle repeating it would be
                      the duplicate-number defect this build has shipped twice
                      (CORE_RULES 13.26).
                    */
                    subtitle={
                      up === 0
                        ? `${money(put)} in, and level`
                        : up > 0
                          ? `Up ${money(up)} on ${money(put)} in`
                          : `Down ${money(-up)} on ${money(put)} in`
                    }
                    value={money(value)}
                    meta={`${CLASS_LABELS[product.assetClass]}${
                      paysIncome(product.yield) ? ' · pays you yearly' : ''
                    }`}
                    affordance="none"
                    wrap
                  />
                  {selling === holding.productId ? (
                    <>
                      <ActionButton
                        label={`Sell ${money(Math.round(value / 4))}`}
                        onPress={() => {
                          sellInvestment(holding.productId, Math.round(value / 4));
                          setSelling(undefined);
                        }}
                      />
                      <ActionButton
                        label={`Sell ${money(Math.round(value / 2))}`}
                        onPress={() => {
                          sellInvestment(holding.productId, Math.round(value / 2));
                          setSelling(undefined);
                        }}
                      />
                      <ActionButton
                        label={`Sell all ${money(value)}`}
                        onPress={() => {
                          sellInvestment(holding.productId, value);
                          setSelling(undefined);
                        }}
                      />
                    </>
                  ) : (
                    <ListRow
                      title="Sell some"
                      subtitle="Back into your bank account"
                      affordance="action"
                      compact
                      onPress={() => setSelling(holding.productId)}
                    />
                  )}
                </Fragment>
              );
            })}
          </Card>
          <Text style={styles.note}>
            {total > 0
              ? `${money(total)} invested, ${
                  gain === 0
                    ? 'level on what you put in'
                    : gain > 0
                      ? `up ${money(gain)}`
                      : `down ${money(-gain)}`
                }. Last year was ${MARKET_LABELS[state.market]}.`
              : `Last year was ${MARKET_LABELS[state.market]}.`}
          </Text>
        </>
      ) : null}

      <SectionHeading>{held.length > 0 ? 'Buy more' : 'What you could buy'}</SectionHeading>
      <Card>
        {offers.map(({ product, refusal }, index) => {
          // Never offer more than is in the bank, and never below the minimum.
          const most = Math.min(cash, 1_000_000);
          return (
            <Fragment key={product.id}>
              {index > 0 ? <RowDivider /> : null}
              <ListRow
                title={product.name}
                /*
                  The BLURB when they can buy, the bar when they cannot — the
                  0307 lesson, where five rows all said "your credit is not
                  there yet" and the thing that actually differed between them
                  was the number nobody printed.
                */
                subtitle={refusal ? whyNot(refusal, product.minimum, cash) : product.character}
                value={refusal ? 'No' : 'Buy'}
                meta={`${CLASS_LABELS[product.assetClass]} · from ${money(product.minimum)}${
                  paysIncome(product.yield) ? ' · pays you yearly' : ''
                }`}
                affordance={refusal ? 'none' : 'action'}
                disabled={refusal !== undefined}
                onPress={
                  refusal
                    ? undefined
                    : () => setBuying(buying === product.id ? undefined : product.id)
                }
                wrap
              />
              {buying === product.id && !refusal ? (
                <>
                  <ActionButton
                    label={`Put in ${money(Math.max(product.minimum, Math.round(most / 4)))}`}
                    onPress={() => {
                      buyInvestment(product.id, Math.max(product.minimum, Math.round(most / 4)));
                      setBuying(undefined);
                    }}
                  />
                  <ActionButton
                    label={`Put in ${money(Math.max(product.minimum, Math.round(most / 2)))}`}
                    onPress={() => {
                      buyInvestment(product.id, Math.max(product.minimum, Math.round(most / 2)));
                      setBuying(undefined);
                    }}
                  />
                  <ActionButton
                    label={`Put in all ${money(most)}`}
                    onPress={() => {
                      buyInvestment(product.id, most);
                      setBuying(undefined);
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
        {INVESTMENTS_NOT_YET_BUILT.map((row, index) => (
          <Fragment key={row.key}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow title={row.label} subtitle={`Needs ${row.needs}`} affordance="none" disabled />
          </Fragment>
        ))}
      </Card>

      <Text style={styles.note}>
        Nothing is sold for you. If a year costs more than you have, the shortfall goes on a card
        and your holdings stay where they are.
      </Text>
    </ScrollView>
  );
}

/**
 * NAMES BOTH NUMBERS, so it cannot be the wrong reason.
 *
 * "Takes $2,500 to open" is true of the product and says nothing about the
 * player; "you have not got the cash" is true of the player and says nothing
 * about the product. A character with $600 looking at a $2,500 fund is refused
 * by the gap between them, and the gap is what they can act on.
 */
function whyNot(refusal: string, minimum: number, cash: number): string {
  switch (refusal) {
    case 'belowMinimum':
    case 'noCash':
      return `Opens at ${money(minimum)}, and you have ${money(cash)}`;
    case 'tooManyHoldings':
      return 'You hold as many as this screen will show';
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
