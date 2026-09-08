/**
 * Ticket 0102 — Character context header.
 *
 * Spec 879–943: a persistent compact header showing portrait, name, current
 * occupation/status, and liquid cash. Explicitly NOT net worth — spec 828–838
 * says net worth does not need to follow the player everywhere, and putting it
 * in the header would make wealth the game's headline number.
 *
 * The portrait is a monogram tile for now. Character art is a v0.20 identity
 * task; a placeholder photo would be worse than an honest initial.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Character } from '@yearafter/character';
import { formatMoney } from '@yearafter/core';
import type { EducationState } from '@yearafter/education';
import { occupationFor } from '@yearafter/simulation';
import { colors, layout, radii, spacing, typography } from '../theme/theme';
import { Glyph } from '../theme/icons';

export interface CharacterHeaderProps {
  readonly character: Character;
  readonly education: EducationState;
  /** Ticket 0210. The job, when there is one — it outranks the school record. */
  readonly jobTitle?: string;
  readonly year: number;
  readonly onPressDebug?: () => void;
}

export function CharacterHeader({
  character,
  education,
  jobTitle,
  year,
  onPressDebug,
}: CharacterHeaderProps) {
  const initials = `${character.firstName.charAt(0)}${character.lastName.charAt(0)}`;
  // Derived, not read from `character.occupation`: a stored label is only
  // rewritten on Advance, so a resumed or migrated save showed one thing here
  // and something else on the Career screen for the same child.
  //
  // Ticket 0210 found the same disagreement one layer up. `statusLabel` knows
  // about school and nothing else, so a screenshot of the built app showed
  // "26 · Unemployed" in this header above a Work card reading "Sales associate
  // · Retail · 7 years in" — because the character had been hired BETWEEN
  // advances and the derivation had no way to know. `occupationFor` is the one
  // function both this and the Career screen now call, which is the only way
  // two places can be guaranteed to agree.
  const status = occupationFor(education, character.age, jobTitle);

  return (
    <View style={styles.header}>
      <View style={styles.portrait}>
        <Text style={styles.portraitText}>{initials}</Text>
      </View>

      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.name}>
          {character.firstName} {character.lastName}
        </Text>
        <Text numberOfLines={1} style={styles.status}>
          {character.age} · {status}
        </Text>
      </View>

      <View style={styles.money}>
        <Text style={styles.balance}>{formatMoney(character.cash)}</Text>
        <Text style={styles.year}>{year}</Text>
      </View>

      {onPressDebug ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Developer tools"
          onPress={onPressDebug}
          hitSlop={10}
          style={styles.debug}
        >
          <Glyph name="debug" size={16} color={colors.inkFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: layout.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  portrait: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitText: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    fontWeight: typography.weights.bold,
    color: colors.accent,
    letterSpacing: 0.4,
  },
  identity: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
  name: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  status: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    color: colors.inkMuted,
    marginTop: 1,
  },
  money: { alignItems: 'flex-end', marginLeft: spacing.sm },
  balance: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  year: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  debug: { marginLeft: spacing.md, padding: spacing.xxs },
});
