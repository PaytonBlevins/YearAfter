/**
 * Ticket 0101 — icon set.
 *
 * Original line icons drawn as SVG paths. Spec 828–838 requires an original
 * visual identity, so this is a hand-authored set rather than a recognisable
 * third-party icon font.
 *
 * One geometry for the whole set, which is what makes a mixed screen look
 * deliberate rather than assembled:
 *   - 24 x 24 viewbox, with artwork inset ~2px from every edge
 *   - single 1.75 stroke weight, raised to 2.1 for an active tab
 *   - round caps and joins throughout
 *   - outline only; no filled icons, no two-tone
 *   - `currentColor` so colour is decided by the caller, never by the icon
 *
 * Adding an icon: keep it inside the 20x20 optical area, keep the stroke weight
 * inherited rather than set locally, and prefer three or four strokes over an
 * accurate silhouette — these render at 19–20px, where detail turns to mud.
 */

import Svg, { Circle, Path, Rect, type SvgProps } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from './theme';

export type IconName =
  | 'career'
  | 'assets'
  | 'relationships'
  | 'activities'
  | 'chevron'
  | 'back'
  | 'ellipsis'
  | 'close'
  | 'money'
  | 'home'
  | 'vehicle'
  | 'business'
  | 'collection'
  | 'shopping'
  | 'invest'
  | 'news'
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

type Drawing = (props: { strokeWidth: number; color: string }) => React.JSX.Element;

/**
 * The four world tabs carry the most weight — they are on screen constantly and
 * are the only icons a player learns by shape rather than by the label beside
 * them. Each is a distinct silhouette at a glance: rectangle, gem, two figures,
 * four squares.
 *
 * There is deliberately no "advance" icon. The centre control IS the advance
 * affordance — a raised circle showing the next age — so a glyph for it would be
 * a second, competing way to express the same action.
 */
const DRAWINGS: Record<IconName, Drawing> = {
  // Career — a case. Squared, horizontal, unlike anything else in the bar.
  career: ({ strokeWidth }) => (
    <>
      <Rect x={2.9} y={7.2} width={18.2} height={13} rx={2.2} strokeWidth={strokeWidth} />
      <Path
        d="M8.8 7.2V5.6A1.8 1.8 0 0 1 10.6 3.8h2.8a1.8 1.8 0 0 1 1.8 1.8v1.6"
        strokeWidth={strokeWidth}
      />
      <Path d="M2.9 12.6h18.2" strokeWidth={strokeWidth} />
      <Path d="M10.5 12.6v1.8h3v-1.8" strokeWidth={strokeWidth} />
    </>
  ),

  // Assets — a cut gem. Ownership and value, without leaning on a dollar sign.
  assets: ({ strokeWidth }) => (
    <>
      <Path d="M5.4 3.6h13.2l3 5.1-9.6 11.7L3 8.7z" strokeWidth={strokeWidth} />
      <Path d="M3 8.7h18" strokeWidth={strokeWidth} />
      <Path d="M9.2 3.6 7.4 8.7l4.6 11.7 4.6-11.7-1.8-5.1" strokeWidth={strokeWidth} />
    </>
  ),

  // Relationships — two people, one behind the other.
  relationships: ({ strokeWidth }) => (
    <>
      <Circle cx={9.6} cy={8.2} r={3.4} strokeWidth={strokeWidth} />
      <Path d="M3.4 20.2a6.2 6.2 0 0 1 12.4 0" strokeWidth={strokeWidth} />
      <Path d="M16.4 5.5a3 3 0 0 1 0 5.6" strokeWidth={strokeWidth} />
      <Path d="M18 20.2a6.4 6.4 0 0 0-2.4-5" strokeWidth={strokeWidth} />
    </>
  ),

  // Activities — a set of things to choose from.
  activities: ({ strokeWidth }) => (
    <>
      <Rect x={3.4} y={3.4} width={7.4} height={7.4} rx={2} strokeWidth={strokeWidth} />
      <Rect x={13.2} y={3.4} width={7.4} height={7.4} rx={2} strokeWidth={strokeWidth} />
      <Rect x={3.4} y={13.2} width={7.4} height={7.4} rx={2} strokeWidth={strokeWidth} />
      <Rect x={13.2} y={13.2} width={7.4} height={7.4} rx={2} strokeWidth={strokeWidth} />
    </>
  ),

  chevron: ({ strokeWidth }) => <Path d="M9.5 4.8 16.7 12l-7.2 7.2" strokeWidth={strokeWidth} />,
  back: ({ strokeWidth }) => <Path d="M14.5 4.8 7.3 12l7.2 7.2" strokeWidth={strokeWidth} />,
  close: ({ strokeWidth }) => (
    <Path d="M5.6 5.6 18.4 18.4M18.4 5.6 5.6 18.4" strokeWidth={strokeWidth} />
  ),

  // The one filled icon in the set. Three dots drawn as outlines read as tiny
  // rings at 20px, which is not what a "more actions" marker should look like.
  ellipsis: ({ color }) => (
    <>
      <Circle cx={5.4} cy={12} r={1.7} fill={color} stroke="none" />
      <Circle cx={12} cy={12} r={1.7} fill={color} stroke="none" />
      <Circle cx={18.6} cy={12} r={1.7} fill={color} stroke="none" />
    </>
  ),

  money: ({ strokeWidth }) => (
    <>
      <Rect x={2.6} y={5.8} width={18.8} height={12.4} rx={2.2} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={12} r={2.8} strokeWidth={strokeWidth} />
      <Path d="M6.2 12h.01M17.8 12h.01" strokeWidth={strokeWidth} />
    </>
  ),

  home: ({ strokeWidth }) => (
    <>
      <Path
        d="M3.2 10.4 12 3.4l8.8 7v9a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6z"
        strokeWidth={strokeWidth}
      />
      <Path d="M9.4 21v-6.2h5.2V21" strokeWidth={strokeWidth} />
    </>
  ),

  // Vehicle — a side profile with a distinct cabin. The earlier shape was
  // symmetrical enough to read as a generic lozenge at small sizes.
  vehicle: ({ strokeWidth }) => (
    <>
      <Path
        d="M2.8 16.2v-3.4a1.6 1.6 0 0 1 1-1.5l2.4-1 2.2-3.1a2.4 2.4 0 0 1 2-1h4.2a2.4 2.4 0 0 1 1.9.9l2.6 3.4 1.3.5a1.7 1.7 0 0 1 1.1 1.6v3.6h-2.6"
        strokeWidth={strokeWidth}
      />
      <Path d="M8.2 16.2h7.2" strokeWidth={strokeWidth} />
      <Path d="M6.2 10.3h12.3" strokeWidth={strokeWidth} />
      <Path d="M11.6 6.2v4.1" strokeWidth={strokeWidth} />
      <Circle cx={6.6} cy={16.4} r={2} strokeWidth={strokeWidth} />
      <Circle cx={17.2} cy={16.4} r={2} strokeWidth={strokeWidth} />
    </>
  ),

  business: ({ strokeWidth }) => (
    <>
      <Path d="M4.2 21V6.6L12 3.4l7.8 3.2V21" strokeWidth={strokeWidth} />
      <Path d="M2.8 21h18.4" strokeWidth={strokeWidth} />
      <Path d="M8.2 9.6h2M14 9.6h2M8.2 13.4h2M14 13.4h2" strokeWidth={strokeWidth} />
      <Path d="M10.2 21v-3.8h3.6V21" strokeWidth={strokeWidth} />
    </>
  ),

  collection: ({ strokeWidth }) => (
    <>
      <Path d="M12 3.2 20.4 12 12 20.8 3.6 12z" strokeWidth={strokeWidth} />
      <Path d="M12 8.2 15.8 12 12 15.8 8.2 12z" strokeWidth={strokeWidth} />
    </>
  ),

  // Shopping — a cart. The previous bag read as "a purchase"; a cart reads as
  // the act of going shopping, which is what the row does.
  shopping: ({ strokeWidth }) => (
    <>
      <Path d="M2.6 3.8h2.6l2.4 10.6h9.8" strokeWidth={strokeWidth} />
      <Path d="M6.2 6.8h15L19 12.4H7.4" strokeWidth={strokeWidth} />
      <Circle cx={9} cy={19} r={1.7} strokeWidth={strokeWidth} />
      <Circle cx={17.2} cy={19} r={1.7} strokeWidth={strokeWidth} />
    </>
  ),

  invest: ({ strokeWidth }) => (
    <>
      <Path d="M3.4 17.2 9 11.6l3.6 3.6 7.4-7.4" strokeWidth={strokeWidth} />
      <Path d="M15.6 7.8h4.8v4.8" strokeWidth={strokeWidth} />
    </>
  ),

  /*
    News — a folded paper. The fold on the left is what makes it a NEWSPAPER
    rather than a document at 20px; without it this is the same rectangle as
    half a dozen other glyphs. Two column rules and a masthead bar, and nothing
    else fits at this size.
  */
  news: ({ strokeWidth }) => (
    <>
      <Path d="M6.4 5.2h13.2v13.6a1.8 1.8 0 0 1-1.8 1.8H6.4Z" strokeWidth={strokeWidth} />
      <Path d="M6.4 7.6H4.2v10.6a2.2 2.2 0 0 0 2.2 2.2" strokeWidth={strokeWidth} />
      <Path d="M9 8.4h8" strokeWidth={strokeWidth} />
      <Path d="M9 12h8" strokeWidth={strokeWidth} />
      <Path d="M9 15.4h4.6" strokeWidth={strokeWidth} />
    </>
  ),

  // Family — an adult and a child. Three overlapping heads turned to mud at
  // 20px; two figures at different scales reads instantly.
  family: ({ strokeWidth }) => (
    <>
      <Circle cx={8} cy={6.8} r={3} strokeWidth={strokeWidth} />
      <Path d="M2.6 20.4a5.4 5.4 0 0 1 10.8 0" strokeWidth={strokeWidth} />
      <Circle cx={17.4} cy={11.4} r={2.2} strokeWidth={strokeWidth} />
      <Path d="M13.6 20.4a3.8 3.8 0 0 1 7.6 0" strokeWidth={strokeWidth} />
    </>
  ),

  friends: ({ strokeWidth }) => (
    <>
      <Circle cx={8.4} cy={8} r={3.2} strokeWidth={strokeWidth} />
      <Circle cx={16.4} cy={9.4} r={2.4} strokeWidth={strokeWidth} />
      <Path d="M2.8 19.6a5.6 5.6 0 0 1 11.2 0" strokeWidth={strokeWidth} />
      <Path d="M15.4 14.6a4.4 4.4 0 0 1 5.8 4.2" strokeWidth={strokeWidth} />
    </>
  ),

  love: ({ strokeWidth }) => (
    <Path
      d="M12 20.4 4.6 13.2a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5z"
      strokeWidth={strokeWidth}
    />
  ),

  // Mind & Body — a sprout. Self-development, growth. The earlier version
  // enclosed the leaves in a head outline, which filled in at small sizes.
  mind: ({ strokeWidth }) => (
    <>
      <Path d="M12 21V10.4" strokeWidth={strokeWidth} />
      <Path d="M12 12.6c0-3.4 2.4-5.6 5.8-5.6 0 3.4-2.4 5.6-5.8 5.6z" strokeWidth={strokeWidth} />
      <Path d="M12 15.6c0-2.9-2.1-4.8-5-4.8 0 2.9 2.1 4.8 5 4.8z" strokeWidth={strokeWidth} />
    </>
  ),

  doctor: ({ strokeWidth }) => (
    <Path d="M9.6 3.6h4.8v5.2h5.2v4.8h-5.2v5.2H9.6v-5.2H4.4V8.8h5.2z" strokeWidth={strokeWidth} />
  ),

  // Crime — a marker, deliberately abstract. Spec 1969: non-instructional.
  crime: ({ strokeWidth }) => (
    <>
      <Path d="M5.6 21V3.6" strokeWidth={strokeWidth} />
      <Path d="M5.6 4.4h12.8l-2.8 4.2 2.8 4.2H5.6" strokeWidth={strokeWidth} />
    </>
  ),

  gambling: ({ strokeWidth }) => (
    <>
      <Rect x={3.6} y={3.6} width={16.8} height={16.8} rx={3.4} strokeWidth={strokeWidth} />
      <Path d="M8.4 8.4h.01M12 12h.01M15.6 15.6h.01" strokeWidth={strokeWidth} />
    </>
  ),

  social: ({ strokeWidth }) => (
    <>
      <Circle cx={12} cy={12} r={2.4} strokeWidth={strokeWidth} />
      <Path
        d="M7.8 7.8a5.9 5.9 0 0 0 0 8.4M16.2 16.2a5.9 5.9 0 0 0 0-8.4"
        strokeWidth={strokeWidth}
      />
      <Path d="M5 5a9.9 9.9 0 0 0 0 14M19 19a9.9 9.9 0 0 0 0-14" strokeWidth={strokeWidth} />
    </>
  ),

  // Pets — a dog's head with drop ears. A paw print is a generic animal mark and
  // its pads closed up into a blob at 20px; a head reads as a companion.
  pets: ({ strokeWidth }) => (
    <>
      <Path d="M6.4 7.2 4.2 4.8v5.8" strokeWidth={strokeWidth} />
      <Path d="M17.6 7.2l2.2-2.4v5.8" strokeWidth={strokeWidth} />
      <Path d="M4.2 10.6a7.8 7.8 0 0 0 15.6 0" strokeWidth={strokeWidth} />
      <Path d="M6.4 7.2a7.6 7.6 0 0 1 11.2 0" strokeWidth={strokeWidth} />
      <Path d="M9.8 11.6h.01M14.2 11.6h.01" strokeWidth={strokeWidth} />
      <Path d="M12 15.4a2 2 0 0 1-2-1.8h4a2 2 0 0 1-2 1.8z" strokeWidth={strokeWidth} />
    </>
  ),

  // Nightlife — a cocktail glass. The earlier crescent moon read as night, or
  // worse as sleep; going out is the actual subject.
  nightlife: ({ strokeWidth }) => (
    <>
      <Path d="M3.8 4.8h16.4L12 13.4z" strokeWidth={strokeWidth} />
      <Path d="M12 13.4v6.2" strokeWidth={strokeWidth} />
      <Path d="M8.2 20.2h7.6" strokeWidth={strokeWidth} />
      <Path d="M16.4 8 20 4.4" strokeWidth={strokeWidth} />
    </>
  ),

  // Vacation — a palm tree over water. The earlier umbrella read as rain, which
  // is the opposite of the intended feeling.
  vacation: ({ strokeWidth }) => (
    <>
      <Path d="M11.6 7.4c-.9 4.2-1.2 8.6-1 13" strokeWidth={strokeWidth} />
      <Path d="M11.4 6.8c-2.6-1.5-5.6-.9-7.2 1.4 2.5-.8 4.6-.6 6.4.6" strokeWidth={strokeWidth} />
      <Path d="M12.6 6.8c2.6-1.5 5.6-.9 7.2 1.4-2.5-.8-4.6-.6-6.4.6" strokeWidth={strokeWidth} />
      <Path d="M11.8 6.2c.6-2.4 2.8-3.6 5.2-3-1.6.8-2.6 2-3.2 3.6" strokeWidth={strokeWidth} />
      <Path
        d="M2.8 20.6c1.8-1.4 3.6-1.4 5.4 0s3.6 1.4 5.4 0 3.6-1.4 5.4 0"
        strokeWidth={strokeWidth}
      />
    </>
  ),

  relocate: ({ strokeWidth }) => (
    <>
      <Path d="M3.4 8.6h15.2" strokeWidth={strokeWidth} />
      <Path d="M15.4 5.4l3.2 3.2-3.2 3.2" strokeWidth={strokeWidth} />
      <Path d="M20.6 15.4H5.4" strokeWidth={strokeWidth} />
      <Path d="M8.6 12.2l-3.2 3.2 3.2 3.2" strokeWidth={strokeWidth} />
    </>
  ),

  // Plastic surgery — a syringe. A four-point sparkle reads as "magic" in any
  // modern interface, and a face profile collapsed into an unreadable blob at
  // 20px. Distinct from `doctor` (a plus), which is general medicine.
  surgery: ({ strokeWidth }) => (
    <>
      <Path d="M7.44 13.44 14.44 6.44 17.56 9.56 10.56 16.56z" strokeWidth={strokeWidth} />
      <Path d="M9 15 4.6 19.4" strokeWidth={strokeWidth} />
      <Path d="M16 8 19 5" strokeWidth={strokeWidth} />
      <Path d="M17.6 3.6 20.4 6.4" strokeWidth={strokeWidth} />
    </>
  ),

  salon: ({ strokeWidth }) => (
    <>
      <Circle cx={6.4} cy={17.6} r={2.6} strokeWidth={strokeWidth} />
      <Circle cx={17.6} cy={17.6} r={2.6} strokeWidth={strokeWidth} />
      <Path d="M8.3 15.8 19 3.6M15.7 15.8 5 3.6" strokeWidth={strokeWidth} />
    </>
  ),

  // Adoption — a heart held in two cupped hands. The single arc underneath read
  // as a pair of shoulders, i.e. as another "person" icon; the centre split is
  // what makes it hands.
  adoption: ({ strokeWidth }) => (
    <>
      <Path
        d="M12 11.6 8.6 8.4a2.4 2.4 0 0 1 3.4-3.3 2.4 2.4 0 0 1 3.4 3.3z"
        strokeWidth={strokeWidth}
      />
      <Path d="M11.4 20.6C7 20.2 3.6 17.6 3.6 14.2c2.6 0 4.8 1.4 6 3.4" strokeWidth={strokeWidth} />
      <Path d="M12.6 20.6c4.4-.4 7.8-3 7.8-6.4-2.6 0-4.8 1.4-6 3.4" strokeWidth={strokeWidth} />
    </>
  ),

  lawsuit: ({ strokeWidth }) => (
    <>
      <Path d="M12 4.2v16" strokeWidth={strokeWidth} />
      <Path d="M6.6 20.2h10.8" strokeWidth={strokeWidth} />
      <Path d="M4 8.6h16" strokeWidth={strokeWidth} />
      <Path d="M4 8.6 1.9 13.8a3.1 3.1 0 0 0 4.2 0z" strokeWidth={strokeWidth} />
      <Path d="M20 8.6l2.1 5.2a3.1 3.1 0 0 1-4.2 0z" strokeWidth={strokeWidth} />
    </>
  ),

  estate: ({ strokeWidth }) => (
    <>
      <Path d="M5.4 3.4h9.2l4 4v13.2H5.4z" strokeWidth={strokeWidth} />
      <Path d="M14.6 3.4v4h4" strokeWidth={strokeWidth} />
      <Path d="M8.6 12.4h6.8M8.6 16h4.2" strokeWidth={strokeWidth} />
    </>
  ),

  school: ({ strokeWidth }) => (
    <>
      <Path d="M2.4 9.2 12 5l9.6 4.2L12 13.4z" strokeWidth={strokeWidth} />
      <Path d="M6.4 11.2v4.6c0 1.7 2.5 3 5.6 3s5.6-1.3 5.6-3v-4.6" strokeWidth={strokeWidth} />
      <Path d="M21.6 9.2v5" strokeWidth={strokeWidth} />
    </>
  ),

  debug: ({ strokeWidth }) => (
    <>
      <Path d="M3.4 7h17.2M3.4 12h17.2M3.4 17h17.2" strokeWidth={strokeWidth} />
      <Circle cx={9} cy={7} r={2.1} strokeWidth={strokeWidth} />
      <Circle cx={15.6} cy={12} r={2.1} strokeWidth={strokeWidth} />
      <Circle cx={7.6} cy={17} r={2.1} strokeWidth={strokeWidth} />
    </>
  ),
};

export interface GlyphProps {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: string;
  /** Heavier stroke for an active tab. */
  readonly active?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function Glyph({ name, size = 20, color = colors.ink, active = false, style }: GlyphProps) {
  const draw = DRAWINGS[name];
  const svgProps: SvgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style,
  };
  return <Svg {...svgProps}>{draw({ strokeWidth: active ? 2.1 : 1.75, color })}</Svg>;
}
