import type { ReactElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { ActionButton, ListRow } from '../components';

/** Render, and hand back what a test needs to look at and press. */
export async function show(element: ReactElement): Promise<ReactTestRenderer> {
  let rendered: ReactTestRenderer | undefined;
  await act(() => {
    rendered = create(element);
  });
  if (!rendered) throw new Error('Did not render');
  return rendered;
}

/** Host elements (View, Text, Pressable) are plain strings under the test runner's mock. */
export const hosts = (r: ReactTestRenderer, name: string): ReactTestInstance[] =>
  r.root.findAll((node) => (node.type as unknown) === name);

export const rowsOf = (r: ReactTestRenderer): ReactTestInstance[] => r.root.findAllByType(ListRow);
export const buttonsOf = (r: ReactTestRenderer): ReactTestInstance[] =>
  r.root.findAllByType(ActionButton);

/** Every string on screen, in order. */
export function textsOf(r: ReactTestRenderer): string[] {
  return hosts(r, 'Text')
    .map((node) => node.children.map((child) => (typeof child === 'string' ? child : '')).join(''))
    .filter((text) => text.length > 0);
}

export const rowTitled = (r: ReactTestRenderer, title: string): ReactTestInstance => {
  const row = rowsOf(r).find((candidate) => candidate.props.title === title);
  if (!row) throw new Error(`No row titled ${title}`);
  return row;
};
export const buttonLabelled = (r: ReactTestRenderer, label: string): ReactTestInstance => {
  const button = buttonsOf(r).find((candidate) => candidate.props.label === label);
  if (!button) throw new Error(`No button labelled ${label}`);
  return button;
};
