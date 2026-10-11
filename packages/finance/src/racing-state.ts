/**
 * Ticket 0808 — what a racing team keeps between seasons. A leaf: it imports nothing, so `businesses.ts` can hold
 * it on an owned business without a cycle.
 *
 * Optional on `OwnedBusiness` and absent on every other kind of business. A racing team with none is a new one, and
 * the engine builds the default (`defaultTeam`) the first time it plays a season.
 */

export type TeamRung = 1 | 2 | 3 | 4 | 5;

export type TeamDevelopment = 'lean' | 'steady' | 'heavy';

/**
 * Who is in the car. A hired driver is a person with a skill, paid by the series' figure scaled by it; the owner
 * (`kind: 'owner'`) is the player's own driving career, which the team does not pay.
 */
export type TeamDriver =
  | {
      readonly kind: 'hired';
      readonly id: string;
      readonly name: string;
      /** 0–100, on the same scale as the field. */
      readonly skill: number;
      readonly age: number;
    }
  | { readonly kind: 'owner' };

export interface SeasonResult {
  readonly year: number;
  readonly rung: TeamRung;
  readonly place: number;
  readonly field: number;
  readonly title: boolean;
  /** A crash or a blown engine cost the team something this year. */
  readonly incident: boolean;
}

export interface RacingTeam {
  readonly rung: TeamRung;
  /** 0–100, on the field's scale: how good the car is against the others in the series. */
  readonly car: number;
  readonly driver: TeamDriver;
  readonly development: TeamDevelopment;
  /** Championships won as an owner. */
  readonly titles: number;
  /** The highest rung the team has run in. */
  readonly best: TeamRung;
  readonly seasons: number;
  readonly last?: SeasonResult;
}
