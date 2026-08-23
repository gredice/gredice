import assert from 'node:assert/strict';
import test from 'node:test';
import { subscribeToRendererContextLoss } from './RendererContextLossReporter';

test('reports renderer context loss until the subscription is removed', () => {
    const eventTarget = new EventTarget();
    let lossCount = 0;
    const unsubscribe = subscribeToRendererContextLoss({
        eventTarget,
        onContextLost: () => {
            lossCount += 1;
        },
    });

    eventTarget.dispatchEvent(new Event('webglcontextlost'));
    assert.equal(lossCount, 1);

    unsubscribe();
    eventTarget.dispatchEvent(new Event('webglcontextlost'));
    assert.equal(lossCount, 1);
});
