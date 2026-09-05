/**
 * Ticket 0204 — school activities.
 *
 * This screen exists because of a specific piece of review feedback. The 0203
 * build asked "which one club?" in a pop-up and allowed exactly one pick,
 * forever. The product owner: "I don't want that. I want to keep workload
 * realistic."
 *
 * So: join as many as you like. Nothing here refuses on the grounds that you are
 * busy, and there is deliberately no hours-remaining bar, no capacity meter and
 * no budget — spec 1824 forbids a workload-budget UI and spec 661 forbids a
 * visible time budget. The consequences of over-committing arrive in the feed as
 * sentences, in the year they happen.
 *
 * Rows that cannot be joined are shown, not hidden, with the reason. "Nobody
 * free to drive you home" is a fact about this character's life, and a menu that
 * quietly drops it teaches the player nothing.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  ACTIVITY_KIND_LABELS,
  type Activity,
  type ActivityKind,
  type SchoolStageId,
} from '@yearafter/content';
import {
  UNAVAILABLE_LABELS,
  activityOffers,
  enrolmentIn,
  isInSchool,
  joinedActivities,
  standingLabelFor,
  type ActivityOffer,
} from '@yearafter/education';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, layout, spacing, typography } from '../theme/theme';

const KIND_ORDER: readonly ActivityKind[] = ['sport', 'arts', 'academic', 'service', 'social'];

export function SchoolActivitiesScreen() {
  const { state, joinActivity, tryOutFor } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const { education, player, family } = state;

  if (!isInSchool(education)) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState
          title="Nothing to sign up for"
          body={
            education.stage === 'preschool'
              ? 'School has not started yet.'
              : 'School is finished. Whatever comes next is not on a clipboard in a gym.'
          }
        />
      </ScrollView>
    );
  }

  const offers = activityOffers(education, {
    age: player.age,
    stage: education.stage as SchoolStageId,
    stats: player.stats,
    talents: player.talents,
    wealth: family.finances.band,
    household: family,
  });

  const joined = offers.filter((offer) => offer.joined);
  const available = offers.filter((offer) => !offer.joined && !offer.unavailable);
  const closed = offers.filter((offer) => !offer.joined && offer.unavailable);
  const totalHours = joinedActivities(education).reduce(
    (sum, activity) => sum + activity.hoursPerWeek,
    0,
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {joined.length > 0 ? (
        <>
          <SectionHeading note={`${joined.length} · ${totalHours} h/wk`}>You are in</SectionHeading>
          <Card>
            {joined.map((offer, index) => (
              <Fragment key={offer.activity.id}>
                {index > 0 ? <RowDivider /> : null}
                {/*
                  Opens rather than quitting in place (0206b). A row you are
                  already in is a place with a season and teammates behind it,
                  and making the whole row a Quit button meant the only thing
                  you could do with something you had joined was leave it.
                */}
                <ActivityRow
                  offer={offer}
                  standing={standingLabelFor(
                    offer.activity,
                    enrolmentIn(education, offer.activity.id)?.standing ?? 50,
                  )}
                  onPress={() =>
                    push({
                      screen: 'activity',
                      title: offer.activity.name,
                      activityId: offer.activity.id,
                    })
                  }
                />
              </Fragment>
            ))}
          </Card>
          <Text style={styles.note}>
            Tap one to see how it is going, put the hours in, or leave. Nothing stops you joining
            more — but a week is only so long, and the year will let you know.
          </Text>
        </>
      ) : null}

      {KIND_ORDER.map((kind) => {
        const rows = available.filter((offer) => offer.activity.kind === kind);
        if (rows.length === 0) return null;
        return (
          <Fragment key={kind}>
            <SectionHeading>{ACTIVITY_KIND_LABELS[kind]}</SectionHeading>
            <Card>
              {rows.map((offer, index) => (
                <Fragment key={offer.activity.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ActivityRow
                    offer={offer}
                    onPress={() =>
                      offer.needsTryout
                        ? tryOutFor(offer.activity.id)
                        : joinActivity(offer.activity.id)
                    }
                  />
                </Fragment>
              ))}
            </Card>
          </Fragment>
        );
      })}

      {closed.length > 0 ? (
        <>
          <SectionHeading note="not open to you">Also at this school</SectionHeading>
          <Card>
            {closed.map((offer, index) => (
              <Fragment key={offer.activity.id}>
                {index > 0 ? <RowDivider /> : null}
                <ActivityRow offer={offer} />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {joined.length === 0 && available.length === 0 ? (
        <EmptyState title="Nothing on offer" body="Not much happens at this school." />
      ) : null}
    </ScrollView>
  );
}

function ActivityRow({
  offer,
  standing,
  onPress,
}: {
  offer: ActivityOffer;
  /** How it is going, in words. Only for something already joined. */
  standing?: string;
  onPress?: () => void;
}) {
  const { activity, joined, unavailable, needsTryout, attemptedThisYear } = offer;
  // Some places you have to earn. The row says which before it is pressed, so
  // "Try out" and "Join" are visibly different promises.
  const blocked = Boolean(unavailable) || attemptedThisYear;
  const action = joined
    ? undefined
    : attemptedThisYear
      ? undefined
      : needsTryout
        ? activity.tryout?.label
        : 'Join';

  return (
    <ListRow
      title={activity.name}
      subtitle={
        joined && standing
          ? standing
          : unavailable
            ? UNAVAILABLE_LABELS[unavailable]
            : attemptedThisYear
              ? 'You already tried this year. Next year.'
              : activity.blurb
      }
      value={action}
      // Ellipsis for the things that act in place (CORE_RULES §8); a chevron
      // for something joined, because that one opens a screen.
      affordance={joined ? 'navigate' : blocked ? 'none' : 'action'}
      disabled={blocked}
      onPress={blocked ? undefined : onPress}
      meta={describeCommitment(activity)}
    />
  );
}

/**
 * The hours and the money, said plainly, before you commit.
 *
 * The cost is named here for the same reason it is named in the feed when it is
 * charged: money that moves without saying why is the bug this whole pass exists
 * to remove.
 */
function describeCommitment(activity: Activity): string {
  const hours = `${activity.hoursPerWeek} h/wk`;
  if (!activity.annualCost) return hours;
  return `${hours} · $${activity.annualCost.toLocaleString('en-US')}/yr`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
  },
});
