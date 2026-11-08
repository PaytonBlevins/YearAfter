import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { MilestoneKind } from './sceneArt';
import { Gem, paint } from './artMaterials';

export function MilestoneDetails({ kind, id }: { kind: MilestoneKind; id: string }) {
  const gold = paint(id, 'gold'),
    steel = paint(id, 'steel'),
    paper = paint(id, 'paper');
  switch (kind) {
    case 'graduation':
      return (
        <>
          <G transform="rotate(-15 126 112)">
            <Rect x={82} y={103} width={94} height={17} rx={8} fill={paper} stroke="#B8A47D" />
            <Ellipse cx={86} cy={111.5} rx={4} ry={7} fill="#CEB993" />
            <Path d="M126 103v17m6-17v17" stroke="#985569" strokeWidth={5} />
            <Path d="M128 113l-8 13 10-4 7 4-7-13" fill="#985569" />
          </G>
          <Path
            d="M91 61l39-18 37 16M100 81v10m6-8v11m6-9v11"
            stroke="#B7A2C9"
            opacity={0.5}
            fill="none"
          />
        </>
      );
    case 'awards':
      return (
        <>
          <Rect x={100} y={111} width={60} height={9} rx={2} fill={paint(id, 'wood')} />
          <Path d="M107 39q-1 27 16 33" stroke="#FFF1C2" strokeWidth={3} fill="none" />
          <Path d="M110 116h40" stroke="#BD944F" strokeWidth={2} />
        </>
      );
    case 'newborn':
      return (
        <>
          <Path
            d="M80 99q50 16 100 0m-96 7q46 14 92 0m-93-13 5 17m9-18 4 21m10-20 2 23m11-22v23m12-23-2 23m14-24-4 22m16-24-5 20"
            stroke="#C39C7F"
            fill="none"
            strokeWidth={1.2}
          />
          <Path
            d="M99 80q24-12 61 13M110 85l22 16"
            stroke="#EDD2D7"
            opacity={0.7}
            strokeWidth={2}
            fill="none"
          />
          <Path d="M125 44q-5-8 3-7" stroke="#8E6747" fill="none" />
        </>
      );
    case 'adoption':
      return (
        <>
          <Path d="M87 73h14v15H87z" fill={paint(id, 'glass')} />
          <Path d="M94 73v15m-7-8h14M78 110h65" stroke="#EFE2C6" strokeWidth={1.3} />
          <Path d="M155 78v26m28-26v26m-25-13h22" stroke="#DFC49D" opacity={0.6} />
          <Rect x={165} y={87} width={11} height={7} rx={1} fill={gold} />
        </>
      );
    case 'home':
      return (
        <>
          <Path
            d="M80 68l50-34 50 34M89 63l82 0m-69-9h56m-44-8h30"
            fill="none"
            stroke="#A6B5C5"
            opacity={0.45}
          />
          <Path
            d="M88 103h23m-20 5h18m40-6h22m-17 5h18M101 79v16m-8-8h16"
            stroke="#D7D5C7"
            strokeWidth={1}
          />
          <Circle cx={137} cy={96} r={1.5} fill={gold} />
          <Path d="M115 114h33l8 12h-50z" fill="#B9B0A3" />
          <Path d="M72 114v-12m-6 6h12m99 6v-17m-7 8h14" stroke="#6C8F72" strokeWidth={4} />
        </>
      );
    case 'service':
      return (
        <>
          <Path d="M90 46h82v57H90z" stroke="#BD944F" strokeWidth={1} fill="none" />
          <Path d="M102 90q4-8 8 0l6-4m10 4h13" stroke="#60616A" fill="none" />
          <Circle cx={155} cy={96} r={7} fill="none" stroke="#F7D89B" />
          <Path d="M151 96l3 3 6-7" stroke="#F7D89B" strokeWidth={1.5} fill="none" />
        </>
      );
    case 'remembrance':
      return (
        <>
          <Ellipse cx={130} cy={107} rx={25} ry={5} fill={steel} />
          <Ellipse cx={130} cy={68} rx={17} ry={4} fill={paper} />
          <Path d="M120 72v22q3 7 5 0V73m5-8v6" stroke="#EADAC1" strokeWidth={2} fill="none" />
          <Path d="M130 59q-6-4 1-15 5 11-1 15" fill="#FFE6A1" />
          <Path d="M89 99l-6-6m13 11-3-7m66 6 6-7m-1 5 10-5" stroke="#A4B49B" />
        </>
      );
    case 'wedding':
      return (
        <>
          <Gem x={149} y={49} size={10} />
          <Path
            d="M93 66q10-13 22-8m24 37q14 4 25-12"
            stroke="#FFF1BD"
            strokeWidth={2}
            fill="none"
          />
          {[72, 82, 181, 192].map((x, i) => (
            <G key={x}>
              <Circle cx={x} cy={105 - (i % 2) * 6} r={5} fill={paper} />
              <Circle cx={x} cy={105 - (i % 2) * 6} r={2} fill="#D5A3A4" />
            </G>
          ))}
        </>
      );
    case 'new-job':
      return (
        <>
          <Path d="M85 58v43m90-43v43M86 104h88" stroke="#A9BBC3" opacity={0.5} fill="none" />
          <Path d="M110 50v-9q20-14 40 0v9" stroke="#9CA9B0" fill="none" />
          <Path d="M126 78h8v7h-8z" fill={gold} />
          <Rect x={153} y={86} width={16} height={10} rx={1} fill={paper} />
          <Path d="M156 89h10m-10 3h6" stroke="#778390" strokeWidth={0.7} />
        </>
      );
    case 'retirement':
      return (
        <>
          <Path d="M75 111q60-8 120 0m-130 7h129" stroke="#CCB99B" opacity={0.6} fill="none" />
          <Path
            d="M94 63l6 9m0-2 7 9m2 5 13-2m-4 0 12 1m-3 0 12 1"
            stroke="#EDD3B6"
            strokeWidth={2}
          />
          <Path d="M176 98v-17m-10 17h20" stroke="#A4B5C1" strokeWidth={2} />
          <Ellipse cx={176} cy={81} rx={13} ry={3} fill={paint(id, 'wood')} />
          <Path d="M172 77v-9h6v9" fill={paper} />
        </>
      );
    case 'championship':
      return (
        <>
          <Circle cx={130} cy={88} r={21} fill="none" stroke="#FFF0B5" strokeWidth={1} />
          <Path d="M98 32l18 36m44-36-18 36" stroke="#A3CBC0" strokeWidth={2} />
          <Path d="M109 92q4 13 17 16m8 0q13-3 17-16" stroke="#9A6C34" fill="none" />
          <Path d="M110 94l4 2m0 4 4 1m23 1 4-2m1-5 4-2" stroke="#9A6C34" />
        </>
      );
    case 'music':
      return (
        <>
          <Circle cx={124} cy={73} r={39} stroke="#A9A3B2" strokeWidth={0.6} fill="none" />
          <Circle cx={124} cy={73} r={29} stroke="#A9A3B2" strokeWidth={0.6} fill="none" />
          <Path d="M94 46l13 18-15 3m44 18 14 21 8-10" fill="#BCC8D8" opacity={0.16} />
          <Path d="M156 100l-5 9 7 3 5-9z" fill={gold} />
          <Path d="M119 65h10m-12 16h14" stroke="#7F5156" strokeWidth={0.6} />
        </>
      );
    case 'acting':
      return (
        <>
          <Path
            d="M92 82h25m-25 8h25m-25 8h25m36-16h17m-17 8h17m-17 8h17"
            stroke="#A2AAB9"
            strokeWidth={1}
          />
          <Circle cx={88} cy={67} r={2} fill={steel} />
          <Path d="M88 107h86" stroke="#8999A7" strokeWidth={1} />
        </>
      );
    case 'modeling':
      return (
        <>
          <Circle cx={131} cy={80} r={19} fill="none" stroke="#A4B5C1" strokeWidth={1} />
          <Circle cx={131} cy={80} r={14} fill={paint(id, 'glass')} />
          <Circle cx={131} cy={80} r={8} fill="#254856" />
          <Circle cx={126} cy={75} r={3} fill="#D4EAF3" />
          <Path d="M80 60v38m4-38v38m4-38v38m4-38v38" stroke="#BEA1B3" opacity={0.3} />
          <Path d="M105 42h48m-50 4h52" stroke="#CBB1C3" opacity={0.5} />
        </>
      );
  }
}
