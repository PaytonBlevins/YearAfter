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
  readonly answer: (eventId: string, choiceId: string) => void;
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
    (eventId: string, choiceId: string) => {
      setState((current) => {
        if (!current) return current;
        const result = resolveDecision(current, eventId, choiceId);
        if (!result.ok) {
          // Expected, not exceptional: the same save answered on two devices.
          setSaveError(`That choice is no longer available (${result.error}).`);
          return current;
        }
        setLastEntries((entries) => [...entries, result.value.entry]);
        if (saveId) persist(result.value.state, saveId, settings);
        return result.value.state;
      });
    },
    [persist, saveId, settings],
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
