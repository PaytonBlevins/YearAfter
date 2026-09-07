/**
 * Ticket 0209 — one of your own parents.
 *
 * The mirror of ChildScreen, and deliberately shaped by what it does NOT have.
 * Spec 61 gives every decision to the parent; the child's only verb is asking.
 * So there is no "make them" anything, no meter to grind, and no way to change
 * their mind — there is a list of things you can put to them and a sense of how
 * it usually goes.
 *
 * The odds are shown as a mood rather than a percentage, because a child does
 * not have a calibrated model of their own parents. They have a feeling about
 * whether this is a good day to ask.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { moodLabel, willThey, type ParentRequest } from '@yearafter/parenting';
import { npcAge, type FamilyMember } from '@yearafter/relationships';
import { askableOf, canAsk } from '@yearafter/simulation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { relationshipColor } from './FamilyScreen';
import { colors, spacing, typography } from '../theme/theme';

export function ParentScreen() {
  const { state, askAParent } = useGame();
  const { current } = useNavigation();
  if (!state || !current?.personId) return null;

  const parent = state.family.members.find((member) => member.id === current.personId);
  if (!parent || (parent.role !== 'mother' && parent.role !== 'father')) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState title="Nobody here" body="This person is no longer in the save." />
      </ScrollView>
    );
  }

  const who = parent.role === 'mother' ? 'Mom' : 'Dad';
  const requests = parent.alive ? askableOf(state) : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading>{parent.role === 'mother' ? 'Mother' : 'Father'}</SectionHeading>
      <Card>
        <ListRow
          icon="family"
          title={`${parent.firstName} ${parent.lastName}`}
          subtitle={
            parent.alive ? `${who} · ${npcAge(parent, state.world.year)}` : `${who} · died`
          }
          affordance="none"
          meter={parent.alive ? parent.relationship : undefined}
          meterColor={relationshipColor(parent.relationship)}
        />
      </Card>

      {requests.length > 0 ? (
        <>
          <SectionHeading note="once a year each">What you can ask</SectionHeading>
          <Card>
            {requests.map((request, index) => (
              <Fragment key={request.id}>
                {index > 0 ? <RowDivider /> : null}
                <RequestRow
                  request={request}
                  parent={parent}
                  state={state}
                  onPress={() => askAParent(parent.id, request.id)}
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      <View style={styles.note}>
        <Text style={styles.noteText}>
          {parent.alive
            ? `Whether ${who} says yes is up to ${who === 'Mom' ? 'her' : 'him'}. It depends on how the year has gone, what the family can afford, and how the two of you have been.`
            : `${who} is not here any more. What they did for you stays in the timeline.`}
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * One thing you can ask for.
 *
 * A request already put to this parent this year is disabled and says so,
 * rather than silently failing — the same rule the interaction menu follows.
 * The player is never left pressing something that does nothing.
 */
function RequestRow({
  request,
  parent,
  state,
  onPress,
}: {
  request: ParentRequest;
  parent: FamilyMember;
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  onPress: () => void;
}) {
  const asked = !canAsk(state, parent.id, request.id);
  const chance = willThey(
    request,
    parent,
    state.family,
    state.education.behaviour,
    state.player.age,
  );

  return (
    <ListRow
      title={request.label}
      subtitle={asked ? 'You have already asked this year.' : request.blurb}
      value={asked ? undefined : moodLabel(chance)}
      affordance={asked ? 'none' : 'action'}
      disabled={asked}
      onPress={asked ? undefined : onPress}
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
