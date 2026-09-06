/**
 * Ticket 0208 — one child.
 *
 * Spec 175: "open a child to see that child's monthly cost." Contextual, and
 * only here — spec 170 rules out a full expense breakdown, so what a child
 * costs is a fact you find by opening the child, the same way a car's cost is a
 * fact you find by opening the car.
 *
 * Spec 61 decides the rest of the screen by subtraction. There is no pay-for-
 * activities row, no discipline row, no fund-college row, no buy-a-vehicle row
 * — all six were removed from the player-as-parent by name. What is left is
 * answering what they asked, and Kick Out of House once they are grown.
 *
 * That leaves a screen that is mostly not buttons, which is right. Spec 1813
 * wants this lightweight, and a child is somebody you have rather than
 * something you operate.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '@yearafter/core';
import { CHILD_ASKS, DISTANT, PARENT_AGE, monthlyCostOf } from '@yearafter/parenting';
import { npcAge, type FamilyMember } from '@yearafter/relationships';
import { openAskOf } from '@yearafter/simulation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { relationshipColor } from './FamilyScreen';
import { colors, spacing, typography } from '../theme/theme';

export function ChildScreen() {
  const { state, answerChildAsk, kickChildOut } = useGame();
  const { current } = useNavigation();
  if (!state || !current?.personId) return null;

  const child = state.family.members.find((member) => member.id === current.personId);
  if (!child || child.role !== 'child') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState title="Nobody here" body="This person is no longer in the save." />
      </ScrollView>
    );
  }

  const age = npcAge(child, state.world.year);
  const grown = age >= PARENT_AGE;
  const ask = openAskOf(state);
  const theirAsk = ask?.childId === child.id ? ask : undefined;
  const wanted = theirAsk ? CHILD_ASKS.find((entry) => entry.id === theirAsk.askId) : undefined;
  const affordable = wanted ? Number(state.player.cash) >= wanted.cost : false;
  const them = child.sex === 'female' ? 'her' : 'him';
  const they = child.sex === 'female' ? 'She' : 'He';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading>{child.sex === 'female' ? 'Daughter' : 'Son'}</SectionHeading>
      <Card>
        <ListRow
          icon="family"
          title={`${child.firstName} ${child.lastName}`}
          subtitle={describe(child, age)}
          affordance="none"
          meter={child.relationship}
          meterColor={relationshipColor(child.relationship)}
        />
      </Card>

      {/* Spec 175. The number lives here and nowhere else. */}
      {!grown ? (
        <>
          <SectionHeading>What they cost</SectionHeading>
          <Card>
            <ListRow
              title={`${formatMoney(monthlyCostOf(age))} a month`}
              subtitle={
                age >= 13
                  ? 'Teenagers cost more. Everybody who has one knows this.'
                  : 'Food, clothes, school, and the rest of it.'
              }
              affordance="none"
            />
          </Card>
        </>
      ) : null}

      {/*
        Spec 61 and 1147: the one parenting decision the player makes. Shown
        only while there is actually a question open — a permanent Yes/No pair
        with nothing attached would be a control panel.
      */}
      {wanted ? (
        <>
          <SectionHeading note="they asked this year">What to say</SectionHeading>
          <Card>
            <ListRow
              title="Say yes"
              subtitle={
                affordable
                  ? `${formatMoney(centsToMoney(wanted.cost))} for the year.`
                  : `You cannot afford the ${formatMoney(centsToMoney(wanted.cost))}.`
              }
              affordance={affordable ? 'action' : 'none'}
              disabled={!affordable}
              onPress={affordable ? () => answerChildAsk(true) : undefined}
            />
            <RowDivider />
            <ListRow
              title="Say no"
              subtitle={`Tell ${child.firstName} it is not happening.`}
              affordance="action"
              onPress={() => answerChildAsk(false)}
            />
          </Card>
        </>
      ) : null}

      {/*
        The one thing spec 61 ADDS to a parent's menu, and the only irreversible
        one on this screen. Absent entirely until they are legally an adult.
      */}
      {grown ? (
        <>
          <SectionHeading note="there is no undoing this">Grown up</SectionHeading>
          <Card>
            <ListRow
              title="Tell them to move out"
              subtitle={`${child.firstName} is ${age}. ${they} would have to find somewhere.`}
              affordance="action"
              onPress={() => kickChildOut(child.id)}
            />
          </Card>
        </>
      ) : null}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          {child.relationship < DISTANT
            ? `You and ${child.firstName} have got out of the habit of talking. Saying yes when ${them === 'her' ? 'she' : 'he'} asks for something is most of how that comes back.`
            : `Most of raising ${them} does not need you to press anything. Turning up when ${them === 'her' ? 'she' : 'he'} asks is the part that does.`}
        </Text>
      </View>
    </ScrollView>
  );
}

function describe(child: FamilyMember, age: number): string {
  const how = child.arrivedBy === 'adoption' ? 'adopted' : 'born';
  const when =
    child.arrivedWhenPlayerWas !== undefined ? ` when you were ${child.arrivedWhenPlayerWas}` : '';
  if (age >= PARENT_AGE) return `${age} · grown up`;
  return `${age} · ${how}${when}`;
}

/** The catalog holds cents; `formatMoney` takes the branded type. */
const centsToMoney = (value: number) => value as unknown as Parameters<typeof formatMoney>[0];

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
