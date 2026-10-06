/**
 * Ticket 0308d — the financial pages.
 *
 * A folded newspaper, the way the reference app does it, and one difference
 * that decides whether it is worth a tap: EVERY STORY ON IT IS DERIVED. Its
 * page runs lines like "Bonds To Remain A Safe Haven For Investors", true in
 * every possible year and therefore information in none of them. Ours only
 * prints a story whose condition actually held.
 *
 * TWO HALVES, and the split is the point.
 *
 *   ABOVE THE FOLD — what happened this year, then one line about the reader's
 *   own money, which is the thing a real paper cannot print and the reason
 *   anybody opens this one.
 *
 *   BELOW IT — the standing primer, because this build models three rules a
 *   player cannot discover by tapping: a sector is a shared fate, a beaten-down
 *   price gets pulled back toward its trend, and leaving a bond early costs
 *   12%. A game may keep a secret; it may not charge for one.
 *
 * THE PAGE HOLDS STILL. Nothing here is rolled — the stories are picked by
 * YEAR, so re-rendering cannot reshuffle the paper under somebody reading it,
 * and opening a menu cannot consume randomness a replaying life depends on
 * (CORE_RULES 13.30).
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { briefingFor, PRIMER, PRIMER_LABELS, type Story } from '@yearafter/finance';
import { describeCity } from '@yearafter/content';
import { Card, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, layout, radii, spacing, typography } from '../theme/theme';

export function MagazineScreen() {
  const { state } = useGame();
  if (!state) return null;

  /*
    THE CITY, NOT THE COUNTRY. `describeCity` returns "Denver, CO", and "The
    Denver, CO Ledger" is not a masthead. Taking the part before the comma is
    correct for both shapes it returns, US and otherwise.
  */
  const city = describeCity(state.player.currentLocation.cityId).split(',')[0]!.trim();

  const briefing = briefingFor({
    prices: state.prices,
    market: state.market,
    year: state.world.year,
    city,
    holdings: state.portfolio,
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.paper}>
        <Text style={styles.kicker}>Financial News</Text>
        <Text style={styles.masthead}>{briefing.masthead.toUpperCase()}</Text>
        <View style={styles.rule} />
        <Text style={styles.dateline}>{briefing.dateline}</Text>

        <Text style={styles.footer}>
          The lead describes the economy. Other stories come from this year's price changes, not
          company news. Sector stories group investments; you buy individual holdings, not a sector.
          Averages can hide gains and losses within the group. Check each holding's price and
          history before buying or selling.
        </Text>

        {briefing.stories.map((story, index) => (
          <View key={story.id} style={index === 0 ? styles.leadStory : styles.story}>
            {index > 0 ? <View style={styles.hairline} /> : null}
            <Text style={[index === 0 ? styles.leadText : styles.storyText, toneStyle(story)]}>
              {story.text}
            </Text>
          </View>
        ))}

        {/*
          A QUIET YEAR IS STILL A YEAR, and saying so beats an empty page. This
          cannot happen — the lead always runs — but a page that renders nothing
          when a condition slips reads as the app breaking rather than the
          market resting.
        */}
        {briefing.stories.length === 0 ? (
          <Text style={styles.storyText}>No market stories to show this year.</Text>
        ) : null}

        {briefing.yours ? (
          <>
            <View style={styles.fold} />
            <Text style={styles.yoursLabel}>YOUR PAGE</Text>
            <Text style={styles.yours}>{briefing.yours}</Text>
          </>
        ) : null}
      </View>

      <SectionHeading>What you're looking at</SectionHeading>
      <Card>
        {PRIMER.map((row, index) => (
          <View key={row.kind} style={styles.primerRow}>
            {index > 0 ? <View style={styles.hairline} /> : null}
            <Text style={styles.primerTitle}>{PRIMER_LABELS[row.kind]}</Text>
            <Text style={styles.primerBody}>{row.body}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.footer}>
        Nothing on this page is a forecast. It's a record of the year that just finished, which is
        the only thing anybody actually knows.
      </Text>
    </ScrollView>
  );
}

const toneStyle = (story: Story) =>
  story.tone === 'good'
    ? { color: colors.positive }
    : story.tone === 'bad'
      ? { color: colors.negative }
      : { color: colors.ink };

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },

  /* The folded page itself. Warmer than the rest of the app on purpose — this
     is an object in the world, not a screen of the game. */
  paper: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  kicker: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    letterSpacing: 2,
    fontWeight: typography.weights.semibold,
    color: colors.inkFaint,
  },
  masthead: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  rule: {
    height: 2,
    alignSelf: 'stretch',
    backgroundColor: colors.ink,
    marginTop: spacing.sm,
    opacity: 0.8,
  },
  dateline: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  leadStory: { alignSelf: 'stretch', marginTop: spacing.lg },
  story: { alignSelf: 'stretch' },
  leadText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  storyText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  hairline: {
    height: layout.hairlineWidth,
    backgroundColor: colors.hairline,
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },

  fold: {
    height: layout.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.ink,
    opacity: 0.35,
    marginTop: spacing.lg,
  },
  yoursLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    letterSpacing: 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.inkFaint,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  yours: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.ink,
    marginTop: spacing.xs,
  },

  primerRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  primerTitle: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginTop: spacing.md,
  },
  primerBody: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.inkMuted,
    marginTop: 2,
  },

  footer: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    color: colors.inkFaint,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
});
