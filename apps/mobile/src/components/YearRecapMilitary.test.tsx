/**
 * Ticket 0906 — the year recap's service, agency and benefits lines, and the discharge card.
 *
 * The cards are read from lines and states the real engines wrote, not from fixtures of lines, so a
 * change in an engine's ids or its end-of-service rules shows up here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { advanceYear, decide, type GameState } from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { ADULT, withMusic } from '../test/entertainmentFixtures';
import {
  agencyReady,
  eligible,
  inAgency,
  pastRow,
  serving,
  veteran,
} from '../test/militaryFixtures';
import { show, textsOf } from '../test/harness';
import { OutcomeCard } from './OutcomeCard';
import { YearRecapNotice, noticesOf, recapOutcome } from './YearRecapNotice';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function render(state: GameState, overlay: object = {}) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, ...overlay });
  if (rendered) {
    await act(() => rendered?.update(<YearRecapNotice />));
  } else {
    rendered = await show(<YearRecapNotice />);
  }
  return rendered;
}
const cards = () => rendered?.root.findAllByType(OutcomeCard) ?? [];

const person = eligible(ADULT);
const age = person.player.age;

/** The lines of one kind the year wrote, from the state the engine returned. */
const linesOf = (state: GameState, kind: 'military' | 'intel' | 'veteran'): string[] =>
  state.player.timeline
    .filter((row) => new RegExp(`^t:${state.world.year}:${kind}:\\d+$`).test(row.id))
    .map((row) => row.text);

/** A serving member whose year ends in a term question, and the state after leaving. */
function leaving(): { before: GameState; asked: GameState; after: GameState } {
  const before = serving(person, { years: 3, termEnds: 4 });
  const asked = advanceYear(before).state;
  const question = asked.pending.find((row) => row.eventId === 'military.offer');
  if (!question) throw new Error('no end-of-term question was raised');
  const result = decide(asked, question.eventId, 'leave');
  if (!result.ok) throw new Error(`could not leave: ${String(result.error)}`);
  return { before, asked, after: result.value.state };
}

describe('the recap carries a year in uniform, an agency and a veteran’s benefits', () => {
  it('names a soldier’s year "Your service" from the lines the service engine wrote', () => {
    const before = serving(person, { years: 3, termEnds: 4 });
    const after = advanceYear(before).state;
    const lines = linesOf(after, 'military');
    expect(lines.length).toBeGreaterThan(0);
    const outcome = recapOutcome(before, after)!;
    expect(outcome.title).toBe('Your service');
    expect(outcome.body).toBe(lines.join(' '));
    expect(outcome.tone).toBe('neutral');
  });

  it('names an agent’s year "Your agency"', () => {
    const before = inAgency(agencyReady());
    const after = advanceYear(before).state;
    const lines = linesOf(after, 'intel');
    expect(lines.length).toBeGreaterThan(0);
    const outcome = recapOutcome(before, after)!;
    expect(outcome.title).toBe('Your agency');
    expect(outcome.body).toBe(lines.join(' '));
  });

  it('names the first retired-pay year "Your benefits"', () => {
    const before = veteran(person, { years: 22, how: 'retired', endedAge: age });
    const after = advanceYear(before).state;
    const lines = linesOf(after, 'veteran');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/first retirement check/);
    const outcome = recapOutcome(before, after)!;
    expect(outcome.title).toBe('Your benefits');
    expect(outcome.body).toBe(lines[0]);
  });

  it('is one titled card with each field named when several happened', () => {
    const singing = withMusic(serving(person, { years: 3, termEnds: 4 }), {
      released: { single: 1, ep: 0, lp: 0 },
      plan: { single: 1, ep: 0, lp: 0, tour: false },
    });
    const after = advanceYear(singing).state;
    const outcome = recapOutcome(singing, after)!;
    expect(outcome.title).toBe('The year in your work');
    expect(outcome.body).toContain('Music: ');
    expect(outcome.body).toContain(`Your service: ${linesOf(after, 'military').join(' ')}`);
  });

  it('is nothing in a year with no service, agency or benefit line', () => {
    expect(recapOutcome(person, advanceYear(person).state)).toBeUndefined();
  });

  it('leaves out the lines a player’s own verbs wrote, which carry a tag in the id', () => {
    const after = advanceYear(person).state;
    const own = ['military:enlist:0', 'intel:applied:0', 'work:service:0', 'work:agency:1'].map(
      (tag, index) =>
        ({
          id: `t:${after.world.year}:${tag}`,
          text: `A line from ${tag}.`,
          age: after.player.age,
          year: after.world.year,
          kind: 'passive',
          sequence: 9_100 + index,
        }) as never,
    );
    const withOwn: GameState = {
      ...after,
      player: { ...after.player, timeline: [...after.player.timeline, ...own] },
    };
    expect(recapOutcome(person, withOwn)).toBeUndefined();
  });
});

describe('the discharge card', () => {
  it('is read from an answer at the end of a term, which is not a year turn', () => {
    const { asked, after } = leaving();
    expect(after.world.year).toBe(asked.world.year);
    const cardsMade = noticesOf(asked, after);
    expect(cardsMade).toHaveLength(1);
    expect(cardsMade[0]!.title).toBe('You left the service');
    expect(cardsMade[0]!.body).toContain('You chose to leave when your term was up.');
    expect(cardsMade[0]!.body).toContain('Your discharge: Honorable.');
  });

  it('is nothing at the question itself, while the member is still in uniform', () => {
    const { before, asked } = leaving();
    expect(noticesOf(before, asked).every((card) => card.title !== 'You left the service')).toBe(
      true,
    );
  });

  it('takes the year’s service lines out of the recap, since it says them', () => {
    const before = serving(person, { years: 3, termEnds: 4 });
    const turned = advanceYear(before).state;
    expect(recapOutcome(before, turned)).toBeDefined();
    const ended: GameState = { ...turned, military: { past: [pastRow({ years: 4 })] } };
    expect(recapOutcome(before, ended)).toBeUndefined();
    const withOther: GameState = {
      ...turned,
      military: { past: [pastRow({ years: 4 })] },
      player: {
        ...turned.player,
        timeline: [
          ...turned.player.timeline,
          {
            id: `t:${turned.world.year}:acting:0`,
            text: 'Wrapped a film.',
            age: turned.player.age,
            year: turned.world.year,
            kind: 'passive',
            sequence: 9_000,
          } as never,
        ],
      },
    };
    expect(recapOutcome(before, withOther)!.title).toBe('Acting');
  });

  it('comes first, then the year’s recap', () => {
    const before = serving(person, { years: 3, termEnds: 4 });
    const turned = advanceYear(before).state;
    const ended: GameState = {
      ...turned,
      military: { past: [pastRow({ years: 4 })] },
      player: {
        ...turned.player,
        timeline: [
          ...turned.player.timeline,
          {
            id: `t:${turned.world.year}:acting:0`,
            text: 'Wrapped a film.',
            age: turned.player.age,
            year: turned.world.year,
            kind: 'passive',
            sequence: 9_000,
          } as never,
        ],
      },
    };
    expect(noticesOf(before, ended).map((card) => card.title)).toEqual([
      'You left the service',
      'Acting',
    ]);
  });
});

describe('the notice shows them one at a time', () => {
  it('shows the discharge card, then the recap behind it, and then nothing', async () => {
    const before = serving(person, { years: 3, termEnds: 4 });
    const turned = advanceYear(before).state;
    const ended: GameState = {
      ...turned,
      military: { past: [pastRow({ years: 4 })] },
      player: {
        ...turned.player,
        timeline: [
          ...turned.player.timeline,
          {
            id: `t:${turned.world.year}:acting:0`,
            text: 'Wrapped a film.',
            age: turned.player.age,
            year: turned.world.year,
            kind: 'passive',
            sequence: 9_000,
          } as never,
        ],
      },
    };
    await render(before);
    expect(cards()).toHaveLength(0);
    await render(ended);
    expect(cards()).toHaveLength(1);
    expect(cards()[0]!.props.outcome.title).toBe('You left the service');
    expect(textsOf(rendered!).join(' ')).toContain('Your discharge: Honorable.');
    await act(() => cards()[0]!.props.onDismiss());
    expect(cards()).toHaveLength(1);
    expect(cards()[0]!.props.outcome.title).toBe('Acting');
    await act(() => cards()[0]!.props.onDismiss());
    expect(cards()).toHaveLength(0);
  });

  it('keeps the cards still to read when the state changes again with nothing new to say', async () => {
    const before = serving(person, { years: 3, termEnds: 4 });
    const turned = advanceYear(before).state;
    const ended: GameState = {
      ...turned,
      military: { past: [pastRow({ years: 4 })] },
      player: {
        ...turned.player,
        timeline: [
          ...turned.player.timeline,
          {
            id: `t:${turned.world.year}:acting:0`,
            text: 'Wrapped a film.',
            age: turned.player.age,
            year: turned.world.year,
            kind: 'passive',
            sequence: 9_000,
          } as never,
        ],
      },
    };
    await render(before);
    await render(ended);
    expect(cards()[0]!.props.outcome.title).toBe('You left the service');
    await render({ ...ended });
    expect(cards()).toHaveLength(1);
    expect(cards()[0]!.props.outcome.title).toBe('You left the service');
    await act(() => cards()[0]!.props.onDismiss());
    expect(cards()[0]!.props.outcome.title).toBe('Acting');
  });

  it('shows the discharge card for an answer given in place, with no year turn', async () => {
    const { asked, after } = leaving();
    await render(asked);
    await render(after);
    expect(cards()).toHaveLength(1);
    expect(cards()[0]!.props.outcome.title).toBe('You left the service');
  });

  it('waits behind a card already on screen, such as the answer’s own, then shows', async () => {
    const { asked, after } = leaving();
    await render(asked);
    await render(after, { outcome: { title: 'You left', body: 'Done', tone: 'neutral' } });
    expect(cards()).toHaveLength(0);
    await render(after);
    expect(cards()).toHaveLength(1);
    expect(cards()[0]!.props.outcome.title).toBe('You left the service');
  });
});
