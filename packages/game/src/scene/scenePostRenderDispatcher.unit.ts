import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createScenePostRenderDispatcher } from './scenePostRenderDispatcher';

describe('scene post-render dispatcher', () => {
    it('flushes one root frame exactly once with receipt ordering', () => {
        const events: string[] = [];
        const dispatcher = createScenePostRenderDispatcher({
            recordFrameReceipt: (timestampMs) => {
                events.push(`receipt:${timestampMs.toString()}`);
                return true;
            },
        });
        dispatcher.subscribeAfterRender((timestampMs) =>
            events.push(`pass:${timestampMs.toString()}`),
        );
        dispatcher.subscribeFrameReceipt((timestampMs) =>
            events.push(`observer:${timestampMs.toString()}`),
        );

        assert.equal(dispatcher.flushRenderedFrame(1), false);
        dispatcher.markRenderedFrame();
        assert.equal(dispatcher.hasRenderedFramePending(), true);
        assert.equal(dispatcher.flushRenderedFrame(42), true);
        assert.deepEqual(events, ['pass:42', 'receipt:42', 'observer:42']);
        assert.equal(dispatcher.hasRenderedFramePending(), false);
        assert.equal(dispatcher.flushRenderedFrame(43), false);
        assert.equal(events.length, 3);
    });

    it('does not let a foreign root consume a pending frame', () => {
        const firstReceipts: number[] = [];
        const secondReceipts: number[] = [];
        const first = createScenePostRenderDispatcher({
            recordFrameReceipt: (timestampMs) => {
                firstReceipts.push(timestampMs);
                return true;
            },
        });
        const second = createScenePostRenderDispatcher({
            recordFrameReceipt: (timestampMs) => {
                secondReceipts.push(timestampMs);
                return true;
            },
        });

        first.markRenderedFrame();
        second.markRenderedFrame();
        assert.equal(second.flushRenderedFrame(20), true);
        assert.deepEqual(firstReceipts, []);
        assert.deepEqual(secondReceipts, [20]);
        assert.equal(first.hasRenderedFramePending(), true);

        assert.equal(first.flushRenderedFrame(21), true);
        assert.deepEqual(firstReceipts, [21]);
    });

    it('isolates stale listener cleanup and clears abandoned frame tokens', () => {
        const events: string[] = [];
        const dispatcher = createScenePostRenderDispatcher({
            recordFrameReceipt: () => {
                events.push('receipt');
                return true;
            },
        });
        const releaseStale = dispatcher.subscribeAfterRender(() =>
            events.push('stale'),
        );
        releaseStale();
        const releaseActive = dispatcher.subscribeAfterRender(() =>
            events.push('active'),
        );

        releaseStale();
        dispatcher.markRenderedFrame();
        dispatcher.clearRenderedFrame();
        assert.equal(dispatcher.flushRenderedFrame(1), false);

        dispatcher.markRenderedFrame();
        assert.equal(dispatcher.flushRenderedFrame(2), true);
        assert.deepEqual(events, ['active', 'receipt']);
        releaseActive();
    });

    it('owns duplicate callback registrations independently', () => {
        let callCount = 0;
        const dispatcher = createScenePostRenderDispatcher({
            recordFrameReceipt: () => true,
        });
        const listener = () => {
            callCount += 1;
        };
        const releaseFirst = dispatcher.subscribeAfterRender(listener);
        const releaseSecond = dispatcher.subscribeAfterRender(listener);

        releaseFirst();
        dispatcher.markRenderedFrame();
        dispatcher.flushRenderedFrame(1);
        assert.equal(callCount, 1);

        releaseSecond();
        dispatcher.markRenderedFrame();
        dispatcher.flushRenderedFrame(2);
        assert.equal(callCount, 1);
    });

    it('snapshots listeners and retains a frame marked during dispatch', () => {
        const events: string[] = [];
        const dispatcher = createScenePostRenderDispatcher({
            recordFrameReceipt: () => {
                events.push('receipt');
                return true;
            },
        });
        let releaseSecond: () => void = () => undefined;
        dispatcher.subscribeAfterRender(() => {
            events.push('first');
            releaseSecond();
            dispatcher.markRenderedFrame();
        });
        releaseSecond = dispatcher.subscribeAfterRender(() =>
            events.push('second'),
        );

        dispatcher.markRenderedFrame();
        dispatcher.flushRenderedFrame(1);
        assert.deepEqual(events, ['first', 'second', 'receipt']);
        assert.equal(dispatcher.hasRenderedFramePending(), true);

        dispatcher.flushRenderedFrame(2);
        assert.deepEqual(events, [
            'first',
            'second',
            'receipt',
            'first',
            'receipt',
        ]);
    });

    it('records a frame receipt when root-local after-render work throws', () => {
        const receipts: number[] = [];
        const dispatcher = createScenePostRenderDispatcher({
            recordFrameReceipt: (timestampMs) => {
                receipts.push(timestampMs);
                return true;
            },
        });
        dispatcher.subscribeAfterRender(() => {
            throw new Error('after-render failed');
        });

        dispatcher.markRenderedFrame();
        assert.throws(
            () => dispatcher.flushRenderedFrame(42),
            /after-render failed/,
        );
        assert.deepEqual(receipts, [42]);
        assert.equal(dispatcher.hasRenderedFramePending(), false);
    });

    it('does not notify receipt observers when no scheduler receipt was recorded', () => {
        const events: string[] = [];
        const dispatcher = createScenePostRenderDispatcher({
            recordFrameReceipt: () => {
                events.push('receipt-rejected');
                return false;
            },
        });
        dispatcher.subscribeAfterRender(() => events.push('pass'));
        dispatcher.subscribeFrameReceipt(() => events.push('observer'));

        dispatcher.markRenderedFrame();
        assert.equal(dispatcher.flushRenderedFrame(42), true);
        assert.deepEqual(events, ['pass', 'receipt-rejected']);
    });
});
