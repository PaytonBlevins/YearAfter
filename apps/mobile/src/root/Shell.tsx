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
import { DecisionCard } from '../components/DecisionCard';
import { Glyph } from '../theme/icons';
import { LifeScreen } from '../screens/LifeScreen';
import { FamilyScreen } from '../screens/FamilyScreen';
import { SchoolActivitiesScreen } from '../screens/SchoolActivitiesScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { GigsScreen } from '../screens/GigsScreen';
import { PeopleScreen } from '../screens/PeopleScreen';
import { ChildScreen } from '../screens/ChildScreen';
import { ParentScreen } from '../screens/ParentScreen';
import { LoveScreen } from '../screens/LoveScreen';
import { PersonScreen } from '../screens/PersonScreen';
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
import {
  useNavigation,
  WORLD_LABELS,
  WORLD_TITLES,
  type ScreenKey,
} from '../navigation/navigation';
import { WorldBar } from '../navigation/WorldBar';
import { useGame } from '../stores/gameStore';
import { colors, layout, spacing, typography } from '../theme/theme';

/** Leaf screens reachable by push. World roots are handled separately. */
const LEAF_SCREENS: Partial<Record<ScreenKey, () => React.JSX.Element | null>> = {
  mindBody: MindBodyScreen,
  doctor: DoctorScreen,
  relocate: RelocateScreen,
  family: FamilyScreen,
  friends: PeopleScreen,
  person: PersonScreen,
  schoolActivities: SchoolActivitiesScreen,
  activity: ActivityScreen,
  gigs: GigsScreen,
  love: LoveScreen,
  child: ChildScreen,
  parent: ParentScreen,
  debug: DebugScreen,
};

export function Shell() {
  const { ready, state, advance, decision, answer } = useGame();
  const { world, current, selectWorld, push, pop, closeToLife } = useNavigation();

  /**
   * Answering may ask to open a screen — "See what they offer" leading to the
   * real activities list rather than the game picking a club for you (Ticket
   * 0204). The simulation reports the destination; mapping it to a route is the
   * app's job, which is why the engine never learns what a screen is.
   */
  const answerAndNavigate = (eventId: string, choiceId: string) => {
    const opens = answer(eventId, choiceId);
    if (opens === 'activities') {
      selectWorld('career');
      push({ screen: 'schoolActivities', title: 'Clubs & Teams' });
    }
  };

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
        education={state.education}
        year={state.world.year}
        onPressDebug={() => push({ screen: 'debug', title: 'Developer' })}
      />

      {/*
        Screen header. Life has none — it is the home screen, there is nothing to
        leave. Every other world gets one, and it always offers a way back to
        Life that does NOT advance the year: leaving a screen must never cost the
        player a year of their life.

        At a world root:  ✕ close        · title
        Inside a leaf:    ‹ parent       · title · ✕ close

        The condition covers leaves on the LIFE stack too — the developer screen
        is pushed from the Life header, and gating on `world !== 'life'` alone
        left it with no header and therefore no way back.
      */}
      {world !== 'life' || current ? (
        <View style={styles.subHeader}>
          {current ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Back to ${WORLD_TITLES[world]}`}
              onPress={pop}
              hitSlop={12}
              style={styles.headerSlot}
            >
              <Glyph name="back" size={22} color={colors.accent} />
              <Text numberOfLines={1} style={styles.headerSlotLabel}>
                {WORLD_LABELS[world]}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close, back to Life"
              onPress={closeToLife}
              hitSlop={12}
              style={styles.headerSlot}
            >
              <Glyph name="close" size={20} color={colors.accent} />
            </Pressable>
          )}

          <Text numberOfLines={1} style={styles.subHeaderTitle}>
            {current ? current.title : WORLD_TITLES[world]}
          </Text>

          {current ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close, back to Life"
              onPress={closeToLife}
              hitSlop={12}
              style={[styles.headerSlot, styles.headerSlotEnd]}
            >
              <Glyph name="close" size={20} color={colors.inkFaint} />
            </Pressable>
          ) : (
            <View style={styles.headerSlot} />
          )}
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
        stress={state.player.stress.level}
        age={state.player.age}
        onSelectWorld={selectWorld}
        onAdvance={advance}
        canAdvance={state.player.alive && state.pending.length === 0}
      />

      {/*
        Rendered here rather than inside LifeScreen so the question follows the
        player: time is stopped whatever world they wandered into, and a control
        that does nothing with no explanation is the worst version of that.
      */}
      {decision ? (
        <DecisionCard
          decision={decision}
          remaining={state.pending.length}
          onChoose={(choiceId) => answerAndNavigate(decision.eventId, choiceId)}
        />
      ) : null}
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
  // Fixed-width slots on both sides keep the title optically centred whether
  // the leading control is a close cross or a back arrow with a word beside it.
  headerSlot: { flexDirection: 'row', alignItems: 'center', width: 104, gap: 2 },
  headerSlotEnd: { justifyContent: 'flex-end' },
  headerSlotLabel: {
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
