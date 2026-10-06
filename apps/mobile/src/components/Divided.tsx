import type { ReactNode } from 'react';
import { RowDivider } from './index';

/** A row inside a Card, with the hairline above it unless it is the first. */
export function Divided({
  first,
  children,
}: {
  readonly first: boolean;
  readonly children: ReactNode;
}) {
  return (
    <>
      {first ? null : <RowDivider />}
      {children}
    </>
  );
}
