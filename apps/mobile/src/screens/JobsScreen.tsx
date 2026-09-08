/**
 * Ticket 0210 — what is going this year.
 *
 * Spec 1336 decides the shape of this screen more than anything else: "Do not
 * make inventories so large that search/filtering is necessary. Use curated
 * inventories, contextual gating, and yearly refreshes instead." There are
 * forty-nine jobs in the catalog and the player never sees a list of
 * forty-nine. They see six that are going, they refresh every year, and every
 * one of them is something this character could plausibly get.
 *
 * Spec 97 removes Workload and Travel from job listings and spec 104 removes
 * Quota, so a listing is a title, a salary, one sentence, and the odds.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { oddsLabel, type Job } from '@yearafter/careers';
import { chanceOf, openings } from '@yearafter/simulation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

/** A salary, at the width a row has for it. */
export const salaryLabel = (pay: number): string =>
  pay >= 100_000 ? `$${Math.round(pay / 1000)}k` : `$${(pay / 1000).toFixed(0)}k`;

export function JobsScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const listings = openings(state);
  const appliedThisYear =
    state.employment.appliedAtAge === state.player.age ? state.employment.appliedTo : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {listings.length === 0 ? (
        <EmptyState
          title="Nothing going"
          body="Nobody is hiring anybody your age right now. Come back next year."
        />
      ) : (
        <>
          <SectionHeading note="new every year">Openings</SectionHeading>
          <Card>
            {listings.map((job, index) => (
              <Fragment key={String(job.id)}>
                {index > 0 ? <RowDivider /> : null}
                {/*
                  Opens the job, never applies for it. Review: "when I click on
                  a job, it automatically hires me. That should not be the
                  case." A tap that commits a decision with no confirmation is
                  not a decision.
                */}
                <JobRow
                  job={job}
                  chance={chanceOf(state, job)}
                  applied={appliedThisYear.includes(String(job.id))}
                  onPress={() =>
                    push({ screen: 'jobOffer', title: job.title, jobId: String(job.id) })
                  }
                />
              </Fragment>
            ))}
          </Card>

          <View style={styles.note}>
            <Text style={styles.noteText}>
              Open one to see what it pays, what it needs and what comes with it. One
              application each per year.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

/**
 * One listing.
 *
 * An application already sent this year is disabled and says so, rather than
 * silently failing — the same rule every other menu in the game follows, and
 * the reason is the same: a player is never left pressing something that does
 * nothing.
 */
function JobRow({
  job,
  chance,
  applied,
  onPress,
}: {
  job: Job;
  chance: number;
  applied: boolean;
  onPress: () => void;
}) {
  //
  // Salary and odds are STACKED, not joined with a separator. Joined, they made
  // a value column so wide that every title and every blurb on the screen
  // clipped — a screenshot of the built app read "Commission sa…" over "Small
  // base. The r…" on all six rows. The 0209 blurb-width lesson in a new place,
  // exactly as CORE_RULES 13.23 says a scoped rule leaves it.
  return (
    <ListRow
      icon="career"
      title={job.title}
      subtitle={applied ? 'Your application is in.' : job.blurb}
      value={salaryLabel(job.pay)}
      {...(applied ? {} : { meta: oddsLabel(chance) })}
      affordance={applied ? 'none' : 'navigate'}
      disabled={applied}
      onPress={applied ? undefined : onPress}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  note: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  noteText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
  },
});
