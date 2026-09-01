import { observeDocumentVisibility } from './documentVisibilityObserver';
import { LiveMinuteClock } from './liveMinuteClock';

export function startThemeManagerClock({
    clearTimeout,
    documentTarget,
    now,
    setTimeout,
    sync,
    windowTarget,
}: {
    clearTimeout: (handle: unknown) => void;
    documentTarget: Parameters<
        typeof observeDocumentVisibility
    >[0]['documentTarget'];
    now: () => number;
    setTimeout: (callback: () => void, delayMs: number) => unknown;
    sync: () => void;
    windowTarget: Parameters<
        typeof observeDocumentVisibility
    >[0]['windowTarget'];
}) {
    const clock = new LiveMinuteClock({
        clearTimeout,
        documentVisible: !documentTarget.hidden,
        now,
        runtimeActive: true,
        setTimeout,
    });
    const stopVisibilityTracking = observeDocumentVisibility({
        documentTarget,
        onVisibilityChange: (visible) => clock.setDocumentVisible(visible),
        windowTarget,
    });
    const unsubscribeClock = clock.subscribe(sync);

    let active = true;
    return () => {
        if (!active) {
            return;
        }
        active = false;
        stopVisibilityTracking();
        unsubscribeClock();
    };
}
