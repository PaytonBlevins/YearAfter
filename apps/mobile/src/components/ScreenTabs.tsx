import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../theme/theme';

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
          <Text style={styles.label}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: spacing.sm, paddingBottom: spacing.md },
  tab: { padding: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  selected: { borderBottomColor: colors.ink },
  label: { color: colors.ink, fontSize: typography.sizes.caption },
});
