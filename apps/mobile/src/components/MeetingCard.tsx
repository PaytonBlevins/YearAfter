/**
 * Ticket 0708 — meeting somebody famous.
 *
 * The year turns and, rarely, somebody well known is in your path (ticket 0705). This is the
 * card that says so and asks what you do: six things, one of which is to walk past. It has the
 * shape of `DecisionCard` because it is the same kind of moment, a question the player answers
 * and not a note they read, and the answer comes back as an `OutcomeCard` like every other
 * thing the player does.
 *
 * It is derived, not stored: `encounterFor(state)` is a fixed draw for the year, and it stays
 * on the table until it is answered, so reloading the game cannot lose a meeting or repeat one.
 * It waits behind a pending decision, an answer and a breakdown, and a graduation sits above it.
 */

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { findCelebrityField } from '@yearafter/content';
import {
  displayFigure,
  encounterFor,
  encounterMenu,
  standingOf,
  type Encounter,
} from '@yearafter/simulation';
import { refusalText } from '../stores/fameActions';
import { useGame } from '../stores/gameStore';
import { colors, layout, radii, shadows, spacing, typography } from '../theme/theme';

export interface MeetingAction {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  /** Why it can't be done here, in words. Absent: it can. */
  readonly why?: string;
}

export interface MeetingCardProps {
  readonly name: string;
  /** "an actor". */
  readonly role: string;
  /** "well known". */
  readonly standing: string;
  readonly text: string;
  readonly actions: readonly MeetingAction[];
  readonly onChoose: (actionId: string) => void;
}

export function MeetingCard({ name, role, standing, text, actions, onChoose }: MeetingCardProps) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.scrim} pointerEvents="auto" />
      <View
        style={styles.card}
        accessibilityRole="alert"
        accessibilityViewIsModal
        accessibilityLabel={`You meet ${name}`}
      >
        <Text style={styles.kicker}>A chance meeting</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {role}, {standing}
        </Text>
        <Text style={styles.text}>{text}</Text>
        <View style={styles.choices}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              accessibilityLabel={action.why ? `${action.label}. ${action.why}` : action.label}
              accessibilityState={{ disabled: action.why !== undefined }}
              onPress={action.why === undefined ? () => onChoose(action.id) : undefined}
              style={({ pressed }) => [
                styles.choice,
                pressed && action.why === undefined ? styles.choicePressed : null,
                action.why === undefined ? null : styles.choiceDisabled,
              ]}
            >
              <Text style={styles.choiceLabel}>{action.label}</Text>
              <Text style={styles.choiceBlurb}>{action.why ?? action.blurb}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/** What the card says about a meeting, as plain data. */
export function meetingCardProps(
  encounter: Encounter,
  menu: ReturnType<typeof encounterMenu>,
): Omit<MeetingCardProps, 'onChoose'> {
  const role = findCelebrityField(encounter.figure.field)?.role ?? 'a public figure';
  return {
    name: displayFigure(encounter.figure),
    role,
    standing: standingOf(encounter.fame),
    text: encounter.text,
    actions: menu.map((action) => ({
      id: action.id,
      label: action.label,
      blurb: action.blurb,
      ...(action.refusal === undefined ? {} : { why: refusalText(action.refusal) }),
    })),
  };
}

/** Shown whenever there is somebody to meet and nothing more urgent on screen. */
export function MeetingNotice() {
  const { state, decision, outcome, detail, meetThem } = useGame();
  const encounter = useMemo(() => (state?.player.alive ? encounterFor(state) : undefined), [state]);
  if (!state || !encounter || decision || outcome || detail) return null;
  return <MeetingCard {...meetingCardProps(encounter, encounterMenu(state))} onChoose={meetThem} />;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    paddingBottom: layout.tabBarHeight + spacing.lg,
    paddingHorizontal: spacing.md,
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.raised,
  },
  kicker: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    color: colors.fame,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  meta: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    color: colors.inkMuted,
  },
  text: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  choices: { gap: spacing.xs },
  choice: {
    minHeight: layout.rowHeightCompact,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: layout.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceSunken,
  },
  choicePressed: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  choiceDisabled: { opacity: 0.45 },
  choiceLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  choiceBlurb: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
});
