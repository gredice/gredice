import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    arrowSignColors,
    arrowSignConfigs,
    arrowSignDirections,
    arrowSignNames,
    getArrowSignConfig,
} from './signageConfig';

describe('arrow sign configuration', () => {
    it('covers every color and direction exactly once', () => {
        assert.equal(arrowSignConfigs.length, 16);
        assert.equal(new Set(arrowSignNames).size, 16);

        for (const direction of arrowSignDirections) {
            for (const color of arrowSignColors) {
                assert.equal(
                    arrowSignConfigs.filter(
                        (config) =>
                            config.color === color &&
                            config.direction === direction,
                    ).length,
                    1,
                );
            }
        }
    });

    it('maps names to a stable color and face rotation', () => {
        assert.deepEqual(getArrowSignConfig('ArrowSignRedLeft'), {
            color: 'Red',
            colorHex: '#c9574d',
            direction: 'Left',
            faceRotation: Math.PI,
            name: 'ArrowSignRedLeft',
        });
        assert.equal(
            getArrowSignConfig('ArrowSignBlueUp')?.faceRotation,
            Math.PI / 2,
        );
        assert.equal(
            getArrowSignConfig('ArrowSignGreenDown')?.faceRotation,
            -Math.PI / 2,
        );
        assert.equal(getArrowSignConfig('WoodenSign'), null);
    });
});
