/**
 * Ticket 0210b — going to college.
 *
 * Review: *"when you graduate from highschool, there is no college or post
 * graduate options. Those are Necessary!"*
 *
 * Spec 1821 — "major + Study Harder is generally enough" — decides the whole
 * shape of this screen. It is a list of subjects and a note about the money.
 * There is no application form, no essay, no acceptance-rate table and no
 * college ranking, because spec 1822 and section 79 remove test performance and
 * school quality from admission by name.
 *
 * The money note is not decoration. Measured, a player who simply pressed
 * "apply" at eighteen without knowing to ask their parents first was blocked by
 * cost in 200 of 200 lives, and the only thing they were told was "You cannot
 * cover the first year." A path whose entrance is a menu the player has not
 * thought to open is not a path, so this screen says out loud where the money
 * comes from.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { EDUCATION_LABELS, levelOf, type Major } from '@yearafter/education';
import {
  admissionOdds,
  cannotEnrol,
  collegeSupportOf,
  majorsAvailable,
  nextDegreeFor,
  outOfPocket,
  tuitionDue,
  COLLEGE_ERROR_LABELS,
} from '@yearafter/simulation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`;

/** The odds in words. A player does not know their own acceptance rate. */
function chanceLabel(chance: number): string {
  if (chance >= 0.82) return 'You will get in';
  if (chance >= 0.66) return 'Likely';
  if (chance >= 0.48) return 'Even odds';
  if (chance >= 0.3) return 'A reach';
  return 'A long shot';
}

export function CollegeScreen() {
  const { state, applyToStudy } = useGame();
  const { pop } = useNavigation();
  if (!state) return null;

  const next = nextDegreeFor(state);
  const blocked = cannotEnrol(state);
  const support = collegeSupportOf(state);
  const owed = outOfPocket(state);
  const cash = Math.floor(Number(state.player.cash) / 100);
  const held = levelOf(state.education.credentials);

  if (!next) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState
          title={held === 'none' ? 'They want a diploma first' : 'Nothing left to study'}
          body={
            held === 'none'
              ? 'You left school before finishing, and every program here wants that first.'
              : `You already hold a ${EDUCATION_LABELS[held].toLowerCase()}. There is nothing further on offer.`
          }
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
      {/*
        The money FIRST, deliberately. It is the thing that decides whether any
        of the rows below can be pressed, and burying it under the subject list
        is how a player ends up tapping eight greyed-out rows in a row.
      */}
      <SectionHeading>What it costs</SectionHeading>
      <Card>
        {/*
          Ticket 0210c removed the subtitle here. "A year of college." under a
          row headed Tuition, on a screen headed What it costs, inside a college
          application — four ways of saying college, three of them for nothing.
        */}
        <ListRow title="Tuition" meta="a year" value={money(tuitionDue(state))} affordance="none" />
        {support > 0 ? (
          <>
            <RowDivider />
            <ListRow
              title="Your parents are covering"
              subtitle="Every year you are studying, not just the first."
              value={`−${money(support)}`}
              affordance="none"
            />
          </>
        ) : null}
        <RowDivider />
        <ListRow
          title="You need to find"
          subtitle={
            owed <= cash
              ? `You have ${money(cash)}. That covers it.`
              : support > 0
                ? `You have ${money(cash)}. A year of work would close that.`
                : 'Ask your parents first — most of this is theirs to cover.'
          }
          value={money(owed)}
          affordance="none"
        />
      </Card>

      <SectionHeading note={blocked ? undefined : chanceLabel(admissionOdds(state))}>
        {next === 'postgrad' ? 'Graduate programs' : 'What to study'}
      </SectionHeading>
      <Card>
        {majorsAvailable().map((major, index) => (
          <Fragment key={major.id}>
            {index > 0 ? <RowDivider /> : null}
            <MajorRow
              major={major}
              blocked={blocked ? COLLEGE_ERROR_LABELS[blocked] : undefined}
              onPress={() => {
                applyToStudy(major.id);
                pop();
              }}
            />
          </Fragment>
        ))}
      </Card>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          What you study decides which careers open up. Nothing is closed off by picking wrong — it
          is just harder from further away.
        </Text>
      </View>
    </ScrollView>
  );
}

function MajorRow({
  major,
  blocked,
  onPress,
}: {
  major: Major;
  blocked?: string;
  onPress: () => void;
}) {
  return (
    <ListRow
      icon="school"
      title={major.name}
      subtitle={blocked ?? major.blurb}
      affordance={blocked ? 'none' : 'action'}
      disabled={blocked !== undefined}
      onPress={blocked ? undefined : onPress}
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
