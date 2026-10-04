import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VisibilityAwareInterval } from './visibilityAwareInterval';

class FakeIntervalQueue {
    readonly callbacks = new Map<number, () => void>();
    private nextId = 1;

    readonly setInterval = (callback: () => void) => {
        const id = this.nextId++;
        this.callbacks.set(id, callback);
        return id;
    };

    readonly clearInterval = (handle: unknown) => {
        this.callbacks.delete(Number(handle));
    };
}

function createInterval(
    queue: FakeIntervalQueue,
    {
        documentVisible = true,
        runtimeActive = true,
        tick = () => undefined,
    }: {
        documentVisible?: boolean;
        runtimeActive?: boolean;
        tick?: () => void;
    } = {},
) {
    return new VisibilityAwareInterval({
        clearInterval: queue.clearInterval,
        documentVisible,
        intervalMs: 50,
        runtimeActive,
        setInterval: queue.setInterval,
        tick,
    });
}

describe('VisibilityAwareInterval', () => {
    it('owns one interval only while both visibility gates are active', () => {
        const queue = new FakeIntervalQueue();
        let tickCount = 0;
        const interval = createInterval(queue, {
            documentVisible: false,
            tick: () => {
                tickCount += 1;
            },
        });

        assert.equal(queue.callbacks.size, 0);
        interval.setDocumentVisible(true);
        assert.equal(queue.callbacks.size, 1);
        const firstCallback = [...queue.callbacks.values()][0];
        firstCallback?.();
        assert.equal(tickCount, 1);

        interval.setRuntimeActive(false);
        assert.equal(queue.callbacks.size, 0);
        firstCallback?.();
        assert.equal(tickCount, 1);
        interval.setDocumentVisible(false);
        interval.setRuntimeActive(true);
        assert.equal(queue.callbacks.size, 0);
        interval.setDocumentVisible(true);
        interval.setDocumentVisible(true);
        assert.equal(queue.callbacks.size, 1);

        interval.dispose();
        interval.dispose();
        assert.equal(queue.callbacks.size, 0);
        interval.setDocumentVisible(true);
        interval.setRuntimeActive(true);
        assert.equal(queue.callbacks.size, 0);
    });

    it('cleans the first interval before a StrictMode-style restart', () => {
        const queue = new FakeIntervalQueue();
        const first = createInterval(queue);
        assert.equal(queue.callbacks.size, 1);
        first.dispose();
        assert.equal(queue.callbacks.size, 0);

        const second = createInterval(queue);
        assert.equal(queue.callbacks.size, 1);
        second.dispose();
        assert.equal(queue.callbacks.size, 0);
    });
});
