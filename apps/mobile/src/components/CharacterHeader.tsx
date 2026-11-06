/**
 * Ticket 0102 — Character context header.
 *
 * Spec 879–943: a persistent compact header showing portrait, name, current
 * occupation/status, and liquid cash. Explicitly NOT net worth — spec 828–838
 * says net worth does not need to follow the player everywhere, and putting it
 * in the header would make wealth the game's headline number.
 *
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Character } from '@yearafter/character';
import { formatMoney } from '@yearafter/core';
import type { EducationState } from '@yearafter/education';
import { occupationFor } from '@yearafter/simulation';
import { colors, layout, spacing, typography } from '../theme/theme';
import Svg, { Path } from 'react-native-svg';
import { Portrait } from '../theme/illustrations';
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
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <Svg width="100%" height="100%" viewBox="0 0 400 72" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 36 }, (_, index) => {
            const x = (index % 12) * 36 + (index >= 12 && index < 24 ? 18 : 0);
            const y = Math.floor(index / 12) * 25 + 10;
            return (
              <Path key={index} d={`M${x} ${y - 3}l2 3-2 3-2-3z`} fill={colors.identityPattern} />
            );
          })}
        </Svg>
      </View>
      <Portrait identity={character.id} size={46} />

      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.name}>
          {character.firstName} {character.lastName}
        </Text>
        <Text numberOfLines={1} style={styles.status}>
          {character.age} · {status}
        </Text>
      </View>

      <View style={styles.money}>
        <Text numberOfLines={1} style={[styles.balance, character.cash < 0 && styles.overdrawn]}>
          {formatMoney(character.cash)}
        </Text>
        <Text style={styles.year}>Cash · {year}</Text>
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
    minHeight: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.identity,
    borderBottomWidth: layout.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  identity: { flex: 1, marginLeft: spacing.md, justifyContent: 'center' },
  name: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  status: {
    fontFamily: typography.family,
    fontSize: typography.sizes.label,
    color: colors.inkMuted,
    marginTop: 1,
  },
  money: { alignItems: 'flex-end', marginLeft: spacing.sm, maxWidth: '45%' },
  balance: {
    fontFamily: typography.family,
    fontSize: typography.sizes.heading,
    fontWeight: typography.weights.bold,
    color: colors.positive,
    fontVariant: ['tabular-nums'],
  },
  overdrawn: { color: colors.negative },
  year: {
    fontFamily: typography.family,
    fontSize: typography.sizes.caption,
    color: colors.inkFaint,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  debug: { marginLeft: spacing.md, padding: spacing.xxs },
});
