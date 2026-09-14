/**
 * Ticket 0308d — the player types the number.
 *
 * Every amount in this build up to now has been a CHOICE FROM A MENU I wrote:
 * three loan sizes, three repayment amounts, a quarter / half / all of a
 * holding. That was defensible while the amounts were rare and the screens were
 * about something else. It stops being defensible on an investment screen,
 * where the amount IS the decision — "put in $4,000" and "put in $4,500" are
 * different plays, and a game that only offers thirds has quietly made the most
 * interesting choice on the screen on the player's behalf.
 *
 * THE ONE CONVENIENCE THAT SURVIVES is a single max chip, because typing
 * $1,284,392 on a phone is a chore and not a decision. One shortcut is a
 * keyboard; four shortcuts are the menu again.
 *
 * WHAT MAKES THIS WORTH BUILDING RATHER THAN DROPPING IN A TEXT BOX is the
 * LIVE READOUT. The field answers, while the player is still typing, the two
 * questions a canned menu could never raise:
 *
 *   WHAT DOES THIS ACTUALLY BUY? $5,000 into a $1,000 bond buys five bonds and
 *   spends $5,000; $5,000 into a $1,040 bond buys four and spends $4,160. The
 *   rounding is real, it is invisible in the number typed, and the screen has
 *   to say so BEFORE the button is pressed rather than in the receipt.
 *
 *   AND WHY NOT, IF NOT. A disabled button with no reason is the defect this
 *   build has now shipped twice (CORE_RULES 13.15). Every refusal names its own
 *   threshold.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from './index';
import { colors, layout, radii, spacing, typography } from '../theme/theme';

export interface AmountFieldProps {
  /** The question, in words. Sits above the field. */
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  /**
   * What this amount would actually do, recomputed on every keystroke.
   * e.g. "Buys 48.2 shares at $103.25".
   */
  readonly note?: string;
  /** Why it cannot be done. Replaces the note and colours the field. */
  readonly problem?: string;
  /** The one shortcut. Omit it and there is none. */
  readonly max?: { readonly label: string; readonly onPress: () => void };
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly autoFocus?: boolean;
}

/**
 * Digits only, and grouped for reading.
 *
 * WHOLE DOLLARS, deliberately. `invest` rounds its amount to whole dollars and
 * the ledger is integer cents, so a field that accepted "4000.75" would be
 * offering a precision the engine throws away — which is the "said some, spent
 * everything" defect in a politer costume.
 */
export const digitsOnly = (raw: string): string => raw.replace(/[^0-9]/g, '').slice(0, 12);

export const grouped = (digits: string): string =>
  digits === '' ? '' : Number(digits).toLocaleString('en-US');

export function AmountField({
  label,
  value,
  onChange,
  note,
  problem,
  max,
  confirmLabel,
  onConfirm,
  onCancel,
  autoFocus = true,
}: AmountFieldProps) {
  const [focused, setFocused] = useState(false);
  const empty = value === '' || Number(value) <= 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.field,
          focused ? styles.fieldFocused : null,
          problem ? styles.fieldProblem : null,
        ]}
      >
        <Text style={styles.currency}>$</Text>
        <TextInput
          accessibilityLabel={label}
          style={styles.input}
          value={grouped(value)}
          onChangeText={(next) => onChange(digitsOnly(next))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor={colors.inkFaint}
          autoFocus={autoFocus}
          selectTextOnFocus
          maxLength={16}
        />
        {max ? (
          <Pressable
            accessibilityRole="button"
            onPress={max.onPress}
            style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}
          >
            <Text style={styles.chipText}>{max.label}</Text>
          </Pressable>
        ) : null}
      </View>

      {/*
        ONE LINE, ALWAYS PRESENT while there is something to say. A note that
        appears and disappears makes the buttons below it jump, and a player
        mid-tap lands on the wrong one.
      */}
      {problem ? (
        <Text style={styles.problem}>{problem}</Text>
      ) : note ? (
        <Text style={styles.note}>{note}</Text>
      ) : (
        <Text style={styles.note}> </Text>
      )}

      <View style={styles.actions}>
        <ActionButton label="Never mind" variant="quiet" onPress={onCancel} style={styles.flex} />
        <ActionButton
          label={confirmLabel}
          onPress={onConfirm}
          disabled={empty || problem !== undefined}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.sm },
  label: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    color: colors.inkMuted,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.md,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    minHeight: 54,
  },
  fieldFocused: { borderColor: colors.accent },
  fieldProblem: { borderColor: colors.negative },
  currency: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
  },
  chipPressed: { opacity: 0.7 },
  chipText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.accent,
  },
  note: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkMuted,
    minHeight: typography.lineHeights.caption,
  },
  problem: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.negative,
    minHeight: typography.lineHeights.caption,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex: { flex: 1 },
});
