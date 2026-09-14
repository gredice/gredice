import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createLiveMinuteSnapshotReader,
    LiveMinuteClock,
} from './liveMinuteClock';

type FakeTimeout = {
    callback: () => void;
    dueAt: number;
    id: number;
};

class FakeTimerQueue {
    currentTime: number;
    readonly tasks = new Map<number, FakeTimeout>();
    private nextTaskId = 1;

    constructor(initialTime: number) {
        this.currentTime = initialTime;
    }

    readonly now = () => this.currentTime;

    readonly setTimeout = (callback: () => void, delayMs: number) => {
        const id = this.nextTaskId++;
        this.tasks.set(id, {
            callback,
            dueAt: this.currentTime + delayMs,
            id,
        });
        return id;
    };

    readonly clearTimeout = (handle: unknown) => {
        this.tasks.delete(Number(handle));
    };

    advanceTo(targetTime: number) {
        while (true) {
            const nextTask = [...this.tasks.values()].sort(
                (left, right) => left.dueAt - right.dueAt,
            )[0];
            if (!nextTask || nextTask.dueAt > targetTime) {
                break;
            }
            this.tasks.delete(nextTask.id);
            this.currentTime = nextTask.dueAt;
            nextTask.callback();
        }
        this.currentTime = targetTime;
    }

    get nextDueAt() {
        return [...this.tasks.values()].sort(
            (left, right) => left.dueAt - right.dueAt,
        )[0]?.dueAt;
    }
}

function createClock({
    documentVisible = true,
    initialTime = 0,
    runtimeActive = true,
}: {
    documentVisible?: boolean;
    initialTime?: number;
    runtimeActive?: boolean;
} = {}) {
    const queue = new FakeTimerQueue(initialTime);
    const clock = new LiveMinuteClock({
        clearTimeout: queue.clearTimeout,
        documentVisible,
        now: queue.now,
        runtimeActive,
        setTimeout: queue.setTimeout,
    });
    return { clock, queue };
}

describe('LiveMinuteClock', () => {
    it('keeps a stable server snapshot within a minute and refreshes later', () => {
        let currentTime = 90_250;
        const readSnapshot = createLiveMinuteSnapshotReader(() => currentTime);

        const first = readSnapshot();
        currentTime = 119_999;
        assert.equal(readSnapshot(), first);
        assert.equal(first.getTime(), 90_250);

        currentTime = 120_000;
        const second = readSnapshot();
        assert.notEqual(second, first);
        assert.equal(second.getTime(), 120_000);
    });

    it('shares one minute-aligned timer across all subscribers', () => {
        const { clock, queue } = createClock({ initialTime: 90_250 });
        let firstNotifications = 0;
        let secondNotifications = 0;

        const unsubscribeFirst = clock.subscribe(() => {
            firstNotifications += 1;
        });
        const unsubscribeSecond = clock.subscribe(() => {
            secondNotifications += 1;
        });

        assert.equal(clock.getSnapshot().getTime(), 90_250);
        assert.equal(firstNotifications, 1);
        assert.equal(secondNotifications, 0);
        assert.equal(queue.tasks.size, 1);
        assert.equal(queue.nextDueAt, 120_000);

        queue.advanceTo(120_000);
        assert.equal(clock.getSnapshot().getTime(), 120_000);
        assert.equal(firstNotifications, 2);
        assert.equal(secondNotifications, 1);
        assert.equal(queue.tasks.size, 1);
        assert.equal(queue.nextDueAt, 180_000);

        unsubscribeFirst();
        assert.equal(queue.tasks.size, 1);
        unsubscribeSecond();
        assert.equal(queue.tasks.size, 0);
    });

    it('pauses while the document is hidden and resumes immediately', () => {
        const { clock, queue } = createClock({ initialTime: 10_000 });
        const snapshots: number[] = [];
        const unsubscribe = clock.subscribe(() => {
            snapshots.push(clock.getSnapshot().getTime());
        });

        clock.setDocumentVisible(false);
        assert.equal(queue.tasks.size, 0);
        queue.advanceTo(150_125);
        assert.deepEqual(snapshots, [10_000]);

        clock.setDocumentVisible(true);
        assert.deepEqual(snapshots, [10_000, 150_125]);
        assert.equal(queue.nextDueAt, 180_000);

        unsubscribe();
    });

    it('pauses for inactive scenes and waits for both activity gates', () => {
        const { clock, queue } = createClock({ initialTime: 20_000 });
        const snapshots: number[] = [];
        const unsubscribe = clock.subscribe(() => {
            snapshots.push(clock.getSnapshot().getTime());
        });

        clock.setRuntimeActive(false);
        clock.setDocumentVisible(false);
        queue.advanceTo(80_500);
        clock.setRuntimeActive(true);
        assert.equal(queue.tasks.size, 0);
        assert.deepEqual(snapshots, [20_000]);

        clock.setDocumentVisible(true);
        assert.deepEqual(snapshots, [20_000, 80_500]);
        assert.equal(queue.nextDueAt, 120_000);

        unsubscribe();
    });

    it('starts paused and publishes current time when runtime resumes', () => {
        const { clock, queue } = createClock({
            initialTime: 15_000,
            runtimeActive: false,
        });
        const snapshots: number[] = [];
        const unsubscribe = clock.subscribe(() => {
            snapshots.push(clock.getSnapshot().getTime());
        });

        assert.deepEqual(snapshots, [15_000]);
        assert.equal(queue.tasks.size, 0);
        queue.advanceTo(72_345);

        clock.setRuntimeActive(true);
        assert.deepEqual(snapshots, [15_000, 72_345]);
        assert.equal(queue.nextDueAt, 120_000);

        unsubscribe();
    });
});
