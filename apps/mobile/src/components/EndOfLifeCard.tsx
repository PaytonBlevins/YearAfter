/**
 * Ticket 0211 — the honest minimum, until 0212 builds the real one.
 *
 * 0211 makes a life finite. 0212 is the ticket that makes the ending mean
 * something: spec 1284 asks for name, age, cause, occupation, a concise
 * summary, who survives them, and *"3–5 major highlights maximum"* — and says
 * explicitly not to show net worth or a prestige score.
 *
 * None of that is here, deliberately. What is here is the alternative to
 * shipping nothing: without it, a character who dies leaves the player on the
 * Life screen with a greyed-out Advance button, one line in the feed, and no
 * way forward — which reads as the app breaking rather than the life ending.
 * A dead end is a worse placeholder than a plain card.
 *
 * So this says the three true things — who, how old, what of — and offers the
 * one thing there is to do. It is labelled in the source rather than on the
 * screen, because CORE_RULES 13.24: a ticket number is not player-facing copy.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

export interface EndOfLifeCardProps {
  readonly name: string;
  readonly age: number;
  readonly cause: string;
  readonly onStartAgain: () => void;
}

export function EndOfLifeCard({ name, age, cause, onStartAgain }: EndOfLifeCardProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.scrim} />
      <View
        style={styles.card}
        accessibilityViewIsModal
        accessibilityLabel={`${name} died at ${age}`}
      >
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.age}>{`Died at ${age}`}</Text>
        <View style={styles.rule} />
        <Text style={styles.cause}>{cause}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new life"
          onPress={onStartAgain}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Start a new life</Text>
        </Pressable>
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
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '86%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    fontFamily: typography.family,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  age: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.inkFaint,
  },
  rule: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.md,
  },
  cause: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.ink,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSunken,
  },
  pressed: { opacity: 0.7 },
  buttonLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.ink,
    fontWeight: '600',
  },
});
