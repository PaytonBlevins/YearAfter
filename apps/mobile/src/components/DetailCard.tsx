/**
 * Ticket 0210c — the arithmetic, on request.
 *
 * Review, after playing 0210b: *"On the career page, I dont need to see the
 * whole expense breakdown, just allow for a popup, showing the salary, tax
 * rate, and what that tax equates to in dollars, whenever I click on my
 * occupation on that page."*
 *
 * 0210b was right that the gap between a $44k salary and what reaches the bank
 * had to be explained, and wrong about where. It put a four-row breakdown on the
 * Career screen permanently, so a number the player needed once — and then
 * understood forever — took a quarter of the page every year for the rest of the
 * life. That is the cost of answering a question nobody is asking any more.
 *
 * So the breakdown moves behind the row that raises the question. It is the
 * companion to `OutcomeCard`: that one answers *what happened*, this one answers
 * *how is this number made*. Both are dismissed by tapping anywhere, because
 * neither is a decision.
 *
 * CORE_RULES 13.29 is the general form: a screen carries what the player needs
 * every time, and a tap carries the rest.
 */

import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

export interface DetailLine {
  readonly label: string;
  /** The figure. Already formatted — this component does no arithmetic. */
  readonly value: string;
  /** One short clause under the label, when the figure needs a word of context. */
  readonly note?: string;
  /** The line the others add up to. At most one per card. */
  readonly accent?: boolean;
}

export interface Detail {
  readonly title: string;
  /** A qualifier for the whole card, in the corner. "a year", most often. */
  readonly note?: string;
  readonly lines: readonly DetailLine[];
  /** A closing sentence, when there is something the rows cannot say. */
  readonly footnote?: string;
}

export interface DetailCardProps {
  readonly detail: Detail;
  readonly onDismiss: () => void;
}

export function DetailCard({ detail, onDismiss }: DetailCardProps) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable
        style={styles.scrim}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
      />

      <View style={styles.card} accessibilityViewIsModal accessibilityLabel={detail.title}>
        <View style={styles.head}>
          <Text style={styles.title}>{detail.title}</Text>
          {detail.note ? <Text style={styles.note}>{detail.note}</Text> : null}
        </View>

        {/*
          Scrolls, because a small phone in a large font size is a real device
          and a card that cannot reach its own last row is worse than no card.
        */}
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {detail.lines.map((line, index) => (
            <Fragment key={line.label}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.line}>
                <View style={styles.lineText}>
                  <Text style={[styles.label, line.accent && styles.labelAccent]}>
                    {line.label}
                  </Text>
                  {line.note ? <Text style={styles.lineNote}>{line.note}</Text> : null}
                </View>
                <Text style={[styles.value, line.accent && styles.valueAccent]}>{line.value}</Text>
              </View>
            </Fragment>
          ))}
        </ScrollView>

        {detail.footnote ? <Text style={styles.footnote}>{detail.footnote}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
        >
          <Text style={styles.dismissLabel}>Close</Text>
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
    maxHeight: '76%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    flexShrink: 1,
    fontFamily: typography.family,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '700',
    color: colors.ink,
  },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
  },
  body: { flexGrow: 0 },
  divider: { height: 1, backgroundColor: colors.hairline },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  lineText: { flexShrink: 1, gap: 2 },
  label: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.ink,
  },
  labelAccent: { fontWeight: '700' },
  lineNote: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
  },
  value: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  valueAccent: { color: colors.accent, fontWeight: '700' },
  footnote: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkFaint,
    paddingTop: spacing.md,
  },
  dismiss: {
    marginTop: spacing.md,
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
