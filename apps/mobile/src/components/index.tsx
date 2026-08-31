/**
 * Ticket 0114 — shared UI components.
 *
 * Spec 879–943: menu rows are icon + title + one-line subtitle + navigation
 * indicator, at roughly 6–9 rows per phone screen. Every list in the game uses
 * ListRow, so that density is enforced in one place rather than re-litigated on
 * every screen.
 */

import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { formatMoney, type Money } from '@yearafter/core';
import { colors, layout, radii, spacing, typography } from '../theme/theme';
import { Glyph, type IconName } from '../theme/icons';

/* -------------------------------------------------------------------------- */
/* ListRow                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What pressing a row does. The marker on the right tells the player *before*
 * they tap, which is the whole point:
 *
 *   navigate  chevron  — opens a sub-screen you can come back from
 *   action    ellipsis — does something, or opens a sheet, in place
 *   none      nothing  — the row is informational
 *
 * Pick the one that matches what actually happens. A row that opens a
 * confirmation sheet is an `action`; a row that pushes a list is `navigate`.
 */
export type RowAffordance = 'navigate' | 'action' | 'none';

export interface ListRowProps {
  readonly icon?: IconName;
  readonly title: string;
  readonly subtitle?: string;
  /** Right-aligned value, e.g. a salary or a count. */
  readonly value?: string;
  readonly onPress?: () => void;
  /** Defaults to 'navigate' when pressable, 'none' otherwise. */
  readonly affordance?: RowAffordance;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly accent?: boolean;
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  affordance,
  disabled = false,
  compact = false,
  accent = false,
}: ListRowProps) {
  const resolved: RowAffordance = affordance ?? (onPress ? 'navigate' : 'none');
  const minHeight = compact ? layout.rowHeightCompact : layout.rowHeight;

  // Screen readers get the same distinction the marker gives sighted players.
  const affordanceHint =
    resolved === 'navigate' ? 'Opens' : resolved === 'action' ? 'Takes action' : undefined;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={onPress ? affordanceHint : undefined}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.row,
        { minHeight },
        pressed && !disabled ? styles.rowPressed : null,
        disabled ? styles.rowDisabled : null,
      ]}
    >
      {icon ? (
        <View style={styles.rowIcon}>
          <Glyph name={icon} color={accent ? colors.accent : colors.inkMuted} />
        </View>
      ) : null}

      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={[styles.rowTitle, accent && styles.rowTitleAccent]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}

      {resolved === 'navigate' ? (
        <Glyph name="chevron" size={20} color={colors.inkFaint} style={styles.rowMarker} />
      ) : null}
      {resolved === 'action' ? (
        <Glyph name="ellipsis" size={20} color={colors.inkFaint} style={styles.rowMarker} />
      ) : null}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionHeading                                                              */
/* -------------------------------------------------------------------------- */

export function SectionHeading({ children, note }: { children: string; note?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionHeadingText}>{children.toUpperCase()}</Text>
      {note ? <Text style={styles.sectionHeadingNote}>{note}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Card — the grouped container list rows sit inside                           */
/* -------------------------------------------------------------------------- */

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Hairline between rows inside a Card. Inset to align with row text. */
export function RowDivider({ inset = true }: { inset?: boolean }) {
  return <View style={[styles.divider, inset && styles.dividerInset]} />;
}

/* -------------------------------------------------------------------------- */
/* MoneyLabel                                                                  */
/* -------------------------------------------------------------------------- */

export interface MoneyLabelProps {
  readonly amount: Money;
  readonly size?: keyof typeof typography.sizes;
  /** Colour negatives red. Off by default — a mortgage balance is not an alarm. */
  readonly signed?: boolean;
  readonly abbreviate?: boolean;
  readonly style?: StyleProp<TextStyle>;
}

export function MoneyLabel({
  amount,
  size = 'body',
  signed = false,
  abbreviate = true,
  style,
}: MoneyLabelProps) {
  const negative = amount < 0;
  return (
    <Text
      style={[
        styles.money,
        { fontSize: typography.sizes[size] },
        signed && negative ? { color: colors.negative } : null,
        signed && !negative ? { color: colors.positive } : null,
        style,
      ]}
    >
      {formatMoney(amount, { abbreviate })}
    </Text>
  );
}

/* -------------------------------------------------------------------------- */
/* ActionButton                                                                */
/* -------------------------------------------------------------------------- */

export interface ActionButtonProps {
  readonly label: string;
  readonly onPress?: () => void;
  readonly variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  readonly disabled?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'quiet' && styles.buttonQuiet,
        variant === 'danger' && styles.buttonDanger,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === 'primary' && styles.buttonLabelPrimary,
          variant === 'danger' && styles.buttonLabelDanger,
          variant === 'quiet' && styles.buttonLabelQuiet,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* ConfirmationCard                                                            */
/* -------------------------------------------------------------------------- */

export interface ConfirmationCardProps {
  readonly title: string;
  readonly body?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly destructive?: boolean;
}

export function ConfirmationCard({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmationCardProps) {
  return (
    <View style={styles.confirmation}>
      <Text style={styles.confirmationTitle}>{title}</Text>
      {body ? <Text style={styles.confirmationBody}>{body}</Text> : null}
      <View style={styles.confirmationActions}>
        <ActionButton label={cancelLabel} variant="quiet" onPress={onCancel} style={styles.flex} />
        <ActionButton
          label={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          onPress={onConfirm}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* EmptyState — used heavily while systems are still unbuilt                   */
/* -------------------------------------------------------------------------- */

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

/** Marks a screen area whose system has not been built yet. */
export function ComingSoon({ ticket, what }: { ticket: string; what: string }) {
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonText}>
        {what} — Ticket {ticket}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.surfaceSunken },
  rowDisabled: { opacity: 0.42 },
  rowIcon: { width: 30, alignItems: 'flex-start' },
  rowBody: { flex: 1, justifyContent: 'center' },
  rowTitle: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  rowTitleAccent: { color: colors.accent },
  rowSubtitle: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.inkMuted,
    marginTop: 1,
  },
  rowValue: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.sm,
  },
  rowMarker: { marginLeft: spacing.xs },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionHeadingText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.9,
    color: colors.inkFaint,
  },
  sectionHeadingNote: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
  },
  divider: { height: layout.hairlineWidth, backgroundColor: colors.hairline },
  dividerInset: { marginLeft: spacing.lg + 30 },

  money: {
    fontFamily: typography.family,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },

  button: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
  },
  buttonQuiet: { backgroundColor: colors.surfaceSunken },
  buttonDanger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.negative },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  buttonLabelPrimary: { color: colors.onAccent },
  buttonLabelDanger: { color: colors.negative },
  buttonLabelQuiet: { color: colors.inkMuted },

  confirmation: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    margin: spacing.md,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
  },
  confirmationTitle: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  confirmationBody: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },
  confirmationActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  flex: { flex: 1 },

  empty: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyTitle: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    lineHeight: typography.lineHeights.label,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  comingSoon: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  comingSoonText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    letterSpacing: 0.3,
  },
});
