const minuteDurationMs = 60_000;

export function createLiveMinuteSnapshotReader(now: () => number) {
    let cachedMinute = Number.NaN;
    let cachedSnapshot = new Date(0);

    return () => {
        const currentTime = now();
        const currentMinute = Math.floor(currentTime / minuteDurationMs);
        if (currentMinute !== cachedMinute) {
            cachedMinute = currentMinute;
            cachedSnapshot = new Date(currentTime);
        }
        return cachedSnapshot;
    };
}

export type LiveMinuteClockOptions = {
    clearTimeout: (handle: unknown) => void;
    documentVisible: boolean;
    now: () => number;
    runtimeActive: boolean;
    setTimeout: (callback: () => void, delayMs: number) => unknown;
};

/**
 * A shared minute clock whose scheduling can be gated independently from its
 * subscribers. Keeping the timer mechanics outside React makes pause/resume
 * behavior deterministic and prevents every HUD consumer from owning a timer.
 */
export class LiveMinuteClock {
    private documentVisible: boolean;
    private readonly listeners = new Set<() => void>();
    private readonly options: LiveMinuteClockOptions;
    private runtimeActive: boolean;
    private snapshot: Date;
    private timeoutHandle: unknown;
    private timeoutScheduled = false;

    constructor(options: LiveMinuteClockOptions) {
        this.options = options;
        this.documentVisible = options.documentVisible;
        this.runtimeActive = options.runtimeActive;
        this.snapshot = new Date(options.now());
    }

    readonly getSnapshot = () => this.snapshot;

    readonly subscribe = (listener: () => void) => {
        const firstSubscriber = this.listeners.size === 0;
        this.listeners.add(listener);

        if (firstSubscriber) {
            this.publishCurrentTime();
            if (this.shouldSchedule()) {
                this.scheduleNextTick();
            }
        }

        let subscribed = true;
        return () => {
            if (!subscribed) {
                return;
            }
            subscribed = false;
            this.listeners.delete(listener);
            if (this.listeners.size === 0) {
                this.clearScheduledTick();
            }
        };
    };

    setDocumentVisible(visible: boolean) {
        if (this.documentVisible === visible) {
            return;
        }
        const wasScheduling = this.shouldSchedule();
        this.documentVisible = visible;
        this.reconcileScheduling(wasScheduling);
    }

    setRuntimeActive(active: boolean) {
        if (this.runtimeActive === active) {
            return;
        }
        const wasScheduling = this.shouldSchedule();
        this.runtimeActive = active;
        this.reconcileScheduling(wasScheduling);
    }

    private reconcileScheduling(wasScheduling: boolean) {
        const shouldSchedule = this.shouldSchedule();
        if (wasScheduling === shouldSchedule) {
            return;
        }
        if (!shouldSchedule) {
            this.clearScheduledTick();
            return;
        }

        this.publishCurrentTime();
        this.scheduleNextTick();
    }

    private shouldSchedule() {
        return (
            this.listeners.size > 0 &&
            this.documentVisible &&
            this.runtimeActive
        );
    }

    private publishCurrentTime() {
        this.snapshot = new Date(this.options.now());
        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    private scheduleNextTick() {
        this.clearScheduledTick();
        const now = this.options.now();
        const elapsedInMinute =
            ((now % minuteDurationMs) + minuteDurationMs) % minuteDurationMs;
        const delayMs =
            elapsedInMinute === 0
                ? minuteDurationMs
                : minuteDurationMs - elapsedInMinute;
        this.timeoutScheduled = true;
        this.timeoutHandle = this.options.setTimeout(() => {
            this.timeoutScheduled = false;
            this.timeoutHandle = undefined;
            if (!this.shouldSchedule()) {
                return;
            }
            this.publishCurrentTime();
            this.scheduleNextTick();
        }, delayMs);
    }

    private clearScheduledTick() {
        if (!this.timeoutScheduled) {
            return;
        }
        this.options.clearTimeout(this.timeoutHandle);
        this.timeoutScheduled = false;
        this.timeoutHandle = undefined;
    }
}
