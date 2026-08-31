/**
 * Tickets 0104 + 0105 — Life timeline and Advance.
 *
 * Spec 828–838: the Life screen is a chronological feed with a prominent central
 * Advance control and the seven stat bars visually integrated with the advance
 * area.
 *
 * Feed order is oldest-first, scrolled to the bottom — a life reads forwards,
 * and the newest year should sit directly above the Advance button your thumb is
 * on. (`groupByAge` returns newest-first for screens that want it; this one
 * reverses it.)
 *
 * Spec 0105 acceptance: Advance increments age, appends a timeline event, saves,
 * and stays on the Life experience. There is deliberately no transition, no
 * modal and no interstitial — spec 1031–1042 forbids interrupting every age
 * advance, and the review gate is partly about how fast ten ordinary years feel.
 */

import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { groupByAge, type TimelineEntry } from '@yearafter/character';
import { useGame } from '../stores/gameStore';
import { colors, layout, radii, spacing, typography } from '../theme/theme';

export function LifeScreen() {
  const { state, lastEntries } = useGame();
  const scrollRef = useRef<ScrollView>(null);

  const timeline = state?.player.timeline ?? [];
  const newestIds = new Set(lastEntries.map((entry) => entry.id));

  // Keep the newest year in view as the life grows.
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [timeline.length]);

  if (!state) return null;

  // groupByAge is newest-first; the feed reads oldest-first.
  const sections = groupByAge(timeline).reverse();
  const birthYear = state.player.birthYear;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.birth}>
        <Text style={styles.birthText}>
          Born in {birthYear} · {state.player.currentLocation.regionCode}
        </Text>
      </View>

      {sections.map((section) => (
        <View key={section.age} style={styles.section}>
          <View style={styles.ageHeader}>
            <Text style={styles.ageLabel}>Age {section.age}</Text>
            <View style={styles.ageRule} />
            <Text style={styles.ageYear}>{birthYear + section.age}</Text>
          </View>

          {section.entries.map((entry) => (
            <FeedRow key={entry.id} entry={entry} isNew={newestIds.has(entry.id)} />
          ))}
        </View>
      ))}

      {timeline.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Tap Advance to begin.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function FeedRow({ entry, isNew }: { entry: TimelineEntry; isNew: boolean }) {
  return (
    <View style={[styles.entry, isNew && styles.entryNew]}>
      <View style={[styles.marker, { backgroundColor: markerColor(entry) }]} />
      <Text style={styles.entryText}>{entry.text}</Text>
    </View>
  );
}

function markerColor(entry: TimelineEntry): string {
  switch (entry.kind) {
    case 'milestone':
      return colors.accent;
    case 'finance':
      return colors.statSmarts;
    case 'health':
      return colors.statHealth;
    case 'relationship':
      return colors.statLooks;
    case 'decision':
    case 'opportunity':
      return colors.caution;
    default:
      return colors.hairline;
  }
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },

  birth: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.sm },
  birthText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    letterSpacing: 0.4,
  },

  section: { marginTop: spacing.md },
  ageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  ageLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    color: colors.inkMuted,
  },
  ageRule: { flex: 1, height: layout.hairlineWidth, backgroundColor: colors.hairline },
  ageYear: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    fontVariant: ['tabular-nums'],
  },

  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
  },
  entryNew: { borderColor: colors.accentSoft, backgroundColor: colors.surface },
  marker: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: spacing.md },
  entryText: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.ink,
  },

  empty: { padding: spacing.xxl, alignItems: 'center' },
  emptyText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.inkFaint,
  },
});
