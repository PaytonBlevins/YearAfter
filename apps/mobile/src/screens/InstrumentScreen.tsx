/**
 * Ticket 0308c — one instrument, up close.
 *
 * The chart is the reason this screen exists, and it does one thing the
 * reference app's does not: it marks WHAT YOU PAID on the same axes as the
 * price. A price line says what the market did; a line with your own entry on
 * it says what you did, which is the question a holder actually has.
 *
 * WHAT THIS SCREEN REFUSES TO SHOW is as deliberate. The reference app puts a
 * "1-Yr Return: 13.0%" row directly above a chart showing that coin falling
 * from $2,200 to $1,712 over five years — a backward-looking number placed
 * where a reader takes it for a forecast. CORE_RULES already forbids that shape
 * elsewhere in this build. The change since last year is shown once, as a
 * change, next to a chart that carries its own context.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  KIND_LABELS,
  SECTOR_LABELS,
  findInstrument,
  priceLine,
  priceOf,
  yearChange,
} from '@yearafter/finance';
import { ActionButton, Card, ListRow, RowDivider, SectionHeading } from '../components';
import { PriceChart } from '../components/PriceChart';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

export function InstrumentScreen() {
  const { state, buyInvestment, sellInvestment } = useGame();
  const { current } = useNavigation();
  const [buying, setBuying] = useState(false);
  const [selling, setSelling] = useState(false);
  const instrumentId = current?.instrumentId;
  if (!state || !instrumentId) return null;

  const instrument = findInstrument(instrumentId);
  if (!instrument) return null;

  const priceNow = priceOf(state.prices, instrumentId);
  const line = priceLine(state.prices, instrumentId);
  const change = yearChange(state.prices, instrumentId);
  const cash = Math.round(Number(state.player.cash) / 100);
  const holding = state.portfolio.find((row) => row.instrumentId === instrumentId);

  const worth = holding ? Math.round(holding.units * priceNow) : 0;
  const paid = holding ? Number(holding.paid) : 0;
  const gain = worth - paid;
  // What they paid PER UNIT, which is what the chart's rule is drawn at.
  const entry = holding && holding.units > 0 ? Math.round(paid / holding.units) : undefined;

  const most = Math.min(cash, 1_000_000);
  const smallest = instrument.kind === 'bond' ? Math.ceil(priceNow / 100) : 1;
  const canAfford = cash >= smallest;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <ListRow
          title={price(priceNow)}
          subtitle={changed(change)}
          value={instrument.ticker}
          meta={
            instrument.sector
              ? `${SECTOR_LABELS[instrument.sector]} · ${KIND_LABELS[instrument.kind]}`
              : instrument.issuer
                ? `${instrument.issuer} · ${instrument.termYears} years`
                : KIND_LABELS[instrument.kind]
          }
          affordance="none"
          wrap
        />
        <PriceChart
          line={line}
          {...(entry !== undefined ? { entry } : {})}
          caption={`${line.length} years${entry !== undefined ? ', with what you paid' : ''}`}
        />
        <Text style={styles.blurb}>{instrument.blurb}</Text>
      </Card>

      {holding ? (
        <>
          <SectionHeading>Your position</SectionHeading>
          <Card>
            <ListRow
              title={`${units(holding.units)} held`}
              subtitle={
                gain === 0
                  ? `${money(paid)} in, and level`
                  : gain > 0
                    ? `Up ${money(gain)} on ${money(paid)} in`
                    : `Down ${money(-gain)} on ${money(paid)} in`
              }
              value={money(worth)}
              meta={
                holding.maturesIn !== undefined
                  ? `Principal back in ${holding.maturesIn} years`
                  : undefined
              }
              affordance="none"
              wrap
            />
            <RowDivider />
            {selling ? (
              <>
                <ActionButton
                  label={`Sell a quarter — ${units(round4(holding.units / 4))}`}
                  onPress={() => {
                    sellInvestment(instrumentId, round4(holding.units / 4));
                    setSelling(false);
                  }}
                />
                <ActionButton
                  label={`Sell half — ${units(round4(holding.units / 2))}`}
                  onPress={() => {
                    sellInvestment(instrumentId, round4(holding.units / 2));
                    setSelling(false);
                  }}
                />
                <ActionButton
                  label={`Sell all ${units(holding.units)} — about ${money(worth)}`}
                  onPress={() => {
                    sellInvestment(instrumentId, holding.units);
                    setSelling(false);
                  }}
                />
              </>
            ) : (
              <ListRow
                title="Sell some"
                /*
                  THE PENALTY IS NAMED BEFORE IT IS CHARGED. A player who sells
                  a bond four years early and only learns the cost afterwards
                  has been charged by a screen that did not mention it.
                */
                subtitle={
                  holding.maturesIn !== undefined
                    ? `Leaving early costs 12% — about ${money(Math.round(worth * 0.12))}`
                    : 'Back into your bank account'
                }
                affordance="action"
                compact
                onPress={() => setSelling(true)}
              />
            )}
          </Card>
        </>
      ) : null}

      <SectionHeading>{holding ? 'Buy more' : 'Buy'}</SectionHeading>
      <Card>
        {!canAfford ? (
          <ListRow
            title="Not this one"
            subtitle={`Opens at ${price(priceNow)}, and you have ${money(cash * 100)}`}
            affordance="none"
            disabled
            wrap
          />
        ) : buying ? (
          <>
            <ActionButton
              label={`Put in ${money(Math.max(smallest, Math.round(most / 4)) * 100)}`}
              onPress={() => {
                buyInvestment(instrumentId, Math.max(smallest, Math.round(most / 4)));
                setBuying(false);
              }}
            />
            <ActionButton
              label={`Put in ${money(Math.max(smallest, Math.round(most / 2)) * 100)}`}
              onPress={() => {
                buyInvestment(instrumentId, Math.max(smallest, Math.round(most / 2)));
                setBuying(false);
              }}
            />
            <ActionButton
              label={`Put in all ${money(most * 100)}`}
              onPress={() => {
                buyInvestment(instrumentId, most);
                setBuying(false);
              }}
            />
          </>
        ) : (
          <ListRow
            title="Put money in"
            subtitle={
              instrument.kind === 'bond'
                ? `Whole bonds at ${price(priceNow)}. You have ${money(cash * 100)}`
                : `You have ${money(cash * 100)} to put at it`
            }
            affordance="action"
            onPress={() => setBuying(true)}
            wrap
          />
        )}
      </Card>

      <Text style={styles.note}>
        {instrument.payout > 0
          ? `Pays about ${pc(instrument.payout)} a year in cash, on top of whatever the price does.`
          : 'Pays nothing along the way. All of it is in the price.'}
      </Text>
    </ScrollView>
  );
}

const round4 = (units: number): number => Math.round(units * 10_000) / 10_000;

const money = (inCents: number): string => `$${Math.round(inCents / 100).toLocaleString('en-US')}`;

const price = (inCents: number): string => {
  const value = inCents / 100;
  if (value >= 1_000) return `$${Math.round(value).toLocaleString('en-US')}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
};

const changed = (fraction: number): string => {
  const pct = Math.round(fraction * 1000) / 10;
  if (pct === 0) return 'Level on last year';
  return pct > 0 ? `Up ${pct}% on last year` : `Down ${-pct}% on last year`;
};

const pc = (rate: number): string => `${Math.round(rate * 1000) / 10}%`;

const units = (count: number): string =>
  Number.isInteger(count)
    ? count.toLocaleString('en-US')
    : count.toLocaleString('en-US', { maximumFractionDigits: 4 });

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  blurb: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
  note: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
