import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { IconName } from './icons';
import { Gem, paint } from './artMaterials';

/** Objects use their own silhouettes; navigation affordances remain simple line glyphs. */
export function MenuObject({ name, id }: { name: IconName; id: string }) {
  const gold = paint(id, 'gold'),
    steel = paint(id, 'steel'),
    wood = paint(id, 'wood'),
    dark = paint(id, 'black'),
    glass = paint(id, 'glass'),
    paper = paint(id, 'paper'),
    cloth = paint(id, 'cloth');
  const outline = '#34434E';
  switch (name) {
    case 'career':
      return (
        <>
          <Path d="M15 15v-4q9-7 18 0v4" stroke="#98663E" strokeWidth={3} fill="none" />
          <Rect
            x={5}
            y={14}
            width={38}
            height={27}
            rx={3}
            fill={paint(id, 'leather')}
            stroke="#4C322B"
          />
          <Path d="M6 25q18 8 36 0M11 16v23m26-23v23" stroke="#D3A573" fill="none" />
          <Rect x={21} y={26} width={6} height={5} rx={1} fill={gold} />
        </>
      );
    case 'assets':
    case 'collection':
      return <Gem x={24} y={23} size={18} color={name === 'assets' ? '#73B3CB' : '#B68EBB'} />;
    case 'money':
      return (
        <>
          <Path d="M5 16l30-6 8 25-30 7z" fill="#547C63" stroke="#2C5444" />
          <Path d="M5 12h36v23H5z" fill="#86A88C" stroke="#466E55" strokeWidth={1.5} />
          <Path d="M8 16h30v15H8z" fill="none" stroke="#C9D8AF" />
          <Ellipse cx={23} cy={23.5} rx={6} ry={8} fill="#D5D6B0" />
          <Path d="M23 18v11m3-9q-8-3-5 3l4 1q3 5-6 3" stroke="#5D7860" fill="none" />
          <Ellipse cx={36} cy={37} rx={8} ry={3} fill={gold} />
          <Ellipse cx={36} cy={34} rx={8} ry={3} fill={gold} />
        </>
      );
    case 'home':
      return (
        <>
          <Path d="M8 23h31v19H8z" fill={paper} stroke="#A39179" />
          <Path d="M5 23 23 7l20 16z" fill={wood} stroke="#674B42" />
          <Path d="M29 12V6h6v11" fill="#A66F5D" />
          <Rect x={20} y={28} width={8} height={14} fill={wood} />
          <Path d="M11 27h6v8h-6zm20 0h5v8h-5z" fill={glass} />
          <Path d="M7 42h34" stroke="#6C8B6B" strokeWidth={3} />
        </>
      );
    case 'vehicle':
      return (
        <>
          <Path d="M3 31l3-8 7-1 8-10h14l7 12 3 4v11H3z" fill={cloth} stroke={outline} />
          <Path d="M17 23l7-8h9l5 8z" fill={glass} />
          <Path d="M6 27h9m23 1h5" stroke="#EBEAD7" strokeWidth={2} />
          {[12, 36].map((x) => (
            <G key={x}>
              <Circle cx={x} cy={37} r={6} fill={dark} />
              <Circle cx={x} cy={37} r={3.5} fill={steel} />
              <Circle cx={x} cy={37} r={1} fill={dark} />
            </G>
          ))}
        </>
      );
    case 'business':
      return (
        <>
          <Path d="M7 43V12l22-7 12 7v31z" fill={cloth} stroke={outline} />
          <Path d="M29 5v38h12V12z" fill="#435465" />
          {[15, 23, 31].map((y) => (
            <Path key={y} d={`M12 ${y}h5m5-1h4m7 1h4`} stroke="#CCDCE1" strokeWidth={3} />
          ))}
          <Path d="M20 43v-7h6v7" fill={dark} />
        </>
      );
    case 'shopping':
      return (
        <>
          <Path d="M6 17h15l3 25H3z" fill={cloth} stroke={outline} />
          <Path d="M9 18v-6q4-6 8 0v6" stroke="#A4B5C1" strokeWidth={2} fill="none" />
          <Path d="M23 22h19l4 20H20z" fill={paper} stroke="#A48F70" />
          <Path d="M27 24v-7q5-5 10 0v7" stroke="#98663E" strokeWidth={2} fill="none" />
        </>
      );
    case 'invest':
      return (
        <>
          <Path d="M5 39V24h8v15zm13 0V17h8v22zm13 0V8h8v31z" fill={gold} stroke="#91703F" />
          <Path d="M4 22 17 13l8 3L40 4m-9 0h9v9" stroke="#488479" strokeWidth={2.5} fill="none" />
        </>
      );
    case 'news':
    case 'estate':
      return (
        <>
          <Path d="M10 7h30v34H10q-6 0-6-6V13h6z" fill={paper} stroke="#9D9C91" />
          <Path d="M10 13v25q0 3-3 3" stroke="#9D9C91" fill="none" />
          <Path d="M15 12h20m-20 5h20" stroke="#48566C" strokeWidth={2} />
          <Rect x={15} y={22} width={9} height={9} fill={cloth} />
          <Path d="M28 23h7m-7 4h7m-7 4h7m-20 5h20" stroke="#8B8C86" />
          {name === 'estate' ? <Path d="M25 36 42 17l2 2-17 19-4 2z" fill={gold} /> : null}
        </>
      );
    case 'relationships':
    case 'family':
    case 'friends':
    case 'advisor':
      return (
        <>
          <Path d="M4 43q0-17 14-17t14 17" fill={cloth} stroke={outline} />
          <Ellipse cx={18} cy={17} rx={8} ry={10} fill={paint(id, 'skin')} />
          <Path d="M10 17V12q7-12 15-1l2 6-5-6-11 4z" fill={wood} />
          <Path d="M12 30l6 9 6-9" fill={paper} />
          {name === 'advisor' ? (
            <>
              <Path d="M27 12h17v18H27z" fill={paper} stroke="#98663E" />
              <Path d="M30 25l4-5 3 2 4-7" stroke="#638D7A" strokeWidth={2} fill="none" />
              <Rect x={5} y={39} width={40} height={4} fill={wood} />
            </>
          ) : (
            <>
              <Path d="M26 43q-1-13 9-13t10 13" fill="#A75B72" />
              <Ellipse
                cx={35}
                cy={name === 'family' ? 25 : 21}
                rx={6}
                ry={8}
                fill={paint(id, 'skin')}
              />
              <Path
                d={name === 'family' ? 'M29 25q-2-12 9-8l4 8-6-5z' : 'M29 21q-3-13 9-9l4 9-5-5z'}
                fill={dark}
              />
            </>
          )}
        </>
      );
    case 'love':
    case 'adoption':
      return (
        <>
          <Path d="M24 34 8 20C-2 7 17-1 24 11c9-13 25-3 16 9z" fill="#B94F6E" stroke="#853C54" />
          <Path d="M9 13q2-6 9-4" stroke="#F3BCC9" strokeWidth={2} fill="none" />
          {name === 'adoption' ? (
            <Path
              d="M4 28q5-1 13 10h14q8-11 13-10-2 17-20 17T4 28"
              fill={paint(id, 'skin')}
              stroke="#B78768"
            />
          ) : null}
        </>
      );
    case 'activities':
      return (
        <>
          <Path d="M7 39l4-22h24l6 22z" fill={cloth} stroke={outline} />
          <Path d="M14 17V9h18v8" stroke="#98663E" strokeWidth={3} fill="none" />
          <Path d="M14 28h9m-4-4v8" stroke="#EFE2C6" strokeWidth={2} />
          <Circle cx={31} cy={25} r={2} fill="#E6B65E" />
          <Circle cx={35} cy={30} r={2} fill="#C96981" />
        </>
      );
    case 'mind':
      return (
        <>
          <Path d="M6 39q3-19 18-19t18 19z" fill={cloth} />
          <Circle cx={24} cy={12} r={7} fill={paint(id, 'skin')} />
          <Path d="M12 29l-7 8 17 5m14-13 7 8-17 5" fill="none" stroke="#D8AA84" strokeWidth={4} />
          <Path d="M19 28l5 6 5-6" fill="none" stroke="#EFE2C6" />
        </>
      );
    case 'doctor':
      return (
        <>
          <Rect x={5} y={15} width={38} height={27} rx={4} fill={paper} stroke="#8E9EA4" />
          <Path d="M16 15V9h16v6" stroke="#A4B5C1" strokeWidth={3} fill="none" />
          <Path d="M21 21h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill="#B85C65" />
        </>
      );
    case 'crime':
      return (
        <>
          <Path d="M6 15q18-15 36 0l-4 20-14 8-14-8z" fill={dark} stroke={outline} />
          <Path d="M10 21l10 3-3 6-7-3zm28 0-10 3 3 6 7-3z" fill="#B5BAC0" />
          <Path d="M19 35h10" stroke="#A4B5C1" />
        </>
      );
    case 'gambling':
      return (
        <>
          <Path d="M8 8l25-3 5 33-25 3z" fill={paper} stroke="#A8A29A" />
          <Rect x={17} y={14} width={26} height={27} rx={4} fill="#A64559" stroke="#6D3E50" />
          {[
            [23, 20],
            [36, 20],
            [30, 27],
            [23, 35],
            [36, 35],
          ].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={2} fill={paper} />
          ))}
        </>
      );
    case 'social':
      return (
        <>
          <Rect
            x={12}
            y={4}
            width={25}
            height={40}
            rx={5}
            fill={dark}
            stroke="#A4B5C1"
            strokeWidth={1.5}
          />
          <Rect x={15} y={9} width={19} height={28} rx={1} fill={glass} />
          <Circle cx={24.5} cy={40} r={1.5} fill={steel} />
          <Path d="M8 14h19v11H15l-6 5 1-5H8z" fill="#679A88" stroke="#3F776B" />
          <Path d="M12 18h11m-11 4h8" stroke="#EFE2C6" />
        </>
      );
    case 'pets':
      return (
        <>
          <Path d="M10 13 3 8l1 22 9 6m25-23 7-5-1 22-9 6" fill={wood} stroke="#664C3C" />
          <Path d="M10 14q14-10 28 0v17q-14 20-28 0z" fill={paper} stroke="#A18B6B" />
          <Path d="M11 14q11-9 13-1v14H11z" fill={wood} />
          <Circle cx={17} cy={24} r={2} fill={dark} />
          <Circle cx={31} cy={24} r={2} fill={dark} />
          <Path d="M19 32q5-5 10 0l-5 5z" fill={dark} />
          <Path d="M24 36v4m-5-2q5 5 10 0" stroke="#795B4D" fill="none" />
        </>
      );
    case 'nightlife':
      return (
        <>
          <Path d="M6 9h36L24 28z" fill={glass} stroke="#91B2BA" />
          <Path d="M11 14h26L24 27z" fill="#BE6C8A" />
          <Path d="M24 28v13m-9 2h18" stroke="#A4B5C1" strokeWidth={2} />
          <Circle cx={35} cy={11} r={7} fill="#B7C78A" stroke="#6F9A63" />
          <Path d="M35 5v12m-5-8 10 5" stroke="#ECEDBC" />
        </>
      );
    case 'vacation':
      return (
        <>
          <Circle cx={32} cy={13} r={8} fill={gold} />
          <Path d="M4 37q20-8 40 0v7H4z" fill="#D8C295" />
          <Path d="M18 39q-2-16 7-27" stroke="#98663E" strokeWidth={4} fill="none" />
          <Path
            d="M24 13Q10 3 4 16q11-4 20-3Q35 1 44 13q-10-1-20 0Q16-1 11 6l13 7"
            fill="#5A8A6A"
          />
          <Path d="M4 42q5-3 10 0t10 0 10 0 10 0" stroke="#86B6C6" strokeWidth={2} fill="none" />
        </>
      );
    case 'relocate':
    case 'parcel':
      return (
        <>
          <Path d="M5 15 24 6l19 9v23l-19 7L5 37z" fill={paper} stroke="#AB916C" />
          <Path d="M5 15l19 8 19-8m-19 8v22" stroke="#AB916C" />
          <Path d="M18 9l19 9v9l-7 3v-9L11 13z" fill="#C1A77F" />
          {name === 'relocate' ? (
            <Path d="M9 30h12m-5-5 5 5-5 5" stroke="#557B8A" strokeWidth={2} fill="none" />
          ) : null}
        </>
      );
    case 'surgery':
      return (
        <G transform="rotate(40 24 24)">
          <Rect x={19} y={12} width={10} height={23} rx={1} fill={glass} stroke="#577C8E" />
          <Path
            d="M24 35v11m-8-34h16m-8 0V5m-6 0h12M20 19h4m-4 5h4m-4 5h4"
            stroke="#A4B5C1"
            strokeWidth={2}
          />
        </G>
      );
    case 'salon':
      return (
        <>
          <Ellipse cx={14} cy={34} rx={7} ry={8} fill="none" stroke="#BD944F" strokeWidth={3} />
          <Ellipse cx={35} cy={34} rx={7} ry={8} fill="none" stroke="#BD944F" strokeWidth={3} />
          <Path d="M17 28 36 3l-6 21-10 9m12-5L13 3l6 21 10 9" fill={steel} stroke="#6E818E" />
          <Circle cx={24.5} cy={23} r={2} fill={gold} />
        </>
      );
    case 'lawsuit':
    case 'auction':
      return (
        <>
          <G transform="rotate(-30 24 24)">
            <Rect x={10} y={7} width={25} height={12} rx={2} fill={wood} stroke="#644632" />
            <Path d="M13 8v10m19-10v10" stroke="#BD944F" strokeWidth={2} />
            <Path d="M23 19v23" stroke="#98663E" strokeWidth={6} />
          </G>
          <Path d="M9 42h26v4H9z" fill={wood} />
          {name === 'lawsuit' ? (
            <Path d="M34 28h11m-6-5v17m-6-7h12" stroke="#BD944F" strokeWidth={1.5} />
          ) : null}
        </>
      );
    case 'school':
      return (
        <>
          <Path d="M11 23v12q13 9 26 0V23" fill={cloth} stroke={outline} />
          <Path d="M3 18 24 7l21 11-21 11z" fill={dark} stroke={outline} />
          <Path d="M24 18l18 3v16" stroke="#BD944F" strokeWidth={2} fill="none" />
          <Path d="M39 36h6l-1 7h-4z" fill={gold} />
        </>
      );
    case 'music':
      return (
        <>
          <Ellipse cx={24} cy={23} rx={18} ry={20} fill={dark} />
          <Circle cx={24} cy={23} r={13} fill="none" stroke="#66717F" />
          <Circle cx={24} cy={23} r={6} fill="#B96776" />
          <Circle cx={24} cy={23} r={1.5} fill={paper} />
          <Path d="M30 39 41 8h4" stroke="#BD944F" strokeWidth={2} />
        </>
      );
    case 'trophy':
      return (
        <>
          <Path
            d="M14 9H5v7q0 12 13 12m16-19h9v7q0 12-13 12"
            stroke="#BD944F"
            strokeWidth={3}
            fill="none"
          />
          <Path
            d="M13 6h22v12q0 11-9 14v6h8v6H14v-6h8v-6q-9-3-9-14z"
            fill={gold}
            stroke="#947039"
          />
          <Path d="M19 10v8q0 6 4 8" stroke="#FFF0BD" strokeWidth={2} fill="none" />
        </>
      );
    case 'card':
      return (
        <>
          <Rect x={3} y={10} width={42} height={29} rx={4} fill={cloth} stroke={outline} />
          <Path d="M4 18h40" stroke="#283542" strokeWidth={6} />
          <Rect x={8} y={26} width={8} height={6} rx={1} fill={gold} />
          <Path d="M20 31h6m3 0h6" stroke="#EFE2C6" />
        </>
      );
    case 'film':
      return (
        <>
          <Rect x={5} y={20} width={38} height={23} rx={2} fill={dark} />
          <Path d="M5 19 3 10l37-7 2 9z" fill={dark} stroke="#A4B5C1" />
          <Path d="M9 9l6 6m5-8 6 6m5-8 6 6" stroke="#EFE2C6" strokeWidth={4} />
          <Path d="M11 27h26m-26 6h26m-26 5h17" stroke="#82929D" />
        </>
      );
    case 'camera':
      return (
        <>
          <Path d="M8 15l5-7h21l5 7" fill={dark} />
          <Rect x={3} y={14} width={42} height={27} rx={4} fill={dark} stroke="#A4B5C1" />
          <Circle cx={25} cy={28} r={11} fill={steel} />
          <Circle cx={25} cy={28} r={8.5} fill={glass} />
          <Circle cx={25} cy={28} r={5} fill="#29464F" />
          <Circle cx={22} cy={25} r={2} fill="#DDF7FF" />
          <Rect x={35} y={18} width={6} height={4} rx={1} fill={paper} />
        </>
      );
    case 'art':
      return (
        <>
          <Rect x={4} y={6} width={40} height={37} fill={wood} stroke="#5D4939" />
          <Rect x={8} y={10} width={32} height={29} fill="#9BB8BE" />
          <Circle cx={31} cy={17} r={5} fill="#E8CC8B" />
          <Path d="M8 35l12-18 11 13 9-8v17H8z" fill="#5D7C71" />
          <Path d="M8 39l20-11 12 11" fill="#91A77F" />
        </>
      );
    case 'watch':
      return (
        <>
          <Rect x={17} y={2} width={14} height={44} rx={3} fill={paint(id, 'leather')} />
          <Circle cx={24} cy={24} r={16} fill={gold} stroke="#765C37" />
          <Circle cx={24} cy={24} r={12} fill={glass} />
          {[0, 1, 2, 3].map((i) => (
            <Path key={i} d="M24 14v2" transform={`rotate(${i * 90} 24 24)`} stroke="#EFE2C6" />
          ))}
          <Path d="M17 20l7 4 6-7" stroke="#EFE2C6" strokeWidth={1.5} fill="none" />
          <Rect x={40} y={21} width={3} height={6} rx={1} fill={gold} />
        </>
      );
    case 'debug':
      return (
        <>
          <Path d="M8 12h32M8 24h32M8 36h32" stroke="#A4B5C1" strokeWidth={4} />
          <Circle cx={17} cy={12} r={5} fill={gold} />
          <Circle cx={32} cy={24} r={5} fill={gold} />
          <Circle cx={21} cy={36} r={5} fill={gold} />
        </>
      );
    case 'chevron':
    case 'back':
    case 'ellipsis':
    case 'close':
      return null;
  }
}
