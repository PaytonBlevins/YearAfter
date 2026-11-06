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
import { ScrollView, StyleSheet, Text } from 'react-native';
import { findAuctionVenue } from '@yearafter/content';
import { BUYERS_PREMIUM, CREDIBILITY_LABELS } from '@yearafter/finance';
import {
  STORAGE_PREMIUM,
  credibilityOf,
  currentLots,
  hasBidOn,
  liveBidQuote,
  visitsLeft,
  visitsUsed,
} from '@yearafter/simulation';
import { useNavigation } from '../navigation/navigation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

export function AuctionScreen() {
  const { state, attendAnAuction, bidAtAuction, passAtAuction } = useGame();
  const { current } = useNavigation();
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!state || !current?.venueId) return null;
  const venue = findAuctionVenue(current.venueId);
  if (!venue) return null;
  const left = visitsLeft(state, venue.id);
  const used = visitsUsed(state, venue.id);
  const lots = currentLots(state, venue.id);
  const active = lots.find(
    (lot) => state.auctions?.year === state.world.year && state.auctions.rounds?.[lot.id],
  );
  const expanded = lots.some((lot) => lot.id === open) ? open : active?.id;
  const premium = venue.type === 'storage' ? STORAGE_PREMIUM : BUYERS_PREMIUM;

  return (
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
              const quote = expanded === lot.id && !gone ? liveBidQuote(state, lot.id) : undefined;
              return (
                <Fragment key={lot.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
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
                    onPress={
                      gone
                        ? undefined
                        : () =>
                            setOpen(
                              expanded === lot.id && lot.id !== active?.id ? undefined : lot.id,
                            )
                    }
                    wrap
                  />
                  {quote ? (
                    <>
                      {quote.counter === undefined ? null : (
                        <Text style={styles.blurb}>
                          Another bidder offered {money(quote.counter)}. Raise or pass.
                        </Text>
                      )}
                      <Text style={styles.note}>
                        {quote.counter === undefined ? 'Opening bid' : 'Your next bid'}:{' '}
                        {money(quote.hammer)}. With the buyer’s premium, {money(quote.total)} if you
                        win.
                      </Text>
                      <PurchasePaymentChoices
                        key={quote.token}
                        mode="live-bid"
                        purchaseName={lot.name}
                        total={dollars(quote.total)}
                        cash={state.player.cash}
                        cards={state.cards}
                        onPay={(payment) => bidAtAuction(lot.id, quote.token, payment)}
                      />
                      {quote.counter !== undefined ? (
                        <ActionButton
                          label="Pass on this lot"
                          variant="quiet"
                          onPress={() => {
                            passAtAuction(lot.id);
                            setOpen(undefined);
                          }}
                        />
                      ) : null}
                    </>
                  ) : null}
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
  );
}

const styles = StyleSheet.create({
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
