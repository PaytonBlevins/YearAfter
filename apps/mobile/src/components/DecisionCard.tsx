/**
 * Ticket 0203 — the decision card.
 *
 * Spec 725–770 allows roughly 0–3 meaningful decisions a year and warns against
 * bombarding the player with popups, and spec 1031–1042 forbids interrupting
 * every age advance. So this is the one thing in the game that is allowed to
 * stop the player, and it earns that by being rare.
 *
 * Design decisions worth keeping:
 *  - It is an overlay, not a screen. The feed stays visible behind it, so the
 *    question sits in the context of the year that produced it.
 *  - There is no dismiss. A decision is answered, never closed — the buttons are
 *    the only way out, which is why the catalog guarantees at least two.
 *  - One question at a time. A year can raise three; three stacked cards on a
 *    phone reads as a form, not a life.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PendingDecision } from '@yearafter/events';
import { colors, layout, radii, shadows, spacing, typography } from '../theme/theme';

export interface DecisionCardProps {
  readonly decision: PendingDecision;
  /** How many questions are waiting in total, including this one. */
  readonly remaining: number;
  readonly onChoose: (choiceId: string) => void;
}

export function DecisionCard({ decision, remaining, onChoose }: DecisionCardProps) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.scrim} pointerEvents="auto" />

      <View
        style={styles.card}
        accessibilityRole="alert"
        accessibilityViewIsModal
        accessibilityLabel={`A decision at age ${decision.age}`}
      >
        <View style={styles.meta}>
          <Text style={styles.metaAge}>Age {decision.age}</Text>
          {remaining > 1 ? <Text style={styles.metaCount}>1 of {remaining}</Text> : null}
        </View>

        {/*
          Plain Text, not a ScrollView: the catalog caps a prompt at 220
          characters, which is five lines here, and the scroll container drew a
          stray indicator bar across the bottom of the card on web.
        */}
        <Text style={styles.prompt}>{decision.prompt}</Text>

        <View style={styles.choices}>
          {decision.choices.map((choice) => (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityLabel={choice.label}
              onPress={() => onChoose(choice.id)}
              style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
            >
              <Text style={styles.choiceLabel}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
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
    // Clear of the tab bar and the raised Advance control, which is disabled
    // while this is up but still sits there.
    paddingBottom: layout.tabBarHeight + spacing.lg,
    paddingHorizontal: spacing.md,
  },
  // Dim rather than black out: the year that produced the question stays
  // readable behind it.
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.raised,
  },

  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaAge: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  metaCount: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    fontVariant: ['tabular-nums'],
  },

  prompt: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    lineHeight: typography.lineHeights.heading,
    color: colors.ink,
  },

  choices: { gap: spacing.sm },
  choice: {
    minHeight: layout.rowHeightCompact,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceSunken,
  },
  // Every option is presented identically. Styling one as primary would be the
  // game telling the player which answer it prefers, and there isn't one.
  choicePressed: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
});
