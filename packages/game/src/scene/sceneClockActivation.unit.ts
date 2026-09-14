import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consumeSceneClockActivationGap } from './sceneClockActivation';

class TestSceneClock {
    elapsedTime = 0;
    private pendingDelta = 0;

    advanceBy(delta: number) {
        this.pendingDelta += delta;
    }

    getDelta() {
        const delta = this.pendingDelta;
        this.pendingDelta = 0;
        this.elapsedTime += delta;
        return delta;
    }
}

describe('consumeSceneClockActivationGap', () => {
    it('primes an initially inactive clock without advancing scene time', () => {
        const clock = new TestSceneClock();
        clock.advanceBy(2);

        consumeSceneClockActivationGap(clock);

        assert.equal(clock.elapsedTime, 0);
        assert.equal(clock.getDelta(), 0);
    });

    it('discards a resume gap while preserving normal active progression', () => {
        const clock = new TestSceneClock();
        clock.advanceBy(12);
        assert.equal(clock.getDelta(), 12);
        assert.equal(clock.elapsedTime, 12);

        clock.advanceBy(600);
        consumeSceneClockActivationGap(clock);
        assert.equal(clock.elapsedTime, 12);
        assert.equal(clock.getDelta(), 0);

        clock.advanceBy(1 / 60);
        assert.equal(clock.getDelta(), 1 / 60);
        assert.equal(clock.elapsedTime, 12 + 1 / 60);
    });
});
