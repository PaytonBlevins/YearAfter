import type { BusinessRescue } from '@yearafter/simulation';
/**
 * Ticket 0005 — SaveGameV1.
 *
 * PROTECTED CONTRACT (spec 1060–1066): save format.
 *
 * Spec 1108–1140: saves carry an explicit schema version, migrations are tested,
 * and old dynasties should stay loadable whenever possible. The rule that follows
 * from that: never repurpose or narrow an existing field. Add a field, bump the
 * version, write a migration, keep the old reader working.
 */

import type { Character } from '@yearafter/character';
import type { EducationState } from '@yearafter/education';
import type { SocialCircle } from '@yearafter/social';
import type { ParentingState } from '@yearafter/parenting';
import type { EmploymentState, PartnerCareers } from '@yearafter/careers';
import type {
  HeldCard,
  HeldLoan,
  Holding,
  HouseholdFinances,
  Ledger,
  MarketState,
  OwnedHome,
  OwnedVehicle,
  OwnedValuable,
  OwnedBusiness,
  PrivateDeal,
  Channel,
  PriceBook,
  Representation,
  RetirementState,
} from '@yearafter/finance';
import type { HealthState } from '@yearafter/health';
import type { EventHistory, PendingDecision } from '@yearafter/events';
import type {
  CollegeOffer,
  JobOffer,
  LifeOffer,
  PursuitOffer,
  HomeOffer,
  VehicleOffer,
  RenovationOffer,
  AuctionDiary,
  CelebrityState,
  RngSnapshot,
  WorldState,
} from '@yearafter/simulation';
import type { Household } from '@yearafter/relationships';
import type { SaveId } from '@yearafter/core';

/** P7: explicit purchase savings goal; old lives migrate with no goal. */
/** P10: optional paid aftermarket watch work; legacy values stay unchanged. */
/** P11: optional once-paid preventive car service, expires after the next advance. */
export const CURRENT_SAVE_VERSION = 51;

export interface SaveSettings {
  /** Reduced animation and shorter transitions. */
  readonly reduceMotion: boolean;
  /** Development-only helpers. Never true in a production build. */
  readonly debugMode: boolean;
}

export const DEFAULT_SETTINGS: SaveSettings = {
  reduceMotion: false,
  debugMode: false,
};

export type { WorldState };

/**
 * v2 added `player.personality` (Ticket 0201).
 * v3 added `family` (Ticket 0202).
 * v4 added `nameCultureId`, `events` and `pending` (Ticket 0203).
 * v5 added `education` (Ticket 0204).
 * v6 added `names` to a pending decision (Ticket 0203b).
 * v7 added tryout memory to education (Ticket 0204b).
 * v8 added Study Harder's once-a-year memory (Ticket 0205).
 * v9 added `circle` — classmates, friends and teachers (Ticket 0206).
 * v10 replaced the circle's once-a-year cap with per-year contact counting,
 *     and gave every joined activity a performance record (Ticket 0206b).
 * v11 de-duplicated timeline ids written by pre-0206b builds (Ticket 0207c).
 * v12 added `parenting` — a pregnancy, an adoption, and what a child asked for
 *     (Ticket 0208). Children themselves live in `family` as a fourth role.
 * v13 added `employment` — the job, its performance, and standing in every
 *     field ever worked in (Ticket 0210).
 * v33 let a home carry a `letting` — its rent setting, its agent and the tenant
 * in each unit (Ticket 0503). Optional on every home, and no save before it
 * could let anything, so the migration has nothing to write; the version is
 * bumped so a build that cannot read a tenant refuses the save rather than
 * dropping them.
 *
 * v43 added `celebrities.work` — what the character has said yes to this year (a photoshoot, a
 * commercial, a talk show, a guest-star part), which settles with the year's creator income
 * (Ticket 0707). Every save before it has said yes to nothing, so the migration writes an
 * empty record for year 0.
 *
 * v42 added `celebrities` — the famous people the character has met, who it is still in touch
 * with, and the year a stranger was last answered (Ticket 0705). Every save before it has met
 * nobody, so the migration writes an empty record.
 *
 * v41 added `channels` and `fame` — what the character makes things for, and how well
 * known it has made them (Ticket 0701). Every save before it has neither, so the migration
 * writes an empty list and zero.
 *
 * v40 added `deals` — the private deals the character has made (Ticket 0605).
 * Every save before it holds none, so the migration writes an empty list.
 *
 * v39 added `branches` to each business — the years its extra locations opened
 * (Ticket 0602). A business before it had one door, so every one gets `[]`.
 *
 * v38 added `businesses` — every business the character owns, each holding its
 * own money (Ticket 0601). Every save before it owns none, so the migration
 * writes an empty list.
 *
 * v37 added `auctions` — this year's auction diary, the sales attended and
 * the lots bid on (Ticket 0507) — and lets a valuable carry `fake` and
 * `reproduction`. All optional and new, so the migration only bumps.
 *
 * v36 added `valuables` — jewelry, watches and collectibles the character
 * owns — and `renovationOffer`, the question the game asks about a home
 * falling apart (Ticket 0506). A home may also carry `renovations`, which is
 * optional. Every save before it owns no valuables, so the migration writes an
 * empty list, and repairs a `home.renovate` left in `pending` without its
 * payload.
 *
 * v35 lets a car carry `mods` — what has been fitted to it (Ticket 0505).
 * Optional, and nothing before could write one, so the migration only bumps
 * the version.
 *
 * v34 added `vehicles` — every car the character owns, each carrying its own
 * loan — `vehicleOffer`, the question the game asks about one, and
 * `inspected`, the used listings somebody paid to have looked at this year
 * (Ticket 0504). Every save before it owns no car, so the migration writes an
 * empty list, and repairs a `vehicle.offer` left in `pending` without its
 * payload.
 *
 * v32 added `homes` — every home the character owns, each carrying its own
 * mortgage — and `homeOffer`, the question the game asks about one (Ticket
 * 0501). Every save before it owns nothing, so the migration writes an empty
 * list, and repairs a `home.offer` left in `pending` without its payload.
 *
 * v31 added `pursuitOffer` — a club, team or pursuit the game asked about
 * unprompted (Ticket 0416) — and the first adult entries `education.activities`
 * can hold. Neither needs migration content: absent means no question open, and
 * a v30 save's activities are all school ones. Like v30 it repairs one thing: a
 * v30 save cannot hold an `activity.offer` in `pending`, so one that does is a
 * question nothing can answer and is dropped.
 *
 * v30 added `lifeOffer` — a romantic step or a child the game asked about
 * unprompted (Ticket 0410). Absent means there is no question open, which is
 * true of every save written before the door existed, so there is no migration
 * content. The migration DOES repair one thing: a v29 save cannot hold a
 * `romance.offer` or `family.offer` in `pending`, so a save that somehow does
 * is holding a decision nothing can answer, and it is dropped.
 *
 * v29 made `offer.fromJobId` optional (Ticket 0407). An offer without one is
 * the first-job door rather than a poaching offer; a v28 save can never hold
 * one, so there is nothing to migrate.
 *
 * v28 added `credentials.licenses` and the `vocational` stage to education
 * (Ticket 0406). Both ride inside `EducationState`, which is persisted whole,
 * so neither needed a field here.
 *
 * v14 added `credentials` to education — what a character has actually
 *     finished, derived from the stage a save already recorded (Ticket 0210b).
 * v15 de-duplicated timeline ids AGAIN, for the same reason v11 did and a
 *     different producer: `t:YEAR:work:N` collided when a character quit a job
 *     and was hired somewhere else in the same year (Ticket 0211a). It also
 *     renamed `inClass` to `inRoom` on everybody in the circle.
 * v16 added `health` — conditions held, the age curve's running total, and what
 *     illness still owes back (Ticket 0211).
 *
 * Ticket 0207 (Love) did NOT bump the version, and that is a decision rather
 * than an oversight. It added one optional field, `romance`, to a person in the
 * circle. Absent already means exactly what it has to mean for every existing
 * save — this is not somebody you were ever going out with — so there is nothing
 * for a migration to compute. A version bump whose migration is the identity
 * function is a lie about what changed.
 *
 * v11 repairs duplicate timeline ids left in saves written before 0206b
 * (Ticket 0207c). It changes no field and adds none — and it is still a real
 * migration, because it is the only thing that can fix data a fixed producer
 * can no longer produce.
 *
 * Older saves migrate forward; see migrations.ts.
 */
export interface SaveGameV18 {
  readonly version: 51;
  readonly id: SaveId;
  /** Master RNG seed plus live domain-stream states. */
  readonly rng: RngSnapshot;
  readonly world: WorldState;
  readonly player: Character;
  /** Ticket 0202. Beside the player, not on them — see GameState. */
  readonly family: Household;
  /** Ticket 0201's naming tradition, kept so event text stays culturally local. */
  readonly nameCultureId: string;
  /** Ticket 0203: cooldowns, scheduled chains and story flags. */
  readonly events: EventHistory;
  /**
   * Decisions raised but not yet answered. Persisted deliberately — a question
   * asked on a phone at a bus stop has to still be there on a tablet that night.
   */
  readonly pending: readonly PendingDecision[];
  /** Ticket 0204: enrolment, grades, behaviour and extracurriculars. */
  readonly education: EducationState;
  readonly circle: SocialCircle;
  /** Ticket 0208: pregnancy, adoption, and the open question from a child. */
  readonly parenting: ParentingState;
  /**
   * Ticket 0210: the job, how it is going, and standing in every field ever
   * worked in.
   *
   * Standing is a map keyed by track rather than one number, because spec
   * 113–118 is explicit that reputation is career-specific — a save that stored
   * a single reputation would be storing the wrong shape forever.
   */
  readonly employment: EmploymentState;
  readonly partnerCareers: PartnerCareers;
  /** Ticket 0211: conditions held, the age curve's running total, and the deficit. */
  readonly health: HealthState;
  /**
   * Ticket 0301: every movement of money, and the balance they add up to.
   *
   * `player.cash` is still here and is now a MIRROR of `finance.balance` rather
   * than a number anybody computes. Spec 21 keeps the detail backend-only —
   * "do not show month-by-month accounting to the player" — so this is stored
   * for correctness and QA, and 0304's dashboard reads totals from it.
   */
  readonly finance: Ledger;
  /** Ticket 0303: the standard of living, and whether they pay for a roof. */
  readonly household: HouseholdFinances;
  /** Ticket 0306: cards held, and what is on them. */
  readonly cards: readonly HeldCard[];
  /** Ticket 0307: loans taken, and what is left of them. */
  readonly loans: readonly HeldLoan[];
  /** Ticket 0308: what is invested, and the market it is invested in. */
  readonly portfolio: readonly Holding[];
  readonly market: MarketState;
  /** Ticket 0308c: every instrument's price history. */
  readonly prices: PriceBook;
  /** Ticket 0309. Who they pay for advice, if anybody. Usually nobody. */
  readonly advisorId?: string;
  /** P7: whole dollars explicitly protected for a purchase. */
  readonly cashGoal?: number;
  /** Ticket 0310. The retirement account, the service, and whether they stopped. */
  readonly retirement: RetirementState;
  /**
   * Ticket 0402. A job somebody offered, waiting on an answer.
   *
   * Optional because most years do not have one, and absent rather than a null
   * sentinel so the save stays the shape the state is.
   */
  readonly offer?: JobOffer;
  /**
   * Ticket 0405. A college or graduate-school application the game raised
   * unprompted, waiting on an answer.
   *
   * Optional for the same reason `offer` is: most years do not have one, and
   * absent rather than a null sentinel so the save stays the shape the state
   * is.
   */
  readonly collegeOffer?: CollegeOffer;
  /**
   * Ticket 0410. A step in a private life the game raised unprompted, waiting
   * on an answer — asking somebody out, the next rung, or a child.
   *
   * One optional field for both questions, for the reason `GameState.lifeOffer`
   * gives: only one of them can ever be open at once, so a second field would
   * describe a state that cannot occur.
   */
  readonly lifeOffer?: LifeOffer;
  /** Ticket 0416. Something to join, waiting on an answer. */
  readonly pursuitOffer?: PursuitOffer;
  /** Ticket 0501. The homes the character owns. Always present from v32. */
  readonly homes: readonly OwnedHome[];
  /** Ticket 0501. A home the game asked about, waiting on an answer. */
  readonly homeOffer?: HomeOffer;
  /** Ticket 0504. The cars the character owns. Always present from v34. */
  readonly vehicles: readonly OwnedVehicle[];
  /** Ticket 0504. A car the game asked about, waiting on an answer. */
  readonly vehicleOffer?: VehicleOffer;
  /** Ticket 0504. Used listings inspected this year. */
  readonly inspected?: readonly string[];
  /** Ticket 0506. Jewelry, watches and collectibles. Always present from v36. */
  readonly valuables: readonly OwnedValuable[];
  /** Ticket 0506. A renovation the game asked about, waiting on an answer. */
  readonly renovationOffer?: RenovationOffer;
  readonly businessRescue?: BusinessRescue;
  /** Ticket 0507. This year's auction diary. */
  readonly auctions?: AuctionDiary;
  /** Ticket 0601. The businesses the character owns. Always present from v38. */
  readonly businesses: readonly OwnedBusiness[];
  /** Ticket 0605. The private deals the character has made. Always present from v40. */
  readonly deals: readonly PrivateDeal[];
  /** Ticket 0701. The channels the character makes things for. Always present from v41. */
  readonly channels: readonly Channel[];
  /** Ticket 0701. How well known the character is, 0–100. Always present from v41. */
  readonly fame: number;
  /** Ticket 0704. A manager or an agent, never both. Omitted when nobody is hired; no version bump. */
  readonly representation?: Representation;
  /** Ticket 0705. The famous people the character has met. Always present from v42. */
  readonly celebrities: CelebrityState;
  /*
    Ticket 0212 adds no top-level field. `player.records` is finally populated
    and children carry a `life`, but both were already part of `Character` and
    `FamilyMember` — declared in Sprint Zero and 0208 respectively, and written
    by nothing until now. That is CORE_RULES 13.36, and it is also why this
    version bump changes a number and a default rather than a shape.
  */
  readonly settings: SaveSettings;
  /** Unix ms. Metadata only — never used in simulation logic. */
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** The union widens as versions are added; the app only ever handles the latest. */
export type AnySaveGame = SaveGameV18;
export type CurrentSaveGame = SaveGameV18;

/** Lightweight row for the save-select list, without deserialising the whole save. */
export interface SaveSummary {
  readonly id: SaveId;
  readonly characterName: string;
  readonly age: number;
  readonly year: number;
  readonly generation: number;
  readonly occupation: string;
  readonly updatedAt: number;
}

export function summarise(save: CurrentSaveGame): SaveSummary {
  return {
    id: save.id,
    characterName: `${save.player.firstName} ${save.player.lastName}`,
    age: save.player.age,
    year: save.world.year,
    generation: save.world.generation,
    occupation: save.player.occupation,
    updatedAt: save.updatedAt,
  };
}
