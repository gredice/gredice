export type GeneratedLSystemTaskPriority = 'background' | 'normal' | 'focused';

const TASK_PRIORITY_WEIGHT = {
    background: 0,
    normal: 1,
    focused: 2,
} satisfies Record<GeneratedLSystemTaskPriority, number>;

export interface GeneratedLSystemTaskExecutionContext {
    key: string;
    priority: GeneratedLSystemTaskPriority;
}

export interface ScheduleGeneratedLSystemTaskOptions<Task> {
    key: string;
    priority?: GeneratedLSystemTaskPriority;
    signal?: AbortSignal;
    task: Task;
}

export interface GeneratedLSystemTaskSchedulerSnapshot {
    activeSubscriberCount: number;
    cancelledSubscriberCount: number;
    completedTaskCount: number;
    deduplicatedSubscriberCount: number;
    deliveredSubscriberCount: number;
    enqueuedTaskCount: number;
    failedTaskCount: number;
    focusedPromotionCount: number;
    focusedQueuedTaskCount: number;
    inFlightTaskKey: string | null;
    peakQueuedTaskCount: number;
    priorityPromotionCount: number;
    queuedTaskCount: number;
    queuedTaskRemovalCount: number;
    staleResultCount: number;
    startedTaskCount: number;
    submittedSubscriberCount: number;
}

type GeneratedLSystemTaskExecutor<Task, Result> = (
    task: Task,
    context: GeneratedLSystemTaskExecutionContext,
) => Promise<Result> | Result;

type TaskEntryState = 'queued' | 'in-flight';

interface TaskSubscriber<Result> {
    active: boolean;
    abortListener?: () => void;
    reject: (reason?: unknown) => void;
    resolve: (result: Result) => void;
    signal?: AbortSignal;
}

interface TaskEntry<Task, Result> {
    key: string;
    priority: GeneratedLSystemTaskPriority;
    sequence: number;
    state: TaskEntryState;
    subscribers: Set<TaskSubscriber<Result>>;
    task: Task;
}

function createAbortError() {
    const error = new Error('Generated L-system task subscription aborted');
    error.name = 'AbortError';
    return error;
}

function getAbortReason(signal: AbortSignal) {
    return signal.reason === undefined ? createAbortError() : signal.reason;
}

/**
 * A single-lane scheduler for expensive generated-plant work.
 *
 * Task keys are authoritative: subscribers requesting the same key share the
 * queued or in-flight execution. Subscriber cancellation never interrupts the
 * atomic in-flight executor, but queued work is removed when it has no active
 * subscribers and in-flight results with no subscribers are counted as stale.
 */
export class GeneratedLSystemTaskScheduler<Task, Result> {
    private readonly entriesByKey = new Map<string, TaskEntry<Task, Result>>();
    private inFlight: TaskEntry<Task, Result> | null = null;
    private drainScheduled = false;
    private nextSequence = 0;

    private cancelledSubscriberCount = 0;
    private completedTaskCount = 0;
    private deduplicatedSubscriberCount = 0;
    private deliveredSubscriberCount = 0;
    private enqueuedTaskCount = 0;
    private failedTaskCount = 0;
    private focusedPromotionCount = 0;
    private peakQueuedTaskCount = 0;
    private priorityPromotionCount = 0;
    private queuedTaskRemovalCount = 0;
    private staleResultCount = 0;
    private startedTaskCount = 0;
    private submittedSubscriberCount = 0;

    constructor(
        private readonly execute: GeneratedLSystemTaskExecutor<Task, Result>,
    ) {}

    schedule({
        key,
        priority = 'normal',
        signal,
        task,
    }: ScheduleGeneratedLSystemTaskOptions<Task>): Promise<Result> {
        this.submittedSubscriberCount += 1;
        if (signal?.aborted) {
            this.cancelledSubscriberCount += 1;
            return Promise.reject(getAbortReason(signal));
        }

        let entry = this.entriesByKey.get(key);
        if (entry) {
            this.deduplicatedSubscriberCount += 1;
            this.promoteEntry(entry, priority);
        } else {
            entry = {
                key,
                priority,
                sequence: this.nextSequence,
                state: 'queued',
                subscribers: new Set(),
                task,
            };
            this.nextSequence += 1;
            this.enqueuedTaskCount += 1;
            this.entriesByKey.set(key, entry);
            this.peakQueuedTaskCount = Math.max(
                this.peakQueuedTaskCount,
                this.getQueuedTaskCount(),
            );
        }

        const result = this.subscribe(entry, signal);
        this.scheduleDrain();
        return result;
    }

    promote(key: string, priority: GeneratedLSystemTaskPriority = 'focused') {
        const entry = this.entriesByKey.get(key);
        if (entry?.state !== 'queued') {
            return false;
        }

        return this.promoteEntry(entry, priority);
    }

    snapshot(): GeneratedLSystemTaskSchedulerSnapshot {
        let activeSubscriberCount = 0;
        let focusedQueuedTaskCount = 0;
        let queuedTaskCount = 0;

        for (const entry of this.entriesByKey.values()) {
            activeSubscriberCount += entry.subscribers.size;
            if (entry.state !== 'queued') {
                continue;
            }

            queuedTaskCount += 1;
            if (entry.priority === 'focused') {
                focusedQueuedTaskCount += 1;
            }
        }

        return {
            activeSubscriberCount,
            cancelledSubscriberCount: this.cancelledSubscriberCount,
            completedTaskCount: this.completedTaskCount,
            deduplicatedSubscriberCount: this.deduplicatedSubscriberCount,
            deliveredSubscriberCount: this.deliveredSubscriberCount,
            enqueuedTaskCount: this.enqueuedTaskCount,
            failedTaskCount: this.failedTaskCount,
            focusedPromotionCount: this.focusedPromotionCount,
            focusedQueuedTaskCount,
            inFlightTaskKey: this.inFlight?.key ?? null,
            peakQueuedTaskCount: this.peakQueuedTaskCount,
            priorityPromotionCount: this.priorityPromotionCount,
            queuedTaskCount,
            queuedTaskRemovalCount: this.queuedTaskRemovalCount,
            staleResultCount: this.staleResultCount,
            startedTaskCount: this.startedTaskCount,
            submittedSubscriberCount: this.submittedSubscriberCount,
        };
    }

    private subscribe(entry: TaskEntry<Task, Result>, signal?: AbortSignal) {
        return new Promise<Result>((resolve, reject) => {
            const subscriber: TaskSubscriber<Result> = {
                active: true,
                reject,
                resolve,
                signal,
            };

            entry.subscribers.add(subscriber);
            if (!signal) {
                return;
            }

            subscriber.abortListener = () => {
                this.cancelSubscriber(
                    entry,
                    subscriber,
                    getAbortReason(signal),
                );
            };
            signal.addEventListener('abort', subscriber.abortListener, {
                once: true,
            });

            if (signal.aborted) {
                subscriber.abortListener();
            }
        });
    }

    private cancelSubscriber(
        entry: TaskEntry<Task, Result>,
        subscriber: TaskSubscriber<Result>,
        reason: unknown,
    ) {
        if (!subscriber.active) {
            return;
        }

        this.removeSubscriber(entry, subscriber);
        this.cancelledSubscriberCount += 1;
        subscriber.reject(reason);

        if (entry.state === 'queued' && entry.subscribers.size === 0) {
            if (this.entriesByKey.get(entry.key) === entry) {
                this.entriesByKey.delete(entry.key);
            }
            this.queuedTaskRemovalCount += 1;
        }
    }

    private removeSubscriber(
        entry: TaskEntry<Task, Result>,
        subscriber: TaskSubscriber<Result>,
    ) {
        subscriber.active = false;
        entry.subscribers.delete(subscriber);
        if (subscriber.signal && subscriber.abortListener) {
            subscriber.signal.removeEventListener(
                'abort',
                subscriber.abortListener,
            );
        }
    }

    private promoteEntry(
        entry: TaskEntry<Task, Result>,
        priority: GeneratedLSystemTaskPriority,
    ) {
        if (
            entry.state !== 'queued' ||
            TASK_PRIORITY_WEIGHT[priority] <=
                TASK_PRIORITY_WEIGHT[entry.priority]
        ) {
            return false;
        }

        entry.priority = priority;
        this.priorityPromotionCount += 1;
        if (priority === 'focused') {
            this.focusedPromotionCount += 1;
        }
        return true;
    }

    private scheduleDrain() {
        if (this.inFlight || this.drainScheduled) {
            return;
        }

        this.drainScheduled = true;
        queueMicrotask(() => {
            this.drainScheduled = false;
            this.startNext();
        });
    }

    private startNext() {
        if (this.inFlight) {
            return;
        }

        const next = this.getNextEntry();
        if (!next) {
            return;
        }

        next.state = 'in-flight';
        this.inFlight = next;
        this.startedTaskCount += 1;

        void Promise.resolve()
            .then(() =>
                this.execute(next.task, {
                    key: next.key,
                    priority: next.priority,
                }),
            )
            .then(
                (result) => this.completeEntry(next, result),
                (error: unknown) => this.failEntry(next, error),
            );
    }

    private getNextEntry() {
        let selected: TaskEntry<Task, Result> | null = null;

        for (const entry of this.entriesByKey.values()) {
            if (entry.state !== 'queued' || entry.subscribers.size === 0) {
                continue;
            }
            if (
                !selected ||
                TASK_PRIORITY_WEIGHT[entry.priority] >
                    TASK_PRIORITY_WEIGHT[selected.priority] ||
                (entry.priority === selected.priority &&
                    entry.sequence < selected.sequence)
            ) {
                selected = entry;
            }
        }

        return selected;
    }

    private completeEntry(entry: TaskEntry<Task, Result>, result: Result) {
        this.finishEntry(entry);
        this.completedTaskCount += 1;

        if (entry.subscribers.size === 0) {
            this.staleResultCount += 1;
        } else {
            for (const subscriber of Array.from(entry.subscribers)) {
                this.removeSubscriber(entry, subscriber);
                this.deliveredSubscriberCount += 1;
                subscriber.resolve(result);
            }
        }

        this.scheduleDrain();
    }

    private failEntry(entry: TaskEntry<Task, Result>, error: unknown) {
        this.finishEntry(entry);
        this.failedTaskCount += 1;

        for (const subscriber of Array.from(entry.subscribers)) {
            this.removeSubscriber(entry, subscriber);
            subscriber.reject(error);
        }

        this.scheduleDrain();
    }

    private finishEntry(entry: TaskEntry<Task, Result>) {
        if (this.inFlight === entry) {
            this.inFlight = null;
        }
        if (this.entriesByKey.get(entry.key) === entry) {
            this.entriesByKey.delete(entry.key);
        }
    }

    private getQueuedTaskCount() {
        let queuedTaskCount = 0;
        for (const entry of this.entriesByKey.values()) {
            if (entry.state === 'queued') {
                queuedTaskCount += 1;
            }
        }
        return queuedTaskCount;
    }
}
