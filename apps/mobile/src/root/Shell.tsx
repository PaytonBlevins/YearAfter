/**
 * The shared screen shell.
 *
 * Spec 1204–1212 calls for a shared screen shell. Header, body and the
 * world bar are laid out once here; screens supply only their body. That is what
 * keeps the header persistent and the Advance control reachable from every world
 * without each screen re-implementing the frame.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CharacterHeader } from '../components/CharacterHeader';
import { Glyph } from '../theme/icons';
import { LifeScreen } from '../screens/LifeScreen';
import {
  ActivitiesScreen,
  AssetsScreen,
  CareerScreen,
  DebugScreen,
  DoctorScreen,
  MindBodyScreen,
  RelationshipsScreen,
  RelocateScreen,
} from '../screens/shells';
import { useNavigation, WORLD_LABELS, type ScreenKey } from '../navigation/navigation';
import { WorldBar } from '../navigation/WorldBar';
import { useGame } from '../stores/gameStore';
import { colors, layout, spacing, typography } from '../theme/theme';

/** Leaf screens reachable by push. World roots are handled separately. */
const LEAF_SCREENS: Partial<Record<ScreenKey, () => React.JSX.Element | null>> = {
  mindBody: MindBodyScreen,
  doctor: DoctorScreen,
  relocate: RelocateScreen,
  debug: DebugScreen,
};

export function Shell() {
  const { ready, state, advance } = useGame();
  const { world, current, selectWorld, push, pop } = useNavigation();

  if (!ready || !state) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const Leaf = current ? LEAF_SCREENS[current.screen] : undefined;

  return (
    <View style={styles.root}>
      <CharacterHeader
        character={state.player}
        year={state.world.year}
        onPressDebug={() => push({ screen: 'debug', title: 'Developer' })}
      />

      {current ? (
        <View style={styles.subHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={pop}
            hitSlop={12}
            style={styles.back}
          >
            <Glyph name="back" size={22} color={colors.accent} />
            <Text style={styles.backLabel}>{WORLD_LABELS[world]}</Text>
          </Pressable>
          <Text style={styles.subHeaderTitle}>{current.title}</Text>
          <View style={styles.backSpacer} />
        </View>
      ) : null}

      <View style={styles.body}>
        {Leaf ? (
          <Leaf />
        ) : world === 'life' ? (
          <LifeScreen />
        ) : world === 'career' ? (
          <CareerScreen />
        ) : world === 'assets' ? (
          <AssetsScreen />
        ) : world === 'relationships' ? (
          <RelationshipsScreen />
        ) : (
          <ActivitiesScreen />
        )}
      </View>

      <WorldBar
        world={world}
        stats={state.player.stats}
        age={state.player.age}
        onSelectWorld={selectWorld}
        onAdvance={advance}
        canAdvance={state.player.alive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: layout.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  back: { flexDirection: 'row', alignItems: 'center', width: 96, gap: 2 },
  backSpacer: { width: 96 },
  backLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.accent,
  },
  subHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
});
