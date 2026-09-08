import { describe, it } from 'vitest';
import { levelOf, MAJORS } from '@yearafter/education';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { applyToCollege, cannotEnrol, admissionOdds, nextDegreeFor } from './college';
import { applyFor, chanceOf, openings, workHarder } from './careers';
import { askParent } from './guardians';

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};

describe('college', () => {
  it('is much rarer for somebody who does not chase it', () => {
    const N = 200;
    const levels: Record<string, number> = {};
    for (let i = 0; i < N; i += 1) {
      let state = createNewGame({ seed: `pas-${i}` });
      for (let y = 0; y < 30; y += 1) {
        state = advanceYear(state).state;
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const d = state.pending[0];
          const c = d?.choices[0];
          if (!d || !c) break;
          const r = decide(state, d.eventId, c.id);
          if (!r.ok) break;
          state = r.value.state;
        }
        // One shot at eighteen, and never asks anybody for help.
        if (state.player.age === 18 && !cannotEnrol(state)) {
          const r = applyToCollege(state, MAJORS[i % MAJORS.length]!.id);
          if (r.ok) state = r.value.state;
        }
      }
      levels[levelOf(state.education.credentials)] =
        (levels[levelOf(state.education.credentials)] ?? 0) + 1;
    }
    console.log('\npassive player, one application at 18, no help asked:');
    console.log(' ', JSON.stringify(levels));
  });

  it('is reachable, costs something, and not everybody finishes', () => {
    const N = 300;
    const levels: Record<string, number> = {};
    let applied = 0,
      accepted = 0,
      blocked: Record<string, number> = {};
    let finishedCollege = 0,
      failedOut = 0,
      ranOut = 0,
      wentPostgrad = 0;
    const cashAt22: number[] = [];
    const cashAt30: number[] = [];
    const oddsSeen: number[] = [];

    for (let i = 0; i < N; i += 1) {
      let state = createNewGame({ seed: `col-${i}` });
      let sawFail = false,
        sawBroke = false;
      for (let y = 0; y < 40; y += 1) {
        state = advanceYear(state).state;
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const d = state.pending[0];
          const c = d?.choices[0];
          if (!d || !c) break;
          const r = decide(state, d.eventId, c.id);
          if (!r.ok) break;
          state = r.value.state;
        }
        for (const e of state.player.timeline.slice(-4)) {
          if (e.text.includes('Failed out')) sawFail = true;
          if (e.text.includes('Could not cover')) sawBroke = true;
        }
        const age = state.player.age;

        // A player who wants a degree: apply every year they can.
        // Ask the parents for help first — 0209 built exactly this request and
        // it has meant nothing until now.
        if (age >= 17 && age <= 24) {
          for (const parent of state.family.members.filter(
            (m) => (m.role === 'mother' || m.role === 'father') && m.alive,
          )) {
            const r = askParent(state, parent.id, 'help-with-college');
            if (r.ok) {
              state = r.value.state;
              break;
            }
          }
        }
        const why = cannotEnrol(state);
        if (!why && nextDegreeFor(state)) {
          oddsSeen.push(admissionOdds(state));
          const major = MAJORS[(i + age) % MAJORS.length]!;
          const r = applyToCollege(state, major.id);
          if (r.ok) {
            applied += 1;
            state = r.value.state;
            if (r.value.accepted) accepted += 1;
          }
        } else if (why && age >= 18 && age <= 30) {
          blocked[why] = (blocked[why] ?? 0) + 1;
        }

        // And works when not studying.
        // Spec 1823: full-time work during college is allowed. The first
        // version of this harness excluded students, which is not the game.
        if (age >= 18) {
          if (!state.employment.job) {
            const list = [...openings(state)].sort(
              (a, b) => chanceOf(state, b) - chanceOf(state, a),
            );
            for (const job of list.slice(0, 2)) {
              const r = applyFor(state, String(job.id));
              if (!r.ok) continue;
              state = r.value.state;
              if (r.value.hired) break;
            }
          } else {
            const r = workHarder(state);
            if (r.ok) state = r.value.state;
          }
        }
        if (age === 22) cashAt22.push(Number(state.player.cash) / 100);
        if (age === 30) cashAt30.push(Number(state.player.cash) / 100);
      }
      const level = levelOf(state.education.credentials);
      levels[level] = (levels[level] ?? 0) + 1;
      if (state.education.credentials?.university !== undefined) finishedCollege += 1;
      if (state.education.credentials?.postgraduate !== undefined) wentPostgrad += 1;
      if (sawFail) failedOut += 1;
      if (sawBroke) ranOut += 1;
    }

    console.log(`\n${N} lives, player always tries for a degree\n`);
    console.log('final education level:', JSON.stringify(levels));
    console.log(
      `applications ${applied}, accepted ${accepted} (${Math.round((accepted / Math.max(1, applied)) * 100)}%)`,
    );
    console.log(
      `finished a degree ${finishedCollege} (${Math.round((finishedCollege / N) * 100)}%)`,
    );
    console.log(`postgraduate ${wentPostgrad} (${Math.round((wentPostgrad / N) * 100)}%)`);
    console.log(`failed out ${failedOut}   ran out of money ${ranOut}`);
    console.log('why blocked (18-30):', JSON.stringify(blocked));
    console.log(
      `admission odds: p10 ${q(oddsSeen, 0.1).toFixed(2)} med ${q(oddsSeen, 0.5).toFixed(2)} p90 ${q(oddsSeen, 0.9).toFixed(2)}`,
    );
    console.log(
      `cash at 22: med $${q(cashAt22, 0.5).toFixed(0)}   at 30: med $${q(cashAt30, 0.5).toFixed(0)}`,
    );
  });
});
