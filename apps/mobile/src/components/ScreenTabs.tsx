import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

export function ScreenTabs({
  tabs,
  selected,
  onSelect,
}: {
  readonly tabs: readonly { id: string; label: string }[];
  readonly selected: string;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      accessibilityRole="tablist"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
    >
      {tabs.map(({ id, label }) => (
        <Pressable
          key={id}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: selected === id }}
          onPress={() => onSelect(id)}
          style={[styles.tab, selected === id && styles.selected]}
        >
          <Text style={[styles.label, selected === id && styles.selectedLabel]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.chromeSoft,
  },
  selected: { backgroundColor: colors.chrome },
  selectedLabel: { color: colors.onAccent },
  label: {
    color: colors.ink,
    fontSize: typography.sizes.label,
    fontWeight: typography.weights.bold,
  },
});
