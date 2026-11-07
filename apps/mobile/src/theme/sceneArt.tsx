import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { findValuable, findVehicleTrim, type Valuable, type VehicleBody } from '@yearafter/content';
import type { Lot } from '@yearafter/simulation';
import type { ReactNode } from 'react';
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
const metals = ['#A3B1BC', '#DDBF78', '#DAAB9D', '#818896'];
const dials = ['#1C3743', '#403052', '#1C5045', '#653344', '#304A73', '#4E403B'];

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
      <Rect width={260} height={146} rx={14} fill={color} />
      <Circle cx={131} cy={69} r={54} fill="#FFFFFF" opacity={0.45} />
      <Path
        d="M26 40v12m-6-6h12m193 43v12m-6-6h12M208 23v8m-4-4h8"
        stroke="#59446A"
        opacity={0.32}
        strokeLinecap="round"
      />
    </>
  );
}

function Watch({ item, iced }: { item: Valuable; iced: boolean }) {
  const seed = artSeed(item.id);
  const dial = dials[seed % dials.length];
  const metal = metals[(seed >>> 7) % metals.length];
  const model = item.id.toLowerCase();
  const digital = /casiot|apple-ish/.test(model);
  const rectangular = digital || /tanque|reverso|santo|monako/.test(model);
  const angular = /ventura|millon|royal-ash|nautilos|timeless/.test(model);
  const diver = /subaquatic|seamarine|diver|black-cove|fifty|pelagos|superocean|yacht-voyager/.test(
    model,
  );
  const complications = /daytonna|speedmeister|chrono|carrara|monako|navigator|grand-comp/.test(
    model,
  );
  const dateWindow = /datesure|day-date|gmt|pointer-date/.test(model);
  const bracelet =
    diver ||
    /datesure|day-date|perpetual|royal-ash|prx|gold/.test(model) ||
    (!digital && !rectangular && (seed & 2) === 0);
  const strap = bracelet ? metal : '#463241';
  return (
    <>
      <Backdrop color="#F5EBD7" />
      <Rect x={109} y={5} width={42} height={136} rx={11} fill={strap} />
      <Path d="M120 9v128m20-128v128" stroke="#FFFFFF" opacity={0.28} />
      {bracelet
        ? [16, 26, 36, 110, 120, 130].map((y) => (
            <Path key={y} d={`M110 ${y}h40`} stroke="#4F4650" opacity={0.45} />
          ))
        : null}
      <Rect x={163} y={67} width={8} height={12} rx={3} fill={metal} />
      {rectangular ? (
        <>
          <Rect x={99} y={35} width={62} height={76} rx={10} fill={metal} />
          <Rect x={105} y={41} width={50} height={64} rx={6} fill={dial} />
        </>
      ) : angular ? (
        <>
          <Path
            d={
              /ventura/.test(model)
                ? 'M100 32l70 40-70 42-12-42z'
                : 'M110 34h40l19 18v42l-19 18h-40L91 94V52z'
            }
            fill={metal}
          />
          <Path
            d={
              /ventura/.test(model)
                ? 'M104 43l53 29-53 31-10-31z'
                : 'M113 40h34l16 15v36l-16 15h-34L97 91V55z'
            }
            fill={dial}
          />
        </>
      ) : (
        <>
          <Circle cx={130} cy={73} r={39} fill={metal} />
          <Circle cx={130} cy={73} r={diver ? 35 : 31} fill={diver ? '#283044' : '#E6DCE8'} />
          <Circle cx={130} cy={73} r={diver ? 28 : 30} fill={dial} />
        </>
      )}
      {digital ? (
        <>
          <Rect x={110} y={58} width={40} height={30} rx={4} fill="#C6DBCD" />
          <Path
            d="M116 64h7v17m-7-8h7m5-9h6v17h-6zm11 0h7v9h-7v8h7"
            fill="none"
            stroke="#263F3D"
            strokeWidth={2}
          />
        </>
      ) : (
        <>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <Circle
                key={i}
                cx={130 + Math.sin(a) * 23}
                cy={73 - Math.cos(a) * 23}
                r={i % 3 === 0 ? 2 : 1.1}
                fill="#FFF2D8"
              />
            );
          })}
          {complications
            ? [116, 144].map((x) => (
                <Circle key={x} cx={x} cy={76} r={6} fill={metal} opacity={0.75} />
              ))
            : null}
          <Path
            d="M114 62l16 11 17-10m-17 10 4 15"
            stroke="#FFF2D8"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={130} cy={73} r={3} fill={metal} />
          {dateWindow ? <Rect x={145} y={71} width={8} height={6} rx={1} fill="#F5EDD8" /> : null}
          {diver ? <Path d="M130 40l-3 6h6z" fill="#FFF2D8" /> : null}
        </>
      )}
      {iced || item.icing?.kind === 'factory'
        ? Array.from({ length: 16 }, (_, i) => {
            const a = (i * Math.PI) / 8;
            const x = 130 + Math.sin(a) * (rectangular ? 29 : 35);
            const y = 73 - Math.cos(a) * 35;
            return (
              <Path
                key={i}
                d={`M${x} ${y - 3}l3 3-3 3-3-3z`}
                fill="#F8FEFF"
                stroke="#8DB7C7"
                strokeWidth={0.6}
              />
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
  const found = findVehicleTrim(trimId);
  if (!found) return null;
  const model = found.model;
  const color = paints[artSeed(trimId) % paints.length];
  const sporty = model.market === 'exotic' || model.body === 'coupe';
  const shell = `M29 101q1-20 32-22${roof[model.body]}q33 4 40 16l2 14H31z`;
  return (
    <Frame compact={compact}>
      <Backdrop color={sporty ? '#F5E4EE' : '#E4EEF7'} />
      <Path
        d="M27 116h206m-187 7h169"
        stroke="#354758"
        opacity={0.2}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d={shell} fill={color} stroke="#253449" strokeWidth={2} strokeLinejoin="round" />
      {model.body !== 'convertible' ? (
        <Path
          d={model.body === 'truck' ? 'M80 74l10-20h46l15 20z' : 'M82 76l22-15h49l20 15z'}
          fill="#C6E6EE"
          stroke="#253449"
          strokeWidth={1.5}
        />
      ) : null}
      <Path
        d="M128 59v18m30 12h-11m-51 0h-9M36 98h25m142-2h20"
        stroke="#FBF2DB"
        strokeWidth={2}
        opacity={0.85}
        strokeLinecap="round"
      />
      {[70, 191].map((x) => (
        <Circle key={x} cx={x} cy={108} r={15} fill="#243040" />
      ))}
      {[70, 191].map((x) => (
        <Circle
          key={x}
          cx={x}
          cy={108}
          r={sporty ? 9 : 7}
          fill="#BAC5CE"
          stroke="#697789"
          strokeWidth={2}
        />
      ))}
      {model.electric ? <Path d="M121 91l8-8-2 7h7l-10 10 2-9z" fill="#FFF4A5" /> : null}
    </Frame>
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
  const seed = artSeed(item.id);
  const tone = paints[seed % paints.length];
  const metal = metals[(seed >>> 9) % metals.length];
  const jewelry = ['ring', 'necklace', 'chain', 'bracelet', 'earrings'].includes(item.kind);
  return (
    <Frame compact={compact}>
      {item.kind === 'watch' ? (
        <Watch item={item} iced={iced} />
      ) : (
        <>
          <Backdrop color={jewelry ? '#F5E4EE' : '#E8EDF8'} />
          {jewelry ? (
            <>
              <Path
                d={
                  item.kind === 'ring'
                    ? 'M108 81a22 22 0 1 0 44 0 22 22 0 1 0-44 0z'
                    : item.kind === 'earrings'
                      ? 'M96 45q-12 0-12 13v20m80-33q12 0 12 13v20'
                      : 'M82 48q48 101 96 0'
                }
                stroke={metal}
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
              />
              {(item.kind === 'earrings' ? [84, 176] : [130]).map((x) => {
                const y = item.kind === 'ring' ? 54 : item.kind === 'earrings' ? 87 : 96;
                return (
                  <Path
                    key={x}
                    d={`M${x} ${y - 12}l13 11-13 16-13-16z`}
                    fill={tone}
                    stroke={metal}
                    strokeWidth={2}
                  />
                );
              })}
            </>
          ) : item.kind === 'art' ? (
            <>
              <Rect x={78} y={21} width={104} height={104} rx={3} fill={metal} />
              <Rect x={86} y={29} width={88} height={88} fill={tone} />
              <Circle cx={102 + (seed % 47)} cy={52} r={12} fill="#F8D27C" />
              <Path
                d={
                  seed % 2
                    ? 'M86 105l22-45 28 31 18-21 20 35v12H86z'
                    : 'M86 105l29-32 14 12 20-23 25 35v20H86z'
                }
                fill="#E6C7BE"
              />
            </>
          ) : (
            <>
              <Rect x={83} y={105} width={94} height={11} rx={4} fill="#3C3655" />
              <Path
                d={
                  item.kind === 'historical'
                    ? 'M103 34h55v66h-55zm10 13h35m-35 10h29m-29 10h34'
                    : item.kind === 'mythical'
                      ? 'M130 23l24 23 13 29-37 30-37-30 13-29zm0 0v82m-37-30h74'
                      : 'M117 35h26l-5 14c7 10 18 16 18 31 0 13-10 22-26 22s-26-9-26-22c0-15 11-21 18-31z'
                }
                fill={tone}
                stroke={metal}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </>
          )}
        </>
      )}
    </Frame>
  );
}

export function LotArt({ lot }: { lot: Lot }) {
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
      <Backdrop color="#F5EBD7" />
      <Rect x={left - 7} y={30} width={span + 14} height={90} rx={5} fill="#454255" />
      <Rect x={left} y={37} width={span} height={77} rx={3} fill={color} />
      {[48, 59, 70, 81, 92, 103].map((y) => (
        <Path key={y} d={`M${left} ${y}h${span}`} stroke="#FFFFFF" opacity={0.32} />
      ))}
      <Rect x={123} y={89} width={14} height={12} rx={3} fill="#F4D18A" />
    </Frame>
  );
}

export function MilestoneArt({ kind }: { kind: 'graduation' | 'awards' }) {
  return (
    <Frame compact>
      <Backdrop color={kind === 'awards' ? '#FAEBCD' : '#EEE4FA'} />
      {kind === 'graduation' ? (
        <>
          <Path d="M92 65v25q38 24 76 0V65" fill="#6B508B" />
          <Path d="M75 59l55-24 55 24-55 24z" fill="#3C2A60" />
          <Path d="M130 59l47 5v28" stroke="#B66F36" strokeWidth={3} fill="none" />
          <Circle cx={177} cy={96} r={5} fill="#B66F36" />
        </>
      ) : (
        <>
          <Path
            d="M105 43H89q-1 31 29 33m37-33h16q1 31-29 33"
            fill="none"
            stroke="#B87938"
            strokeWidth={6}
          />
          <Path d="M102 36h56q0 36-23 44v20h18v10h-46v-10h18V80q-23-8-23-44z" fill="#D4A653" />
          <Path d="M130 45l3 8 9 1-7 6 2 8-7-4-7 4 2-8-7-6 9-1z" fill="#FFF4D3" />
        </>
      )}
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
