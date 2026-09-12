/**
 * Ticket 0305 — where you stand with a lender.
 *
 * THERE IS NO NUMBER ON THIS SCREEN and there is not going to be one. Spec 1685
 * rules out a credit-bureau simulation, spec 1867 rules out a generic risk
 * score, and spec 25 rules out account age and past defaults as modelled
 * inputs. What is left is a standing — a word — and the reasons behind it.
 *
 * THE REASONS ARE THE POINT. A band with nothing under it is exactly the opaque
 * score the spec dislikes, and worse, it gives a player nothing to act on: they
 * would know they were "Fair" and have no idea what would change it. So the
 * screen is two short lists, in the player's own terms, ordered by how much
 * each one actually moved the standing.
 *
 * It is also the reason this screen exists rather than a single row on the
 * Finances dashboard. Spec 19 puts "credit" on that dashboard and a row can
 * carry the word; it cannot carry the why.
 *
 * NOT HERE, BY NAME: no score, no history timeline, no opened dates, no list of
 * accounts (spec 28 removes opened date and payment-history UI explicitly), and
 * no advice. 0306's cards and 0307's loans are where a player does something
 * about any of this.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { standingFor } from '@yearafter/simulation';
import { Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

export function CreditScreen() {
  const { state } = useGame();
  if (!state) return null;

  const report = standingFor(state);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <ListRow title={report.label} subtitle={report.summary} affordance="none" accent wrap />
      </Card>

      {/*
        A character with no standing gets THE SENTENCE ABOVE and nothing else.

        There was an `EmptyState` here reading "Nothing on file / Credit starts
        when money starts moving", directly under a card already reading "None
        yet / Nobody lends to somebody your age" — two empty states, one screen,
        same meaning. Reading the built screen caught it, which is the second
        time in two tickets: 0304 had four rows repeating their own heading.

        The standing card is never empty, so it can always carry this. Two
        headed-but-empty lists would be a screen explaining an absence at
        length — 0211b's complaint about the Doctor's "How you are" section,
        one screen over.
      */}
      {report.helping.length > 0 ? (
        <>
          <SectionHeading>In your favour</SectionHeading>
          <Card>
            {report.helping.map((line, index) => (
              <Fragment key={line}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow title={line} affordance="none" compact wrap />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {report.hurting.length > 0 ? (
        <>
          <SectionHeading>Against you</SectionHeading>
          <Card>
            {report.hurting.map((line, index) => (
              <Fragment key={line}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow title={line} affordance="none" compact wrap />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {/*
        One line about what this is FOR, because a standing with no consumer is
        a stat. Cards and loans arrive in 0306 and 0307; saying so is the same
        honesty the dashboard's "Not built yet" rows use, and it stops a player
        hunting for a screen that does not exist.
      */}
      <Text style={styles.note}>Cards and loans aren’t built yet. This is what they’ll read.</Text>
    </ScrollView>
  );
}

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
