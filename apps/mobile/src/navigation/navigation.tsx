/**
 * Ticket 0103 — Five-world navigation.
 *
 * Spec 828–838: Career, Assets, Advance/Life (centre), Relationships, Activities.
 *
 * This is a small hand-written navigator rather than a navigation library. The
 * app's model is genuinely simple — five roots, each with a push stack of leaf
 * screens — and the central Advance control needs a tab bar that no library's
 * default renders. A custom navigator is less code here than configuring one,
 * and it keeps the shell dependency-free while the visual identity is still
 * being decided.
 *
 * Each world keeps its own stack, so switching worlds and coming back returns
 * you where you were.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export const WORLDS = ['career', 'assets', 'life', 'relationships', 'activities'] as const;
export type World = (typeof WORLDS)[number];

/** Leaf screens pushed on top of a world root. */
export type ScreenKey =
  | 'mindBody'
  | 'doctor'
  | 'relocate'
  | 'finances'
  | 'investments'
  | 'homes'
  | 'vehicles'
  | 'businesses'
  | 'collections'
  | 'shopping'
  | 'family'
  | 'friends'
  | 'debug';

export interface Route {
  readonly screen: ScreenKey;
  readonly title: string;
}

type Stacks = Record<World, Route[]>;

const EMPTY_STACKS: Stacks = {
  career: [],
  assets: [],
  life: [],
  relationships: [],
  activities: [],
};

interface NavigationContextValue {
  readonly world: World;
  readonly stack: readonly Route[];
  readonly current: Route | null;
  readonly selectWorld: (world: World) => void;
  readonly push: (route: Route) => void;
  readonly pop: () => void;
  readonly popToRoot: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<World>('life');
  const [stacks, setStacks] = useState<Stacks>(EMPTY_STACKS);

  const selectWorld = useCallback((next: World) => {
    // Tapping the world you are already in returns to its root — the standard
    // mobile convention, and the cheapest way out of a deep stack.
    setStacks((current) => {
      setWorld((activeWorld) => {
        if (activeWorld === next) {
          setStacks((inner) => ({ ...inner, [next]: [] }));
        }
        return next;
      });
      return current;
    });
  }, []);

  const push = useCallback((route: Route) => {
    setWorld((activeWorld) => {
      setStacks((current) => ({
        ...current,
        [activeWorld]: [...current[activeWorld], route],
      }));
      return activeWorld;
    });
  }, []);

  const pop = useCallback(() => {
    setWorld((activeWorld) => {
      setStacks((current) => ({
        ...current,
        [activeWorld]: current[activeWorld].slice(0, -1),
      }));
      return activeWorld;
    });
  }, []);

  const popToRoot = useCallback(() => {
    setWorld((activeWorld) => {
      setStacks((current) => ({ ...current, [activeWorld]: [] }));
      return activeWorld;
    });
  }, []);

  const stack = stacks[world];

  const value = useMemo<NavigationContextValue>(
    () => ({
      world,
      stack,
      current: stack.length > 0 ? (stack[stack.length - 1] as Route) : null,
      selectWorld,
      push,
      pop,
      popToRoot,
    }),
    [world, stack, selectWorld, push, pop, popToRoot],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used inside a NavigationProvider');
  }
  return context;
}

/**
 * Tab labels.
 *
 * These name the five worlds of spec 828–838 in the player's language rather
 * than the spec's. "Activities" is the spec's own word for that world and is
 * what the screen is called everywhere else, so the tab says the same thing.
 * "People" stands in for Relationships only because "Relationships" does not
 * fit a fifth of a phone's width without truncating.
 */
export const WORLD_LABELS: Record<World, string> = {
  career: 'Career',
  assets: 'Assets',
  life: 'Life',
  relationships: 'People',
  activities: 'Activities',
};
