/**
 * Ticket 0206b — odd jobs.
 *
 * Review: "I also want to be able to perform freelance jobs at appropriate
 * ages." The age gate is the whole point: a lemonade stand at eight, a paper
 * round at twelve, a kitchen at sixteen. Rows you are too young for are SHOWN,
 * with the reason, because "not at your age" is a fact about a childhood and
 * hiding it would leave the screen looking empty for no visible cause.
 *
 * This is not employment. Ticket 0210 builds real jobs; these are the things a
 * child can actually do, and the money they pay is the first money in this game
 * that is genuinely the player's.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  GIG_UNAVAILABLE_LABELS,
  MAX_GIGS,
  gigOffers,
  gigPay,
  type GigOffer,
} from '@yearafter/education';
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
          body="Give it a few years. Somebody will always need their dog walking."
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
          <SectionHeading note={`${held.length} of ${MAX_GIGS}`}>You are doing</SectionHeading>
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

      {open.length > 0 ? (
        <>
          <SectionHeading>Going</SectionHeading>
          <Card>
            {open.map((offer, index) => (
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
        </>
      ) : null}

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
          Real jobs — a salary, a boss, somewhere to be promoted to — arrive with Ticket 0210. These
          are the things you can do before then.
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
          : `${gig.hoursPerWeek} h/wk · about $${(expected ?? gig.payLow).toLocaleString('en-US')}/yr`
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
