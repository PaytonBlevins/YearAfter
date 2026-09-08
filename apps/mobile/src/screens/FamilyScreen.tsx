/**
 * Ticket 0202 — Family.
 *
 * Reached from Relationships, which contains only Family and Friends
 * (spec 839–848). Everyone the player is related to, how they stand, and
 * nothing else.
 *
 * What is deliberately NOT here: the household's wealth band and income. Those
 * exist (spec 0202 requires them) but they are backend — a child does not read
 * the family books, and spec 22 removed lifestyle levels precisely so wealth is
 * something the player *experiences* rather than a number they manage. What the
 * player will see is what their parents do with the money (Ticket 0209).
 *
 * Per-person interactions — talk, ask for money, argue — are later tickets. This
 * screen is the roster.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Fragment } from 'react';
import {
  npcAge,
  orderedMembers,
  parents,
  siblings,
  type FamilyMember,
} from '@yearafter/relationships';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { canBecomeParent, isWaiting, triedThisYear } from '@yearafter/parenting';
import { canAdoptNow, canTryForBaby } from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

export function FamilyScreen() {
  const { state, tryForABaby, startAdoption } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const { family, world } = state;
  const roster = orderedMembers(family);

  if (roster.length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState
          title="No family on record"
          body="This character was created before families existed in the game."
        />
      </ScrollView>
    );
  }

  // Named roles, not "everything that is not a sibling". Ticket 0208 added a
  // fourth role and a negative filter would have listed the player's children
  // under Parents.
  const parentRows = roster.filter(
    (member) => member.role === 'mother' || member.role === 'father',
  );
  const siblingRows = roster.filter((member) => member.role === 'sibling');
  const childRows = roster.filter((member) => member.role === 'child');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading note={parents(family).length === 1 ? 'single parent' : undefined}>
        Parents
      </SectionHeading>
      <Card>
        {parentRows.map((member, index) => (
          <Fragment key={member.id}>
            {index > 0 ? <RowDivider /> : null}
            <MemberRow
              member={member}
              worldYear={world.year}
              onPress={() =>
                // "Mom", not "Yue". A child does not call their mother by her
                // first name (event-writing-rules 5), and the ask replies on
                // the screen this opens have followed that since 0209 — a
                // screenshot of the built app was headed "Yue" above a page
                // whose every line said Mom. The row below still shows the full
                // name, because a child does know it.
                push({
                  screen: 'parent',
                  title: member.role === 'mother' ? 'Mom' : 'Dad',
                  personId: member.id,
                })
              }
            />
          </Fragment>
        ))}
      </Card>

      {siblingRows.length > 0 ? (
        <>
          <SectionHeading note={`${siblings(family).length}`}>Siblings</SectionHeading>
          <Card>
            {siblingRows.map((member, index) => (
              <Fragment key={member.id}>
                {index > 0 ? <RowDivider /> : null}
                <MemberRow member={member} worldYear={world.year} />
              </Fragment>
            ))}
          </Card>
        </>
      ) : (
        <>
          <SectionHeading>Siblings</SectionHeading>
          <Card>
            <ListRow title="Only child" affordance="none" />
          </Card>
        </>
      )}

      {/*
        Ticket 0208. Starting a family. Absent below eighteen — the same hard
        age gate romance uses, and the row is not there rather than greyed out.
      */}
      {canBecomeParent(state.player.age) ? (
        <>
          <SectionHeading note={state.parenting.pregnancy ? 'expecting' : undefined}>
            Starting a family
          </SectionHeading>
          <Card>
            {state.parenting.pregnancy ? (
              <ListRow title="A baby is on the way" subtitle="Due next year." affordance="none" />
            ) : (
              <ListRow
                title="Try for a baby"
                subtitle={
                  canTryForBaby(state)
                    ? triedThisYear(state.parenting, state.player.age)
                      ? 'You have tried this year.'
                      : 'It may take a few years. It may not happen.'
                    : 'You would need to be with somebody.'
                }
                affordance={
                  canTryForBaby(state) && !triedThisYear(state.parenting, state.player.age)
                    ? 'action'
                    : 'none'
                }
                disabled={!canTryForBaby(state) || triedThisYear(state.parenting, state.player.age)}
                onPress={
                  canTryForBaby(state) && !triedThisYear(state.parenting, state.player.age)
                    ? tryForABaby
                    : undefined
                }
              />
            )}
            <RowDivider />
            <ListRow
              title={isWaiting(state.parenting.adoption) ? 'On the adoption list' : 'Adopt a child'}
              subtitle={adoptionLine(state)}
              affordance={canStartAdoption(state) ? 'action' : 'none'}
              disabled={!canStartAdoption(state)}
              onPress={canStartAdoption(state) ? startAdoption : undefined}
            />
          </Card>
        </>
      ) : null}

      {/*
        Only shown once there are any — an empty "Children" heading
        in front of a fourteen-year-old is a suggestion, not information.
      */}
      {childRows.length > 0 ? (
        <>
          <SectionHeading note={`${childRows.length}`}>Children</SectionHeading>
          <Card>
            {childRows.map((member, index) => (
              <Fragment key={member.id}>
                {index > 0 ? <RowDivider /> : null}
                <MemberRow
                  member={member}
                  worldYear={world.year}
                  onPress={() =>
                    push({ screen: 'child', title: member.firstName, personId: member.id })
                  }
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      <View style={styles.note}>
        {/*
          This read "…is Ticket 0209" until 0209 shipped, and a ticket number in
          player-facing copy is exactly what spec 1247-1263 forbids: a note to a
          developer that a player reads as the game talking to somebody else.
          Found on a screenshot of the built app, not by a test.
        */}
        <Text style={styles.noteText}>
          Open a parent to ask them for something. What they say is theirs to decide, and they do
          things you never asked for either way.
        </Text>
      </View>
    </ScrollView>
  );
}

function MemberRow({
  member,
  worldYear,
  onPress,
}: {
  member: FamilyMember;
  worldYear: number;
  onPress?: () => void;
}) {
  const age = npcAge(member, worldYear);
  const role = roleLabel(member);

  return (
    <ListRow
      icon={member.role === 'sibling' ? 'friends' : 'family'}
      title={`${member.firstName} ${member.lastName}`}
      subtitle={member.alive ? `${role} · ${age}` : `${role} · died`}
      affordance={onPress && member.alive ? 'navigate' : 'none'}
      disabled={!member.alive}
      onPress={member.alive ? onPress : undefined}
      meter={member.alive ? member.relationship : undefined}
      meterColor={relationshipColor(member.relationship)}
    />
  );
}

/** What this person is to the player, in the word a person would use. */
function roleLabel(member: FamilyMember): string {
  const female = member.sex === 'female';
  switch (member.role) {
    case 'sibling':
      return female ? 'Sister' : 'Brother';
    case 'child':
      return female ? 'Daughter' : 'Son';
    case 'mother':
      return 'Mother';
    case 'father':
      return 'Father';
  }
}

/**
 * Colour carries the reading so the player does not have to interpret a number.
 * The bar is the only thing shown; spec 786–795 asks for enough for status and a
 * decision, not a formula.
 */
export function relationshipColor(value: number): string {
  if (value >= 70) return colors.positive;
  if (value >= 40) return colors.caution;
  return colors.negative;
}

/** Whether the Adopt row does anything if pressed. */
function canStartAdoption(state: NonNullable<ReturnType<typeof useGame>['state']>): boolean {
  return canAdoptNow(state) && !isWaiting(state.parenting.adoption);
}

function adoptionLine(state: NonNullable<ReturnType<typeof useGame>['state']>): string {
  if (isWaiting(state.parenting.adoption)) return 'Applied. Now it is a matter of waiting.';
  return 'Takes years, and does not need a partner.';
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
