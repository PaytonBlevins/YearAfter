/**
 * Ticket 0203 — answering decisions.
 */

import { describe, expect, it } from 'vitest';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

/** Play forward until the game asks something. */
function untilDecision(seed: string): GameState {
  let state = createNewGame({ seed, startYear: 2000 });
  for (let i = 0; i < 40; i += 1) {
    state = advanceYear(state).state;
    if (state.pending.length > 0) return state;
  }
  throw new Error(`no decision was raised in 40 years of seed ${seed}`);
}

describe('decide', () => {
  it('clears the decision and appends its outcome to the feed', () => {
    const state = untilDecision('DECIDE');
    const decision = state.pending[0];
    expect(decision).toBeDefined();
    if (!decision) return;

    const before = state.player.timeline.length;
    const result = decide(state, decision.eventId, decision.choices[0]!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.state.pending).toHaveLength(state.pending.length - 1);
    expect(result.value.state.pending.map((d) => d.eventId)).not.toContain(decision.eventId);
    expect(result.value.state.player.timeline.length).toBe(before + 1);
    expect(result.value.entry.text.length).toBeGreaterThan(0);
    expect(result.value.entry.text).not.toMatch(/[{}]/);
  });

  it('files the answer under the year the question was asked', () => {
    // Otherwise a decision raised at 14 and answered at 15 reads as if the
    // consequence happened before the event that caused it.
    const state = untilDecision('YEAR');
    const decision = state.pending[0];
    if (!decision) return;
    const result = decide(state, decision.eventId, decision.choices[0]!.id);
    if (!result.ok) return;
    expect(result.value.entry.age).toBe(decision.age);
    expect(result.value.entry.year).toBe(decision.year);
  });

  it('does not mutate the state it was given', () => {
    const state = untilDecision('IMMUTABLE');
    const decision = state.pending[0];
    if (!decision) return;
    const before = state.player.timeline.length;
    const pendingBefore = state.pending.length;
    decide(state, decision.eventId, decision.choices[0]!.id);
    expect(state.pending).toHaveLength(pendingBefore);
    expect(state.player.timeline.length).toBe(before);
  });

  it('returns a typed failure for a stale decision rather than throwing', () => {
    // Two devices, one save: the second answer arrives after the first landed.
    const state = untilDecision('STALE');
    const decision = state.pending[0];
    if (!decision) return;
    const first = decide(state, decision.eventId, decision.choices[0]!.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = decide(first.value.state, decision.eventId, decision.choices[0]!.id);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe('no-such-decision');
  });

  it('returns a typed failure for a choice that was never offered', () => {
    const state = untilDecision('BADCHOICE');
    const decision = state.pending[0];
    if (!decision) return;
    const result = decide(state, decision.eventId, 'not-a-choice');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('no-such-choice');
  });

  it('lets the answer change stats or family warmth', () => {
    const state = untilDecision('EFFECT');
    const decision = state.pending[0];
    if (!decision) return;

    let moved = false;
    for (const choice of decision.choices) {
      const result = decide(state, decision.eventId, choice.id);
      if (!result.ok) continue;
      const after = result.value.state;
      moved ||= Object.keys(state.player.stats).some(
        (key) =>
          state.player.stats[key as keyof typeof state.player.stats] !==
          after.player.stats[key as keyof typeof after.player.stats],
      );
      moved ||= after.family.members.some((member, index) => {
        const original = state.family.members[index];
        return original ? original.relationship !== member.relationship : false;
      });
    }
    expect(moved).toBe(true);
  });

  it('unblocks time', () => {
    const state = untilDecision('UNBLOCK');
    const decision = state.pending[0];
    if (!decision) return;
    expect(advanceYear(state).state).toBe(state);

    let current = state;
    while (current.pending.length > 0) {
      const next = current.pending[0]!;
      const answered = decide(current, next.eventId, next.choices[0]!.id);
      expect(answered.ok).toBe(true);
      if (!answered.ok) return;
      current = answered.value.state;
    }
    expect(advanceYear(current).state.player.age).toBe(state.player.age + 1);
  });

  it('replays identically from the same seed and the same answers', () => {
    const run = () => {
      const state = untilDecision('GOLDEN-DECISION');
      const decision = state.pending[0]!;
      const result = decide(state, decision.eventId, decision.choices[0]!.id);
      return result.ok ? result.value.entry.text : 'failed';
    };
    expect(run()).toBe(run());
  });
});
