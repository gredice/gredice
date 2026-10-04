import {
    compareGardenSceneAssetPriority,
    type GardenSceneAssetPriority,
} from './gardenSceneManifest';

export type GameAssetLoadPauseReason = 'context-lost' | 'hidden' | 'pagehide';

type TimerHandle = unknown;

export type GameAssetLoadSchedulerOptions<Key extends string> = {
    /** Parallel fetch/decode slots shared by all priorities. */
    concurrency: number;
    load: (key: Key) => Promise<unknown>;
    /** True when the asset is already decoded and resident. */
    isLoaded: (key: Key) => boolean;
    /** Runs idle-priority work when the main thread is free. */
    requestIdle: (callback: () => void) => TimerHandle;
    cancelIdle: (handle: TimerHandle) => void;
    onChange?: (snapshot: GameAssetLoadSchedulerSnapshot) => void;
};

export type GameAssetLoadRequest<Key extends string> = {
    readonly name: Key;
    readonly priority: GardenSceneAssetPriority;
};

type PriorityCounts = Record<GardenSceneAssetPriority, number>;

export type GameAssetLoadSchedulerSnapshot = {
    generation: number;
    queued: PriorityCounts;
    inFlight: number;
    peakInFlight: number;
    started: number;
    completed: number;
    failed: number;
    cancelled: number;
    staleCompletions: number;
    paused: GameAssetLoadPauseReason[];
    /** Every current-priority request of this plan is resident. */
    currentReady: boolean;
    /** Current and transition-next requests are resident. */
    transitionReady: boolean;
    /** Planned requests that failed and will not be retried. */
    failedRequests: Record<GardenSceneAssetPriority, number>;
};

function emptyCounts(): PriorityCounts {
    return { current: 0, 'transition-next': 0, idle: 0 };
}

/**
 * Bounded, strictly ordered asset loading. Current-scene requests always run
 * first, transition-next requests run once current work is drained, and idle
 * requests start one at a time from an idle callback after both are settled.
 * Replacing the plan cancels queued work; in-flight loads cannot be aborted
 * but their completions are counted as stale and leave cache lifetime to the
 * resource cache.
 */
export class GameAssetLoadScheduler<Key extends string> {
    private queue: GameAssetLoadRequest<Key>[] = [];
    private readonly inFlight = new Map<
        Key,
        { generation: number; priority: GardenSceneAssetPriority }
    >();
    private readonly failedKeys = new Set<Key>();
    private plan: GameAssetLoadRequest<Key>[] = [];
    private readonly paused = new Set<GameAssetLoadPauseReason>();
    private idleHandle: TimerHandle | null = null;
    private generation = 0;
    private disposed = false;
    private peakInFlight = 0;
    private started = 0;
    private completed = 0;
    private failed = 0;
    private cancelled = 0;
    private staleCompletions = 0;

    constructor(private readonly options: GameAssetLoadSchedulerOptions<Key>) {}

    setPlan(requests: readonly GameAssetLoadRequest<Key>[]) {
        if (this.disposed) return;
        this.generation++;
        const byName = new Map<Key, GameAssetLoadRequest<Key>>();
        for (const request of requests) {
            const existing = byName.get(request.name);
            if (
                !existing ||
                compareGardenSceneAssetPriority(
                    request.priority,
                    existing.priority,
                ) < 0
            ) {
                byName.set(request.name, request);
            }
        }
        this.plan = [...byName.values()];
        const nextQueue = this.plan
            .filter(
                (request) =>
                    !this.inFlight.has(request.name) &&
                    !this.failedKeys.has(request.name) &&
                    !this.options.isLoaded(request.name),
            )
            .sort(
                (left, right) =>
                    compareGardenSceneAssetPriority(
                        left.priority,
                        right.priority,
                    ) || left.name.localeCompare(right.name),
            );
        const kept = new Set(nextQueue.map((request) => request.name));
        for (const request of this.queue) {
            if (!kept.has(request.name)) this.cancelled++;
        }
        this.queue = nextQueue;
        this.pump();
    }

    setPaused(reason: GameAssetLoadPauseReason, paused: boolean) {
        if (paused === this.paused.has(reason)) return;
        if (paused) this.paused.add(reason);
        else this.paused.delete(reason);
        if (paused) this.cancelIdleCallback();
        this.pump();
    }

    /** Forgets failures so a retry (for example after reconnecting) can run. */
    resetFailures() {
        this.failedKeys.clear();
    }

    getSnapshot(): GameAssetLoadSchedulerSnapshot {
        const queued = emptyCounts();
        for (const request of this.queue) queued[request.priority]++;
        const failedRequests = emptyCounts();
        for (const request of this.plan) {
            if (this.failedKeys.has(request.name))
                failedRequests[request.priority]++;
        }
        // A failed asset is settled but not resident, so it never counts as
        // ready; the lifecycle stays in `loading` instead of false success.
        const resident = (priorities: GardenSceneAssetPriority[]) =>
            this.plan.every(
                (request) =>
                    !priorities.includes(request.priority) ||
                    (!this.inFlight.has(request.name) &&
                        !this.failedKeys.has(request.name) &&
                        this.options.isLoaded(request.name)),
            );
        return {
            generation: this.generation,
            queued,
            inFlight: this.inFlight.size,
            peakInFlight: this.peakInFlight,
            started: this.started,
            completed: this.completed,
            failed: this.failed,
            cancelled: this.cancelled,
            staleCompletions: this.staleCompletions,
            paused: [...this.paused].sort(),
            currentReady: resident(['current']),
            transitionReady: resident(['current', 'transition-next']),
            failedRequests,
        };
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.cancelled += this.queue.length;
        this.queue = [];
        this.plan = [];
        this.cancelIdleCallback();
        this.publish();
    }

    private cancelIdleCallback() {
        if (this.idleHandle !== null) {
            this.options.cancelIdle(this.idleHandle);
            this.idleHandle = null;
        }
    }

    private pump() {
        if (this.disposed) return;
        while (
            this.paused.size === 0 &&
            this.inFlight.size < this.options.concurrency
        ) {
            const next = this.queue[0];
            if (!next) break;
            if (
                next.priority === 'transition-next' &&
                this.hasInFlight('current')
            ) {
                // The displayed scene owns the bandwidth until it is resident.
                break;
            }
            if (next.priority === 'idle') {
                // Idle work never competes with required work or itself.
                if (this.inFlight.size > 0 || this.idleHandle !== null) break;
                this.idleHandle = this.options.requestIdle(() => {
                    this.idleHandle = null;
                    if (this.paused.size > 0 || this.inFlight.size > 0) {
                        this.pump();
                        return;
                    }
                    const idle = this.queue[0];
                    if (idle?.priority === 'idle') {
                        this.queue.shift();
                        this.start(idle);
                    }
                    this.pump();
                });
                break;
            }
            this.queue.shift();
            this.start(next);
        }
        this.publish();
    }

    private start(request: GameAssetLoadRequest<Key>) {
        if (this.options.isLoaded(request.name)) {
            return;
        }
        const generation = this.generation;
        this.inFlight.set(request.name, {
            generation,
            priority: request.priority,
        });
        this.started++;
        this.peakInFlight = Math.max(this.peakInFlight, this.inFlight.size);
        let promise: Promise<unknown>;
        try {
            promise = this.options.load(request.name);
        } catch (error) {
            promise = Promise.reject(error);
        }
        promise.then(
            () => this.finish(request.name, generation, false),
            () => this.finish(request.name, generation, true),
        );
    }

    private hasInFlight(priority: GardenSceneAssetPriority) {
        for (const entry of this.inFlight.values()) {
            if (entry.priority === priority) return true;
        }
        return false;
    }

    private finish(key: Key, generation: number, failed: boolean) {
        this.inFlight.delete(key);
        if (failed) {
            this.failed++;
            this.failedKeys.add(key);
        } else {
            this.completed++;
        }
        if (
            generation !== this.generation &&
            !this.plan.some((request) => request.name === key)
        ) {
            this.staleCompletions++;
        }
        this.pump();
    }

    private publish() {
        this.options.onChange?.(this.getSnapshot());
    }
}
