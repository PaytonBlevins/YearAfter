import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { isAtCollege } from '@yearafter/education';
import { summariseFinances } from '@yearafter/finance';
import { estateOf } from '@yearafter/simulation';
import { Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation, type Route } from '../navigation/navigation';
import { colors, spacing, typography } from '../theme/theme';

/** Spec 20: explain the total; detailed costs remain on their owning screens. */
export function OutflowScreen() {
  const { state } = useGame();
  const { push } = useNavigation();
  if (!state) return null;
  const books = summariseFinances(state.finance, state.world.year, estateOf(state));
  const amount = Number(books.monthlyOutflow);
  const links: { title: string; subtitle: string; route: Route }[] = [];
  if (state.cards.length > 0 || state.loans.length > 0) {
    links.push({
      title: 'Borrowing',
      subtitle: 'Open your debts and their payment screens',
      route: { screen: 'debt', title: 'Debt' },
    });
  }
  if (state.family.members.some((member) => member.role === 'child')) {
    links.push({
      title: 'Children',
      subtitle: 'Open a child to see their monthly cost',
      route: { screen: 'family', title: 'Family' },
    });
  }
  if (state.homes.length > 0) {
    links.push({
      title: 'Homes',
      subtitle: 'Mortgage and upkeep details; rental costs are in each rental',
      route: { screen: 'homes', title: 'Homes' },
    });
  }
  if (state.vehicles.length > 0) {
    links.push({
      title: 'Vehicles',
      subtitle: 'Open a car to see its running costs and loan',
      route: { screen: 'vehicles', title: 'Vehicles' },
    });
  }
  if (isAtCollege(state.education)) {
    links.push({
      title: 'Your program',
      subtitle: 'Tuition, family help and what you pay',
      route: { screen: 'program', title: 'Your program' },
    });
  }
  if (state.businesses.length > 0) {
    links.push({
      title: 'Businesses',
      subtitle: 'Business costs stay in each business; it keeps its own cash',
      route: { screen: 'businesses', title: 'Businesses' },
    });
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeading>Monthly outflow</SectionHeading>
      <Card>
        <ListRow
          title="Monthly average"
          value={
            amount > 0
              ? `$${Math.round(amount / 100).toLocaleString('en-US')}`
              : 'Nothing going out'
          }
          subtitle={`Recorded spending in ${state.world.year}, divided by twelve`}
          affordance="none"
          wrap
        />
      </Card>
      <Text style={styles.note}>
        This is recorded outgoing money averaged over twelve months, not a bill for next month. It
        includes income tax, everyday household spending, repayments and one-off costs. Purchases
        recorded as investment or property transfers aren't included.
      </Text>
      <SectionHeading>Everyday costs and tax</SectionHeading>
      <Card>
        <ListRow
          title="Living costs"
          subtitle="Choose your lifestyle. Rent and everyday household spending follow it; children can add to the cost."
          onPress={() => push({ screen: 'lifestyle', title: 'Lifestyle' })}
          wrap
        />
        <RowDivider />
        <ListRow
          title="Income tax"
          subtitle="Tax withheld from income is part of outflow. The finance dashboard shows your effective tax rate."
          affordance="none"
          wrap
        />
      </Card>
      {links.length > 0 ? (
        <>
          <SectionHeading>Where to check costs</SectionHeading>
          <Text style={styles.note}>
            Open what you own, owe or support to see its current details. Those costs can change, so
            they may differ from spending already recorded this year. One-off spending is also
            included in the total; these links aren't a complete list of transactions.
          </Text>
          <Card>
            {links.map((link, index) => (
              <Fragment key={link.title}>
                {index > 0 ? <RowDivider /> : null}
                <ListRow
                  title={link.title}
                  subtitle={link.subtitle}
                  onPress={() => push(link.route)}
                  wrap
                />
              </Fragment>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: colors.background },
  note: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.inkMuted,
    fontSize: typography.sizes.caption,
  },
});
