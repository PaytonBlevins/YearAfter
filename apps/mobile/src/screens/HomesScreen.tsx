/**
 * Ticket 0501 — Homes.
 *
 * Two halves, owned then for sale, in the order a player reads them.
 *
 * WHAT A LISTING SAYS IS SPEC 145's LIST AND NOTHING ELSE: type, bedrooms,
 * bathrooms, age, condition, asking price, financing, and one estimated annual
 * expense. No square footage, no market value, no tax line, no rental estimate,
 * no monthly payment (spec 149–150 keeps that for the rental flow, which is
 * 0503). The catalog cannot produce any of them, so this screen cannot print
 * one by accident.
 *
 * WHAT AN OWNED HOME SAYS is spec 849–878's: what it cost, what it is worth now,
 * what is still owed, what the mortgage costs a year and for how long, the
 * condition, and the annual expense.
 *
 * Buying is two taps at most and never a form. "With a mortgage" is spec 149's
 * Apply → Approved/Denied: the product and the deposit are the bank's call, and
 * the answer arrives as an outcome card like every other application.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  HOME_CONDITION_LABELS,
  MORTGAGE_REFUSAL_LABELS,
  annualExpenseOf,
} from '@yearafter/finance';
import { findHomeKind } from '@yearafter/content';
import {
  economicsOf,
  homeListings,
  mortgageLineOf,
  mortgageOfferFor,
  otherPropertyOf,
  rentalListings,
  residenceOf,
  type HomeListing,
} from '@yearafter/simulation';
import type { OwnedHome } from '@yearafter/finance';
import { useNavigation } from '../navigation/navigation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;
const rooms = (beds: number, baths: number) =>
  `${beds} bed${beds === 1 ? '' : 's'} · ${baths} bath${baths === 1 ? '' : 's'}`;
const age = (years: number) => (years <= 1 ? 'New' : `${years} years old`);

export function HomesScreen() {
  const { state, buyAHome, sellAHome } = useGame();
  const { push } = useNavigation();
  const [open, setOpen] = useState<string | undefined>(undefined);
  const [selling, setSelling] = useState<string | undefined>(undefined);
  if (!state) return null;

  if (state.player.age < 18) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yet" body="You can buy somewhere once you're eighteen." />
      </ScrollView>
    );
  }

  const listings = homeListings(state);
  const rentals = rentalListings(state);
  const cash = Math.floor(Number(state.player.cash) / 100);
  const home = residenceOf(state.homes);
  const others = otherPropertyOf(state.homes);

  const ownedRows = (owned: OwnedHome, index: number) => {
    const kind = findHomeKind(owned.kindId);
    const owed = Number(owned.mortgage?.balance ?? 0) / 100;
    const mortgage = mortgageLineOf(owned);
    return (
      <Fragment key={owned.id}>
        {index > 0 ? <RowDivider /> : null}
        <ListRow
          icon="home"
          title={`${kind?.name ?? 'Home'} in ${owned.regionName}`}
          subtitle={`${rooms(owned.beds, owned.baths)} · ${HOME_CONDITION_LABELS[owned.condition]}`}
          value={money(Number(owned.value) / 100)}
          affordance="none"
          wrap
        />
        <ListRow
          title="Bought for"
          value={money(Number(owned.purchasePrice) / 100)}
          meta={`in ${owned.boughtYear}`}
          affordance="none"
          compact
        />
        <ListRow
          title="Still owed"
          subtitle={
            mortgage
              ? `${money(mortgage.payment)} a year, ${mortgage.termLeft} years to go`
              : 'Paid off'
          }
          value={owed > 0 ? money(owed) : '—'}
          affordance="none"
          compact
        />
        <ListRow
          title="Upkeep and taxes"
          value={`${money(annualExpenseOf(owned))} a year`}
          affordance="none"
          compact
        />
        {owned.id !== home?.id ? (
          // Ticket 0503. Anything they do not live in is let, or could be.
          <ListRow
            title={owned.letting ? 'Tenants and rent' : 'Rent it out'}
            subtitle={owned.letting ? lettingLine(owned) : 'Nobody lives here at the moment'}
            affordance="navigate"
            onPress={() =>
              push({ screen: 'rental', title: kind?.name ?? 'Property', homeId: owned.id })
            }
            compact
            wrap
          />
        ) : (
          <ListRow
            title="Rent it out"
            subtitle="Move out and let it to somebody else"
            affordance="navigate"
            onPress={() =>
              push({ screen: 'rental', title: kind?.name ?? 'Home', homeId: owned.id })
            }
            compact
          />
        )}
        {/* Ticket 0506. Spec 1327: an owned home shows its renovations. */}
        <ListRow
          title="Renovate"
          subtitle={
            (owned.renovations ?? []).length > 0
              ? `${(owned.renovations ?? []).length} done`
              : 'Kitchens, bathrooms, a pool'
          }
          affordance="navigate"
          onPress={() => push({ screen: 'renovate', title: 'Renovate', homeId: owned.id })}
          compact
        />
        {selling === owned.id ? (
          <ActionButton
            label="Sell it"
            onPress={() => {
              sellAHome(owned.id);
              setSelling(undefined);
            }}
          />
        ) : (
          <ListRow title="Sell" affordance="action" compact onPress={() => setSelling(owned.id)} />
        )}
      </Fragment>
    );
  };

  const listingRows = (list: readonly HomeListing[]) =>
    list.map((listing, index) => {
      const offer = mortgageOfferFor(state, listing);
      const owned = state.homes.some((candidate) => candidate.id === listing.id);
      const outright = cash >= listing.askingPrice;
      return (
        <Fragment key={listing.id}>
          {index > 0 ? <RowDivider /> : null}
          <ListRow
            title={listing.name}
            subtitle={`${listing.units > 1 ? `${listing.units} units` : rooms(listing.beds, listing.baths)} · ${age(listing.age)} · ${
              HOME_CONDITION_LABELS[listing.condition]
            }`}
            value={money(listing.askingPrice)}
            meta={`About ${money(listing.annualExpense)} a year to keep · ${
              owned ? 'Yours' : offer.approved ? 'Mortgage available' : 'No mortgage for you'
            }`}
            affordance={owned ? 'none' : 'action'}
            disabled={owned}
            onPress={
              owned ? undefined : () => setOpen(open === listing.id ? undefined : listing.id)
            }
            wrap
          />
          {open === listing.id && !owned ? (
            <>
              <Text style={styles.blurb}>{listing.blurb}</Text>
              {offer.approved ? (
                <ActionButton
                  label={`Mortgage it — ${money(offer.down)} down`}
                  onPress={() => {
                    buyAHome(listing.id, 'mortgage');
                    setOpen(undefined);
                  }}
                />
              ) : (
                <Text style={styles.note}>
                  {offer.because ? MORTGAGE_REFUSAL_LABELS[offer.because] : ''}
                </Text>
              )}
              {outright ? (
                <ActionButton
                  label={`Buy it outright — ${money(listing.askingPrice)}`}
                  onPress={() => {
                    buyAHome(listing.id, 'cash');
                    setOpen(undefined);
                  }}
                />
              ) : null}
            </>
          ) : null}
        </Fragment>
      );
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {home ? (
        <>
          <SectionHeading>Your home</SectionHeading>
          <Card>{ownedRows(home, 0)}</Card>
        </>
      ) : null}

      {others.length > 0 ? (
        <>
          <SectionHeading>
            {others.length === 1 ? 'Your property' : 'Your properties'}
          </SectionHeading>
          <Card>{others.map((owned, index) => ownedRows(owned, index))}</Card>
        </>
      ) : null}

      <SectionHeading note={listings[0]?.regionName}>For sale this year</SectionHeading>
      {listings.length === 0 ? (
        <EmptyState title="Nothing listed" body="Nothing is for sale near you this year." />
      ) : (
        <Card>{listingRows(listings)}</Card>
      )}

      {/*
        Ticket 0503. Only when there is something to show: behind the same
        hidden gate as the homes, a character who could never afford a duplex
        never sees an empty heading telling them so.
      */}
      {rentals.length > 0 ? (
        <>
          <SectionHeading>Rental property for sale</SectionHeading>
          <Card>{listingRows(rentals)}</Card>
        </>
      ) : null}
      <Text style={styles.note}>New listings every year.</Text>
    </ScrollView>
  );
}

/** Ticket 0503. One line on a let property: who is in, and at what. */
function lettingLine(owned: OwnedHome): string {
  const numbers = economicsOf(owned);
  const filled =
    numbers.units === 1
      ? numbers.let === 1
        ? 'Let'
        : 'Empty'
      : `${numbers.let} of ${numbers.units} let`;
  const agent = owned.letting?.managed ? ' · agent' : '';
  return `${filled} · ${money(numbers.rentPerUnitMonth)} gross a month${numbers.units > 1 ? ' each' : ''}${agent}`;
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
