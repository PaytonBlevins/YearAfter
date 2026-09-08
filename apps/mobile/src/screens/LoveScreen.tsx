/**
 * Ticket 0207 — Love.
 *
 * Spec 1664: "find date, dating app, flirt, relationship, breakup, marriage."
 *
 * The screen is a list of PEOPLE, not a list of verbs, and everything you can
 * actually do lives on the person's own page beside the ordinary friendship
 * options. That is the whole design: somebody you are going out with is a
 * classmate or a teammate who you are also going out with, and splitting them
 * across two screens would have meant looking in two places to find out where
 * you stand with one person.
 *
 * So this is a way IN — who there is, and who there was — and the doing happens
 * one screen down.
 *
 * Nothing here exists below `CRUSH_AGE`. Not an empty list with an explanation:
 * the row on Activities is not there at all, and if the screen is somehow
 * reached it says nothing about romance to a child.
 */

import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CRUSH_AGE,
  ROMANCE_STAGE_LABELS,
  bondOf,
  crushesOf,
  displayName,
  exesOf,
  isCurrent,
  movesFor,
  partnerOf,
  stagesFor,
  type Acquaintance,
} from '@yearafter/social';
import { datingAppAvailable, datingAppUsedThisYear } from '@yearafter/simulation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { warmthColor } from './PeopleScreen';
import { colors, spacing, typography } from '../theme/theme';

export function LoveScreen() {
  const { state, tryDatingApp } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const age = state.player.age;

  // The age gate, on screen, reading the same function the engine reads.
  if (stagesFor(age).length === 0) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState title="Not yet" body="There is nothing here for somebody your age." />
      </ScrollView>
    );
  }

  const people = state.circle.people;
  const partner = partnerOf(people);
  const crushes = crushesOf(people);
  const exes = exesOf(people).filter((person) => person.id !== partner?.id);
  const cash = Number(state.player.cash);
  const usedApp = datingAppUsedThisYear(state);

  // Anybody you could plausibly start something with: somebody still around,
  // who you are not already with, and who the menu has something to say about.
  const possible = people.filter(
    (person) =>
      isCurrent(person) &&
      person.id !== partner?.id &&
      !crushes.some((crush) => crush.id === person.id) &&
      movesFor(person, age, cash).length > 0,
  );

  const open = (person: Acquaintance) =>
    push({ screen: 'person', title: displayName(person), personId: person.id });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeading note={partner ? undefined : 'nobody'}>Where you are</SectionHeading>
      <Card>
        {partner ? (
          <ListRow
            icon="love"
            title={displayName(partner)}
            subtitle={stageLine(partner, age)}
            meter={partner.relationship}
            meterColor={warmthColor(partner.relationship)}
            onPress={() => open(partner)}
          />
        ) : (
          <ListRow
            title="On your own"
            subtitle={
              age < 18
                ? 'Which is where most of it starts.'
                : 'Which is not the same as being alone.'
            }
            affordance="none"
          />
        )}
      </Card>

      {/*
        Ticket 0207b. Spec 1664's other half. Hidden rather than disabled while
        the character is with somebody: a greyed "Try an app" beside the person
        you are married to is a suggestion, not an explanation.
      */}
      {datingAppAvailable(state) ? (
        <>
          <SectionHeading note={usedApp ? 'this year’s done' : 'once a year'}>
            Looking
          </SectionHeading>
          <Card>
            <ListRow
              icon="social"
              title="Spend a month on the apps"
              // Ticket 0210c: the flavour line is gone and the state line stays.
              // "Most months it comes to nothing" said the same thing every year
              // to every player; "you have given it a go" says why the row is
              // greyed out, which is the difference (CORE_RULES 13.29). The
              // heading beside it already carries "once a year".
              subtitle={usedApp ? 'You have given it a go this year.' : undefined}
              affordance={usedApp ? 'none' : 'action'}
              disabled={usedApp}
              onPress={usedApp ? undefined : tryDatingApp}
            />
          </Card>
        </>
      ) : null}

      {crushes.length > 0 ? (
        <>
          <SectionHeading note="they do not know">Somebody you like</SectionHeading>
          <Card>
            {crushes.map((person, index) => (
              <Fragment key={person.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={displayName(person)}
                  subtitle="You have not said anything. Yet."
                  meter={person.relationship}
                  meterColor={warmthColor(person.relationship)}
                  onPress={() => open(person)}
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {/*
        Only shown when there is nobody, because a list of other people to try
        while you are going out with somebody is not a feature this game wants.
      */}
      {!partner && possible.length > 0 ? (
        <>
          <SectionHeading note={`${possible.length}`}>Who there is</SectionHeading>
          <Card>
            {possible.map((person, index) => (
              <Fragment key={person.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={displayName(person)}
                  subtitle={whereFrom(person)}
                  meter={person.relationship}
                  meterColor={warmthColor(person.relationship)}
                  onPress={() => open(person)}
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {exes.length > 0 ? (
        <>
          <SectionHeading>Before</SectionHeading>
          <Card>
            {exes.map((person, index) => (
              <Fragment key={person.id}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={displayName(person)}
                  subtitle={endLine(person)}
                  affordance="none"
                  wrap
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {!partner && possible.length === 0 && crushes.length === 0 ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            {age < CRUSH_AGE + 3
              ? 'Nobody yet. Most of this starts with somebody you already know.'
              : 'Nobody at the moment. The people you meet doing other things are the people you meet.'}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * Where you are with them, in words and never a number.
 *
 * Spec 786–795. "Going out · four years" is what a person would say; the
 * relationship value behind it is the player's business to infer from how it
 * has been going, which is the whole point of hiding it.
 */
function stageLine(person: Acquaintance, age: number): string {
  const romance = person.romance;
  if (!romance) return 'Together';
  const label = ROMANCE_STAGE_LABELS[romance.stage];
  const years = age - romance.since;
  if (years <= 0) return `${label} · since this year`;
  if (years === 1) return `${label} · a year`;
  return `${label} · ${years} years`;
}

/**
 * Reading the screen found five rows all saying "In your year", which is a
 * subtitle that repeats and therefore is not information. How well you already
 * know somebody is the thing that actually differs between them, and it is also
 * the biggest single input to whether any of this works — so it leads.
 */
function whereFrom(person: Acquaintance): string {
  const bond = bondOf(person);
  const where =
    person.context === 'app'
      ? 'from an app'
      : person.viaActivityId !== undefined
        ? 'from something you do'
        : person.context === 'school'
          ? 'in your year'
          : 'from around here';
  return `${bond.charAt(0).toUpperCase()}${bond.slice(1)} · ${where}`;
}

function endLine(person: Acquaintance): string {
  const romance = person.romance;
  if (!romance || romance.endedAtAge === undefined) return 'Over';
  const how = {
    'broke up': 'You ended it',
    'they ended it': 'They ended it',
    divorced: 'Divorced',
    drifted: 'It went quietly',
  }[romance.endedBecause ?? 'drifted'];
  return `${how} · you were ${romance.endedAtAge}`;
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
