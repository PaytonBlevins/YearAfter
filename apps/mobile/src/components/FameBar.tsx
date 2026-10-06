/**
 * Ticket 0708 — the Fame bar.
 *
 * Fame is not one of the seven permanent stats (CORE_RULES 3, and the validator holds that at
 * seven), and a bar that sat at zero for the whole of a quiet life would teach the player to
 * ignore it, which is the argument `StatBars` makes for stress. So it appears on the Life
 * screen once fame is above zero, whichever of the many ways got it there, and tapping it
 * opens the Fame screen. On the Fame screen itself it is shown large and is not a button.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../theme/theme';
import { fameLabel } from '../screens/fameView';

export interface FameBarProps {
  /** 0–100. */
  readonly fame: number;
  readonly onPress?: () => void;
  /** The large form, for the Fame screen. */
  readonly large?: boolean;
}

export function FameBar({ fame, onPress, large = false }: FameBarProps) {
  const clamped = Math.max(0, Math.min(100, fame));
  const body = (
    <View style={[styles.wrap, large && styles.wrapLarge]}>
      <View style={styles.head}>
        <Text style={[styles.label, large && styles.labelLarge]}>Fame</Text>
        <Text style={[styles.value, large && styles.valueLarge]}>{fameLabel(fame)}</Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Fame"
        accessibilityValue={{ min: 0, max: 100, now: clamped }}
        style={[styles.track, large && styles.trackLarge]}
      >
        <View style={[styles.fill, { width: `${clamped}%` }]} />
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Fame, ${fameLabel(fame)}. Opens your fame.`}
      onPress={onPress}
      style={({ pressed }) => [pressed ? styles.pressed : null]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: layout.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  wrapLarge: {
    borderRadius: radii.md,
    borderBottomWidth: 0,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  labelLarge: { fontSize: typography.sizes.body },
  value: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  valueLarge: { fontSize: typography.sizes.heading },
  track: {
    width: '100%',
    height: layout.statBarHeight,
    borderRadius: layout.statBarHeight / 2,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  trackLarge: { height: layout.statBarHeight * 2, borderRadius: layout.statBarHeight },
  fill: { height: '100%', backgroundColor: colors.fame, borderRadius: layout.statBarHeight / 2 },
});
