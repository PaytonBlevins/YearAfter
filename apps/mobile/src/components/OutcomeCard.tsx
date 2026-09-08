/**
 * Ticket 0210b — the answer, where the player asked the question.
 *
 * Review, after playing 0210: *"When I tried out for the basketball team, the
 * result landed on the homepage as it should, but I want a pop up result for
 * things like that... Please make this common across important, entertaining,
 * and interactive moments in the game (life)."*
 *
 * They are right, and it was a gap the build had from 0206 onward. Every
 * interactive moment in this game — a tryout, a job application, Work Harder,
 * asking a parent, a romance move — resolved silently into the Life feed, so a
 * player who tapped a button on the Career screen got no answer at all until
 * they navigated somewhere else and scrolled. `build-status` had it recorded as
 * "one app-wide decision to revisit"; this is that decision.
 *
 * WHAT GOES IN ONE AND WHAT DOES NOT.
 *
 * This is for things the PLAYER PRESSED. A year passing writes its lines to the
 * feed and always will — spec 725–770 makes the feed the story of a life, and
 * putting a modal in front of every passive line would be a slideshow. The rule
 * is: if they tapped it and it had an outcome, answer them here.
 *
 * The shape is the same as `DecisionCard`'s, deliberately, because they are the
 * two halves of one conversation: a question in a card, an answer in a card.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

/**
 * How the outcome went, which is the only thing that changes the card's colour.
 *
 * Three states rather than a free-form palette so the whole app agrees: it went
 * well, it did not, or it simply happened. A caller that has to choose a colour
 * is a caller that will choose a different one next time.
 */
export type OutcomeTone = 'good' | 'bad' | 'neutral';

export interface OutcomeMeter {
  readonly label: string;
  /** 0–100. The bar is the point — a number here would be a formula (spec 786). */
  readonly value: number;
}

export interface Outcome {
  /** Two or three words at the top. "Pure gains", "Not this time". */
  readonly title: string;
  /** One or two sentences saying what actually happened. */
  readonly body: string;
  readonly tone: OutcomeTone;
  /** Optional bar, for an outcome that moved something the player can see. */
  readonly meter?: OutcomeMeter;
  /** Optional right-hand figure — money, most often. */
  readonly value?: string;
}

export interface OutcomeCardProps {
  readonly outcome: Outcome;
  readonly onDismiss: () => void;
}

export function OutcomeCard({ outcome, onDismiss }: OutcomeCardProps) {
  const accent =
    outcome.tone === 'good'
      ? colors.positive
      : outcome.tone === 'bad'
        ? colors.negative
        : colors.accent;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/*
        Tapping the scrim dismisses. An outcome is information, not a decision —
        the player has already made the decision — so there is nothing here to
        get wrong and no reason to trap them behind a button.
      */}
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
      />

      <View
        style={[styles.card, { borderColor: accent }]}
        accessibilityRole="alert"
        accessibilityViewIsModal
        accessibilityLabel={`${outcome.title}. ${outcome.body}`}
      >
        <Text style={[styles.title, { color: accent }]}>{outcome.title}</Text>
        <Text style={styles.body}>{outcome.body}</Text>

        {outcome.value ? <Text style={[styles.value, { color: accent }]}>{outcome.value}</Text> : null}

        {outcome.meter ? (
          <View style={styles.meterRow}>
            <Text style={styles.meterLabel}>{outcome.meter.label}</Text>
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  {
                    backgroundColor: accent,
                    width: `${Math.max(0, Math.min(100, outcome.meter.value))}%`,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
        >
          <Text style={styles.dismissLabel}>Continue</Text>
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
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.family,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.ink,
    textAlign: 'center',
  },
  value: {
    fontFamily: typography.family,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  meterLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    fontWeight: '600',
    minWidth: 92,
  },
  meterTrack: {
    flex: 1,
    height: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: radii.sm },
  dismiss: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSunken,
  },
  dismissPressed: { opacity: 0.7 },
  dismissLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.ink,
    fontWeight: '600',
  },
});
