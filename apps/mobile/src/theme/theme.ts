/**
 * Ticket 0101 — Global theme system.
 *
 * Spec 828–838: mobile-native, text-first, clean, quick, bright, highly
 * scannable — and the visual identity must be ORIGINAL. Familiar life-sim
 * conventions are allowed; borrowed typography, colour and layout are not.
 *
 * Every colour, size and spacing value in the app comes from here. No component
 * hard-codes a hex value or a pixel number. The v0.01 review gate is about feel
 * (density, prominence, scrolling), and retuning feel means editing this file
 * rather than fifty components.
 */

import { Platform } from 'react-native';

/**
 * Palette.
 *
 * Bright and paper-like rather than the dark chrome most life sims use — the
 * spec asks for bright and scannable, and a life story reads better on paper
 * than on a console. Ink is a warm near-black, never pure #000, which reads as
 * harsh on OLED phones.
 */
const palette = {
  paper: '#FBFAF7',
  surface: '#FFFFFF',
  surfaceSunken: '#F2F0EA',
  ink: '#1A1815',
  inkMuted: '#6B6558',
  inkFaint: '#9C9587',
  hairline: '#E5E1D8',

  // One saturated accent carries the Advance control and active navigation.
  accent: '#1B6E4F',
  accentPressed: '#14563E',
  accentSoft: '#E4F0EA',

  positive: '#1B6E4F',
  caution: '#B4741C',
  negative: '#A8362C',

  // Stat bar colours. Distinct enough to read at a glance at 6px tall,
  // and all legible against `surface`.
  statHappiness: '#D9902B',
  statHealth: '#3F8F5B',
  statSmarts: '#3B6EA8',
  statLooks: '#B5568B',
  statCharisma: '#C2683A',
  statWillpower: '#7A5BAF',
  statDiscipline: '#417C86',
} as const;

export const colors = {
  ...palette,
  /** Screen background. */
  background: palette.paper,
  /** Text on the accent colour. */
  onAccent: '#FFFFFF',
} as const;

/**
 * Typography.
 *
 * A single family with a clear weight ramp. Numbers are tabular wherever they
 * sit in a column (money, ages, stat values) so digits do not jitter as they
 * change — the Advance button changes a lot of numbers at once.
 */
export const typography = {
  family: Platform.select({
    ios: 'SF Pro Text',
    android: 'Roboto',
    default: 'System',
  }) as string,
  sizes: {
    display: 30,
    title: 22,
    heading: 17,
    body: 15,
    label: 13,
    caption: 11,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeights: {
    display: 36,
    title: 28,
    heading: 22,
    body: 21,
    label: 18,
    caption: 15,
  },
} as const;

/** 4pt base scale. Every gap in the app is one of these. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/**
 * Layout constants that shape the five-world model.
 * Spec 879–943 targets roughly 6–9 rows per phone screen.
 */
export const layout = {
  rowHeight: 60,
  rowHeightCompact: 48,
  headerHeight: 60,
  tabBarHeight: 64,
  /** The central Advance control overlaps the tab bar and is deliberately large. */
  advanceButtonSize: 62,
  advanceButtonLift: 18,
  statBarHeight: 6,
  screenPadding: spacing.lg,
  hairlineWidth: 1,
} as const;

export const shadows = {
  raised: {
    shadowColor: '#1A1815',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  card: {
    shadowColor: '#1A1815',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
} as const;

export const theme = { colors, typography, spacing, radii, layout, shadows } as const;

export type Theme = typeof theme;
