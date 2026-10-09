/**
 * Ticket 0506 — what can be done to one home.
 *
 * Spec 153–154 and 1875's list, filtered to what this home has room for.
 * Each option says what it costs, what the home would be worth afterwards
 * and, when it changes, what a year of keeping it would cost — because a pool
 * is a bill every summer, and spec 1385 says a renovation "need not always
 * return more than [its] cost". Nothing is done by a tap on a row
 * (CORE_RULES 13.28): the row opens its one button.
 */

import { Fragment, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  HOME_CONDITION_LABELS,
  RENOVATION_REFUSAL_LABELS,
  annualExpenseOf,
  renovationSpaceFor,
} from '@yearafter/finance';
import { dollars } from '@yearafter/core';
import { PurchasePaymentChoices } from '../components/PurchasePaymentChoices';
import { findRenovation } from '@yearafter/content';
import { renovationOptionsFor } from '@yearafter/simulation';
import { useNavigation } from '../navigation/navigation';
import { Card, EmptyState, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const money = (amount: number): string => {
  const rounded = Math.round(amount);
  const text = `$${Math.abs(rounded).toLocaleString('en-US')}`;
  return rounded < 0 ? `−${text}` : text;
};

export function RenovateScreen() {
  const { state, renovateHome } = useGame();
  const { current } = useNavigation();
  const [open, setOpen] = useState<string | undefined>(undefined);
  if (!state || !current?.homeId) return null;
  const home = state.homes.find((candidate) => candidate.id === current.homeId);
  if (!home) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="Not yours any more" body="You no longer own this place." />
      </ScrollView>
    );
  }
  const options = renovationOptionsFor(state, home.id);
  const worth = Number(home.value) / 100;
  const expense = annualExpenseOf(home);
  const space = renovationSpaceFor(home);
  const refreshes = options.filter((option) => option.renovation.refresh);
  const additions = options.filter((option) => !option.renovation.refresh);

  const rows = (list: typeof options) =>
    list.map((option, index) => {
      const id = option.renovation.id;
      const added = option.worthAfter - worth;
      const upkeep = option.expenseAfter - expense;
      return (
        <Fragment key={id}>
          {index > 0 ? <RowDivider /> : null}
          <ListRow
            title={option.renovation.name}
            subtitle={
              option.refusal
                ? RENOVATION_REFUSAL_LABELS[option.refusal]
                : `Adds about ${money(added)} to what it's worth${upkeep > 0 ? ` · ${money(upkeep)} a year to run` : ''}${option.renovation.happiness > 0 ? ` · +${option.happinessGain} yearly happiness` : ''}${option.renovation.space > 0 ? ` · ${option.renovation.space} space` : ''}`
            }
            value={money(option.cost)}
            affordance={option.refusal ? 'none' : 'action'}
            disabled={option.refusal !== undefined}
            onPress={option.refusal ? undefined : () => setOpen(open === id ? undefined : id)}
            wrap
          />
          {open === id && !option.refusal ? (
            <>
              <Text style={styles.blurb}>{option.renovation.blurb}</Text>
              {option.renovation.happiness > 0 ? (
                <Text style={styles.note}>
                  Comfort is for the home you live in, up to +3 a year, when your bills are paid.
                </Text>
              ) : null}
              <PurchasePaymentChoices
                key={`${id}:${option.cost}`}
                purchaseName={option.renovation.name}
                total={dollars(option.cost)}
                cash={state.player.cash}
                cards={state.cards}
                onPay={(payment) => {
                  renovateHome(home.id, id, payment);
                  setOpen(undefined);
                }}
              />
            </>
          ) : null}
        </Fragment>
      );
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card>
        <ListRow title="Worth" value={money(worth)} affordance="none" compact />
        <ListRow
          title="Condition"
          value={HOME_CONDITION_LABELS[home.condition]}
          affordance="none"
          compact
        />
        <ListRow
          title="Space"
          value={`${space.used} of ${space.capacity} used · ${space.remaining} left`}
          affordance="none"
          compact
        />
        <ListRow title="Keeping it" value={`${money(expense)} a year`} affordance="none" compact />
      </Card>
      {(home.renovations ?? []).length > 0 ? (
        <>
          <SectionHeading>Done</SectionHeading>
          <Card>
            {(home.renovations ?? []).map((done, index) => (
              <Fragment key={done.renovationId}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={findRenovation(done.renovationId)?.name ?? 'Renovation'}
                  subtitle={`In ${done.year}`}
                  value={money(done.cost)}
                  affordance="none"
                  compact
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}
      <SectionHeading>Fix it up</SectionHeading>
      <Text style={styles.note}>Each of these lifts the condition a step.</Text>
      <Card>{rows(refreshes)}</Card>
      {additions.length > 0 ? (
        <>
          <SectionHeading>Add to it</SectionHeading>
          <Card>{rows(additions)}</Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  blurb: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
  note: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
