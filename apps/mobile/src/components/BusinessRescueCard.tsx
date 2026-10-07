import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { businessRescueChoice, type GameState } from '@yearafter/simulation';
import { colors, layout, radii, shadows, spacing, typography } from '../theme/theme';
const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;

/** One review, even with four businesses. Each answer keeps the others waiting. */
export function BusinessRescueCard({
  state,
  onChoose,
}: {
  readonly state: GameState;
  readonly onChoose: (choiceId: string) => void;
}) {
  const review = state.businessRescue;
  if (!review) return null;
  const cash = Math.max(0, Number(state.finance.balance) / 100);
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.scrim} pointerEvents="auto" />
      <View
        style={styles.card}
        accessibilityRole="alert"
        accessibilityViewIsModal
        accessibilityLabel="Business rescue review"
      >
        <Text style={styles.heading}>Keep the doors open?</Text>
        <Text style={styles.note}>
          You have {money(cash)} in your bank. Choose separately for each business. Nothing comes
          out until you say so.
        </Text>
        <ScrollView contentContainerStyle={styles.cases}>
          {review.cases.map((row) => {
            const business = state.businesses.find((held) => held.id === row.businessId);
            if (!business) return null;
            const affordable = cash >= row.amount;
            return (
              <View key={row.businessId} style={styles.case}>
                <Text style={styles.name}>{business.name}</Text>
                <Text style={styles.note}>
                  It needs {money(row.amount)} to carry on.
                  {row.loanPayment > 0
                    ? ` That includes ${money(row.loanPayment)} for its lender.`
                    : ' That covers the loss and restores some working cash.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Put ${money(row.amount)} into ${business.name}`}
                  accessibilityState={{ disabled: !affordable }}
                  disabled={!affordable}
                  onPress={() => onChoose(businessRescueChoice(row.businessId, 'inject'))}
                  style={[styles.button, !affordable && styles.disabled]}
                >
                  <Text style={styles.note}>Put in {money(row.amount)}</Text>
                </Pressable>
                {!affordable ? (
                  <Text style={styles.note}>You don't have enough in your bank for this.</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Close ${business.name}`}
                  onPress={() => onChoose(businessRescueChoice(row.businessId, 'close'))}
                  style={styles.button}
                >
                  <Text style={styles.note}>Close the business</Text>
                </Pressable>
                <Text style={styles.note}>
                  The fittings and remaining cash will be sold off. Its lender gets paid first. Any
                  unpaid debt stays yours.
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    paddingBottom: layout.tabBarHeight + spacing.lg,
    paddingHorizontal: spacing.md,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  card: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.raised,
  },
  cases: { gap: spacing.lg },
  case: { gap: spacing.sm },
  heading: { fontFamily: typography.family, fontSize: typography.sizes.heading, color: colors.ink },
  name: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  note: { fontFamily: typography.family, fontSize: typography.sizes.body, color: colors.ink },
  button: {
    minHeight: layout.rowHeightCompact,
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceSunken,
  },
  disabled: { opacity: 0.5 },
});
