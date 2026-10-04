/**
 * Ticket 0507 — one auction venue.
 *
 * Spec 41: two general houses each attended up to twice a year, a storage
 * yard attended more often, and private sales for the wealthy; spec 1899:
 * credibility is "hidden/descriptive" — the house's standing this year is a
 * phrase, never a number. No live bidding: a lot opens three buttons, each
 * saying how far it would go, and the room answers in a card (CORE_RULES
 * 13.27: answer the player where they pressed).
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { findAuctionVenue } from '@yearafter/content';
import {
  BID_TIERS,
  BID_TIER_LABELS,
  BUYERS_PREMIUM,
  CREDIBILITY_LABELS,
  maxBidFor,
} from '@yearafter/finance';
import {
  STORAGE_PREMIUM,
  credibilityOf,
  currentLots,
  hasBidOn,
  visitsLeft,
  visitsUsed,
} from '@yearafter/simulation';
import { useNavigation } from '../navigation/navigation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

export function AuctionScreen() {
  const { state, attendAnAuction, bidAtAuction } = useGame();
  const { current } = useNavigation();
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!state || !current?.venueId) return null;
  const venue = findAuctionVenue(current.venueId);
  if (!venue) return null;
  const left = visitsLeft(state, venue.id);
  const used = visitsUsed(state, venue.id);
  const lots = currentLots(state, venue.id);
  const cash = Math.floor(Number(state.player.cash) / 100);
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
          variant={used === 0 ? 'primary' : 'secondary'}
          onPress={() => {
            attendAnAuction(venue.id);
            setOpen(undefined);
          }}
        />
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
                    onPress={gone ? undefined : () => setOpen(open === lot.id ? undefined : lot.id)}
                    wrap
                  />
                  {open === lot.id && !gone
                    ? BID_TIERS.map((tier) => {
                        const ceiling = maxBidFor(lot.estimate, tier);
                        const affordable = cash >= ceiling * (1 + premium);
                        return affordable ? (
                          <ActionButton
                            key={tier}
                            label={`${BID_TIER_LABELS[tier]} — up to ${money(ceiling)}`}
                            variant={tier === 'fair' ? 'primary' : 'secondary'}
                            onPress={() => {
                              bidAtAuction(lot.id, tier);
                              setOpen(undefined);
                            }}
                          />
                        ) : (
                          <Text key={tier} style={styles.note}>
                            {`${BID_TIER_LABELS[tier]}: you couldn't cover ${money(ceiling * (1 + premium))}.`}
                          </Text>
                        );
                      })
                    : null}
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
