import type { Valuable } from '@yearafter/content';
import { Circle, Ellipse, G, Path, Rect, Text } from 'react-native-svg';
import { Gem, Materials, paint, useArtId } from './artMaterials';

/** Catalog subjects, not rarity or appraisal: the picture must not disclose hidden quality. */
export function Collectible({ item }: { item: Valuable }) {
  const uid = useArtId();
  // Semantic suffixes resolve catalog IDs whose short codes omit the subject.
  const subjects: Readonly<Record<string, string>> = {
    'val.art.est-canvas': 'red-interior',
    'val.art.est-sculpture': 'iron-horse',
    'val.art.est-photo': 'long-table',
    'val.art.blue-chip-1': 'bathers',
    'val.art.blue-chip-2': 'black-square',
    'val.art.blue-chip-3': 'orchard-wall',
    'val.curio.bigfoot-cast': 'footprint',
  };
  const id = `${item.id}.${subjects[item.id] ?? ''}`;
  const metal = paint(
    uid,
    /silver|coin|typewriter|chandelier|tea-service/.test(id) ? 'steel' : 'gold',
  );
  const wood = paint(uid, 'wood');
  const paper = paint(uid, 'paper');
  const dark = paint(uid, 'black');
  const glass = paint(uid, 'glass');
  const line = '#423C39';
  let subject;
  if (/golden-fleece/.test(id)) {
    subject = (
      <>
        <Path
          d="M104 37l13-12h26l13 12 26 13-13 29-17-9v47h-44V70L91 79 78 50z"
          fill={metal}
          stroke="#9F7A3E"
          strokeWidth={2}
        />
        {Array.from({ length: 8 }, (_, r) =>
          Array.from({ length: 7 }, (_, c) => (
            <Path
              key={`${r}:${c}`}
              d={`M${111 + c * 5} ${39 + r * 9}q-4-5 0-6 6 0 2 5`}
              fill="none"
              stroke={r % 2 ? '#F8DE94' : '#BA9148'}
              strokeWidth={1.4}
            />
          )),
        )}
      </>
    );
  } else if (/jackalope/.test(id)) {
    subject = (
      <>
        <Path
          d="M102 50q28-26 56 0v58l-28 18-28-18z"
          fill={wood}
          stroke="#664631"
          strokeWidth={2}
        />
        <Path
          d="M113 70l-8-26q1-14 10-4l10 24m10 0 12-27q11-10 9 4l-10 29"
          fill={paper}
          stroke="#9B8062"
        />
        <Ellipse cx={130} cy={85} rx={19} ry={24} fill={paper} />
        <Path
          d="M115 69l-9-35m2 9-12-9m15 20-12-4m46 19 9-35m-2 9 12-9m-15 20 12-4"
          stroke="#9B8062"
          strokeWidth={3}
          fill="none"
        />
        <Circle cx={121} cy={82} r={2.3} fill="#302A29" />
        <Circle cx={139} cy={82} r={2.3} fill="#302A29" />
        <Path d="M126 94h8l-4 4z" fill="#8D6658" />
      </>
    );
  } else if (/movie-prop/.test(id)) {
    subject = (
      <>
        <Path d="M88 48h84v67H88z" fill={dark} stroke="#687A85" />
        <Path d="M88 45l-4-17 82-17 4 17z" fill={dark} stroke="#687A85" />
        <Path d="M94 27l12 13m9-17 12 13m9-17 12 13" stroke="#E3DECD" strokeWidth={6} />
        <Path d="M98 66h64m-64 16h64m-64 16h42" stroke="#A4A79F" />
        <Path d="M113 75v31m28-31v31" stroke="#A4A79F" />
      </>
    );
  } else if (/clock/.test(id)) {
    const tall = /grandfather/.test(id);
    subject = (
      <>
        <Path
          d={
            tall
              ? 'M103 125V36q0-28 27-28t27 28v89z'
              : 'M82 114V78l14-14V43q34-35 68 0v21l14 14v36z'
          }
          fill={wood}
          stroke={line}
        />
        <Path
          d={tall ? 'M112 69h36v47h-36z' : 'M89 105h82v8H89z'}
          fill={dark}
          stroke="#BDA676"
          strokeWidth={2}
        />
        {tall ? (
          <>
            <Path d="M130 72v30" stroke="#BDA676" strokeWidth={2} />
            <Circle cx={130} cy={105} r={9} fill={metal} />
          </>
        ) : null}
        <Circle cx={130} cy={48} r={24} fill={metal} />
        <Circle cx={130} cy={48} r={20} fill={paper} />
        {Array.from({ length: 12 }, (_, i) => (
          <Path key={i} d="M130 30v3" transform={`rotate(${i * 30} 130 48)`} stroke={line} />
        ))}
        <Path d="M120 38l10 10 9-14" stroke={line} strokeWidth={2} fill="none" />
        <Path d={tall ? 'M98 125h64v5H98z' : 'M77 115h106v6H77z'} fill={wood} stroke={line} />
      </>
    );
  } else if (/desk|armoire|sea-chest|pandoras-box/.test(id)) {
    const cabinet = /armoire/.test(id),
      chest = /chest|box/.test(id);
    subject = (
      <>
        <Path
          d={cabinet ? 'M91 28h78v96H91z' : chest ? 'M84 66h92v50H84z' : 'M79 63h102v49H79z'}
          fill={wood}
          stroke={line}
          strokeWidth={2}
        />
        <Path
          d={
            cabinet
              ? 'M91 28l9-12h61l8 12z'
              : chest
                ? 'M84 66l13-20h68l11 20z'
                : 'M79 63l20-32h65l17 32z'
          }
          fill={wood}
          stroke={line}
        />
        <Path
          d={cabinet ? 'M99 37h25v76H99zm37 0h25v76h-25z' : 'M87 75h86v13H87zm0 22h86v10H87z'}
          fill="none"
          stroke="#D6AD79"
        />
        <Path d="M91 114v13m78-13v13" stroke="#98663E" strokeWidth={7} />
        <Circle cx={126} cy={77} r={2} fill={metal} />
        <Circle cx={135} cy={77} r={2} fill={metal} />
        {chest ? (
          <>
            <Path d="M100 50v63m60-63v63" stroke="#BDA676" strokeWidth={5} />
            <Rect x={123} y={69} width={14} height={15} rx={2} fill={metal} />
            <Circle cx={130} cy={76} r={2} fill={line} />
          </>
        ) : null}
      </>
    );
  } else if (/rug|quilt|tapestry/.test(id)) {
    subject = (
      <>
        <Path
          d="M83 20h94l-5 105H78z"
          fill={/quilt/.test(id) ? '#697C95' : '#8E3447'}
          stroke="#98663E"
          strokeWidth={3}
        />
        <Path d="M89 26h80l-5 91H84z" stroke="#D8B875" strokeWidth={2} fill="none" />
        {Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => (
            <Path
              key={`${row}-${col}`}
              d={`M${93 + col * 14} ${32 + row * 13}l6 6-6 6-6-6z`}
              fill={(row + col) % 2 ? '#E2C384' : '#5C9694'}
              stroke="#D8B875"
              strokeWidth={0.5}
            />
          )),
        )}
        {Array.from({ length: 20 }, (_, i) => (
          <Path key={i} d={`M${80 + i * 4.7} 125v6`} stroke="#C7AA81" />
        ))}
      </>
    );
  } else if (/vase|ceramic/.test(id)) {
    subject = (
      <>
        <Path
          d="M113 28h34l-5 22c4 10 22 24 20 45-1 17-12 27-32 27s-31-10-32-27c-2-21 16-35 20-45z"
          fill={paint(uid, 'pearl')}
          stroke="#6D7783"
        />
        <Ellipse cx={130} cy={28} rx={17} ry={4} fill="#3F5364" stroke="#D7E5E9" strokeWidth={2} />
        <Path
          d="M102 80q28-22 56 0m-58 13q30 15 60 0m-42-46h24m-34 64h44"
          fill="none"
          stroke="#376394"
          strokeWidth={3}
        />
        <Path
          d="M117 104q-16-20 1-31 24 8 7 19 24 11 25-12"
          stroke="#376394"
          strokeWidth={2}
          fill="none"
        />
        <Path d="M113 60q-12 22-9 34" stroke="#FFFFFF" strokeWidth={3} fill="none" opacity={0.8} />
      </>
    );
  } else if (/tea-service/.test(id)) {
    subject = (
      <>
        <Ellipse cx={130} cy={112} rx={69} ry={10} fill={metal} />
        <Path
          d="M110 68h36l7 23q0 18-26 18t-24-18zM146 72q26-15 24 9-2 14-19 11M107 79 88 64l6 31 12 2"
          fill={metal}
          stroke="#526673"
          strokeWidth={2}
        />
        <Ellipse cx={128} cy={68} rx={20} ry={5} fill={metal} />
        <Circle cx={128} cy={61} r={4} fill={metal} />
        {[78, 179].map((x) => (
          <G key={x}>
            <Path d={`M${x - 12} 89h24v12q-12 14-24 0z`} fill={metal} stroke="#526673" />
            <Ellipse cx={x} cy={89} rx={12} ry={3} fill="#544038" />
            <Ellipse cx={x} cy={110} rx={18} ry={4} fill={metal} />
          </G>
        ))}
      </>
    );
  } else if (/globe/.test(id)) {
    subject = (
      <>
        <Path d="M130 97v22m-24 5h48" stroke="#98663E" strokeWidth={7} />
        <Circle cx={130} cy={64} r={41} fill={metal} />
        <Circle cx={130} cy={64} r={36} fill="#799D9D" />
        <Path
          d="M111 33l14 6-4 15-12 7 7 16-10 8-9-22 4-22m40-6 16 11 4 13-14 4-4 22-12 12-5-20 7-14-6-13z"
          fill="#D7C792"
        />
        <Ellipse cx={130} cy={64} rx={19} ry={36} fill="none" stroke="#D0CDB6" />
        <Path d="M97 52q33-12 66 0m-68 20q35 13 70 0M109 24l41 80" stroke="#C1BA94" fill="none" />
        <Path d="M105 28q-38 48 29 82" stroke="#98663E" strokeWidth={5} fill="none" />
      </>
    );
  } else if (/horse|jackalope/.test(id)) {
    subject = (
      <>
        <Path
          d="M83 80l10-21 42 4 16-24 20 7 7 20-14 2-8-9-4 28-11 4-2 25h-8l-3-25h-22l-9 25h-8l5-32z"
          fill={/sculpture/.test(id) ? dark : wood}
          stroke={line}
        />
        <Path d="M151 43l5-14 6 15m-9 9 13 8M93 65 79 79l-8-2" stroke={line} strokeWidth={3} />
        <Circle cx={163} cy={49} r={1.5} fill="#EEE6C8" />
        {/jackalope/.test(id) ? (
          <Path d="M154 43l-8-22m2 7-8-5m15 17 10-20m-4 8 9-3" stroke="#98663E" strokeWidth={3} />
        ) : /iron-horse/.test(id) ? (
          <Rect x={79} y={117} width={100} height={9} fill={dark} />
        ) : (
          <Path d="M75 119q55 22 110-5" stroke="#98663E" strokeWidth={6} fill="none" />
        )}
      </>
    );
  } else if (/chandelier/.test(id)) {
    subject = (
      <>
        <Path
          d="M130 14v75m-42-31q0 34 42 31 42 3 42-31m-66-9q0 24 24 27 24-3 24-27"
          stroke="#BDA676"
          strokeWidth={4}
          fill="none"
        />
        {[88, 106, 130, 154, 172].map((x, i) => (
          <G key={x}>
            <Rect x={x - 3} y={36 + (i % 2) * 12} width={6} height={20} fill={paper} />
            <Ellipse cx={x} cy={56 + (i % 2) * 12} rx={8} ry={3} fill={metal} />
            <Gem x={x} y={97 + (i % 2) * 9} size={7} />
          </G>
        ))}
      </>
    );
  } else if (/typewriter|telephone|movie-prop/.test(id)) {
    subject = /telephone/.test(id) ? (
      <>
        <Ellipse cx={130} cy={115} rx={44} ry={10} fill={dark} />
        <Path d="M117 109V48h26v61z" fill={metal} />
        <Path d="M126 49l-18-19 10-14 32 22-10 13z" fill={dark} stroke="#BDA676" strokeWidth={2} />
        <Path d="M149 57h16v25m0-22q21 14 0 35m-2 0v19" fill="none" stroke={line} strokeWidth={4} />
      </>
    ) : (
      <>
        <Path d="M86 74h88l15 43H71z" fill={dark} stroke="#525C66" strokeWidth={2} />
        <Rect x={89} y={47} width={81} height={40} rx={3} fill={dark} />
        <Path d="M98 63V29h63v34z" fill={paper} />
        <Path d="M107 38h45m-45 8h34m-45 20h80" stroke="#7C7B77" strokeWidth={2} />
        {Array.from({ length: 3 }, (_, r) =>
          Array.from({ length: 10 }, (_, c) => (
            <Circle key={`${r}-${c}`} cx={86 + c * 10 + r} cy={91 + r * 8} r={3} fill={metal} />
          )),
        )}
      </>
    );
  } else if (/armor/.test(id)) {
    subject = (
      <>
        <Path d="M110 43q20-26 40 0l9 8h-58z" fill={dark} stroke="#BDA676" strokeWidth={2} />
        <Path d="M115 35 104 20l14 6 12 12 12-12 14-6-11 15" fill={metal} />
        <Path
          d="M103 60h54l15 45-18 17h-48l-18-17z"
          fill="#7B3B36"
          stroke="#283542"
          strokeWidth={7}
        />
        {[67, 77, 87, 97, 107].map((y) => (
          <Path key={y} d={`M102 ${y}h56`} stroke="#BDA676" strokeWidth={2} />
        ))}
        <Path d="M93 61l-10 29m84-29 10 29" stroke="#283542" strokeWidth={13} />
      </>
    );
  } else if (/sword|excalibur|trident|pickaxe/.test(id)) {
    subject = (
      <G transform="rotate(25 130 73)">
        {/excalibur/.test(id) ? (
          <Path d="M98 117l14-19h32l20 19-7 15h-53z" fill="#69747C" stroke="#424E57" />
        ) : null}
        <Path d="M126 116V45l4-28 4 28v71z" fill={paint(uid, 'steel')} stroke="#677984" />
        <Path d="M130 20v91" stroke="#F4FFFF" />
        <Path d="M113 88h34m-17 0v34" stroke="#BDA676" strokeWidth={6} />
        {/trident/.test(id) ? (
          <Path
            d="M106 19v26l24 14 24-14V19m-51 5 3-9 4 9m40 0 4-9 4 9"
            stroke="#BDA676"
            strokeWidth={5}
            fill="none"
          />
        ) : null}
        {/pickaxe/.test(id) ? (
          <Path
            d="M99 36q31-21 62 0l-7 10q-24-14-48 0z"
            fill="#73C8D1"
            stroke="#306F7A"
            strokeWidth={2}
          />
        ) : null}
      </G>
    );
  } else if (/letter|menu|edition|map|ticket|express/.test(id)) {
    subject = (
      <G transform="rotate(-6 130 73)">
        <Path d="M93 24h78l-5 99H87z" fill={paper} stroke="#A78D64" strokeWidth={1.5} />
        {/edition/.test(id) ? (
          <>
            <Path d="M87 24h9v99h-9z" fill={wood} />
            <Rect x={102} y={41} width={53} height={52} fill="#506A73" stroke="#BDA676" />
            <Path d="M110 55h35m-30 9h25" stroke="#EFDCC0" strokeWidth={2} />
          </>
        ) : /map/.test(id) ? (
          <>
            <Path d="M105 40l26 12 16-18 6 35-23 32-25-9 13-22z" fill="#91A994" stroke="#626C54" />
            <Path
              d="M98 32v77m17-77v77m17-77v77m17-77v77M96 50h60m-60 20h60m-60 20h60"
              stroke="#9F8B68"
              opacity={0.4}
            />
          </>
        ) : (
          <>
            <Path
              d="M102 42h50m-50 8h46m-46 8h52m-52 8h40m-40 8h48m-48 8h44"
              stroke="#807969"
              strokeWidth={1}
            />
            <Path d="M110 101q7-15 8-2l5-6 2 5 15-4" stroke="#4E555A" fill="none" />
            <Circle cx={151} cy={102} r={7} fill="#A65043" />
          </>
        )}
      </G>
    );
  } else if (/coin|nugget|meteorite|stone/.test(id)) {
    subject = /coin/.test(id) ? (
      <>
        <Circle cx={130} cy={73} r={43} fill={metal} stroke="#6A6963" strokeWidth={2} />
        <Circle
          cx={130}
          cy={73}
          r={37}
          fill="none"
          stroke="#68737C"
          strokeDasharray="2 3"
          strokeWidth={2}
        />
        <Path
          d={
            /greek/.test(id)
              ? 'M111 57l19 9 19-9v26l-19 14-19-14zM116 73h7m14 0h7M130 79l-4 6h8z'
              : 'M121 44q29-2 22 23l7 7-10 7v12h-28l7-13q-18-22 2-36z'
          }
          fill={metal}
          stroke="#69747B"
          strokeWidth={1.4}
        />
      </>
    ) : (
      <>
        <Path
          d="M94 87l5-36 29-24 30 11 16 32-13 32-38 10z"
          fill={/nugget/.test(id) ? metal : /stone/.test(id) ? '#A84D45' : dark}
          stroke="#49545E"
        />
        <Path
          d="M99 51l28 16 31-29m-31 29-4 45m4-45 47 3M94 87l33-20 34 35"
          stroke={/nugget/.test(id) ? '#FDE7A0' : '#82919A'}
          strokeWidth={2}
        />
      </>
    );
  } else if (/baseball/.test(id)) {
    subject = (
      <>
        <Circle cx={130} cy={73} r={39} fill={paint(uid, 'pearl')} />
        <Path
          d="M105 42q31 30 0 62m50-62q-31 30 0 62"
          stroke="#A84645"
          fill="none"
          strokeWidth={2}
        />
        {[48, 57, 66, 75, 84, 93].map((y) => (
          <Path key={y} d={`M109 ${y}l7 3m28-3 7 3`} stroke="#A84645" />
        ))}
        <Path d="M116 77q6-14 9 0l4-8 5 9 11-5" stroke="#334A6D" fill="none" />
      </>
    );
  } else if (/mission-patch/.test(id)) {
    subject = (
      <>
        <Circle cx={130} cy={73} r={43} fill="#27394E" stroke="#BDA676" strokeWidth={5} />
        <Path d="M96 93q34-33 68 0v10H96z" fill="#C0CED3" />
        <Path d="M127 40h6l9 40h-24z" fill={paper} />
        <Path d="M124 80l6 19 6-19" fill="#D9A44B" />
        {[105, 151, 113, 156].map((x, i) => (
          <Circle key={x} cx={x} cy={43 + i * 9} r={1.5} fill="#F4ECD9" />
        ))}
      </>
    );
  } else if (/tooth/.test(id)) {
    subject = (
      <>
        <Path
          d="M106 34q28-14 48 5 3 39-44 79 16-45-4-84z"
          fill={paper}
          stroke="#97836A"
          strokeWidth={2}
        />
        <Path
          d="M116 37q16 38-6 81m17-84q19 32-17 84m29-80q6 27-15 60"
          fill="none"
          stroke="#AF9B7D"
        />
      </>
    );
  } else if (/lava-lamps/.test(id)) {
    subject = (
      <>
        {[95, 130, 165].map((x, i) => (
          <G key={x}>
            <Path d={`M${x - 8} 28h16l8 69h-32z`} fill={glass} stroke="#708393" />
            <Path d={`M${x - 16} 97h32l6 22h-44zM${x - 8} 28l3-10h10l3 10z`} fill={metal} />
            <Ellipse
              cx={x}
              cy={77 - i * 9}
              rx={8}
              ry={14}
              fill={['#D9668C', '#E7B554', '#7CA28C'][i]}
            />
            <Circle cx={x + 2} cy={46 + i * 9} r={5} fill="#E69DB0" />
          </G>
        ))}
      </>
    );
  } else if (/twine/.test(id)) {
    subject = (
      <>
        <Circle cx={130} cy={77} r={43} fill="#B28F5F" />
        {Array.from({ length: 14 }, (_, i) => (
          <Ellipse
            key={i}
            cx={130}
            cy={77}
            rx={10 + i * 2.4}
            ry={41}
            transform={`rotate(${i * 23} 130 77)`}
            fill="none"
            stroke={i % 2 ? '#DCC49A' : '#886A47'}
            strokeWidth={1.2}
          />
        ))}
      </>
    );
  } else if (/arcade|jukebox|pinball/.test(id)) {
    subject = (
      <>
        <Path
          d={/pinball/.test(id) ? 'M84 73l70-35 28 46-71 34z' : 'M94 125V42q0-25 36-25t36 25v83z'}
          fill={wood}
          stroke={line}
          strokeWidth={2}
        />
        <Path
          d={/pinball/.test(id) ? 'M91 74l59-28 23 34-60 28z' : 'M103 42h54v43h-54z'}
          fill={dark}
          stroke="#BDA676"
          strokeWidth={3}
        />
        <Path d="M113 55h34v21h-34z" fill="#436C75" />
        <Path d="M118 60l9 7 13-10m-26 39h34" stroke="#E6B959" strokeWidth={3} fill="none" />
        {/jukebox/.test(id) ? (
          <>
            <Path
              d="M102 118V45q0-20 28-20t28 20v73"
              stroke="#E2B55E"
              strokeWidth={5}
              fill="none"
            />
            <Path
              d="M113 101v17m8-17v17m8-17v17m8-17v17m8-17v17"
              stroke="#BDA676"
              strokeWidth={2}
            />
          </>
        ) : (
          <>
            <Circle cx={115} cy={94} r={3} fill="#B85350" />
            <Circle cx={149} cy={96} r={3} fill="#DEBB67" />
          </>
        )}
      </>
    );
  } else if (/rubber-chicken|gnome|mannequin|fleece/.test(id)) {
    subject = /rubber-chicken/.test(id) ? (
      <>
        <Path
          d="M115 57q-8-26 8-30 15-5 18 13l-1 25q22 14 14 36-7 17-32 10-20-9-7-32z"
          fill="#E4BF68"
          stroke="#A67A3C"
        />
        <Path
          d="M137 40l17 6-14 6m-13-24-4-10 6 4 4-7 5 14M119 110l-6 15h12m15-15 8 15h-12"
          fill="#B44F3F"
          stroke="#963F35"
        />
        <Circle cx={134} cy={38} r={2} fill="#28323A" />
      </>
    ) : (
      <>
        <Circle cx={130} cy={46} r={15} fill={paper} />
        <Path
          d="M112 64h36l10 42-28 12-28-12z"
          fill={/fleece/.test(id) ? metal : '#5A7889'}
          stroke={line}
        />
        <Path
          d="M114 73l-15 20m47-20 15 20M117 111l-4 16m30-16 4 16"
          stroke={/mannequin/.test(id) ? wood : dark}
          strokeWidth={7}
        />
        {/gnome/.test(id) ? (
          <>
            <Path d="M111 39l19-33 20 33z" fill="#B34B46" />
            <Path d="M115 51l15 33 15-33q-15 11-30 0" fill={paper} />
          </>
        ) : null}
      </>
    );
  } else if (/toaster/.test(id)) {
    subject = (
      <>
        <Path
          d="M100 119V69q-17-12-8-29 12-20 38-7 28-12 40 7 9 17-8 29v50z"
          fill="#C49661"
          stroke="#88613E"
          strokeWidth={5}
        />
        <Path
          d="M113 68l10 3m15 0 10-3m-34 21q17 16 34 0"
          stroke="#785239"
          strokeWidth={5}
          fill="none"
        />
      </>
    );
  } else if (/footprint/.test(id)) {
    subject = (
      <>
        <Path
          d="M110 112q-10-20 1-44-12-27 3-37 11-10 29-4 27 6 15 31-10 22-9 48 1 24-22 23-13-1-17-17z"
          fill={paper}
          stroke="#9E978A"
          strokeWidth={2}
        />
        {[113, 123, 134, 144, 153].map((x, i) => (
          <Ellipse key={x} cx={x} cy={37 + i * 1.2} rx={3} ry={5} fill="#B3A58E" />
        ))}
        <Path d="M121 62q-8 23-2 42m17-45q9 15 1 27" stroke="#B3A58E" strokeWidth={3} fill="none" />
      </>
    );
  } else if (/trophy/.test(id)) {
    subject = (
      <>
        <Path
          d="M109 40H89v13q0 22 27 22m35-35h20v13q0 22-27 22"
          stroke="#BDA676"
          strokeWidth={6}
          fill="none"
        />
        <Path d="M104 33h52v25q0 22-21 25v24h19v9h-48v-9h19V83q-21-3-21-25z" fill={metal} />
        <Rect x={100} y={116} width={60} height={10} rx={2} fill={wood} />
        <Text x={130} y={55} fontSize={6} textAnchor="middle" fill="#70552F">
          OKAYEST
        </Text>
        <Text x={130} y={66} fontSize={6} textAnchor="middle" fill="#70552F">
          BOSS
        </Text>
      </>
    );
  } else if (/sculpture/.test(id)) {
    subject = (
      <>
        <Rect x={99} y={115} width={62} height={12} fill={dark} />
        <Circle cx={130} cy={31} r={10} fill={metal} />
        <Path
          d="M120 43h20l8 31-10 8 7 33h-11l-6-31-6 31h-10l9-39-9-12z"
          fill={metal}
          stroke="#6E573D"
        />
        <Path d="M118 50 105 78m36-28 13 30" stroke="#BDA676" strokeWidth={7} />
      </>
    );
  } else {
    subject = <FramedWork id={id} uid={uid} />;
  }
  return (
    <>
      <Materials id={uid} color="#577D8B" />
      {subject}
    </>
  );
}

function FramedWork({ id, uid }: { id: string; uid: string }) {
  const paper = paint(uid, 'paper');
  let image;
  if (/bathers/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#91B0AF" />
        <Path d="M87 68q40-18 86 0v46H87z" fill="#638D80" />
        <Path d="M87 87q40-16 86 0v27H87z" fill="#86B1BC" />
        {[112, 144].map((x, i) => (
          <G key={x}>
            <Circle cx={x} cy={61 + i * 7} r={5} fill="#D9B697" />
            <Path d={`M${x - 4} ${67 + i * 7}h8l4 23h-16z`} fill="#D9B697" />
            <Path d={`M${x - 2} ${90 + i * 3}l-4 13m8-13 5 13`} stroke="#D9B697" strokeWidth={3} />
          </G>
        ))}
      </>
    );
  else if (/red-interior/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#A64C48" />
        <Path d="M87 94h86v20H87z" fill="#705445" />
        <Rect
          x={96}
          y={39}
          width={27}
          height={33}
          fill="#94B4BD"
          stroke="#D8B88A"
          strokeWidth={3}
        />
        <Path d="M109 39v33m-13-16h27" stroke="#D8B88A" />
        <Path
          d="M136 70h23v25h-23zM139 95v13m18-13v13"
          fill="#B78E59"
          stroke="#684733"
          strokeWidth={2}
        />
      </>
    );
  else if (/long-table/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#C4C1B5" />
        <Path d="M87 30l22 20h42l22-20M87 114l22-29h42l22 29" fill="#777D7C" />
        <Path d="M104 77l15-16h22l16 16z" fill="#E6E0D0" />
        <Path d="M108 77v25m44-25v25m-32-39v22m20-22v22" stroke="#4D5153" strokeWidth={3} />
      </>
    );
  else if (/mid-drawing/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill={paper} />
        <Path
          d="M96 101l12-18 1-28q3-5 5 0v18l3-30q4-5 5 1v28l4-34q4-3 4 3v32l6-25q5-4 4 4l-5 29 12-8q6 1 1 6l-19 25m-24-11 17 12"
          stroke="#5C5751"
          strokeWidth={1}
          fill="none"
        />
      </>
    );
  else if (/mid-collage/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#CFB28A" />
        <Path
          d="M89 45l24-9 8 37-27 5m40-41 35 8-11 38-24-12M93 92l37-18 13 36H98"
          fill="#7D6D88"
        />
        <Path d="M105 52l31-7 17 34-26 11z" fill="#C56C4B" />
        <Path d="M94 91l58-6 17 23H96z" fill="#527A70" />
        <Path d="M98 45l14 5m33 7 15 6m-46 32 19-6" stroke="#EBD7B1" strokeWidth={3} />
      </>
    );
  else if (/orchard-wall/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#BACAC2" />
        <Path d="M87 86h86v28H87z" fill="#BDA987" />
        {[105, 130, 155].map((x) => (
          <G key={x}>
            <Path d={`M${x} 87V57`} stroke="#6F6248" strokeWidth={2} />
            <Circle cx={x} cy={57} r={15} fill="#668068" />
            <Circle cx={x - 5} cy={52} r={2} fill="#BE7F51" />
          </G>
        ))}
        <Path
          d="M87 95h86m-86 9h86m-68-18v9m24-9v9m24-9v9m-60 0v9m24-9v9m24-9v9m24-9v9"
          stroke="#8F826A"
        />
      </>
    );
  else if (/portrait|bathers/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#667E72" />
        <Path d="M93 114q1-36 35-36t39 36z" fill="#5A3C42" />
        <Path d="M119 70v14q11 9 21-1V69" fill="#BD916F" />
        <Ellipse cx={130} cy={58} rx={17} ry={24} fill={paper} />
        <Path d="M113 57q-5-33 18-29 24 1 16 28l-10-18-23 10" fill="#403B3C" />
        <Path d="M119 56h7m8 0h7m-13 16h9" stroke="#6D5749" strokeWidth={1.5} />
      </>
    );
  else if (/neon/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#242936" />
        <Text
          x={130}
          y={65}
          fontSize={13}
          textAnchor="middle"
          fill="#F3ADC7"
          stroke="#DE688E"
          strokeWidth={0.5}
        >
          I WAS
        </Text>
        <Text x={130} y={85} fontSize={13} textAnchor="middle" fill="#BCE5EE">
          HERE
        </Text>
      </>
    );
  else if (/still-life|pop/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#879482" />
        <Path d="M87 86h86v28H87z" fill="#AA7058" />
        {/pop/.test(id) ? (
          <>
            <Rect x={112} y={44} width={37} height={53} fill={paper} />
            <Rect x={112} y={60} width={37} height={23} fill="#B24D43" />
            <Ellipse cx={130.5} cy={44} rx={18.5} ry={4} fill={paint(uid, 'steel')} />
          </>
        ) : (
          <>
            <Ellipse cx={130} cy={94} rx={32} ry={8} fill={paper} />
            {[113, 131, 145].map((x, i) => (
              <Ellipse
                key={x}
                cx={x}
                cy={86 - i * 5}
                rx={10}
                ry={7}
                fill="#DDB44F"
                transform={`rotate(${i * 25} ${x} 86)`}
              />
            ))}
          </>
        )}
      </>
    );
  else if (/photo|city|interior|collage/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#596F80" />
        {[0, 1, 2, 3, 4].map((i) => (
          <G key={i}>
            <Rect
              x={88 + i * 17}
              y={42 + (i % 3) * 9}
              width={15}
              height={62 - (i % 3) * 9}
              fill={['#B5967E', '#48555E', '#D2AF86'][i % 3]}
            />
            {[0, 1, 2, 3].map((r) => (
              <Path
                key={r}
                d={`M${91 + i * 17} ${50 + r * 12 + (i % 3) * 9}h7`}
                stroke="#E7C78C"
                strokeWidth={3}
              />
            ))}
          </G>
        ))}
        <Path d="M87 104h86v10H87z" fill="#333D48" />
        {/ufo/.test(id) ? <Ellipse cx={132} cy={43} rx={25} ry={5} fill="#DBDDCF" /> : null}
      </>
    );
  else if (/abstract|field|square|drawing|print/.test(id))
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill={paper} />
        {/black-square/.test(id) ? (
          <Rect x={102} y={44} width={56} height={56} fill="#24262C" />
        ) : (
          <>
            <Path
              d="M90 41l62-5-29 73-35-8z"
              fill={/emerging-abstract/.test(id) ? '#3E668B' : '#BD8B51'}
            />
            <Circle cx={141} cy={77} r={24} fill="#9B5553" opacity={0.8} />
            <Path d="M95 100l58-56m-49 60 58-20m-55-39 43 53" stroke="#383F49" strokeWidth={2} />
          </>
        )}
      </>
    );
  else
    image = (
      <>
        <Rect x={87} y={30} width={86} height={84} fill="#A9C4C9" />
        <Circle cx={148} cy={47} r={10} fill="#F0D599" />
        <Path d="M87 79l19-26 21 25 16-20 30 24v32H87z" fill="#778C8D" />
        <Path d="M87 93q23-26 46-11t40-1v33H87z" fill="#577C69" />
        {/harbor/.test(id) ? (
          <>
            <Path d="M87 95h86v19H87z" fill="#709EAF" />
            <Path d="M104 96h39l-8 8h-24zM122 96V62l18 24h-18" fill="#E6D8B9" />
          </>
        ) : (
          <>
            <Path d="M87 110q34-26 86-10" stroke="#CFBA8B" strokeWidth={6} fill="none" />
            {[98, 143, 161].map((x, i) => (
              <G key={x}>
                <Path d={`M${x} 98V${65 + i * 5}`} stroke="#69523C" strokeWidth={2} />
                <Circle
                  cx={x}
                  cy={67 + i * 5}
                  r={9}
                  fill={/october/.test(id) ? '#B47744' : '#436D5D'}
                />
              </G>
            ))}
          </>
        )}
      </>
    );
  return (
    <>
      <Rect
        x={76}
        y={19}
        width={108}
        height={106}
        fill={paint(uid, 'wood')}
        stroke="#463A31"
        strokeWidth={1.5}
      />
      <Rect x={82} y={25} width={96} height={94} fill={paper} />
      {image}
      <Path d="M78 123V21h104" stroke="#E2C496" strokeWidth={1.5} fill="none" />
      <Path d="M84 117V28h91" stroke="#6D543B" fill="none" />
    </>
  );
}
