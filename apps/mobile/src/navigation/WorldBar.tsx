/**
 * Ticket 0103 / 0105 — the five-world bar with the central Advance control.
 *
 * Spec 828–838 puts Advance at the centre of the interaction model and asks for
 * it to be prominent. It is rendered as a raised circle that breaks the bar's
 * top edge — the one element on screen that is not flush — because prominence
 * here is structural, not just a colour choice.
 *
 * The stat bars sit directly above this bar, which is what "visually integrated
 * with the advance area" means in practice: stats and the control that changes
 * them are one block at the bottom of the screen.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, shadows, spacing, typography } from '../theme/theme';
import { Glyph, type IconName } from '../theme/icons';
import { StatBars } from '../components/StatBars';
import type { VisibleStats } from '@yearafter/character';
import { WORLDS, WORLD_LABELS, type World } from './navigation';

/**
 * Tab icons. 'life' is absent on purpose — that slot renders the Advance control,
 * which is a raised circle showing the next age rather than an icon and label.
 */
const WORLD_ICONS: Record<Exclude<World, 'life'>, IconName> = {
  career: 'career',
  assets: 'assets',
  relationships: 'relationships',
  activities: 'activities',
};

export interface WorldBarProps {
  readonly world: World;
  readonly stats: VisibleStats;
  readonly age: number;
  readonly onSelectWorld: (world: World) => void;
  readonly onAdvance: () => void;
  readonly canAdvance: boolean;
}

export function WorldBar({
  world,
  stats,
  age,
  onSelectWorld,
  onAdvance,
  canAdvance,
}: WorldBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.stats}>
        <StatBars stats={stats} />
      </View>

      <View style={[styles.bar, { paddingBottom: insets.bottom || spacing.sm }]}>
        {WORLDS.map((key) =>
          key === 'life' ? (
            <AdvanceButton
              key={key}
              age={age}
              disabled={!canAdvance}
              onPress={() => {
                if (world !== 'life') onSelectWorld('life');
                if (canAdvance) onAdvance();
              }}
            />
          ) : (
            <WorldTab
              key={key}
              world={key as Exclude<World, 'life'>}
              active={world === key}
              onPress={() => onSelectWorld(key)}
            />
          ),
        )}
      </View>
    </View>
  );
}

function WorldTab({
  world,
  active,
  onPress,
}: {
  world: Exclude<World, 'life'>;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={WORLD_LABELS[world]}
      onPress={onPress}
      style={styles.tab}
    >
      <Glyph
        name={WORLD_ICONS[world]}
        size={21}
        active={active}
        color={active ? colors.accent : colors.inkMuted}
      />
      <Text numberOfLines={1} style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {WORLD_LABELS[world]}
      </Text>
    </Pressable>
  );
}

/**
 * No text caption under this button. The circle carries "AGE" and the next age,
 * which is more informative than the word "Advance", and a caption below it
 * collided with the raised circle at every tab-bar height worth having.
 */
function AdvanceButton({
  age,
  disabled,
  onPress,
}: {
  age: number;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.advanceSlot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Advance to age ${age + 1}`}
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [
          styles.advance,
          pressed && !disabled ? styles.advancePressed : null,
          disabled ? styles.advanceDisabled : null,
        ]}
      >
        <Text style={styles.advanceAge}>{age + 1}</Text>
        <Text style={styles.advanceLabel}>AGE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  stats: { borderBottomWidth: layout.hairlineWidth, borderBottomColor: colors.hairline },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
    minHeight: layout.tabBarHeight,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 3, paddingTop: 4 },
  tabLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
  },
  tabLabelActive: { color: colors.accent, fontWeight: typography.weights.semibold },

  advanceSlot: { flex: 1, alignItems: 'center' },
  advance: {
    width: layout.advanceButtonSize,
    height: layout.advanceButtonSize,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -layout.advanceButtonLift,
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.raised,
  },
  advancePressed: { backgroundColor: colors.accentPressed, transform: [{ scale: 0.96 }] },
  advanceDisabled: { backgroundColor: colors.inkFaint },
  advanceAge: {
    fontFamily: typography.family,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    color: colors.onAccent,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  advanceLabel: {
    fontFamily: typography.family,
    fontSize: 8,
    letterSpacing: 1.1,
    color: colors.onAccent,
    opacity: 0.85,
  },
});
