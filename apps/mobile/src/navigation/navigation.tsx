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
  /**
   * Leave the current world and return to Life without advancing a year.
   * The world's stack is reset, because closing means "done here".
   */
  readonly closeToLife: () => void;
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

  const closeToLife = useCallback(() => {
    setWorld((activeWorld) => {
      if (activeWorld !== 'life') {
        setStacks((current) => ({ ...current, [activeWorld]: [] }));
      }
      return 'life';
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
      closeToLife,
    }),
    [world, stack, selectWorld, push, pop, popToRoot, closeToLife],
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
 * Screen-header titles. These can be longer than the tab labels because the
 * header has the full screen width — which is why Relationships gets its real
 * name here even though the tab has to say "People".
 */
export const WORLD_TITLES: Record<World, string> = {
  career: 'Career',
  assets: 'Assets',
  life: 'Life',
  relationships: 'Relationships',
  activities: 'Activities',
};

/**
 * Tab labels.
 *
 * These name the five worlds of spec 828–838 in the player's language. They are
 * constrained to a fifth of the screen, which is the only reason Relationships
 * appears as "People" here while the header above says the full word.
 */
export const WORLD_LABELS: Record<World, string> = {
  career: 'Career',
  assets: 'Assets',
  life: 'Life',
  relationships: 'People',
  activities: 'Activities',
};
