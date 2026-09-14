import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
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

test('reports in capture phase before Canvas lifecycle listeners can rebind its ref', () => {
    const eventTarget = new EventTarget();
    const addListener = mock.method(eventTarget, 'addEventListener');
    const removeListener = mock.method(eventTarget, 'removeEventListener');
    const unsubscribe = subscribeToRendererContextLoss({
        eventTarget,
        onContextLost: () => undefined,
    });

    assert.deepEqual(addListener.mock.calls[0]?.arguments[2], {
        capture: true,
    });
    unsubscribe();
    assert.deepEqual(
        removeListener.mock.calls[0]?.arguments,
        addListener.mock.calls[0]?.arguments,
    );
});
