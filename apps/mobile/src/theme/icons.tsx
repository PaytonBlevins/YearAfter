/**
 * Ticket 0101 — icon set.
 *
 * Text glyphs rather than an icon font or SVG library, for now. The spec calls
 * for an original visual identity (spec 828–838), and shipping a recognisable
 * third-party icon set would work against that. Drawn icons are a v0.20 identity
 * task; this keeps the shell honest and dependency-free until then.
 *
 * The `Glyph` indirection means swapping in real artwork later is one file.
 */

import { Text, type TextStyle } from 'react-native';
import { colors, typography } from './theme';

export type IconName =
  | 'career'
  | 'assets'
  | 'advance'
  | 'relationships'
  | 'activities'
  | 'chevron'
  | 'back'
  | 'money'
  | 'home'
  | 'vehicle'
  | 'business'
  | 'collection'
  | 'shopping'
  | 'invest'
  | 'family'
  | 'friends'
  | 'love'
  | 'mind'
  | 'doctor'
  | 'crime'
  | 'gambling'
  | 'social'
  | 'pets'
  | 'nightlife'
  | 'vacation'
  | 'relocate'
  | 'surgery'
  | 'salon'
  | 'adoption'
  | 'lawsuit'
  | 'estate'
  | 'school'
  | 'debug';

const GLYPHS: Record<IconName, string> = {
  career: '⌁',
  assets: '◆',
  advance: '▸',
  relationships: '◑',
  activities: '⬡',
  chevron: '›',
  back: '‹',
  money: '§',
  home: '⌂',
  vehicle: '⛁',
  business: '▣',
  collection: '❖',
  shopping: '⛬',
  invest: '↗',
  family: '⚭',
  friends: '◍',
  love: '♡',
  mind: '◈',
  doctor: '✚',
  crime: '⚑',
  gambling: '⚄',
  social: '◎',
  pets: '❀',
  nightlife: '☾',
  vacation: '⛱',
  relocate: '⇄',
  surgery: '✧',
  salon: '✂',
  adoption: '⌘',
  lawsuit: '⚖',
  estate: '☗',
  school: '✎',
  debug: '⚙',
};

export interface GlyphProps {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: string;
  readonly style?: TextStyle;
}

export function Glyph({
  name,
  size = typography.sizes.heading,
  color = colors.ink,
  style,
}: GlyphProps) {
  return (
    <Text
      allowFontScaling={false}
      style={[{ fontSize: size, color, lineHeight: size * 1.2 }, style]}
    >
      {GLYPHS[name]}
    </Text>
  );
}
