/**
 * Ticket 0308c — the investments hub.
 *
 * Three things, in the order a player wants them:
 *
 *   WHAT YOU HAVE, and what it has done. A portfolio chart first, because the
 *   one question somebody opens this screen with is "am I up".
 *   WHAT YOU HOLD, each with the gap between what it is worth and what it cost.
 *   WHERE TO BUY, one row per tier with a reading of how that tier is going.
 *
 * THE HEALTH BAR IS ON EVERY TIER. The reference app shows one on Bonds and
 * Stocks and not on Crypto, Funds or Penny Stocks, which reads as a bug rather
 * than a decision — a reading that appears on some rows and not others makes a
 * player wonder what is wrong with the others. Spec 706-724 forbids an economy
 * dashboard; a per-tier reading on the screen the effect lands on is the
 * "contextual market effects" the same section asks for.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  INVESTMENTS_NOT_YET_BUILT,
  KIND_LABELS,
  MARKET_LABELS,
  kindHealth,
  portfolioWorth,
  priceLine,
  priceOf,
  type InstrumentKind,
} from '@yearafter/finance';
import { holdingsOf } from '@yearafter/simulation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { PriceChart } from '../components/PriceChart';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

const money = (inCents: number): string => `$${Math.round(inCents / 100).toLocaleString('en-US')}`;

const TIERS: readonly InstrumentKind[] = ['stock', 'fund', 'bond', 'crypto', 'penny'];

/** One line about a tier, so the five rows are not five identical sentences. */
const TIER_BLURB: Readonly<Record<InstrumentKind, string>> = {
  stock: 'Named companies, across seven sectors',
  fund: 'Own a lot of things at once',
  bond: 'Lend it out, get it back on a date',
  crypto: 'No earnings, no dividend, no floor',
  penny: 'Small local companies. Most of them fail',
};

export function InvestmentsScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const held = holdingsOf(state);
  const worth = Number(portfolioWorth(state.prices, state.portfolio));
  const paid = held.reduce((sum, row) => sum + row.paid, 0);
  const gain = worth - paid;

  /*
    THE PORTFOLIO'S OWN HISTORY, rebuilt from the price book rather than stored.

    A character's holdings change, so a stored series would be a record of two
    different portfolios glued together. Valuing TODAY'S holdings at each of the
    last twelve years' prices answers the question the chart is actually for —
    "what has this collection of things been doing" — and needs nothing in the
    save that is not already there.
  */
  const depth = Math.max(
    ...held.map((row) => priceLine(state.prices, row.holding.instrumentId).length),
    1,
  );
  const portfolioLine =
    held.length > 0
      ? Array.from({ length: depth }, (_, index) =>
          held.reduce((sum, row) => {
            const line = priceLine(state.prices, row.holding.instrumentId);
            // Short series are padded from their own first point, so an
            // instrument added late does not read as having been worth zero.
            const at = line[Math.max(0, line.length - depth + index)] ?? line[0] ?? 0;
            return sum + Math.round(row.holding.units * at);
          }, 0),
        )
      : [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {held.length > 0 ? (
        <>
          <SectionHeading>Where it stands</SectionHeading>
          <Card>
            <ListRow
              title="Portfolio"
              subtitle={
                gain === 0
                  ? `${money(paid)} in, and level`
                  : gain > 0
                    ? `Up ${money(gain)} on ${money(paid)} in`
                    : `Down ${money(-gain)} on ${money(paid)} in`
              }
              value={money(worth)}
              affordance="none"
              wrap
            />
            <PriceChart line={portfolioLine} caption={`Last ${portfolioLine.length} years`} />
          </Card>

          <SectionHeading>What you hold</SectionHeading>
          <Card>
            {held.map((row, index) => (
              <Fragment key={row.holding.instrumentId}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={row.instrument.name}
                  /*
                    The GAP, never the value — the value is already the number on
                    the right, and a subtitle repeating it is the defect this
                    build has shipped twice (CORE_RULES 13.26).
                  */
                  subtitle={
                    row.gain === 0
                      ? `${units(row.holding.units)} at ${price(priceOf(state.prices, row.holding.instrumentId))}`
                      : row.gain > 0
                        ? `Up ${money(row.gain)} · ${units(row.holding.units)}`
                        : `Down ${money(-row.gain)} · ${units(row.holding.units)}`
                  }
                  value={money(row.worth)}
                  meta={
                    row.holding.maturesIn !== undefined
                      ? `${row.instrument.ticker} · back in ${row.holding.maturesIn} years`
                      : `${row.instrument.ticker} · ${KIND_LABELS[row.instrument.kind]}`
                  }
                  onPress={() =>
                    push({
                      screen: 'instrument',
                      title: row.instrument.name,
                      instrumentId: row.holding.instrumentId,
                    })
                  }
                  wrap
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : (
        <EmptyState
          title="Nothing invested yet"
          body={`Last year was ${MARKET_LABELS[state.market]}. Pick a market below and see what things cost.`}
        />
      )}

      <SectionHeading>Markets</SectionHeading>
      <Card>
        {TIERS.map((kind, index) => {
          const health = kindHealth(state.prices, kind);
          return (
            <Fragment key={kind}>
              {index > 0 ? <RowDivider /> : null}
              <ListRow
                title={KIND_LABELS[kind]}
                subtitle={TIER_BLURB[kind]}
                // The share of that tier's names which rose last year, as a
                // bar. One reading, on every tier, or it reads as a bug.
                meter={Math.round(health * 100)}
                value={`${Math.round(health * 100)}%`}
                meta="rose last year"
                onPress={() => push({ screen: 'market', title: KIND_LABELS[kind], kind })}
                wrap
              />
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

const price = (inCents: number): string =>
  `$${(inCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** No four decimal places of noise on a whole-unit holding. */
const units = (count: number): string =>
  Number.isInteger(count)
    ? `${count.toLocaleString('en-US')} held`
    : `${count.toLocaleString('en-US', { maximumFractionDigits: 4 })} held`;

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
