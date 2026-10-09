/**
 * Game state binding.
 *
 * The one place the UI touches the simulation. Screens read from this context
 * and call its actions; no component constructs simulation objects or talks to
 * the repository directly.
 *
 * Autosave runs after every Advance (spec 0105: advance saves and stays on the
 * Life experience). Saving is fire-and-forget against the UI — the player never
 * waits on a write — but failures surface in `saveError` rather than vanishing.
 */

import { GIG_UNAVAILABLE_LABELS } from '@yearafter/education';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { asSaveId, type SaveId } from '@yearafter/core';
import type { PurchasePayment } from '@yearafter/finance';
import {
  setLifestyle,
  LIFESTYLE_ERROR_LABELS,
  advanceYear,
  createNewGame,
  decide as resolveDecision,
  generateSeed,
  interact,
  askToJoin,
  askParent,
  leaveActivity as leaveTheActivity,
  practise,
  romanticMove,
  answerChild,
  applyToAdopt,
  kickOut,
  tryForBaby,
  useDatingApp,
  quitGig,
  takeGig,
  study,
  tryOut as attemptTryout,
  type GameState,
  applyFor,
  workHarder,
  resign,
  applyToCollege,
  leaveCollege,
  seeDoctor,
  treatCondition,
  applyForNewCard,
  payCard,
  closeCard,
  takeLoan,
  buyHome,
  sellHome,
  buyVehicle,
  sellVehicle,
  inspectVehicle,
  fitVehicleMod,
  serviceVehicle,
  SERVICE_VEHICLE_ERROR_LABELS,
  FIT_MOD_ERROR_LABELS,
  renovate,
  RENOVATE_ERROR_LABELS,
  buyValuable,
  sellValuable,
  BUY_VALUABLE_ERROR_LABELS,
  iceValuable,
  attendAuction,
  bidOn,
  ATTEND_ERROR_LABELS,
  BID_ERROR_LABELS,
  BUY_VEHICLE_ERROR_LABELS,
  SELL_VEHICLE_ERROR_LABELS,
  INSPECT_ERROR_LABELS,
  BUY_HOME_ERROR_LABELS,
  changeRent,
  fillEmptyUnits,
  moveBackIn,
  rentOut,
  setAgent,
  signTenant,
  RENTAL_ERROR_LABELS,
  type RentalChange,
  type RentalError,
  invest,
  divest,
  payLoan,
  stopTreatment,
  continueAsChild,
  hireAdvisor,
  dismissAdvisor,
  actOnAdvice,
  setCashGoal,
  CASH_GOAL_ERROR_LABELS,
  setContribution,
  retireNow,
  takeOutEarly,
  openBusiness,
  buyBusiness,
  BUY_REFUSAL_LABELS,
  FINANCE_ERROR_LABELS,
  expandBusiness,
  closeLocation,
  setPrice as setBusinessPrice,
  setBusinessAgentLevel,
  BUSINESS_AGENT_ERROR_LABELS,
  searchSupplier,
  acceptSupplier,
  passSupplier,
  SUPPLIER_ERROR_LABELS,
  setPayroll as setBusinessPayroll,
  hireStaff as hireBusinessStaff,
  letStaffGo as letBusinessStaffGo,
  setAutoStaff as setBusinessAutoStaff,
  sellBusiness,
  closeBusiness,
  type Financing,
} from '@yearafter/simulation';
import { type LifestyleTier, EXPAND_REFUSAL_LABELS, OPEN_REFUSAL_LABELS } from '@yearafter/finance';
import type { BidTier, Payroll, BusinessAgentLevel } from '@yearafter/finance';
import type { PendingDecision } from '@yearafter/events';

import type { TimelineEntry } from '@yearafter/character';
import {
  applyConnection,
  applyCreatorAction,
  applyFameWork,
  applyMeeting,
  type Attempt,
  type CreatorAction,
} from './fameActions';
import type { Detail } from '../components/DetailCard';
import type { Outcome } from '../components/OutcomeCard';
import type { Result } from '@yearafter/core';

/** Ticket 0503. The landlord's verbs, as one action the screens dispatch. */
export type LettingAction =
  | { readonly type: 'rentOut'; readonly homeId: string }
  | { readonly type: 'moveBackIn'; readonly homeId: string }
  | { readonly type: 'rent'; readonly homeId: string; readonly direction: 1 | -1 }
  | { readonly type: 'agent'; readonly homeId: string; readonly managed: boolean }
  | {
      readonly type: 'sign';
      readonly homeId: string;
      readonly unit: number;
      readonly applicantId: string;
    }
  | { readonly type: 'fill'; readonly homeId: string };
import {
  DEFAULT_SETTINGS,
  fromSave,
  toSave,
  type SaveRepository,
  type SaveSettings,
} from '@yearafter/persistence';

interface GameContextValue {
  readonly chooseLifestyle: (tier: LifestyleTier) => void;
  readonly ready: boolean;
  readonly state: GameState | null;
  readonly settings: SaveSettings;
  readonly saveId: SaveId | null;
  readonly saveError: string | null;
  /** Entries produced by the most recent Advance, for feed emphasis. */
  readonly lastEntries: readonly TimelineEntry[];
  /** Ticket 0210b. The result of the last thing the player pressed, if unread. */
  readonly outcome?: Outcome;
  readonly dismissOutcome: () => void;
  /** Ticket 0210c. A breakdown the player asked to see, if open. */
  readonly detail?: Detail;
  readonly showDetail: (detail: Detail) => void;
  readonly dismissDetail: () => void;
  /**
   * The question the game is waiting on, if any (Ticket 0203). One at a time:
   * a year can raise up to three, and stacking three cards on a phone is how a
   * life sim starts to feel like a form.
   */
  readonly decision: PendingDecision | null;
  readonly advance: () => void;
  /** Returns a screen the chosen option asked to open, if any (Ticket 0204). */
  readonly answer: (eventId: string, choiceId: string) => string | undefined;
  /**
   * The one school lever the player has (spec 1821), once per school year.
   * Replaces the three-way effort setting: review asked for "just a button that
   * says study harder".
   */
  readonly studyHarder: () => void;
  readonly joinActivity: (activityId: string) => void;
  /** Ticket 0209. Ask a parent for something. They may well say no. */
  readonly askAParent: (parentId: string, requestId: string) => void;
  /** Ticket 0210. Put your name in for a job. Once each per year, and it can fail. */
  readonly applyForJob: (jobId: string) => void;
  /** Ticket 0210. Work Harder, twice a year, the mirror of Study Harder. */
  readonly workHarderAt: () => void;
  /** Ticket 0210. Walk out. No confirmation — see `resign`. */
  readonly quitJob: () => void;
  /** Ticket 0210b. Apply to study a subject. Being turned down is a real outcome. */
  readonly applyToStudy: (majorId: string) => void;
  /** Ticket 0210b. Leave a degree. Spec 1824 removes leave-of-absence. */
  readonly leaveStudies: () => void;
  /** Ticket 0211. The yearly check-up. Small on purpose — spec 531. */
  readonly visitDoctor: () => void;
  /** Ticket 0211. Put a doctor on a condition, or take them off it. */
  readonly treatFor: (conditionId: string) => void;
  /** Ticket 0306. Apply for a card, pay one down, or close it. */
  readonly applyForCard: (productId: string) => void;
  readonly payCardOff: (productId: string, amount: number) => void;
  readonly closeCardOff: (productId: string) => void;
  /** Ticket 0307. Borrow, and pay extra off. */
  readonly borrow: (productId: string, amount: number) => void;
  /** Ticket 0501. Buy a listed home, outright or with a mortgage. */
  readonly buyAHome: (listingId: string, how: 'cash' | 'mortgage') => void;
  /** Ticket 0501. Spec 211's one Sell action. */
  readonly sellAHome: (homeId: string) => void;
  /** Ticket 0503. Everything a landlord does, one verb at a time. */
  readonly letting: (action: LettingAction) => void;
  /** Ticket 0504. Buy a car off a lot, outright or on the lender's instant answer. */
  readonly buyACar: (listingId: string, how: 'cash' | 'loan') => void;
  /** Ticket 0504. Sell a car to a dealer. */
  readonly sellACar: (vehicleId: string) => void;
  /** Ticket 0504. Pay a mechanic to look a used car over. */
  readonly inspectACar: (listingId: string) => void;
  /** Ticket 0505. Have a shop fit a modification. */
  readonly serviceACar: (vehicleId: string, payment?: PurchasePayment) => void;
  readonly fitACarMod: (vehicleId: string, modId: string) => void;
  /** Ticket 0506. Have a builder do something to a home. */
  readonly renovateHome: (homeId: string, renovationId: string, payment?: PurchasePayment) => void;
  /** Ticket 0601. Open a business, run it, sell it or close it. */
  readonly openABusiness: (typeId: string, finance?: Financing) => void;
  /** Ticket 0603. Buy one that is for sale. A loan is written into the purchase, never paid out as cash. */
  readonly buyABusiness: (listingId: string, finance?: Financing) => void;
  readonly searchBusinessSupplier: (businessId: string) => void;
  readonly acceptBusinessSupplier: (businessId: string, pitchId: string) => void;
  readonly passBusinessSupplier: (businessId: string, pitchId: string) => void;
  readonly chooseBusinessAgents: (businessId: string, level: BusinessAgentLevel) => void;
  readonly tuneBusiness: (businessId: string, change: BusinessChange) => void;
  /** Ticket 0602. Open another location of a business, or close the newest. */
  readonly expandABusiness: (businessId: string, finance?: Financing) => void;
  readonly closeALocation: (businessId: string) => void;
  readonly sellABusiness: (businessId: string) => void;
  readonly closeABusiness: (businessId: string) => void;
  /** Ticket 0506. Buy a piece off a store's counter, or sell one from the collection. */
  readonly buyAValuable: (
    stockId: string,
    payment?: PurchasePayment,
    finish?: 'original' | 'iced',
  ) => void;
  readonly iceAValuable: (pieceId: string, payment?: PurchasePayment) => void;
  readonly sellAValuable: (pieceId: string) => void;
  /** Ticket 0507. Go to an auction's next sale, and bid on a lot at it. */
  readonly attendAnAuction: (venueId: string) => void;
  readonly bidAtAuction: (lotId: string, tier: BidTier) => void;
  readonly payLoanOff: (productId: string, amount: number, businessId?: string) => void;
  /** Ticket 0308. */
  readonly buyInvestment: (productId: string, amount: number) => void;
  readonly sellInvestment: (productId: string, amount: number) => void;
  /** Ticket 0309. */
  readonly hireAdvisorWith: (advisorId: string) => void;
  readonly dismissAdvisorNow: () => void;
  readonly actOnAdviceWith: (recommendationId: string) => void;
  readonly setPurchaseGoal: (amount: number) => void;
  /** Ticket 0310. */
  readonly setContributionTo: (rate: number) => void;
  readonly retireNowAction: () => void;
  readonly takeOutEarlyWith: (amount: number) => void;
  readonly stopTreatingFor: (conditionId: string) => void;
  /** Put the hours in at something. Three sessions an activity a year. */
  readonly practiseAt: (activityId: string) => void;
  /** Take or leave an odd job (Ticket 0206b). */
  readonly takeAGig: (gigId: string) => void;
  readonly quitAGig: (gigId: string) => void;
  readonly leaveActivity: (activityId: string) => void;
  /** Attempt a competitive place. Can fail. One attempt per school year. */
  readonly tryOutFor: (activityId: string) => void;
  /**
   * Do something with somebody (Ticket 0206). Once per person per school year,
   * and it can go badly — see @yearafter/social.
   */
  readonly interactWith: (personId: string, interactionId: string) => void;
  /** Ticket 0207. Flirt, ask them out, take them out, end it. */
  readonly romanceWith: (personId: string, moveId: string) => void;
  /** Ticket 0207b. A month on the apps, once a year, often for nothing. */
  readonly tryDatingApp: () => void;
  /** Ticket 0208. Try for a baby, once a year, and it can simply not happen. */
  readonly tryForABaby: () => void;
  readonly startAdoption: () => void;
  /** Spec 61: the one parenting decision — answer what a child asked for. */
  readonly answerChildAsk: (yes: boolean) => void;
  readonly kickChildOut: (childId: string) => void;
  /** Ticket 0708. Everything a creator does, one verb at a time. */
  readonly creating: (action: CreatorAction) => void;
  /** Ticket 0708. Say yes to something a name gets you offered. */
  readonly doFameWork: (workId: string) => void;
  /** Ticket 0708. Do something with somebody famous you know. */
  readonly connectWith: (tieId: string, actionId: string, targetId?: string) => void;
  /** Ticket 0708. What you do when you meet somebody famous. */
  readonly meetThem: (actionId: string) => void;
  readonly startNewLife: (seed?: string) => Promise<void>;
  /**
   * Ticket 0212. Carry on as one of your children.
   *
   * A NEW SAVE, not an edit of this one. The life that just ended is a life
   * somebody played and it stays on disk — overwriting it in place would make
   * continuing a dynasty the one action in this game that destroys history, and
   * the save list is where a player looks for the ancestor they remember.
   */
  readonly continueAs: (childId: string, keepBusinesses?: boolean) => Promise<void>;
  readonly updateSettings: (patch: Partial<SaveSettings>) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

/** Ticket 0601. The dials on a business, as one value so the store has one action for them. */
export type BusinessChange =
  | { readonly kind: 'price'; readonly price: number }
  | { readonly kind: 'payroll'; readonly payroll: Payroll }
  | { readonly kind: 'hire' }
  | { readonly kind: 'letGo' }
  | { readonly kind: 'auto'; readonly on: boolean };

export interface GameProviderProps {
  readonly repository: SaveRepository;
  readonly children: ReactNode;
}

export function GameProvider({ repository, children }: GameProviderProps) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [settings, setSettings] = useState<SaveSettings>(DEFAULT_SETTINGS);
  const [saveId, setSaveId] = useState<SaveId | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastEntries, setLastEntries] = useState<readonly TimelineEntry[]>([]);
  /**
   * Ticket 0210b. The answer to the last thing the player pressed.
   *
   * Review: "I want a pop up result for things like that... Please make this
   * common across important, entertaining, and interactive moments in the game."
   * Held here rather than in each screen because the player can navigate away
   * between pressing and reading, and an answer that only exists on the screen
   * they pressed it on is an answer that can be lost.
   */
  const [outcome, setOutcome] = useState<Outcome | undefined>(undefined);
  /**
   * Ticket 0210c. A breakdown the player opened. Beside `outcome` rather than
   * inside a screen for the same reason: the overlay lives in the Shell, and a
   * screen inside a ScrollView cannot render one that is not clipped by it.
   */
  const [detail, setDetail] = useState<Detail | undefined>(undefined);

  const createdAt = useRef<number>(Date.now());

  const persist = useCallback(
    (next: GameState, id: SaveId, nextSettings: SaveSettings) => {
      const save = toSave(next, { id, settings: nextSettings, createdAt: createdAt.current });
      void repository
        .update(save)
        .then((result) => {
          setSaveError(result.ok ? null : result.error);
        })
        .catch((cause: unknown) => setSaveError(String(cause)));
    },
    [repository],
  );

  const continueAs = useCallback(
    async (childId: string, keepBusinesses?: boolean) => {
      if (!state) return;
      const next = continueAsChild(
        state,
        childId,
        keepBusinesses === undefined ? {} : { keepBusinesses },
      );
      if (!next) return;

      const id = asSaveId(`save-${next.rng.getSeed()}-g${next.world.generation}`);
      createdAt.current = Date.now();
      const save = toSave(next, { id, settings, createdAt: createdAt.current });
      const created = await repository.create(save);
      if (!created.ok) await repository.update(save);

      setState(next);
      setSaveId(id);
      setLastEntries([]);
      setOutcome(undefined);
      setSaveError(null);
    },
    [repository, settings, state],
  );

  const startNewLife = useCallback(
    async (seed?: string) => {
      const resolvedSeed = seed ?? generateSeed();
      const id = asSaveId(`save-${resolvedSeed}`);
      const fresh = createNewGame({ seed: resolvedSeed });

      createdAt.current = Date.now();
      const save = toSave(fresh, { id, settings: DEFAULT_SETTINGS, createdAt: createdAt.current });

      // A save id collides only when replaying an explicit seed; overwrite it.
      const created = await repository.create(save);
      if (!created.ok) await repository.update(save);

      setState(fresh);
      setSettings(DEFAULT_SETTINGS);
      setSaveId(id);
      setLastEntries([]);
      setSaveError(null);
    },
    [repository],
  );

  // Resume the most recent save, or begin a life if there is none.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const saves = await repository.list();
        const mostRecent = saves[0];
        if (mostRecent) {
          const loaded = await repository.load(mostRecent.id);
          if (!cancelled && loaded.ok) {
            createdAt.current = loaded.value.createdAt;
            setState(fromSave(loaded.value));
            setSettings(loaded.value.settings);
            setSaveId(loaded.value.id);
            setReady(true);
            return;
          }
        }
        if (!cancelled) {
          await startNewLife();
          setReady(true);
        }
      } catch (cause: unknown) {
        if (!cancelled) {
          setSaveError(String(cause));
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repository, startNewLife]);

  const advance = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      // advanceYear is a no-op while a decision is pending; returning `current`
      // unchanged keeps React from re-rendering for nothing.
      if (current.pending.length > 0) return current;
      const { state: next, newEntries } = advanceYear(current);
      setLastEntries(newEntries);
      if (saveId) persist(next, saveId, settings);
      return next;
    });
  }, [persist, saveId, settings]);

  const answer = useCallback(
    (eventId: string, choiceId: string): string | undefined => {
      // The chosen option may ask to open a screen ("See what they offer" →
      // the activities list). The simulation reports it; navigating is the
      // app's job, so it is returned rather than acted on here.
      let opens: string | undefined;
      setState((current) => {
        if (!current) return current;
        const result = resolveDecision(current, eventId, choiceId);
        if (!result.ok) {
          // Expected, not exceptional: the same save answered on two devices.
          setSaveError(
            result.error === 'cannot-afford'
              ? "You don't have enough in your bank to keep this business going. You can close it instead."
              : eventId === 'business.rescue'
                ? 'This business decision has changed. Try the current choices.'
                : `That choice is no longer available (${result.error}).`,
          );
          return current;
        }
        opens = result.value.opens;
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
      return opens;
    },
    [persist, saveId, settings],
  );

  /**
   * Ticket 0204 school actions.
   *
   * These change state between years rather than during one: effort applies to
   * the next school year, and joining takes effect the same way. Nothing here
   * advances time — CORE_RULES 13.3, advancing is one control.
   */
  const mutateEducation = useCallback(
    (change: (state: GameState) => GameState) => {
      setState((current) => {
        if (!current) return current;
        const next = change(current);
        if (next === current) return current;
        if (saveId) persist(next, saveId, settings);
        return next;
      });
    },
    [persist, saveId, settings],
  );

  /**
   * Study Harder. Can fail to show up on the report card, which is the point,
   * so it writes a feed line either way and cannot be pressed twice in a year.
   */
  const studyHarder = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      const result = study(current);
      if (!result.ok) {
        setSaveError(`Cannot study right now (${result.error}).`);
        return current;
      }
      // Ticket 0210c. Pressing it again after the year's two terms is allowed
      // and does nothing, and the player is told that in the same place the two
      // that counted were answered — not by a greyed-out row with a counter on
      // it. Nothing is saved, because nothing changed.
      if (result.value.spent) {
        setOutcome({
          title: 'Nothing more to give',
          body: 'You are already putting in everything this year has room for. Next year is a fresh start.',
          tone: 'neutral',
          meter: { label: 'Grades', value: current.education.performance },
        });
        return current;
      }
      setOutcome({
        title: 'A term of work',
        body: result.value.entry?.text ?? '',
        tone: 'neutral',
        meter: { label: 'Grades', value: result.value.state.education.performance },
      });
      if (result.value.entry) {
        const written = result.value.entry;
        setLastEntries((entries) => [...entries, written]);
      }
      if (saveId) persist(result.value.state, saveId, settings);
      return result.value.state;
    });
  }, [persist, saveId, settings]);

  // Joining draws in two teammates as well as changing education state, which
  // is why it goes through the simulation rather than being done here. Ticket
  // 0209 added the other reason: anything that costs money needs a parent to
  // agree first, and they can say no.
  const joinActivity = useCallback(
    (activityId: string) => {
      setState((current) => {
        if (!current) return current;
        const outcome = askToJoin(current, activityId);
        if (outcome.state === current) return current;
        if (!outcome.joined)
          setLastEntries((entries) => [...entries, outcome.state.player.timeline.at(-1)!]);
        if (saveId) persist(outcome.state, saveId, settings);
        return outcome.state;
      });
    },
    [persist, saveId, settings],
  );

  /* ---- Ticket 0210: work ------------------------------------------------ */

  const dismissOutcome = useCallback(() => setOutcome(undefined), []);
  const showDetail = useCallback((next: Detail) => setDetail(next), []);
  const dismissDetail = useCallback(() => setDetail(undefined), []);

  const applyForJob = useCallback(
    (jobId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = applyFor(current, jobId);
        if (!result.ok) {
          setSaveError(`Cannot apply right now (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.hired ? 'You got it' : 'They went elsewhere',
          body: result.value.entry.text,
          tone: result.value.hired ? 'good' : 'bad',
        });
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const workHarderAt = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      const result = workHarder(current);
      if (!result.ok) {
        setSaveError(`Cannot put more in right now (${result.error}).`);
        return current;
      }
      const after = result.value.state.employment.job;
      // Ticket 0210c, and the exact case the review named: "if i hit the button
      // 10x, my work reputation only went up twice." Press eleven, twelve and
      // twenty all land here — an honest sentence, no change, nothing saved.
      if (result.value.spent) {
        setOutcome({
          title: 'Nothing more to give',
          body: 'You have already put your back into this year. More hours now would just be hours.',
          tone: 'neutral',
          ...(after ? { meter: { label: 'At work', value: after.performance } } : {}),
        });
        return current;
      }
      setOutcome({
        title: 'A real shift',
        body: result.value.entry?.text ?? '',
        tone: 'neutral',
        ...(after ? { meter: { label: 'At work', value: after.performance } } : {}),
      });
      if (result.value.entry) {
        const written = result.value.entry;
        setLastEntries((entries) => [...entries, written]);
      }
      if (saveId) persist(result.value.state, saveId, settings);
      return result.value.state;
    });
  }, [persist, saveId, settings]);

  const quitJob = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      const result = resign(current);
      if (!result.ok) {
        setSaveError(`Cannot resign right now (${result.error}).`);
        return current;
      }
      setLastEntries((entries) => [...entries, result.value.entry]);
      if (saveId) persist(result.value.state, saveId, settings);
      return result.value.state;
    });
  }, [persist, saveId, settings]);

  /* ---- Ticket 0211: the Doctor -------------------------------------------- */

  const visitDoctor = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      const result = seeDoctor(current);
      if (!result.ok) {
        setSaveError(`Cannot see a doctor right now (${result.error}).`);
        return current;
      }
      setOutcome({
        title: result.value.title,
        body: result.value.body,
        tone: result.value.good ? 'good' : 'bad',
        meter: { label: 'Health', value: current.player.stats.health },
      });
      if (saveId) persist(result.value.state, saveId, settings);
      return result.value.state;
    });
  }, [persist, saveId, settings]);

  const treatFor = useCallback(
    (conditionId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = treatCondition(current, conditionId);
        if (!result.ok) {
          setSaveError(`Cannot start treatment (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'neutral',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  /*
    Ticket 0306. All three card verbs land here in the same shape as every other
    action since 0210b: the player pressed something and gets an answer where
    they pressed (CORE_RULES 13.27). A refusal is an OUTCOME with a reason, not
    a `saveError` — "Declined, your credit is not there yet" is the game
    answering, and a red toast about an error code is the game failing.
  */
  const applyForCardWith = useCallback(
    (productId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = applyForNewCard(current, productId);
        if (!result.ok) {
          setSaveError(`Cannot apply for that card (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'bad',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const payCardWith = useCallback(
    (productId: string, amount: number) => {
      setState((current) => {
        if (!current) return current;
        const result = payCard(current, productId, amount);
        if (!result.ok) {
          setSaveError(`Cannot pay that card (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'neutral',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const closeCardWith = useCallback(
    (productId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = closeCard(current, productId);
        if (!result.ok) {
          setSaveError(`Cannot close that card (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'neutral',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const borrowWith = useCallback(
    (productId: string, amount: number) => {
      setState((current) => {
        if (!current) return current;
        const result = takeLoan(current, productId, amount);
        if (!result.ok) {
          setSaveError(`Cannot borrow that (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'bad',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  /* ---- Ticket 0501: homes ---------------------------------------------- */

  const buyAHome = useCallback(
    (listingId: string, how: 'cash' | 'mortgage') => {
      setState((current) => {
        if (!current) return current;
        const result = buyHome(current, listingId, how);
        if (!result.ok) {
          // A refusal is an outcome, not an error: the bank saying no is a
          // thing that happened, and the player is told so in a sentence.
          setOutcome({
            title: how === 'mortgage' ? 'The bank said no' : 'Not enough',
            body: BUY_HOME_ERROR_LABELS[result.error],
            tone: 'bad',
          });
          return current;
        }
        setOutcome({ title: 'It is yours', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const sellAHome = useCallback(
    (homeId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = sellHome(current, homeId);
        if (!result.ok) return current;
        setOutcome({ title: 'Sold', body: result.value.entry.text, tone: 'neutral' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  /* ---- Ticket 0504: vehicles ------------------------------------------- */

  const buyACar = useCallback(
    (listingId: string, how: 'cash' | 'loan') => {
      setState((current) => {
        if (!current) return current;
        const result = buyVehicle(current, listingId, how);
        if (!result.ok) {
          setOutcome({
            title: how === 'loan' ? 'The lender said no' : 'Not enough',
            body: BUY_VEHICLE_ERROR_LABELS[result.error],
            tone: 'bad',
          });
          return current;
        }
        setOutcome({ title: 'The keys are yours', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const sellACar = useCallback(
    (vehicleId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = sellVehicle(current, vehicleId);
        if (!result.ok) {
          setOutcome({
            title: 'Not now',
            body: SELL_VEHICLE_ERROR_LABELS[result.error],
            tone: 'bad',
          });
          return current;
        }
        setOutcome({ title: 'Sold', body: result.value.entry.text, tone: 'neutral' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const inspectACar = useCallback(
    (listingId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = inspectVehicle(current, listingId);
        if (!result.ok) {
          setOutcome({ title: 'Not now', body: INSPECT_ERROR_LABELS[result.error], tone: 'bad' });
          return current;
        }
        const view = result.value.view;
        setOutcome(
          view.defect
            ? {
                title: 'The mechanic found something',
                body: `The ${view.defect.part} is on its way out — about $${view.defect.cost.toLocaleString('en-US')} to fix. The seller knocked that off the price.`,
                tone: 'bad',
              }
            : {
                title: 'Clean bill of health',
                body: 'Nothing wrong that the mechanic could find.',
                tone: 'good',
              },
        );
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const fitACarMod = useCallback(
    (vehicleId: string, modId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = fitVehicleMod(current, vehicleId, modId);
        if (!result.ok) {
          setOutcome({ title: 'Not now', body: FIT_MOD_ERROR_LABELS[result.error], tone: 'bad' });
          return current;
        }
        setOutcome({ title: 'Done', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  /* ---- Ticket 0506: renovations and shopping ---------------------------- */

  const renovateHome = useCallback(
    (homeId: string, renovationId: string, payment?: PurchasePayment) => {
      setState((current) => {
        if (!current) return current;
        const result = renovate(current, homeId, renovationId, payment);
        if (!result.ok) {
          setOutcome({ title: 'Not now', body: RENOVATE_ERROR_LABELS[result.error], tone: 'bad' });
          return current;
        }
        setOutcome({ title: 'Done', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  /* ---- Ticket 0601: businesses ------------------------------------------ */

  const openABusiness = useCallback(
    (typeId: string, finance?: Financing) => {
      setState((current) => {
        if (!current) return current;
        const result = openBusiness(current, typeId, finance);
        if (!result.ok) {
          setOutcome({
            title: 'Not now',
            body:
              result.error in OPEN_REFUSAL_LABELS
                ? OPEN_REFUSAL_LABELS[result.error as keyof typeof OPEN_REFUSAL_LABELS]
                : FINANCE_ERROR_LABELS[result.error as keyof typeof FINANCE_ERROR_LABELS],
            tone: 'bad',
          });
          return current;
        }
        setOutcome({ title: 'Open for business', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const supplierAction = useCallback(
    (businessId: string, action: 'search' | 'accept' | 'pass', pitchId = '') => {
      setState((current) => {
        if (!current) return current;
        const result =
          action === 'search'
            ? searchSupplier(current, businessId)
            : action === 'accept'
              ? acceptSupplier(current, businessId, pitchId)
              : passSupplier(current, businessId, pitchId);
        if (!result.ok) {
          setOutcome({ title: 'Not now', body: SUPPLIER_ERROR_LABELS[result.error], tone: 'bad' });
          return current;
        }
        if (saveId) persist(result.value, saveId, settings);
        return result.value;
      });
    },
    [persist, saveId, settings],
  );
  const searchBusinessSupplier = useCallback(
    (id: string) => supplierAction(id, 'search'),
    [supplierAction],
  );
  const acceptBusinessSupplier = useCallback(
    (id: string, pitch: string) => supplierAction(id, 'accept', pitch),
    [supplierAction],
  );
  const passBusinessSupplier = useCallback(
    (id: string, pitch: string) => supplierAction(id, 'pass', pitch),
    [supplierAction],
  );

  const chooseBusinessAgents = useCallback(
    (businessId: string, level: BusinessAgentLevel) => {
      setState((current) => {
        if (!current) return current;
        const result = setBusinessAgentLevel(current, businessId, level);
        if (!result.ok) {
          setOutcome({
            title: 'Not now',
            body: BUSINESS_AGENT_ERROR_LABELS[result.error],
            tone: 'bad',
          });
          return current;
        }
        if (saveId) persist(result.value, saveId, settings);
        return result.value;
      });
    },
    [persist, saveId, settings],
  );

  const tuneBusiness = useCallback(
    (businessId: string, change: BusinessChange) => {
      setState((current) => {
        if (!current) return current;
        const result =
          change.kind === 'price'
            ? setBusinessPrice(current, businessId, change.price)
            : change.kind === 'payroll'
              ? setBusinessPayroll(current, businessId, change.payroll)
              : change.kind === 'hire'
                ? hireBusinessStaff(current, businessId)
                : change.kind === 'letGo'
                  ? letBusinessStaffGo(current, businessId)
                  : setBusinessAutoStaff(current, businessId, change.on);
        // A dial turned is not news: the screen shows it. Only a refusal speaks.
        if (!result.ok) {
          setOutcome({
            title: 'Not now',
            body:
              result.error === 'market-priced'
                ? 'This brokerage works at market rates. Choose its agent team instead.'
                : result.error === 'at-limit'
                  ? "You can't change staffing any further."
                  : "That business choice isn't available any more.",
            tone: 'bad',
          });
          return current;
        }
        if (saveId) persist(result.value, saveId, settings);
        return result.value;
      });
    },
    [persist, saveId, settings],
  );

  const buyABusiness = useCallback(
    (listingId: string, finance?: Financing) => {
      setState((current) => {
        if (!current) return current;
        const result = buyBusiness(current, listingId, finance);
        if (!result.ok) {
          setOutcome({ title: 'Not now', body: BUY_REFUSAL_LABELS[result.error], tone: 'bad' });
          return current;
        }
        setOutcome({ title: 'Yours now', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const expandABusiness = useCallback(
    (businessId: string, finance?: Financing) => {
      setState((current) => {
        if (!current) return current;
        const result = expandBusiness(current, businessId, finance);
        if (!result.ok) {
          setOutcome({
            title: 'Not now',
            body:
              result.error === 'no-such-business'
                ? "You don't run that any more."
                : result.error in EXPAND_REFUSAL_LABELS
                  ? EXPAND_REFUSAL_LABELS[result.error as keyof typeof EXPAND_REFUSAL_LABELS]
                  : FINANCE_ERROR_LABELS[result.error as keyof typeof FINANCE_ERROR_LABELS],
            tone: 'bad',
          });
          return current;
        }
        setOutcome({ title: 'Another door', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const closeALocation = useCallback(
    (businessId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = closeLocation(current, businessId);
        if (!result.ok) return current;
        setOutcome({ title: 'Closed', body: result.value.entry.text, tone: 'neutral' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const sellABusiness = useCallback(
    (businessId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = sellBusiness(current, businessId);
        if (!result.ok) return current;
        setOutcome({ title: 'Sold', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const closeABusiness = useCallback(
    (businessId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = closeBusiness(current, businessId);
        if (!result.ok) return current;
        setOutcome({ title: 'Closed', body: result.value.entry.text, tone: 'neutral' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const buyAValuable = useCallback(
    (stockId: string, payment?: PurchasePayment, finish?: 'original' | 'iced') => {
      setState((current) => {
        if (!current) return current;
        const result = buyValuable(current, stockId, payment, finish);
        if (!result.ok) {
          setOutcome({
            title: 'Not now',
            body: BUY_VALUABLE_ERROR_LABELS[result.error],
            tone: 'bad',
          });
          return current;
        }
        setOutcome({ title: "It's yours", body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const serviceACar = useCallback(
    (vehicleId: string, payment?: PurchasePayment) => {
      setState((current) => {
        if (!current) return current;
        const result = serviceVehicle(current, vehicleId, payment);
        if (!result.ok) {
          setOutcome({
            title: 'Not now',
            body: SERVICE_VEHICLE_ERROR_LABELS[result.error],
            tone: 'bad',
          });
          return current;
        }
        setOutcome({ title: 'Serviced', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const iceAValuable = useCallback(
    (pieceId: string, payment?: PurchasePayment) => {
      setState((current) => {
        if (!current) return current;
        const result = iceValuable(current, pieceId, payment);
        if (!result.ok) {
          setOutcome({
            title: 'Not now',
            body: BUY_VALUABLE_ERROR_LABELS[result.error],
            tone: 'bad',
          });
          return current;
        }
        setOutcome({ title: 'Iced out', body: result.value.entry.text, tone: 'good' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const sellAValuable = useCallback(
    (pieceId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = sellValuable(current, pieceId);
        if (!result.ok) return current;
        setOutcome({ title: 'Sold', body: result.value.entry.text, tone: 'neutral' });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  /* ---- Ticket 0507: auctions -------------------------------------------- */

  const attendAnAuction = useCallback(
    (venueId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = attendAuction(current, venueId);
        if (!result.ok) {
          setOutcome({ title: 'Not now', body: ATTEND_ERROR_LABELS[result.error], tone: 'bad' });
          return current;
        }
        if (saveId) persist(result.value, saveId, settings);
        return result.value;
      });
    },
    [persist, saveId, settings],
  );

  const bidAtAuction = useCallback(
    (lotId: string, tier: BidTier) => {
      setState((current) => {
        if (!current) return current;
        const result = bidOn(current, lotId, tier);
        if (!result.ok) {
          setOutcome({ title: 'Not now', body: BID_ERROR_LABELS[result.error], tone: 'bad' });
          return current;
        }
        setOutcome({
          title: result.value.won ? 'Sold — to you' : 'Outbid',
          body: result.value.text,
          tone: result.value.won ? 'good' : 'neutral',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const letting = useCallback(
    (action: LettingAction) => {
      setState((current) => {
        if (!current) return current;
        const result: Result<RentalChange, RentalError> =
          action.type === 'rentOut'
            ? rentOut(current, action.homeId)
            : action.type === 'moveBackIn'
              ? moveBackIn(current, action.homeId)
              : action.type === 'rent'
                ? changeRent(current, action.homeId, action.direction)
                : action.type === 'agent'
                  ? setAgent(current, action.homeId, action.managed)
                  : action.type === 'sign'
                    ? signTenant(current, action.homeId, action.unit, action.applicantId)
                    : fillEmptyUnits(current, action.homeId);
        if (!result.ok) {
          setOutcome({ title: 'Not now', body: RENTAL_ERROR_LABELS[result.error], tone: 'bad' });
          return current;
        }
        // Moving out, signing a lease and filling a building are things that
        // happened, and get a card; moving the rent or hiring an agent is a
        // setting, and the screen shows it.
        if (result.value.entry) {
          setOutcome({ title: 'Done', body: result.value.entry.text, tone: 'good' });
        }
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const buyInvestmentWith = useCallback(
    (productId: string, amount: number) => {
      setState((current) => {
        if (!current) return current;
        const result = invest(current, productId, amount);
        if (!result.ok) {
          setSaveError(`Cannot buy that (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'bad',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const sellInvestmentWith = useCallback(
    (productId: string, amount: number) => {
      setState((current) => {
        if (!current) return current;
        const result = divest(current, productId, amount);
        if (!result.ok) {
          setSaveError(`Cannot sell that (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'bad',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const hireAdvisorWith = useCallback(
    (advisorId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = hireAdvisor(current, advisorId);
        if (!result.ok) {
          setSaveError(`They won't take you on (${result.error}).`);
          return current;
        }
        if (saveId) persist(result.value, saveId, settings);
        return result.value;
      });
    },
    [persist, saveId, settings],
  );

  const dismissAdvisorNow = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      const next = dismissAdvisor(current);
      if (saveId) persist(next, saveId, settings);
      return next;
    });
  }, [persist, saveId, settings]);

  const setPurchaseGoal = useCallback(
    (amount: number) => {
      setState((current) => {
        if (!current) return current;
        const result = setCashGoal(current, amount);
        if (!result.ok) {
          setSaveError(CASH_GOAL_ERROR_LABELS[result.error]);
          return current;
        }
        setSaveError(null);
        if (saveId) persist(result.value, saveId, settings);
        return result.value;
      });
    },
    [persist, saveId, settings],
  );

  const actOnAdviceWith = useCallback(
    (recommendationId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = actOnAdvice(current, recommendationId);
        if (!result.ok) {
          setSaveError(
            'That recommendation is no longer available. Check your cash and what you hold, then try again.',
          );
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'bad',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const chooseLifestyle = useCallback(
    (tier: LifestyleTier) => {
      setState((current) => {
        if (!current) return current;
        const result = setLifestyle(current, tier);
        if (!result.ok) {
          setOutcome({
            title: 'Lifestyle unchanged',
            body: LIFESTYLE_ERROR_LABELS[result.error],
            tone: 'neutral',
          });
          return current;
        }
        if (saveId) persist(result.value, saveId, settings);
        return result.value;
      });
    },
    [persist, saveId, settings],
  );

  const setContributionTo = useCallback(
    (rate: number) => {
      setState((current) => {
        if (!current) return current;
        const next = setContribution(current, rate);
        if (saveId) persist(next, saveId, settings);
        return next;
      });
    },
    [persist, saveId, settings],
  );

  const retireNowAction = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      const result = retireNow(current);
      if (!result.ok) {
        setSaveError(`Cannot retire yet (${result.error}).`);
        return current;
      }
      setOutcome({
        title: result.value.title,
        body: result.value.body,
        tone: result.value.good ? 'good' : 'neutral',
      });
      if (saveId) persist(result.value.state, saveId, settings);
      return result.value.state;
    });
  }, [persist, saveId, settings]);

  const takeOutEarlyWith = useCallback(
    (amount: number) => {
      setState((current) => {
        if (!current) return current;
        const result = takeOutEarly(current, amount);
        if (!result.ok) {
          setSaveError(`Cannot take that out (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'bad',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const payLoanWith = useCallback(
    (productId: string, amount: number, businessId?: string) => {
      setState((current) => {
        if (!current) return current;
        const result = payLoan(current, productId, amount, businessId);
        if (!result.ok) {
          setSaveError(`Cannot pay that loan (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.title,
          body: result.value.body,
          tone: result.value.good ? 'good' : 'neutral',
        });
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const stopTreatingFor = useCallback(
    (conditionId: string) => {
      setState((current) => {
        if (!current) return current;
        const next = stopTreatment(current, conditionId);
        if (saveId) persist(next, saveId, settings);
        return next;
      });
    },
    [persist, saveId, settings],
  );

  const applyToStudy = useCallback(
    (majorId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = applyToCollege(current, majorId);
        if (!result.ok) {
          setSaveError(`Cannot apply right now (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.accepted ? 'You are going' : 'Turned down',
          body: result.value.entry.text,
          tone: result.value.accepted ? 'good' : 'bad',
        });
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const leaveStudies = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      const result = leaveCollege(current);
      if (!result.ok) {
        setSaveError(`Cannot leave right now (${result.error}).`);
        return current;
      }
      setLastEntries((entries) => [...entries, result.value.entry]);
      if (saveId) persist(result.value.state, saveId, settings);
      return result.value.state;
    });
  }, [persist, saveId, settings]);

  const askAParent = useCallback(
    (parentId: string, requestId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = askParent(current, parentId, requestId);
        if (!result.ok) {
          setSaveError(`Cannot ask right now (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.saidYes ? 'They said yes' : 'They said no',
          body: result.value.entry.text,
          tone: result.value.saidYes ? 'good' : 'bad',
          ...(result.value.saidYes && result.value.given > 0
            ? { value: `$${result.value.given.toLocaleString('en-US')}` }
            : {}),
        });
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const leaveActivity = useCallback(
    (activityId: string) => {
      mutateEducation((current) => leaveTheActivity(current, activityId));
    },
    [mutateEducation],
  );

  /**
   * Practise something. Three sessions an activity a year, and unlike Study
   * Harder it cannot fail — the variable is how much it is worth.
   */
  const practiseAt = useCallback(
    (activityId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = practise(current, activityId);
        if (!result.ok) {
          setSaveError(`Cannot practice right now (${result.error}).`);
          return current;
        }
        // Ticket 0210c. Same shape as Work Harder, and the popup 0210b never
        // gave this button in the first place: a press that moved a number and
        // said nothing about it is a press the player has to go and look up.
        if (result.value.spent) {
          setOutcome({
            title: 'Nothing more to give',
            body: 'You have put in the afternoons this year had in it. Any more and it is just being there.',
            tone: 'neutral',
          });
          return current;
        }
        if (result.value.entry) {
          const written = result.value.entry;
          setOutcome({ title: 'Time well spent', body: written.text, tone: 'good' });
          setLastEntries((entries) => [...entries, written]);
        }
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  /**
   * Try out for something.
   *
   * Unlike joining, this consumes randomness and can fail, so it writes a
   * timeline entry either way — being cut is a thing that happened, and a button
   * that silently does nothing on failure reads as broken.
   */
  const tryOutFor = useCallback(
    (activityId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = attemptTryout(current, activityId);
        if (!result.ok) {
          setSaveError(`Cannot try out right now (${result.error}).`);
          return current;
        }
        // The one review named by name: "When I tried out for the basketball
        // team, the result landed on the homepage as it should, but I want a
        // pop up result for things like that."
        setOutcome({
          title: result.value.made ? 'You made it' : 'Not this time',
          body: result.value.entry.text,
          tone: result.value.made ? 'good' : 'bad',
        });
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  /* ---- Ticket 0708: creators and fame ------------------------------------ */

  /**
   * One path for every fame and creator verb. A refusal is shown as a card, not hidden in
   * `saveError`, because "you don't have the money for the gear" is something the player has to
   * read at the moment they pressed the button.
   */
  const commit = useCallback(
    (make: (current: GameState) => Attempt) => {
      setState((current) => {
        if (!current) return current;
        const attempt = make(current);
        if (!attempt.ok) {
          setOutcome(attempt.outcome);
          return current;
        }
        if (attempt.outcome) setOutcome(attempt.outcome);
        if (attempt.entries.length > 0) {
          const written = attempt.entries;
          setLastEntries((entries) => [...entries, ...written]);
        }
        if (saveId) persist(attempt.state, saveId, settings);
        return attempt.state;
      });
    },
    [persist, saveId, settings],
  );

  const creating = useCallback(
    (action: CreatorAction) => commit((current) => applyCreatorAction(current, action)),
    [commit],
  );
  const doFameWork = useCallback(
    (workId: string) => commit((current) => applyFameWork(current, workId)),
    [commit],
  );
  const connectWith = useCallback(
    (tieId: string, actionId: string, targetId?: string) =>
      commit((current) => applyConnection(current, tieId, actionId, targetId)),
    [commit],
  );
  const meetThem = useCallback(
    (actionId: string) => commit((current) => applyMeeting(current, actionId)),
    [commit],
  );

  const interactWith = useCallback(
    (personId: string, interactionId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = interact(current, personId, interactionId);
        if (!result.ok) {
          setSaveError(`Cannot do that right now (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.worked ? 'That went well' : 'That went badly',
          body: result.value.entry.text,
          tone: result.value.worked ? 'good' : 'bad',
        });
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const romanceWith = useCallback(
    (personId: string, moveId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = romanticMove(current, personId, moveId);
        if (!result.ok) {
          setSaveError(`Cannot do that right now (${result.error}).`);
          return current;
        }
        setOutcome({
          title: result.value.worked ? 'It went well' : 'It did not land',
          body: result.value.entry.text,
          tone: result.value.worked ? 'good' : 'bad',
        });
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const tryDatingApp = useCallback(() => {
    setState((current) => {
      if (!current) return current;
      const result = useDatingApp(current);
      if (!result.ok) {
        setSaveError(`Cannot do that right now (${result.error}).`);
        return current;
      }
      setLastEntries((entries) => [...entries, result.value.entry]);
      if (saveId) persist(result.value.state, saveId, settings);
      return result.value.state;
    });
  }, [persist, saveId, settings]);

  const runParenting = useCallback(
    (act: (current: GameState) => ReturnType<typeof tryForBaby>) => {
      setState((current) => {
        if (!current) return current;
        const result = act(current);
        if (!result.ok) {
          setSaveError(`Cannot do that right now (${result.error}).`);
          return current;
        }
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const tryForABaby = useCallback(() => runParenting(tryForBaby), [runParenting]);
  const startAdoption = useCallback(() => runParenting(applyToAdopt), [runParenting]);
  const answerChildAsk = useCallback(
    (yes: boolean) => runParenting((current) => answerChild(current, yes)),
    [runParenting],
  );
  const kickChildOut = useCallback(
    (childId: string) => runParenting((current) => kickOut(current, childId)),
    [runParenting],
  );

  const takeAGig = useCallback(
    (gigId: string) => {
      mutateEducation((current) => {
        const result = takeGig(current, gigId);
        if (!result.ok) {
          setSaveError(
            result.error === 'no-such-gig'
              ? "That work isn't available."
              : GIG_UNAVAILABLE_LABELS[result.error],
          );
          return current;
        }
        return result.value;
      });
    },
    [mutateEducation],
  );

  const quitAGig = useCallback(
    (gigId: string) => {
      mutateEducation((current) => quitGig(current, gigId));
    },
    [mutateEducation],
  );

  const updateSettings = useCallback(
    (patch: Partial<SaveSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (state && saveId) persist(state, saveId, next);
        return next;
      });
    },
    [persist, saveId, state],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      ready,
      state,
      settings,
      saveId,
      saveError,
      lastEntries,
      outcome,
      dismissOutcome,
      detail,
      showDetail,
      dismissDetail,
      decision: state?.pending[0] ?? null,
      advance,
      answer,
      studyHarder,
      joinActivity,
      askAParent,
      applyForJob,
      workHarderAt,
      quitJob,
      applyToStudy,
      leaveStudies,
      visitDoctor,
      treatFor,
      applyForCard: applyForCardWith,
      payCardOff: payCardWith,
      closeCardOff: closeCardWith,
      borrow: borrowWith,
      buyAHome,
      sellAHome,
      letting,
      buyACar,
      sellACar,
      inspectACar,
      fitACarMod,
      serviceACar,
      renovateHome,
      openABusiness,
      buyABusiness,
      searchBusinessSupplier,
      acceptBusinessSupplier,
      passBusinessSupplier,
      chooseBusinessAgents,
      tuneBusiness,
      expandABusiness,
      closeALocation,
      sellABusiness,
      closeABusiness,
      buyAValuable,
      iceAValuable,
      sellAValuable,
      attendAnAuction,
      bidAtAuction,
      payLoanOff: payLoanWith,
      buyInvestment: buyInvestmentWith,
      sellInvestment: sellInvestmentWith,
      hireAdvisorWith,
      dismissAdvisorNow,
      actOnAdviceWith,
      setPurchaseGoal,
      setContributionTo,
      chooseLifestyle,
      retireNowAction,
      takeOutEarlyWith,
      stopTreatingFor,
      practiseAt,
      takeAGig,
      quitAGig,
      leaveActivity,
      tryOutFor,
      interactWith,
      romanceWith,
      tryDatingApp,
      tryForABaby,
      startAdoption,
      answerChildAsk,
      kickChildOut,
      creating,
      doFameWork,
      connectWith,
      meetThem,
      startNewLife,
      continueAs,
      updateSettings,
    }),
    [
      ready,
      state,
      settings,
      saveId,
      saveError,
      lastEntries,
      outcome,
      dismissOutcome,
      detail,
      showDetail,
      dismissDetail,
      advance,
      answer,
      studyHarder,
      joinActivity,
      askAParent,
      applyForJob,
      workHarderAt,
      quitJob,
      applyToStudy,
      leaveStudies,
      visitDoctor,
      treatFor,
      applyForCardWith,
      payCardWith,
      closeCardWith,
      borrowWith,
      buyAHome,
      sellAHome,
      letting,
      buyACar,
      sellACar,
      inspectACar,
      fitACarMod,
      serviceACar,
      renovateHome,
      openABusiness,
      buyABusiness,
      searchBusinessSupplier,
      acceptBusinessSupplier,
      passBusinessSupplier,
      chooseBusinessAgents,
      tuneBusiness,
      expandABusiness,
      closeALocation,
      sellABusiness,
      closeABusiness,
      buyAValuable,
      iceAValuable,
      sellAValuable,
      attendAnAuction,
      bidAtAuction,
      buyInvestmentWith,
      sellInvestmentWith,
      hireAdvisorWith,
      dismissAdvisorNow,
      actOnAdviceWith,
      setPurchaseGoal,
      setContributionTo,
      chooseLifestyle,
      retireNowAction,
      takeOutEarlyWith,
      payLoanWith,
      stopTreatingFor,
      practiseAt,
      takeAGig,
      quitAGig,
      leaveActivity,
      tryOutFor,
      interactWith,
      romanceWith,
      tryDatingApp,
      tryForABaby,
      startAdoption,
      answerChildAsk,
      kickChildOut,
      creating,
      doFameWork,
      connectWith,
      meetThem,
      startNewLife,
      continueAs,
      updateSettings,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used inside a GameProvider');
  }
  return context;
}

/** Convenience for screens that only render once a character exists. */
export function usePlayer() {
  const { state } = useGame();
  if (!state) {
    throw new Error('usePlayer used before the game finished loading');
  }
  return state.player;
}
