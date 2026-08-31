/**
 * In-memory save repository.
 *
 * Used by every test and by the balance/simulation tools, which run thousands of
 * lives and must not touch a disk. It serialises through JSON on write so it
 * catches the same "this value does not survive a round trip" bugs SQLite would.
 */

import { err, ok, type Result, type SaveId } from '@yearafter/core';
import { migrateSave } from '../migrations';
import type { LoadError, SaveRepository } from '../repository';
import { summarise, type CurrentSaveGame, type SaveSummary } from '../save-schema';

export class MemorySaveRepository implements SaveRepository {
  private readonly rows = new Map<string, string>();

  async create(save: CurrentSaveGame): Promise<Result<CurrentSaveGame, string>> {
    if (this.rows.has(save.id)) {
      return err(`A save with id ${save.id} already exists.`);
    }
    this.rows.set(save.id, JSON.stringify(save));
    return ok(save);
  }

  async load(id: SaveId): Promise<Result<CurrentSaveGame, LoadError>> {
    const row = this.rows.get(id);
    if (row === undefined) {
      return err({ kind: 'notFound', id });
    }
    const migrated = migrateSave(JSON.parse(row));
    if (!migrated.ok) {
      return err({ kind: 'unreadable', id, reason: migrated.error });
    }
    return ok(migrated.value);
  }

  async update(save: CurrentSaveGame): Promise<Result<CurrentSaveGame, string>> {
    if (!this.rows.has(save.id)) {
      return err(`No save with id ${save.id} to update.`);
    }
    const stamped: CurrentSaveGame = { ...save, updatedAt: Date.now() };
    this.rows.set(save.id, JSON.stringify(stamped));
    return ok(stamped);
  }

  async delete(id: SaveId): Promise<Result<void, string>> {
    if (!this.rows.delete(id)) {
      return err(`No save with id ${id} to delete.`);
    }
    return ok(undefined);
  }

  async list(): Promise<readonly SaveSummary[]> {
    const summaries: SaveSummary[] = [];
    for (const row of this.rows.values()) {
      const migrated = migrateSave(JSON.parse(row));
      if (migrated.ok) summaries.push(summarise(migrated.value));
    }
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async close(): Promise<void> {
    // Nothing to release.
  }

  /** Test helper: write a raw row to exercise migration and corruption paths. */
  seedRaw(id: string, json: string): void {
    this.rows.set(id, json);
  }
}
