/**
 * Ticket 0506 — Shopping, a store's counter, and the collection.
 *
 * Spec 1363: shopping lives under Assets, because what you buy you own. Spec
 * 1366: a store shows a handful, never the catalog, and nothing needs a search
 * field. Spec 1893: the collection sorts itself onto shelves, and selling is
 * one button. Spec 1891: a diamond is its size and a broad quality, and the
 * name already says both.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { dollars } from '@yearafter/core';
import { PurchasePaymentChoices } from '../components/PurchasePaymentChoices';
import { COLLECTION_SHELF_LABELS, findValuableStore } from '@yearafter/content';
import {
  BUY_VALUABLE_ERROR_LABELS,
  valuablePurchaseQuote,
  valuableIcingQuote,
  collectionOf,
  openStores,
  openVenues,
  storeStock,
  visitsLeft,
} from '@yearafter/simulation';
import { useNavigation } from '../navigation/navigation';
import { ActionButton, Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

/* -------------------------------------------------------------------------- */
/* The stores                                                                  */
/* -------------------------------------------------------------------------- */

export function ShoppingScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  const stores = openStores(state);
  const venues = openVenues(state);
  if (stores.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yet" body="You're too young to be shopping for this." />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        {stores.map((store, index) => (
          <Fragment key={store.id}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              icon="shopping"
              title={store.name}
              subtitle={store.blurb}
              affordance="navigate"
              onPress={() => push({ screen: 'store', title: store.name, storeId: store.id })}
              wrap
            />
          </Fragment>
        ))}
      </Card>
      <Text style={styles.note}>New pieces in every year.</Text>

      {/* Ticket 0507. Spec 41's venues, the private room behind its gate. */}
      {venues.length > 0 ? (
        <>
          <SectionHeading>Auctions</SectionHeading>
          <Card>
            {venues.map((venue, index) => (
              <Fragment key={venue.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  icon="collection"
                  title={venue.name}
                  subtitle={
                    visitsLeft(state, venue.id) > 0
                      ? `${visitsLeft(state, venue.id)} of ${venue.visits} sales left this year`
                      : 'No more sales this year'
                  }
                  affordance="navigate"
                  onPress={() => push({ screen: 'auction', title: venue.name, venueId: venue.id })}
                  wrap
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* One store's counter                                                         */
/* -------------------------------------------------------------------------- */

export function StoreScreen() {
  const { state, buyAValuable } = useGame();
  const [iced, setIced] = useState(false);
  const { current } = useNavigation();
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!state || !current?.storeId) return null;
  const store = findValuableStore(current.storeId);
  const pieces = storeStock(state, current.storeId);
  const finish: 'original' | 'iced' = iced ? 'iced' : 'original';
  if (!store || pieces.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Nothing here" body="Nothing on the counter this year." />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.blurb}>{store.blurb}</Text>
      <Card>
        {pieces.map((piece, index) => (
          <Fragment key={piece.id}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              title={piece.item.name}
              subtitle={piece.item.blurb || undefined}
              value={money(piece.price)}
              affordance="action"
              onPress={() => {
                setOpen(open === piece.id ? undefined : piece.id);
                setIced(false);
              }}
              wrap
            />
            {open === piece.id
              ? (() => {
                  const quote = valuablePurchaseQuote(piece, finish);
                  return (
                    <>
                      {piece.item.icing?.kind === 'aftermarket' ? (
                        <>
                          <ListRow
                            title="Original"
                            value={!iced ? 'Chosen' : undefined}
                            onPress={() => setIced(false)}
                            affordance="action"
                          />
                          <ListRow
                            title="Iced-out"
                            subtitle="Aftermarket diamond work"
                            value={iced ? 'Chosen' : undefined}
                            onPress={() => setIced(true)}
                            affordance="action"
                          />
                        </>
                      ) : piece.item.icing?.kind === 'factory' ? (
                        <Text style={styles.note}>Factory-set diamonds</Text>
                      ) : null}
                      {quote.ok ? (
                        <>
                          <Text
                            style={styles.note}
                          >{`Base watch or piece: ${money(quote.value.base)} · Custom work: ${money(quote.value.work)} · Total: ${money(quote.value.total)} · Resale: ${money(quote.value.resale)}`}</Text>
                          <PurchasePaymentChoices
                            key={`${piece.id}:${finish}`}
                            purchaseName={piece.item.name}
                            total={dollars(quote.value.total)}
                            cash={state.player.cash}
                            cards={state.cards}
                            onPay={(payment) => {
                              buyAValuable(piece.id, payment, finish);
                              setOpen(undefined);
                            }}
                          />
                        </>
                      ) : (
                        <Text style={styles.note}>{BUY_VALUABLE_ERROR_LABELS[quote.error]}</Text>
                      )}
                    </>
                  );
                })()
              : null}
          </Fragment>
        ))}
      </Card>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* The collection                                                              */
/* -------------------------------------------------------------------------- */

export function CollectionsScreen() {
  const { state, sellAValuable, iceAValuable } = useGame();
  const [customizing, setCustomizing] = useState<string>();
  const { push } = useNavigation();
  const [selling, setSelling] = useState<string | undefined>(undefined);
  if (!state) return null;
  const shelves = collectionOf(state);
  if (shelves.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Nothing yet" body="Anything you buy or are left ends up here." />
        <ActionButton
          label="Go shopping"
          variant="secondary"
          onPress={() => push({ screen: 'shopping', title: 'Shopping' })}
        />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {shelves.map((shelf) => (
        <Fragment key={shelf.shelf}>
          <SectionHeading note={money(shelf.worth)}>
            {COLLECTION_SHELF_LABELS[shelf.shelf]}
          </SectionHeading>
          <Card>
            {shelf.pieces.map(({ owned, item }, index) => (
              <Fragment key={owned.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={item.name}
                  subtitle={
                    owned.reproduction
                      ? 'A reproduction'
                      : owned.inheritedFrom
                        ? `Was ${owned.inheritedFrom}'s`
                        : `${owned.icing ? 'Base watch bought' : 'Bought'} in ${owned.boughtYear} for ${money(Number(owned.purchasePrice) / 100)}`
                  }
                  value={money(Number(owned.value) / 100)}
                  affordance="action"
                  onPress={() => {
                    setSelling(selling === owned.id ? undefined : owned.id);
                    setCustomizing(undefined);
                  }}
                  wrap
                />
                {owned.icing ? (
                  <Text
                    style={styles.note}
                  >{`Iced out in ${owned.icing.year} · Work: ${money(Number(owned.icing.cost) / 100)} · Base watch bought in ${owned.boughtYear}: ${money(Number(owned.purchasePrice) / 100)} · Total paid: ${money(Number(owned.purchasePrice + owned.icing.cost) / 100)}`}</Text>
                ) : item.icing?.kind === 'factory' ? (
                  <Text style={styles.note}>Factory-set diamonds</Text>
                ) : null}
                {selling === owned.id ? (
                  <>
                    <ActionButton
                      label={`Sell it — ${money(Number(owned.value) / 100)}`}
                      variant="secondary"
                      onPress={() => {
                        sellAValuable(owned.id);
                        setSelling(undefined);
                      }}
                    />
                    {item.kind === 'watch'
                      ? (() => {
                          const quote = valuableIcingQuote(state, owned.id);
                          if (!quote.ok)
                            return (
                              <Text style={styles.note}>
                                {BUY_VALUABLE_ERROR_LABELS[quote.error]}
                              </Text>
                            );
                          return (
                            <>
                              <ActionButton
                                label="Have it iced out"
                                variant="secondary"
                                onPress={() => setCustomizing(owned.id)}
                              />
                              {customizing === owned.id ? (
                                <>
                                  <Text
                                    style={styles.note}
                                  >{`Custom work: ${money(quote.value.cost)} · Resale now: ${money(quote.value.before)} · After work: ${money(quote.value.after)}`}</Text>
                                  <PurchasePaymentChoices
                                    key={`icing:${owned.id}`}
                                    purchaseName="watch customization"
                                    total={dollars(quote.value.cost)}
                                    cash={state.player.cash}
                                    cards={state.cards}
                                    onPay={(payment) => {
                                      iceAValuable(owned.id, payment);
                                      setCustomizing(undefined);
                                    }}
                                  />
                                </>
                              ) : null}
                            </>
                          );
                        })()
                      : null}
                  </>
                ) : null}
              </Fragment>
            ))}
          </Card>
        </Fragment>
      ))}
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
