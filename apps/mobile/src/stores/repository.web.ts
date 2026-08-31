/**
 * Web variant of the save repository.
 *
 * Metro resolves `.web.ts` ahead of `.ts` on web builds. The shipping targets
 * are iOS and Android; web exists so the shell can be opened quickly in a
 * browser for layout review. Saves are in-memory there and do not persist,
 * which is fine for that purpose and honest about what it is.
 */

import { MemorySaveRepository, type SaveRepository } from '@yearafter/persistence';

export async function openSaveRepository(): Promise<SaveRepository> {
  return new MemorySaveRepository();
}
