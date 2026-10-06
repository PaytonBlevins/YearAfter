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
  contactWith,
  displayName,
  fullName,
  interactionsFor,
  isCurrent,
  isRomantic,
  lightLeft,
  moveUnavailable,
  movesFor,
  notableMemories,
  ROMANCE_STAGE_LABELS,
  type Acquaintance,
  type Interaction,
  type RomanceMove,
  type YearContact,
} from '@yearafter/social';
import { partnerIncomeOf } from '@yearafter/simulation';
import type { PartnerWork } from '@yearafter/careers';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { howLong, warmthColor } from './PeopleScreen';
import { colors, spacing, typography } from '../theme/theme';

const WORK_LABELS: Readonly<Record<PartnerWork, string>> = {
  working: 'Working',
  notWorking: 'Not working right now',
  retired: 'Retired, on a pension',
};

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

export function PersonScreen() {
  const { state, interactWith, romanceWith } = useGame();
  const { current } = useNavigation();
  if (!state || !current?.personId) return null;

  const person = state.circle.people.find((candidate) => candidate.id === current.personId);
  if (!person) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <EmptyState title="Nobody here" body="This person is no longer in your contacts." />
      </ScrollView>
    );
  }

  const around = isCurrent(person);
  const spent = contactWith(state.circle, person.id, state.player.age);
  const memories = notableMemories(person);
  const options = interactionsFor(person);
  const innocent = options.filter((entry) => !entry.mischief);
  const mischief = options.filter((entry) => entry.mischief);
  // Ticket 0207. Empty below the crush age, for a teacher, and for anybody the
  // player has already been out with — `movesFor` decides all of that, so this
  // screen has no age logic of its own to get wrong.
  const romantic = movesFor(person, state.player.age, Number(state.player.cash));
  const ending = romantic.filter((move) => move.certain);
  const starting = romantic.filter((move) => !move.certain);
  const work = partnerIncomeOf(state);

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

      {/*
        Above the friendship menu when there is something between you, because
        that is the thing the player came to this screen about. Below it — as
        just another option — when there is not.
      */}
      {around && isRomantic(person) ? (
        <>
          <SectionHeading>{ROMANCE_STAGE_LABELS[person.romance?.stage ?? 'seeing']}</SectionHeading>
          <Card>
            {/*
              Ticket 0502. Somebody the player lives with has a working life of
              their own, and the household lives on it. What they do is not the
              player's to manage — only what it brings in, which is the part a
              household feels.
            */}
            {work.partner?.id === person.id && work.year ? (
              <>
                <ListRow
                  title={WORK_LABELS[work.year.status]}
                  value={work.gross > 0 ? `${money(work.gross)} a year` : undefined}
                  affordance="none"
                  compact
                />
                {starting.length + ending.length > 0 ? <RowDivider /> : null}
              </>
            ) : null}
            {[...starting, ...ending].map((move, index) => (
              <Fragment key={move.id}>
                {index > 0 ? <RowDivider /> : null}
                <RomanceRow
                  move={move}
                  person={person}
                  spent={spent}
                  state={state}
                  onPress={() => romanceWith(person.id, move.id)}
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}

      {around ? (
        <>
          <SectionHeading note={lightLeft(spent.light) === 0 ? 'try again next year' : undefined}>
            What you can do
          </SectionHeading>
          <Card>
            {innocent.map((interaction, index) => (
              <Fragment key={interaction.id}>
                {index > 0 ? <RowDivider /> : null}
                <InteractionRow
                  interaction={interaction}
                  person={person}
                  spent={spent}
                  onPress={() => interactWith(person.id, interaction.id)}
                />
              </Fragment>
            ))}
          </Card>

          {/*
            Mischief gets its own card rather than sitting under the polite
            options. Review asked to be able to treat a teacher "innocently and
            mischievously", and the two are different decisions — one costs you
            nothing to consider and the other costs school standing.
          */}
          {/* Not yet anything between you: one row, in with everything else. */}
          {starting.length > 0 && !isRomantic(person) ? (
            <Card>
              {starting.map((move, index) => (
                <Fragment key={move.id}>
                  {index > 0 ? <RowDivider /> : null}
                  <RomanceRow
                    move={move}
                    person={person}
                    spent={spent}
                    state={state}
                    onPress={() => romanceWith(person.id, move.id)}
                  />
                </Fragment>
              ))}
            </Card>
          ) : null}

          {mischief.length > 0 ? (
            <>
              <SectionHeading note="costs you standing">Or</SectionHeading>
              <Card>
                {mischief.map((interaction, index) => (
                  <Fragment key={interaction.id}>
                    {index > 0 ? <RowDivider /> : null}
                    <InteractionRow
                      interaction={interaction}
                      person={person}
                      spent={spent}
                      onPress={() => interactWith(person.id, interaction.id)}
                    />
                  </Fragment>
                ))}
              </Card>
            </>
          ) : null}
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
            You don't see this person anymore. You can still look back at your memories together.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * One row on the menu.
 *
 * A heavy thing already used this year is disabled and says why. A light thing
 * explains what it does — and, once the year has been spent on this person,
 * that the returns have gone. The player is never left pressing
 * something that quietly does nothing.
 */
function InteractionRow({
  interaction,
  person,
  spent,
  onPress,
}: {
  interaction: Interaction;
  person: Acquaintance;
  spent: YearContact;
  onPress: () => void;
}) {
  const heavyUsed = interaction.weight === 'heavy' && spent.heavy > 0;
  const worn = interaction.weight === 'light' && lightLeft(spent.light) === 0;
  const blocked = heavyUsed || worn;

  const subtitle = heavyUsed
    ? "You've already used your once-a-year interaction with this person. Try again next year."
    : worn
      ? `You've reached this year's limit for spending time with ${displayName(person)}. Try again next year.`
      : interaction.blurb;

  return (
    <ListRow
      title={interaction.label}
      subtitle={subtitle}
      affordance={blocked ? 'none' : 'action'}
      disabled={blocked}
      onPress={blocked ? undefined : onPress}
    />
  );
}

/**
 * One romantic option.
 *
 * Same rules as the friendship rows, and one more: the price is on the row when
 * there is one. A player should never find out what an evening cost by watching
 * the balance change afterwards.
 */
function RomanceRow({
  move,
  person,
  spent,
  state,
  onPress,
}: {
  move: RomanceMove;
  person: Acquaintance;
  spent: YearContact;
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  onPress: () => void;
}) {
  const cash = Number(state.player.cash);
  const heavyUsed = move.weight === 'heavy' && spent.heavy > 0;
  const worn = move.weight === 'light' && lightLeft(spent.light) === 0;
  const why = moveUnavailable(move, person, state.player.age, cash);
  const blocked = heavyUsed || worn || why !== undefined;

  const subtitle = heavyUsed
    ? "You've already used your once-a-year interaction with this person. Try again next year."
    : worn
      ? `You've reached this year's limit for spending time with ${displayName(person)}. Try again next year.`
      : (why ?? move.blurb);

  return (
    <ListRow
      title={move.label}
      subtitle={subtitle}
      affordance={blocked ? 'none' : 'action'}
      disabled={blocked}
      onPress={blocked ? undefined : onPress}
    />
  );
}

function describe(person: Acquaintance, playerAge: number): string {
  const bond = bondOf(person);
  if (!isCurrent(person)) return `${bond} · not any more`;
  if (person.kind === 'teacher') return `${person.subject ?? 'Teacher'} · ${bond}`;
  return `${bond} · ${howLong(person, playerAge)}`;
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
