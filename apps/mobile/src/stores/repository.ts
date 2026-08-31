/**
 * Ticket 0006 — opening the on-device save database.
 *
 * The only file in the app that knows persistence is SQLite. Everything else
 * takes a `SaveRepository`.
 */

import * as SQLite from 'expo-sqlite';
import {
  SqliteSaveRepository,
  type SaveRepository,
  type SqliteDatabase,
} from '@yearafter/persistence';

const DATABASE_NAME = 'yearafter.db';

export async function openSaveRepository(): Promise<SaveRepository> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return SqliteSaveRepository.open(db as unknown as SqliteDatabase);
}
