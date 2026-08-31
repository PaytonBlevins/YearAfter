/**
 * Ticket 0006 — expo-sqlite save repository.
 *
 * Acceptance: the character persists after an app restart.
 *
 * The save body is stored as a single JSON document rather than a normalised
 * schema. That is deliberate: the save shape changes constantly during
 * development, and versioned JSON plus tested migrations (spec 1108–1140) is far
 * cheaper to evolve than fifty tables. Summary columns are duplicated out of the
 * document only so the save list can render without parsing every row.
 *
 * This module is the only place in the codebase that imports expo-sqlite.
 */

import { err, ok, type Result, type SaveId } from '@yearafter/core';
import { migrateSave } from '../migrations';
import type { LoadError, SaveRepository } from '../repository';
import { summarise, type CurrentSaveGame, type SaveSummary } from '../save-schema';

/**
 * The slice of the expo-sqlite API this adapter uses. Declaring it locally keeps
 * the package testable and typecheckable without expo-sqlite installed, and
 * makes the dependency surface obvious.
 */
export interface SqliteDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: unknown[]): Promise<unknown>;
  getFirstAsync<T>(source: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(source: string, params?: unknown[]): Promise<T[]>;
  closeAsync?(): Promise<void>;
}

interface SaveRow {
  id: string;
  document: string;
  character_name: string;
  age: number;
  year: number;
  generation: number;
  occupation: string;
  updated_at: number;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS saves (
  id             TEXT PRIMARY KEY NOT NULL,
  document       TEXT NOT NULL,
  character_name TEXT NOT NULL,
  age            INTEGER NOT NULL,
  year           INTEGER NOT NULL,
  generation     INTEGER NOT NULL,
  occupation     TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS saves_updated_at ON saves (updated_at DESC);
`;

export class SqliteSaveRepository implements SaveRepository {
  private constructor(private readonly db: SqliteDatabase) {}

  /** Create the table if needed and return a ready repository. */
  static async open(db: SqliteDatabase): Promise<SqliteSaveRepository> {
    await db.execAsync(SCHEMA);
    return new SqliteSaveRepository(db);
  }

  async create(save: CurrentSaveGame): Promise<Result<CurrentSaveGame, string>> {
    const existing = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM saves WHERE id = ?',
      [save.id],
    );
    if (existing) {
      return err(`A save with id ${save.id} already exists.`);
    }
    const summary = summarise(save);
    await this.db.runAsync(
      `INSERT INTO saves
        (id, document, character_name, age, year, generation, occupation, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        save.id,
        JSON.stringify(save),
        summary.characterName,
        summary.age,
        summary.year,
        summary.generation,
        summary.occupation,
        save.createdAt,
        save.updatedAt,
      ],
    );
    return ok(save);
  }

  async load(id: SaveId): Promise<Result<CurrentSaveGame, LoadError>> {
    const row = await this.db.getFirstAsync<Pick<SaveRow, 'document'>>(
      'SELECT document FROM saves WHERE id = ?',
      [id],
    );
    if (!row) {
      return err({ kind: 'notFound', id });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.document);
    } catch (cause) {
      return err({
        kind: 'unreadable',
        id,
        reason: { kind: 'corrupt', detail: String(cause) },
      });
    }
    const migrated = migrateSave(parsed);
    if (!migrated.ok) {
      return err({ kind: 'unreadable', id, reason: migrated.error });
    }
    return ok(migrated.value);
  }

  async update(save: CurrentSaveGame): Promise<Result<CurrentSaveGame, string>> {
    const stamped: CurrentSaveGame = { ...save, updatedAt: Date.now() };
    const summary = summarise(stamped);
    const result = (await this.db.runAsync(
      `UPDATE saves SET
         document = ?, character_name = ?, age = ?, year = ?,
         generation = ?, occupation = ?, updated_at = ?
       WHERE id = ?`,
      [
        JSON.stringify(stamped),
        summary.characterName,
        summary.age,
        summary.year,
        summary.generation,
        summary.occupation,
        stamped.updatedAt,
        stamped.id,
      ],
    )) as { changes?: number } | undefined;

    if (result && typeof result.changes === 'number' && result.changes === 0) {
      return err(`No save with id ${save.id} to update.`);
    }
    return ok(stamped);
  }

  async delete(id: SaveId): Promise<Result<void, string>> {
    const result = (await this.db.runAsync('DELETE FROM saves WHERE id = ?', [id])) as
      { changes?: number } | undefined;
    if (result && typeof result.changes === 'number' && result.changes === 0) {
      return err(`No save with id ${id} to delete.`);
    }
    return ok(undefined);
  }

  async list(): Promise<readonly SaveSummary[]> {
    const rows = await this.db.getAllAsync<SaveRow>(
      `SELECT id, character_name, age, year, generation, occupation, updated_at
       FROM saves ORDER BY updated_at DESC`,
    );
    return rows.map((row) => ({
      id: row.id as SaveId,
      characterName: row.character_name,
      age: row.age,
      year: row.year,
      generation: row.generation,
      occupation: row.occupation,
      updatedAt: row.updated_at,
    }));
  }

  async close(): Promise<void> {
    await this.db.closeAsync?.();
  }
}
