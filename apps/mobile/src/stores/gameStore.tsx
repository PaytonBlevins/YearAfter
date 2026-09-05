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
import {
  advanceYear,
  createNewGame,
  decide as resolveDecision,
  generateSeed,
  interact,
  joinActivity as joinTheActivity,
  leaveActivity as leaveTheActivity,
  practise,
  romanticMove,
  quitGig,
  takeGig,
  study,
  tryOut as attemptTryout,
  type GameState,
} from '@yearafter/simulation';
import type { PendingDecision } from '@yearafter/events';

import type { TimelineEntry } from '@yearafter/character';
import {
  DEFAULT_SETTINGS,
  fromSave,
  toSave,
  type SaveRepository,
  type SaveSettings,
} from '@yearafter/persistence';

interface GameContextValue {
  readonly ready: boolean;
  readonly state: GameState | null;
  readonly settings: SaveSettings;
  readonly saveId: SaveId | null;
  readonly saveError: string | null;
  /** Entries produced by the most recent Advance, for feed emphasis. */
  readonly lastEntries: readonly TimelineEntry[];
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
  readonly startNewLife: (seed?: string) => Promise<void>;
  readonly updateSettings: (patch: Partial<SaveSettings>) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

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
          setSaveError(`That choice is no longer available (${result.error}).`);
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
      setLastEntries((entries) => [...entries, result.value.entry]);
      if (saveId) persist(result.value.state, saveId, settings);
      return result.value.state;
    });
  }, [persist, saveId, settings]);

  // Joining draws in two teammates as well as changing education state, which
  // is why it goes through the simulation rather than being done here.
  const joinActivity = useCallback(
    (activityId: string) => {
      mutateEducation((current) => joinTheActivity(current, activityId));
    },
    [mutateEducation],
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
          setSaveError(`Cannot practise right now (${result.error}).`);
          return current;
        }
        setLastEntries((entries) => [...entries, result.value.entry]);
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
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
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
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
  );

  const takeAGig = useCallback(
    (gigId: string) => {
      mutateEducation((current) => {
        const result = takeGig(current, gigId);
        if (!result.ok) {
          setSaveError(`Cannot take that on (${result.error}).`);
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
      decision: state?.pending[0] ?? null,
      advance,
      answer,
      studyHarder,
      joinActivity,
      practiseAt,
      takeAGig,
      quitAGig,
      leaveActivity,
      tryOutFor,
      interactWith,
      romanceWith,
      startNewLife,
      updateSettings,
    }),
    [
      ready,
      state,
      settings,
      saveId,
      saveError,
      lastEntries,
      advance,
      answer,
      studyHarder,
      joinActivity,
      practiseAt,
      takeAGig,
      quitAGig,
      leaveActivity,
      tryOutFor,
      interactWith,
      romanceWith,
      startNewLife,
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
