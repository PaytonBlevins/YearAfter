/**
 * Ticket 0206 — Friends.
 *
 * Reached from Relationships, which contains only Family and Friends
 * (spec 839–848). Review asked for this directly: "I also should be able to
 * interact with teachers and classmates."
 *
 * Three sections, in the order a childhood actually cares about them: the
 * people you chose, the people you were put in a room with, and the adults.
 * Everybody who has left gets a fourth section rather than being deleted —
 * spec 771–785 keeps reconciliation possible, and a childhood you can look back
 * on has to include the people who left it.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { bondOf, displayName, isCurrent, isFriend, type Acquaintance } from '@yearafter/social';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

export function PeopleScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const people = state.circle.people;
  const current = people.filter(isCurrent);
  const friends = current.filter(isFriend);
  const classmates = current.filter((person) => person.kind === 'peer' && !isFriend(person));
  const teachers = current.filter((person) => person.kind === 'teacher');
  const past = people.filter((person) => !isCurrent(person)).reverse();

  if (people.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState
          title="Nobody yet"
          body="School is where this starts. Come back once there is a class to be in."
        />
      </ScrollView>
    );
  }

  const open = (person: Acquaintance) =>
    push({ screen: 'person', title: displayName(person), personId: person.id });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading note={friends.length > 0 ? `${friends.length}` : 'none yet'}>
        Friends
      </SectionHeading>
      <Card>
        {friends.length === 0 ? (
          <ListRow
            title="Nobody yet"
            subtitle="Friendship is something you do, not something you have."
            affordance="none"
          />
        ) : (
          friends.map((person, index) => (
            <Fragment key={person.id}>
              {index > 0 ? <RowDivider /> : null}
              <PersonRow
                person={person}
                playerAge={state.player.age}
                onPress={() => open(person)}
              />
            </Fragment>
          ))
        )}
      </Card>

      {classmates.length > 0 ? (
        <>
          <SectionHeading note="in your year">Class</SectionHeading>
          <Card>
            {classmates.map((person, index) => (
              <Fragment key={person.id}>
                {index > 0 ? <RowDivider /> : null}
                <PersonRow
                  person={person}
                  playerAge={state.player.age}
                  onPress={() => open(person)}
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {teachers.length > 0 ? (
        <>
          <SectionHeading>Teachers</SectionHeading>
          <Card>
            {teachers.map((person, index) => (
              <Fragment key={person.id}>
                {index > 0 ? <RowDivider /> : null}
                <PersonRow
                  person={person}
                  playerAge={state.player.age}
                  onPress={() => open(person)}
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {past.length > 0 ? (
        <>
          <SectionHeading note={`${past.length}`}>People you knew</SectionHeading>
          <Card>
            {past.slice(0, 12).map((person, index) => (
              <Fragment key={person.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={displayName(person)}
                  subtitle={endedLabel(person)}
                  affordance="none"
                  disabled
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          You can do one thing with each person a year. People you stop seeing drift, and the ones
          who last are the ones you kept up.
        </Text>
      </View>
    </ScrollView>
  );
}

function PersonRow({
  person,
  playerAge,
  onPress,
}: {
  person: Acquaintance;
  playerAge: number;
  onPress: () => void;
}) {
  // Phrased exactly as the person's own screen phrases it. "Known since 5" here
  // and "8 years" there are two readings of one fact, and a player who notices
  // has to work out whether they mean the same thing.
  const subtitle =
    person.kind === 'teacher'
      ? `${person.subject ?? 'Teacher'} · ${bondOf(person)}`
      : `${bondOf(person)} · ${howLong(person, playerAge)}`;

  return (
    <ListRow
      icon={person.kind === 'teacher' ? 'school' : 'friends'}
      title={displayName(person)}
      subtitle={subtitle}
      affordance="navigate"
      onPress={onPress}
      meter={person.relationship}
      meterColor={warmthColor(person.relationship)}
    />
  );
}

/** How long they have known each other, in words. Shared with PersonScreen. */
export function howLong(person: Acquaintance, playerAge: number): string {
  const years = playerAge - person.metAtAge;
  if (years <= 0) return 'new this year';
  return years === 1 ? 'a year' : `${years} years`;
}

function endedLabel(person: Acquaintance): string {
  const how =
    person.endedBecause === 'fell out'
      ? 'Fell out'
      : person.endedBecause === 'drifted'
        ? 'Lost touch'
        : person.endedBecause === 'moved away'
          ? 'Moved away'
          : 'Different school';
  return `${how} · you were ${person.endedAtAge}`;
}

/**
 * Colour carries the reading, so the player never has to interpret the number.
 * Same scale as the Family screen, deliberately: one relationship bar, one
 * meaning, wherever it appears.
 */
export function warmthColor(value: number): string {
  if (value >= 70) return colors.positive;
  if (value >= 40) return colors.caution;
  return colors.negative;
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
