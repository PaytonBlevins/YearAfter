/**
 * Ticket 0003 — Core package: stable identifier primitives.
 *
 * IDs are branded strings. The brand exists only at compile time; at runtime an
 * ID is a plain string, so it serialises into saves and content files unchanged.
 * Logic must never depend on display names (spec 1213–1223) — it depends on these.
 */

declare const brand: unique symbol;

type Branded<T, B extends string> = T & { readonly [brand]: B };

export type CharacterId = Branded<string, 'CharacterId'>;
export type NpcId = Branded<string, 'NpcId'>;
export type SaveId = Branded<string, 'SaveId'>;
export type AssetId = Branded<string, 'AssetId'>;
export type CareerId = Branded<string, 'CareerId'>;
export type EventId = Branded<string, 'EventId'>;

export const asCharacterId = (value: string): CharacterId => value as CharacterId;
export const asNpcId = (value: string): NpcId => value as NpcId;
export const asSaveId = (value: string): SaveId => value as SaveId;
export const asAssetId = (value: string): AssetId => value as AssetId;
export const asCareerId = (value: string): CareerId => value as CareerId;
export const asEventId = (value: string): EventId => value as EventId;

/**
 * Deterministic id factory. Every id is derived from a save-scoped counter rather
 * than a global random source, so a replayed save produces identical ids
 * (spec 1108–1140: centralised seeded randomness, no scattered entropy).
 */
export class IdFactory {
  private counters = new Map<string, number>();

  constructor(private readonly prefix: string) {}

  next(kind: string): string {
    const current = this.counters.get(kind) ?? 0;
    const nextValue = current + 1;
    this.counters.set(kind, nextValue);
    return `${this.prefix}:${kind}:${nextValue}`;
  }

  /** Serialise counters so ids stay unique across save/load cycles. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  static restore(prefix: string, snapshot: Record<string, number>): IdFactory {
    const factory = new IdFactory(prefix);
    for (const [kind, value] of Object.entries(snapshot)) {
      factory.counters.set(kind, value);
    }
    return factory;
  }
}
