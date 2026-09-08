/**
 * Ticket 0210 — the people at work.
 *
 * This screen exists because spec 1305–1309 is emphatic about where these
 * people are NOT: "The dedicated Relationships screen contains only Family and
 * Friends. Professional relationships stay in their own worlds." A colleague is
 * reached from Career and appears nowhere else.
 *
 * They are ordinary people from the social model, not a separate kind of thing
 * — so a colleague can be talked to, argued with and asked for help exactly
 * like anybody else, and if the friendship outlives the job it simply carries
 * on. That is why there is nothing here that removes them when the job ends:
 * losing touch is already what `driftPerson` does to anybody you stop seeing.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { isCurrent } from '@yearafter/social';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { relationshipColor } from './FamilyScreen';
import { colors, spacing, typography } from '../theme/theme';

export function ColleaguesScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const colleagues = state.circle.people.filter(
    (person) => isCurrent(person) && person.context === 'work',
  );

  if (colleagues.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState
          title="Nobody yet"
          body="You have not got past first names with anybody at work. It takes a while, and it does not happen every year."
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
      <SectionHeading note={String(colleagues.length)}>From work</SectionHeading>
      <Card>
        {colleagues.map((person, index) => (
          <Fragment key={person.id}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              icon="social"
              title={`${person.firstName} ${person.lastName}`}
              subtitle={
                person.lastContactAge === state.player.age
                  ? 'Seen this year'
                  : 'You have not spoken in a while'
              }
              affordance="navigate"
              meter={person.relationship}
              meterColor={relationshipColor(person.relationship)}
              onPress={() =>
                push({ screen: 'person', title: person.firstName, personId: person.id })
              }
            />
          </Fragment>
        ))}
      </Card>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          People from work stay here rather than on the Relationships screen. If one of them becomes
          an actual friend, that is where they will turn up.
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
