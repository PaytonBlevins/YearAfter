/**
 * Ticket 0206b — one team or club.
 *
 * Review: "Please monitor sports team performance and have buttons to practice
 * and raise performance and interact with peers."
 *
 * Three things, in the order a player cares about them: how you are doing,
 * what you can do about it, and who else is there. The standing is never a
 * number — spec 786–795 — it is "In the starting side" or "Mostly on the
 * bench", which is what somebody would actually say about their season.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { findActivity } from '@yearafter/content';
import {
  PRACTICE_SESSIONS,
  enrolmentIn,
  practiceLeft,
  standingBand,
  standingLabelFor,
} from '@yearafter/education';
import { bondOf, displayName, isCurrent } from '@yearafter/social';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { warmthColor } from './PeopleScreen';
import { colors, spacing, typography } from '../theme/theme';

export function ActivityScreen() {
  const { state, practiseAt, leaveActivity } = useGame();
  const { current, pop, push } = useNavigation();
  if (!state || !current?.activityId) return null;

  const activity = findActivity(current.activityId);
  const entry = enrolmentIn(state.education, current.activityId);
  if (!activity || !entry) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState title="Not in this" body="You are not in this any more." />
      </ScrollView>
    );
  }

  const left = practiceLeft(entry, state.player.age);
  const years = state.player.age - entry.joinedAtAge;
  const teammates = state.circle.people.filter(
    (person) => person.viaActivityId === activity.id && isCurrent(person),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading>How it is going</SectionHeading>
      <Card>
        <ListRow
          icon="social"
          title={standingLabelFor(activity, entry.standing)}
          subtitle={
            years <= 0
              ? 'First year in it'
              : `${entry.seasons} season${entry.seasons === 1 ? '' : 's'} in`
          }
          affordance="none"
          meter={entry.standing}
          meterColor={standingBand(entry.standing) === 'benched' ? colors.caution : colors.positive}
        />
      </Card>

      <SectionHeading
        note={left > 0 ? `${left} of ${PRACTICE_SESSIONS} left` : 'done for the year'}
      >
        Practice
      </SectionHeading>
      <Card>
        {/*
          Unlike Study Harder this cannot fail. Putting the hours in at something
          always moves you a little; what varies is how much, which is discipline
          and willpower and how good you already are. Three sessions an activity
          a year — spread across five clubs it is three afternoons and nothing
          changes anywhere, which is the actual trade.
        */}
        <ListRow
          icon="school"
          title="Put the hours in"
          subtitle={
            left > 0
              ? 'An afternoon at it. Always worth something.'
              : 'You have done what you can with this year.'
          }
          affordance={left > 0 ? 'action' : 'none'}
          disabled={left === 0}
          onPress={left > 0 ? () => practiseAt(activity.id) : undefined}
        />
      </Card>

      <SectionHeading note={teammates.length > 0 ? undefined : 'nobody yet'}>
        Who else is there
      </SectionHeading>
      <Card>
        {teammates.length === 0 ? (
          <ListRow
            title="Nobody you know by name"
            subtitle="You turn up, you do it, you go home."
            affordance="none"
          />
        ) : (
          teammates.map((person, index) => (
            <Fragment key={person.id}>
              {index > 0 ? <RowDivider /> : null}
              <ListRow
                icon="friends"
                title={displayName(person)}
                subtitle={bondOf(person)}
                affordance="navigate"
                onPress={() =>
                  push({ screen: 'person', title: displayName(person), personId: person.id })
                }
                meter={person.relationship}
                meterColor={warmthColor(person.relationship)}
              />
            </Fragment>
          ))
        )}
      </Card>

      <SectionHeading>Or</SectionHeading>
      <Card>
        <ListRow
          title={`Quit ${activity.name.toLowerCase()}`}
          subtitle="The hours go back. So does everything you built here."
          affordance="action"
          onPress={() => {
            leaveActivity(activity.id);
            pop();
          }}
        />
      </Card>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          {activity.hoursPerWeek} hours a week, every week. Practice is on top of that.
        </Text>
      </View>
    </ScrollView>
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
