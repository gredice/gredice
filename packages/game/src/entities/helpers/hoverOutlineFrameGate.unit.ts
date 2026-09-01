import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHoverOutlineFrameGate } from './hoverOutlineFrameGate';

describe('createHoverOutlineFrameGate', () => {
    it('allows one after-effect pass for each frame rendered by its root', () => {
        const gate = createHoverOutlineFrameGate();
        const consumer = gate.registerConsumer();

        assert.equal(consumer.consumeRenderedFrame(), false);

        gate.markRenderedFrame();

        assert.equal(consumer.consumeRenderedFrame(), true);
        assert.equal(consumer.consumeRenderedFrame(), false);
    });

    it('keeps rendered-frame tokens isolated between roots', () => {
        const firstRoot = createHoverOutlineFrameGate();
        const secondRoot = createHoverOutlineFrameGate();
        const firstConsumer = firstRoot.registerConsumer();
        const secondConsumer = secondRoot.registerConsumer();

        firstRoot.markRenderedFrame();

        assert.equal(firstConsumer.consumeRenderedFrame(), true);
        assert.equal(secondConsumer.consumeRenderedFrame(), false);

        secondRoot.markRenderedFrame();

        assert.equal(firstConsumer.consumeRenderedFrame(), false);
        assert.equal(secondConsumer.consumeRenderedFrame(), true);
    });

    it('rejects stale consumers across StrictMode-style effect replay', () => {
        const gate = createHoverOutlineFrameGate();
        const staleConsumer = gate.registerConsumer();

        gate.markRenderedFrame();
        staleConsumer.release();

        const activeConsumer = gate.registerConsumer();
        gate.markRenderedFrame();

        assert.equal(staleConsumer.consumeRenderedFrame(), false);
        assert.equal(activeConsumer.consumeRenderedFrame(), true);
    });

    it('does not let stale cleanup clear the active consumer token', () => {
        const gate = createHoverOutlineFrameGate();
        const staleConsumer = gate.registerConsumer();
        const activeConsumer = gate.registerConsumer();

        gate.markRenderedFrame();
        staleConsumer.release();

        assert.equal(activeConsumer.consumeRenderedFrame(), true);
    });
});
