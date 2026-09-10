import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isTimeDrivenMaterialAnimationActive,
    resolveTimeDrivenMaterialSpeed,
} from './timeDrivenMaterialAnimation';

describe('time-driven material animation policy', () => {
    it('retains the authored speed in live-time scenes', () => {
        const animationActive = isTimeDrivenMaterialAnimationActive(undefined);

        assert.equal(animationActive, true);
        assert.equal(resolveTimeDrivenMaterialSpeed(2.4, animationActive), 2.4);
    });

    it('pins the material phase when scene time is fixed', () => {
        for (const fixedTimeSeconds of [0, 12, 43_200]) {
            const animationActive =
                isTimeDrivenMaterialAnimationActive(fixedTimeSeconds);

            assert.equal(animationActive, false);
            assert.equal(
                resolveTimeDrivenMaterialSpeed(2.4, animationActive),
                0,
            );
        }
    });
});
