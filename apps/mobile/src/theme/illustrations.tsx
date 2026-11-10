import { View } from 'react-native';
import Svg, { Circle, Path, Rect, Ellipse, G } from 'react-native-svg';
import { Glyph, type IconName } from './icons';
import { Materials, paint, useArtId } from './artMaterials';
import { MenuObject } from './menuArt';

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

/** Decorative object art. Row text remains the accessible name. */
export function Illustration({ name, size = 36 }: { name: IconName; size?: number }) {
  const id = useArtId();
  const [, ink] = inks[tones[name] ?? 'violet'];
  if (['chevron', 'back', 'ellipsis', 'close'].includes(name))
    return <Glyph name={name} size={size} color={ink} />;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Materials id={id} color={ink} />
        <Ellipse cx={24} cy={44} rx={17} ry={2} fill="#26333F" opacity={0.1} />
        <MenuObject name={name} id={id} />
      </Svg>
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
  const id = useArtId();
  let seed = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    seed = Math.imul(seed ^ identity.charCodeAt(index), 16777619);
  }
  // Mix high bits too: consecutive IDs should not all choose the same haircut.
  seed = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b);
  const variant = (seed ^ (seed >>> 13)) >>> 0;
  const skin = complexions[variant % complexions.length];
  const hair = hairColors[(variant >>> 6) % hairColors.length];
  const outfit = outfits[(variant >>> 14) % outfits.length];
  const haircut = haircuts[(variant >>> 20) % haircuts.length];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Materials id={id} color={outfit} skin={skin} />
        <Rect width={48} height={48} rx={12} fill="#EEE9E2" />
        <Ellipse cx={24} cy={46} rx={20} ry={3} fill="#252D39" opacity={0.13} />
        <Path d="M6 48c1-10 8-14 18-14s17 4 18 14z" fill={paint(id, 'cloth')} />
        <Path d="M20 32h8v7q-4 5-8 0z" fill={paint(id, 'skin')} />
        <Circle cx={13} cy={25} r={3} fill={paint(id, 'skin')} />
        <Circle cx={35} cy={25} r={3} fill={paint(id, 'skin')} />
        <Path d="M14 19c0-12 20-12 20 0v8c0 6-5 10-10 10s-10-4-10-10z" fill={paint(id, 'skin')} />
        <Path d="M19 36l5 6 5-6 5 5-10 6-10-6z" fill="#E8E4D9" />
        <Path d={haircut} fill={hair} stroke="#302A2A" strokeWidth={0.4} />
        <Path
          d="M16 16q7-7 15-4m-14 2q5-6 11-5"
          stroke="#EBCFA1"
          opacity={0.25}
          fill="none"
          strokeWidth={0.6}
        />
        <Path
          d="M16.4 23q3-2 5.5-.2m4.2 0q3-1.8 5.5.2"
          stroke={hair}
          strokeWidth={0.9}
          fill="none"
          strokeLinecap="round"
        />
        {[19, 29].map((x) => (
          <G key={x}>
            <Path
              d={`M${x - 3} 25q3-3.6 6 0-3 3.5-6 0`}
              fill="#F4EEE5"
              stroke="#7D5945"
              strokeWidth={0.35}
            />
            <Circle cx={x} cy={25} r={1.55} fill={['#66513E', '#638181', '#6D7754'][variant % 3]} />
            <Circle cx={x} cy={25} r={0.75} fill="#252830" />
            <Circle cx={x - 0.35} cy={24.5} r={0.35} fill="#FFF" />
          </G>
        ))}
        <Path d="M24 24l-1.5 4q1.5 1 3 0" stroke="#8F6046" strokeWidth={0.6} fill="none" />
        <Path d="M20.5 31q3.5 1 7 0-3.5 5-7 0" fill="#8D514B" />
        <Path d="M21.5 31.5h5" stroke="#F6E5D2" strokeWidth={0.65} />
        <Path
          d="M16 28q1 1 3 .6m10 0q2 .4 3-.6"
          stroke="#C68670"
          opacity={0.45}
          strokeWidth={1.2}
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
