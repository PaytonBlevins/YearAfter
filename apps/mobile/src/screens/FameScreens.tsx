/**
 * Ticket 0708 — Fame.
 *
 * The exact percentage, what being known gets you offered this year, and the famous people
 * you know. The offers are the ones `fameOffers` derives (nothing is saved but what you said
 * yes to), and each can be done once a year.
 */

import { ScrollView, StyleSheet, Text } from 'react-native';
import { findFameWork } from '@yearafter/content';
import { WORK_FROM_AGE, connectionMenu, connectionRows, fameOffers } from '@yearafter/simulation';
import { Card, EmptyState, ListRow, SectionHeading } from '../components';
import { FameBar } from '../components/FameBar';
import { Divided } from '../components/Divided';
import { useNavigation } from '../navigation/navigation';
import { useGame } from '../stores/gameStore';
import { refusalText } from '../stores/fameActions';
import { colors, spacing, typography } from '../theme/theme';
import { fameWords, money, nextOpening } from './fameView';

export function FameScreen() {
  const { state, doFameWork } = useGame();
  const { push } = useNavigation();
  if (!state) return null;

  const offers = fameOffers(state);
  const doneNow =
    state.celebrities.work.year === state.world.year ? state.celebrities.work.done : [];
  const ties = connectionRows(state);
  const next = nextOpening(state.fame);
  const young = state.player.age < WORK_FROM_AGE;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <FameBar fame={state.fame} large />
        <Text style={styles.words}>{fameWords(state.fame)}</Text>
      </Card>
      <Text style={styles.note}>
        Fame comes from how many people know you, from a channel, a business, a part or a lucky
        break. It fades if you stop. Being known gets you asked.
      </Text>

      <SectionHeading note="Once a year each">Offers this year</SectionHeading>
      {young ? (
        <Text style={styles.note}>You have to be {WORK_FROM_AGE} before anyone books you.</Text>
      ) : offers.length === 0 ? (
        <Text style={styles.note}>
          {next === undefined || doneNow.length > 0
            ? 'Nothing else has come in this year.'
            : `Nothing has come in this year. A ${next.def.label.toLowerCase()} opens up at ${next.at}% fame.`}
        </Text>
      ) : (
        <Card>
          {offers.map((offer, index) => (
            <Divided key={offer.def.id} first={index === 0}>
              <ListRow
                title={offer.def.label}
                subtitle={offer.text}
                value={money(offer.pay)}
                affordance="action"
                onPress={() => doFameWork(offer.def.id)}
                wrap
              />
            </Divided>
          ))}
        </Card>
      )}
      {offers.length > 0 && next !== undefined ? (
        <Text style={styles.note}>
          A {next.def.label.toLowerCase()} opens up at {next.at}%.
        </Text>
      ) : null}

      {doneNow.length > 0 ? (
        <>
          <SectionHeading note="Paid with the year's income">Done this year</SectionHeading>
          <Card>
            {doneNow.map((row, index) => (
              <Divided key={row.id} first={index === 0}>
                <ListRow
                  title={findFameWork(row.id)?.label ?? 'Work'}
                  subtitle={row.outlet}
                  value={money(row.pay)}
                  affordance="none"
                  wrap
                />
              </Divided>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeading>People you know</SectionHeading>
      {ties.length === 0 ? (
        <Text style={styles.note}>
          You haven't made a connection with anyone famous. When you cross paths with somebody, how
          you treat them decides whether they remember you.
        </Text>
      ) : (
        <Card>
          {ties.map((tie, index) => (
            <Divided key={tie.id} first={index === 0}>
              <ListRow
                title={tie.name}
                subtitle={`${tie.role[0]?.toUpperCase() ?? ''}${tie.role.slice(1)} · ${tie.standing}`}
                value={tie.active ? tie.bond : 'Out of touch'}
                disabled={!tie.active}
                onPress={
                  tie.active
                    ? () => push({ screen: 'connection', title: tie.name, personId: tie.id })
                    : undefined
                }
                wrap
              />
            </Divided>
          ))}
        </Card>
      )}

      <Card style={styles.gap}>
        <ListRow
          title="Social Media"
          subtitle="Your channels, deals and who looks after you"
          onPress={() => push({ screen: 'socialMedia', title: 'Social Media' })}
          wrap
        />
      </Card>
    </ScrollView>
  );
}

/** One famous person you know, and what you can do with them. */
export function ConnectionScreen() {
  const { state, connectWith } = useGame();
  const { current } = useNavigation();
  if (!state) return null;
  const tie = connectionRows(state).find((row) => row.id === current?.personId);
  if (tie === undefined) {
    return <EmptyState title="You don't know them" body="There's nothing here." />;
  }
  const menu = connectionMenu(state, tie.id);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <ListRow
          title={tie.name}
          subtitle={`${tie.role[0]?.toUpperCase() ?? ''}${tie.role.slice(1)} · ${tie.standing}`}
          value={tie.bond}
          affordance="none"
          wrap
        />
      </Card>
      <SectionHeading>What do you do?</SectionHeading>
      <Card>
        {menu.map((action, index) => (
          <Divided key={action.id} first={index === 0}>
            <ListRow
              title={action.label}
              subtitle={action.refusal === undefined ? action.blurb : refusalText(action.refusal)}
              disabled={action.refusal !== undefined}
              affordance="action"
              onPress={
                action.refusal === undefined ? () => connectWith(tie.id, action.id) : undefined
              }
              wrap
            />
          </Divided>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.background },
  gap: { marginTop: spacing.md },
  words: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.inkMuted,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
    marginVertical: spacing.sm,
  },
});
