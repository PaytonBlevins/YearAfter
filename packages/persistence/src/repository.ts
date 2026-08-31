/**
 * Ticket 0006 — save repository interface.
 *
 * The simulation never talks to SQLite. It talks to this interface, which the
 * in-memory adapter implements for tests and the expo-sqlite adapter implements
 * on device. That is what lets the whole engine be tested in plain Node.
 */

import type { SaveId } from '@yearafter/core';
import type { Result } from '@yearafter/core';
import type { CurrentSaveGame, SaveSummary } from './save-schema';
import type { MigrationError } from './migrations';

export type LoadError =
  | { readonly kind: 'notFound'; readonly id: SaveId }
  | { readonly kind: 'unreadable'; readonly id: SaveId; readonly reason: MigrationError };

export interface SaveRepository {
  /** Insert a new save. Rejects if the id already exists. */
  create(save: CurrentSaveGame): Promise<Result<CurrentSaveGame, string>>;
  /** Read one save, running migrations if it was written by an older build. */
  load(id: SaveId): Promise<Result<CurrentSaveGame, LoadError>>;
  /** Overwrite an existing save. Stamps updatedAt. */
  update(save: CurrentSaveGame): Promise<Result<CurrentSaveGame, string>>;
  /** Remove a save permanently. */
  delete(id: SaveId): Promise<Result<void, string>>;
  /** Summaries for the save-select list, newest first. */
  list(): Promise<readonly SaveSummary[]>;
  /** Close underlying handles. No-op for in-memory. */
  close(): Promise<void>;
}
