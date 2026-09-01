/**
 * Ticket 0206 — one person.
 *
 * What they remember, and the handful of things you can do about it.
 *
 * The memory list is the point of the screen. A relationship number tells the
 * player nothing they can act on; "You told them the thing you had not told
 * anybody. They kept it, and still have" tells them what this friendship IS.
 * Spec 786–795 asks for outcomes explained through context rather than
 * formulas, and spec 771–785 is where the memories come from.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  bondOf,
  chanceOf,
  displayName,
  fullName,
  interactionsFor,
  isCurrent,
  notableMemories,
  type Acquaintance,
} from '@yearafter/social';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { howLong, warmthColor } from './PeopleScreen';
import { colors, spacing, typography } from '../theme/theme';

export function PersonScreen() {
  const { state, interactWith } = useGame();
  const { current } = useNavigation();
  if (!state || !current?.personId) return null;

  const person = state.circle.people.find((candidate) => candidate.id === current.personId);
  if (!person) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState title="Nobody here" body="This person is no longer in the save." />
      </ScrollView>
    );
  }

  const around = isCurrent(person);
  const spentThisYear = state.circle.spokenToAtAge[person.id] === state.player.age;
  const memories = notableMemories(person);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading>{person.kind === 'teacher' ? 'Teacher' : 'Classmate'}</SectionHeading>
      <Card>
        <ListRow
          icon={person.kind === 'teacher' ? 'school' : 'friends'}
          title={fullName(person)}
          subtitle={describe(person, state.player.age)}
          affordance="none"
          meter={person.relationship}
          meterColor={warmthColor(person.relationship)}
        />
      </Card>

      {around ? (
        <>
          <SectionHeading note={spentThisYear ? undefined : 'once a year'}>
            What you can do
          </SectionHeading>
          <Card>
            {/*
              When the year is spent, ONE row saying so. The first version
              disabled all six and repeated "You have already seen them this
              year" six times down the screen, which is the same sentence
              charging the player six lines of reading to learn one thing.
            */}
            {spentThisYear ? (
              <ListRow
                title={`You have already seen ${displayName(person)} this year`}
                subtitle="One thing per person per year. Advance, and come back."
                affordance="none"
                disabled
              />
            ) : (
              interactionsFor(person).map((interaction, index) => (
                <Fragment key={interaction.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <ListRow
                    title={interaction.label}
                    subtitle={interaction.blurb}
                    // The odds, in words. Spec 786-795: enough to make a
                    // decision with, never the formula that produced it.
                    value={oddsLabel(chanceOf(interaction, person, state.player.stats.charisma))}
                    affordance="action"
                    onPress={() => interactWith(person.id, interaction.id)}
                  />
                </Fragment>
              ))
            )}
          </Card>
        </>
      ) : null}

      <SectionHeading note={memories.length > 0 ? undefined : 'nothing yet'}>
        What they remember
      </SectionHeading>
      <Card>
        {memories.length === 0 ? (
          <ListRow
            title="Nothing in particular"
            subtitle="You have been in the same room and not much else."
            affordance="none"
          />
        ) : (
          memories.map((memory, index) => (
            <Fragment key={`${memory.age}-${index}`}>
              {index > 0 ? <RowDivider /> : null}
              <ListRow
                title={memory.text}
                subtitle={`You were ${memory.age}${memory.major ? ' · they have not forgotten' : ''}`}
                affordance="none"
                wrap
              />
            </Fragment>
          ))
        )}
      </Card>

      {!around ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            Not somebody you see any more. They stay here because a childhood you can look back on
            has to include the people who left it.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function describe(person: Acquaintance, playerAge: number): string {
  const bond = bondOf(person);
  if (!isCurrent(person)) return `${bond} · not any more`;
  if (person.kind === 'teacher') return `${person.subject ?? 'Teacher'} · ${bond}`;
  return `${bond} · ${howLong(person, playerAge)}`;
}

/**
 * The odds in words.
 *
 * A percentage would be a formula on screen, which spec 786–795 rules out, and
 * it would also be a lie about how well anybody knows their own chances of a
 * joke landing.
 */
function oddsLabel(chance: number): string {
  if (chance >= 0.85) return 'Safe';
  if (chance >= 0.65) return 'Likely';
  if (chance >= 0.45) return 'Even';
  if (chance >= 0.25) return 'Unlikely';
  return 'Long shot';
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
