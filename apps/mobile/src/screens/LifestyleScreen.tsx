import { Fragment } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  LIFESTYLES,
  LIFESTYLE_TIERS,
  LATER_RETIREMENT_FROM,
  type LifestyleTier,
} from '@yearafter/finance';
import { CHARGED_FROM_AGE, livingEstimateFor } from '@yearafter/simulation';
import { Card, ListRow, RowDivider, SectionHeading } from '../components';
import { useGame } from '../stores/gameStore';
import { colors, spacing, typography } from '../theme/theme';

const describe = (tier: LifestyleTier): string => {
  const choice = LIFESTYLES[tier];
  if (choice.happiness < 0)
    return `Fewer extras; up to ${-choice.happiness} less happiness in a year.`;
  if (choice.happiness > 0)
    return `More comforts; up to ${choice.happiness} extra happiness in a year you can pay for.`;
  return 'Your usual comforts, without a lifestyle happiness change.';
};
export function LifestyleScreen() {
  const { state, chooseLifestyle } = useGame();
  if (!state) return null;
  const blocked =
    !state.player.alive || state.player.age < CHARGED_FROM_AGE || state.pending.length > 0;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeading>How you live</SectionHeading>
      <Text style={styles.note}>
        Choose how much to spend on everyday comforts. Basic needs stay covered. The choice stays
        until you change it, and takes effect when you advance; choosing costs nothing now.
      </Text>
      {state.retirement.retiredAtAge !== undefined && state.player.age >= LATER_RETIREMENT_FROM ? (
        <Text style={styles.note}>
          Later in retirement, savings can gradually pay for more everyday comforts. The added
          allowance leaves a cushion for ordinary bills and accounts for personal debt. Your
          lifestyle choice still controls spending. Investments may need to be sold to pay the
          bills; your home and retirement account are not sold automatically.
        </Text>
      ) : null}
      <Card>
        {LIFESTYLE_TIERS.map((tier, index) => (
          <Fragment key={tier}>
            {index > 0 ? <RowDivider /> : null}
            <ListRow
              title={LIFESTYLES[tier].name}
              value={state.household.lifestyle === tier ? 'Selected' : undefined}
              subtitle={`About $${livingEstimateFor(state, tier).toLocaleString('en-US')} a year. ${describe(tier)}`}
              onPress={() => chooseLifestyle(tier)}
              disabled={blocked}
              affordance={state.household.lifestyle === tier ? 'none' : 'action'}
              wrap
            />
          </Fragment>
        ))}
      </Card>
      <Text style={styles.note}>
        Estimates use your current living standard, household and location. Income and costs can
        change next year. Tax, mortgage payments, car costs and other separate bills are extra;
        changing lifestyle doesn't reduce those payments. If money runs short, spending contracts to
        basic needs. Happiness effects are smaller near the ends of the bar and don't apply at basic
        needs or during hardship.
      </Text>
      {blocked ? (
        <Text style={styles.note}>
          {!state.player.alive
            ? 'This life has ended.'
            : state.player.age < CHARGED_FROM_AGE
              ? "You can choose how you live when you're 18."
              : 'Answer the waiting question first.'}
        </Text>
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
