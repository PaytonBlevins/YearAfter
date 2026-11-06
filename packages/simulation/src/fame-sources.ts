/** Combine distinct kinds of recognition, giving each only the room left by the others. */
export function combinedFame(
  carried: number,
  social: number,
  sports: number,
  laurels: number,
  acting: number,
  music: number,
  modeling: number,
): number {
  // Laurels already include sports fame, and carried fame already includes previous fields.
  const sources = [social, Math.max(sports, laurels), acting, music, modeling];
  const unseen = sources.reduce((remaining, score) => remaining * (1 - score / 100), 1);
  return Math.min(100, Math.max(carried, Math.round(100 * (1 - unseen))));
}
