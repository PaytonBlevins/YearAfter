/**
 * Ticket 0212 — the end of a life.
 *
 * Replaces 0211's placeholder, which said three true things (who, how old, what
 * of) and offered one button, and was labelled in its own source as the honest
 * minimum until this ticket existed.
 *
 * Spec 818–827 sets the contents and, unusually, two prohibitions:
 *
 *   "Show name, age, cause of death, occupation/notable identity, concise life
 *   summary, family survived by, and 3–5 major highlights maximum. Do not
 *   prominently display net worth or a generic prestige score."
 *
 * There is therefore no score anywhere on this screen, and no money. The
 * assembly is `eulogyFor` in @yearafter/simulation; this file is only how it
 * looks.
 *
 * IT SCROLLS, AND IT IS NOT DISMISSIBLE.
 *
 * Not dismissible because there is nothing else to do — the same reason 0211's
 * placeholder was not. Scrolls because the content is genuinely variable: a
 * character can die at nineteen with one highlight and nobody surviving them,
 * or at ninety-one with five highlights and seven survivors, and a fixed card
 * sized for one of those clips the other. 0209 and 0210 both shipped clipped
 * copy; a screen that only renders correctly for the median life is the same
 * defect with a nicer excuse.
 *
 * THE ORDER IS THE ORDER A NOTICE IS WRITTEN IN.
 *
 * Name, then the dates, then what they were, then what happened, then the life,
 * then the people, then what happens next. A player who reads only the top two
 * lines has the whole of it; everything below is there for the player who wants
 * to sit with it.
 */

import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RITES, type Eulogy } from '@yearafter/simulation';
import { colors, radii, spacing, typography } from '../theme/theme';

export interface Heir {
  readonly id: string;
  readonly name: string;
  /** "your daughter · 43" — the row's own subtitle. */
  readonly detail: string;
}

export interface EndOfLifeCardProps {
  readonly eulogy: Eulogy;
  /** Ticket 0212. Who the player may carry on as. Empty is the common case. */
  readonly heirs: readonly Heir[];
  readonly onContinueAs: (heirId: string) => void;
  readonly onStartAgain: () => void;
}

/**
 * The rite, chosen before the screen offers a way out.
 *
 * Local state rather than game state, because it changes nothing (see `RITES`
 * in @yearafter/simulation for why that is deliberate). Choosing is not gated:
 * a player who wants to leave can leave, and a modal that demanded an answer
 * about a funeral before letting somebody start a new life would be the chore
 * spec 818–827 removes by name.
 */

export function EndOfLifeCard({ eulogy, heirs, onContinueAs, onStartAgain }: EndOfLifeCardProps) {
  const [rite, setRite] = useState<string | undefined>(undefined);
  return (
    <View style={styles.overlay}>
      <View style={styles.scrim} />
      <View
        style={styles.card}
        accessibilityViewIsModal
        accessibilityLabel={`${eulogy.name} died at ${eulogy.age}`}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.name}>{eulogy.name}</Text>
          <Text style={styles.dates}>{`${eulogy.bornYear} – ${eulogy.diedYear}`}</Text>
          <Text style={styles.identity}>{eulogy.identity}</Text>

          <View style={styles.rule} />

          <Text
            style={styles.cause}
          >{`Died at ${eulogy.age}, of ${lowerFirst(eulogy.cause)}.`}</Text>
          <Text style={styles.summary}>{eulogy.summary}</Text>

          {eulogy.highlights.length > 0 ? (
            <>
              {/*
                NOT "What you did". Reading a played life caught it: a character
                who only ever pressed Advance finishes with three records, two of
                which are "Lost Mom" and "Lost Dad" — and a section headed "what
                you did" listing your parents' deaths is the game getting a
                sentence about somebody's life exactly backwards. Spec 1284 calls
                these highlights; a heading has to cover both what a life
                contained and what it cost.
              */}
              <Text style={styles.heading}>What happened</Text>
              {eulogy.highlights.map((highlight) => (
                <View key={highlight.id} style={styles.row}>
                  <Text style={styles.rowAge}>{highlight.age}</Text>
                  <Text style={styles.rowLabel}>{highlight.label}</Text>
                </View>
              ))}
            </>
          ) : null}

          {/*
            The empty case is a sentence rather than a hidden section, for the
            reason 0211c's Doctor screen gives: a heading that disappears when
            the answer is "nobody" makes the player wonder whether the screen is
            broken, and dying with nobody left is a real and common ending —
            measured at a median of ZERO survivors for a character who only ever
            pressed Advance.
          */}
          <Text style={styles.heading}>Survived by</Text>
          {eulogy.survivors.length > 0 ? (
            eulogy.survivors.map((survivor) => (
              <View key={survivor.id} style={styles.row}>
                <Text style={styles.rowLabel}>{survivor.name}</Text>
                <Text style={styles.rowNote}>{`${survivor.relation} · ${survivor.age}`}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>Nobody. You were the last of them.</Text>
          )}

          <Text style={styles.heading}>What happens now</Text>
          {RITES.map((option) => {
            const chosen = rite === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={option.label}
                onPress={() => setRite(option.id)}
                style={({ pressed }) => [
                  styles.rite,
                  chosen && styles.riteChosen,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.rowLabel, chosen && styles.riteLabelChosen]}>
                  {option.label}
                </Text>
                <Text style={styles.rowNote}>{option.blurb}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          {heirs.map((heir) => (
            <Fragment key={heir.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Continue as ${heir.name}`}
                onPress={() => onContinueAs(heir.id)}
                style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
              >
                <Text style={styles.buttonLabel}>{`Continue as ${heir.name}`}</Text>
                <Text style={styles.buttonNote}>{heir.detail}</Text>
              </Pressable>
            </Fragment>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new life"
            onPress={onStartAgain}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>Start a new life</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** "Old age" reads wrong mid-sentence, and the cause is written for a header. */
const lowerFirst = (text: string): string =>
  text.length > 0 ? text.charAt(0).toLowerCase() + text.slice(1) : text;

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '88%',
    maxWidth: 440,
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  scroll: { flexGrow: 0 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  name: {
    fontFamily: typography.family,
    fontSize: typography.sizes.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  dates: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  identity: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  rule: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.md,
  },
  cause: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.ink,
    textAlign: 'center',
  },
  summary: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  heading: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  rowAge: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    minWidth: 24,
  },
  rowLabel: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.ink,
  },
  rowNote: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
  },
  empty: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    color: colors.inkMuted,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSunken,
  },
  primary: { backgroundColor: colors.accentSoft },
  rite: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginTop: spacing.xs,
  },
  riteChosen: { borderColor: colors.ink, backgroundColor: colors.surfaceSunken },
  riteLabelChosen: { fontWeight: '600' },
  pressed: { opacity: 0.7 },
  buttonLabel: {
    fontFamily: typography.family,
    fontSize: typography.sizes.body,
    color: colors.ink,
    fontWeight: '600',
  },
  buttonNote: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    marginTop: 2,
  },
});
