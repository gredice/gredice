import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startThemeManagerClock } from './themeManagerClock';

type FakeTimeout = {
    callback: () => void;
    dueAt: number;
};

class FakeTimerQueue {
    currentTime = 10_000;
    readonly tasks = new Map<number, FakeTimeout>();
    private nextId = 1;

    readonly now = () => this.currentTime;

    readonly setTimeout = (callback: () => void, delayMs: number) => {
        const id = this.nextId++;
        this.tasks.set(id, {
            callback,
            dueAt: this.currentTime + delayMs,
        });
        return id;
    };

    readonly clearTimeout = (handle: unknown) => {
        this.tasks.delete(Number(handle));
    };
}

class FakeDocumentTarget extends EventTarget {
    hidden = false;
}

describe('startThemeManagerClock', () => {
    it('pauses hidden minute work and resumes with one aligned timer', () => {
        const documentTarget = new FakeDocumentTarget();
        const windowTarget = new EventTarget();
        const queue = new FakeTimerQueue();
        let syncCount = 0;
        const stop = startThemeManagerClock({
            clearTimeout: queue.clearTimeout,
            documentTarget,
            now: queue.now,
            setTimeout: queue.setTimeout,
            sync: () => {
                syncCount += 1;
            },
            windowTarget,
        });

        assert.equal(syncCount, 1);
        assert.equal(queue.tasks.size, 1);

        documentTarget.hidden = true;
        documentTarget.dispatchEvent(new Event('visibilitychange'));
        assert.equal(queue.tasks.size, 0);

        queue.currentTime = 75_000;
        documentTarget.hidden = false;
        windowTarget.dispatchEvent(new Event('pageshow'));
        assert.equal(syncCount, 2);
        assert.equal(queue.tasks.size, 1);
        assert.equal([...queue.tasks.values()][0]?.dueAt, 120_000);

        windowTarget.dispatchEvent(new Event('pagehide'));
        assert.equal(queue.tasks.size, 0);

        stop();
        stop();
        documentTarget.dispatchEvent(new Event('visibilitychange'));
        assert.equal(queue.tasks.size, 0);
    });

    it('leaves only the latest timer after a StrictMode-style restart', () => {
        const documentTarget = new FakeDocumentTarget();
        const windowTarget = new EventTarget();
        const queue = new FakeTimerQueue();
        const options = {
            clearTimeout: queue.clearTimeout,
            documentTarget,
            now: queue.now,
            setTimeout: queue.setTimeout,
            sync: () => undefined,
            windowTarget,
        };

        const stopFirst = startThemeManagerClock(options);
        assert.equal(queue.tasks.size, 1);
        stopFirst();
        assert.equal(queue.tasks.size, 0);

        const stopSecond = startThemeManagerClock(options);
        assert.equal(queue.tasks.size, 1);
        stopSecond();
        assert.equal(queue.tasks.size, 0);
    });
});
