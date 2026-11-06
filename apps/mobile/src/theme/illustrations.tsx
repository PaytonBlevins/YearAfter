import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Glyph, type IconName } from './icons';
import { radii } from './theme';

const inks = {
  violet: ['#EAE2FA', '#523A89'],
  aqua: ['#DDF4F0', '#146658'],
  honey: ['#FFEDC7', '#815012'],
  berry: ['#F9E1EA', '#953859'],
  sky: ['#DFEDFC', '#265989'],
} as const;

const tones: Partial<Record<IconName, keyof typeof inks>> = {
  money: 'aqua',
  invest: 'aqua',
  home: 'honey',
  vehicle: 'sky',
  career: 'sky',
  business: 'sky',
  collection: 'berry',
  assets: 'honey',
  shopping: 'berry',
  relationships: 'berry',
  love: 'berry',
  friends: 'aqua',
  family: 'berry',
  activities: 'aqua',
  doctor: 'aqua',
  school: 'sky',
  social: 'sky',
  pets: 'honey',
  vacation: 'sky',
  gambling: 'honey',
  auction: 'honey',
  music: 'berry',
  trophy: 'honey',
  card: 'aqua',
  film: 'violet',
  camera: 'sky',
  parcel: 'honey',
  art: 'berry',
  watch: 'aqua',
};

/** A decorative two-tone stamp. The row supplies its accessible label. */
export function Illustration({ name, size = 36 }: { name: IconName; size?: number }) {
  const [backgroundColor, ink] = inks[tones[name] ?? 'violet'];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.stamp, { width: size, height: size, backgroundColor }]}
    >
      <Svg width={size} height={size} viewBox="0 0 40 40" style={styles.art}>
        <Circle cx={17} cy={15} r={11} fill="#FFFFFF" opacity={0.58} />
        <Path d="M30 6v6m-3-3h6M8 29v4m-2-2h4" stroke={ink} opacity={0.42} strokeLinecap="round" />
        <Circle cx={31} cy={30} r={2} fill={ink} opacity={0.24} />
      </Svg>
      <Glyph name={name} size={Math.round(size * 0.6)} color={ink} active />
    </View>
  );
}

const complexions = ['#F3C39D', '#DB9E71', '#AE704C', '#78492F', '#E9AD8A', '#8D583E'];
const hairColors = ['#282030', '#462D2C', '#75412D', '#A85832', '#885C32', '#353344'];
const outfits = ['#6344AA', '#247C76', '#C34E77', '#315D99', '#B65D25', '#764581'];
const haircuts = [
  'M12 27v-7C12 4 37 4 37 21v6l-4-9c-9 4-14 3-17 0z',
  'M11 32V21C11 4 38 4 38 21v12h-5V20c-6-1-11-4-13-7-1 5-3 7-5 8v11z',
  'M12 25l-1-7c-2-3 1-6 4-6 0-5 7-6 9-3 3-4 9-2 10 1 5 0 7 5 4 8l-2 7-3-8c-5 2-11 2-16 0z',
  'M12 27v-8C12 5 36 3 38 20l-2 7-3-8c-5 1-11 0-15-4l-3 12z',
];

/** Stable illustrated identity, derived from the existing ID and never saved separately. */
export function Portrait({ identity, size = 40 }: { identity: string; size?: number }) {
  let seed = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    seed = Math.imul(seed ^ identity.charCodeAt(index), 16777619);
  }
  const variant = seed >>> 0;
  const skin = complexions[variant % complexions.length];
  const hair = hairColors[(variant >>> 6) % hairColors.length];
  const outfit = outfits[(variant >>> 14) % outfits.length];
  const haircut = haircuts[(variant >>> 20) % haircuts.length];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Rect width={48} height={48} rx={12} fill="#F3DDB1" />
        <Circle cx={33} cy={16} r={11} fill="#FFF4D9" />
        <Path d="M6 48c1-10 8-14 18-14s17 4 18 14z" fill={outfit} />
        <Path d="M20 32h8v7q-4 5-8 0z" fill={skin} />
        <Circle cx={13} cy={25} r={3} fill={skin} />
        <Circle cx={35} cy={25} r={3} fill={skin} />
        <Path d="M14 19c0-12 20-12 20 0v8c0 6-5 10-10 10s-10-4-10-10z" fill={skin} />
        <Path d={haircut} fill={hair} />
        <Circle cx={19} cy={25} r={1.2} fill="#2C2430" />
        <Circle cx={29} cy={25} r={1.2} fill="#2C2430" />
        <Path
          d="M21 30q3 3 6 0"
          stroke="#532C36"
          strokeWidth={1.15}
          strokeLinecap="round"
          fill="none"
        />
        {(variant & 16) !== 0 ? (
          <Path
            d="M15.5 23h7v2.5a3.5 3.5 0 0 1-7 0zM25.5 23h7v2.5a3.5 3.5 0 0 1-7 0zM22.5 24.5h3"
            stroke={hair}
            strokeWidth={0.85}
            fill="none"
          />
        ) : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: { borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  art: { position: 'absolute', top: 0, left: 0 },
});
