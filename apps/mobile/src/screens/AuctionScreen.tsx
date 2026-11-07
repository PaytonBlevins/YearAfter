/**
 * Ticket 0507 — one auction venue.
 *
 * Spec 41: two general houses each attended up to twice a year, a storage
 * yard attended more often, and private sales for the wealthy; spec 1899:
 * credibility is "hidden/descriptive" — the house's standing this year is a
 * phrase, never a number. The player's next bid is quoted before payment. The
 * room can counter, and the player decides whether to raise or pass.
 */

import { PurchasePaymentChoices } from '../components/PurchasePaymentChoices';
import { dollars } from '@yearafter/core';

import { Fragment, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { findAuctionVenue, findValuable } from '@yearafter/content';
import { BUYERS_PREMIUM, CREDIBILITY_LABELS } from '@yearafter/finance';
import {
  STORAGE_PREMIUM,
  credibilityOf,
  currentLots,
  hasBidOn,
  liveBidQuote,
  type Lot,
  visitsLeft,
  visitsUsed,
} from '@yearafter/simulation';
import { useNavigation } from '../navigation/navigation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { LotArt } from '../theme/sceneArt';
import { colors, radii, shadows, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

export function AuctionScreen() {
  const { state, outcome, attendAnAuction, bidAtAuction, passAtAuction } = useGame();
  const { current } = useNavigation();
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  if (!state || !current?.venueId) return null;
  const venue = findAuctionVenue(current.venueId);
  if (!venue) return null;
  const left = visitsLeft(state, venue.id);
  const used = visitsUsed(state, venue.id);
  const lots = currentLots(state, venue.id);
  const active = lots.find(
    (lot) => state.auctions?.year === state.world.year && state.auctions.rounds?.[lot.id],
  );
  const selected = lots.find((lot) => lot.id === (open === undefined ? active?.id : open));
  const quote =
    selected && !hasBidOn(state, selected.id) ? liveBidQuote(state, selected.id) : undefined;
  const premium = venue.type === 'storage' ? STORAGE_PREMIUM : BUYERS_PREMIUM;

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.blurb}>{venue.blurb}</Text>
        <Card>
          {venue.type === 'general' ? (
            <ListRow
              title="Word is"
              value={CREDIBILITY_LABELS[credibilityOf(venue, state.world.year)]}
              affordance="none"
              compact
            />
          ) : null}
          <ListRow title="Sales left this year" value={String(left)} affordance="none" compact />
          <ListRow
            title="On top of the hammer price"
            value={`${Math.round(premium * 100)}%`}
            affordance="none"
            compact
          />
        </Card>
        {left > 0 ? (
          <ActionButton
            label={used === 0 ? 'Go to the sale' : 'Go to the next sale'}
            disabled={active !== undefined}
            variant={used === 0 ? 'primary' : 'secondary'}
            onPress={() => {
              attendAnAuction(venue.id);
              setOpen(undefined);
            }}
          />
        ) : null}

        {active ? (
          <Text style={styles.note}>Finish bidding or pass before going to the next sale.</Text>
        ) : null}
        {used === 0 ? (
          <EmptyState
            title="Not there yet"
            body={`${venue.visits} ${venue.visits === 1 ? 'sale' : 'sales'} a year. Each one is a new set of lots.`}
          />
        ) : (
          <>
            <SectionHeading note={`Sale ${used} of ${venue.visits}`}>
              {venue.type === 'storage' ? 'Units' : 'Lots'}
            </SectionHeading>
            <Card>
              {lots.map((lot, index) => {
                const gone = hasBidOn(state, lot.id);
                return (
                  <Fragment key={lot.id}>
                    {index > 0 ? <RowDivider /> : null}
                    <ListRow
                      icon={lotIcon(lot)}
                      title={lot.name}
                      subtitle={lot.description}
                      value={
                        lot.kind === 'unit'
                          ? `About ${money((lot.estimate.low + lot.estimate.high) / 2)}`
                          : `${money(lot.estimate.low)}–${money(lot.estimate.high)}`
                      }
                      meta={gone ? 'Gone' : undefined}
                      affordance={gone ? 'none' : 'action'}
                      disabled={gone}
                      onPress={gone ? undefined : () => setOpen(lot.id)}
                      wrap
                    />
                  </Fragment>
                );
              })}
            </Card>
            <Text style={styles.note}>
              {venue.type === 'storage'
                ? 'You only see what the door shows. What you win, you keep — or sell off.'
                : "Estimates are the house's. You pay where the bidding stops, plus the premium."}
            </Text>
          </>
        )}
      </ScrollView>
      {selected && quote && !outcome ? (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(null)}>
          <View style={styles.scrim}>
            <View style={styles.dialog} accessibilityViewIsModal>
              <View style={styles.ribbon}>
                <Text style={styles.ribbonText}>AUCTION / SALE {used}</Text>
              </View>
              <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogContent}>
                <View style={styles.lotHero}>
                  <LotArt lot={selected} />
                  <Text style={styles.venue}>{venue.name}</Text>
                  <Text accessibilityRole="header" style={styles.lotName}>
                    {selected.name}
                  </Text>
                  <Text style={styles.lotDescription}>{selected.description}</Text>
                </View>
                <View style={styles.quote}>
                  {quote.counter === undefined ? null : (
                    <Text accessibilityLiveRegion="polite" style={styles.counter}>
                      Another bidder offered {money(quote.counter)}. Raise or pass.
                    </Text>
                  )}
                  <Text style={styles.bid}>
                    {quote.counter === undefined ? 'Opening bid' : 'Your next bid'}:{' '}
                    {money(quote.hammer)}
                  </Text>
                  <Text style={styles.lotDescription}>
                    {money(quote.total)} with the buyer’s premium if you win.
                  </Text>
                </View>
                <PurchasePaymentChoices
                  key={quote.token}
                  mode="live-bid"
                  purchaseName={selected.name}
                  total={dollars(quote.total)}
                  cash={state.player.cash}
                  cards={state.cards}
                  onPay={(payment) => bidAtAuction(selected.id, quote.token, payment)}
                />
                <ActionButton
                  label={quote.counter === undefined ? 'Back to lots' : 'Pass on this lot'}
                  variant="quiet"
                  onPress={() => {
                    if (quote.counter !== undefined) passAtAuction(selected.id);
                    setOpen(null);
                  }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function lotIcon(lot: Lot) {
  if (lot.kind === 'car') return 'vehicle';
  if (lot.kind === 'unit') return 'parcel';
  const kind = findValuable(lot.itemId)?.kind;
  if (kind === 'watch') return 'watch';
  if (kind === 'art') return 'art';
  if (
    kind === 'ring' ||
    kind === 'necklace' ||
    kind === 'earrings' ||
    kind === 'chain' ||
    kind === 'bracelet'
  )
    return 'assets';
  return 'collection';
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.scrim,
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: spacing.xs,
    borderColor: colors.auction,
    overflow: 'hidden',
    ...shadows.raised,
  },
  ribbon: { backgroundColor: colors.auction, padding: spacing.md },
  ribbonText: {
    color: colors.onAccent,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.caption,
    letterSpacing: 1.4,
  },
  dialogScroll: { flexGrow: 0, flexShrink: 1 },
  dialogContent: { gap: spacing.md, padding: spacing.lg },
  lotHero: { alignItems: 'center', gap: spacing.xs },
  venue: { marginTop: spacing.sm, color: colors.auction, fontWeight: typography.weights.bold },
  lotName: {
    color: colors.ink,
    textAlign: 'center',
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
  },
  lotDescription: {
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: typography.lineHeights.label,
  },
  quote: {
    backgroundColor: colors.auctionSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bid: {
    color: colors.ink,
    textAlign: 'center',
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  counter: { color: colors.auction, textAlign: 'center', fontWeight: typography.weights.bold },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  blurb: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
  note: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
