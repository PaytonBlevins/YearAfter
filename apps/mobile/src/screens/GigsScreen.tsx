/** P6: deliberate school shifts and adult side work, with annual pay and weekly hours. */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GIG_UNAVAILABLE_LABELS, gigOffers, gigPay, type GigOffer } from '@yearafter/education';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

export function GigsScreen() {
  const { state, takeAGig, quitAGig } = useGame();
  if (!state) return null;
  const { player, education, family } = state;

  const offers = gigOffers({
    age: player.age,
    household: family,
    held: education.gigs,
  });
  const held = offers.filter((offer) => offer.held);
  const open = offers.filter((offer) => !offer.held && !offer.unavailable);
  const closed = offers.filter((offer) => !offer.held && offer.unavailable);

  if (offers.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState
          title="Nothing you can do for money yet"
          body="Give it a few years. Somebody will need a hand."
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {held.length > 0 ? (
        <>
          <SectionHeading note={`${held.length} on the go`}>Work you're doing</SectionHeading>
          <Card>
            {held.map((offer, index) => (
              <Fragment key={offer.gig.id}>
                {index > 0 ? <RowDivider /> : null}
                <GigRow
                  offer={offer}
                  expected={gigPay(offer.gig, player.stats, player.talents)}
                  onPress={() => quitAGig(offer.gig.id)}
                />
              </Fragment>
            ))}
          </Card>
          <Text style={styles.note}>
            Paid at the end of the year, and the feed says how much. The hours come out of the same
            week as everything else.
          </Text>
        </>
      ) : null}

      {(['partTime', 'oddJob'] as const).map((kind) => {
        const rows = open.filter((offer) => (offer.gig.kind ?? 'oddJob') === kind);
        if (rows.length === 0) return null;
        return (
          <Fragment key={kind}>
            <SectionHeading>{kind === 'partTime' ? 'Part-time shifts' : 'Odd jobs'}</SectionHeading>
            <Card>
              {rows.map((offer, index) => (
                <Fragment key={offer.gig.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <GigRow
                    offer={offer}
                    expected={gigPay(offer.gig, player.stats, player.talents)}
                    onPress={() => takeAGig(offer.gig.id)}
                  />
                </Fragment>
              ))}
            </Card>
          </Fragment>
        );
      })}

      {closed.length > 0 ? (
        <>
          <SectionHeading note="not yet">Other work</SectionHeading>
          <Card>
            {closed.map((offer, index) => (
              <Fragment key={offer.gig.id}>
                {index > 0 ? <RowDivider /> : null}
                <GigRow offer={offer} />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.noteText}>
          Choose work that fits your life. It pays when you advance a year, alongside any regular
          job. Taking on too much can make school and the rest of the year harder.
        </Text>
      </View>
    </ScrollView>
  );
}

function GigRow({
  offer,
  expected,
  onPress,
}: {
  offer: GigOffer;
  /** What a year of it would pay THIS character, not the catalog's range. */
  expected?: number;
  onPress?: () => void;
}) {
  const { gig, held, unavailable } = offer;
  return (
    <ListRow
      icon="money"
      title={gig.name}
      subtitle={unavailable ? GIG_UNAVAILABLE_LABELS[unavailable] : gig.blurb}
      value={held ? 'Quit' : unavailable ? undefined : 'Take it'}
      // What it pays and what it costs, before committing — the same promise
      // the activities screen makes.
      meta={
        unavailable
          ? `${gig.ageMin}+`
          : `${gig.hoursPerWeek} h/wk · about $${(expected ?? gig.payLow).toLocaleString('en-US')}/yr before tax`
      }
      affordance={unavailable ? 'none' : 'action'}
      disabled={Boolean(unavailable)}
      onPress={unavailable ? undefined : onPress}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  note: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  noteText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
  },
});
