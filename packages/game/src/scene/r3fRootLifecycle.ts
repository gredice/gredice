import type { RootState } from '@react-three/fiber';

type R3FRootFrameloopState = {
    frameloop: RootState['frameloop'];
    internal: {
        frames: number;
    };
    setFrameloop: RootState['setFrameloop'];
};

export type R3FRootFrameloopStore = {
    getState: () => R3FRootFrameloopState;
    setState: (
        state: Partial<Pick<RootState, 'frameloop' | 'setFrameloop'>>,
    ) => void;
    subscribe: (listener: (state: R3FRootFrameloopState) => void) => () => void;
};

type R3FRootFrameloopVisibilityRegistration = {
    brokerSetFrameloop: RootState['setFrameloop'];
    generation: number;
    owner: symbol;
    pendingRelease: boolean;
    rawSetFrameloop: RootState['setFrameloop'];
    resumeFrameloop: RootState['frameloop'];
    store: R3FRootFrameloopStore;
    suspended: boolean;
    unsubscribeStore: () => void;
    visible: boolean;
};

export type R3FRootFrameloopVisibilityHandle = {
    managed: boolean;
    release: () => void;
    setVisible: (visible: boolean) => void;
};

const rootFrameloopVisibilityRegistrations = new WeakMap<
    R3FRootFrameloopStore,
    R3FRootFrameloopVisibilityRegistration
>();

const unmanagedRootFrameloopVisibilityHandle: R3FRootFrameloopVisibilityHandle =
    {
        managed: false,
        release: () => undefined,
        setVisible: () => undefined,
    };

function suspendRootFrameloop(
    registration: R3FRootFrameloopVisibilityRegistration,
) {
    const state = registration.store.getState();
    if (state.frameloop === 'never') {
        state.internal.frames = 0;
        registration.suspended = true;
        return;
    }

    registration.resumeFrameloop = state.frameloop;
    // A module-global R3F invalidation may already have queued a frame. Clear
    // it before switching modes so the pending global RAF cannot render this
    // root after its runtime became invisible.
    state.internal.frames = 0;
    registration.suspended = true;
    registration.store.setState({ frameloop: 'never' });
    registration.store.getState().internal.frames = 0;
}

function restoreRootFrameloop(
    registration: R3FRootFrameloopVisibilityRegistration,
) {
    if (!registration.suspended) {
        return;
    }

    registration.suspended = false;
    if (registration.store.getState().frameloop === 'never') {
        // R3F's public setFrameloop resets its Three clock. Restore the exact
        // requested mode through direct state so elapsed time remains monotonic.
        registration.store.setState({
            frameloop: registration.resumeFrameloop,
        });
    }
}

function createRootFrameloopVisibilityRegistration({
    owner,
    store,
}: {
    owner: symbol;
    store: R3FRootFrameloopStore;
}): R3FRootFrameloopVisibilityRegistration {
    const registration: R3FRootFrameloopVisibilityRegistration = {
        brokerSetFrameloop: () => undefined,
        generation: 0,
        owner,
        pendingRelease: false,
        rawSetFrameloop: store.getState().setFrameloop,
        resumeFrameloop: 'demand',
        store,
        suspended: false,
        unsubscribeStore: () => undefined,
        visible: true,
    };
    registration.brokerSetFrameloop = (frameloop) => {
        if (!registration.visible) {
            registration.resumeFrameloop = frameloop;
            suspendRootFrameloop(registration);
            return;
        }
        registration.rawSetFrameloop(frameloop);
    };
    return registration;
}

function createRootFrameloopVisibilityHandle({
    installationGeneration,
    owner,
    registration,
}: {
    installationGeneration: number;
    owner: symbol;
    registration: R3FRootFrameloopVisibilityRegistration;
}): R3FRootFrameloopVisibilityHandle {
    let released = false;
    return {
        managed: true,
        release: () => {
            if (released) {
                return;
            }
            released = true;
            if (
                rootFrameloopVisibilityRegistrations.get(registration.store) !==
                    registration ||
                registration.owner !== owner ||
                registration.generation !== installationGeneration
            ) {
                return;
            }

            registration.pendingRelease = true;
            registration.generation += 1;
            const releaseGeneration = registration.generation;
            globalThis.queueMicrotask(() => {
                if (
                    rootFrameloopVisibilityRegistrations.get(
                        registration.store,
                    ) !== registration ||
                    !registration.pendingRelease ||
                    registration.generation !== releaseGeneration
                ) {
                    return;
                }

                rootFrameloopVisibilityRegistrations.delete(registration.store);
                registration.unsubscribeStore();
                registration.visible = true;
                restoreRootFrameloop(registration);
                if (
                    registration.store.getState().setFrameloop ===
                    registration.brokerSetFrameloop
                ) {
                    registration.store.setState({
                        setFrameloop: registration.rawSetFrameloop,
                    });
                }
            });
        },
        setVisible: (visible) => {
            if (
                released ||
                rootFrameloopVisibilityRegistrations.get(registration.store) !==
                    registration ||
                registration.owner !== owner ||
                registration.generation !== installationGeneration
            ) {
                return;
            }

            registration.visible = visible;
            if (visible) {
                restoreRootFrameloop(registration);
            } else {
                suspendRootFrameloop(registration);
            }
        },
    };
}

/**
 * Shields an ordinary demand root from module-global R3F invalidation while its
 * scheduler is invisible. Manual roots opt out so capture-driven frameloops
 * retain their explicit lifecycle.
 */
export function installR3FRootFrameloopVisibility({
    enabled,
    owner,
    store,
}: {
    enabled: boolean;
    owner: symbol;
    store: R3FRootFrameloopStore;
}): R3FRootFrameloopVisibilityHandle {
    if (!enabled) {
        return unmanagedRootFrameloopVisibilityHandle;
    }

    const currentRegistration = rootFrameloopVisibilityRegistrations.get(store);
    if (
        currentRegistration &&
        !currentRegistration.pendingRelease &&
        currentRegistration.owner !== owner
    ) {
        throw new Error(
            'Only one visibility lifecycle can own an R3F root frameloop',
        );
    }

    if (!currentRegistration && store.getState().frameloop !== 'demand') {
        return unmanagedRootFrameloopVisibilityHandle;
    }

    const registration =
        currentRegistration ??
        createRootFrameloopVisibilityRegistration({ owner, store });
    registration.generation += 1;
    registration.owner = owner;
    registration.pendingRelease = false;
    const installationGeneration = registration.generation;

    if (!currentRegistration) {
        registration.unsubscribeStore = store.subscribe((state) => {
            if (!registration.visible && state.frameloop !== 'never') {
                suspendRootFrameloop(registration);
            }
        });
        rootFrameloopVisibilityRegistrations.set(store, registration);
    }
    if (store.getState().setFrameloop !== registration.brokerSetFrameloop) {
        store.setState({
            setFrameloop: registration.brokerSetFrameloop,
        });
    }

    return createRootFrameloopVisibilityHandle({
        installationGeneration,
        owner,
        registration,
    });
}

export function resolveSceneSpringContext<
    TContext extends { immediate?: boolean; pause?: boolean },
>({
    context,
    manualFrameloop,
    runtimeVisible,
    visibilityManaged,
}: {
    context: TContext;
    manualFrameloop: boolean;
    runtimeVisible: boolean;
    visibilityManaged: boolean;
}) {
    return {
        ...context,
        immediate: Boolean(context.immediate) || manualFrameloop,
        pause: Boolean(context.pause) || (visibilityManaged && !runtimeVisible),
    };
}
