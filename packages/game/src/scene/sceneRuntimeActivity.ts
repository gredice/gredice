import { useSyncExternalStore } from 'react';

export type GameSceneRuntimeActivitySnapshot = {
    activeSceneCount: number;
    registeredSceneCount: number;
    runtimeActive: boolean;
};

type SceneRuntimeActivityRegistration = {
    setActive: (active: boolean) => void;
    unregister: () => void;
};

const sceneActivity = new Map<symbol, boolean>();
const listeners = new Set<() => void>();
let snapshot: GameSceneRuntimeActivitySnapshot = {
    activeSceneCount: 0,
    registeredSceneCount: 0,
    runtimeActive: true,
};

function publishSnapshot() {
    let activeSceneCount = 0;
    for (const active of sceneActivity.values()) {
        if (active) {
            activeSceneCount += 1;
        }
    }

    const registeredSceneCount = sceneActivity.size;
    const runtimeActive = registeredSceneCount === 0 || activeSceneCount > 0;
    if (
        snapshot.activeSceneCount === activeSceneCount &&
        snapshot.registeredSceneCount === registeredSceneCount &&
        snapshot.runtimeActive === runtimeActive
    ) {
        return;
    }

    snapshot = {
        activeSceneCount,
        registeredSceneCount,
        runtimeActive,
    };
    for (const listener of listeners) {
        listener();
    }
}

/**
 * Tracks aggregate activity for game-adjacent work that lives outside the R3F
 * tree, such as HUD clocks and data polling. With no mounted scene, consumers
 * remain active so standalone UI is not accidentally disabled.
 */
export function registerGameSceneRuntimeActivity(
    initiallyActive = false,
): SceneRuntimeActivityRegistration {
    const token = Symbol('game-scene-runtime');
    sceneActivity.set(token, initiallyActive);
    publishSnapshot();

    let registered = true;
    return {
        setActive: (active) => {
            if (!registered || sceneActivity.get(token) === active) {
                return;
            }
            sceneActivity.set(token, active);
            publishSnapshot();
        },
        unregister: () => {
            if (!registered) {
                return;
            }
            registered = false;
            sceneActivity.delete(token);
            publishSnapshot();
        },
    };
}

export function getGameSceneRuntimeActivitySnapshot() {
    return snapshot;
}

export function subscribeGameSceneRuntimeActivity(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useGameSceneRuntimeActive() {
    return useSyncExternalStore(
        subscribeGameSceneRuntimeActivity,
        () => getGameSceneRuntimeActivitySnapshot().runtimeActive,
        () => true,
    );
}
