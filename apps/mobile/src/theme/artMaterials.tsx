import { useId } from 'react';
import { Defs, LinearGradient, RadialGradient, Stop, Path, G } from 'react-native-svg';

/** Local IDs keep multiple copies of the same item independent on native and web. */
export function useArtId() {
  return `art${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export function paint(id: string, material: string) {
  return `url(#${id}-${material})`;
}

export function Materials({
  id,
  color = '#477A8D',
  skin = '#DB9E71',
}: {
  id: string;
  color?: string;
  skin?: string;
}) {
  const palettes: Record<string, readonly string[]> = {
    steel: ['#263642', '#B5C4CE', '#F7FCFF', '#82929F', '#DCE6EB', '#465664'],
    gold: ['#6C4219', '#C28A30', '#FFF0B0', '#B67C28', '#EAC772', '#78501F'],
    rose: ['#75473B', '#D49A82', '#FFE0C8', '#AC7365', '#ECC5B3', '#855349'],
    titanium: ['#485158', '#909DAB', '#DBE0E3', '#737E89', '#B6C0C7', '#4C5965'],
    black: ['#111923', '#414B55', '#7D8790', '#252F39', '#485662', '#111923'],
    paint: ['#FFFFFF', color, color, '#172B3A'],
    glass: ['#D5F2FF', '#7CA1B9', '#263F54', '#112431'],
    leather: ['#281C20', '#694937', '#916A4D', '#3C2828'],
    paper: ['#FFFDF3', '#EFE2C6', '#D2BD90'],
    cloth: ['#A7BAD0', color, '#25384E'],
    wood: ['#45271E', '#9E6540', '#CA9259', '#643C2A'],
  };
  return (
    <Defs>
      {Object.entries(palettes).map(([name, stops]) => (
        <LinearGradient
          key={name}
          id={`${id}-${name}`}
          x1="0%"
          y1="0%"
          x2={name === 'paint' || name === 'cloth' ? '15%' : '100%'}
          y2="100%"
        >
          {stops.map((stopColor, index) => (
            <Stop key={index} offset={index / (stops.length - 1)} stopColor={stopColor} />
          ))}
        </LinearGradient>
      ))}
      <RadialGradient id={`${id}-skin`} cx="36%" cy="26%" r="75%">
        <Stop offset="0" stopColor="#FFE1BD" />
        <Stop offset=".45" stopColor={skin} />
        <Stop offset="1" stopColor="#714432" />
      </RadialGradient>
      <RadialGradient id={`${id}-pearl`} cx="30%" cy="23%" r="75%">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset=".45" stopColor="#F2EAE0" />
        <Stop offset=".8" stopColor="#B8AFB1" />
        <Stop offset="1" stopColor="#847F90" />
      </RadialGradient>
    </Defs>
  );
}

/** Facets are geometry, so stones stay crisp at both row and detail sizes. */
export function Gem({
  x,
  y,
  size = 10,
  color = '#84BED4',
}: {
  x: number;
  y: number;
  size?: number;
  color?: string;
}) {
  return (
    <G transform={`translate(${x} ${y}) scale(${size / 10})`}>
      <Path d="M-6-8H6l5 7L0 12-11-1z" fill={color} stroke="#345267" strokeWidth={0.65} />
      <Path
        d="M-6-8-3-1H3L6-8M-11-1H11M-3-1 0 12 3-1"
        fill="none"
        stroke="#FFF"
        strokeWidth={0.7}
        opacity={0.8}
      />
      <Path d="M-6-8H6L3-1H-3z" fill="#FFFFFF" opacity={0.5} />
      <Path d="M-11-1H-3L0 12z" fill="#0F4A65" opacity={0.5} />
      <Path d="M3-1H11L0 12z" fill="#FFFFFF" opacity={0.45} />
      <Path d="M-6-9v6m-3-3h6" stroke="#FFF" strokeWidth={0.9} />
    </G>
  );
}
