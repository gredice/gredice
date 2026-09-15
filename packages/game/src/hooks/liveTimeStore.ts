import {
    getGameSceneRuntimeActivitySnapshot,
    subscribeGameSceneRuntimeActivity,
} from '../scene/sceneRuntimeActivity';
import {
    createLiveMinuteSnapshotReader,
    LiveMinuteClock,
} from './liveMinuteClock';

function readDocumentVisible() {
    return typeof document === 'undefined' || !document.hidden;
}

const liveMinuteClock = new LiveMinuteClock({
    clearTimeout: (handle) => globalThis.clearTimeout(Number(handle)),
    documentVisible: readDocumentVisible(),
    now: Date.now,
    runtimeActive: getGameSceneRuntimeActivitySnapshot().runtimeActive,
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
});

let subscriberCount = 0;
let stopRuntimeActivityTracking: (() => void) | undefined;

function handleDocumentVisibilityChange() {
    liveMinuteClock.setDocumentVisible(readDocumentVisible());
}

function handlePageHide() {
    liveMinuteClock.setDocumentVisible(false);
}

function startActivityTracking() {
    if (typeof document !== 'undefined') {
        document.addEventListener(
            'visibilitychange',
            handleDocumentVisibilityChange,
        );
        handleDocumentVisibilityChange();
    }
    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('pageshow', handleDocumentVisibilityChange);
    }

    stopRuntimeActivityTracking = subscribeGameSceneRuntimeActivity(() => {
        liveMinuteClock.setRuntimeActive(
            getGameSceneRuntimeActivitySnapshot().runtimeActive,
        );
    });
    liveMinuteClock.setRuntimeActive(
        getGameSceneRuntimeActivitySnapshot().runtimeActive,
    );
}

function stopActivityTracking() {
    if (typeof document !== 'undefined') {
        document.removeEventListener(
            'visibilitychange',
            handleDocumentVisibilityChange,
        );
    }
    if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('pageshow', handleDocumentVisibilityChange);
    }
    stopRuntimeActivityTracking?.();
    stopRuntimeActivityTracking = undefined;
}

export const getLiveTimeSnapshot = liveMinuteClock.getSnapshot;
export const getLiveTimeServerSnapshot = createLiveMinuteSnapshotReader(
    Date.now,
);

export function subscribeLiveTime(listener: () => void) {
    if (subscriberCount === 0) {
        startActivityTracking();
    }
    subscriberCount += 1;
    const unsubscribeClock = liveMinuteClock.subscribe(listener);

    let subscribed = true;
    return () => {
        if (!subscribed) {
            return;
        }
        subscribed = false;
        unsubscribeClock();
        subscriberCount -= 1;
        if (subscriberCount === 0) {
            stopActivityTracking();
        }
    };
}
