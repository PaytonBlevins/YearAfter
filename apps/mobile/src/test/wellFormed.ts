/**
 * Ticket 0809 — what every screen of rows and buttons has in common, checked once for all of them.
 *
 * Found by the sabotage pass: a hairline in the wrong place, a row that says it can be pressed and
 * cannot, a button with a style that does not exist. None of those change what a row says, so a
 * test of the words never sees them.
 */

import { expect } from 'vitest';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { Card, ListRow, RowDivider } from '../components';
import { buttonsOf, rowsOf } from './harness';

const kindOf = (node: ReactTestInstance): 'row' | 'divider' | undefined =>
  node.type === ListRow ? 'row' : node.type === RowDivider ? 'divider' : undefined;

/** Inside each card the rows and hairlines alternate: none first or last, none doubled, none missing. */
export function expectWellDivided(r: ReactTestRenderer, except: readonly string[] = []): void {
  const cards = r.root.findAllByType(Card);
  for (const card of cards) {
    // A card the screen already had, which is not this ticket's to hold to the rule.
    const titles = card.findAllByType(ListRow).map((row) => String(row.props.title));
    if (titles.some((title) => except.includes(title))) continue;
    expect(card.findAll((node) => kindOf(node) === 'row').length, 'an empty card').toBeGreaterThan(
      0,
    );
    const kinds = card
      .findAll((node) => kindOf(node) !== undefined)
      .map((node) => kindOf(node)!)
      .join(' ');
    expect(kinds, kinds).not.toMatch(/^divider/);
    expect(kinds, kinds).not.toMatch(/divider$/);
    expect(kinds, kinds).not.toMatch(/divider divider/);
    expect(kinds, kinds).not.toMatch(/row row/);
  }
}

/** A row that can be pressed says so, and a row that says so can be pressed (or is greyed). */
export function expectAffordancesTrue(r: ReactTestRenderer): void {
  for (const row of rowsOf(r)) {
    const label = String(row.props.title);
    expect([undefined, 'navigate', 'action', 'none'], label).toContain(row.props.affordance);
    if (row.props.onPress) expect(row.props.affordance, label).not.toBe('none');
    if (row.props.affordance === 'action' && !row.props.onPress) {
      expect(row.props.disabled, label).toBe(true);
    }
  }
}

export function expectButtonsStyled(r: ReactTestRenderer): void {
  for (const button of buttonsOf(r)) {
    expect([undefined, 'primary', 'secondary', 'quiet', 'danger']).toContain(button.props.variant);
  }
}

export function expectWellFormed(r: ReactTestRenderer, except: readonly string[] = []): void {
  expectWellDivided(r, except);
  expectAffordancesTrue(r);
  expectButtonsStyled(r);
}
