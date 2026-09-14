/**
 * Ticket 0308c — one market, grouped.
 *
 * STOCKS ARE GROUPED BY SECTOR and bonds BY ISSUER, which is not decoration: a
 * sector is a correlation in this build, so the grouping is the same fact the
 * engine uses. Crypto, funds and penny stocks have no grouping worth making, so
 * they get none rather than an invented one.
 *
 * THE ROW IS PRICE AND CHANGE, like the reference app, and then one thing it
 * does not do — WHAT YOU ALREADY HOLD. Its market list tells you what
 * everything costs and never what you own, so the number you need in order to
 * decide is on a different screen.
 *
 * And it does not repeat the reference app's list problem: ten rows reading
 * "Swedish Government Bond (3-Yr)", "(5-Yr)", "(10-Yr)" is a column of one
 * sentence with a number changed (CORE_RULES 13.26). Grouping by issuer puts
 * the name in the heading and leaves the row to say the term, the coupon and
 * the price — three things that differ.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  BOND_ISSUERS,
  KIND_LABELS,
  SECTORS,
  SECTOR_LABELS,
  sectorHealth,
  type Instrument,
  type InstrumentKind,
} from '@yearafter/finance';
import { marketFor, type Offer } from '@yearafter/simulation';
import { Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

export function MarketScreen() {
  const { state } = useGame();
  const { current, push } = useNavigation();
  // The tier comes off the route, like every other screen that is about one
  // thing — the back stack already remembers it, and a second place holding
  // "which market is open" is a second thing that can disagree with it.
  const kind = current?.kind;
  if (!state || !kind) return null;

  const rows = marketFor(state, kind);

  /*
    One group per sector or issuer, and a single ungrouped list otherwise. The
    empty-group case cannot happen — the generator asserts five names to a
    sector — but filtering is cheaper than trusting it from over here.
  */
  const groups: readonly {
    readonly heading: string;
    readonly note?: string;
    readonly rows: readonly Offer[];
  }[] =
    kind === 'stock'
      ? SECTORS.map((sector) => ({
          heading: SECTOR_LABELS[sector],
          note: `${Math.round(sectorHealth(state.prices, sector) * 100)}% rose`,
          rows: rows.filter((row) => row.instrument.sector === sector),
        })).filter((group) => group.rows.length > 0)
      : kind === 'bond'
        ? BOND_ISSUERS.map((issuer) => ({
            heading: issuer,
            rows: rows.filter((row) => row.instrument.issuer === issuer),
          })).filter((group) => group.rows.length > 0)
        : [{ heading: KIND_LABELS[kind], rows }];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {groups.map((group) => (
        <Fragment key={group.heading}>
          <SectionHeading note={group.note}>{group.heading}</SectionHeading>
          <Card>
            {group.rows.map((row, index) => (
              <Fragment key={row.instrument.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={row.instrument.name}
                  /*
                    The CHANGE, in words and signed — which is the one thing a
                    market row is for. A holding line replaces it when there is
                    one, because "you hold 412" outranks "up 2.3%" for somebody
                    who already owns it.
                  */
                  subtitle={
                    row.held > 0
                      ? `You hold ${units(row.held)} · ${changed(row.change)}`
                      : changed(row.change)
                  }
                  value={price(row.price)}
                  meta={metaFor(row.instrument)}
                  onPress={() =>
                    push({
                      screen: 'instrument',
                      title: row.instrument.name,
                      instrumentId: row.instrument.id,
                    })
                  }
                  wrap
                />
              </Fragment>
            ))}
          </Card>
        </Fragment>
      ))}
      <Text style={styles.note}>{FOOTNOTE[kind]}</Text>
    </ScrollView>
  );
}

/** What each row's quiet third line carries — different per tier, on purpose. */
function metaFor(instrument: Instrument): string {
  if (instrument.kind === 'bond') {
    return `${instrument.ticker} · ${pc(instrument.payout)} coupon · ${instrument.termYears} years`;
  }
  if (instrument.payout >= 0.02) return `${instrument.ticker} · pays ${pc(instrument.payout)}`;
  return instrument.ticker;
}

const FOOTNOTE: Readonly<Record<InstrumentKind, string>> = {
  stock: 'Names in the same sector move together. Spreading across sectors is the point.',
  fund: 'A fund owns many things at once, so one of them going wrong matters less.',
  bond: 'A bond ties the money up until its date. Leaving early costs 12%.',
  crypto: 'No earnings and no floor. The best year and the worst year are both here.',
  penny: 'These can go to nothing, and regularly do.',
};

const price = (inCents: number): string => {
  const value = inCents / 100;
  if (value >= 1_000) return `$${Math.round(value).toLocaleString('en-US')}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  // Sub-dollar names need the extra places or every penny stock reads as $0.01.
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
  note: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
