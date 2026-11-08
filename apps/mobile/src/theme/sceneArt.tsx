import { watchProfiles } from './watchArtProfiles';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect, Ellipse, G, Text as SvgText } from 'react-native-svg';
import { findValuable, findVehicleTrim, type Valuable, type VehicleBody } from '@yearafter/content';
import type { Lot } from '@yearafter/simulation';
import { Fragment, type ReactNode } from 'react';
import { Gem, Materials, paint, useArtId } from './artMaterials';
import { MilestoneDetails } from './milestoneDetails';
import { Collectible } from './collectibleArt';
import { radii, spacing } from './theme';

function artSeed(id: string): number {
  return (
    [...id].reduce(
      (hash, letter) => Math.imul(hash ^ letter.charCodeAt(0), 16777619),
      2166136261,
    ) >>> 0
  );
}

const paints = ['#407E83', '#8F4862', '#475D91', '#9C6940', '#5C5676', '#367083'];

function Frame({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, compact && styles.compact]}
    >
      <Svg width="100%" height={compact ? 104 : 146} viewBox="0 0 260 146">
        {children}
      </Svg>
    </View>
  );
}

function Backdrop({ color = '#F0E8F8' }: { color?: string }) {
  return (
    <>
      <Ellipse cx={130} cy={126} rx={77} ry={8} fill="#283744" opacity={0.08} />
      <Ellipse cx={130} cy={125} rx={52} ry={4} fill={color} opacity={0.5} />
    </>
  );
}

const watchMetal = {
  steel: '#B5C1CA',
  gold: '#D3AB57',
  rose: '#D5A097',
  black: '#51515D',
  titanium: '#949DAB',
};
const watchCases = {
  square: 'M101 42q0-8 8-8h42q8 0 8 8v62q0 8-8 8h-42q-8 0-8-8z',
  tank: 'M105 32h50v82h-50z',
  octagon: 'M111 34h38l19 19v40l-19 19h-38L92 93V53z',
  triangle: 'M103 36l65 37-65 37-13-37z',
  barrel: 'M101 34q29-9 58 0 14 39 0 78-29 9-58 0-14-39 0-78z',
};

/** Follow each bezel instead of putting a circular stone ring over square dials. */
function bezelPoint(shape: string, index: number): readonly [number, number] {
  if (shape === 'round' || shape === 'barrel') {
    const angle = (index * Math.PI) / 8;
    return [130 + Math.sin(angle) * (shape === 'barrel' ? 29 : 35), 73 - Math.cos(angle) * 36];
  }
  const vertices: readonly (readonly [number, number])[] =
    shape === 'tank'
      ? [
          [108, 35],
          [152, 35],
          [152, 111],
          [108, 111],
        ]
      : shape === 'triangle'
        ? [
            [104, 40],
            [163, 73],
            [104, 106],
            [94, 73],
          ]
        : shape === 'octagon'
          ? [
              [112, 38],
              [148, 38],
              [164, 54],
              [164, 92],
              [148, 108],
              [112, 108],
              [96, 92],
              [96, 54],
            ]
          : [
              [106, 39],
              [154, 39],
              [154, 107],
              [106, 107],
            ];
  const position = (index / 16) * vertices.length;
  const start = vertices[Math.floor(position)] ?? [130, 37];
  const end = vertices[(Math.floor(position) + 1) % vertices.length] ?? start;
  const fraction = position % 1;
  return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
}

function Watch({ item, iced }: { item: Valuable; iced: boolean }) {
  const model = item.id.slice('val.watch.'.length);
  const [shape, metalName, dial, band, face] =
    watchProfiles[model] ?? (['round', 'steel', '#263C51', 'leather', 'plain'] as const);
  const id = useArtId();
  const metal = paint(id, metalName);
  const metalColor = watchMetal[metalName];
  const brightDial = parseInt(dial.slice(1, 3), 16) > 150;
  const marks = brightDial ? '#3A3340' : '#FFF2D8';
  const links = band === 'links' || band === 'fine-links' || band === 'gems';
  const glitz = iced || item.icing?.kind === 'factory';
  const bandColor = links
    ? metal
    : band === 'rubber'
      ? '#30333F'
      : band === 'fabric'
        ? '#626C53'
        : '#5A3A3D';
  const radius = shape === 'triangle' || shape === 'tank' ? 17 : 22;
  return (
    <>
      <Materials id={id} color={dial} />
      <Backdrop color={band === 'gems' ? '#F6E3AE' : '#F5EBD7'} />
      <Rect
        x={109}
        y={5}
        width={42}
        height={136}
        rx={8}
        fill={links ? metal : band === 'leather' ? paint(id, 'leather') : bandColor}
      />
      <Path d="M116 9v128m28-128v128" stroke="#FFFFFF" opacity={0.42} />
      {links ? (
        <>
          <Rect x={122} y={7} width={16} height={132} rx={3} fill={metal} opacity={0.6} />
          <Path d="M121 9v128m18-128v128" stroke="#F1EAD9" opacity={0.6} />
        </>
      ) : null}
      {links ? (
        Array.from({ length: band === 'fine-links' ? 22 : 15 }, (_, i) => (
          <Path
            key={i}
            d={`M110 ${10 + i * (band === 'fine-links' ? 6 : 9)}h40`}
            stroke="#4F4650"
            opacity={0.46}
          />
        ))
      ) : (
        <Path
          d={
            band === 'fabric'
              ? 'M121 10v125m5-125v125m8-125v125m5-125v125'
              : 'M127 16h6m-6 8h6m-6 8h6m-6 82h6m-6 8h6m-6 8h6'
          }
          stroke="#FFFFFF"
          opacity={0.25}
          strokeWidth={2}
        />
      )}
      {band === 'gems'
        ? [11, 21, 121, 131].map((y) => (
            <Path
              key={y}
              d={`M112 ${y}h36v7h-36zm12 0v7m12-7v7`}
              fill="#F9DE86"
              stroke="#9D793A"
              strokeWidth={1.5}
            />
          ))
        : null}
      <Path
        d="M105 28l-5 21h9l5-20m31-1 15 21h-10l-8-20M105 118l-5-21h9l5 20m31 1 15-21h-10l-8 20"
        fill={metal}
        stroke={metalColor}
        strokeWidth={1}
      />
      <Rect
        x={shape === 'tank' || shape === 'square' ? 153 : 163}
        y={67}
        width={8}
        height={12}
        rx={3}
        fill={metal}
      />
      {face === 'chrono' ? (
        <Path d="M164 49l7-2 3 8-7 2m-1 32 7 2-3 8-7-2" fill={metal} stroke="#54616C" />
      ) : null}
      {shape === 'round' ? (
        <>
          <Circle cx={130} cy={73} r={39} fill={metal} stroke="#473B49" strokeWidth={1.3} />
          <Circle
            cx={130}
            cy={73}
            r={34}
            fill={face === 'dive' || face === 'gmt' ? '#263547' : metal}
          />
          {face === 'gmt' ? <Path d="M96 73a34 34 0 0 0 68 0z" fill="#AD4B59" /> : null}
          <Circle
            cx={130}
            cy={73}
            r={face === 'dive' || face === 'gmt' ? 27 : 31}
            fill={paint(id, 'paint')}
          />
        </>
      ) : (
        <>
          <Path d={watchCases[shape]} fill={metal} stroke="#473B49" strokeWidth={1.3} />
          <Path
            d={watchCases[shape]}
            transform="translate(130 73) scale(.79) translate(-130 -73)"
            fill={paint(id, 'paint')}
          />
        </>
      )}
      {shape === 'octagon'
        ? [
            [111, 40],
            [149, 40],
            [161, 55],
            [161, 91],
            [149, 106],
            [111, 106],
            [99, 91],
            [99, 55],
          ].map(([x, y], i) => (
            <G key={i}>
              <Circle cx={x} cy={y} r={1.8} fill="#D8E1E6" stroke="#586670" strokeWidth={0.6} />
              <Path d={`M${(x ?? 0) - 1} ${(y ?? 0) + 1}l2-2`} stroke="#586670" strokeWidth={0.6} />
            </G>
          ))
        : null}
      {face !== 'digital' && face !== 'smart'
        ? Array.from({ length: 60 }, (_, i) => (
            <Path
              key={i}
              d={`M130 ${73 - radius - 5}v${i % 5 === 0 ? 2.6 : 1.2}`}
              transform={`rotate(${i * 6} 130 73)`}
              stroke={marks}
              strokeWidth={i % 5 === 0 ? 0.65 : 0.35}
              opacity={0.85}
            />
          ))
        : null}
      {face === 'digital' || face === 'smart' ? (
        <>
          <Rect
            x={110}
            y={56}
            width={40}
            height={32}
            rx={4}
            fill={face === 'smart' ? '#202A3D' : '#BCD2B6'}
          />
          {face === 'smart' ? (
            <>
              <Circle cx={130} cy={72} r={11} fill="none" stroke="#F38480" strokeWidth={2} />
              <Circle cx={130} cy={72} r={7} fill="none" stroke="#7DCCA3" strokeWidth={2} />
              <Circle cx={130} cy={72} r={3} fill="#81C3E1" />
            </>
          ) : (
            <Path
              d="M116 64h7v17m-7-8h7m5-9h6v17h-6zm11 0h7v9h-7v8h7"
              fill="none"
              stroke="#263F3D"
              strokeWidth={2}
            />
          )}
        </>
      ) : (
        <>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <Circle
                key={i}
                cx={130 + Math.sin(a) * radius}
                cy={73 - Math.cos(a) * radius}
                r={i % 3 === 0 ? 2 : 1}
                fill={marks}
              />
            );
          })}
          {face === 'chrono' || face === 'open'
            ? [
                [119, 71],
                [141, 71],
                [130, 84],
              ].map(([x, y]) => (
                <Circle
                  key={x}
                  cx={x}
                  cy={y}
                  r={5.5}
                  fill={face === 'open' ? paint(id, 'gold') : dial}
                  stroke={marks}
                  strokeWidth={0.6}
                />
              ))
            : null}
          {face === 'chrono' || face === 'open'
            ? [
                [119, 71],
                [141, 71],
                [130, 84],
              ].map(([x, y], i) => (
                <G key={i}>
                  <Circle cx={x} cy={y} r={4} fill="none" stroke={marks} strokeWidth={0.35} />
                  <Path d={`M${x} ${y}v-3m0 3 2 1`} stroke={marks} strokeWidth={0.6} />
                </G>
              ))
            : null}
          <SvgText
            x={130}
            y={61}
            fill={marks}
            fontSize={2.8}
            textAnchor="middle"
            letterSpacing={0.5}
          >
            {item.brand.toUpperCase()}
          </SvgText>
          {face === 'date' || face === 'day-date' ? (
            <Rect
              x={143}
              y={70}
              width={8}
              height={6}
              rx={1}
              fill="#FAEBD4"
              stroke="#86725B"
              strokeWidth={0.6}
            />
          ) : null}
          {face === 'date' || face === 'day-date' ? (
            <SvgText x={147} y={74.7} fontSize={4.5} textAnchor="middle" fill="#292F39">
              21
            </SvgText>
          ) : null}
          {face === 'day-date' ? (
            <Rect x={123} y={56} width={14} height={4} rx={1} fill="#FAEBD4" />
          ) : null}
          {face === 'dive' ? <Path d="M130 40l-3 6h6z" fill="#FFF2D8" /> : null}
          <Path
            d="M116 63l14 10 14-10"
            stroke={marks}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={130} cy={73} r={2.5} fill={marks} />
        </>
      )}
      <Path
        d={shape === 'round' ? 'M104 60q8-18 26-17l15 4-40 45q-9-17-1-32z' : 'M110 43h32l-32 53z'}
        fill="#FFFFFF"
        opacity={0.12}
      />
      <Path
        d={`M${shape === 'tank' || shape === 'square' ? 155 : 165} 69h4m-4 3h4m-4 3h4`}
        stroke="#283642"
        strokeWidth={0.6}
      />
      {glitz
        ? Array.from({ length: 16 }, (_, i) => {
            const [x, y] = bezelPoint(shape, i);
            return (
              <Gem key={i} x={x} y={y} size={3} color={band === 'gems' ? '#E6C76E' : '#BDDCE8'} />
            );
          })
        : null}
    </>
  );
}

const roof: Record<VehicleBody, string> = {
  sedan: 'L75 77 104 53h55l28 25',
  hatch: 'L69 77 95 53h68l25 25',
  suv: 'L62 78 87 44h89l22 34',
  truck: 'L61 79 80 47h62l20 33h37',
  minivan: 'L58 77 91 46h91l19 31',
  coupe: 'L65 81 104 58h53l32 22',
  convertible: 'L80 80 103 66l7 14h60',
  wagon: 'L66 77 94 50h82l16 28',
  van: 'L52 77 78 44h110l14 36',
};

export function VehicleArt({ trimId, compact }: { trimId: string; compact?: boolean }) {
  const id = useArtId();
  const found = findVehicleTrim(trimId);
  if (!found) return null;
  const model = found.model;
  const seed = artSeed(model.id);
  const color = paints[artSeed(trimId) % paints.length];
  const sporty = model.market === 'exotic' || model.body === 'coupe';
  const tall = ['suv', 'van', 'minivan'].includes(model.body);
  const roofY = sporty ? 61 : tall ? 42 : 53;
  const rear = model.body === 'truck' ? 143 : tall ? 190 : 172;
  const window =
    model.body === 'truck'
      ? 'M81 75l12-23h41l12 23z'
      : `M81 76l26-${76 - roofY - 6}h${rear - 110}l17 ${76 - roofY - 6}z`;
  const shell = `M29 101q1-20 32-22${roof[model.body]}q33 4 40 16l2 14H31z`;
  return (
    <Frame compact={compact}>
      <Materials id={id} color={color} />
      <Backdrop color="#CED5DB" />
      <Ellipse cx={131} cy={123} rx={104} ry={6} fill="#1C2833" opacity={0.17} />
      <Path
        d={shell}
        fill={paint(id, 'paint')}
        stroke="#253449"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <Path d="M31 105h195l-4 8H35z" fill="#25313C" />
      <Path
        d="M34 91q70-8 119-7l64 4"
        stroke="#FFFFFF"
        opacity={0.65}
        strokeWidth={1.3}
        fill="none"
      />
      {model.body !== 'convertible' ? (
        <>
          <Path d={window} fill={paint(id, 'glass')} stroke="#24313B" strokeWidth={2} />
          <Path d={`M${128 + (seed % 9)} ${roofY + 6}v22`} stroke="#1D2B37" strokeWidth={4} />
          <Path
            d={`M107 ${roofY + 8}l-17 ${70 - roofY}m25-${70 - roofY}L100 73`}
            stroke="#DDF6FF"
            opacity={0.5}
            strokeWidth={1.4}
          />
        </>
      ) : (
        <>
          <Path d="M99 64l10 16H77z" fill={paint(id, 'glass')} stroke="#384B59" />
          <Path d="M119 80v-8q7-6 12 0v8m24 0v-8q7-6 12 0v8" fill={paint(id, 'leather')} />
        </>
      )}
      <Path
        d={`M${model.body === 'truck' ? 153 : 137} 80v23m-51-21-5 19m70-19 4 18`}
        stroke="#243747"
        opacity={0.7}
        strokeWidth={0.8}
        fill="none"
      />
      <Path d="M99 85h9m41 0h9" stroke="#A4B5C1" strokeWidth={2.4} strokeLinecap="round" />
      <Path
        d="M79 77l8-3 8 3-2 5H82z"
        fill={paint(id, 'paint')}
        stroke="#253449"
        strokeWidth={0.7}
      />
      <Path d="M30 94l23-3-4 7-18 2z" fill="#D6F0F4" stroke="#5E7888" strokeWidth={0.6} />
      <Path d="M213 89l12 6 1 5-15-3z" fill="#BB263A" />
      <Path d="M31 102h18m-18 3h16m167-1h12" stroke="#171F28" strokeWidth={1.4} />
      {sporty ? <Path d="M164 90l15-4-8 13h-7zM210 79h19v3h-22" fill="#23313B" /> : null}
      {tall ? (
        <Path d="M95 43h78m-67-4v4m55-4v4" fill="none" stroke="#445461" strokeWidth={2} />
      ) : null}
      {[70, 191].map((x) => (
        <G key={x}>
          <Circle cx={x} cy={108} r={16} fill="#101820" />
          <Circle cx={x} cy={108} r={13.5} fill="#24313D" stroke="#56616B" strokeWidth={0.6} />
          <Circle cx={x} cy={108} r={sporty ? 11 : 9.5} fill={paint(id, 'steel')} />
          <Circle cx={x} cy={108} r={sporty ? 8.5 : 7} fill="#273745" />
          {Array.from({ length: 5 + (seed % 3) }, (_, i) => (
            <Path
              key={i}
              d={`M${x - 1} 107l-2-8 3-1 2 9z`}
              transform={`rotate(${(i * 360) / (5 + (seed % 3))} ${x} 108)`}
              fill={paint(id, 'steel')}
            />
          ))}
          <Circle cx={x} cy={108} r={2.5} fill="#C5D4DE" />
          <Path
            d={`M${x - 14} 103a15 15 0 0 1 28 0`}
            stroke="#FFFFFF"
            opacity={0.3}
            strokeWidth={0.8}
            fill="none"
          />
        </G>
      ))}
      <Path d="M91 106h78" stroke="#D9E8EF" opacity={0.65} />
    </Frame>
  );
}

function Jewelry({ item }: { item: Valuable }) {
  const id = item.id;
  const materialId = useArtId();
  const metal = paint(materialId, /silver|platinum|bracelet.charm/.test(id) ? 'steel' : 'gold');
  const gemstone = /emerald/.test(id) ? '#438C75' : /sapphire/.test(id) ? '#496BB1' : '#D9F0F6';
  const stone = /solitaire-5|tennis-10/.test(id)
    ? 16
    : /solitaire-3|solitaire-2|studs-2/.test(id)
      ? 13
      : /-05/.test(id)
        ? 7
        : 10;
  const gem = (x: number, y: number, size = stone, color = gemstone) => (
    <Gem key={`${x}:${y}`} x={x} y={y} size={size} color={color} />
  );
  const materials = <Materials id={materialId} />;
  if (item.kind === 'ring')
    return (
      <>
        {materials}
        <Ellipse
          cx={130}
          cy={86}
          rx={28}
          ry={31}
          stroke="#5A4C39"
          strokeWidth={10}
          fill="none"
          transform="rotate(-25 130 86)"
        />
        <Ellipse
          cx={130}
          cy={83}
          rx={28}
          ry={31}
          stroke={metal}
          strokeWidth={8}
          fill="none"
          transform="rotate(-25 130 83)"
        />
        <Path d="M115 62l7-9m16 0 8 9" stroke={metal} strokeWidth={4} />
        <Path d="M110 92q18 21 37 2" stroke="#FFF5D7" strokeWidth={2} fill="none" opacity={0.7} />
        {/signet/.test(id) ? (
          <Rect
            x={113}
            y={48}
            width={34}
            height={20}
            rx={5}
            fill="#A97944"
            stroke={metal}
            strokeWidth={3}
          />
        ) : /solitaire|sapphire|emerald|setting/.test(id) ? (
          gem(130, 54)
        ) : /juste/.test(id) ? (
          <Path
            d="M117 53h24l8 7"
            stroke="#94683E"
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
      </>
    );
  if (item.kind === 'earrings')
    return (
      <>
        {materials}
        {[105, 155].map((x) =>
          /hoops/.test(id) ? (
            <Circle key={x} cx={x} cy={74} r={17} fill="none" stroke={metal} strokeWidth={6} />
          ) : /pearl/.test(id) ? (
            <Fragment key={x}>
              <Path
                d={`M${x - 6} 51q6-9 12 0l-6 17v13`}
                fill="none"
                stroke={metal}
                strokeWidth={3}
              />
              <Circle cx={x} cy={87} r={9} fill={paint(materialId, 'pearl')} stroke="#BC9B86" />
            </Fragment>
          ) : (
            gem(x, 72)
          ),
        )}
      </>
    );
  const bracelet = item.kind === 'bracelet';
  const span = bracelet ? 43 : 54;
  const depth = bracelet ? 36 : 52;
  const top = bracelet ? 51 : 36;
  const linked = item.kind === 'chain' || /gold-link/.test(id);
  const beads = /pearl|beaded|tennis|alhambra/.test(id);
  const count = linked ? 18 : beads ? 15 : 0;
  const point = (f: number) => ({
    x: 130 + f * span,
    y: top + (1 - f * f) * depth,
  });
  const first = point(-1);
  return (
    <>
      {materials}
      <Path
        d={`M${first.x} ${first.y}q${span} -16 ${span * 2} 0`}
        stroke={metal}
        strokeWidth={linked ? 4 : 2}
        fill="none"
      />
      <Rect
        x={127}
        y={top - 9}
        width={7}
        height={4}
        rx={1.5}
        fill={metal}
        stroke="#6A543B"
        strokeWidth={0.6}
      />
      <Path
        d={`M${first.x} ${first.y}q${span} ${depth * 2} ${span * 2} 0`}
        fill="none"
        stroke={metal}
        strokeWidth={/cuff/.test(id) ? 10 : linked ? 5 : 3}
        strokeLinecap="round"
      />
      {Array.from({ length: count }, (_, i) => {
        const { x, y } = point((i / (count - 1)) * 2 - 1);
        if (/tennis|diamond-cuban/.test(id)) return gem(x, y, /tennis-10/.test(id) ? 4.5 : 3);
        return (
          <Circle
            key={i}
            cx={x}
            cy={y}
            r={/cuban|beaded|pearl/.test(id) ? 4 : 3}
            fill={linked ? 'none' : /pearl/.test(id) ? paint(materialId, 'pearl') : '#709B90'}
            stroke={metal}
            strokeWidth={linked ? 2.4 : 1.1}
          />
        );
      })}
      {/cross|gold-pendant/.test(id) ? (
        <Path d="M130 86v24m-8-16h16" stroke={metal} strokeWidth={5} strokeLinecap="round" />
      ) : /pendant/.test(id) ? (
        gem(130, top + depth + 8)
      ) : /charm/.test(id) ? (
        [112, 130, 148].map((x) => (
          <G key={x}>
            <Path d={`M${x} 83v10`} stroke="#A4B5C1" />
            {gem(x, 96, 4, '#B3D2DF')}
          </G>
        ))
      ) : null}
    </>
  );
}

export function ValuableArt({
  item,
  iced = false,
  compact,
}: {
  item: Valuable;
  iced?: boolean;
  compact?: boolean;
}) {
  const jewelry = ['ring', 'necklace', 'chain', 'bracelet', 'earrings'].includes(item.kind);
  return (
    <Frame compact={compact}>
      {item.kind === 'watch' ? (
        <Watch item={item} iced={iced} />
      ) : (
        <>
          <Backdrop color={jewelry ? '#F5E4EE' : '#E8EDF8'} />
          {jewelry ? <Jewelry item={item} /> : <Collectible item={item} />}
        </>
      )}
    </Frame>
  );
}

export function LotArt({ lot }: { lot: Lot }) {
  const id = useArtId();
  if (lot.kind === 'car') return <VehicleArt trimId={lot.trimId} compact />;
  if (lot.kind === 'valuable') {
    const item = findValuable(lot.itemId);
    return item ? <ValuableArt item={item} compact /> : null;
  }
  const span = lot.size === 'large' ? 134 : lot.size === 'small' ? 82 : 108;
  const left = 130 - span / 2;
  const color = paints[artSeed(lot.id) % paints.length];
  return (
    <Frame compact>
      <Materials id={id} color={color} />
      <Backdrop color="#F5EBD7" />
      <Path d={`M${left - 12} 24h${span + 24}l9 8H${left - 3}z`} fill={paint(id, 'steel')} />
      <Path d={`M${left + span + 7} 30l9-6v87l-9 9z`} fill="#69757D" />
      <Rect x={left - 7} y={30} width={span + 14} height={90} rx={5} fill="#454255" />
      <Rect x={left} y={37} width={span} height={77} rx={1} fill={paint(id, 'steel')} />
      {[48, 59, 70, 81, 92, 103].map((y) => (
        <Path key={y} d={`M${left} ${y}h${span}`} stroke="#FFFFFF" opacity={0.32} />
      ))}
      <Path d="M126 91v-5a4 4 0 0 1 8 0v5" fill="none" stroke="#47565F" strokeWidth={2} />
      <Rect
        x={123}
        y={89}
        width={14}
        height={12}
        rx={2}
        fill={paint(id, 'gold')}
        stroke="#75542C"
        strokeWidth={0.7}
      />
      <Circle cx={130} cy={94} r={1.2} fill="#5C492D" />
      <Path d={`M${left - 10} 120h${span + 27}l10 7H${left - 16}z`} fill="#B0A99D" />
    </Frame>
  );
}

export type MilestoneKind =
  | 'graduation'
  | 'awards'
  | 'newborn'
  | 'adoption'
  | 'home'
  | 'service'
  | 'remembrance'
  | 'wedding'
  | 'new-job'
  | 'retirement'
  | 'championship'
  | 'music'
  | 'acting'
  | 'modeling';

const milestoneBackdrop: Record<MilestoneKind, string> = {
  graduation: '#EEE4FA',
  awards: '#FAEBCD',
  newborn: '#F7E5ED',
  adoption: '#E4F1EA',
  home: '#E2EDF8',
  service: '#E7EBF3',
  remembrance: '#F1E8DE',
  wedding: '#F6E5EF',
  'new-job': '#E3EDF8',
  retirement: '#F7EAD5',
  championship: '#E3EFE8',
  music: '#EDE5F7',
  acting: '#E5EAF7',
  modeling: '#F6E7ED',
};

const milestoneScenes = (id: string): Record<MilestoneKind, ReactNode> => ({
  graduation: (
    <>
      <Path d="M92 65v25q38 24 76 0V65" fill={paint(id, 'cloth')} />
      <Path d="M75 59l55-24 55 24-55 24z" fill={paint(id, 'cloth')} />
      <Path d="M130 59l47 5v28" stroke="#BD944F" strokeWidth={3} fill="none" />
      <Circle cx={177} cy={96} r={5} fill={paint(id, 'gold')} />
    </>
  ),
  awards: (
    <>
      <Path
        d="M105 43H89q-1 31 29 33m37-33h16q1 31-29 33"
        fill="none"
        stroke="#BD944F"
        strokeWidth={6}
      />
      <Path
        d="M102 36h56q0 36-23 44v20h18v10h-46v-10h18V80q-23-8-23-44z"
        fill={paint(id, 'gold')}
      />
      <Path d="M130 45l3 8 9 1-7 6 2 8-7-4-7 4 2-8-7-6 9-1z" fill="#FFF4D3" />
    </>
  ),
  newborn: (
    <>
      <Path d="M77 94h106v7q-53 32-106 0z" fill={paint(id, 'wood')} />
      <Path d="M85 92q12-40 47-40 30 0 44 40z" fill={paint(id, 'cloth')} />
      <Circle cx={125} cy={57} r={15} fill={paint(id, 'skin')} />
      <Path
        d="M115 57q3 4 6 0m8 0q3 4 6 0m-15 7q5 3 10 0M113 75l29 18m9-19-21 20"
        fill="none"
        stroke="#663D54"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M169 29l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill={paint(id, 'gold')} />
    </>
  ),
  adoption: (
    <>
      <Path d="M71 74l36-30 37 30h-11v34H83V74z" fill={paint(id, 'cloth')} />
      <Path d="M103 108V83h15v25" fill={paint(id, 'paper')} />
      <Rect x={151} y={74} width={37} height={34} rx={6} fill={paint(id, 'wood')} />
      <Path d="M161 74v-6q9-9 18 0v6" fill="none" stroke="#785045" strokeWidth={4} />
      <Path d="M165 38c-8-11-21 2 0 15 21-13 8-26 0-15z" fill="#AB5377" />
    </>
  ),
  home: (
    <>
      <Rect x={83} y={65} width={92} height={47} rx={4} fill={paint(id, 'cloth')} />
      <Path d="M71 68l59-41 59 41z" fill="#394E74" />
      <Rect x={119} y={80} width={23} height={32} rx={3} fill={paint(id, 'paper')} />
      <Rect x={92} y={78} width={17} height={17} rx={2} fill="#D6F1EB" />
      <Path d="M154 82h12m-6-6v12" stroke="#D6F1EB" strokeWidth={3} />
      <Circle cx={194} cy={93} r={10} fill="none" stroke="#BD944F" strokeWidth={5} />
      <Path d="M194 103v22h-9m9-8h-5" fill="none" stroke="#BD944F" strokeWidth={5} />
    </>
  ),
  service: (
    <>
      <Rect x={87} y={43} width={88} height={63} rx={6} fill={paint(id, 'cloth')} />
      <Rect x={94} y={50} width={74} height={49} rx={3} fill={paint(id, 'paper')} />
      <Path
        d="M106 63h50m-45 10h40m-33 10h24"
        stroke="#827154"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d="M146 98l-1 24 10-6 10 6-1-24" fill={paint(id, 'cloth')} />
      <Circle cx={155} cy={96} r={11} fill={paint(id, 'gold')} />
    </>
  ),
  remembrance: (
    <>
      <Path
        d="M82 112q48-11 96 0"
        fill="none"
        stroke="#B19884"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Rect x={113} y={67} width={34} height={39} rx={6} fill={paint(id, 'cloth')} />
      <Path d="M130 65c-16-4-10-19 3-34-2 10 11 24-3 34z" fill="#BC824A" />
      <Path d="M109 104q-23-3-29-16 19-1 29 16m42 0q23-3 29-16-19-1-29 16" fill="#6D8373" />
    </>
  ),
  wedding: (
    <>
      <Circle cx={110} cy={79} r={23} fill="none" stroke="#BD944F" strokeWidth={7} />
      <Circle cx={148} cy={77} r={24} fill="none" stroke={paint(id, 'cloth')} strokeWidth={7} />
      <Path d="M136 50l5-9h15l5 9-12 13z" fill="#C2E0E9" stroke="#744861" strokeWidth={2} />
      <Path
        d="M87 103q-12-5-19-20m105 19q12-5 20-20"
        fill="none"
        stroke="#5E8D79"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  ),
  'new-job': (
    <>
      <Path d="M112 53V42q18-13 36 0v11" fill="none" stroke="#374F74" strokeWidth={6} />
      <Rect x={77} y={51} width={106} height={58} rx={9} fill={paint(id, 'cloth')} />
      <Path d="M77 73q53 17 106 0" fill="none" stroke="#B1CCD9" strokeWidth={3} />
      <Rect x={122} y={75} width={16} height={13} rx={3} fill={paint(id, 'gold')} />
      <Path
        d="M184 37h12m-6-6v12M60 96h10m-5-5v10"
        stroke="#6F8EA8"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  ),
  retirement: (
    <>
      <Circle cx={157} cy={55} r={22} fill="#E6B974" />
      <Path
        d="M67 108h127M75 89q55-20 110 0"
        fill="none"
        stroke="#8FA595"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M91 57l21 35h45m-45 0-9 18m46-18 10 18"
        fill="none"
        stroke="#98663E"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Path
        d="M90 61l17 24q19-8 41 1"
        fill="none"
        stroke="#AB6875"
        strokeWidth={8}
        strokeLinecap="round"
      />
    </>
  ),
  championship: (
    <>
      <Path d="M111 30l19 39-17 9-23-48zm37 0-18 39 17 9 23-48z" fill="#416C67" />
      <Circle cx={130} cy={88} r={29} fill={paint(id, 'gold')} />
      <Circle cx={130} cy={88} r={24} fill={paint(id, 'gold')} />
      <Path d="M130 72l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#FFF1C4" />
    </>
  ),
  music: (
    <>
      <Circle cx={124} cy={73} r={44} fill={paint(id, 'black')} />
      <Circle cx={124} cy={73} r={34} fill="none" stroke="#77628E" strokeWidth={2} />
      <Circle cx={124} cy={73} r={23} fill="none" stroke="#77628E" strokeWidth={2} />
      <Circle cx={124} cy={73} r={15} fill="#DA9B91" />
      <Circle cx={124} cy={73} r={3} fill="#FFF2D1" />
      <Path
        d="M157 100l30-57h14l-13 11"
        fill="none"
        stroke="#BD944F"
        strokeWidth={5}
        strokeLinecap="round"
      />
    </>
  ),
  acting: (
    <>
      <Rect x={83} y={62} width={96} height={49} rx={5} fill={paint(id, 'black')} />
      <Path d="M81 58l-5-16 92-22 5 16z" fill="#566787" />
      <Path d="M92 39l13 13m12-19 13 13m12-19 13 13m-62 29h75" stroke="#E9E5D8" strokeWidth={4} />
      <Path d="M125 77l19 9-19 10z" fill={paint(id, 'gold')} />
    </>
  ),
  modeling: (
    <>
      <Path d="M97 50l8-13h49l8 13" fill={paint(id, 'cloth')} />
      <Rect x={74} y={49} width={112} height={62} rx={11} fill={paint(id, 'cloth')} />
      <Circle cx={131} cy={80} r={23} fill={paint(id, 'black')} stroke="#A4B5C1" strokeWidth={4} />
      <Circle cx={131} cy={80} r={11} fill="#89AEBB" />
      <Circle cx={136} cy={75} r={4} fill="#FDF1E7" />
      <Rect x={160} y={59} width={15} height={8} rx={2} fill="#F9DCB3" />
    </>
  ),
});

export function MilestoneArt({ kind }: { kind: MilestoneKind }) {
  const id = useArtId();
  return (
    <Frame compact>
      <Backdrop color={milestoneBackdrop[kind]} />
      <Materials id={id} color={kind === 'newborn' || kind === 'wedding' ? '#AF6885' : '#596B91'} />
      {milestoneScenes(id)[kind]}
      <MilestoneDetails kind={kind} id={id} />
    </Frame>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 330,
    alignSelf: 'center',
    borderRadius: radii.lg,
    marginVertical: spacing.sm,
  },
  compact: { maxWidth: 280 },
});
