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
 * player will see is what their parents do with the money, which is Ticket 0209.
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
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

export function FamilyScreen() {
  const { state } = useGame();
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

  const parentRows = roster.filter((member) => member.role !== 'sibling');
  const siblingRows = roster.filter((member) => member.role === 'sibling');

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
            <MemberRow member={member} worldYear={world.year} />
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

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Talking, arguing and asking for help arrive with the relationship actions. What your
          parents decide on their own — activities, money, housing — is Ticket 0209.
        </Text>
      </View>
    </ScrollView>
  );
}

function MemberRow({ member, worldYear }: { member: FamilyMember; worldYear: number }) {
  const age = npcAge(member, worldYear);
  const role =
    member.role === 'sibling' ? (member.sex === 'male' ? 'Brother' : 'Sister') : ROLE[member.role];

  return (
    <ListRow
      icon={member.role === 'sibling' ? 'friends' : 'family'}
      title={`${member.firstName} ${member.lastName}`}
      subtitle={member.alive ? `${role} · ${age}` : `${role} · died`}
      affordance="none"
      disabled={!member.alive}
      meter={member.alive ? member.relationship : undefined}
      meterColor={relationshipColor(member.relationship)}
    />
  );
}

const ROLE: Record<'mother' | 'father', string> = { mother: 'Mother', father: 'Father' };

/**
 * Colour carries the reading so the player does not have to interpret a number.
 * The bar is the only thing shown; spec 786–795 asks for enough for status and a
 * decision, not a formula.
 */
function relationshipColor(value: number): string {
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
