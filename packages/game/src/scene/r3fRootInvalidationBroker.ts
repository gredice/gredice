import type { RootState } from '@react-three/fiber';

type RootInvalidate = RootState['invalidate'];

export type R3FRootInvalidationStore = {
    getState: () => Pick<RootState, 'frameloop' | 'invalidate'>;
    setState: (
        state: Partial<Pick<RootState, 'frameloop' | 'invalidate'>>,
    ) => void;
};

type RootInvalidationBrokerRegistration = {
    brokerInvalidate: RootInvalidate;
    generation: number;
    isEnabled: () => boolean;
    isFrameRendering: () => boolean;
    owner: symbol;
    pendingRelease: boolean;
    rawInvalidate: RootInvalidate;
    requestCoalescedRender: (reason: string, frames?: number) => boolean;
};

const rootInvalidationBrokerReason = 'r3f-root-update';
const rootInvalidationBrokers = new WeakMap<
    R3FRootInvalidationStore,
    RootInvalidationBrokerRegistration
>();

/**
 * Reads the immutable root-scoped R3F invalidation function. A replacement
 * provider can render before the previous provider's deferred cleanup, so the
 * registry remains the source of truth while a broker is installed.
 */
export function readRawR3FRootInvalidate(store: R3FRootInvalidationStore) {
    return (
        rootInvalidationBrokers.get(store)?.rawInvalidate ??
        store.getState().invalidate
    );
}

export function installR3FRootInvalidationBroker({
    isEnabled,
    isFrameRendering,
    owner,
    rawInvalidate,
    requestCoalescedRender,
    store,
}: {
    isEnabled: () => boolean;
    isFrameRendering: () => boolean;
    owner: symbol;
    rawInvalidate: RootInvalidate;
    requestCoalescedRender: (reason: string, frames?: number) => boolean;
    store: R3FRootInvalidationStore;
}) {
    // R3F 9.6.1 reconciler host mutations resolve this root-state function.
    // The scheduler retains rawInvalidate because reading the state again after
    // installation would call this broker recursively.
    const currentRegistration = rootInvalidationBrokers.get(store);
    if (
        currentRegistration &&
        !currentRegistration.pendingRelease &&
        currentRegistration.owner !== owner
    ) {
        throw new Error(
            'Only one game runtime invalidation broker can own an R3F root',
        );
    }

    const registration =
        currentRegistration?.owner === owner
            ? currentRegistration
            : createRegistration({
                  isEnabled,
                  isFrameRendering,
                  owner,
                  rawInvalidate:
                      currentRegistration?.rawInvalidate ?? rawInvalidate,
                  requestCoalescedRender,
                  store,
              });
    registration.generation += 1;
    registration.isEnabled = isEnabled;
    registration.isFrameRendering = isFrameRendering;
    registration.pendingRelease = false;
    registration.requestCoalescedRender = requestCoalescedRender;
    const installationGeneration = registration.generation;
    rootInvalidationBrokers.set(store, registration);

    if (store.getState().invalidate !== registration.brokerInvalidate) {
        store.setState({ invalidate: registration.brokerInvalidate });
    }

    let released = false;
    return () => {
        if (released) {
            return;
        }
        released = true;
        if (
            rootInvalidationBrokers.get(store) !== registration ||
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
                rootInvalidationBrokers.get(store) !== registration ||
                !registration.pendingRelease ||
                registration.generation !== releaseGeneration
            ) {
                return;
            }

            rootInvalidationBrokers.delete(store);
            if (store.getState().invalidate === registration.brokerInvalidate) {
                store.setState({ invalidate: registration.rawInvalidate });
            }
        });
    };
}

function createRegistration({
    isEnabled,
    isFrameRendering,
    owner,
    rawInvalidate,
    requestCoalescedRender,
    store,
}: {
    isEnabled: () => boolean;
    isFrameRendering: () => boolean;
    owner: symbol;
    rawInvalidate: RootInvalidate;
    requestCoalescedRender: (reason: string, frames?: number) => boolean;
    store: R3FRootInvalidationStore;
}): RootInvalidationBrokerRegistration {
    const registration: RootInvalidationBrokerRegistration = {
        brokerInvalidate: () => undefined,
        generation: 0,
        isEnabled,
        isFrameRendering,
        owner,
        pendingRelease: false,
        rawInvalidate,
        requestCoalescedRender,
    };
    registration.brokerInvalidate = (frames) => {
        const invalidFrames =
            typeof frames === 'number' &&
            (!Number.isFinite(frames) || frames <= 0);
        if (
            !registration.isEnabled() ||
            store.getState().frameloop !== 'demand' ||
            invalidFrames
        ) {
            registration.rawInvalidate(frames);
            return;
        }

        const oneFrameRequest =
            frames === undefined ||
            (Number.isFinite(frames) && frames > 0 && frames <= 1);
        const coalescedFrames =
            registration.isFrameRendering() && oneFrameRequest ? 2 : frames;
        if (
            !registration.requestCoalescedRender(
                rootInvalidationBrokerReason,
                coalescedFrames,
            )
        ) {
            registration.rawInvalidate(frames);
        }
    };
    return registration;
}
